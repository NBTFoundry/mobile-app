// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

import android.content.pm.ApplicationInfo
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import javax.net.SocketFactory

class LinkRequest : Record {
  @Field val host: String = ""
  @Field val method: String = ""
  @Field val route: String = ""
  @Field val headers: Map<String, String> = emptyMap()
  @Field val text: String? = null
  @Field val fileUri: String? = null
  @Field val size: Double = 0.0
  @Field val progressId: String? = null
  /** A log route: a 200 reply is saved under this name (CarLog). */
  @Field val saveAs: String? = null
}

/**
 * Joins the car's Wi-Fi and sends allow-listed requests on sockets bound to it.
 * Errors reach JavaScript as fixed codes only; nothing here logs.
 */
class CarLinkModule : Module() {
  private val mutex = Mutex()
  private var deskIp: String? = null
  /** Uploads to stop, by progress id: the next progress step ends the request ("stopped"). */
  private val stopped = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
  private val network by lazy {
    CarNetwork(context()).also { it.onState = { state -> sendEvent("onNetwork", mapOf("state" to state)) } }
  }
  private val files by lazy { LocalFiles(listOf(context().filesDir, context().cacheDir)) }

  private fun context() = appContext.reactContext ?: throw CodedException("ERR_LINK_NO_CONTEXT", "no-context", null)
  private fun debuggable() = (context().applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
  private fun fail(e: LinkException) = CodedException("ERR_LINK", e.code, null)

  override fun definition() = ModuleDefinition {
    Name("CarLink")
    Events("onProgress", "onNetwork")

    AsyncFunction("join") Coroutine { ssid: String, passphrase: String ->
      try {
        network.join(ssid, passphrase)
      } catch (e: LinkException) {
        throw fail(e)
      }
    }

    Function("release") {
      network.release()
    }

    /** Debug builds only: the host worker on a workstation stands in for the car. */
    Function("setDeskIp") { ip: String? ->
      if (ip != null && (!debuggable() || !RouteGuard.isPrivateIpv4(ip))) throw fail(LinkException("not-allowed"))
      deskIp = ip
    }

    Function("randomHex") { bytes: Int ->
      val out = ByteArray(bytes.coerceIn(1, 32))
      java.security.SecureRandom().nextBytes(out)
      LocalFiles.hex(out)
    }

    AsyncFunction("inspect") Coroutine { uri: String, headSize: Int ->
      withContext(Dispatchers.IO) {
        try {
          val (size, sha256, head) = files.inspect(uri, headSize.coerceIn(0, 4096))
          mapOf("size" to size.toDouble(), "sha256" to sha256, "head" to LocalFiles.hex(head))
        } catch (e: LinkException) {
          throw fail(e)
        }
      }
    }

    Function("cancel") { progressId: String ->
      stopped.add(progressId)
    }

    AsyncFunction("request") Coroutine { r: LinkRequest ->
      mutex.withLock {
        withContext(Dispatchers.IO) {
          try {
            send(r)
          } catch (e: LinkException) {
            throw fail(e)
          }
        }
      }
    }
  }

  private fun send(r: LinkRequest): Map<String, Any?> {
    val target = RouteGuard.check(r.host, r.method, r.route, deskIp)
    val factory: SocketFactory = if (target.desk) {
      SocketFactory.getDefault()
    } else {
      network.current()?.socketFactory ?: throw LinkException("no-network")
    }
    val body = when {
      r.fileUri != null -> {
        if (r.route !in RouteGuard.FILE_ROUTES || r.text != null) throw LinkException("bad-request")
        val file = files.resolve(r.fileUri)
        if (file.length() != r.size.toLong()) throw LinkException("file")
        Body.Upload(file, file.length())
      }
      r.text != null -> {
        if (r.route in RouteGuard.FILE_ROUTES || r.text.length > 2048) throw LinkException("bad-request")
        Body.Text(r.text)
      }
      else -> null
    }
    if ((r.method == "POST") != (body != null)) throw LinkException("bad-request")
    if (r.saveAs != null && r.route !in CarLog.ROUTES) throw LinkException("bad-request")
    val saved = r.saveAs?.let { CarLog.file(context().cacheDir, it) }
    val part = saved?.let { java.io.File(it.path + ".part") }
    try {
      val response = CarHttp(factory).send(target, r.host, r.method, r.route, r.headers, body, part) { sent, total ->
        r.progressId?.let {
          // Closing the connection mid-file: the car discards what it received.
          if (stopped.remove(it)) throw LinkException("stopped")
          sendEvent("onProgress", mapOf("id" to it, "sent" to sent.toDouble(), "total" to total.toDouble()))
        }
      }
      if (saved == null || part == null || response.saved == null) {
        return mapOf("status" to response.status, "nonce" to response.nonce, "body" to response.body)
      }
      if (!part.renameTo(saved)) throw LinkException("file")
      val file = mapOf("uri" to android.net.Uri.fromFile(saved).toString(), "size" to response.saved.toDouble(),
        "tail" to CarLog.tail(saved))
      return mapOf("status" to response.status, "nonce" to response.nonce, "body" to "", "saved" to file)
    } finally {
      part?.delete()
      r.progressId?.let { stopped.remove(it) }
    }
  }
}
