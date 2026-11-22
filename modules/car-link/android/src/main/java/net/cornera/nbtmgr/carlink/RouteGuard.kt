// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

/** Where a request may go: the car's two addresses, its two ports and the /v1/ routes. */
data class Target(val ip: String, val port: Int, val desk: Boolean)

class LinkException(val code: String) : Exception(code)

object RouteGuard {
  const val WORKER_PORT = 8080
  const val DOOR_PORT = 8081
  val CAR_ADDRESSES = setOf("172.16.222.1", "172.16.224.1")
  /** The host worker's listener in a debug build; mapped to the workstation. */
  const val DESK_LISTENER = "127.0.0.1"

  private val methods = mapOf(
    "/v1/nonce" to "GET", "/v1/apps" to "GET", "/v1/status" to "GET",
    "/v1/settings/read" to "POST", "/v1/settings/set" to "POST", "/v1/wake" to "POST",
    "/v1/pair" to "POST", "/v1/upload" to "POST", "/v1/remove" to "POST",
    "/v1/logs/app" to "POST", "/v1/logs/system" to "POST", "/v1/logs/clear" to "POST",
    "/v1/logs/manager" to "POST", "/v1/files/list" to "POST", "/v1/files/put" to "POST",
    "/v1/files/data" to "POST", "/v1/files/remove" to "POST", "/v1/autostart" to "POST",
    "/v1/manager" to "GET", "/v1/crashes" to "POST", "/v1/crashes/read" to "POST",
    "/v1/crashes/clear" to "POST",
  )
  /** Routes whose body is a file, sent as `application/octet-stream`; every other body is text. */
  val FILE_ROUTES = setOf("/v1/upload", "/v1/files/data")
  private val door = setOf("/v1/nonce", "/v1/apps", "/v1/settings/read", "/v1/settings/set", "/v1/wake",
    "/v1/logs/app", "/v1/logs/system", "/v1/logs/clear", "/v1/logs/manager", "/v1/autostart", "/v1/manager",
    "/v1/crashes", "/v1/crashes/read", "/v1/crashes/clear")
  private val worker = methods.keys - "/v1/wake"
  private val ipv4 = Regex("^(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])(\\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}$")

  fun isPrivateIpv4(ip: String): Boolean {
    if (!ipv4.matches(ip)) return false
    val p = ip.split('.').map { it.toInt() }
    return p[0] == 10 || (p[0] == 172 && p[1] in 16..31) || (p[0] == 192 && p[1] == 168)
  }

  /** Throws `not-allowed` unless host, method and route are a permitted car request. */
  fun check(host: String, method: String, route: String, deskIp: String?): Target {
    val colon = host.lastIndexOf(':')
    if (colon <= 0) throw LinkException("not-allowed")
    val ip = host.substring(0, colon)
    val port = host.substring(colon + 1).toIntOrNull() ?: throw LinkException("not-allowed")
    if (methods[route] != method) throw LinkException("not-allowed")
    // Debug desk car: the host worker and door on a workstation, on any unprivileged port
    // (8080 is often taken there). The listeners themselves refuse routes they do not serve.
    if (ip == DESK_LISTENER && deskIp != null && isPrivateIpv4(deskIp) && port in 1024..65535) {
      return Target(deskIp, port, desk = true)
    }
    val routes = when (port) {
      WORKER_PORT -> worker
      DOOR_PORT -> door
      else -> throw LinkException("not-allowed")
    }
    if (route !in routes) throw LinkException("not-allowed")
    if (ip in CAR_ADDRESSES) return Target(ip, port, desk = false)
    throw LinkException("not-allowed")
  }
}
