// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

import java.io.File
import java.io.RandomAccessFile

/**
 * Logs read from the car (PROTOCOL.md, Logs), saved in the app's cache as they came, and
 * their end as printable text for the screen. src/protocol/logTail.ts does the same.
 */
object CarLog {
  const val TAIL_BYTES = 16 * 1024
  val ROUTES = setOf("/v1/logs/app", "/v1/logs/system", "/v1/logs/manager")
  private val name = Regex("^[a-z0-9][a-z0-9._-]{0,63}$")

  /** `<cache>/car-logs/<saveAs>.log`; the name is checked, never a path. */
  fun file(cache: File, saveAs: String): File {
    if (!name.matches(saveAs)) throw LinkException("bad-request")
    val folder = File(cache, "car-logs")
    if (!folder.isDirectory && !folder.mkdirs()) throw LinkException("file")
    return File(folder, "$saveAs.log")
  }

  /** The last TAIL_BYTES from a whole line; tabs and newlines kept, CR dropped, other bytes `?`. */
  fun tail(file: File): String {
    val bytes = RandomAccessFile(file, "r").use {
      val size = it.length()
      val start = maxOf(0L, size - TAIL_BYTES)
      it.seek(start)
      ByteArray((size - start).toInt()).also { out -> it.readFully(out) }
    }
    var start = 0
    if (file.length() > TAIL_BYTES) {
      val newline = bytes.indexOf(0x0a)
      if (newline >= 0) start = newline + 1
    }
    val out = StringBuilder(bytes.size)
    for (i in start until bytes.size) {
      val b = bytes[i].toInt() and 0xff
      if (b == 0x0d) continue
      out.append(if (b == 0x0a || b == 0x09 || b in 0x20..0x7e) b.toChar() else '?')
    }
    return out.toString()
  }
}
