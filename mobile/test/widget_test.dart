import 'dart:convert';
import 'dart:io';

import 'package:dor/api/api_client.dart';
import 'package:dor/api/models.dart';
import 'package:dor/deps.dart';
import 'package:dor/main.dart';
import 'package:dor/l10n/strings_ar.dart';
import 'package:dor/screens/operator_dashboard_screen.dart';
import 'package:dor/screens/ticket_screen.dart';
import 'package:dor/storage.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

http.Response j(Object body, [int status = 200]) => http.Response(
    jsonEncode(body), status,
    headers: {'content-type': 'application/json; charset=utf-8'});

Future<Deps> deps(MockClient c, {Map<String, Object> prefs = const {}}) async {
  SharedPreferences.setMockInitialValues(prefs);
  final s = await Storage.open();
  return Deps(
      ApiClient(
          baseUrl: 'http://x',
          client: c,
          maxRetries: 0,
          timeout: const Duration(seconds: 2)),
      s);
}

Widget wrap(Widget w) => MaterialApp(
    home: Directionality(textDirection: TextDirection.rtl, child: w));

void main() {
  test('error body is parsed into ApiException', () async {
    final api = ApiClient(
        baseUrl: 'http://x',
        client: MockClient((_) async => j({
              'error': {'code': 'not_found', 'message_ar': 'المحل غير موجود'}
            }, 404)));
    expect(
        () => api.getStore('abcd'),
        throwsA(isA<ApiException>()
            .having((e) => e.messageAr, 'msg', 'المحل غير موجود')
            .having((e) => e.status, 'status', 404)));
  });

  test('GET retries on network error then succeeds', () async {
    var calls = 0;
    final api = ApiClient(
        baseUrl: 'http://x',
        maxRetries: 2,
        client: MockClient((r) async {
          calls++;
          if (calls == 1) throw const SocketException('down');
          expect(r.url.path, '/api/v1/stores/ABCD');
          return j({'code': 'ABCD', 'name': 'مخبز', 'queues': []});
        }));
    final s = await api.getStore('abcd');
    expect(s.name, 'مخبز');
    expect(calls, 2);
  });

  test('ticket json roundtrip', () {
    final t = Ticket.fromJson({
      'token': 'tk',
      'number': 7,
      'status': 'waiting',
      'current_number': 3,
      'ahead': 2
    });
    final t2 = Ticket.fromJson(t.toJson());
    expect(t2.number, 7);
    expect(t2.ahead, 2);
  });

  testWidgets('home screen is RTL Arabic and opens store', (tester) async {
    final d = await deps(MockClient((r) async => j({
          'store': {'code': 'ABCD', 'name': 'مخبز الأمل'},
          'queues': [
            {'id': 1, 'name': 'خبز', 'open': true, 'current_number': 4, 'waiting': 9}
          ]
        })));
    await tester.pumpWidget(DorApp(deps: d));
    await tester.pumpAndSettle();
    expect(Directionality.of(tester.element(find.text(S.tagline))),
        TextDirection.rtl);
    await tester.enterText(find.byKey(const Key('codeField')), 'abcd');
    await tester.tap(find.byKey(const Key('findBtn')));
    await tester.pumpAndSettle();
    expect(find.text('مخبز الأمل'), findsOneWidget);
    expect(find.text('خبز'), findsOneWidget);
    expect(find.text(S.join), findsOneWidget);
  });

  testWidgets('ticket screen shows big number and near warning',
      (tester) async {
    final d = await deps(MockClient((r) async => j({
          'token': 'tk',
          'number': 42,
          'status': 'waiting',
          'current_number': 40,
          'ahead': 1,
          'est_wait_min': 3
        })));
    await tester.pumpWidget(wrap(TicketScreen(deps: d, token: 'tk')));
    await tester.pumpAndSettle();
    expect(find.text('42'), findsOneWidget);
    expect(find.text(S.nearWarning), findsOneWidget);
    expect(find.byKey(const Key('lastUpdate')), findsOneWidget);
    await tester.pumpWidget(const SizedBox()); // dispose timer
  });

  testWidgets('ticket screen falls back to cache when offline',
      (tester) async {
    final cached = Ticket(token: 'tk', number: 15, status: 'waiting', ahead: 8);
    final d = await deps(
        MockClient((r) async => throw const SocketException('offline')),
        prefs: {
          'ticket': jsonEncode({
            't': cached.toJson(),
            'at': DateTime(2026, 1, 1, 9, 5).millisecondsSinceEpoch
          })
        });
    await tester.pumpWidget(wrap(TicketScreen(deps: d, token: 'tk')));
    await tester.pumpAndSettle();
    expect(find.text('15'), findsOneWidget);
    expect(find.text(S.offline), findsOneWidget);
    expect(find.text('${S.lastUpdate}: 09:05'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('operator taps next → POST /queues/1/next', (tester) async {
    final posted = <String>[];
    final d = await deps(MockClient((r) async {
      if (r.method == 'POST') {
        posted.add(r.url.path);
        expect(r.headers['Authorization'], 'Bearer T');
        return j({'ok': true});
      }
      return j({
        'code': 'ABCD',
        'name': 'حلاق',
        'queues': [
          {'id': 1, 'name': 'قص', 'open': true, 'current_number': 2, 'waiting': 3}
        ]
      });
    }));
    d.api.token = 'T';
    await tester.pumpWidget(wrap(OperatorDashboardScreen(deps: d)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('next-1')));
    await tester.pumpAndSettle();
    expect(posted, ['/api/v1/operator/queues/1/next']);
  });
}
