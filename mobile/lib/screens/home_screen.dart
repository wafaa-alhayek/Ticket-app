import 'package:flutter/material.dart';

import '../deps.dart';
import '../l10n/strings_ar.dart';
import '../theme.dart';
import 'operator_login_screen.dart';
import 'order_status_screen.dart';
import 'store_screen.dart';
import 'ticket_screen.dart';

class HomeScreen extends StatefulWidget {
  final Deps deps;
  const HomeScreen({super.key, required this.deps});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _code = TextEditingController();

  void _find() {
    final c = _code.text.trim().toUpperCase();
    if (c.length != 4) return;
    Navigator.push(
        context,
        MaterialPageRoute(
            builder: (_) => StoreScreen(deps: widget.deps, code: c)));
  }

  Future<void> _settings() async {
    final ctl = TextEditingController(text: widget.deps.storage.serverUrl);
    final v = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text(S.serverUrl),
        content: TextField(
            controller: ctl,
            keyboardType: TextInputType.url,
            textDirection: TextDirection.ltr),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, ctl.text),
              child: const Text(S.save))
        ],
      ),
    );
    if (v != null && v.trim().isNotEmpty) {
      await widget.deps.storage.setServerUrl(v);
      widget.deps.api.baseUrl = v.trim();
    }
  }

  @override
  Widget build(BuildContext context) {
    final cached = widget.deps.storage.cachedTicket;
    final orderToken = widget.deps.storage.orderToken;
    return Scaffold(
      appBar: AppBar(
        title: const Text(S.appName,
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
        actions: [
          IconButton(
              tooltip: S.settings,
              icon: const Icon(Icons.settings),
              onPressed: _settings),
        ],
      ),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        const Text(S.tagline,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 18, color: kGreen)),
        const SizedBox(height: 24),
        if (cached != null && cached.$1.active) ...[
          ElevatedButton.icon(
            key: const Key('myTicket'),
            style: ElevatedButton.styleFrom(
                backgroundColor: kAccent, foregroundColor: kGreen),
            icon: const Icon(Icons.confirmation_number),
            label: Text('${S.myTicket}: ${cached.$1.number}'),
            onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => TicketScreen(
                        deps: widget.deps, token: cached.$1.token))).then(
                (_) => setState(() {})),
          ),
          const SizedBox(height: 16),
        ],
        if (orderToken != null) ...[
          OutlinedButton.icon(
            icon: const Icon(Icons.receipt_long),
            label: const Text(S.myOrder),
            onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                    builder: (_) => OrderStatusScreen(
                        deps: widget.deps, token: orderToken))),
          ),
          const SizedBox(height: 16),
        ],
        TextField(
          key: const Key('codeField'),
          controller: _code,
          maxLength: 4,
          textCapitalization: TextCapitalization.characters,
          textAlign: TextAlign.center,
          textDirection: TextDirection.ltr,
          style: const TextStyle(fontSize: 32, letterSpacing: 8),
          decoration: const InputDecoration(labelText: S.storeCode),
          onSubmitted: (_) => _find(),
        ),
        const SizedBox(height: 12),
        ElevatedButton(
            key: const Key('findBtn'),
            onPressed: _find,
            child: const Text(S.find)),
        const SizedBox(height: 40),
        TextButton.icon(
          icon: const Icon(Icons.storefront),
          label: const Text(S.iAmOperator),
          onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                  builder: (_) => OperatorLoginScreen(deps: widget.deps))),
        ),
      ]),
    );
  }
}
