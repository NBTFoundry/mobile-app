# SPDX-License-Identifier: MPL-2.0
# JNA, which UniFFI's Kotlin binding calls the Rust library through: it finds
# its classes and the binding's structures by reflection, and refers to desktop
# Java (java.awt) that Android does not have.
-dontwarn java.awt.**
-keep class com.sun.jna.** { *; }
-keep class * implements com.sun.jna.** { *; }
# The generated binding (callbacks and structures are reached from native code).
-keep class net.cornera.nbtmgr.install.core.** { *; }
