import UIKit
import Flutter
import firebase_core
import firebase_messaging
import flutter_callkit_incoming
import PushKit

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate, PKPushRegistryDelegate {
    private var pushRegistry: PKPushRegistry?
    
    override func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Initialize Firebase
        FirebaseApp.configure()
        
        // Initialize CallKit
        SwiftFlutterCallkitIncomingPlugin.sharedInstance?.configureCallKit()
        
        // Configure UNUserNotificationCenter
        if #available(iOS 10.0, *) {
            UNUserNotificationCenter.current().delegate = self as UNUserNotificationCenterDelegate
        }
        
        // Initialize PushKit for VoIP push notifications
        initializePushKit()
        
        GeneratedPluginRegistrant.register(with: self)

        // Register ElevenLabs bridge
        ElevenLabsBridge.register(with: registrar(forPlugin: "ElevenLabsBridge")!)

        return super.application(application, didFinishLaunchingWithOptions: launchOptions)
    }
    
    // Initialize PushKit for VoIP push notifications
    private func initializePushKit() {
        pushRegistry = PKPushRegistry(queue: DispatchQueue.main)
        pushRegistry?.delegate = self
        pushRegistry?.desiredPushTypes = [.voIP]
    }

    // MARK: - PKPushRegistryDelegate
    
    // Handle incoming VoIP push notifications
    func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType) {
        print("📞 Received VoIP push notification: \(payload.dictionaryPayload)")
        
        // Extract call information from payload
        let userInfo = payload.dictionaryPayload
        
        // Handle different notification types
        if let notificationType = userInfo["type"] as? String {
            switch notificationType {
            case "incoming_call":
                // Handle incoming call notification - show CallKit interface
                SwiftFlutterCallkitIncomingPlugin.sharedInstance?.showCallkitIncoming(userInfo, fromPushKit: true)
                print("📞 CallKit interface triggered from VoIP notification")
            case "call_scheduled":
                // Handle scheduled call notification
                print("📅 Scheduled call notification received")
            default:
                print("📱 Unknown notification type: \(notificationType)")
            }
        } else {
            // Default handling for incoming call if type not specified
            SwiftFlutterCallkitIncomingPlugin.sharedInstance?.showCallkitIncoming(userInfo, fromPushKit: true)
            print("📞 CallKit interface triggered from VoIP notification (default)")
        }
    }
    
    // Handle successful registration for VoIP push notifications
    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        if type == .voIP {
            let token = pushCredentials.token.map { String(format: "%02.2hhx", $0) }.joined()
            print("VoIP Token: \(token)")
            
            // Note: VoIP token is different from regular APNs token
            // You may need to send this to your server separately
        }
    }
    
    // Handle registration failure for VoIP push notifications
    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
        print("Failed to register for VoIP push notifications")
    }

    // Handle regular push notifications (non-VoIP)
    override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        print("📱 Received regular push notification: \(userInfo)")

        // Handle different notification types
        if let notificationType = userInfo["type"] as? String {
            switch notificationType {
            case "incoming_call":
                // Handle incoming call notification - show CallKit interface
                SwiftFlutterCallkitIncomingPlugin.sharedInstance?.showCallkitIncoming(userInfo, fromPushKit: false)
                print("📞 CallKit interface triggered from regular notification")
            case "call_scheduled":
                // Handle scheduled call notification
                print("📅 Scheduled call notification received")
            default:
                print("📱 Unknown notification type: \(notificationType)")
            }
        }
        
        completionHandler(.newData)
    }
    
    // Handle device token registration
    override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
        let token = tokenParts.joined()
        print("APNs Device Token: \(token)")
        
        // Set APNs token for Firebase Messaging
        Messaging.messaging().apnsToken = deviceToken
    }
    
    // Handle registration failure
    override func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        print("Failed to register for remote notifications: \(error.localizedDescription)")
    }
}

// MARK: - UNUserNotificationCenterDelegate
extension AppDelegate: UNUserNotificationCenterDelegate {
    // Handle notification when app is in foreground
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.alert, .badge, .sound])
    }
    
    // Handle notification tap
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let userInfo = response.notification.request.content.userInfo
        print("Notification tapped: \(userInfo)")
        completionHandler()
    }
}