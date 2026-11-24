import 'dart:async';
import 'dart:convert';
import 'dart:io' show SocketException;

import 'package:http/http.dart' as http;

import '../l10n/strings_ar.dart';
import 'models.dart';

/// Error with an Arabic message ready to show the user.
class ApiException implements Exception {
  final String code;
  final String messageAr;
  final int status; // 0 = network/timeout
  ApiException(this.code, this.messageAr, [this.status = 0]);
  bool get isNetwork => status == 0;
  @override
  String toString() => 'ApiException($code, $status): $messageAr';
}

/// Thin client for /api/v1. Timeouts + retry with backoff on idempotent
/// requests (GET) and on network failures before the request reached the
/// server. All endpoint paths are in this file only.
class ApiClient {
  String baseUrl; // e.g. http://192.168.1.10:3000
  String? token; // operator bearer token
  final http.Client _http;
  final Duration timeout;
  final int maxRetries;

  ApiClient({
    required this.baseUrl,
    this.token,
    http.Client? client,
    this.timeout = const Duration(seconds: 15),
    this.maxRetries = 2,
  }) : _http = client ?? http.Client();

  Uri _uri(String path) {
    final b = baseUrl.endsWith('/')
        ? baseUrl.substring(0, baseUrl.length - 1)
        : baseUrl;
    return Uri.parse('$b/api/v1$path');
  }

  Future<dynamic> _send(String method, String path,
      {Map<String, dynamic>? body}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (body != null) headers['Content-Type'] = 'application/json';
    if (token != null) headers['Authorization'] = 'Bearer $token';
    final retries = method == 'GET' ? maxRetries : 0;

    for (var attempt = 0;; attempt++) {
      try {
        final req = http.Request(method, _uri(path))..headers.addAll(headers);
        if (body != null) req.body = jsonEncode(body);
        final streamed = await _http.send(req).timeout(timeout);
        final res = await http.Response.fromStream(streamed).timeout(timeout);
        return _decode(res);
      } on TimeoutException {
        if (attempt >= retries) {
          throw ApiException('timeout', S.timeoutError);
        }
      } on SocketException {
        if (attempt >= retries) {
          throw ApiException('network', S.networkError);
        }
      } on http.ClientException {
        if (attempt >= retries) {
          throw ApiException('network', S.networkError);
        }
      }
      await Future.delayed(Duration(milliseconds: 800 * (1 << attempt)));
    }
  }

  dynamic _decode(http.Response res) {
    dynamic data;
    try {
      data = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      data = null;
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return data;
    final err = (data is Map && data['error'] is Map) ? data['error'] : {};
    throw ApiException(
      '${err['code'] ?? 'http_${res.statusCode}'}',
      '${err['message_ar'] ?? S.unknownError}',
      res.statusCode,
    );
  }

  Map<String, dynamic> _map(dynamic d) =>
      d is Map ? Map<String, dynamic>.from(d) : <String, dynamic>{};

  List _list(dynamic d, String key) =>
      d is List ? d : (d is Map && d[key] is List ? d[key] : const []);

  // ---------- public ----------
  Future<Store> getStore(String code) async =>
      Store.fromJson(_map(await _send('GET', '/stores/${code.toUpperCase()}')));

  /// Returns the ticket and whether it was an already-active ticket for
  /// this phone (`existing: true`, HTTP 200) rather than a new one (201).
  Future<(Ticket, bool)> join(String code, int queueId,
      {String name = '', String phone = ''}) async {
    final d = _map(await _send('POST', '/stores/${code.toUpperCase()}/join',
        body: {'queue_id': queueId, 'name': name, 'phone': phone}));
    return (Ticket.fromJson(d), d['existing'] == true);
  }

  Future<Ticket> getTicket(String token) async =>
      Ticket.fromJson(_map(await _send('GET', '/tickets/$token')));

  Future<Ticket> cancelTicket(String token) async =>
      Ticket.fromJson(_map(await _send('POST', '/tickets/$token/cancel')));

  Future<List<MenuItem>> getMenu(String code) async =>
      _list(await _send('GET', '/stores/${code.toUpperCase()}/menu'), 'items')
          .map((e) => MenuItem.fromJson(Map<String, dynamic>.from(e)))
          .toList();

  Future<Order> placeOrder(String code,
          {required Map<int, int> items,
          String name = '',
          String phone = '',
          String note = '',
          String pickup = ''}) async =>
      Order.fromJson(_map(await _send(
          'POST', '/stores/${code.toUpperCase()}/orders',
          body: {
            'items': items.entries
                .map((e) => {'id': e.key, 'qty': e.value})
                .toList(),
            'name': name,
            'phone': phone,
            'note': note,
            'pickup': pickup,
          })));

  Future<Order> getOrder(String token) async =>
      Order.fromJson(_map(await _send('GET', '/orders/$token')));

  // ---------- operator ----------
  Future<String> login(String username, String password) async {
    final d = _map(await _send('POST', '/operator/login',
        body: {'username': username, 'password': password}));
    token = '${d['token']}';
    return token!;
  }

  Future<String> register(
      {required String name,
      String area = '',
      required String username,
      required String password}) async {
    final d = _map(await _send('POST', '/operator/register', body: {
      'name': name,
      'area': area,
      'username': username,
      'password': password
    }));
    token = '${d['token']}';
    return token!;
  }

  Future<void> logout() async {
    try {
      await _send('POST', '/operator/logout');
    } finally {
      token = null;
    }
  }

  /// GET /operator/me → the operator's store (with queues).
  Future<Store> me() async =>
      Store.fromJson(_map(await _send('GET', '/operator/me')));

  Future<void> createQueue(String name, num avgMinutes) =>
      _send('POST', '/operator/queues',
          body: {'name': name, 'avg_minutes': avgMinutes});

  /// action: next | skip | walkin | toggle | reset. Returns raw JSON (walkin
  /// returns the paper ticket number).
  Future<Map<String, dynamic>> queueAction(int queueId, String action) async =>
      _map(await _send('POST', '/operator/queues/$queueId/$action'));

  Future<List<Order>> listOrders() async =>
      _list(await _send('GET', '/operator/orders'), 'orders')
          .map((e) => Order.fromJson(Map<String, dynamic>.from(e)))
          .toList();

  Future<void> setOrderStatus(int id, String status) =>
      _send('POST', '/operator/orders/$id/status', body: {'status': status});

  /// No dedicated GET for the operator menu: it comes in /operator/me.
  Future<List<MenuItem>> operatorMenu() async =>
      _list(await _send('GET', '/operator/me'), 'menu')
          .map((e) => MenuItem.fromJson(Map<String, dynamic>.from(e)))
          .toList();

  Future<void> addMenuItem(String name, String price) =>
      _send('POST', '/operator/menu', body: {'name': name, 'price': price});

  Future<void> toggleMenuItem(int id) =>
      _send('POST', '/operator/menu/$id/toggle');

  Future<void> deleteMenuItem(int id) =>
      _send('POST', '/operator/menu/$id/delete');

  Future<void> setOrdersEnabled(bool on) =>
      _send('POST', '/operator/settings', body: {'orders_enabled': on});
}
