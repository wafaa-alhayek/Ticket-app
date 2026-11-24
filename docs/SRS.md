# دور (Dor) — Software Requirements Specification (SRS)

Version 1.0 · 2026-11-24 · Status: Approved for v1 build

## 1. Purpose
Dor removes physical waiting in lines in Gaza. Clients book a place in a line from their phone (or get a paper number) and come back when their turn is near. Shops can also take orders in advance so food or coffee is ready on arrival.

## 2. Context and constraints
- **Users are in Gaza.** Internet is slow, intermittent, often shared; electricity and phone batteries are limited; many phones are old or low-end.
- **Arabic first**, right-to-left. Plain, everyday Palestinian Arabic wording. English is secondary.
- **Must work on 2G/3G**: target < 15 KB per page (gzipped), no required JavaScript, no external fonts or CDNs.
- **Must work offline at the location**: a laptop on local Wi-Fi can run the whole system with no internet.
- **Fairness and trust matter**: aid lines (bread, water) must not be gamed.

## 3. Users (actors)
| Actor | Description |
|---|---|
| Client | Person waiting: for bread, water, a haircut, or an order. May have a smartphone, a basic phone, or no phone. |
| Store operator | Runs a point: bakery, water point, barber, restaurant, café, aid distribution point. Logs in. |
| Display screen | A TV or spare phone at the location showing the current number. No login. |
| (Later) Coordinator | An aid organization overseeing many points. Out of scope for v1. |

## 4. Scope

### In scope (v1)
1. Store registration and login (username + password), with sessions.
2. Multiple lines (queues) per store, each with its own numbering and estimated service time.
3. Client joins a line by store code, link, or QR code; gets a ticket page with number, current number, people ahead, estimated wait; auto-refresh.
4. Paper tickets for walk-ins without phones.
5. Operator actions: call next, skip no-show, open/close booking, daily reset.
6. Public display screen per store.
7. Pre-order: store menu, client order with pickup time, status flow (new → preparing → ready → picked up / cancelled).
8. Fairness: one active ticket per phone number per line; rate limits per device.
9. JSON API so the Flutter app and future clients use the same backend.
10. Flutter mobile app (Android first) for clients and operators, using the API.
11. Brand identity: name, logo, icon, printable poster with QR code for each store.

### Out of scope (v1)
- Payments of any kind.
- SMS / push notifications (planned v2; design must allow it).
- Coordinator multi-site dashboard (v2).
- Identity verification / aid-eligibility checks.
- Languages other than Arabic and English.

## 5. Functional requirements
| ID | Requirement | Priority |
|---|---|---|
| FR-1 | A store can register with name, area, username, password; gets a unique 4-character code. | Must |
| FR-2 | A store can log in and out; sessions last 30 days. | Must |
| FR-3 | A store can create, open/close, and reset lines. | Must |
| FR-4 | A client can find a store by code or QR link and see each line's waiting count and estimated wait. | Must |
| FR-5 | A client can join a line with optional name and phone; gets a ticket with a private link. | Must |
| FR-6 | The ticket page shows status, number, current number, people ahead, estimated wait; refreshes automatically; warns when ≤ 3 ahead. | Must |
| FR-7 | A client can cancel their ticket. | Must |
| FR-8 | Operator: call next (marks previous as done), skip no-show, issue paper ticket. | Must |
| FR-9 | Estimated service time adapts from actual call intervals. | Should |
| FR-10 | Display screen shows current number per open line and ready orders; refreshes every 10 s. | Must |
| FR-11 | Store can enable pre-orders and manage a menu (add, mark unavailable, delete). | Must |
| FR-12 | Client can place an order (items, notes, name, phone, pickup time) and track its status. | Must |
| FR-13 | One active ticket per phone number per line. | Must |
| FR-14 | Printable store poster with QR code to the booking page. | Should |
| FR-15 | JSON API (`/api/v1`) covering FR-1 … FR-12. | Must |
| FR-16 | Flutter app: client flow (find store, join, ticket, order) and operator flow (login, call next, orders). | Must |
| FR-17 | Flutter app caches the last ticket so it can be shown without connection. | Should |

## 6. Non-functional requirements
| ID | Requirement |
|---|---|
| NFR-1 Performance | Web pages ≤ 15 KB gzipped; usable at 50 kbps with 1 s latency. Flutter APK ≤ 15 MB. |
| NFR-2 Compatibility | Web works without JavaScript on any browser from ~2015, including KaiOS. Flutter supports Android 7+. |
| NFR-3 Language | All UI in Arabic, RTL, Western digits by default; English strings available. |
| NFR-4 Accessibility | Text ≥ 17 px, contrast WCAG AA, touch targets ≥ 44 px, works with screen readers. |
| NFR-5 Security | Hashed passwords (scrypt), HttpOnly SameSite cookies, CSRF origin check, unguessable ticket links, rate limits, no personal data beyond optional name/phone. |
| NFR-6 Reliability | Single SQLite file; survives restart; runs on a laptop with no internet. |
| NFR-7 Privacy | Phone numbers never shown publicly; data for closed tickets can be purged after 7 days. |
| NFR-8 Maintainability | Zero runtime dependencies on the server; automated tests for every FR. |

## 7. System overview
- **Backend:** Node.js ≥ 22.5, built-in `http` and `node:sqlite`. Serves both HTML pages and `/api/v1` JSON.
- **Web front end:** server-rendered HTML + inline CSS, no JavaScript required.
- **Mobile:** Flutter app (`mobile/`) talking to `/api/v1`.
- **Brand assets:** `assets/brand/` (SVG logo, icon, poster template).
- **Design:** `docs/design/` (user flows, wireframes, design tokens).

## 8. Acceptance criteria for v1
- All "Must" requirements implemented and covered by tests.
- A full bread-line scenario (register → create line → 20 clients join → operator serves all) works on a throttled 3G phone profile.
- Pages pass the 15 KB budget.
- Flutter app builds an Android APK and completes the client and operator flows against a local server.

## 9. Team and ownership
| Role | Owns |
|---|---|
| Backend agent | `src/` server logic, database, `/api/v1`, tests |
| Front-end agent | Web pages (`src/html.js`, views), performance budget, QR/poster page |
| UX/UI designer agent | `docs/design/`: flows, wireframes, design tokens, Arabic copy guide |
| Graphics designer agent | `assets/brand/`: logo, app icon, poster, favicon |
| Flutter agent | `mobile/`: Flutter app |

Work is tracked on the Trello board "دور — Dor Queue System". Lists: Backlog → To Do → In Progress → Review → Done. Each agent moves its own cards and checks off items as it finishes them.
