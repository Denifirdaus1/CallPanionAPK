import Flutter
import UIKit
import AVFoundation
import CallKit
import ElevenLabs

public class ElevenLabsBridge: NSObject, FlutterPlugin {
    private var methodChannel: FlutterMethodChannel!
    private var eventChannel: FlutterEventChannel!
    private var eventSink: FlutterEventSink?
    
    // ElevenLabs SDK conversation instance (official SDK)
    private var conversation: Conversation?
    private var conversationState: ConversationState = .idle
    private var conversationMetadata: [String: Any] = [:]
    private var connectionStartTime: Date?
    private var audioSession: AVAudioSession?
    private let callKitManager = CallKitManager()

    enum ConversationState {
        case idle
        case connecting
        case connected
        case disconnected
        case error
    }

    public static func register(with registrar: FlutterPluginRegistrar) {
        let instance = ElevenLabsBridge()
        
        // Use the same channel names as Android bridge
        instance.methodChannel = FlutterMethodChannel(
            name: "app.lovable.a4b57244d3ad47ea85cac99941e17d30.elevenlabs/conversation",
            binaryMessenger: registrar.messenger()
        )
        
        instance.eventChannel = FlutterEventChannel(
            name: "app.lovable.a4b57244d3ad47ea85cac99941e17d30.elevenlabs/events",
            binaryMessenger: registrar.messenger()
        )
        
        registrar.addMethodCallDelegate(instance, channel: instance.methodChannel)
        instance.eventChannel.setStreamHandler(instance)
        
        instance.setupAudioSession()
        instance.initializeElevenLabs()
    }
    
    private func initializeElevenLabs() {
        // Optional global configure
        // ElevenLabs.configure(.init(debugMode: false))
        print("[ElevenLabsBridge] ✅ ElevenLabs SDK ready")
    }
    
    private func setupAudioSession() {
        audioSession = AVAudioSession.sharedInstance()
        
        do {
            try audioSession?.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP, .defaultToSpeaker])
            try audioSession?.setActive(true)
            
