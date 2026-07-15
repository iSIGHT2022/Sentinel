class SentinelAlert {
  final String id;
  final DateTime time;
  final String severity;
  final String alertType;
  final String category;
  final String zone;
  final String message;
  final bool acknowledged;
  final String? residentId;

  const SentinelAlert({
    required this.id,
    required this.time,
    required this.severity,
    required this.alertType,
    required this.category,
    required this.zone,
    required this.message,
    required this.acknowledged,
    this.residentId,
  });

  factory SentinelAlert.fromJson(Map<String, dynamic> j) => SentinelAlert(
        id: j['id'],
        time: DateTime.parse(j['time']),
        severity: j['severity'],
        alertType: j['alert_type'],
        category: j['category'],
        zone: j['zone'],
        message: j['message'],
        acknowledged: j['acknowledged'] ?? false,
        residentId: j['resident_id'],
      );

  String get severityEmoji {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '🔔';
      default: return 'ℹ️';
    }
  }
}
