# دور (Dor) — JSON API v1

Base path: `/api/v1`. All request and response bodies are JSON (`Content-Type: application/json; charset=utf-8`).
The API runs on the same server and database as the HTML site, so a ticket taken in the app shows on the web and vice versa.

## Conventions

- **Auth:** operator endpoints need `Authorization: Bearer <token>` (token from `POST /operator/login` or `/operator/register`). Tokens last 30 days. No cookies are used, so there is no CSRF concern.
- **CORS:** every `/api/v1` response sends `Access-Control-Allow-Origin: *`, `Access-Control-Allow-Headers: Authorization, Content-Type`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`. `OPTIONS` preflight returns `204`.
- **Times** are Unix milliseconds (integers). **Minutes** are numbers (may be fractional).
- **Request size** max 100 KB. Invalid JSON → `400 bad_json`.
- **Errors** always have this shape:

```json
{ "error": { "code": "queue_closed", "message_ar": "هذا الطابور مغلق." } }
```

| HTTP | code | meaning |
|---|---|---|
| 400 | `bad_json` | body is not valid JSON |
| 400 | `invalid_input` | missing/invalid field (see `message_ar`) |
| 400 | `queue_closed` | line is closed for booking |
| 400 | `orders_disabled` | store has pre-orders turned off |
| 400 | `username_taken` | register: username exists |
| 401 | `unauthorized` | missing/invalid/expired bearer token |
| 401 | `bad_credentials` | login: wrong username or password |
| 404 | `not_found` | unknown store/queue/ticket/order/item/route |
| 409 | `not_cancellable` | ticket is no longer waiting |
| 429 | `rate_limited` | too many requests from this IP |
| 500 | `server_error` | unexpected error |

Rate limits (per IP, shared with the HTML site): join 20/hour, order 10/hour, login+register 15 per 15 min.

## Objects

**Queue (public)**
```json
{ "id": 1, "name": "خبز", "is_open": true, "current_number": 4, "waiting": 7,
  "avg_minutes": 2.5, "est_wait_minutes": 17.5 }
```
`est_wait_minutes` = `waiting × avg_minutes` (wait for someone joining now).

**Store (public)**
```json
{ "code": "ab12", "name": "مخبز العائلات", "area": "دير البلح", "orders_enabled": true, "queues": [Queue] }
```

**Ticket**
```json
{ "token": "x9...", "number": 5, "status": "waiting", "status_ar": "في الانتظار",
  "name": "أحمد", "created_at": 1764000000000, "called_at": null,
  "store": { "code": "ab12", "name": "مخبز العائلات" },
  "queue": { "id": 1, "name": "خبز", "current_number": 4, "is_open": true },
  "ahead": 3, "est_wait_minutes": 7.5, "near": true }
```
`status`: `waiting | called | done | skipped | cancelled`. `ahead`/`est_wait_minutes` are 0 unless `waiting`. `near` = waiting and `ahead <= 3`. Phone is never returned on public endpoints.

**Menu item**: `{ "id": 3, "name": "قهوة", "price": "5", "available": true }`

**Order (public)**
```json
{ "token": "k2...", "number": 1, "status": "new", "status_ar": "تم الاستلام",
  "name": "سارة", "items": [{ "name": "قهوة", "qty": 2 }], "note": "", "pickup": "خلال 15 دقيقة",
  "created_at": 1764000000000, "store": { "code": "ab12", "name": "مخبز العائلات" } }
