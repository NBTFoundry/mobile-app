package net.cornera.nbtmgr.carinstall

import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import net.cornera.nbtmgr.install.core.Address
import net.cornera.nbtmgr.install.core.Connection
import net.cornera.nbtmgr.install.core.InstallerEvent
import net.cornera.nbtmgr.install.core.InstallerException
import net.cornera.nbtmgr.install.core.Listener
import net.cornera.nbtmgr.install.core.Networks
import net.cornera.nbtmgr.install.core.Session
import net.cornera.nbtmgr.install.core.Tool
import net.cornera.nbtmgr.install.core.bundledRelease
import net.cornera.nbtmgr.install.core.controllerConfigExample
import net.cornera.nbtmgr.install.core.defaultConnection
import java.io.File

class ConnectSettings : Record {
  @Field val host: String = ""
  @Field val port: Int = 0
  @Field val user: String = ""
  @Field val password: String = ""
  @Field val gateway: String? = null
}

/**
 * Installs NBT Manager from the phone, over a Wi-Fi ENET adapter: the Rust
 * installer core (desktop/mobile in the manager repository) through its
 * UniFFI binding. One session at a time; its events reach JavaScript as
 * "onEvent". Errors are fixed codes; nothing here logs.
 */
class CarInstallModule : Module() {
  private val lock = Any()
  private var session: Session? = null
  private val networks by lazy { InstallNetworks(context()) }

  private fun context() =
    appContext.reactContext ?: throw CodedException("ERR_INSTALL", "no-context", null)

  private fun fail(code: String) = CodedException("ERR_INSTALL", code, null)

  private fun current(): Session? = synchronized(lock) { session }

  override fun definition() = ModuleDefinition {
    Name("CarInstall")
    Events("onEvent")

    Function("bundled") {
      val release = bundledRelease()
      mapOf(
        "available" to release.available,
        "version" to release.version,
        "sequence" to release.sequence.toDouble(),
        "message" to release.message,
        "testApp" to release.testApp,
        "controllerExample" to controllerConfigExample(),
      )
    }

    Function("defaults") {
      val c = defaultConnection()
      mapOf("host" to c.host, "port" to c.port.toInt(), "user" to c.user, "password" to c.password)
    }

    AsyncFunction("connect") Coroutine { s: ConnectSettings ->
      if (current() != null) throw fail("busy")
      if (s.port !in 1..65535) throw fail("invalid")
      val held = try {
        networks.acquire()
      } catch (e: InstallException) {
        throw fail(e.code)
      }
      val connection = Connection(s.host, s.port.toUShort(), s.user, s.password, s.gateway)
      val chosen = Networks(
        held.car.networkHandle.toULong(),
        held.addresses.map { (ip, prefix) -> Address(ip, prefix.toUByte()) },
        held.internet?.networkHandle?.toULong(),
      )
      synchronized(lock) {
        session = try {
          Session.connect(connection, chosen, listener)
        } catch (e: InstallerException) {
          networks.release()
          throw fail("invalid")
        }
      }
      mapOf(
        "addresses" to held.addresses.map { (ip, prefix) -> "$ip/$prefix" },
        "mobileData" to (held.internet != null),
      )
    }

    Function("confirmActivation") { approve: Boolean -> current()?.confirmActivation(approve) }
    Function("install") { current()?.install() ?: false }
    Function("update") { current()?.update() ?: false }

    Function("tool") { name: String, text: String? ->
      val tool = when (name) {
        "logOn" -> Tool.LogOn
        "logOff" -> Tool.LogOff
        "fetchLog" -> Tool.FetchLog
        "fetchSystemLog" -> Tool.FetchSystemLog
        "collectAll" -> Tool.CollectAll
        "provisionTestApp" -> Tool.ProvisionTestApp
        "writeConfig" -> Tool.WriteConfig(text ?: throw fail("invalid"))
        "removeConfig" -> Tool.RemoveConfig
        "removeAll" -> Tool.RemoveAll
        "restartIdrive" -> Tool.RestartIdrive
        else -> throw fail("invalid")
      }
      current()?.tool(tool) ?: false
    }

    Function("disconnect") { current()?.disconnect() }

    OnDestroy {
      current()?.disconnect()
      networks.release()
    }
  }

  private val listener = object : Listener {
    override fun onEvent(event: InstallerEvent) {
      sendEvent("onEvent", describe(event))
      if (event is InstallerEvent.Finished) {
        val ended = synchronized(lock) { session.also { session = null } }
        ended?.close()
        networks.release()
      }
    }
  }

  private fun describe(event: InstallerEvent): Map<String, Any?> = when (event) {
    is InstallerEvent.Message -> mapOf("type" to "message", "text" to event.text)
    is InstallerEvent.Note -> mapOf("type" to "message", "text" to event.text)
    is InstallerEvent.Detail -> mapOf("type" to "detail", "text" to event.text)
    is InstallerEvent.ConfirmActivation ->
      mapOf("type" to "confirmActivation", "host" to event.host, "hint" to event.hint)
    is InstallerEvent.Phase -> mapOf(
      "type" to "phase", "index" to event.index.toInt(), "count" to event.count.toInt(),
      "label" to event.label, "bytes" to event.bytes.toDouble(),
    )
    is InstallerEvent.Connected -> mapOf("type" to "connected")
    is InstallerEvent.Target -> mapOf("type" to "target", "ok" to event.ok)
    is InstallerEvent.Progress ->
      mapOf("type" to "progress", "sent" to event.sent.toDouble(), "total" to event.total.toDouble())
    is InstallerEvent.InstallFinished -> mapOf("type" to "installFinished", "ok" to event.ok)
    is InstallerEvent.UpdateFinished -> mapOf("type" to "updateFinished", "ok" to event.ok)
    is InstallerEvent.RestartNeeded -> mapOf("type" to "restartNeeded")
    is InstallerEvent.ToolFinished -> mapOf("type" to "toolFinished", "ok" to event.ok, "text" to event.message)
    is InstallerEvent.LogFetched ->
      if (event.system) saveLog("system", "slog", "log", event.data) else saveLog("debug", "debug", "log", event.data)
    is InstallerEvent.Collected -> saveLog("collection", "collect", "txt", event.data)
    is InstallerEvent.Finished -> mapOf("type" to "finished", "text" to event.message)
  }

  /** A log or collection from the head unit, saved in the cache for sharing; JavaScript gets its location. */
  private fun saveLog(kind: String, prefix: String, extension: String, data: ByteArray): Map<String, Any?> {
    val folder = File(context().cacheDir, "installer-logs")
    val file = File(folder, "$prefix-${System.currentTimeMillis() / 1000}.$extension")
    return try {
      folder.mkdirs()
      file.writeBytes(data)
      mapOf("type" to "log", "kind" to kind, "uri" to android.net.Uri.fromFile(file).toString(), "size" to data.size.toDouble())
    } catch (e: java.io.IOException) {
      mapOf("type" to "log", "kind" to kind, "uri" to null, "size" to data.size.toDouble())
    }
  }
}
