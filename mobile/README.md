# دور — Flutter app (Android)

Arabic (RTL) client and operator app for Dor. It talks to the same server as the website through `/api/v1` (see `../docs/API.md` and `API_ASSUMPTIONS.md`).

- **Client:** enter a 4-character store code, then pick a line and join → ticket screen (very large number, number being served, people ahead, estimated wait, "your turn is near" warning, cancel). The ticket screen polls every 30 s with backoff. The last ticket is cached, so it still shows offline with "آخر تحديث". Pre-order from the menu → order status screen.
- **Operator:** register or log in → queues with a large "التالي" (call next) button, plus skip, paper ticket (walk-in), open/close and reset. Orders screen: change order status, edit the menu, turn pre-orders on or off.
- Dependencies: `http`, `shared_preferences`, `flutter_localizations` only. minSdk 24 (Android 7.0).
- Theme: `lib/theme.dart` (#14532d / #f4f1ea / #facc15). All Arabic text: `lib/l10n/strings_ar.dart`.

## Run
```sh
cd mobile
flutter pub get
flutter test
flutter run                          # device on the same Wi-Fi as the server
flutter build apk --release --split-per-abi   # small per-ABI APKs
```
Set the server address from the gear icon on the home screen (e.g. `http://192.168.1.10:3000`).

## Layout
```
lib/api/        api_client.dart (endpoints, timeouts, retry) · models.dart
lib/screens/    home, store, ticket, preorder, order_status, operator_login/dashboard/orders
lib/storage.dart  shared_preferences: server URL, operator token, cached ticket
test/           widget + API tests (MockClient)
```
