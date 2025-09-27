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

// Import ElevenLabs Android SDK
import com.elevenlabs.android.*
import com.elevenlabs.android.conversation.*
import com.elevenlabs.android.models.*

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
    
    // ElevenLabs SDK objects
    private var elevenLabsClient: ElevenLabsClient? = null
    private var activeConversation: ConversationSession? = null
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
            // Initialize ElevenLabs SDK
            elevenLabsClient = ElevenLabsClient.Builder(activity)
                .setLogLevel(LogLevel.DEBUG)
                .build()
            
            Log.d(TAG, "✅ ElevenLabs SDK initialized")
        } catch (e: Exception) {
            Log.e(TAG, "❌ Failed to initialize ElevenLabs SDK: ${e.message}")
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
                        "hasActiveConversation" to (activeConversation != null)
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

        Log.d(TAG, "🚀 Starting ElevenLabs conversation")
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

                // Create conversation configuration
                val config = if (conversationToken != null) {
                    ConversationConfig.Builder()
                        .setConversationToken(conversationToken)
                        .setDynamicVariables(dynamicVariables)
                        .build()
                } else {
                    ConversationConfig.Builder()
                        .setAgentId(agentId!!)
                        .setDynamicVariables(dynamicVariables)
                        .build()
                }

                // Start the conversation
                activeConversation = elevenLabsClient?.startConversation(
                    config = config,
                    listener = object : ConversationListener {
                        override fun onConversationStarted(conversationId: String) {
                            Log.d(TAG, "✅ Conversation started: $conversationId")
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
                        }

                        override fun onAudioReceived(audioData: ByteArray) {
                            // Audio is handled automatically by the SDK
                        }

                        override fun onTranscript(text: String, isFinal: Boolean, source: TranscriptSource) {
                            sendEvent("transcript", mapOf(
                                "text" to text,
                                "isFinal" to isFinal,
                                "source" to source.name
                            ))
                        }

                        override fun onMetadata(metadata: Map<String, Any>) {
                            conversationMetadata.putAll(metadata)
                            sendEvent("metadata", metadata)
                        }

                        override fun onError(error: ConversationError) {
                            Log.e(TAG, "❌ Conversation error: ${error.message}")
                            conversationState = ConversationState.ERROR
                            sendEvent("conversationFailed", mapOf(
                                "error" to error.message,
                                "code" to error.code
                            ))
                        }

                        override fun onConversationEnded(reason: EndReason) {
                            Log.d(TAG, "🔚 Conversation ended: ${reason.name}")
                            conversationState = ConversationState.DISCONNECTED
                            activeConversation = null
                            
                            sendEvent("conversationEnded", mapOf(
                                "reason" to reason.name,
                                "duration" to (System.currentTimeMillis() - connectionStartTime)
                            ))
                        }

                        override fun onModeChange(mode: ConversationMode) {
                            sendEvent("modeChange", mapOf("mode" to mode.name))
                        }
                    }
                )

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
                activeConversation?.endConversation()
                activeConversation = null
                conversationState = ConversationState.DISCONNECTED

                // Reset audio mode
                withContext(Dispatchers.Main) {
                    audioManager?.mode = AudioManager.MODE_NORMAL
                }

                conversationMetadata.clear()
                connectionStartTime = 0

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

        if (activeConversation == null) {
            result.error("NO_CONVERSATION", "No active conversation", null)
            return
        }

        scope.launch {
            try {
                activeConversation?.sendTextInput(message)
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
        
        activeConversation?.setMicrophoneMuted(muted)
        sendEvent("microphoneStateChanged", mapOf("muted" to muted))
        result.success(mapOf("muted" to muted))
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
        activeConversation?.endConversation()
        elevenLabsClient?.release()
        scope.cancel()
        audioManager?.mode = AudioManager.MODE_NORMAL
        eventSink = null
    }
}