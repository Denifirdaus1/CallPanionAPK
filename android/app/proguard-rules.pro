# Flutter specific rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.**  { *; }
-keep class io.flutter.plugins.**  { *; }

# CallKit Incoming plugin rules
-keep class com.hiennv.flutter_callkit_incoming.** { *; }

# Firebase rules
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.firebase.database.PropertyName <methods>;
    @com.google.firebase.database.PropertyName <fields>;
}

# JSON serialization rules
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn sun.misc.**
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# ElevenLabs SDK rules (CRITICAL for release build)
-keep class io.elevenlabs.** { *; }
-keepclassmembers class io.elevenlabs.** { *; }
-dontwarn io.elevenlabs.**

# LiveKit WebRTC rules (CRITICAL - ElevenLabs uses LiveKit)
-keep class io.livekit.** { *; }
-keepclassmembers class io.livekit.** { *; }
-dontwarn io.livekit.**
-keep class org.webrtc.** { *; }
-keepclassmembers class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Kotlin coroutines (used by ElevenLabs SDK)
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.** {
    volatile <fields>;
}

# OkHttp (used by networking)
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Gson models (for ElevenLabs API)
-keepattributes Signature
-keepattributes *Annotation*
-keepattributes EnclosingMethod

# Keep ElevenLabs Bridge (Native Kotlin code)
-keep class app.lovable.a4b57244d3ad47ea85cac99941e17d30.ElevenLabsBridge { *; }
-keep class app.lovable.a4b57244d3ad47ea85cac99941e17d30.MainActivity { *; }

# Keep audio classes
-keep class android.media.AudioManager { *; }
-keep class org.webrtc.audio.** { *; }

# Keep debugging info for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile