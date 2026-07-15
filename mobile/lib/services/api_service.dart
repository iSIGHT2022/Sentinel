import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/alert.dart';

class ApiService {
  final String baseUrl;
  ApiService({required this.baseUrl});

  Future<List<SentinelAlert>> fetchAlerts({String? residentId}) async {
    final uri = Uri.parse('$baseUrl/alerts').replace(queryParameters: {
      'resolved': 'false',
      'limit': '50',
      if (residentId != null) 'resident_id': residentId,
    });
    final res = await http.get(uri);
    if (res.statusCode != 200) throw Exception('Failed to load alerts');
    final List data = jsonDecode(res.body);
    return data.map((j) => SentinelAlert.fromJson(j)).toList();
  }

  Future<List<Map<String, dynamic>>> fetchTimeline(String residentId) async {
    final uri = Uri.parse('$baseUrl/residents/$residentId/timeline');
    final res = await http.get(uri);
    if (res.statusCode != 200) throw Exception('Failed to load timeline');
    final List data = jsonDecode(res.body);
    return data.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> fetchDigest(String residentId) async {
    final uri = Uri.parse('$baseUrl/residents/$residentId/digest');
    final res = await http.get(uri);
    if (res.statusCode != 200) throw Exception('Failed to load digest');
    final List data = jsonDecode(res.body);
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> fetchResidentStatus(String residentId) async {
    final uri = Uri.parse('$baseUrl/residents/$residentId/status');
    final res = await http.get(uri);
    if (res.statusCode != 200) throw Exception('Failed to load status');
    return jsonDecode(res.body);
  }
}
