// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import java.io.IOException
import java.net.Inet4Address
import java.net.InetSocketAddress

/**
 * The car's Wi-Fi when another app already joined it: wireless phone projection joins the
 * Wi-Fi Direct group or the CarPlay hotspot with its own WifiNetworkSpecifier request, and a
 * second request from this app would take the connection over (AOSP WifiNetworkFactory: the
 * app on screen overrides a foreground service) or fight it. Android lists that network to
 * every app and lets any app bind sockets to it (it is not restricted), so the app uses it as
 * it is, without holding it, and talks to the car's address on its link.
 *
 * Taken only when it is Wi-Fi, has an address on the link of a car address, and the manager
 * accepts a connection there; otherwise the app joins with its own request.
 */
object SharedNetwork {
  /** A connection to the car on its own link takes milliseconds. */
  const val PROBE_MS = 1_500

  /** The first Wi-Fi network other than `skip` where the manager answers, and the car's address there. */
  fun find(connectivity: ConnectivityManager, skip: Network?): Pair<Network, String>? {
    val all = try {
      @Suppress("DEPRECATION")
      connectivity.allNetworks
    } catch (e: SecurityException) {
      return null
    }
    for (candidate in all) {
      if (candidate == skip) continue
      val ip = carOn(connectivity, candidate) ?: continue
      if (answers(candidate, ip)) return Pair(candidate, ip)
    }
    return null
  }

  /** The car's address on the link of Wi-Fi network `network`, or null (gone, or not the car's). */
  fun carOn(connectivity: ConnectivityManager, network: Network): String? {
    val capabilities = connectivity.getNetworkCapabilities(network) ?: return null
    if (!capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return null
    val addresses = connectivity.getLinkProperties(network)?.linkAddresses ?: return null
    return RouteGuard.CAR_ADDRESSES.firstOrNull { ip ->
      addresses.any { (it.address as? Inet4Address)?.let { a -> RouteGuard.onCarLink(a.address, it.prefixLength, ip) } == true }
    }
  }

  /** The worker or the door accepts a connection. A refusal is not enough: a manager that does
   * not listen on this network (older ones serve the Wi-Fi Direct group only) refuses too. */
  private fun answers(network: Network, ip: String): Boolean =
    listOf(RouteGuard.WORKER_PORT, RouteGuard.DOOR_PORT).any { port ->
      try {
        network.socketFactory.createSocket().use { it.connect(InetSocketAddress(ip, port), PROBE_MS) }
        true
      } catch (e: IOException) {
        false
      } catch (e: SecurityException) {
        false
      }
    }
}
