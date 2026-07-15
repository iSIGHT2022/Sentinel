import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'services/api_service.dart';
import 'services/notification_service.dart';
import 'screens/home_screen.dart';

const _apiBase = String.fromEnvironment('API_URL', defaultValue: 'http://10.0.2.2:8000');

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await NotificationService.init();
  runApp(SentinelApp(api: ApiService(baseUrl: _apiBase)));
}

class SentinelApp extends StatelessWidget {
  final ApiService api;
  const SentinelApp({super.key, required this.api});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SENTINEL',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1A2B4A)),
        useMaterial3: true,
      ),
      home: HomeScreen(api: api),
      routes: {
        '/category': (ctx) => _CategoryScreen(api: api),
      },
    );
  }
}

class _CategoryScreen extends StatelessWidget {
  final ApiService api;
  const _CategoryScreen({required this.api});

  @override
  Widget build(BuildContext context) {
    final args = ModalRoute.of(context)!.settings.arguments as Map;
    final category = args['category'] as String;
    final alerts = args['alerts'] as List;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A2B4A),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(category.toUpperCase(),
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
      ),
      body: alerts.isEmpty
          ? const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('✅', style: TextStyle(fontSize: 40)),
                  SizedBox(height: 8),
                  Text('No active alerts in this category', style: TextStyle(color: Colors.grey)),
                ],
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: alerts.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final a = alerts[i];
                final sev = a.severity as String;
                final color = sev == 'critical'
                    ? Colors.red
                    : sev == 'high'
                        ? Colors.orange
                        : sev == 'medium'
                            ? Colors.amber
                            : Colors.blue;
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: color.withOpacity(0.4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(a.severityEmoji, style: const TextStyle(fontSize: 16)),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              a.message,
                              style: TextStyle(fontWeight: FontWeight.w600, color: color.shade900, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${(a.zone as String).replaceAll('_', ' ')} · ${sev.toUpperCase()}',
                        style: TextStyle(fontSize: 11, color: color.shade700),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
