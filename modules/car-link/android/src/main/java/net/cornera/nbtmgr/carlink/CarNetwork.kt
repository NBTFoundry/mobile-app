package net.cornera.nbtmgr.carlink

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * The car's Wi-Fi as a local-only network for this app. Android shows its Connect
 * dialog the first time. Android drops the network as soon as no request holds it,
 * so it is held across actions and released by the app (idle, background, another car).
 */
class CarNetwork(context: Context) {
  private val connectivity = context.getSystemService(ConnectivityManager::class.java)
  private var callback: ConnectivityManager.NetworkCallback? = null
  private var held: Pair<String, String>? = null
  /** The join waiting for Android, ended by the first of: available, unavailable, release. */
  private var pending: CancellableContinuation<Network>? = null
  @Volatile var network: Network? = null
    private set
  /** Told "connected", "lost" (Android dropped it) or "released"; no details. */
  var onState: ((String) -> Unit)? = null

  suspend fun join(ssid: String, passphrase: String): Network {
    if (ssid.isEmpty() || ssid.length > 32 || passphrase.length !in 8..63 ||
      (ssid + passphrase).any { it.code !in 0x20..0x7e }) throw LinkException("bad-request")
    val current = network
    if (current != null && callback != null && held == Pair(ssid, passphrase)) return current
    release()
    held = Pair(ssid, passphrase)
    val specifier = WifiNetworkSpecifier.Builder().setSsid(ssid).setWpa2Passphrase(passphrase).build()
    val request = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .setNetworkSpecifier(specifier)
      .build()
    return suspendCancellableCoroutine { continuation ->
      val cb = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(available: Network) {
          network = available
          onState?.invoke("connected")
          settle(Result.success(available))
        }

        override fun onUnavailable() {
          network = null
          settle(Result.failure(LinkException("join-failed")))
        }

        override fun onLost(lost: Network) {
          if (network == lost) {
            network = null
            onState?.invoke("lost")
          }
        }
      }
      callback = cb
      synchronized(this) { pending = continuation }
      continuation.invokeOnCancellation { release() }
      try {
        connectivity.requestNetwork(request, cb, JOIN_MS)
      } catch (e: SecurityException) {
        callback = null
        settle(Result.failure(LinkException("permission")))
      } catch (e: RuntimeException) {
        callback = null
        settle(Result.failure(LinkException("join-failed")))
      }
    }
  }

  @Synchronized
  private fun settle(result: Result<Network>) {
    val waiting = pending ?: return
    pending = null
    if (waiting.isActive) waiting.resumeWith(result)
  }

  /** Lets go of the network; a join still waiting fails with `cancelled`. */
  fun release() {
    settle(Result.failure(LinkException("cancelled")))
    val cb = callback ?: return
    callback = null
    held = null
    network = null
    try {
      connectivity.unregisterNetworkCallback(cb)
    } catch (e: IllegalArgumentException) {
      // Already unregistered.
    }
    onState?.invoke("released")
  }

  companion object {
    /** Long enough for the driver to answer Android's Connect dialog. */
    const val JOIN_MS = 60_000
  }
}
