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
import io.elevenlabs.audio.*

class ElevenLabsBridge(
    private val activity: Activity,
    messenger: BinaryMessenger
) : MethodChannel.MethodCallHandler, EventChannel.StreamHandler {

    companion object {
        private const val TAG = "ElevenLabsBridge"
        private const val METHOD_CHANNEL_NAME = "com.yourapp.elevenlabs/conversation"
        private const val EVENT_CHANNEL_NAME = "com.yourapp.elevenlabs/events"
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
        initializeElevenLabs()
    }

    private fun initializeElevenLabs() {
        try {
            // ElevenLabs SDK is initialized when creating ConversationClient
            Log.d(TAG, "✅ ElevenLabs SDK ready for initialization")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to prepare ElevenLabs SDK: ${e.message}")
        }
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
        val conversationToken = call.argument<String>("conversationToken")
        val agentId = call.argument<String>("agentId")
        val dynamicVariables = call.argument<Map<String, String>>("dynamicVariables") ?: emptyMap()

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
                        isBluetoothScoOn = true
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
                        conversationState = ConversationState.CONNECTED
                        conversationMetadata["conversationId"] = conversationId
                        conversationMetadata["startTime"] = connectionStartTime
                        
                        sendEvent("conversationConnected", mapOf(
                            "conversationId" to conversationId,
                            "timestamp" to System.currentTimeMillis()
                        ))
                        
                        Handler(Looper.getMainLooper()).post {
                            result.success(conversationId)
                        }
                    },
                    onMessage = { source, message ->
                        Log.d(TAG, "💬 Message from $source: $message")
                        sendEvent("message", mapOf(
                            "source" to source,
                            "message" to message,
                            "timestamp" to System.currentTimeMillis()
                        ))
                    },
                    onModeChange = { mode ->
                        Log.d(TAG, "🔄 Mode changed to: $mode")
                        sendEvent("modeChange", mapOf(
                            "mode" to mode,
                            "timestamp" to System.currentTimeMillis()
                        ))
                    },
                    onStatusChange = { status ->
                        Log.d(TAG, "📊 Status changed to: $status")
                        when (status) {
                            "connected" -> {
                                conversationState = ConversationState.CONNECTED
                            }
                            "connecting" -> {
                                conversationState = ConversationState.CONNECTING
                            }
                            "disconnected" -> {
                                conversationState = ConversationState.DISCONNECTED
                                conversationSession = null
                            }
                        }
                        sendEvent("statusChange", mapOf(
                            "status" to status,
                            "timestamp" to System.currentTimeMillis()
                        ))
                    },
                    onCanSendFeedbackChange = { canSend ->
                        Log.d(TAG, "👍 Feedback available: $canSend")
                        sendEvent("feedbackAvailable", mapOf(
                            "canSend" to canSend,
                            "timestamp" to System.currentTimeMillis()
                        ))
                    },
                    onVadScore = { score ->
                        Log.d(TAG, "🎤 VAD Score: $score")
                        sendEvent("vadScore", mapOf(
                            "score" to score,
                            "timestamp" to System.currentTimeMillis()
                        ))
                    }
                )

                // Start the conversation using official SDK
                conversationSession = ConversationClient.startSession(config, activity)

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error starting conversation: ${e.message}", e)
                conversationState = ConversationState.ERROR
                withContext(Dispatchers.Main) {
                    result.error("START_FAILED", e.message, null)
                }
            }
        }
    }

    private fun handleEndConversation(result: MethodChannel.Result) {
        Log.d(TAG, "🔚 Ending conversation")

        scope.launch {
            try {
                conversationSession?.endSession()
                conversationSession = null
                conversationState = ConversationState.DISCONNECTED

                // Reset audio mode
                withContext(Dispatchers.Main) {
                    audioManager?.mode = AudioManager.MODE_NORMAL
                }

                conversationMetadata.clear()
                connectionStartTime = 0

                sendEvent("conversationEnded", mapOf(
                    "duration" to (System.currentTimeMillis() - connectionStartTime),
                    "timestamp" to System.currentTimeMillis()
                ))

                withContext(Dispatchers.Main) {
                    result.success(null)
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error ending conversation: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("END_FAILED", e.message, null)
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
                conversationSession?.sendUserMessage(message)
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

    private fun handleSetMicMuted(call: MethodCall, result: MethodChannel.Result) {
        val muted = call.argument<Boolean>("muted") ?: false
        
        scope.launch {
            try {
                conversationSession?.setMicMuted(muted)
                sendEvent("microphoneStateChanged", mapOf("muted" to muted))
                withContext(Dispatchers.Main) {
                    result.success(mapOf("muted" to muted))
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error setting microphone mute: ${e.message}")
                withContext(Dispatchers.Main) {
                    result.error("MUTE_FAILED", e.message, null)
                }
            }
        }
    }

    private fun handleSendFeedback(call: MethodCall, result: MethodChannel.Result) {
        val isPositive = call.argument<Boolean>("isPositive") ?: true
        
        if (conversationSession == null) {
            result.error("NO_CONVERSATION", "No active conversation", null)
            return
        }

        scope.launch {
            try {
                conversationSession?.sendFeedback(isPositive)
                Log.d(TAG, "👍 Feedback sent: ${if (isPositive) "positive" else "negative"}")
                withContext(Dispatchers.Main) {
                    result.success(mapOf("success" to true, "isPositive" to isPositive))
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error sending feedback: ${e.message}")
                withContext(Dispatchers.Main) {
                    result.error("FEEDBACK_FAILED", e.message, null)
                }
            }
        }
    }

    private fun handleSendContextualUpdate(call: MethodCall, result: MethodChannel.Result) {
        val update = call.argument<String>("update") ?: run {
            result.error("INVALID_ARGUMENT", "update parameter required", null)
            return
        }

        if (conversationSession == null) {
            result.error("NO_CONVERSATION", "No active conversation", null)
            return
        }

        scope.launch {
            try {
                conversationSession?.sendContextualUpdate(update)
                Log.d(TAG, "📝 Contextual update sent: $update")
                withContext(Dispatchers.Main) {
                    result.success(mapOf("success" to true, "update" to update))
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error sending contextual update: ${e.message}")
                withContext(Dispatchers.Main) {
                    result.error("CONTEXTUAL_UPDATE_FAILED", e.message, null)
                }
            }
        }
    }

    private fun handleSendUserActivity(result: MethodChannel.Result) {
        if (conversationSession == null) {
            result.error("NO_CONVERSATION", "No active conversation", null)
            return
        }

        scope.launch {
            try {
                conversationSession?.sendUserActivity()
                Log.d(TAG, "👤 User activity sent")
                withContext(Dispatchers.Main) {
                    result.success(mapOf("success" to true))
                }
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error sending user activity: ${e.message}")
                withContext(Dispatchers.Main) {
                    result.error("USER_ACTIVITY_FAILED", e.message, null)
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

    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        Log.d(TAG, "📺 Event stream listener attached")
        eventSink = events
    }

    override fun onCancel(arguments: Any?) {
        Log.d(TAG, "📺 Event stream listener detached")
        eventSink = null
    }

    fun dispose() {
        Log.d(TAG, "🧹 Disposing ElevenLabsBridge")
        conversationSession?.endSession()
        conversationSession = null
        scope.cancel()
        audioManager?.mode = AudioManager.MODE_NORMAL
        eventSink = null
    }
}