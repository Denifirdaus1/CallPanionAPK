import Flutter
import UIKit
import AVFoundation
import CallKit

// Import ElevenLabs iOS SDK
import ElevenLabs

public class ElevenLabsBridge: NSObject, FlutterPlugin {
    private var methodChannel: FlutterMethodChannel!
    private var eventChannel: FlutterEventChannel!
    private var eventSink: FlutterEventSink?
    
    // ElevenLabs SDK objects
    private var elevenLabsClient: ElevenLabsClient?
    private var activeConversation: ConversationSession?
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
        
        instance.methodChannel = FlutterMethodChannel(
            name: "com.yourapp.elevenlabs/conversation",
            binaryMessenger: registrar.messenger()
        )
        
        instance.eventChannel = FlutterEventChannel(
            name: "com.yourapp.elevenlabs/events",
            binaryMessenger: registrar.messenger()
        )
        
        registrar.addMethodCallDelegate(instance, channel: instance.methodChannel)
        instance.eventChannel.setStreamHandler(instance)
        
        instance.setupAudioSession()
        instance.initializeElevenLabs()
    }
    
    private func initializeElevenLabs() {
        // Initialize ElevenLabs SDK
        elevenLabsClient = ElevenLabsClient()
        print("[ElevenLabsBridge] ✅ ElevenLabs SDK initialized")
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
                
                // Create conversation configuration
                let config: ConversationConfig
                if let token = conversationToken {
                    config = ConversationConfig(conversationToken: token)
                } else {
                    config = ConversationConfig(agentId: agentId!)
                }
                
                // Set dynamic variables
                config.dynamicVariables = dynamicVariables
                
                // Start the conversation
                activeConversation = try await elevenLabsClient?.startConversation(
                    config: config,
                    delegate: self
                )
                
                let conversationId = activeConversation?.conversationId ?? UUID().uuidString
                
                conversationState = .connected
                conversationMetadata = [
                    "conversationId": conversationId,
                    "startTime": connectionStartTime?.timeIntervalSince1970 ?? 0
                ]
                
                print("[ElevenLabsBridge] ✅ Conversation started: \(conversationId)")
                
                sendEvent(type: "conversationConnected", data: [
                    "conversationId": conversationId,
                    "timestamp": Date().timeIntervalSince1970
                ])
                
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
                // End the conversation
                try await activeConversation?.endConversation()
                
                activeConversation = nil
                conversationState = .disconnected
                
                // Deactivate audio session
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
        
        guard activeConversation != nil else {
            result(FlutterError(code: "NO_CONVERSATION", message: "No active conversation", details: nil))
            return
        }
        
        Task { @MainActor in
            do {
                try await activeConversation?.sendTextInput(message)
                
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
        
        activeConversation?.setMicrophoneMuted(muted)
        
        sendEvent(type: "microphoneStateChanged", data: ["muted": muted])
        result(["muted": muted])
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

// MARK: - ConversationDelegate
extension ElevenLabsBridge: ConversationDelegate {
    
    public func conversationDidConnect(conversationId: String) {
        sendEvent(type: "conversationConnected", data: ["conversationId": conversationId])
    }
    
    public func conversationDidReceiveAudio(data: Data) {
        // Audio is handled automatically by the SDK
    }
    
    public func conversationDidReceiveTranscript(text: String, isFinal: Bool, source: TranscriptSource) {
        sendEvent(type: "transcript", data: [
            "text": text,
            "isFinal": isFinal,
            "source": source.rawValue
        ])
    }
    
    public func conversationDidReceiveMetadata(metadata: [String: Any]) {
        conversationMetadata.merge(metadata) { $1 }
        sendEvent(type: "metadata", data: metadata)
    }
    
    public func conversationDidEncounterError(error: Error) {
        conversationState = .error
        sendEvent(type: "conversationFailed", data: [
            "error": error.localizedDescription,
            "code": "CONVERSATION_ERROR"
        ])
    }
    
    public func conversationDidEnd(reason: EndReason) {
        conversationState = .disconnected
        activeConversation = nil
        
        sendEvent(type: "conversationEnded", data: [
            "reason": reason.rawValue,
            "duration": abs(connectionStartTime?.timeIntervalSinceNow ?? 0)
        ])
    }
    
    public func conversationModeDidChange(mode: ConversationMode) {
        sendEvent(type: "modeChange", data: ["mode": mode.rawValue])
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