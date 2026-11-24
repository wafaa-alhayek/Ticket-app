import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../deps.dart';
import '../l10n/strings_ar.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'operator_orders_screen.dart';

/// Operator: queues with big "next" button, skip, walk-in, toggle, reset.
class OperatorDashboardScreen extends StatefulWidget {
  final Deps deps;
  const OperatorDashboardScreen({super.key, required this.deps});
  @override
  State<OperatorDashboardScreen> createState() =>
      _OperatorDashboardScreenState();
}

class _OperatorDashboardScreenState extends State<OperatorDashboardScreen> {
  Store? _store;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final s = await widget.deps.api.me();
      if (mounted) {
        setState(() {
          _store = s;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (e.status == 401) return _logout();
      if (mounted) setState(() => _error = e.messageAr);
    }
  }

  Future<void> _logout() async {
    try {
      await widget.deps.api.logout();
    } on ApiException catch (_) {
      // token is cleared locally anyway
    }
    await widget.deps.storage.setOpToken(null);
    if (mounted) Navigator.pop(context);
  }

  Future<void> _act(Queue q, String action) async {
    if (action == 'reset' && !await confirm(context, S.confirmReset)) return;
    setState(() => _busy = true);
    try {
      final r = await widget.deps.api.queueAction(q.id, action);
      if (action == 'walkin' && mounted) {
        final n = r['number'] ?? (r['ticket'] is Map ? r['ticket']['number'] : null);
        await showDialog(
            context: context,
            builder: (c) => AlertDialog(
                  title: const Text(S.paperTicket),
                  content: Text('${n ?? '—'}',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontSize: 72, fontWeight: FontWeight.w900)),
                ));
      }
      await _load();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.messageAr);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _newQueue() async {
    final name = TextEditingController();
    final mins = TextEditingController(text: '3');
    final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
              title: const Text(S.newQueue),
              content: Column(mainAxisSize: MainAxisSize.min, children: [
                TextField(
                    controller: name,
                    decoration: const InputDecoration(labelText: S.queueName)),
                const SizedBox(height: 8),
                TextField(
                    controller: mins,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: S.serviceMinutes)),
              ]),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(c, true),
                    child: const Text(S.add))
              ],
            ));
    if (ok != true || name.text.trim().isEmpty) return;
    try {
      await widget.deps.api
          .createQueue(name.text.trim(), int.tryParse(mins.text) ?? 3);
      await _load();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.messageAr);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _store;
    return Scaffold(
      appBar: AppBar(
        title: Text(s == null ? S.queues : '${s.name} · ${s.code}'),
        actions: [
          IconButton(
              tooltip: S.orders,
              icon: const Icon(Icons.receipt_long),
              onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                      builder: (_) =>
                          OperatorOrdersScreen(deps: widget.deps)))),
          IconButton(
              tooltip: S.logout,
              icon: const Icon(Icons.logout),
              onPressed: _logout),
        ],
      ),
      floatingActionButton: FloatingActionButton(
          tooltip: S.newQueue,
          backgroundColor: kAccent,
          onPressed: _newQueue,
          child: const Icon(Icons.add)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(12), children: [
          if (_error != null) ErrorBanner(_error!),
          if (s == null && _error == null)
            const Center(child: CircularProgressIndicator()),
          if (s != null)
            for (final q in s.queues) _queueCard(q),
        ]),
      ),
    );
  }

  Widget _queueCard(Queue q) => Card(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Text('${q.name}${q.open ? '' : ' (${S.closed})'}',
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            BigNumber(label: S.nowServing, value: q.current),
            Text('${S.waiting}: ${q.waiting}', textAlign: TextAlign.center),
            const SizedBox(height: 8),
            ElevatedButton(
                key: Key('next-${q.id}'),
                style: ElevatedButton.styleFrom(minimumSize: const Size(64, 72)),
                onPressed: _busy ? null : () => _act(q, 'next'),
                child: const Text(S.callNext, style: TextStyle(fontSize: 26))),
            const SizedBox(height: 8),
            Wrap(spacing: 8, runSpacing: 8, alignment: WrapAlignment.center, children: [
              OutlinedButton(
                  onPressed: _busy ? null : () => _act(q, 'skip'),
                  child: const Text(S.skip)),
              OutlinedButton(
                  onPressed: _busy ? null : () => _act(q, 'walkin'),
                  child: const Text(S.walkin)),
              OutlinedButton(
                  onPressed: _busy ? null : () => _act(q, 'toggle'),
                  child: const Text(S.openClose)),
              OutlinedButton(
                  onPressed: _busy ? null : () => _act(q, 'reset'),
                  child: const Text(S.reset)),
            ]),
          ]),
        ),
      );
}
