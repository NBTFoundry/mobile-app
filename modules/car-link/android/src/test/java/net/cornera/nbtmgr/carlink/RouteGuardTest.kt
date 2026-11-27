// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

class RouteGuardTest {
  private fun refused(host: String, method: String, route: String, desk: String? = null) {
    try {
      RouteGuard.check(host, method, route, desk)
      fail("allowed $method $host$route")
    } catch (e: LinkException) {
      assertEquals("not-allowed", e.code)
    }
  }

  @Test fun allowsTheCarListeners() {
    assertEquals(Target("172.16.222.1", 8080, false), RouteGuard.check("172.16.222.1:8080", "POST", "/v1/upload", null))
    assertEquals(Target("172.16.224.1", 8081, false), RouteGuard.check("172.16.224.1:8081", "POST", "/v1/wake", null))
    // The logs, from either listener.
    for (port in listOf(8080, 8081)) {
      for (route in listOf("/v1/logs/app", "/v1/logs/system", "/v1/logs/clear", "/v1/logs/manager")) {
        assertEquals(Target("172.16.222.1", port, false), RouteGuard.check("172.16.222.1:$port", "POST", route, null))
      }
    }
    refused("172.16.222.1:8080", "GET", "/v1/logs/app")
    // Start with the car, from either listener (as the settings).
    for (port in listOf(8080, 8081)) {
      assertEquals(Target("172.16.222.1", port, false), RouteGuard.check("172.16.222.1:$port", "POST", "/v1/autostart", null))
    }
    refused("172.16.222.1:8080", "GET", "/v1/autostart")
    // The installed manager, from either listener.
    for (port in listOf(8080, 8081)) {
      assertEquals(Target("172.16.222.1", port, false), RouteGuard.check("172.16.222.1:$port", "GET", "/v1/manager", null))
    }
    refused("172.16.222.1:8080", "POST", "/v1/manager")
    // The last self test's report, from either listener.
    for (port in listOf(8080, 8081)) {
      assertEquals(Target("172.16.222.1", port, false), RouteGuard.check("172.16.222.1:$port", "GET", "/v1/selftest", null))
      refused("172.16.222.1:$port", "POST", "/v1/selftest")
    }
    // The theme the car shows, from either listener.
    for (port in listOf(8080, 8081)) {
      assertEquals(Target("172.16.222.1", port, false), RouteGuard.check("172.16.222.1:$port", "GET", "/v1/theme", null))
      refused("172.16.222.1:$port", "POST", "/v1/theme")
    }
    // Crash reports, from either listener.
    for (port in listOf(8080, 8081)) {
      for (route in listOf("/v1/crashes", "/v1/crashes/read", "/v1/crashes/clear")) {
        assertEquals(Target("172.16.222.1", port, false), RouteGuard.check("172.16.222.1:$port", "POST", route, null))
        refused("172.16.222.1:$port", "GET", route)
      }
    }
    // An application's phone page and its events, from either listener.
    for (port in listOf(8080, 8081)) {
      for (route in listOf("/v1/companion", "/v1/companion/event")) {
        assertEquals(Target("172.16.222.1", port, false), RouteGuard.check("172.16.222.1:$port", "POST", route, null))
        refused("172.16.222.1:$port", "GET", route)
      }
    }
    // Developer keys: listed from either listener, added and removed on the worker only.
    for (port in listOf(8080, 8081)) {
      assertEquals(Target("172.16.222.1", port, false), RouteGuard.check("172.16.222.1:$port", "GET", "/v1/keys", null))
      refused("172.16.222.1:$port", "POST", "/v1/keys")
    }
    for (route in listOf("/v1/keys/add", "/v1/keys/remove")) {
      assertEquals(Target("172.16.222.1", 8080, false), RouteGuard.check("172.16.222.1:8080", "POST", route, null))
      refused("172.16.222.1:8081", "POST", route)
      refused("172.16.222.1:8080", "GET", route)
    }
    // An application's files, from the worker only.
    for (route in listOf("/v1/files/list", "/v1/files/put", "/v1/files/data", "/v1/files/remove")) {
      assertEquals(Target("172.16.222.1", 8080, false), RouteGuard.check("172.16.222.1:8080", "POST", route, null))
      refused("172.16.222.1:8081", "POST", route)
      refused("172.16.222.1:8080", "GET", route)
    }
  }

  @Test fun refusesOtherHostsPortsRoutesAndMethods() {
    refused("192.168.1.1:8080", "GET", "/v1/apps")
    refused("172.16.222.1:22", "GET", "/v1/apps")
    refused("172.16.222.1:8080", "POST", "/v1/apps")
    refused("172.16.222.1:8080", "POST", "/v1/approve")
    refused("172.16.222.1:8080", "POST", "/v1/wake")
    refused("172.16.222.1:8081", "POST", "/v1/upload")
    refused("172.16.222.1:8081", "POST", "/v1/pair")
    refused("172.16.222.1:8080/x", "GET", "/v1/apps")
  }

  @Test fun mapsTheDeskListenerOnlyWhenSet() {
    refused("127.0.0.1:8080", "GET", "/v1/apps")
    assertEquals(Target("192.168.1.20", 8080, true), RouteGuard.check("127.0.0.1:8080", "GET", "/v1/apps", "192.168.1.20"))
    refused("127.0.0.1:8080", "GET", "/v1/apps", "8.8.8.8")
    assertEquals(Target("10.0.2.2", 18081, true), RouteGuard.check("127.0.0.1:18081", "POST", "/v1/wake", "10.0.2.2"))
    refused("127.0.0.1:22", "GET", "/v1/apps", "10.0.2.2")
    refused("127.0.0.1:18080", "POST", "/v1/approve", "10.0.2.2")
    refused("172.16.222.1:18080", "GET", "/v1/apps", "10.0.2.2")
    assertTrue(RouteGuard.isPrivateIpv4("10.0.0.2"))
    assertFalse(RouteGuard.isPrivateIpv4("172.32.0.1"))
    assertFalse(RouteGuard.isPrivateIpv4("192.168.1.256"))
  }

  @Test fun findsTheCarOnThePhonesLink() {
    val phone = byteArrayOf(172.toByte(), 16, 222.toByte(), 100)
    assertTrue(RouteGuard.onCarLink(phone, 24, "172.16.222.1"))
    assertFalse(RouteGuard.onCarLink(phone, 24, "172.16.224.1"))
    // On the CarPlay hotspot.
    assertTrue(RouteGuard.onCarLink(byteArrayOf(172.toByte(), 16, 224.toByte(), 7), 24, "172.16.224.1"))
    assertTrue(RouteGuard.onCarLink(phone, 16, "172.16.224.1"))
    // The phone's own address, a host-only prefix, IPv6 or a bad address: never the car.
    assertFalse(RouteGuard.onCarLink(byteArrayOf(172.toByte(), 16, 222.toByte(), 1), 24, "172.16.222.1"))
    assertFalse(RouteGuard.onCarLink(phone, 32, "172.16.222.1"))
    assertFalse(RouteGuard.onCarLink(ByteArray(16), 64, "172.16.222.1"))
    assertFalse(RouteGuard.onCarLink(phone, 24, "172.16.222.1.5"))
    // Home Wi-Fi on another range.
    assertFalse(RouteGuard.onCarLink(byteArrayOf(192.toByte(), 168.toByte(), 1, 20), 24, "172.16.222.1"))
  }
}
