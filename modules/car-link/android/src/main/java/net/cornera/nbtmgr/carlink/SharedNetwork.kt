// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.system.ErrnoException
import android.system.OsConstants
import java.io.IOException
import java.net.ConnectException
import java.net.Inet4Address
import java.net.InetSocketAddress

/**
 * The car's Wi-Fi when another app already joined it: wireless phone projection joins it with
 * its own WifiNetworkSpecifier request, and a second request from this app would take the
 * connection over (AOSP WifiNetworkFactory: the app on screen overrides a foreground service)
 * or fight it. Android lists that network to every app and lets any app bind sockets to it
 * (it is not restricted), so the app uses it as it is, without holding it.
 *
 * Taken only when it is Wi-Fi, has an address on the link of a car address, and the car
 * answers there; otherwise the app joins with its own request.
 */
object SharedNetwork {
  /** A connection to the car on its own link takes milliseconds. */
  const val PROBE_MS = 1_500

  /** The first Wi-Fi network other than `skip` where the car answers at one of `ips`. */
  fun find(connectivity: ConnectivityManager, ips: List<String>, skip: Network?): Network? {
    val all = try {
      @Suppress("DEPRECATION")
      connectivity.allNetworks
    } catch (e: SecurityException) {
      return null
    }
    for (candidate in all) {
      if (candidate == skip) continue
      val ip = carOn(connectivity, candidate, ips) ?: continue
      if (answers(candidate, ip)) return candidate
    }
    return null
  }

  /** Whether `network` is still up with an address on the link of one of `ips`. */
  fun stillOn(connectivity: ConnectivityManager, network: Network, ips: List<String>): Boolean =
    carOn(connectivity, network, ips) != null

  private fun carOn(connectivity: ConnectivityManager, network: Network, ips: List<String>): String? {
    val capabilities = connectivity.getNetworkCapabilities(network) ?: return null
    if (!capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return null
    val addresses = connectivity.getLinkProperties(network)?.linkAddresses ?: return null
    return ips.firstOrNull { ip ->
      addresses.any { (it.address as? Inet4Address)?.let { a -> RouteGuard.onCarLink(a.address, it.prefixLength, ip) } == true }
    }
  }

  /** A connection, or a refusal (it comes from the car: only the worker is closed), means the car is there. */
  private fun answers(network: Network, ip: String): Boolean = try {
    network.socketFactory.createSocket().use { it.connect(InetSocketAddress(ip, RouteGuard.WORKER_PORT), PROBE_MS) }
    true
  } catch (e: ConnectException) {
    (e.cause as? ErrnoException)?.errno == OsConstants.ECONNREFUSED || e.message?.contains("ECONNREFUSED") == true
  } catch (e: IOException) {
    false
  } catch (e: SecurityException) {
    false
  }
}
