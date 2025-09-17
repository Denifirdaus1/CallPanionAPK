package uk.co.callpanion.elderly

import android.app.Activity
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import io.elevenlabs.ElevenLabs
import io.elevenlabs.Conversation
import io.elevenlabs.ConversationConfig

class ElevenLabsBridge(
    private val activity: Activity,
    messenger: BinaryMessenger
) : MethodChannel.MethodCallHandler {

    private val channel = MethodChannel(messenger, "elevenlabs_bridge")
    private var conversation: Conversation? = null

    init {
        channel.setMethodCallHandler(this)
    }

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "startSession" -> {
                val token = call.argument<String>("conversationToken") ?: run {
                    result.error("INVALID_ARGUMENT", "conversationToken required", null)
                    return
                }

                val dynamicVariables = call.argument<Map<String, Any?>>("dynamicVariables") ?: emptyMap()

                try {
                    // Start conversation with token (private agent)
                    conversation = ElevenLabs.startConversation(
                        token,
                        ConversationConfig(
                            dynamicVariables = dynamicVariables,
                            onEvent = { event ->
                                // Optional: send status updates to Flutter
                                println("ElevenLabs event: $event")
                            },
                            onError = { error ->
                                println("ElevenLabs error: $error")
                                result.error("ELEVENLABS_ERROR", error.message, null)
                            }
                        )
                    )

                    // Get conversationId from metadata
                    val metadata = conversation?.getConversationMetadata()
                    result.success(metadata?.conversationId ?: "")
                } catch (e: Exception) {
                    result.error("START_SESSION_ERROR", "Failed to start session: ${e.message}", null)
                }
            }

            "endSession" -> {
                try {
                    conversation?.stop()
                    conversation = null
                    result.success(true)
                } catch (e: Exception) {
                    result.error("END_SESSION_ERROR", "Failed to end session: ${e.message}", null)
                }
            }

            "toggleMute" -> {
                try {
                    conversation?.toggleMute()
                    result.success(true)
                } catch (e: Exception) {
                    result.error("TOGGLE_MUTE_ERROR", "Failed to toggle mute: ${e.message}", null)
                }
            }

            "setMicMuted" -> {
                try {
                    val muted = call.argument<Boolean>("muted") ?: false
                    conversation?.setMuted(muted)
                    result.success(true)
                } catch (e: Exception) {
                    result.error("SET_MIC_MUTED_ERROR", "Failed to set mic muted: ${e.message}", null)
                }
            }

            else -> {
                result.notImplemented()
            }
        }
    }
}