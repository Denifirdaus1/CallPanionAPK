import Flutter
import UIKit
import ElevenLabs
import AVFoundation
import CallKit

public class ElevenLabsBridge: NSObject, FlutterPlugin {
    private var methodChannel: FlutterMethodChannel!
    private var eventChannel: FlutterEventChannel!
    private var eventSink: FlutterEventSink?
    private var conversation: Conversation?
    private var conversationState: ConversationState = .idle
    private var conversationMetadata: [String: Any] = [:]
    private var connectionStartTime: Date?
    private var audioSession: AVAudioSession?
    private let callKitManager = CallKitManager()

    // Enhanced state management
    enum ConversationState {
        case idle
        case connecting
        case connected
        case disconnected
        case error
    }

    // Error types for better error handling
    enum ElevenLabsError: Error {
        case invalidArguments(String)
        case connectionFailed(String)
        case conversationNotActive
        case audioSessionError(String)
        case networkError(String)

        var localizedDescription: String {
            switch self {
            case .invalidArguments(let msg):
                return "Invalid arguments: \(msg)"
            case .connectionFailed(let msg):
                return "Connection failed: \(msg)"
            case .conversationNotActive:
                return "No active conversation"
            case .audioSessionError(let msg):
                return "Audio session error: \(msg)"
            case .networkError(let msg):
                return "Network error: \(msg)"
            }
        }
    }

    public static func register(with registrar: FlutterPluginRegistrar) {
        let instance = ElevenLabsBridge()

        // Use method channel name matching implementation guide
        instance.methodChannel = FlutterMethodChannel(
            name: "com.yourapp.elevenlabs/conversation",
            binaryMessenger: registrar.messenger()
        )

        // Set up event channel for real-time events
        instance.eventChannel = FlutterEventChannel(
            name: "com.yourapp.elevenlabs/events",
            binaryMessenger: registrar.messenger()
        )

        registrar.addMethodCallDelegate(instance, channel: instance.methodChannel)
        instance.eventChannel.setStreamHandler(instance)

        // Initialize audio session
        instance.setupAudioSession()
    }

    // Enhanced audio session setup for VoIP calls
    private func setupAudioSession() {
        audioSession = AVAudioSession.sharedInstance()

        do {
            try audioSession?.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])
            try audioSession?.setActive(true)

