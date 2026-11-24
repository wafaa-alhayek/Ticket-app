import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../deps.dart';
import '../l10n/strings_ar.dart';
import '../widgets/common.dart';

/// Operator: active pre-orders with status buttons, plus simple menu editor.
class OperatorOrdersScreen extends StatefulWidget {
  final Deps deps;
  const OperatorOrdersScreen({super.key, required this.deps});
  @override
  State<OperatorOrdersScreen> createState() => _OperatorOrdersScreenState();
}

class _OperatorOrdersScreenState extends State<OperatorOrdersScreen> {
  List<Order>? _orders;
  List<MenuItem>? _menu;
  String? _error;
  bool _ordersOn = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final o = await widget.deps.api.listOrders();
      final m = await widget.deps.api.operatorMenu();
      final st = await widget.deps.api.me();
      if (mounted) {
        setState(() {
          _orders = o.where((x) => x.active).toList();
          _menu = m;
          _ordersOn = st.preorders;
          _error = null;
        });
      }
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.messageAr);
    }
  }

  Future<void> _run(Future<void> Function() f) async {
    try {
      await f();
      await _load();
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.messageAr);
    }
  }

  Future<void> _addItem() async {
    final n = TextEditingController();
    final p = TextEditingController();
    final ok = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
              content: Column(mainAxisSize: MainAxisSize.min, children: [
                TextField(
                    controller: n,
                    decoration: const InputDecoration(labelText: S.itemName)),
                const SizedBox(height: 8),
                TextField(
                    controller: p,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: S.price)),
              ]),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(c, true),
                    child: const Text(S.add))
              ],
            ));
    if (ok == true && n.text.trim().isNotEmpty) {
      await _run(() => widget.deps.api
          .addMenuItem(n.text.trim(), p.text.trim()));
    }
  }

  @override
  Widget build(BuildContext context) {
    final os = _orders;
    final api = widget.deps.api;
    return Scaffold(
      appBar: AppBar(title: const Text(S.orders)),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(12), children: [
          if (_error != null) ErrorBanner(_error!),
          if (os == null && _error == null)
            const Center(child: CircularProgressIndicator()),
          if (os != null && os.isEmpty)
            const Padding(
                padding: EdgeInsets.all(24),
                child: Text(S.noOrders, textAlign: TextAlign.center)),
          if (os != null)
            for (final o in os)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                            '${S.orderNo} ${o.number} · ${S.orderStatus[o.status] ?? o.status}',
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold)),
                        if (o.name.isNotEmpty || o.pickup.isNotEmpty)
                          Text('${o.name} ${o.pickup}'),
                        for (final l in o.items) Text('${l.qty} × ${l.name}'),
                        if (o.note.isNotEmpty)
                          Text(o.note,
                              style: const TextStyle(color: Color(0xFF5C5648))),
                        Wrap(spacing: 8, children: [
                          if (o.status == 'new')
                            OutlinedButton(
                                onPressed: () => _run(() =>
                                    api.setOrderStatus(o.id, 'preparing')),
                                child: const Text(S.prepare)),
                          if (o.status != 'ready')
                            ElevatedButton(
                                onPressed: () =>
                                    _run(() => api.setOrderStatus(o.id, 'ready')),
                                child: const Text(S.ready)),
                          if (o.status == 'ready')
                            ElevatedButton(
                                onPressed: () => _run(
                                    () => api.setOrderStatus(o.id, 'picked')),
                                child: const Text(S.picked)),
                          TextButton(
                              onPressed: () => _run(() =>
                                  api.setOrderStatus(o.id, 'cancelled')),
                              child: const Text(S.cancel)),
                        ]),
                      ]),
                ),
              ),
          if (_menu != null) ...[
            const Divider(height: 32),
            Row(children: [
              const Expanded(
                  child: Text(S.preorder,
                      style: TextStyle(
                          fontSize: 18, fontWeight: FontWeight.bold))),
              IconButton(
                  tooltip: S.add,
                  icon: const Icon(Icons.add),
                  onPressed: _addItem),
            ]),
            SwitchListTile(
                title: const Text(S.ordersEnabled),
                value: _ordersOn,
                onChanged: (v) {
                  setState(() => _ordersOn = v);
                  _run(() => api.setOrdersEnabled(v));
                }),
            for (final it in _menu!)
              ListTile(
                title: Text(it.name),
                subtitle: Text(it.available ? it.price : S.unavailable),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  Semantics(
                      label: '${S.available} ${it.name}',
                      child: Switch(
                          value: it.available,
                          onChanged: (_) =>
                              _run(() => api.toggleMenuItem(it.id)))),
                  IconButton(
                      tooltip: '${S.delete} ${it.name}',
                      icon: const Icon(Icons.delete_outline),
                      onPressed: () => _run(() => api.deleteMenuItem(it.id))),
                ]),
              ),
          ],
        ]),
      ),
    );
  }
}