```
`status`: `new | preparing | ready | picked | cancelled`.

---

## Public endpoints (no auth)

### `GET /api/v1/stores/:code` → 200 `Store`
Code is case-insensitive. 404 `not_found`.

### `POST /api/v1/stores/:code/join` → 201 `{ "ticket": Ticket, "existing": false }`
Body: `{ "queue_id": 1, "name": "أحمد", "phone": "0599111111" }` (`name` ≤40, `phone` ≤20 optional; non-digits except `+` stripped).
One active ticket per phone per line: if that phone already has a `waiting`/`called` ticket in this line → **200** `{ "ticket": <that ticket>, "existing": true }`.
Errors: 404 store/queue, 400 `queue_closed`, 429 `rate_limited`.

### `GET /api/v1/tickets/:token` → 200 `{ "ticket": Ticket }`
Poll every 30 s. 404 `not_found`.

### `POST /api/v1/tickets/:token/cancel` → 200 `{ "ticket": Ticket }`
Only `waiting` tickets. Errors: 404, 409 `not_cancellable`.

### `GET /api/v1/stores/:code/menu` → 200 `{ "orders_enabled": true, "items": [MenuItem] }`
Only available items. Returns `400 orders_disabled` if pre-orders are off.

### `POST /api/v1/stores/:code/orders` → 201 `{ "order": Order }`
Body:
```json
{ "items": [{ "id": 3, "qty": 2 }], "note": "", "name": "سارة", "phone": "", "pickup": "خلال 15 دقيقة" }
```
`name` required (≤40); at least one item with qty>0 **or** a non-empty `note` (≤300). Qty clamped 0–50; unknown/unavailable item ids ignored. `pickup` ≤30 free text (web uses: في أقرب وقت / خلال 15 دقيقة / خلال 30 دقيقة / خلال ساعة).
Errors: 404, 400 `orders_disabled`, 400 `invalid_input`, 429.

### `GET /api/v1/orders/:token` → 200 `{ "order": Order }`
404 `not_found`.

---

## Operator endpoints (`Authorization: Bearer <token>` unless noted)

### `POST /api/v1/operator/register` (no auth) → 201 `{ "token": "...", "expires_at": 0, "store": OperatorStore }`
Body: `{ "name": "مخبز", "area": "", "username": "bakery1", "password": "secret12" }`. Username `^[a-z0-9_.-]{3,30}$` (lowercased), password ≥6. Errors: 400 `invalid_input`, 400 `username_taken`, 429.

### `POST /api/v1/operator/login` (no auth) → 200 `{ "token": "...", "expires_at": 1766592000000, "store": OperatorStore }`
Body: `{ "username": "bakery1", "password": "secret12" }`. Errors: 401 `bad_credentials`, 429.

### `POST /api/v1/operator/logout` → 200 `{ "ok": true }`
Deletes the token.

`OperatorStore` = `{ "id": 1, "code": "ab12", "name": "...", "area": "...", "username": "bakery1", "orders_enabled": false }`

### `GET /api/v1/operator/me` → 200 Dashboard
```json
{ "store": OperatorStore,
  "queues": [ { ...Queue, "serving": { "number": 4, "name": "أحمد" } | null,
               "next": [ { "number": 5, "name": "" } ] } ],
  "orders": [OperatorOrder],
  "menu": [MenuItem] }
```
`next` = up to 5 waiting tickets. `orders` = active orders (`new|preparing|ready`). `menu` = all items including unavailable.
`OperatorOrder` = `Order` plus `"id"` and `"phone"`.

### Queues
| Method & path | Body | 200 response |
|---|---|---|
| `POST /operator/queues` | `{ "name": "خبز", "avg_minutes": 3 }` (name ≤40 required, avg clamped 0.2–120, default 3) | **201** `{ "queue": DashQueue }` |
| `POST /operator/queues/:id/next` | – | `{ "queue": DashQueue, "called": { "number": 5, "name": "" } \| null }` (`null` = nobody waiting) |
| `POST /operator/queues/:id/skip` | – | same as next (marks current `skipped`, calls next) |
| `POST /operator/queues/:id/walkin` | – | **201** `{ "queue": DashQueue, "ticket": { "number": 9, "token": "..." } }` — paper ticket for someone without a phone |
| `POST /operator/queues/:id/toggle` | – | `{ "queue": DashQueue }` (open ↔ closed) |
| `POST /operator/queues/:id/reset` | – | `{ "queue": DashQueue }` (cancels waiting/called, numbers restart at 1) |

Unknown or other store's queue → 404.

### Orders
- `GET /operator/orders` → `{ "orders": [OperatorOrder] }` active orders. `?all=1` includes picked/cancelled (latest 200).
- `POST /operator/orders/:id/status` body `{ "status": "preparing" | "ready" | "picked" | "cancelled" }` → `{ "order": OperatorOrder }`. 400 `invalid_input`, 404.

### Menu
- `POST /operator/menu` body `{ "name": "قهوة", "price": "5" }` → **201** `{ "item": MenuItem }` (name ≤50 required, price ≤20 text).
- `POST /operator/menu/:id/toggle` → `{ "item": MenuItem }`
- `POST /operator/menu/:id/delete` → `{ "ok": true }`

### Settings
- `POST /operator/settings` body `{ "orders_enabled": true }` → `{ "store": OperatorStore }`

---

## Data retention
Closed tickets (`done|skipped|cancelled`) and closed orders (`picked|cancelled`) older than 7 days are deleted automatically (checked hourly). Expired operator tokens are removed too.