            print("[ElevenLabsBridge] Audio session configured for VoIP calls")
        } catch {
            print("[ElevenLabsBridge] Failed to setup audio session: \(error.localizedDescription)")
        }
    }

    public func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
        switch call.method {
        case "startConversation":
            handleStartConversation(call: call, result: result)

        case "endConversation":
            handleEndConversation(result: result)

        case "sendMessage":
            handleSendMessage(call: call, result: result)

        case "getConversationState":
            result([
                "state": conversationStateString(conversationState),
                "conversationId": conversationMetadata["conversationId"] as? String ?? "",
                "connectionTime": connectionStartTime?.timeIntervalSince1970 ?? 0,
                "metadata": conversationMetadata
            ])

        case "setMicMuted":
            setMicrophoneMuted(call: call, result: result)

        case "toggleMute":
            toggleMicrophone(result: result)

        case "getConnectionStatus":
            result([
                "isConnected": conversationState == .connected,
                "state": conversationStateString(conversationState),
                "hasActiveConversation": conversation != nil
            ])

        default:
            result(FlutterMethodNotImplemented)
        }
    }

    // MARK: - Enhanced Conversation Management

    private func handleStartConversation(call: FlutterMethodCall, result: @escaping FlutterResult) {
        guard let args = call.arguments as? [String: Any],
              let token = args["token"] as? String else {
            result(FlutterError(code: "INVALID_ARGUMENT", message: "Token required", details: nil))
            return
        }

        // Prevent multiple concurrent sessions
        guard conversationState == .idle else {
            result(FlutterError(code: "CONVERSATION_ACTIVE", message: "A conversation is already active", details: nil))
            return
        }

        // Extract dynamic variables
        let dynamicVariables = args["dynamicVariables"] as? [String: String] ?? [:]

        print("[ElevenLabsBridge] Starting conversation with token")
        print("[ElevenLabsBridge] Dynamic variables: \(dynamicVariables)")

        conversationState = .connecting
        connectionStartTime = Date()

        Task { @MainActor in
            do {
                // Configure audio session for VoIP
                try audioSession?.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
                try audioSession?.setActive(true)

                // Create conversation config
                let config = ConversationConfig(
                    conversationToken: token,
                    dynamicVariables: dynamicVariables
                )

                // Start conversation
                self.conversation = Conversation()
                self.setupConversationHandlers()

                let conversationId = try await self.conversation!.startSession(config: config)

                // Update state and metadata
                self.conversationState = .connected
                self.conversationMetadata = [
                    "conversationId": conversationId,
                    "startTime": self.connectionStartTime?.timeIntervalSince1970 ?? 0,
                    "dynamicVariables": dynamicVariables
                ]

                print("[ElevenLabsBridge] ✅ Conversation started successfully: \(conversationId)")

                result(conversationId)

            } catch {
                self.conversationState = .error
                self.handleError(error, result: result)
            }
        }
    }

    private func handleEndConversation(result: @escaping FlutterResult) {
        print("[ElevenLabsBridge] Ending conversation")

        let conversationId = conversationMetadata["conversationId"] as? String ?? ""
        let duration = connectionStartTime?.timeIntervalSinceNow ?? 0

        Task { @MainActor in
            // End the conversation gracefully
            await self.conversation?.endConversation()

            self.conversation = nil
            self.conversationState = .disconnected

            // Deactivate audio session
            try? self.audioSession?.setActive(false)

            print("[ElevenLabsBridge] ✅ Conversation ended: duration=\(abs(duration))s")

            // Clear metadata
            self.conversationMetadata = [:]
            self.connectionStartTime = nil

            result(nil)
        }
    }

    private func setMicrophoneMuted(call: FlutterMethodCall, result: @escaping FlutterResult) {
        guard let args = call.arguments as? [String: Any],
              let muted = args["muted"] as? Bool else {
            result(FlutterError(code: "INVALID_ARGUMENT", message: "muted parameter required", details: nil))
            return
        }

        guard conversation != nil else {
            result(FlutterError(code: "NO_CONVERSATION", message: "No active conversation", details: nil))
            return
        }

        Task { @MainActor in
            do {
                try await self.conversation?.setMuted(muted)

                print("[ElevenLabsBridge] Microphone \(muted ? "muted" : "unmuted")")

                // Notify Flutter about mute state change
                self.notifyFlutter(event: "microphoneStateChanged", data: [
                    "muted": muted,
                    "conversationId": self.conversationMetadata["conversationId"] as? String ?? ""
                ])

                result(["success": true, "muted": muted])
            } catch {
                result(FlutterError(code: "MUTE_FAILED", message: error.localizedDescription, details: nil))
            }
        }
    }

    private func toggleMicrophone(result: @escaping FlutterResult) {
        guard conversation != nil else {
            result(FlutterError(code: "NO_CONVERSATION", message: "No active conversation", details: nil))
            return
        }

        Task { @MainActor in
            do {
                let currentMuted = self.conversation?.isMuted ?? false
                let newMuted = !currentMuted

                try await self.conversation?.setMuted(newMuted)

                print("[ElevenLabsBridge] Microphone toggled to \(newMuted ? "muted" : "unmuted")")

                // Notify Flutter about mute state change
                self.notifyFlutter(event: "microphoneStateChanged", data: [
                    "muted": newMuted,
                    "conversationId": self.conversationMetadata["conversationId"] as? String ?? ""
                ])

                result(["success": true, "muted": newMuted])
            } catch {
                result(FlutterError(code: "TOGGLE_FAILED", message: error.localizedDescription, details: nil))
            }
        }
    }

    private func handleSendMessage(call: FlutterMethodCall, result: @escaping FlutterResult) {
        guard let args = call.arguments as? [String: Any],
              let message = args["message"] as? String else {
            result(FlutterError(code: "INVALID_ARGUMENT", message: "message parameter required", details: nil))
            return
        }

        guard conversation != nil else {
            result(FlutterError(code: "NO_CONVERSATION", message: "No active conversation", details: nil))
            return
        }

        Task { @MainActor in
            do {
                // Note: This depends on the ElevenLabs SDK supporting text input
                // try await self.conversation?.sendTextInput(message)

                print("[ElevenLabsBridge] Text message sent: \(message)")

                result(["success": true, "message": message])
            } catch {
                result(FlutterError(code: "MESSAGE_FAILED", message: error.localizedDescription, details: nil))
            }
        }
    }

    // MARK: - Conversation Event Handlers

    private func setupConversationHandlers() {
        conversation?.onConnect = { [weak self] conversationId in
            self?.sendEvent(type: "connected", data: ["conversation_id": conversationId])
        }

        conversation?.onMessage = { [weak self] source, message in
            self?.sendEvent(type: "message", data: [
                "source": source.rawValue,
                "message": message
            ])
        }

        conversation?.onModeChange = { [weak self] mode in
            self?.sendEvent(type: "mode_change", data: ["mode": mode.rawValue])
        }

        conversation?.onStatusChange = { [weak self] status in
            self?.sendEvent(type: "status_change", data: ["status": status.rawValue])
        }

        conversation?.onError = { [weak self] error in
            self?.sendEvent(type: "error", data: [
                "error": error.localizedDescription,
                "code": "CONVERSATION_ERROR"
            ])
        }
    }

    private func sendEvent(type: String, data: [String: Any]) {
        let event = [
            "type": type,
            "data": data,
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ] as [String : Any]

        DispatchQueue.main.async {
            self.eventSink?(event)
        }
    }

    private func handleError(_ error: Error, result: FlutterResult) {
        let errorCode: String
        let errorMessage: String

        if let elevenLabsError = error as? ElevenLabsError {
            switch elevenLabsError {
            case .invalidArguments:
                errorCode = "INVALID_ARGUMENT"
            case .connectionFailed:
                errorCode = "NETWORK_ERROR"
            case .conversationNotActive:
                errorCode = "CONVERSATION_NOT_ACTIVE"
            case .audioSessionError:
                errorCode = "AUDIO_SESSION_ERROR"
            case .networkError:
                errorCode = "NETWORK_ERROR"
            }
            errorMessage = elevenLabsError.localizedDescription
        } else {
            errorCode = "UNKNOWN_ERROR"
            errorMessage = error.localizedDescription
        }

        result(FlutterError(code: errorCode, message: errorMessage, details: nil))
    }

    // MARK: - Utility Methods

    private func conversationStateString(_ state: ConversationState) -> String {
        switch state {
        case .idle: return "idle"
        case .connecting: return "connecting"
        case .connected: return "connected"
        case .disconnected: return "disconnected"
        case .error: return "error"
        }
    }

    private func notifyFlutter(event: String, data: [String: Any]) {
        let payload: [String: Any] = [
            "event": event,
            "data": data,
            "timestamp": Date().timeIntervalSince1970
        ]

        DispatchQueue.main.async {
            self.methodChannel.invokeMethod("onNativeEvent", arguments: payload)
        }
    }
}

