// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.io.InputStream

/** `saved`: the size of a log reply written to the file given to readResponse. */
data class CarResponse(val status: Int, val nonce: String?, val body: String, val saved: Long? = null)

/**
 * HTTP/1.1 as the car's parser accepts it: exact headers, no chunking, compression or
 * Expect, one request per connection. Replies are bounded and ASCII, except a log reply
 * (PROTOCOL.md, Logs), which is saved to a file as it came.
 */
object HttpWire {
  const val HEADER_MAX = 8192
  const val BODY_MAX = 4096
  /** The car sends at most 8 MiB of system log; leave room. */
  const val SAVED_MAX = 16L * 1024 * 1024
  private val hex64 = Regex("^[0-9a-f]{64}$")
  private val signature = Regex("^([0-9a-f]{2}){8,72}$")

  fun head(method: String, route: String, host: String, headers: Map<String, String>, length: Long): ByteArray {
    val key = headers["X-NBT-Key"]
    val nonce = headers["X-NBT-Nonce"]
    val sig = headers["X-NBT-Signature"]
    if (headers.keys.any { it !in setOf("X-NBT-Key", "X-NBT-Nonce", "X-NBT-Signature") }) throw LinkException("bad-request")
    val signed = route != "/v1/nonce"
    if (signed && (key == null || nonce == null || sig == null || !hex64.matches(key) || !hex64.matches(nonce) ||
        !signature.matches(sig))) throw LinkException("bad-request")
    if (!signed && headers.isNotEmpty()) throw LinkException("bad-request")
    if (length < 0 || (method == "GET" && length != 0L)) throw LinkException("bad-request")
    val out = StringBuilder()
    out.append(method).append(' ').append(route).append(" HTTP/1.1\r\n")
    out.append("Host: ").append(host).append("\r\n")
    if (method == "POST") {
      out.append("Content-Type: ").append(if (route in RouteGuard.FILE_ROUTES) "application/octet-stream" else "text/plain").append("\r\n")
      out.append("Content-Length: ").append(length).append("\r\n")
    }
    if (signed) {
      out.append("X-NBT-Key: ").append(key).append("\r\n")
      out.append("X-NBT-Nonce: ").append(nonce).append("\r\n")
      out.append("X-NBT-Signature: ").append(sig).append("\r\n")
    }
    out.append("Connection: close\r\n\r\n")
    return out.toString().toByteArray(Charsets.US_ASCII)
  }

  /** With `save`, a 200 reply's body goes to that file and the response carries its size. */
  fun readResponse(input: InputStream, save: File? = null): CarResponse {
    val header = ByteArrayOutputStream()
    var tail = 0
    while (tail != 0x0d0a0d0a) {
      val b = input.read()
      if (b < 0) throw LinkException(if (header.size() == 0) "closed" else "bad-reply")
      header.write(b)
      tail = (tail shl 8) or b
      if (header.size() > HEADER_MAX) throw LinkException("bad-reply")
    }
    val lines = header.toByteArray().toString(Charsets.US_ASCII).removeSuffix("\r\n\r\n").split("\r\n")
    val status = Regex("^HTTP/1\\.[01] ([1-5][0-9]{2})( [\\x20-\\x7e]*)?$").find(lines[0])?.groupValues?.get(1)?.toInt()
      ?: throw LinkException("bad-reply")
    var length: Long? = null
    var nonce: String? = null
    for (line in lines.drop(1)) {
      val colon = line.indexOf(':')
      if (colon <= 0) throw LinkException("bad-reply")
      val name = line.substring(0, colon).lowercase()
      val value = line.substring(colon + 1).trim()
      when (name) {
        "content-length" -> {
          if (length != null || !Regex("^(0|[1-9][0-9]{0,8})$").matches(value)) throw LinkException("bad-reply")
          length = value.toLong()
        }
        "x-nbt-nonce" -> {
          if (nonce != null || !hex64.matches(value)) throw LinkException("bad-reply")
          nonce = value
        }
        "transfer-encoding", "content-encoding" -> throw LinkException("bad-reply")
      }
    }
    if (save != null && status == 200) {
      if (length == null || length > SAVED_MAX) throw LinkException("bad-reply")
      return CarResponse(status, nonce, "", copy(input, length, save))
    }
    if (length != null && length > BODY_MAX) throw LinkException("bad-reply")
    val body = readBody(input, length?.toInt())
    if (body.any { (it < 0x20 && it != 0x0a.toByte() && it != 0x09.toByte()) || it > 0x7e }) throw LinkException("bad-reply")
    return CarResponse(status, nonce, body.toString(Charsets.US_ASCII))
  }

  private fun copy(input: InputStream, length: Long, file: File): Long {
    val out = try {
      file.outputStream()
    } catch (e: IOException) {
      throw LinkException("file")
    }
    out.use {
      val buffer = ByteArray(64 * 1024)
      var copied = 0L
      while (copied < length) {
        val n = input.read(buffer, 0, minOf(buffer.size.toLong(), length - copied).toInt())
        if (n < 0) throw LinkException("bad-reply")
        try {
          it.write(buffer, 0, n)
        } catch (e: IOException) {
          throw LinkException("file")
        }
        copied += n
      }
    }
    return length
  }

  private fun readBody(input: InputStream, length: Int?): ByteArray {
    val out = ByteArrayOutputStream()
    val buffer = ByteArray(1024)
    val limit = length ?: BODY_MAX
    while (out.size() < limit || length == null) {
      val n = input.read(buffer, 0, minOf(buffer.size, limit + 1 - out.size()))
      if (n < 0) break
      out.write(buffer, 0, n)
      if (out.size() > BODY_MAX) throw LinkException("bad-reply")
    }
    if (length != null && out.size() != length) throw LinkException("bad-reply")
    return out.toByteArray()
  }
}
