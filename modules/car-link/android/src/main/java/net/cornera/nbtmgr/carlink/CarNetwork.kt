// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext

/**
 * The car's Wi-Fi as a local-only network for this app. When another app already joined it
 * (wireless phone projection), that network is used as it is (SharedNetwork). Otherwise the app
 * requests its own: Android shows its Connect dialog the first time, and drops the network as
 * soon as no request holds it, so it is held across actions and released by the app (idle,
 * background, another car).
 */
class CarNetwork(context: Context) {
  private val connectivity = context.getSystemService(ConnectivityManager::class.java)
  private var callback: ConnectivityManager.NetworkCallback? = null
  private var held: Pair<String, String>? = null
  /** Another app's network in use, and the car addresses it was found for; never held. */
  private var shared: Network? = null
  private var sharedIps: List<String> = emptyList()
  /** The join waiting for Android, ended by the first of: available, unavailable, release. */
  private var pending: CancellableContinuation<Network>? = null
  @Volatile var network: Network? = null
    private set
  /** Told "connected", "lost" (Android dropped it) or "released"; no details. */
  var onState: ((String) -> Unit)? = null

  /** `ips`: the car addresses the next requests go to (both while pairing). */
  suspend fun join(ssid: String, passphrase: String, ips: List<String>): Network {
    if (ssid.isEmpty() || ssid.length > 32 || passphrase.length !in 8..63 ||
      (ssid + passphrase).any { it.code !in 0x20..0x7e }) throw LinkException("bad-request")
    RouteGuard.carIps(ips)
    val current = network
    if (current != null && callback != null && held == Pair(ssid, passphrase)) return current
    val reuse = shared
    if (reuse != null && ips.all { it in sharedIps } &&
      withContext(Dispatchers.IO) { SharedNetwork.stillOn(connectivity, reuse, ips) }) return reuse
    // A network just let go of (its car may differ) is never taken for another app's.
    release()
    val found = withContext(Dispatchers.IO) { SharedNetwork.find(connectivity, ips, current) }
    if (found != null) {
      shared = found
      sharedIps = ips
      network = found
      onState?.invoke("connected")
      return found
    }
    return request(ssid, passphrase)
  }

  private suspend fun request(ssid: String, passphrase: String): Network {
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
          if (network != lost) return
          // The request goes too: kept, Android would serve it again by taking the car's Wi-Fi
          // back from the app that joined it meanwhile (wireless projection), and they would
          // take turns. The next action joins again, sharing that app's network if it is there.
          drop()
          onState?.invoke("lost")
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

  /** The network for the next request; another app's that went away is given up ("lost"). */
  fun current(): Network? {
    val reuse = shared ?: return network
    if (SharedNetwork.stillOn(connectivity, reuse, sharedIps)) return reuse
    if (drop()) onState?.invoke("lost")
    return null
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
    if (drop()) onState?.invoke("released")
  }

  /** Forgets the network and ends the app's request; false when there was none. */
  @Synchronized
  private fun drop(): Boolean {
    val cb = callback
    val had = cb != null || shared != null
    callback = null
    held = null
    shared = null
    sharedIps = emptyList()
    network = null
    if (cb != null) {
      try {
        connectivity.unregisterNetworkCallback(cb)
      } catch (e: IllegalArgumentException) {
        // Already unregistered.
      }
    }
    return had
  }

  companion object {
    /** Long enough for the driver to answer Android's Connect dialog. */
    const val JOIN_MS = 60_000
  }
}
