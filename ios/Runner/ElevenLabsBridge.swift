import Flutter
import UIKit
import ElevenLabs

public class ElevenLabsBridge: NSObject, FlutterPlugin {
    private var channel: FlutterMethodChannel!
    private var conversation: Conversation?

    public static func register(with registrar: FlutterPluginRegistrar) {
        let instance = ElevenLabsBridge()
        instance.channel = FlutterMethodChannel(name: "elevenlabs_bridge", binaryMessenger: registrar.messenger())
        registrar.addMethodCallDelegate(instance, channel: instance.channel)
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "startSession":
            guard let args = call.arguments as? [String: Any],
                  let token = args["conversationToken"] as? String else {
                result(FlutterError(code: "INVALID_ARGUMENT", message: "conversationToken required", details: nil))
                return
            }

            // Read dynamic variables from Flutter
            let dynamicVariables = args["dynamicVariables"] as? [String: Any] ?? [:]

            Task { @MainActor in
                do {
                    // Create config with dynamic variables if supported
                    var config = ConversationConfig()

                    // Start conversation with token
                    self.conversation = try await ElevenLabs.startConversation(
                        conversationToken: token,
                        config: config
                    )

                    // Get conversationId from metadata
                    let cid = self.conversation?.conversationMetadata?.conversationId ?? ""

                    // Send contextual update with dynamic variables if conversation started successfully
                    if !dynamicVariables.isEmpty && !cid.isEmpty {
                        // Send contextual update (non-interrupting)
                        var contextData = dynamicVariables
                        contextData["session_id"] = cid
                        contextData["call_type"] = "in_app_call"

                        // Note: Contextual update implementation depends on SDK version
                        // This is a placeholder for the contextual update API
                        // try? await self.conversation?.sendContextualUpdate(contextData)
                    }

                    result(cid)
                } catch {
                    result(FlutterError(code: "ELEVENLABS_ERROR", message: error.localizedDescription, details: nil))
                }
            }

        case "endSession":
            Task { @MainActor in
                await self.conversation?.endConversation()
                self.conversation = nil
                result(true)
            }

        case "setMicMuted":
            let muted = (call.arguments as? [String: Any])?["muted"] as? Bool ?? false
            Task { @MainActor in
                try? await self.conversation?.setMuted(muted)
                result(true)
            }

        case "toggleMute":
            Task { @MainActor in
                let currentMuted = self.conversation?.isMuted ?? false
                try? await self.conversation?.setMuted(!currentMuted)
                result(true)
            }

        default:
            result(FlutterMethodNotImplemented)
        }
    }
}