import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'api/api_client.dart';
import 'deps.dart';
import 'l10n/strings_ar.dart';
import 'screens/home_screen.dart';
import 'storage.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final storage = await Storage.open();
  final api = ApiClient(baseUrl: storage.serverUrl, token: storage.opToken);
  runApp(DorApp(deps: Deps(api, storage)));
}

class DorApp extends StatelessWidget {
  final Deps deps;
  const DorApp({super.key, required this.deps});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: S.appName,
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: HomeScreen(deps: deps),
    );
  }
}
