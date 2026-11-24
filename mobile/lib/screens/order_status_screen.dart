import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../deps.dart';
import '../l10n/strings_ar.dart';
import '../theme.dart';
import '../widgets/common.dart';

class OrderStatusScreen extends StatefulWidget {
  final Deps deps;
  final String token;
  const OrderStatusScreen({super.key, required this.deps, required this.token});
  @override
  State<OrderStatusScreen> createState() => _OrderStatusScreenState();
}

class _OrderStatusScreenState extends State<OrderStatusScreen> {
  Order? _o;
  DateTime? _at;
  String? _error;
  int _failures = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _poll();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _poll() async {
    _timer?.cancel();
    try {
      final o = await widget.deps.api.getOrder(widget.token);
      _failures = 0;
      if (!o.active) await widget.deps.storage.setOrderToken(null);
      if (mounted) {
        setState(() {
          _o = o;
          _at = DateTime.now();
          _error = null;
        });
      }
      if (!o.active) return;
    } on ApiException catch (e) {
      _failures++;
      if (mounted) setState(() => _error = e.messageAr);
    }
    final secs = (30 * (1 << _failures.clamp(0, 4))).clamp(30, 300);
    if (mounted) _timer = Timer(Duration(seconds: secs), _poll);
  }

  @override
  Widget build(BuildContext context) {
    final o = _o;
    return Scaffold(
      appBar: AppBar(title: const Text(S.myOrder)),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (_error != null) ErrorBanner(_error!),
        if (o == null && _error == null)
          const Center(child: CircularProgressIndicator()),
        if (o != null) ...[
          BigNumber(
              label: S.orderNo, value: o.number, highlight: o.status == 'ready'),
          const SizedBox(height: 12),
          Text(S.orderStatus[o.status] ?? o.status,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 24, fontWeight: FontWeight.bold, color: kGreen)),
          const SizedBox(height: 12),
          for (final l in o.items) Text('${l.qty} × ${l.name}'),
          if (o.pickup.isNotEmpty) Text('${S.pickup}: ${o.pickup}'),
          const SizedBox(height: 12),
          if (_at != null)
            Text('${S.lastUpdate}: ${hhmm(_at!)}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.black54)),
          if (o.active)
            ElevatedButton(onPressed: _poll, child: const Text(S.refresh)),
        ],
      ]),
    );
  }
}
