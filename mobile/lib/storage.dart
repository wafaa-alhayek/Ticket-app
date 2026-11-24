import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import 'api/models.dart';

/// Small persistent store: server URL, operator token, last ticket (offline
/// cache), last order token.
class Storage {
  final SharedPreferences _p;
  Storage(this._p);

  static Future<Storage> open() async =>
      Storage(await SharedPreferences.getInstance());

  static const defaultServer = 'http://192.168.1.10:3000';

  String get serverUrl => _p.getString('server') ?? defaultServer;
  Future<void> setServerUrl(String v) => _p.setString('server', v.trim());

  String? get opToken => _p.getString('op_token');
  Future<void> setOpToken(String? v) =>
      v == null ? _p.remove('op_token') : _p.setString('op_token', v);

  /// Cached ticket + time it was fetched.
  (Ticket, DateTime)? get cachedTicket {
    final s = _p.getString('ticket');
    if (s == null) return null;
    try {
      final j = jsonDecode(s) as Map<String, dynamic>;
      return (
        Ticket.fromJson(Map<String, dynamic>.from(j['t'])),
        DateTime.fromMillisecondsSinceEpoch(j['at'] as int)
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> cacheTicket(Ticket t, DateTime at) => _p.setString(
      'ticket', jsonEncode({'t': t.toJson(), 'at': at.millisecondsSinceEpoch}));

  Future<void> clearTicket() => _p.remove('ticket');

  String? get orderToken => _p.getString('order');
  Future<void> setOrderToken(String? v) =>
      v == null ? _p.remove('order') : _p.setString('order', v);
}
