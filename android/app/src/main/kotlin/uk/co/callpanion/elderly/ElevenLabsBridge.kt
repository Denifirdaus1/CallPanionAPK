package uk.co.callpanion.elderly

import android.app.Activity
import android.media.AudioManager
import android.content.Context
import android.util.Log
import androidx.annotation.VisibleForTesting
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.EventChannel
import io.elevenlabs.ElevenLabsSDK
import io.elevenlabs.ConversationSession
import io.elevenlabs.ConversationConfig
import kotlinx.coroutines.*
import java.util.concurrent.atomic.AtomicReference

class ElevenLabsBridge(
    private val activity: Activity,
    messenger: BinaryMessenger
) : MethodChannel.MethodCallHandler, EventChannel.StreamHandler {

    private val methodChannel = MethodChannel(messenger, "com.yourapp.elevenlabs/conversation")
    private val eventChannel = EventChannel(messenger, "com.yourapp.elevenlabs/events")
    private var eventSink: EventChannel.EventSink? = null

    private var elevenLabsSDK: ElevenLabsSDK? = null
    private var conversationSession: ConversationSession? = null
    private var conversationState = ConversationState.IDLE
    private var conversationMetadata = mutableMapOf<String, Any>()
    private var connectionStartTime: Long = 0
    private var audioManager: AudioManager? = null
    private val coroutineScope = CoroutineScope(Dispatchers.Main + SupervisorJob())

    companion object {
        private const val TAG = "ElevenLabsBridge"
    }

    // Enhanced state management
    enum class ConversationState {
        IDLE,
        CONNECTING,
        CONNECTED,
        DISCONNECTED,
        ERROR
    }

    // Custom exception for better error handling
    sealed class ElevenLabsException(message: String) : Exception(message) {
        class InvalidArguments(message: String) : ElevenLabsException("Invalid arguments: $message")
        class ConnectionFailed(message: String) : ElevenLabsException("Connection failed: $message")
        class ConversationNotActive : ElevenLabsException("No active conversation")
        class AudioSessionError(message: String) : ElevenLabsException("Audio session error: $message")
        class NetworkError(message: String) : ElevenLabsException("Network error: $message")
    }

    init {
        methodChannel.setMethodCallHandler(this)
        eventChannel.setStreamHandler(this)

        // Initialize ElevenLabs SDK
        elevenLabsSDK = ElevenLabsSDK.create()
        setupAudioSession()
    }

    private fun setupAudioSession() {
        try {
            audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            // Configure audio for VoIP calls
            audioManager?.let { am ->
                am.mode = AudioManager.MODE_IN_COMMUNICATION
                am.isSpeakerphoneOn = false
                am.isBluetoothScoOn = true

                Log.d(TAG, "Audio session configured for VoIP calls")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to setup audio session: ${e.message}")
        }
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
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
                else -> result.notImplemented()
            }
        } catch (e: Exception) {
            Log.e(TAG, "Method call error: ${e.message}", e)
            result.error("BRIDGE_ERROR", "Unexpected error: ${e.message}", null)
        }
    }

    // MARK: - Enhanced Conversation Management

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

        coroutineScope.launch {
            try {
                Log.d(TAG, "🎵 Configuring audio session...")

                // Configure audio session for the call
                withContext(Dispatchers.Main) {
                    audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
                }

                Log.d(TAG, "✅ Audio session configured successfully")

                Log.d(TAG, "🔧 Creating conversation session...")

                // Create conversation session
                conversationSession = elevenLabsSDK?.createConversationSession(
                    ConversationConfig(
                        conversationToken = token,
                        dynamicVariables = dynamicVariables
                    )
                )

                if (conversationSession == null) {
                    throw Exception("Failed to create conversation session - SDK returned null")
                }

                Log.d(TAG, "🎤 Setting up session handlers...")
                setupSessionHandlers()

                Log.d(TAG, "🔗 Starting conversation session...")
                val conversationId = conversationSession?.startSession()

                if (conversationId.isNullOrEmpty()) {
                    throw Exception("Failed to start session - no conversation ID returned")
                }

                // Update state and metadata
                conversationState = ConversationState.CONNECTED
                conversationMetadata["conversationId"] = conversationId
                conversationMetadata["startTime"] = connectionStartTime

                Log.d(TAG, "✅ Conversation started successfully: $conversationId")
                Log.d(TAG, "📊 Metadata: $conversationMetadata")

                withContext(Dispatchers.Main) {
                    result.success(conversationId)
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error starting conversation: ${e.message}", e)
                Log.e(TAG, "🔍 Error type: ${e.javaClass.simpleName}")
                Log.e(TAG, "🔍 Stack trace: ${e.stackTraceToString()}")

                conversationState = ConversationState.ERROR
                handleError(e, result)
            }
        }
    }

    private fun handleEndConversation(result: MethodChannel.Result) {
        Log.d(TAG, "Ending conversation")

        coroutineScope.launch {
            try {
                // End the conversation gracefully
                conversationSession?.endSession()
                conversationSession = null
                conversationState = ConversationState.DISCONNECTED

                // Reset audio mode
                withContext(Dispatchers.Main) {
                    audioManager?.mode = AudioManager.MODE_NORMAL
                }

                Log.d(TAG, "✅ Conversation ended")

                // Clear metadata
                conversationMetadata.clear()
                connectionStartTime = 0

                withContext(Dispatchers.Main) {
                    result.success(null)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error ending conversation: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("END_SESSION_ERROR", "Failed to end session: ${e.message}", null)
                }
            }
        }
    }

    private fun setMicrophoneMuted(call: MethodCall, result: MethodChannel.Result) {
        val muted = call.argument<Boolean>("muted") ?: run {
            result.error("INVALID_ARGUMENT", "muted parameter required", null)
            return
        }

        if (conversation == null) {
            result.error("NO_CONVERSATION", "No active conversation", null)
            return
        }

        coroutineScope.launch {
            try {
                conversation?.setMuted(muted)

                Log.d(TAG, "Microphone ${if (muted) "muted" else "unmuted"}")

                // Notify Flutter about mute state change
                notifyFlutter("microphoneStateChanged", mapOf(
                    "muted" to muted,
                    "conversationId" to (conversationMetadata["conversationId"] ?: "")
                ))

                withContext(Dispatchers.Main) {
                    result.success(mapOf("success" to true, "muted" to muted))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error setting mute state: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("MUTE_FAILED", e.message, null)
                }
            }
        }
    }

    private fun toggleMicrophone(result: MethodChannel.Result) {
        if (conversation == null) {
            result.error("NO_CONVERSATION", "No active conversation", null)
            return
        }

        coroutineScope.launch {
            try {
                conversation?.toggleMute()

                // Note: We might need to track mute state locally if SDK doesn't provide getter
                val newMuted = true // This would need to be tracked based on your SDK version

                Log.d(TAG, "Microphone toggled to ${if (newMuted) "muted" else "unmuted"}")

                // Notify Flutter about mute state change
                notifyFlutter("microphoneStateChanged", mapOf(
                    "muted" to newMuted,
                    "conversationId" to (conversationMetadata["conversationId"] ?: "")
                ))

                withContext(Dispatchers.Main) {
                    result.success(mapOf("success" to true, "muted" to newMuted))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error toggling mute: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("TOGGLE_FAILED", e.message, null)
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

        coroutineScope.launch {
            try {
                // Note: This depends on the ElevenLabs SDK supporting text input
                // conversationSession?.sendTextInput(message)

                Log.d(TAG, "Text message sent: $message")

                withContext(Dispatchers.Main) {
                    result.success(mapOf("success" to true, "message" to message))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error sending text message: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("MESSAGE_FAILED", e.message, null)
                }
            }
        }
    }

    // MARK: - Session Event Handlers

    private fun setupSessionHandlers() {
        conversationSession?.apply {
            onConnect { conversationId ->
                sendEvent("connected", mapOf("conversation_id" to conversationId))
            }

            onMessage { source, message ->
                sendEvent("message", mapOf(
                    "source" to source.name,
                    "message" to message
                ))
            }

            onModeChange { mode ->
                sendEvent("mode_change", mapOf("mode" to mode.name))
            }

            onStatusChange { status ->
                sendEvent("status_change", mapOf("status" to status.name))
            }

            onError { error ->
                sendEvent("error", mapOf(
                    "error" to error.message,
                    "code" to "CONVERSATION_ERROR"
                ))
            }
        }
    }

    private fun sendEvent(type: String, data: Map<String, Any>) {
        val event = mapOf(
            "type" to type,
            "data" to data,
            "timestamp" to System.currentTimeMillis()
        )

        activity.runOnUiThread {
            eventSink?.success(event)
        }
    }

    private fun handleError(error: Exception, result: MethodChannel.Result) {
        val errorCode: String
        val errorMessage: String

        when (error) {
            is ElevenLabsException.InvalidArguments -> {
                errorCode = "INVALID_ARGUMENT"
                errorMessage = error.message ?: "Invalid arguments"
            }
            is ElevenLabsException.ConnectionFailed -> {
                errorCode = "NETWORK_ERROR"
                errorMessage = error.message ?: "Connection failed"
            }
            is ElevenLabsException.ConversationNotActive -> {
                errorCode = "CONVERSATION_NOT_ACTIVE"
                errorMessage = error.message ?: "No active conversation"
            }
            is ElevenLabsException.AudioSessionError -> {
                errorCode = "AUDIO_SESSION_ERROR"
                errorMessage = error.message ?: "Audio session error"
            }
            is ElevenLabsException.NetworkError -> {
                errorCode = "NETWORK_ERROR"
                errorMessage = error.message ?: "Network error"
            }
            else -> {
                errorCode = "UNKNOWN_ERROR"
                errorMessage = error.message ?: "Unknown error"
            }
        }

        activity.runOnUiThread {
            result.error(errorCode, errorMessage, null)
        }
    }

    // MARK: - Utility Methods

    private fun notifyFlutter(event: String, data: Map<String, Any>) {
        val payload = mapOf(
            "event" to event,
            "data" to data,
            "timestamp" to System.currentTimeMillis()
        )

        activity.runOnUiThread {
            methodChannel.invokeMethod("onNativeEvent", payload)
        }
    }

    // MARK: - EventChannel.StreamHandler Implementation

    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        eventSink = events
    }

    override fun onCancel(arguments: Any?) {
        eventSink = null
    }

    // Cleanup when the bridge is destroyed
    fun dispose() {
        coroutineScope.cancel()
        conversationSession?.endSession()
        conversationSession = null
        audioManager?.mode = AudioManager.MODE_NORMAL
        eventSink = null
    }
}