            print("[ElevenLabsBridge] ✅ Audio session configured for VoIP calls")
        } catch {
            print("[ElevenLabsBridge] ❌ Failed to setup audio session: \(error.localizedDescription)")
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
            
        case "setMicMuted":
            handleSetMicMuted(call: call, result: result)
        
        case "getConversationState":
            result([
                "state": conversationStateString(conversationState),
                "conversationId": conversationMetadata["conversationId"] as? String ?? "",
                "connectionTime": connectionStartTime?.timeIntervalSince1970 ?? 0,
                "metadata": conversationMetadata
            ])
        
        case "getConnectionStatus":
            result([
                "isConnected": conversationState == .connected,
                "state": conversationStateString(conversationState),
                "hasActiveConversation": conversation != nil
            ])
            
        case "getConversationState":
            result([
                "state": conversationStateString(conversationState),
                "conversationId": conversationMetadata["conversationId"] as? String ?? "",
                "connectionTime": connectionStartTime?.timeIntervalSince1970 ?? 0,
                "metadata": conversationMetadata
            ])
            
        case "getConnectionStatus":
            result([
                "isConnected": conversationState == .connected,
                "state": conversationStateString(conversationState),
                "hasActiveConversation": activeConversation != nil
            ])
            
        default:
            result(FlutterMethodNotImplemented)
        }
    }
    
    private func handleStartConversation(call: FlutterMethodCall, result: @escaping FlutterResult) {
        print("[ElevenLabsBridge] 🚀 handleStartConversation called")
        
        guard let args = call.arguments as? [String: Any] else {
            result(FlutterError(code: "INVALID_ARGUMENT", message: "Invalid arguments", details: nil))
            return
        }
        
        let conversationToken = args["conversationToken"] as? String
        let agentId = args["agentId"] as? String
        let dynamicVariables = args["dynamicVariables"] as? [String: String] ?? [:]
        
        // Validation
        guard conversationToken != nil || agentId != nil else {
            result(FlutterError(code: "INVALID_ARGUMENT", message: "Either conversationToken or agentId is required", details: nil))
            return
        }
        
        guard conversationState == .idle else {
            result(FlutterError(code: "CONVERSATION_ACTIVE", message: "A conversation is already active", details: nil))
            return
        }
        
        print("[ElevenLabsBridge] 📋 Dynamic variables: \(dynamicVariables)")
        
        conversationState = .connecting
        connectionStartTime = Date()
        
        Task { @MainActor in
            do {
                // Configure audio session
                try audioSession?.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .defaultToSpeaker])
                try audioSession?.setActive(true)
                
                // Build conversation config
                var config = ConversationConfig()
                config.conversationOverrides = .init(textOnly: false)
                config.dynamicVariables = dynamicVariables
                
                // Start conversation via official SDK
                if let token = conversationToken {
                    conversation = try await ElevenLabs.startConversation(
                        conversationToken: token,
                        config: config,
                        onAgentReady: { [weak self] in
                            guard let self else { return }
                            self.conversationState = .connected
                            let convId = self.conversation?.conversationMetadata?.conversationId ?? UUID().uuidString
                            self.conversationMetadata = [
                                "conversationId": convId,
                                "startTime": self.connectionStartTime?.timeIntervalSince1970 ?? 0
                            ]
                            self.sendEvent(type: "conversationConnected", data: [
                                "conversationId": convId,
                                "timestamp": Date().timeIntervalSince1970
                            ])
                        },
                        onDisconnect: { [weak self] in
                            guard let self else { return }
                            self.conversationState = .disconnected
                            self.sendEvent(type: "conversationEnded", data: [
                                "duration": abs(self.connectionStartTime?.timeIntervalSinceNow ?? 0),
                                "timestamp": Date().timeIntervalSince1970
                            ])
                        }
                    )
                } else if let agent = agentId {
                    conversation = try await ElevenLabs.startConversation(
                        agentId: agent,
                        config: config,
                        onAgentReady: { [weak self] in
                            guard let self else { return }
                            self.conversationState = .connected
                            let convId = self.conversation?.conversationMetadata?.conversationId ?? UUID().uuidString
                            self.conversationMetadata = [
                                "conversationId": convId,
                                "startTime": self.connectionStartTime?.timeIntervalSince1970 ?? 0
                            ]
                            self.sendEvent(type: "conversationConnected", data: [
                                "conversationId": convId,
                                "timestamp": Date().timeIntervalSince1970
                            ])
                        },
                        onDisconnect: { [weak self] in
                            guard let self else { return }
                            self.conversationState = .disconnected
                            self.sendEvent(type: "conversationEnded", data: [
                                "duration": abs(self.connectionStartTime?.timeIntervalSinceNow ?? 0),
                                "timestamp": Date().timeIntervalSince1970
                            ])
                        }
                    )
                }
                
                let conversationId = conversation?.conversationMetadata?.conversationId ?? UUID().uuidString
                print("[ElevenLabsBridge] ✅ Conversation started (pending ready): \(conversationId)")
                result(conversationId)
                
            } catch {
                print("[ElevenLabsBridge] ❌ Error starting conversation: \(error)")
                conversationState = .error
                result(FlutterError(code: "START_FAILED", message: error.localizedDescription, details: nil))
            }
        }
    }
    
    private func handleEndConversation(result: @escaping FlutterResult) {
        print("[ElevenLabsBridge] 🔚 Ending conversation")
        let duration = connectionStartTime?.timeIntervalSinceNow ?? 0
        Task { @MainActor in
            do {
                await conversation?.endConversation()
                conversation = nil
                conversationState = .disconnected
                try? audioSession?.setActive(false)
                print("[ElevenLabsBridge] ✅ Conversation ended: duration=\(abs(duration))s")
                conversationMetadata = [:]
                connectionStartTime = nil
                result(nil)
            } catch {
                print("[ElevenLabsBridge] ❌ Error ending conversation: \(error)")
                result(FlutterError(code: "END_FAILED", message: error.localizedDescription, details: nil))
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
                try await conversation?.sendMessage(message)
                
                print("[ElevenLabsBridge] 💬 Text message sent: \(message)")
                result(["success": true, "message": message])
                
            } catch {
                result(FlutterError(code: "MESSAGE_FAILED", message: error.localizedDescription, details: nil))
            }
        }
    }
    
    private func handleSetMicMuted(call: FlutterMethodCall, result: @escaping FlutterResult) {
        guard let args = call.arguments as? [String: Any],
              let muted = args["muted"] as? Bool else {
            result(FlutterError(code: "INVALID_ARGUMENT", message: "muted parameter required", details: nil))
            return
        }
        Task { @MainActor in
            do {
                try await conversation?.setMuted(muted)
                sendEvent(type: "microphoneStateChanged", data: ["muted": muted])
                result(["muted": muted])
            } catch {
                result(FlutterError(code: "MUTE_FAILED", message: error.localizedDescription, details: nil))
            }
        }
    }
    
    private func sendEvent(type: String, data: [String: Any]) {
        let event = [
            "type": type,
            "data": data,
            "timestamp": Date().timeIntervalSince1970
        ] as [String : Any]
        
        DispatchQueue.main.async {
            self.eventSink?(event)
        }
    }
    
    private func conversationStateString(_ state: ConversationState) -> String {
        switch state {
        case .idle: return "idle"
        case .connecting: return "connecting"
        case .connected: return "connected"
        case .disconnected: return "disconnected"
        case .error: return "error"
        }
    }
}

// Event streaming is primarily handled inline via callbacks above

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
        update.localizedCallerName = "CallPanion AI Assistant"
        
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