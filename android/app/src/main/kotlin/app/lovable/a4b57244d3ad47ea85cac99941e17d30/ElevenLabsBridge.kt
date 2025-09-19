// Path: android/app/src/main/kotlin/app/lovable/a4b57244d3ad47ea85cac99941e17d30/ElevenLabsBridge.kt
package app.lovable.a4b57244d3ad47ea85cac99941e17d30  // CORRECT PACKAGE!

import android.app.Activity
import android.media.AudioManager
import android.content.Context
import android.util.Log
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.EventChannel
import kotlinx.coroutines.*
import android.os.Handler
import android.os.Looper

class ElevenLabsBridge(
    private val activity: Activity,
    messenger: BinaryMessenger
) : MethodChannel.MethodCallHandler, EventChannel.StreamHandler {

    companion object {
        private const val TAG = "ElevenLabsBridge"
        // CRITICAL: Must match iOS and Flutter channel names!
        private const val METHOD_CHANNEL_NAME = "com.yourapp.elevenlabs/conversation"
        private const val EVENT_CHANNEL_NAME = "com.yourapp.elevenlabs/events"
    }

    private val methodChannel = MethodChannel(messenger, METHOD_CHANNEL_NAME)
    private val eventChannel = EventChannel(messenger, EVENT_CHANNEL_NAME)
    private var eventSink: EventChannel.EventSink? = null

    // Placeholder for ElevenLabs SDK integration
    private var conversationSession: String? = null
    private var conversationState = ConversationState.IDLE
    private var conversationMetadata = mutableMapOf<String, Any>()
    private var connectionStartTime: Long = 0
    private var audioManager: AudioManager? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    enum class ConversationState {
        IDLE,
        CONNECTING,
        CONNECTED,
        DISCONNECTED,
        ERROR
    }

    init {
        Log.d(TAG, "🚀 ElevenLabsBridge initialized")
        Log.d(TAG, "📱 Method channel: $METHOD_CHANNEL_NAME")
        Log.d(TAG, "📡 Event channel: $EVENT_CHANNEL_NAME")

        methodChannel.setMethodCallHandler(this)
        eventChannel.setStreamHandler(this)
        setupAudioSession()
    }

    private fun setupAudioSession() {
        try {
            audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            Log.d(TAG, "✅ Audio session configured for VoIP calls")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to setup audio session: ${e.message}")
        }
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        Log.d(TAG, "📞 Method call received: ${call.method}")

        try {
            when (call.method) {
                "startConversation" -> handleStartConversation(call, result)
                "endConversation" -> handleEndConversation(result)
                "sendMessage" -> handleSendMessage(call, result)
                "getConversationState" -> {
                    result.success(mapOf(
                        "state" to conversationState.name.lowercase(),
                        "conversationId" to (conversationMetadata["conversationId"] ?: ""),
                        "connectionTime" to connectionStartTime,
                        "metadata" to conversationMetadata
                    ))
                }
                "getConnectionStatus" -> {
                    result.success(mapOf(
                        "isConnected" to (conversationState == ConversationState.CONNECTED),
                        "state" to conversationState.name.lowercase(),
                        "hasActiveConversation" to (conversationSession != null)
                    ))
                }
                else -> {
                    Log.w(TAG, "⚠️ Unhandled method: ${call.method}")
                    result.notImplemented()
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "❌ Method call error: ${e.message}", e)
            result.error("BRIDGE_ERROR", "Unexpected error: ${e.message}", null)
        }
    }

    private fun handleStartConversation(call: MethodCall, result: MethodChannel.Result) {
        Log.d(TAG, "🚀 handleStartConversation called")

        val token = call.argument<String>("token") ?: run {
            Log.e(TAG, "❌ Invalid arguments - token missing")
            val providedArgs = call.arguments?.let { (it as? Map<*, *>)?.keys?.joinToString(", ") } ?: "none"
            result.error("INVALID_ARGUMENT", "Token required", mapOf("provided_args" to providedArgs))
            return
        }

        // Prevent multiple concurrent sessions
        if (conversationState != ConversationState.IDLE) {
            Log.e(TAG, "❌ Conversation already active, state: ${conversationState.name}")
            result.error("CONVERSATION_ACTIVE", "A conversation is already active", mapOf("current_state" to conversationState.name))
            return
        }

        // Extract dynamic variables
        val dynamicVariables = call.argument<Map<String, String>>("dynamicVariables") ?: emptyMap()

        Log.d(TAG, "🔐 Token received (length: ${token.length})")
        Log.d(TAG, "📋 Dynamic variables: $dynamicVariables")

        conversationState = ConversationState.CONNECTING
        connectionStartTime = System.currentTimeMillis()

        scope.launch {
            try {
                Log.d(TAG, "🎵 Configuring audio session...")

                // Configure audio session for the call
                withContext(Dispatchers.Main) {
                    audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
                }

                Log.d(TAG, "✅ Audio session configured successfully")

                // TODO: Integrate with actual ElevenLabs Android SDK
                // For now, simulate conversation start
                Log.d(TAG, "🔧 Creating conversation session...")
                Log.d(TAG, "🔗 Starting conversation session...")

                // Simulate successful connection
                val conversationId = "conv_android_${System.currentTimeMillis()}"
                conversationSession = conversationId

                // Update state and metadata
                conversationState = ConversationState.CONNECTED
                conversationMetadata["conversationId"] = conversationId
                conversationMetadata["startTime"] = connectionStartTime

                Log.d(TAG, "✅ Conversation started successfully: $conversationId")
                Log.d(TAG, "📊 Metadata: $conversationMetadata")

                // Send event to Flutter
                sendEvent("connected", mapOf("conversation_id" to conversationId))

                withContext(Dispatchers.Main) {
                    result.success(conversationId)
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error starting conversation: ${e.message}", e)
                Log.e(TAG, "🔍 Error type: ${e.javaClass.simpleName}")

                conversationState = ConversationState.ERROR
                handleError(e, result)
            }
        }
    }

    private fun handleEndConversation(result: MethodChannel.Result) {
        Log.d(TAG, "🔚 Ending conversation")

        scope.launch {
            try {
                // TODO: End actual ElevenLabs conversation
                conversationSession = null
                conversationState = ConversationState.DISCONNECTED

                // Reset audio mode
                withContext(Dispatchers.Main) {
                    audioManager?.mode = AudioManager.MODE_NORMAL
                }

                Log.d(TAG, "✅ Conversation ended successfully")

                // Clear metadata
                conversationMetadata.clear()
                connectionStartTime = 0

                withContext(Dispatchers.Main) {
                    result.success(null)
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error ending conversation: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("END_SESSION_ERROR", "Failed to end session: ${e.message}", null)
                }
            }
        }
    }

    private fun handleSendMessage(call: MethodCall, result: MethodChannel.Result) {
        val message = call.argument<String>("message") ?: run {
            result.error("INVALID_ARGUMENT", "message parameter required", null)
            return
        }

        if (conversationSession == null) {
            result.error("NO_CONVERSATION", "No active conversation", null)
            return
        }

        scope.launch {
            try {
                // TODO: Send message via ElevenLabs SDK
                Log.d(TAG, "💬 Text message sent: $message")

                withContext(Dispatchers.Main) {
                    result.success(mapOf("success" to true, "message" to message))
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error sending text message: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("MESSAGE_FAILED", e.message, null)
                }
            }
        }
    }

    private fun sendEvent(type: String, data: Map<String, Any>) {
        val event = mapOf(
            "type" to type,
            "data" to data,
            "timestamp" to System.currentTimeMillis()
        )

        Log.d(TAG, "📡 Sending event: $type")

        Handler(Looper.getMainLooper()).post {
            eventSink?.success(event)
        }
    }

    private fun handleError(error: Exception, result: MethodChannel.Result) {
        val errorCode: String
        val errorMessage: String

        // Map common error types
        when {
            error.message?.contains("permission", true) == true -> {
                errorCode = "PERMISSION_DENIED"
                errorMessage = "Permission denied"
            }
            error.message?.contains("network", true) == true -> {
                errorCode = "NETWORK_ERROR"
                errorMessage = "Network error"
            }
            error.message?.contains("token", true) == true -> {
                errorCode = "TOKEN_ERROR"
                errorMessage = "Token error"
            }
            else -> {
                errorCode = "UNKNOWN_ERROR"
                errorMessage = error.message ?: "Unknown error"
            }
        }

        Handler(Looper.getMainLooper()).post {
            result.error(errorCode, errorMessage, null)
        }
    }

    // MARK: - EventChannel.StreamHandler Implementation

    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        Log.d(TAG, "📺 Event stream listener attached")
        eventSink = events
    }

    override fun onCancel(arguments: Any?) {
        Log.d(TAG, "📺 Event stream listener detached")
        eventSink = null
    }

    // Cleanup when the bridge is destroyed
    fun dispose() {
        Log.d(TAG, "🧹 Disposing ElevenLabsBridge")
        scope.cancel()
        conversationSession = null
        audioManager?.mode = AudioManager.MODE_NORMAL
        eventSink = null
    }
}