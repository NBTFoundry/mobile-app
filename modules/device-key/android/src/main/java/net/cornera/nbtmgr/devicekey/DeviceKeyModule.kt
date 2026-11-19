// SPDX-License-Identifier: MPL-2.0
package net.cornera.nbtmgr.devicekey

import android.content.pm.PackageManager
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import android.security.keystore.StrongBoxUnavailableException
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.PrivateKey
import java.security.Signature
import java.security.interfaces.ECPublicKey
import java.security.spec.ECGenParameterSpec

/**
 * One P-256 signing key per car in the Android Keystore. Keys never leave it; the
 * module signs only NBT-REQ-1 request text. Errors are fixed codes without causes.
 */
class DeviceKeyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DeviceKey")

    AsyncFunction("create") { alias: String ->
      val name = keyName(alias)
      val store = keyStore()
      if (store.containsAlias(name)) store.deleteEntry(name)
      val protection = generate(name)
      mapOf("publicKey" to publicKeyHex(store, name), "protection" to protection)
    }

    AsyncFunction("publicKey") { alias: String ->
      val name = keyName(alias)
      val store = keyStore()
      if (store.containsAlias(name)) publicKeyHex(store, name) else null
    }

    AsyncFunction("sign") { alias: String, text: String ->
      if (!RequestText.valid(text)) throw fail("ERR_KEY_TEXT")
      val key = keyStore().getKey(keyName(alias), null) as? PrivateKey ?: throw fail("ERR_KEY_MISSING")
      try {
        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(key)
        signer.update(text.toByteArray(Charsets.US_ASCII))
        Hex.encode(signer.sign())
      } catch (e: Exception) {
        throw fail("ERR_KEY_LOCKED")
      }
    }

    AsyncFunction("remove") { alias: String ->
      val store = keyStore()
      val name = keyName(alias)
      if (store.containsAlias(name)) store.deleteEntry(name)
    }
  }

  private fun fail(code: String) = CodedException(code, code, null)

  private fun keyName(alias: String): String {
    if (!Regex("^car-[0-9a-f]{16}$").matches(alias)) throw fail("ERR_KEY_ALIAS")
    return "nbtmgr-$alias"
  }

  private fun keyStore(): KeyStore = try {
    KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
  } catch (e: Exception) {
    throw fail("ERR_KEY_STORE")
  }

  private fun spec(name: String, strongBox: Boolean, unlocked: Boolean) =
    KeyGenParameterSpec.Builder(name, KeyProperties.PURPOSE_SIGN)
      .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
      .setDigests(KeyProperties.DIGEST_SHA256)
      .setIsStrongBoxBacked(strongBox)
      .setUnlockedDeviceRequired(unlocked)
      .build()

  /** StrongBox when present, then the TEE; usable only while the phone is unlocked when it allows. */
  private fun generate(name: String): String {
    val context = appContext.reactContext ?: throw fail("ERR_KEY_STORE")
    val hasStrongBox = context.packageManager.hasSystemFeature(PackageManager.FEATURE_STRONGBOX_KEYSTORE)
    // (StrongBox, unlocked-only) in order of preference; a phone without a secure lock
    // screen cannot create unlocked-only keys on some versions.
    val attempts = (if (hasStrongBox) listOf(true to true) else emptyList()) + listOf(false to true, false to false)
    for ((strongBox, unlocked) in attempts) {
      try {
        val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
        generator.initialize(spec(name, strongBox, unlocked))
        generator.generateKeyPair()
        return protection(name, strongBox)
      } catch (e: StrongBoxUnavailableException) {
        continue
      } catch (e: java.security.GeneralSecurityException) {
        continue
      } catch (e: java.security.ProviderException) {
        continue
      }
    }
    throw fail("ERR_KEY_CREATE")
  }

  private fun protection(name: String, strongBox: Boolean): String {
    if (strongBox) return "strongbox"
    return try {
      val key = keyStore().getKey(name, null) as PrivateKey
      val info = KeyFactory.getInstance(key.algorithm, "AndroidKeyStore").getKeySpec(key, KeyInfo::class.java)
      val hardware = if (Build.VERSION.SDK_INT >= 31) {
        info.securityLevel == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT ||
          info.securityLevel == KeyProperties.SECURITY_LEVEL_STRONGBOX
      } else {
        @Suppress("DEPRECATION")
        info.isInsideSecureHardware
      }
      if (hardware) "tee" else "software"
    } catch (e: Exception) {
      "software"
    }
  }

  private fun publicKeyHex(store: KeyStore, name: String): String {
    val key = store.getCertificate(name)?.publicKey as? ECPublicKey ?: throw fail("ERR_KEY_MISSING")
    return Hex.encode(byteArrayOf(4) + Hex.fixed(key.w.affineX, 32) + Hex.fixed(key.w.affineY, 32))
  }
}
