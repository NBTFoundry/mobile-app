package net.cornera.nbtmgr.devicekey

import java.math.BigInteger

/** The only text the device key signs: NBT-REQ-1 (PROTOCOL.md, request signatures). */
object RequestText {
  private val pattern = Regex(
    "^NBT-REQ-1\\n(GET|POST)\\n/v1/[a-z/]{1,24}\\n[0-9]{1,3}(\\.[0-9]{1,3}){3}:[0-9]{1,5}\\n" +
      "[0-9a-f]{64}\\n(0|[1-9][0-9]{0,19})\\n[0-9a-f]{64}\\n$"
  )

  fun valid(text: String): Boolean = text.length <= 512 && pattern.matches(text)
}

object Hex {
  private const val DIGITS = "0123456789abcdef"

  fun encode(bytes: ByteArray): String {
    val out = StringBuilder(bytes.size * 2)
    for (b in bytes) {
      val v = b.toInt() and 0xff
      out.append(DIGITS[v shr 4]).append(DIGITS[v and 15])
    }
    return out.toString()
  }

  /** Big-endian unsigned value in exactly `size` bytes. */
  fun fixed(value: BigInteger, size: Int): ByteArray {
    val raw = value.toByteArray()
    val trimmed = if (raw.size > size) raw.copyOfRange(raw.size - size, raw.size) else raw
    require(raw.size <= size || raw.copyOfRange(0, raw.size - size).all { it.toInt() == 0 })
    return ByteArray(size - trimmed.size) + trimmed
  }
}
