import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/alert.dart';
import '../services/api_service.dart';

const _categories = {
  'emergency': ('🚨', 'Emergency', Color(0xFFFEF2F2), Color(0xFFDC2626)),
  'activity': ('🚶', 'Activity & Posture', Color(0xFFEFF6FF), Color(0xFF1D4ED8)),
  'bathroom': ('🚪', 'Bathroom', Color(0xFFF5F3FF), Color(0xFF7C3AED)),
  'dining': ('🍽️', 'Dining & Meals', Color(0xFFFFF7ED), Color(0xFFEA580C)),
  'behaviour': ('🧠', 'Behaviour', Color(0xFFFEFCE8), Color(0xFFCA8A04)),
  'social': ('👥', 'Social & Wellbeing', Color(0xFFF0FDF4), Color(0xFF16A34A)),
  'room': ('🏠', 'Room Presence', Color(0xFFF8FAFC), Color(0xFF475569)),
};

class HomeScreen extends StatefulWidget {
  final ApiService api;
  const HomeScreen({super.key, required this.api});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<SentinelAlert> _alerts = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      _alerts = await widget.api.fetchAlerts();
    } finally {
      setState(() => _loading = false);
    }
  }

  Map<String, int> get _countByCategory {
    final counts = <String, int>{};
    for (final a in _alerts) {
      counts[a.category] = (counts[a.category] ?? 0) + 1;
    }
    return counts;
  }

  @override
  Widget build(BuildContext context) {
    final counts = _countByCategory;
    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A2B4A),
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('SENTINEL', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
            Text('Family View', style: TextStyle(color: Color(0xFF93C5FD), fontSize: 11)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: Colors.white),
            onPressed: _load,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // Open alerts count
                  if (_alerts.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFFCA5A5)),
                      ),
                      child: Text(
                        '${_alerts.length} open alert${_alerts.length != 1 ? 's' : ''} require attention',
                        style: const TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w600),
                      ),
                    ),

                  // Category grid
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.2,
                    children: _categories.entries.map((entry) {
                      final (emoji, label, bg, color) = entry.value;
                      final count = counts[entry.key] ?? 0;
                      return _CategoryCard(
                        emoji: emoji,
                        label: label,
                        alertCount: count,
                        bg: bg,
                        color: color,
                        onTap: () => Navigator.pushNamed(
                          context,
                          '/category',
                          arguments: {
                            'category': entry.key,
                            'alerts': _alerts.where((a) => a.category == entry.key).toList(),
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  final String emoji, label;
  final int alertCount;
  final Color bg, color;
  final VoidCallback onTap;

  const _CategoryCard({
    required this.emoji, required this.label, required this.alertCount,
    required this.bg, required this.color, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: alertCount > 0 ? color : color.withOpacity(0.3), width: alertCount > 0 ? 2 : 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(emoji, style: const TextStyle(fontSize: 22)),
                if (alertCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
                    child: Text('$alertCount', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                  ),
              ],
            ),
            const Spacer(),
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13)),
            Text('Tap to view →', style: TextStyle(color: color.withOpacity(0.6), fontSize: 11)),
          ],
        ),
      ),
    );
  }
}
