# Accessibility audit — دور

Date: 2026-11-24 · Target: WCAG 2.2 AA (plus the project checklist in `docs/design/accessibility.md`).

## Scope

**Web** (server-rendered, no JS), all pages with realistic data (1 store, 2 queues, 6 tickets, 2 menu items, 1 order):
home, home with "store not found" error, store, ticket (waiting / called / done), order form, order status,
login, register, dashboard (with queues, orders, menu), reset confirmation, QR poster, display screen, 404.

**Flutter** (`mobile/lib`): home, store, ticket, pre-order, order status, operator login, dashboard, orders/menu,
shared widgets (`BigNumber`, `ErrorBanner`, `confirm`).

## Method

1. Automated: axe-core 4.10 injected with Playwright/Chromium (rulesets wcag2a/aa, wcag21a/aa, wcag22aa, best-practice) on every page.
2. Keyboard: scripted Tab walk recording focus order and computed outline per element.
3. Reflow: 320 px viewport (= 400 % zoom at 1280 px) — `scrollWidth` and offending elements; target sizes measured.
4. Structure: heading list, landmarks, live regions per page.
5. Contrast: computed WCAG ratios for every colour pair in the CSS tokens.
6. Flutter: code review for Semantics, tooltips, contrast, tap targets; new widget tests at `textScaler 2.0` on a 360 dp screen.

### Contrast (WCAG ratios)

| Pair | Ratio | Result |
|---|---|---|
| Body text #1d1d1b / #f4f1ea | 14.97 | Pass |
| Muted #5c5648 / page, card, notice, called | 6.46 / 7.29 / 6.55 / 6.64 | Pass |
| Primary button #fff / #14532d | 9.11 | Pass |
| Secondary button #1d1d1b / #e7e2d6 | 13.06 | Pass |
| Warn button #fff / #9a3412 | 7.31 | Pass |
| Display number #facc15 / #0b2e1a | 9.66 | Pass |
| Input border #8a8373 / #fff | 3.77 | Pass (≥ 3) |
| Focus ring #b45309 / page, card | 4.45 / 5.02 | Pass (≥ 3) |
| Focus ring #b45309 / header #14532d | **1.81** | Fail → fixed (#facc15 in header) |
| Secondary button fill #e7e2d6 / page | 1.15 | Not required (label identifies button) |
| Flutter "last update" `black54` / #f4f1ea | ≈ 4.4 | Borderline → fixed (#5c5648, 6.46) |

## Findings

| # | Issue | WCAG | Severity | Page / screen | Status |
|---|---|---|---|---|---|
| 1 | Timed auto-refresh (meta refresh 30 s) with no way to stop it; reload also resets screen-reader position | 2.2.1 Timing Adjustable (A) | High | Ticket, order status | Fixed — "stop auto-refresh" link (`?live=0`), state kept on "refresh now" links |
| 2 | Display screen refreshes every 10 s | 2.2.1 (A) | Low | Screen | Open (accepted: unattended TV kiosk, no user interaction; real-time exception) |
| 3 | No `<h1>`; status was `<h2>` | 1.3.1, 2.4.6 | Moderate | Ticket, order status | Fixed — status is the `<h1>` |
| 4 | Error notices not announced | 4.1.3 Status Messages (AA) | High | Home/find, store, order form, login, register | Fixed — `role="alert"`; dashboard message `role="status"` |
| 5 | Orders table overflows at 320 px (338 px) | 1.4.10 Reflow (AA) | Moderate | Dashboard | Fixed — table in `overflow-x:auto` wrapper (data-table exception) |
| 6 | Empty `<th>` for action column; no `scope` | 1.3.1 (A) | Low | Dashboard | Fixed — visually hidden header, `scope="col"` |
| 7 | Ticket stats table had no headers | 1.3.1 (A) | Low | Ticket | Fixed — `<th scope="row">` |
| 8 | Emoji/symbols read aloud (🛍️, 🖨️, ▶, +) | 1.1.1 (A) | Low | Store, dashboard | Fixed — `aria-hidden` |
| 9 | Focus ring 1.81:1 on green header | 1.4.11 (AA), 2.4.13 (AAA) | Moderate | All pages (header link) | Fixed |
| 10 | Display screen has no `main` landmark | 1.3.1 / best practice | Low | Screen | Fixed — `<main>` |
| 11 | Stand-alone text links 19–21 px tall | 2.5.8 Target Size (AA) | Low | Login, register, store "تحديث" | Fixed — min-height 44 px for stand-alone links |
| 12 | Inline URL links in dashboard are 19 px tall | 2.5.8 | Info | Dashboard | Accepted — inline-in-sentence exception |
| 13 | `aria-live` regions don't fire on a full page reload (no JS) | 4.1.3 | Info | Ticket, order | Open by design — kept for future JS; called state also shown by `<h1>` text + colour + notice |
| 14 | No skip link | 2.4.1 (A) | Info | All | Pass — header has ≤ 2 links and a `main` landmark |
| 15 | Flutter: big ticket number read as two nodes ("رقمك", "53") | 1.3.1 / 4.1.2 | Moderate | Ticket, dashboard | Fixed — `BigNumber` merged `Semantics(label: "رقمك 53")` |
| 16 | Flutter: status/notice/error changes not announced | 4.1.3 | High | Ticket, all error banners | Fixed — `Semantics(liveRegion: true)`; status also `header` |
| 17 | Flutter: icon-only buttons without label (+/− qty, add item, delete item) and unlabeled menu Switch | 1.1.1, 4.1.2 (A) | High | Pre-order, operator orders | Fixed — tooltips/Semantics with item name |
| 18 | Flutter: `Colors.black54` secondary text | 1.4.3 (AA) | Low | Ticket, order status, operator orders | Fixed — #5c5648 |
| 19 | Flutter: text scaling 2.0 at 360 dp | 1.4.4 (AA) | — | Ticket, dashboard | Pass — new widget tests guard it; call-next button ≥ 48 dp |

Verified OK (no change needed): `lang="ar" dir="rtl"`; LTR for code/username/password/phone; every input has a visible `<label for>` or `aria-label`; autocomplete on login/name/phone; focus visible (3 px) on every focusable element; logical RTL tab order on every page; no horizontal scroll at 320 px after fix; status never by colour only; poster QR `role="img"` with label; destructive reset has a confirmation page; Flutter `IconButton`s ≥ 48 dp, AppBar actions have tooltips, primary buttons 52–72 dp.

## Wording notes (for the copy owner — not changed here)

- New strings added for accessibility: «إيقاف التحديث التلقائي» / «تشغيل التحديث التلقائي», visually hidden «إجراءات», Flutter «زيادة كمية» / «إنقاص كمية» / «حذف» / «متوفر». Review wording if needed.
- The menu toggle button on the web dashboard says «متوفر» / «غير متوفر» — it shows the current state, not the action, so it is unclear what pressing does (3.3.2 / 2.4.6). Suggest «اجعله غير متوفر» / «اجعله متوفراً».
- «تحديث» appears as both "refresh" and in other senses; fine, but «تحديث الآن» on the order page would match the ticket page.

## Re-test

After fixes: axe reports 0 violations on all pages except the intentional `meta-refresh` (now user-stoppable); `npm test` 13/13; `flutter test` 9/9.
