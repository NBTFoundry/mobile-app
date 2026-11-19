// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.carlink

import java.io.File
import java.io.IOException
import java.security.MessageDigest

/** Package files the link may read: only regular files inside the app's own storage. */
class LocalFiles(private val roots: List<File>) {
  fun resolve(uri: String): File {
    if (!uri.startsWith("file://")) throw LinkException("file")
    val file = try {
      File(java.net.URI(uri)).canonicalFile
    } catch (e: Exception) {
      throw LinkException("file")
    }
    val inside = roots.any { root ->
      val base = root.canonicalPath + File.separator
      file.path.startsWith(base)
    }
    if (!inside || !file.isFile) throw LinkException("file")
    return file
  }

  /** Size, SHA-256 and the first bytes, read in one pass. */
  fun inspect(uri: String, headSize: Int): Triple<Long, String, ByteArray> {
    val file = resolve(uri)
    val size = file.length()
    if (size <= 0 || size > MAX_FILE) throw LinkException("file")
    val digest = MessageDigest.getInstance("SHA-256")
    val head = ByteArray(minOf(headSize.toLong(), size).toInt())
    var total = 0L
    try {
      file.inputStream().use { input ->
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val n = input.read(buffer)
          if (n < 0) break
          if (total < head.size) {
            val take = minOf(n.toLong(), head.size - total).toInt()
            System.arraycopy(buffer, 0, head, total.toInt(), take)
          }
          digest.update(buffer, 0, n)
          total += n
          if (total > MAX_FILE) throw LinkException("file")
        }
      }
    } catch (e: IOException) {
      throw LinkException("file")
    }
    if (total != size) throw LinkException("file")
    return Triple(size, hex(digest.digest()), head)
  }

  companion object {
    /** Header, manifest, signature and the 64 MiB payload limit. */
    const val MAX_FILE = 24L + 2048 + 384 + 64L * 1024 * 1024

    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
  }
}
