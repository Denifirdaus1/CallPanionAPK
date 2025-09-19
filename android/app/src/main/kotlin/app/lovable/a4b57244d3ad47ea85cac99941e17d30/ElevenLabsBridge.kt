// android/app/src/main/kotlin/app/lovable/a4b57244d3ad47ea85cac99941e17d30/ElevenLabsBridge.kt
package app.lovable.a4b57244d3ad47ea85cac99941e17d30

import android.app.Activity
import android.media.AudioManager
import android.content.Context
import android.util.Log
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.flutter.plugin.common.EventChannel
import io.elevenlabs.ElevenLabsSDK
import io.elevenlabs.ConversationSession
import io.elevenlabs.ConversationConfig
import kotlinx.coroutines.*
import android.os.Handler
import android.os.Looper

class ElevenLabsBridge(
    private val activity: Activity,
    messenger: BinaryMessenger
) : MethodChannel.MethodCallHandler, EventChannel.StreamHandler {

    companion object {
        private const val TAG = "ElevenLabsBridge"
        // FIX: Use same channel names as iOS!
        private const val METHOD_CHANNEL_NAME = "com.yourapp.elevenlabs/conversation"
        private const val EVENT_CHANNEL_NAME = "com.yourapp.elevenlabs/events"
    }

    private val methodChannel = MethodChannel(messenger, METHOD_CHANNEL_NAME)
    private val eventChannel = EventChannel(messenger, EVENT_CHANNEL_NAME)
    private var eventSink: EventChannel.EventSink? = null

    private var elevenLabsSDK: ElevenLabsSDK? = null
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
        methodChannel.setMethodCallHandler(this)
        eventChannel.setStreamHandler(this)
        setupAudioSession()

        // Initialize ElevenLabs SDK
        elevenLabsSDK = ElevenLabsSDK.create(activity.applicationContext)
        Log.d(TAG, "✅ ElevenLabs Bridge initialized with proper channel names")
    }

    private fun setupAudioSession() {
        audioManager = activity.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        audioManager?.mode = AudioManager.MODE_IN_COMMUNICATION
        Log.d(TAG, "🎵 Audio session configured for VoIP calls")
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        Log.d(TAG, "🚀 Method called: ${call.method}")

        when (call.method) {
            "startConversation" -> handleStartConversation(call, result)
            "endConversation" -> handleEndConversation(result)
            "sendMessage" -> handleSendMessage(call, result)
            "getConversationState" -> handleGetConversationState(result)
            "setMicrophoneMuted" -> handleSetMicrophoneMuted(call, result)
            else -> result.notImplemented()
        }
    }

    private fun handleStartConversation(call: MethodCall, result: MethodChannel.Result) {
        val token = call.argument<String>("token")
        val dynamicVariables = call.argument<Map<String, String>>("dynamicVariables")

        if (token == null) {
            Log.e(TAG, "❌ Token is null")
            result.error("INVALID_ARGUMENT", "Token required", null)
            return
        }

        Log.d(TAG, "🔐 Token received (length: ${token.length})")
        Log.d(TAG, "📋 Dynamic variables: $dynamicVariables")

        conversationState = ConversationState.CONNECTING
        connectionStartTime = System.currentTimeMillis()
        sendEvent("state_change", mapOf("state" to "connecting"))

        scope.launch {
            try {
                Log.d(TAG, "🔗 Creating conversation session...")

                conversationSession = elevenLabsSDK?.createConversationSession(
                    ConversationConfig(
                        conversationToken = token,
                        dynamicVariables = dynamicVariables ?: emptyMap()
                    )
                )

                setupSessionHandlers()

                Log.d(TAG, "🎯 Starting conversation session...")
                val conversationId = conversationSession?.startSession()

                if (conversationId != null) {
                    conversationState = ConversationState.CONNECTED
                    conversationMetadata["conversationId"] = conversationId
                    conversationMetadata["startTime"] = connectionStartTime

                    Log.d(TAG, "✅ Conversation started successfully: $conversationId")

                    withContext(Dispatchers.Main) {
                        result.success(conversationId)
                    }

                    sendEvent("connected", mapOf("conversation_id" to conversationId))
                } else {
                    throw Exception("Failed to start conversation - null ID returned")
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error starting conversation: ${e.message}", e)
                conversationState = ConversationState.ERROR

                withContext(Dispatchers.Main) {
                    result.error("CONVERSATION_START_ERROR", e.message, e.stackTraceToString())
                }

                sendEvent("error", mapOf("error" to (e.message ?: "Unknown error")))
            }
        }
    }

    private fun handleEndConversation(result: MethodChannel.Result) {
        Log.d(TAG, "🔴 Ending conversation...")

        scope.launch {
            try {
                conversationSession?.endSession()
                conversationSession = null
                conversationState = ConversationState.DISCONNECTED

                val duration = if (connectionStartTime > 0) {
                    System.currentTimeMillis() - connectionStartTime
                } else 0

                Log.d(TAG, "✅ Conversation ended. Duration: ${duration}ms")

                withContext(Dispatchers.Main) {
                    result.success(true)
                }

                sendEvent("disconnected", mapOf("duration" to duration))

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error ending conversation: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("CONVERSATION_END_ERROR", e.message, null)
                }
            }
        }
    }

    private fun handleSendMessage(call: MethodCall, result: MethodChannel.Result) {
        val message = call.argument<String>("message")

        if (message == null) {
            result.error("INVALID_ARGUMENT", "Message required", null)
            return
        }

        scope.launch {
            try {
                conversationSession?.sendMessage(message)
                Log.d(TAG, "💬 Message sent: $message")

                withContext(Dispatchers.Main) {
                    result.success(true)
                }

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error sending message: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("SEND_MESSAGE_ERROR", e.message, null)
                }
            }
        }
    }

    private fun handleGetConversationState(result: MethodChannel.Result) {
        val state = mapOf(
            "state" to conversationState.name.lowercase(),
            "conversationId" to conversationMetadata["conversationId"],
            "startTime" to conversationMetadata["startTime"],
            "isConnected" to (conversationState == ConversationState.CONNECTED)
        )

        Log.d(TAG, "📊 Current state: $state")
        result.success(state)
    }

    private fun handleSetMicrophoneMuted(call: MethodCall, result: MethodChannel.Result) {
        val muted = call.argument<Boolean>("muted") ?: false

        scope.launch {
            try {
                conversationSession?.setMicrophoneMuted(muted)
                Log.d(TAG, if (muted) "🔇 Microphone muted" else "🎤 Microphone unmuted")

                withContext(Dispatchers.Main) {
                    result.success(true)
                }

                sendEvent("microphone_state", mapOf("muted" to muted))

            } catch (e: Exception) {
                Log.e(TAG, "❌ Error setting microphone state: ${e.message}", e)
                withContext(Dispatchers.Main) {
                    result.error("MICROPHONE_ERROR", e.message, null)
                }
            }
        }
    }

    private fun setupSessionHandlers() {
        conversationSession?.apply {
            onConnect { conversationId ->
                Log.d(TAG, "🔗 onConnect: $conversationId")
                sendEvent("connected", mapOf("conversation_id" to conversationId))
            }

            onMessage { source, message ->
                Log.d(TAG, "💬 onMessage from $source: $message")
                sendEvent("message", mapOf(
                    "source" to source.name,
                    "message" to message
                ))
            }

            onModeChange { mode ->
                Log.d(TAG, "🔄 Mode changed: $mode")
                sendEvent("mode_change", mapOf("mode" to mode.name))
            }

            onStatusChange { status ->
                Log.d(TAG, "📊 Status changed: $status")
                sendEvent("status_change", mapOf("status" to status.name))
            }

            onError { error ->
                Log.e(TAG, "❌ Conversation error: $error")
                sendEvent("error", mapOf("error" to error.message))
            }

            onDisconnect {
                Log.d(TAG, "🔌 Disconnected")
                sendEvent("disconnected", mapOf("reason" to "session_ended"))
            }
        }
    }

    private fun sendEvent(type: String, data: Map<String, Any>) {
        val event = mapOf(
            "type" to type,
            "data" to data,
            "timestamp" to System.currentTimeMillis()
        )

        Handler(Looper.getMainLooper()).post {
            eventSink?.success(event)
        }
    }

    // EventChannel.StreamHandler implementation
    override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
        eventSink = events
        Log.d(TAG, "✅ Event sink attached")
    }

    override fun onCancel(arguments: Any?) {
        eventSink = null
        Log.d(TAG, "❌ Event sink detached")
    }

    fun cleanup() {
        scope.cancel()
        conversationSession?.endSession()
        conversationSession = null
        elevenLabsSDK = null
        Log.d(TAG, "🧹 Bridge cleaned up")
    }
}