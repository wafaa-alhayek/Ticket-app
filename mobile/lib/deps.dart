import 'api/api_client.dart';
import 'storage.dart';

/// Shared services handed to every screen (no state-management package).
class Deps {
  final ApiClient api;
  final Storage storage;
  Deps(this.api, this.storage);
}
