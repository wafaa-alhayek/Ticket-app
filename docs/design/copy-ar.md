# Arabic copy guide — دور

## Tone
- Plain, everyday Palestinian Arabic close to MSA so everyone reads it (e.g. "استنى" only in informal hints; core labels in simple فصحى).
- Respectful and calm. People in aid lines are tired and anxious: reassure ("دورك محفوظ"), never blame ("فاتك الدور" not "لم تحضر").
- Short: one idea per sentence, verbs first ("احجز دوري", "نادِ التالي").
- No jokes, no marketing, no emojis except functional ones already used (🎫 🛍️ ✅ ⚠).
- Western digits (41, 10:42). Times: "دقيقة / ساعة" via the `mins()` helper.
- Never show phone numbers publicly; never mention aid eligibility.
- Gender-neutral imperatives in masculine singular (standard), avoid "أخي/أختي".

## String table
Keys are shared: web (`src/` string map) and Flutter (`l10n/app_ar.arb`, `app_en.arb`). `{x}` = placeholder.

| Key | Arabic | English |
|---|---|---|
| app.name | دور | Dor |
| app.tagline | دور — بدون طوابير | Dor — no more lines |
| home.intro | احجز دورك في طابور الخبز، تعبئة المياه، الحلاق، أو اطلب طلبك مسبقاً واستلمه جاهزاً. | Book your place in the bread, water or barber line, or pre-order and pick up ready. |
| home.code_label | رمز المحل أو النقطة | Shop or point code |
| home.code_hint | مثال: ab12 | e.g. ab12 |
| home.enter | ادخل | Go |
| home.scan_qr | امسح رمز QR | Scan QR code |
| home.my_tickets | تذاكري | My tickets |
| home.owners | أصحاب المحلات والنقاط | Shop and point owners |
| home.light_note | الصفحات خفيفة جداً وتعمل على الإنترنت الضعيف. احفظ رابط تذكرتك لتعود إليه. | Pages are very light and work on weak internet. Save your ticket link. |
| store.code | الرمز: {code} | Code: {code} |
| store.current | الدور الحالي | Now serving |
| store.waiting | المنتظرون | Waiting |
| store.est_wait | الانتظار المتوقع | Estimated wait |
| store.closed_tag | مغلق | Closed |
| store.line_closed | الحجز مغلق حالياً. جرّب لاحقاً. | Booking is closed now. Try later. |
| store.no_lines | لا توجد طوابير مفتوحة حالياً. | No open lines right now. |
| store.preorder | اطلب مسبقاً واستلم جاهزاً | Pre-order, pick up ready |
| join.name | الاسم (اختياري) | Name (optional) |
| join.phone | رقم الجوال (اختياري) | Phone (optional) |
| join.submit | احجز دوري | Book my turn |
| join.duplicate | عندك دور محجوز بهذا الرقم. هذه تذكرتك. | You already have a turn with this number. Here is your ticket. |
| ticket.your_number | رقمك | Your number |
| ticket.ahead | أمامك {n} شخص | {n} people ahead |
| ticket.near | اقترب دورك، توجّه إلى المكان الآن. | Your turn is close, head there now. |
| ticket.go_now | توجّه إلى الشباك فوراً. | Go to the counter now. |
| ticket.auto_refresh | الصفحة تتحدث تلقائياً كل 30 ثانية. احفظ هذا الرابط أو صوّر الشاشة. | Page refreshes every 30 s. Save this link or take a screenshot. |
| ticket.last_update | آخر تحديث {time} | Last updated {time} |
| ticket.saved_offline | دورك محفوظ حتى لو انقطع النت. | Your turn is kept even if the internet drops. |
| ticket.refresh | تحديث الآن | Refresh now |
| ticket.cancel | إلغاء دوري | Cancel my turn |
| ticket.cancel_confirm | متأكد إنك بدك تلغي دورك؟ لا يمكن التراجع. | Cancel your turn? This can't be undone. |
| ticket.missed_help | إذا وصلت متأخراً، كلّم المسؤول عن الطابور. | If you arrived late, talk to the person running the line. |
| ticket.reset | انتهى طابور اليوم. احجز من جديد. | Today's line has ended. Book again. |
| ticket.new | احجز دوراً جديداً | Book a new turn |
| status.waiting | في الانتظار | Waiting |
| status.called | حان دورك! | It's your turn! |
| status.done | تمّت الخدمة | Served |
| status.skipped | فاتك الدور | Turn missed |
| status.cancelled | أُلغيت | Cancelled |
| order.title | طلب مسبق | Pre-order |
| order.item / order.price / order.qty | الصنف / السعر / الكمية | Item / Price / Qty |
| order.no_menu | لا توجد قائمة، اكتب طلبك في الملاحظات. | No menu, write your order in the notes. |
| order.note | ملاحظات / تفاصيل الطلب | Notes / order details |
| order.name | الاسم | Name |
| order.pickup | متى ستصل؟ | When will you arrive? |
| order.pickup_asap / 15 / 30 / 60 | في أقرب وقت / خلال 15 دقيقة / خلال 30 دقيقة / خلال ساعة | ASAP / in 15 min / in 30 min / in an hour |
| order.submit | أرسل الطلب | Send order |
| order.your_number | رقم طلبك | Your order number |
| order.status.new | تم الاستلام | Received |
| order.status.preparing | قيد التحضير | Preparing |
| order.status.ready | جاهز للاستلام | Ready for pickup |
| order.status.picked | تم الاستلام من المحل | Picked up |
| order.status.cancelled | أُلغي | Cancelled |
| auth.login_title | دخول أصحاب المحلات | Owner login |
| auth.register_title | تسجيل محل / نقطة جديدة | Register a shop / point |
| auth.store_name | اسم المحل أو النقطة | Shop or point name |
| auth.area | المنطقة | Area |
| auth.username | اسم المستخدم | Username |
| auth.password | كلمة المرور | Password |
| auth.login | دخول | Log in |
| auth.register | تسجيل | Register |
| auth.logout | تسجيل الخروج | Log out |
| auth.bad_login | اسم المستخدم أو كلمة المرور غير صحيحة. | Wrong username or password. |
| dash.title | لوحة المحل | Dashboard |
| dash.your_code | رمز محلك للزبائن: {code} | Your customer code: {code} |
| dash.open / dash.closed | مفتوح / مغلق | Open / Closed |
| dash.call_next | ▶ نادِ التالي | ▶ Call next |
| dash.called_notice | تم نداء رقم {n} | Called number {n} |
| dash.skip | تخطي الحالي (لم يحضر) | Skip current (no-show) |
| dash.walkin | + تذكرة لشخص بدون جوال | + Ticket for person without phone |
| dash.walkin_notice | رقم التذكرة الورقية: {n} | Paper ticket number: {n} |
| dash.close_booking / dash.open_booking | إغلاق الحجز / فتح الحجز | Close booking / Open booking |
| dash.reset | تصفير الطابور (يوم جديد) | Reset line (new day) |
| dash.reset_confirm | سيتم إلغاء كل الأدوار الحالية. متأكد؟ | All current turns will be cancelled. Sure? |
| dash.next_list | التالي: | Next: |
| dash.add_line | إضافة طابور | Add line |
| dash.line_name | اسم الطابور | Line name |
| dash.avg | مدة خدمة الشخص تقريباً (دقائق) | Approx. minutes per person |
| dash.orders | الطلبات المسبقة | Pre-orders |
| dash.orders_on / off | تفعيل الطلب المسبق / إيقاف الطلب المسبق | Enable / Disable pre-orders |
| dash.prepare / ready / delivered / cancel | تحضير / جاهز / تم التسليم / إلغاء | Prepare / Ready / Delivered / Cancel |
| dash.menu | القائمة | Menu |
| dash.add_item | إضافة صنف | Add item |
| dash.available / unavailable | متوفر / غير متوفر | Available / Unavailable |
| dash.delete | حذف | Delete |
| screen.title | شاشة العرض | Display screen |
| screen.book_with_code | احجز دورك بالرمز: {code} | Book with code: {code} |
| screen.ready_orders | طلبات جاهزة | Ready orders |
| net.offline | لا يوجد اتصال — آخر تحديث قبل {n} دقيقة | No connection — updated {n} min ago |
| net.retry | جرّب مرة ثانية | Try again |
| err.store_not_found | ما لقينا محل بهذا الرمز. تأكد من الرمز. | No shop with this code. Check the code. |
| err.rate_limit | طلبات كثيرة من هذا الجهاز. استنى دقيقة وجرّب. | Too many requests from this device. Wait a minute. |
| err.not_found | الصفحة غير موجودة | Page not found |
| common.home | الرئيسية | Home |
| common.refresh | تحديث | Refresh |
| unit.minute / hour / less_minute | دقيقة / ساعة / أقل من دقيقة | min / hour / under a minute |
