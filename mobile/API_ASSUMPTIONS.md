# API assumptions (mobile)

The app follows `docs/API.md` (v1). Every endpoint path lives in `lib/api/api_client.dart`; JSON parsing lives in `lib/api/models.dart`. Those two files are the only ones to change if the API moves.

Settled by `docs/API.md`: paths, bodies, the `{ticket, existing}` / `{order}` wrappers, the `/operator/*` prefix, the error shape, field names (`is_open`, `est_wait_minutes`, `avg_minutes`, `orders_enabled`, `price` as text). Public endpoints never return phone numbers, so the app doesn't expect them.

## Remaining assumptions / client-side choices
1. **Server URL** can be set in the app (gear icon). The default is `http://192.168.1.10:3000`, for a laptop on local Wi-Fi. Cleartext HTTP is allowed in the Android manifest for that reason.
2. **Fractional minutes** (`est_wait_minutes`, `avg_minutes`) are rounded to whole minutes for display.
3. **Operator menu**: there is no `GET /operator/menu`, so the app reads `menu` (and `orders_enabled`) from `GET /operator/me`.
4. **Retry**: only GET requests are retried (2 retries, 0.8 s then 1.6 s backoff) after network errors or timeouts. POSTs are never retried, so a join or order can't be sent twice. The timeout is 15 s per request.
5. **Polling**: the ticket and order screens poll every 30 s. After failures the wait doubles each time, up to 5 min. Polling stops once the ticket or order is finished.
6. **`existing: true`** on join: the app opens the existing ticket and shows a short notice.
7. **401 on `/operator/me`**: the app clears the token locally and returns to the start screen.
8. Lenient parsing: missing fields fall back to defaults (and older field names are also accepted), so a small schema change won't crash the app.