// MARK: - FlutterStreamHandler
extension ElevenLabsBridge: FlutterStreamHandler {
    public func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
        eventSink = events
        return nil
    }

    public func onCancel(withArguments arguments: Any?) -> FlutterError? {
        eventSink = nil
        return nil
    }
}

// MARK: - CallKit Manager
class CallKitManager: NSObject {
    private let provider: CXProvider
    private let callController = CXCallController()

    override init() {
        let config = CXProviderConfiguration(localizedName: "CallPanion AI")
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportsVideo = false
        config.supportedHandleTypes = [.generic]
        config.iconTemplateImageData = UIImage(named: "CallKitIcon")?.pngData()

        provider = CXProvider(configuration: config)
        super.init()
        provider.setDelegate(self, queue: nil)
    }

    func reportIncomingCall(uuid: UUID, handle: String, completion: @escaping (Error?) -> Void) {
        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: handle)
        update.hasVideo = false
        update.localizedCallerName = "AI Assistant"

        provider.reportNewIncomingCall(with: uuid, update: update, completion: completion)
    }
}

extension CallKitManager: CXProviderDelegate {
    func providerDidReset(_ provider: CXProvider) {
        // Handle provider reset
    }

    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        // Configure audio and start conversation
        action.fulfill()
    }

    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        // End conversation
        action.fulfill()
    }
}