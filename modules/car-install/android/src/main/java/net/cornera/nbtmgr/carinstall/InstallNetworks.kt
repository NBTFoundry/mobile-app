// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carinstall

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.suspendCancellableCoroutine
import java.net.Inet4Address
import kotlin.coroutines.resume

class InstallException(val code: String) : Exception(code)

/**
 * The two networks the installer needs, held while it runs.
 *
 * The car: the Wi-Fi the phone is on, which the user joined in Android's Wi-Fi
 * settings (the Wi-Fi ENET adapter's). Requested without the internet
 * capability, since the adapter has none, and held so Android keeps it.
 * The internet: mobile data, for the SSH activation service. Requesting it
 * keeps mobile data up while the Wi-Fi is connected; without it, enabling SSH
 * fails and everything else still works.
 */
class InstallNetworks(context: Context) {
  private val connectivity = context.getSystemService(ConnectivityManager::class.java)
  private val callbacks = mutableListOf<ConnectivityManager.NetworkCallback>()

  class Held(val car: Network, val addresses: List<Pair<String, Int>>, val internet: Network?)

  suspend fun acquire(): Held {
    release()
    val wifi = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
      .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()
    val car = request(wifi, WIFI_MS) ?: throw InstallException("no-wifi")
    val addresses = connectivity.getLinkProperties(car)?.linkAddresses.orEmpty()
      .mapNotNull { link -> (link.address as? Inet4Address)?.hostAddress?.let { it to link.prefixLength } }
    if (addresses.isEmpty()) {
      release()
      throw InstallException("no-address")
    }
    val mobile = NetworkRequest.Builder()
      .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .build()
    return Held(car, addresses, request(mobile, MOBILE_MS))
  }

  private suspend fun request(request: NetworkRequest, timeoutMs: Int): Network? =
    suspendCancellableCoroutine { continuation ->
      val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
          if (continuation.isActive) continuation.resume(network)
        }

        override fun onUnavailable() {
          if (continuation.isActive) continuation.resume(null)
        }
      }
      synchronized(callbacks) { callbacks += callback }
      try {
        connectivity.requestNetwork(request, callback, timeoutMs)
      } catch (e: RuntimeException) {
        // SecurityException included: no network rather than a native error.
        if (continuation.isActive) continuation.resume(null)
      }
    }

  fun release() {
    val held = synchronized(callbacks) { callbacks.toList().also { callbacks.clear() } }
    for (callback in held) {
      try {
        connectivity.unregisterNetworkCallback(callback)
      } catch (e: IllegalArgumentException) {
        // Never registered, or already released.
      }
    }
  }

  companion object {
    const val WIFI_MS = 5_000
    const val MOBILE_MS = 8_000
  }
}
