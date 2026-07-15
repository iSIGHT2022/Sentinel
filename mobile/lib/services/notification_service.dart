import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final _localNotif = FlutterLocalNotificationsPlugin();
  static const _channel = AndroidNotificationChannel(
    'sentinel_alerts',
    'SENTINEL Alerts',
    description: 'Critical resident monitoring alerts',
    importance: Importance.max,
  );

  static Future<void> init() async {
    await Firebase.initializeApp();
    await _localNotif.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
    await _localNotif
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(_channel);

    FirebaseMessaging.onMessage.listen(_showLocalNotification);
    FirebaseMessaging.onBackgroundMessage(_backgroundHandler);
  }

  static Future<void> _showLocalNotification(RemoteMessage msg) async {
    final notif = msg.notification;
    if (notif == null) return;
    await _localNotif.show(
      notif.hashCode,
      notif.title,
      notif.body,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          importance: Importance.max,
          priority: Priority.max,
        ),
      ),
    );
  }

  static Future<String?> getToken() => FirebaseMessaging.instance.getToken();
}

@pragma('vm:entry-point')
Future<void> _backgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}
