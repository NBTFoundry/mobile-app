package net.cornera.nbtmgr.carlink

import java.io.ByteArrayInputStream
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test

class HttpWireTest {
  private val hex = "ab".repeat(32)
  private val signed = mapOf("X-NBT-Key" to hex, "X-NBT-Nonce" to hex, "X-NBT-Signature" to "30".repeat(70))

  private fun bad(block: () -> Unit, code: String = "bad-reply") {
    try {
      block()
      fail("accepted")
    } catch (e: LinkException) {
      assertEquals(code, e.code)
    }
  }

  private fun read(text: String) = HttpWire.readResponse(ByteArrayInputStream(text.toByteArray(Charsets.US_ASCII)))

  @Test fun writesTheExactHeadTheCarAccepts() {
    val head = HttpWire.head("POST", "/v1/settings/read", "172.16.222.1:8080", signed, 5).toString(Charsets.US_ASCII)
    assertEquals(
      "POST /v1/settings/read HTTP/1.1\r\nHost: 172.16.222.1:8080\r\nContent-Type: text/plain\r\n" +
        "Content-Length: 5\r\nX-NBT-Key: $hex\r\nX-NBT-Nonce: $hex\r\nX-NBT-Signature: ${"30".repeat(70)}\r\n" +
        "Connection: close\r\n\r\n",
      head,
    )
    val nonce = HttpWire.head("GET", "/v1/nonce", "172.16.222.1:8080", emptyMap(), 0).toString(Charsets.US_ASCII)
    assertEquals("GET /v1/nonce HTTP/1.1\r\nHost: 172.16.222.1:8080\r\nConnection: close\r\n\r\n", nonce)
    val upload = HttpWire.head("POST", "/v1/upload", "172.16.222.1:8080", signed, 9).toString(Charsets.US_ASCII)
    assertEquals(true, upload.contains("Content-Type: application/octet-stream\r\n"))
  }

  @Test fun refusesUnsignedOrInjectedHeaders() {
    bad({ HttpWire.head("GET", "/v1/apps", "h:1", emptyMap(), 0) }, "bad-request")
    bad({ HttpWire.head("GET", "/v1/apps", "h:1", signed + ("Origin" to "x"), 0) }, "bad-request")
    bad({ HttpWire.head("GET", "/v1/apps", "h:1", signed + ("X-NBT-Key" to "$hex\r\nX: y"), 0) }, "bad-request")
    bad({ HttpWire.head("GET", "/v1/apps", "h:1", signed, 1) }, "bad-request")
  }

  @Test fun readsBoundedReplies() {
    val r = read("HTTP/1.1 202 Result\r\nContent-Type: text/plain\r\nContent-Length: 6\r\nX-NBT-Nonce: $hex\r\n" +
      "Connection: close\r\n\r\nOK\nabc")
    assertEquals(CarResponse(202, hex, "OK\nabc"), r)
    val noLength = read("HTTP/1.1 403 Result\r\n\r\nERR auth\n")
    assertEquals(403, noLength.status)
    assertNull(noLength.nonce)
    assertEquals("ERR auth\n", noLength.body)
  }

  @Test fun savesALogReplyAsItCame() {
    val file = File.createTempFile("log", ".part")
    try {
      val body = "--- started\nbad \u0001 byte\n" + "x".repeat(6000)
      val r = HttpWire.readResponse(ByteArrayInputStream(
        ("HTTP/1.1 200 Result\r\nContent-Length: ${body.length}\r\nX-NBT-Nonce: $hex\r\n\r\n$body").toByteArray()), file)
      assertEquals(CarResponse(200, hex, "", body.length.toLong()), r)
      assertEquals(body, file.readText())
      // A refusal is read as usual, not saved; a reply without its length or cut short is refused.
      val refused = HttpWire.readResponse(ByteArrayInputStream("HTTP/1.1 409 Result\r\n\r\nERR request\n".toByteArray()), file)
      assertEquals(CarResponse(409, null, "ERR request\n"), refused)
      bad({ HttpWire.readResponse(ByteArrayInputStream("HTTP/1.1 200 Result\r\n\r\nabc".toByteArray()), file) })
      bad({ HttpWire.readResponse(ByteArrayInputStream("HTTP/1.1 200 Result\r\nContent-Length: 9\r\n\r\nabc".toByteArray()), file) })
      bad({ HttpWire.readResponse(ByteArrayInputStream("HTTP/1.1 200 Result\r\nContent-Length: 999999999\r\n\r\n".toByteArray()), file) })
    } finally {
      file.delete()
    }
  }

  @Test fun showsTheEndOfASavedLogAsPrintableText() {
    val folder = createTempDir()
    try {
      val file = CarLog.file(folder, "app-clock")
      file.writeBytes("started\r\nbad \u0001".toByteArray() + byteArrayOf(0xff.toByte()) + " byte\tok\n".toByteArray())
      assertEquals("started\nbad ?? byte\tok\n", CarLog.tail(file))
      file.writeText("first\n" + "x".repeat(CarLog.TAIL_BYTES) + "\nlast line\n")
      assertEquals("last line\n", CarLog.tail(file))
      for (name in listOf("../x", "", "App", "a/b")) bad({ CarLog.file(folder, name) }, "bad-request")
    } finally {
      folder.deleteRecursively()
    }
  }

  @Test fun rejectsMalformedReplies() {
    bad({ read("") }, "closed")
    bad({ read("HTTP/1.1 200 Result\r\nContent-Length: 4\r\n\r\nOK\n") })
    bad({ read("HTTP/1.1 200 Result\r\nContent-Length: 99999\r\n\r\n") })
    bad({ read("HTTP/1.1 200 Result\r\nTransfer-Encoding: chunked\r\n\r\n") })
    bad({ read("HTTP/1.1 200 Result\r\nX-NBT-Nonce: zz\r\n\r\n") })
    bad({ read("HTTP/1.1 200 Result\r\n\r\n" + "x".repeat(5000)) })
    bad({ read("HTTP/1.1 200 Result\r\n\r\n\u0001") })
    bad({ read("SSH-2.0-dropbear\r\n\r\n") })
  }
}
