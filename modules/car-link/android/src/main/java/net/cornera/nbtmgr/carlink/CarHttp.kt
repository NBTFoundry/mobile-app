// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.ConnectException
import java.net.InetSocketAddress
import java.net.NoRouteToHostException
import java.net.Socket
import java.net.SocketTimeoutException
import javax.net.SocketFactory

sealed class Body {
  data class Text(val text: String) : Body()
  data class Upload(val file: File, val size: Long) : Body()
}

/** One request per connection, on a socket from the car network's factory. */
class CarHttp(private val factory: SocketFactory) {
  fun send(
    target: Target, host: String, method: String, route: String, headers: Map<String, String>, body: Body?,
    save: File? = null, progress: (Long, Long) -> Unit,
  ): CarResponse {
    // UTF-8, as the signature's digest was taken (session.ts: printable ASCII and file names' characters).
    val bytes = (body as? Body.Text)?.text?.toByteArray(Charsets.UTF_8)
    val length = bytes?.size?.toLong() ?: (body as? Body.Upload)?.size ?: 0L
    val head = HttpWire.head(method, route, host, headers, length)
    try {
      factory.createSocket().use { socket ->
        socket.connect(InetSocketAddress(target.ip, target.port), CONNECT_MS)
        socket.soTimeout = if (body is Body.Upload) UPLOAD_REPLY_MS else REPLY_MS
        socket.tcpNoDelay = true
        val written = write(socket, head, bytes, body as? Body.Upload, progress)
        return try {
          HttpWire.readResponse(socket.getInputStream(), save)
        } catch (e: LinkException) {
          // The car may refuse an upload before reading it; without its reply the write error stands.
          throw if (written != null) written else e
        }
      }
    } catch (e: LinkException) {
      throw e
    } catch (e: ConnectException) {
      throw LinkException("refused")
    } catch (e: NoRouteToHostException) {
      throw LinkException("no-route")
    } catch (e: SocketTimeoutException) {
      throw LinkException("timeout")
    } catch (e: IOException) {
      throw LinkException("io")
    } catch (e: SecurityException) {
      throw LinkException("no-network")
    }
  }

  /** Returns a write failure to report if no reply follows, or null when all was written. */
  private fun write(socket: Socket, head: ByteArray, text: ByteArray?, upload: Body.Upload?,
                    progress: (Long, Long) -> Unit): LinkException? {
    val out = socket.getOutputStream()
    try {
      out.write(head)
      if (text != null) out.write(text)
      if (upload != null) stream(upload, out, progress)
      out.flush()
      return null
    } catch (e: LinkException) {
      throw e
    } catch (e: IOException) {
      return LinkException("io")
    }
  }

  private fun stream(upload: Body.Upload, out: java.io.OutputStream, progress: (Long, Long) -> Unit) {
    val input: InputStream = try {
      upload.file.inputStream()
    } catch (e: IOException) {
      throw LinkException("file")
    }
    input.use {
      val buffer = ByteArray(64 * 1024)
      var sent = 0L
      var reported = 0L
      while (sent < upload.size) {
        val n = try {
          it.read(buffer, 0, minOf(buffer.size.toLong(), upload.size - sent).toInt())
        } catch (e: IOException) {
          throw LinkException("file")
        }
        if (n < 0) throw LinkException("file")
        out.write(buffer, 0, n)
        sent += n
        if (sent - reported >= PROGRESS_STEP || sent == upload.size) {
          reported = sent
          progress(sent, upload.size)
        }
      }
      if (it.read() >= 0) throw LinkException("file")
    }
  }

  companion object {
    const val CONNECT_MS = 5_000
    const val REPLY_MS = 15_000
    const val UPLOAD_REPLY_MS = 120_000
    const val PROGRESS_STEP = 256L * 1024
  }
}
