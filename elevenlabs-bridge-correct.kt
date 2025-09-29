package app.lovable.a4b57244d3ad47ea85cac99941e17d30

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

// Import ElevenLabs Android SDK - Official SDK
import io.elevenlabs.*
import io.elevenlabs.models.*

class ElevenLabsBridge(
    private val activity: Activity,
    messenger: BinaryMessenger
) : MethodChannel.MethodCallHandler, EventChannel.StreamHandler {

    companion object {
        private const val TAG = "ElevenLabsBridge"
        private const val METHOD_CHANNEL_NAME = "app.lovable.a4b57244d3ad47ea85cac99941e17d30.elevenlabs/conversation"
        private const val EVENT_CHANNEL_NAME = "app.lovable.a4b57244d3ad47ea85cac99941e17d30.elevenlabs/events"
    }

    private val methodChannel = MethodChannel(messenger, METHOD_CHANNEL_NAME)
    private val eventChannel = EventChannel(messenger, EVENT_CHANNEL_NAME)
    private var eventSink: EventChannel.EventSink? = null
    
    // ElevenLabs SDK objects - Official SDK
    private var conversationSession: ConversationSession? = null
    private var conversationState = ConversationState.IDLE
    private var conversationMetadata = mutableMapOf<String, Any>()
    private var connectionStartTime: Long = 0
    private var audioManager: AudioManager? = null
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val mainHandler = Handler(Looper.getMainLooper())

    enum class ConversationState {
        IDLE,
        CONNECTING,
        CONNECTED,
        DISCONNECTED,
        ERROR
    }

    init {
        Log.d(TAG, "🚀 ElevenLabsBridge initialized")
        methodChannel.setMethodCallHandler(this)
        eventChannel.setStreamHandler(this)
        setupAudioSession()
    }

    private fun setupAudioSession() {
        try {
            audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
            Log.d(TAG, "✅ Audio session configured for VoIP calls")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to setup audio session: ${e.message}")
        }
    }

    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        Log.d(TAG, "📢 Event channel listener attached")
        eventSink = events
    }

    override fun onCancel(arguments: Any?) {
        Log.d(TAG, "📢 Event channel listener cancelled")
        eventSink = null
    }

    private fun sendEventToFlutter(eventName: String, data: Map<String, Any?>) {
        mainHandler.post {
            eventSink?.success(mapOf(
                "event" to eventName,
                "data" to data
            ))
        }
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        Log.d(TAG, "📞 Method call received: ${call.method}")

        try {
            when (call.method) {
                "startConversation" -> handleStartConversation(call, result)
                "endConversation" -> handleEndConversation(result)
                "sendMessage" -> handleSendMessage(call, result)
                "setMicMuted" -> handleSetMicMuted(call, result)
                "sendFeedback" -> handleSendFeedback(call, result)
                "sendContextualUpdate" -> handleSendContextualUpdate(call, result)
                "sendUserActivity" -> handleSendUserActivity(result)
                "getConversationState" -> {
                    result.success(mapOf(
                        "state" to conversationState.name.lowercase(),
                        "conversationId" to conversationMetadata["conversationId"],
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
        val conversationToken = call.argument<String>("conversationToken")
        val agentId = call.argument<String>("agentId")
        val dynamicVariables = call.argument<Map<String, Any>>("dynamicVariables") ?: emptyMap()

        // Validation
        if (conversationToken == null && agentId == null) {
            result.error("INVALID_ARGUMENT", "Either conversationToken or agentId is required", null)
            return
        }

        if (conversationState != ConversationState.IDLE) {
            result.error("CONVERSATION_ACTIVE", "A conversation is already active", null)
            return
        }

        Log.d(TAG, "🚀 Starting ElevenLabs conversation with official SDK")
        Log.d(TAG, "📋 Dynamic variables: $dynamicVariables")

        conversationState = ConversationState.CONNECTING
        connectionStartTime = System.currentTimeMillis()

        scope.launch {
            try {
                // Configure audio for voice call
                withContext(Dispatchers.Main) {
                    audioManager?.apply {
                        mode = AudioManager.MODE_IN_COMMUNICATION
                        isSpeakerphoneOn = false
                        isBluetoothScoOn = preferBluetoothForCall()
                    }
                }

                // Create conversation configuration using official SDK
                val config = ConversationConfig(
                    agentId = agentId,
                    conversationToken = conversationToken,
                    userId = "callpanion_user",
                    textOnly = false,
                    audioInputSampleRate = 48000,
                    dynamicVariables = dynamicVariables,
                    onConnect = { conversationId ->
                        Log.d(TAG, "✅ Conversation connected: $conversationId")
                        conversationMetadata["conversationId"] = conversationId
                        conversationState = ConversationState.CONNECTED
                        
                        sendEventToFlutter("conversationConnected", mapOf(
                            "conversationId" to conversationId,
                            "sessionId" to dynamicVariables["session_id"]
                        ))
                    },
                    onStatusChange = { status ->
                        Log.d(TAG, "📊 Status changed: $status")
                        handleStatusChange(status)
                    },
                    onModeChange = { mode ->
                        Log.d(TAG, "🎤 Mode changed: $mode")
                        sendEventToFlutter("modeChanged", mapOf("mode" to mode))
                    },
                    onMessage = { source, message ->
                        Log.d(TAG, "💬 Message from $source")
                        sendEventToFlutter("message", mapOf(
                            "source" to source,
                            "message" to message
                        ))
                    },
                    onCanSendFeedbackChange = { canSend ->
                        sendEventToFlutter("feedbackAvailable", mapOf("canSend" to canSend))
                    },
                    onVadScore = { score ->
                        // Voice Activity Detection score
                        sendEventToFlutter("vadScore", mapOf("score" to score))
                    },
                    onUnhandledClientToolCall = { call ->
                        Log.w(TAG, "⚠️ Unhandled client tool call: ${call.name}")
                        sendEventToFlutter("unhandledToolCall", mapOf(
                            "name" to call.name,
                            "parameters" to call.parameters
                        ))
                    }
                )

                // START SESSION USING OFFICIAL SDK METHOD
                conversationSession = ConversationClient.startSession(config, activity)
                
                Log.d(TAG, "✅ Conversation session started successfully")
                
                // Return success to Flutter
                withContext(Dispatchers.Main) {
                    result.success(mapOf(
                        "success" to true,
                        "conversationId" to conversationSession?.getId(),
                        "sessionId" to dynamicVariables["session_id"]
                    ))
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to start conversation: ${e.message}", e)
                conversationState = ConversationState.ERROR
                
                withContext(Dispatchers.Main) {
                    result.error(
                        "CONVERSATION_ERROR",
                        "Failed to start conversation: ${e.message}",
                        e.stackTraceToString()
                    )
                }
            }
        }
    }

    private fun handleEndConversation(result: MethodChannel.Result) {
        scope.launch {
            try {
                Log.d(TAG, "🛑 Ending conversation")
                
                conversationSession?.endSession()
                conversationSession = null
                
                conversationState = ConversationState.DISCONNECTED
                conversationMetadata.clear()
                connectionStartTime = 0
                
                sendEventToFlutter("conversationEnded", emptyMap())
                
                withContext(Dispatchers.Main) {
                    result.success(mapOf("success" to true))
                }
                
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to end conversation: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("END_ERROR", "Failed to end conversation: ${e.message}", null)
                }
            }
        }
    }

    private fun handleSendMessage(call: MethodCall, result: MethodChannel.Result) {
        val message = call.argument<String>("message")
        if (message == null) {
            result.error("INVALID_ARGUMENT", "Message is required", null)
            return
        }

        try {
            conversationSession?.sendUserMessage(message)
            result.success(mapOf("success" to true))
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to send message: ${e.message}", e)
            result.error("SEND_ERROR", "Failed to send message: ${e.message}", null)
        }
    }

    private fun handleSetMicMuted(call: MethodCall, result: MethodChannel.Result) {
        val muted = call.argument<Boolean>("muted") ?: false
        
        scope.launch {
            try {
                conversationSession?.setMicMuted(muted)
                sendEventToFlutter("micMuted", mapOf("muted" to muted))
                result.success(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e(TAG, "❌ Failed to set mic mute: ${e.message}", e)
                result.error("MUTE_ERROR", "Failed to set mic mute: ${e.message}", null)
            }
        }
    }

    private fun handleSendFeedback(call: MethodCall, result: MethodChannel.Result) {
        val isPositive = call.argument<Boolean>("isPositive") ?: true
        
        try {
            conversationSession?.sendFeedback(isPositive)
            result.success(mapOf("success" to true))
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to send feedback: ${e.message}", e)
            result.error("FEEDBACK_ERROR", "Failed to send feedback: ${e.message}", null)
        }
    }

    private fun handleSendContextualUpdate(call: MethodCall, result: MethodChannel.Result) {
        val update = call.argument<String>("update")
        if (update == null) {
            result.error("INVALID_ARGUMENT", "Update text is required", null)
            return
        }

        try {
            conversationSession?.sendContextualUpdate(update)
            result.success(mapOf("success" to true))
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to send contextual update: ${e.message}", e)
            result.error("UPDATE_ERROR", "Failed to send contextual update: ${e.message}", null)
        }
    }

    private fun handleSendUserActivity(result: MethodChannel.Result) {
        try {
            conversationSession?.sendUserActivity()
            result.success(mapOf("success" to true))
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to send user activity: ${e.message}", e)
            result.error("ACTIVITY_ERROR", "Failed to send user activity: ${e.message}", null)
        }
    }

    private fun handleStatusChange(status: String) {
        conversationState = when(status) {
            "connected" -> ConversationState.CONNECTED
            "connecting" -> ConversationState.CONNECTING
            "disconnected" -> ConversationState.DISCONNECTED
            else -> ConversationState.ERROR
        }
        
        sendEventToFlutter("statusChanged", mapOf(
            "status" to status,
            "state" to conversationState.name.lowercase()
        ))
    }

    private fun preferBluetoothForCall(): Boolean {
        // Check if Bluetooth headset is connected
        return audioManager?.isBluetoothScoAvailableOffCall == true
    }

    fun dispose() {
        scope.cancel()
        conversationSession = null
        eventSink = null
    }
}