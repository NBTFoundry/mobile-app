// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.devicekey

import java.math.BigInteger
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RequestTextTest {
  private val nonce = "01".repeat(32)
  private val empty = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

  @Test fun acceptsCanonicalRequests() {
    assertTrue(RequestText.valid("NBT-REQ-1\nGET\n/v1/apps\n172.16.222.1:8080\n$nonce\n0\n$empty\n"))
    assertTrue(RequestText.valid("NBT-REQ-1\nPOST\n/v1/settings/set\n127.0.0.1:8080\n$nonce\n17\n$empty\n"))
  }

  @Test fun refusesOtherText() {
    assertFalse(RequestText.valid("hello"))
    assertFalse(RequestText.valid("NBT-REQ-1\nPUT\n/v1/apps\n172.16.222.1:8080\n$nonce\n0\n$empty\n"))
    assertFalse(RequestText.valid("NBT-REQ-1\nGET\n/v1/apps\n172.16.222.1:8080\n$nonce\n01\n$empty\n"))
    assertFalse(RequestText.valid("NBT-REQ-1\nGET\n/v1/apps\n172.16.222.1:8080\n$nonce\n0\n$empty"))
    assertFalse(RequestText.valid("NBT-REQ-1\nGET\n/v2/apps\n172.16.222.1:8080\n$nonce\n0\n$empty\n"))
  }

  @Test fun padsCoordinates() {
    assertArrayEquals(byteArrayOf(0, 0, 1), Hex.fixed(BigInteger.ONE, 3))
    assertArrayEquals(byteArrayOf(-1, -1), Hex.fixed(BigInteger("65535"), 2))
    assertEquals("00ff", Hex.encode(byteArrayOf(0, -1)))
  }
}
