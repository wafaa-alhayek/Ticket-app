import 'dart:async';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../deps.dart';
import '../l10n/strings_ar.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Ticket view. Polls every 30 s; on failure backs off (60, 120, max 300 s)
/// and shows the cached ticket with its "last updated" time.
class TicketScreen extends StatefulWidget {
  final Deps deps;
  final String token;
  final Duration basePoll;
  const TicketScreen(
      {super.key,
      required this.deps,
      required this.token,
      this.basePoll = const Duration(seconds: 30)});
  @override
  State<TicketScreen> createState() => _TicketScreenState();
}

class _TicketScreenState extends State<TicketScreen> {
  Ticket? _t;
  DateTime? _at;
  bool _offline = false;
  int _failures = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    final c = widget.deps.storage.cachedTicket;
    if (c != null && c.$1.token == widget.token) {
      _t = c.$1;
      _at = c.$2;
    }
    _poll();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Duration get _nextDelay {
    if (_failures == 0) return widget.basePoll;
    final s = widget.basePoll.inSeconds * (1 << _failures.clamp(0, 4));
    return Duration(seconds: s.clamp(1, 300));
  }

  Future<void> _poll() async {
    _timer?.cancel();
    try {
      final t = await widget.deps.api.getTicket(widget.token);
      final now = DateTime.now();
      await widget.deps.storage.cacheTicket(t, now);
      _failures = 0;
      if (mounted) {
        setState(() {
          _t = t;
          _at = now;
          _offline = false;
        });
      }
      if (!t.active) return; // stop polling finished tickets
    } on ApiException catch (e) {
      _failures++;
      if (mounted) {
        setState(() => _offline = e.isNetwork);
        if (!e.isNetwork) showSnack(context, e.messageAr);
      }
    }
    if (mounted) _timer = Timer(_nextDelay, _poll);
  }

  Future<void> _cancel() async {
    if (!await confirm(context, S.confirmCancel)) return;
    try {
      final t = await widget.deps.api.cancelTicket(widget.token);
      await widget.deps.storage.cacheTicket(t, DateTime.now());
      if (mounted) setState(() => _t = t);
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.messageAr);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = _t;
    return Scaffold(
      appBar: AppBar(title: Text(t?.storeName.isNotEmpty == true ? t!.storeName : S.myTicket)),
      body: t == null
          ? Center(
              child: _offline
                  ? const Text(S.networkError)
                  : const CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(16), children: [
              if (_offline) const ErrorBanner(S.offline),
              if (t.queueName.isNotEmpty)
                Text(t.queueName,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 18)),
              const SizedBox(height: 8),
              BigNumber(
                  key: const Key('myNumber'),
                  label: S.yourNumber,
                  value: t.number,
                  highlight: t.status == 'called'),
              const SizedBox(height: 12),
              Text(S.ticketStatus[t.status] ?? t.status,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: kGreen)),
              if (t.status == 'called') _notice(S.calledNotice),
              if (t.status == 'waiting') ...[
                if (t.ahead <= 3) _notice(S.nearWarning),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                      child: BigNumber(label: S.nowServing, value: t.current)),
                  const SizedBox(width: 8),
                  Expanded(
                      child: Column(children: [
                    Text('${S.ahead}: ${t.ahead} ${S.people}',
                        style: const TextStyle(fontSize: 20)),
                    Text('${S.estWait}: ${t.estMinutes} ${S.minutes}'),
                  ])),
                ]),
              ],
              const SizedBox(height: 16),
              if (_at != null)
                Text('${S.lastUpdate}: ${hhmm(_at!)}',
                    key: const Key('lastUpdate'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.black54)),
              const SizedBox(height: 12),
              if (t.active) ...[
                ElevatedButton(onPressed: _poll, child: const Text(S.refresh)),
                const SizedBox(height: 8),
                if (t.status == 'waiting')
                  OutlinedButton(
                      onPressed: _cancel, child: const Text(S.cancelTicket)),
              ],
            ]),
    );
  }

  Widget _notice(String s) => Container(
        margin: const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
            color: kAccent, borderRadius: BorderRadius.circular(8)),
        child: Text(s,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
      );
}
