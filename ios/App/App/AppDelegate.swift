import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var firebaseReady = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // GoogleService-Info.plist is written by CI (codemagic.yaml). Without it
        // FirebaseApp.configure() would crash at launch, so only configure when
        // the file is really in the bundle.
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
            firebaseReady = true
        }
        // Permission is requested from JS (PushRegistrar) at a sensible moment,
        // not at launch.
        return true
    }

    // Capacitor's PushNotifications plugin expects an FCM registration token
    // (a String) on this notification. A raw APNs token is NOT accepted by the
    // FCM v1 API used in lib/push-server.ts, so exchange it through Firebase.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard firebaseReady else {
            let err = NSError(domain: "WetinDey", code: 1,
                              userInfo: [NSLocalizedDescriptionKey: "Firebase is not configured in this build"])
            NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: err)
            return
        }
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let error = error {
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
            } else if let token = token {
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}