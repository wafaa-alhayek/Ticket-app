import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../deps.dart';
import '../l10n/strings_ar.dart';
import '../widgets/common.dart';
import 'operator_dashboard_screen.dart';

class OperatorLoginScreen extends StatefulWidget {
  final Deps deps;
  const OperatorLoginScreen({super.key, required this.deps});
  @override
  State<OperatorLoginScreen> createState() => _OperatorLoginScreenState();
}

class _OperatorLoginScreenState extends State<OperatorLoginScreen> {
  final _u = TextEditingController();
  final _p = TextEditingController();
  final _name = TextEditingController();
  final _area = TextEditingController();
  bool _register = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Already logged in → go straight to the dashboard.
    if (widget.deps.api.token != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _open());
    }
  }

  void _open() => Navigator.pushReplacement(
      context,
      MaterialPageRoute(
          builder: (_) => OperatorDashboardScreen(deps: widget.deps)));

  Future<void> _login() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final api = widget.deps.api;
      final t = _register
          ? await api.register(
              name: _name.text.trim(),
              area: _area.text.trim(),
              username: _u.text.trim().toLowerCase(),
              password: _p.text)
          : await api.login(_u.text.trim(), _p.text);
      await widget.deps.storage.setOpToken(t);
      if (mounted) _open();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e.messageAr);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(_register ? S.register : S.login)),
        body: ListView(padding: const EdgeInsets.all(20), children: [
          if (_error != null) ErrorBanner(_error!),
          if (_register) ...[
            TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: S.storeName)),
            const SizedBox(height: 12),
            TextField(
                controller: _area,
                decoration: const InputDecoration(labelText: S.area)),
            const SizedBox(height: 12),
          ],
          TextField(
              key: const Key('user'),
              controller: _u,
              textDirection: TextDirection.ltr,
              decoration: const InputDecoration(labelText: S.username)),
          const SizedBox(height: 12),
          TextField(
              key: const Key('pass'),
              controller: _p,
              obscureText: true,
              textDirection: TextDirection.ltr,
              decoration: const InputDecoration(labelText: S.password),
              onSubmitted: (_) => _login()),
          const SizedBox(height: 16),
          ElevatedButton(
              key: const Key('loginBtn'),
              onPressed: _busy ? null : _login,
              child: Text(_register ? S.register : S.login)),
          TextButton(
              onPressed: () => setState(() => _register = !_register),
              child: Text(_register ? S.haveAccount : S.register)),
        ]),
      );
}
