import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../api/models.dart';
import '../deps.dart';
import '../l10n/strings_ar.dart';
import '../widgets/common.dart';
import 'order_status_screen.dart';

class PreorderScreen extends StatefulWidget {
  final Deps deps;
  final String code;
  const PreorderScreen({super.key, required this.deps, required this.code});
  @override
  State<PreorderScreen> createState() => _PreorderScreenState();
}

class _PreorderScreenState extends State<PreorderScreen> {
  List<MenuItem>? _menu;
  String? _error;
  final Map<int, int> _qty = {};
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _note = TextEditingController();
  final _pickup = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final m = await widget.deps.api.getMenu(widget.code);
      if (mounted) setState(() => _menu = m);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.messageAr);
    }
  }

  Future<void> _send() async {
    final items = Map<int, int>.from(_qty)..removeWhere((_, v) => v <= 0);
    if (items.isEmpty) return showSnack(context, S.emptyCart);
    setState(() => _busy = true);
    try {
      final o = await widget.deps.api.placeOrder(widget.code,
          items: items,
          name: _name.text.trim(),
          phone: _phone.text.trim(),
          note: _note.text.trim(),
          pickup: _pickup.text.trim());
      await widget.deps.storage.setOrderToken(o.token);
      if (!mounted) return;
      Navigator.pushReplacement(
          context,
          MaterialPageRoute(
              builder: (_) =>
                  OrderStatusScreen(deps: widget.deps, token: o.token)));
    } on ApiException catch (e) {
      if (mounted) showSnack(context, e.messageAr);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final m = _menu;
    return Scaffold(
      appBar: AppBar(title: const Text(S.preorder)),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        if (_error != null) ErrorBanner(_error!),
        if (m == null && _error == null)
          const Center(child: CircularProgressIndicator()),
        if (m != null)
          for (final it in m)
            ListTile(
              title: Text(it.name),
              subtitle: Text(it.available ? it.price : S.unavailable),
              trailing: it.available
                  ? Row(mainAxisSize: MainAxisSize.min, children: [
                      IconButton(
                          icon: const Icon(Icons.remove),
                          onPressed: () => setState(() =>
                              _qty[it.id] = ((_qty[it.id] ?? 0) - 1).clamp(0, 99))),
                      Text('${_qty[it.id] ?? 0}',
                          style: const TextStyle(fontSize: 18)),
                      IconButton(
                          icon: const Icon(Icons.add),
                          onPressed: () => setState(() =>
                              _qty[it.id] = ((_qty[it.id] ?? 0) + 1).clamp(0, 99))),
                    ])
                  : null,
            ),
        const SizedBox(height: 12),
        TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: S.nameOptional)),
        const SizedBox(height: 8),
        TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            textDirection: TextDirection.ltr,
            decoration: const InputDecoration(labelText: S.phoneOptional)),
        const SizedBox(height: 8),
        TextField(
            controller: _pickup,
            decoration: const InputDecoration(labelText: S.pickup)),
        const SizedBox(height: 8),
        TextField(
            controller: _note,
            maxLines: 2,
            decoration: const InputDecoration(labelText: S.note)),
        const SizedBox(height: 16),
        ElevatedButton(
            onPressed: _busy ? null : _send, child: const Text(S.sendOrder)),
      ]),
    );
  }
}
