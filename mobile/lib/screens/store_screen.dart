import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../deps.dart';
import '../l10n/strings_ar.dart';
import '../widgets/common.dart';
import 'preorder_screen.dart';
import 'ticket_screen.dart';

/// Store page: list its queues and join one.
class StoreScreen extends StatefulWidget {
  final Deps deps;
  final String code;
  const StoreScreen({super.key, required this.deps, required this.code});
  @override
  State<StoreScreen> createState() => _StoreScreenState();
}

class _StoreScreenState extends State<StoreScreen> {
  Store? _store;
  String? _error;
  bool _busy = false;
  final _name = TextEditingController();
  final _phone = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final s = await widget.deps.api.getStore(widget.code);
      if (mounted) setState(() => _store = s);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.messageAr);
    }
  }

  Future<void> _join(Queue q) async {
    setState(() => _busy = true);
    try {
      final (t, existing) = await widget.deps.api.join(widget.code, q.id,
          name: _name.text.trim(), phone: _phone.text.trim());
      await widget.deps.storage.cacheTicket(t, DateTime.now());
      if (!mounted) return;
      if (existing) showSnack(context, S.existingTicket);
      Navigator.pushReplacement(
          context,
          MaterialPageRoute(
              builder: (_) =>
                  TicketScreen(deps: widget.deps, token: t.token)));
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.messageAr);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = _store;
    return Scaffold(
      appBar: AppBar(title: Text(s?.name ?? widget.code)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (_error != null) ErrorBanner(_error!),
          if (s == null && _error == null)
            const Center(child: CircularProgressIndicator()),
          if (s != null) ...[
            if (s.area.isNotEmpty)
              Text(s.area, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: S.nameOptional)),
            const SizedBox(height: 8),
            TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                textDirection: TextDirection.ltr,
                decoration:
                    const InputDecoration(labelText: S.phoneOptional)),
            const SizedBox(height: 16),
            for (final q in s.queues)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(q.name,
                            style: const TextStyle(
                                fontSize: 20, fontWeight: FontWeight.bold)),
                        Text('${S.nowServing}: ${q.current > 0 ? q.current : '—'}'
                            ' · ${S.waiting}: ${q.waiting}'
                            ' · ${S.estWait}: ${q.estMinutes} ${S.minutes}'),
                        const SizedBox(height: 8),
                        q.open
                            ? ElevatedButton(
                                onPressed: _busy ? null : () => _join(q),
                                child: const Text(S.join))
                            : const Text(S.closed,
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.red)),
                      ]),
                ),
              ),
            if (s.preorders) ...[
              const SizedBox(height: 12),
              OutlinedButton.icon(
                icon: const Icon(Icons.shopping_basket),
                label: const Text(S.preorder),
                onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => PreorderScreen(
                            deps: widget.deps, code: widget.code))),
              ),
            ],
          ],
        ]),
      ),
    );
  }
}
