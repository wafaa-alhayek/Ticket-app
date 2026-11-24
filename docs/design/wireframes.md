# Wireframes — دور

RTL: read right→left; the right edge is "start". Width = 360 px phone (≈ 40 chars here). `═══` marks the fold (~600 px visible on a 360×640 phone after browser chrome). `[ ]` = button, `[____]` = input. Flutter notes follow each web frame.

## 1. Home `/`
```
┌──────────────────────────────────────┐
│                               🎫 دور │ header brand
├──────────────────────────────────────┤
│              دور — بدون طوابير       │ h1
│  احجز دورك… أو اطلب مسبقاً.          │
│ ┌──────────────────────────────────┐ │
│ │               رمز المحل أو النقطة │ │
│ │ [______________ ab12 ___________]│ │ dir=ltr input
│ │ [            ادخل               ]│ │ big primary
│ └──────────────────────────────────┘ │
│ ┌ أصحاب المحلات ───────────────────┐ │
│ │ [دخول]  [تسجيل محل جديد]         │ │
═══════════════════════ fold ══════════
│  الصفحات خفيفة… احفظ رابط تذكرتك.     │
```
Above fold: code input + Enter. Flutter *HomeScreen*: same + "تذاكري" list (cached tickets) at top if any; "مسح QR" button next to the code field.

## 2. Store `/s/CODE`
```
│ مخبز العائلات                         │ h1
│ دير البلح · الرمز: ab12               │ muted
│ [🛍️ اطلب مسبقاً واستلم جاهزاً]        │ only if orders on
│ ┌ خبز ─────────────────────────────┐ │
│ │ الحالي 41 · منتظرين 12 · ~36 د   │ │ 3 stat chips
│ │ الاسم (اختياري) [_____________]  │ │
│ │ الجوال (اختياري) [____________]  │ │
│ │ [          احجز دوري           ] │ │
═══════════════════════ fold ══════════
│ ┌ مياه (مغلق) ─────────────────────┐ │
│ │ الحجز مغلق حالياً. جرّب لاحقاً.   │ │
```
Above fold: first line + join button. With many lines, v1.1: collapse forms; tap line name → expands. Flutter *StoreScreen*: line cards, join opens bottom sheet with name/phone.

## 3. Ticket `/t/TOKEN` (most important screen)
```
│ ┌──────────────────────────────────┐ │ border colour = status
│ │ مخبز العائلات — خبز              │ │
│ │              رقمك                │ │
│ │               53                 │ │ 76px bold
│ │          في الانتظار              │ │ status label
│ │ الدور الحالي ............... 41  │ │
│ │ أمامك .................. 11 شخص │ │
│ │ الانتظار المتوقع ...... 33 دقيقة │ │
│ └──────────────────────────────────┘ │
│ ⚠ اقترب دورك، توجّه إلى المكان الآن.   │ near (≤3)
═══════════════════════ fold ══════════
│ آخر تحديث 10:42 · يتحدث كل 30 ثانية   │
│ [تحديث الآن]           [إلغاء دوري]  │ secondary / danger
```
Above fold: number, status, ahead, wait. Called state: green card, number + "حان دورك! توجّه إلى الشباك فوراً", no table. Flutter *TicketScreen*: same; offline banner on top; keep screen awake option; vibrate once when status→called (while app open).

## 4. Order form `/s/CODE/order`
```
│ مخبز العائلات — طلب مسبق              │
│ الصنف          السعر     الكمية      │
│ كعك            5         [ − 0 + ]   │ web: number input 48px
│ قهوة           3         [ − 0 + ]   │
│ ملاحظات [_____________________]      │
═══════════════════════ fold ══════════
│ الاسم [________]  الجوال [________]   │
│ متى ستصل؟ [في أقرب وقت ▾]            │
│ [          أرسل الطلب            ]   │
```
Flutter *MenuScreen*: steppers; sticky bottom bar "أرسل الطلب (3 أصناف)" so submit is always above fold.

## 5. Order status `/o/TOKEN`
Same frame as Ticket: "رقم طلبك" + number + status (تم الاستلام / قيد التحضير / جاهز للاستلام) + item list. Ready = green.

## 6. Login / register
Single card: fields stacked, `dir=ltr` for username/password, big submit. Above fold on 360 px even with keyboard open for login (2 fields).

## 7. Operator dashboard `/dash`
```
│ مخبز العائلات            [اللوحة]    │
│ رمز محلك: ab12  (روابط الحجز/الشاشة) │
│ ┌ خبز  ● مفتوح ────────────────────┐ │
│ │               41                 │ │ current
│ │ أم محمد · منتظرين 12 · 3 د       │ │
│ │ [        ▶ نادِ التالي          ]│ │ 56px, full width
│ │ [تخطي (لم يحضر)] [+ بدون جوال]   │ │
│ │ التالي: 42، 43 (أبو علي)، 44     │ │
═══════════════════════ fold ══════════
│ │ [إغلاق الحجز]  [تصفير الطابور]   │ │ reset = danger, separated
│ └──────────────────────────────────┘ │
│ (more lines) · إضافة طابور · الطلبات │
```
Change from current UI: move "التالي" list below the primary button row, and put reset/close in a separate row so it can't be hit by accident. Flutter *OperatorHome*: tabs "الطوابير | الطلبات"; one line per page with swipe if several; call-next button fixed at bottom (thumb zone).

## 8. Display screen `/s/CODE/screen` (landscape TV / portrait phone)
```
┌──────────────────────────────────────────────┐ bg #0b2e1a
│               مخبز العائلات                  │
│     خبز                    مياه               │ columns if ≥2 lines & wide
│      41                     17                │ #facc15, 150px
│  منتظرين 12             منتظرين 4             │
│        طلبات جاهزة:  7 · 9 · 12               │
│     احجز دورك بالرمز: ab12  [QR]              │
└──────────────────────────────────────────────┘
```
No header/nav. Flutter: optional *DisplayMode* (operator phone turned into a screen) with wakelock.
