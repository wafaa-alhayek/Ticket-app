# User flows — دور

Principles: every step works with no JS on a 2G connection; one primary action per screen; the ticket link is the client's "receipt" (bookmark/screenshot it). Web routes in `code`; Flutter screens in *italics*.

## 1. Client: join a line
```
[QR poster / link /s/CODE] ─────────────┐
[Home /] → type code → GET /find ───────┤
                                         ▼
                      Store /s/CODE  (*StoreScreen*)
            lines: current no. · waiting · est. wait
                                         │ choose line, optional name/phone
                                         ▼ POST /s/CODE/join
                      Ticket /t/TOKEN (*TicketScreen*)
            big number · current · ahead · est. wait
            auto-refresh 30 s (web) / poll 20 s (app)
                                         │
              ahead ≤ 3 ──► amber banner "اقترب دورك"
                                         │ operator calls
                                         ▼
              status=called → green card "توجّه إلى الشباك فوراً"
                                         │
         done ◄──────────────────────────┴───────────► skipped
         "احجز دوراً جديداً"                    "كلّم المسؤول عن الطابور"
```
Cancel: ticket → "إلغاء دوري" → confirm (web: second POST page; app: dialog) → cancelled.

## 2. Paper ticket walk-in (no phone)
1. Person arrives → operator taps **"+ تذكرة لشخص بدون جوال"** on the line card.
2. Server issues the next number; dashboard notice shows it big, to write on paper or match a pre-printed slip.
3. Person watches the display screen or hears the number called aloud.
4. Same lifecycle as phone tickets. Paper and phone share ONE number sequence, so the line stays fair.

## 3. Operator
```
/login → /dash (*OperatorHome*)
  ├─ per line card: big current number · waiting · next 5
  │    ▶ نادِ التالي (primary, full width) → previous=done, next=called
  │    تخطي الحالي (لم يحضر)               → current=skipped, next called
  │    + تذكرة بدون جوال · إغلاق/فتح الحجز
  │    تصفير الطابور (يوم جديد) → confirm step (destructive)
  ├─ add line (name, avg minutes)
  ├─ pre-orders: enable · orders table · menu
  └─ تسجيل الخروج
```
Operators tap with a crowd watching: buttons keep their position between refreshes, result is a one-line notice ("تم نداء رقم 42"). Call-next must be reachable with the thumb, top of each line card.

## 4. Pre-order
```
Store → "اطلب مسبقاً" → /s/CODE/order (*MenuScreen*)
  qty per item · note · name (required) · phone · pickup time
  → POST → /o/TOKEN (*OrderScreen*): new → preparing → ready → picked
Operator: تحضير → جاهز → تم التسليم (or إلغاء)
```
Ready: green card on the order page + number on the display screen under "طلبات جاهزة". Pickup: show order number at the counter; operator marks delivered.

## 5. Display screen
`/s/CODE/screen` on a TV or spare phone, no login, refresh 10 s, dark background (power-saving, high contrast). Per open line: name, current number (huge), waiting count, "احجز دورك بالرمز CODE"; ready orders list. Readable from 5 m.

## 6. Edge cases
| Case | Behaviour / copy key |
|---|---|
| Lost connection (web) | Page keeps last content; meta refresh retries. Show "آخر تحديث HH:MM" (`ticket.last_update`) so staleness is visible. Reassure: "دورك محفوظ حتى لو انقطع النت" (`ticket.saved_offline`). |
| Lost connection (app) | Show cached ticket (FR-17) with grey banner `net.offline`; retry with backoff 20 s → 60 s → 120 s; never clear cache on error. |
| Missed turn | Status skipped; calm, no blame; ask them to talk to the operator, who can issue a new ticket. |
| Closed line | Store page shows "(مغلق)", no join form, `store.line_closed`. Join POST to a closed line → store page with that notice. |
| Duplicate phone | Same phone, same line, active ticket → redirect to the EXISTING ticket with notice `join.duplicate` (give them their ticket, not an error). |
| Rate limit | `err.rate_limit`. |
| Wrong code | Home with `err.store_not_found`. |
| Daily reset | Active tickets become cancelled; page shows `ticket.reset`. |
| Shared phone | Many tickets per device allowed; app lists all saved tickets. |
