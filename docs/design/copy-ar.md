# Arabic copy guide — دور

## Tone
- Plain, everyday Palestinian Arabic close to MSA so everyone reads it (e.g. "استنى" only in informal hints; core labels in simple فصحى).
- Respectful and calm. People in aid lines are tired and anxious: reassure ("دورك محفوظ"), never blame: say "مرّ دورك — كلّم المسؤول عن الطابور", never "فاتك الدور" / "تم تخطيك" / "لم تحضر".
- Short: one idea per sentence, verbs first ("احجز دوري", "نادِ التالي").
- No jokes, no marketing, no emojis except functional ones already used (🎫 🛍️ ✅ ⚠).
- Western digits (41, 10:42). Times: "دقيقة / ساعة" via the `mins()` helper.
- Never show phone numbers publicly; never mention aid eligibility.
- Gender-neutral imperatives in masculine singular (standard), avoid "أخي/أختي".
- Every error and status gives a next step. Errors follow: [what happened]. [what to do]. Default action phrase: "جرّب مرة ثانية". Rate limits say "انتظر دقيقة" (a concrete time, not "لاحقاً"/"قليلاً").
- Never say "حدث خطأ" or "غير صحيح" alone; use "تعذّر إكمال طلبك. جرّب مرة ثانية."
- Calm urgency: "الآن" not "فوراً".

## Glossary (use one word everywhere)
| Concept | Use | Avoid |
|---|---|---|
| line / queue | طابور | صف، قائمة انتظار |
| a person's place | دور | حجز (only as the verb "احجز") |
| ticket (page or paper) | تذكرة · "تذكرة ورقية" | رقم ورقي |
| shop / point | محل (home & register: "المحل أو النقطة") | متجر |
| now serving | الدور الحالي | الرقم الحالي |
| waiting count | المنتظرون | بالانتظار |
| owner area | لوحة المحل | — |

## String table
Keys are shared: web (`src/` string map) and Flutter (`l10n/app_ar.arb`, `app_en.arb`). `{x}` = placeholder.

| Key | Arabic | English |
|---|---|---|
| app.name | دور | Dor |
| app.tagline | دور — بدون طوابير | Dor — no more lines |
| home.intro | احجز دورك في طابور الخبز أو المياه أو الحلاق، أو اطلب مسبقاً واستلم طلبك جاهزاً. | Book your place in the bread, water or barber line, or pre-order and pick up ready. |
| home.code_label | رمز المحل أو النقطة | Shop or point code |
| home.code_hint | مثال: ab12 | e.g. ab12 |
| home.enter | ادخل | Go |
| home.scan_qr | امسح رمز QR | Scan QR code |
| home.my_tickets | تذاكري | My tickets |
| home.owners | أصحاب المحلات والنقاط | Shop and point owners |
| home.light_note | الصفحات خفيفة وتعمل مع الإنترنت الضعيف. احفظ رابط تذكرتك لترجع إليه. | Pages are very light and work on weak internet. Save your ticket link. |
| store.code | الرمز: {code} | Code: {code} |
| store.current | الدور الحالي | Now serving |
| store.waiting | المنتظرون | Waiting |
| store.est_wait | الانتظار المتوقع | Estimated wait |
| store.closed_tag | مغلق | Closed |
| store.line_closed | الحجز مغلق حالياً. جرّب لاحقاً. | Booking is closed now. Try later. |
| store.no_lines | لا توجد طوابير مفتوحة الآن. جرّب لاحقاً. | No open lines now. Try later. |
| store.preorder | اطلب مسبقاً واستلم جاهزاً | Pre-order, pick up ready |
| join.name | الاسم (اختياري) | Name (optional) |
| join.phone | رقم الجوال (اختياري) | Phone (optional) |
| join.submit | احجز دوري | Book my turn |
| join.duplicate | عندك دور محجوز بهذا الرقم. هذه تذكرتك. | You already have a turn with this number. Here is your ticket. |
| ticket.your_number | رقمك | Your number |
| ticket.ahead | أمامك {n} شخص | {n} people ahead |
| ticket.near | اقترب دورك، توجّه إلى المكان الآن. | Your turn is close, head there now. |
| ticket.go_now | توجّه إلى الشباك الآن. | Go to the counter now. |
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
| status.done | تمّت خدمتك، شكراً لك | Served, thank you |
| status.skipped | مرّ دورك — كلّم المسؤول عن الطابور | Your turn passed — talk to the line organiser |
| status.cancelled | أُلغي دورك | Turn cancelled |
| order.title | طلب مسبق | Pre-order |
| order.item / order.price / order.qty | الصنف / السعر / الكمية | Item / Price / Qty |
| order.no_menu | لا توجد قائمة. اكتب طلبك في الملاحظات. | No menu, write your order in the notes. |
| order.note | ملاحظات / تفاصيل الطلب | Notes / order details |
| order.name | الاسم | Name |
| order.pickup | متى ستصل؟ | When will you arrive? |
| order.pickup_asap / 15 / 30 / 60 | في أقرب وقت / خلال 15 دقيقة / خلال 30 دقيقة / خلال ساعة | ASAP / in 15 min / in 30 min / in an hour |
| order.submit | أرسل الطلب | Send order |
| order.your_number | رقم طلبك | Your order number |
| order.status.new | وصلنا الطلب | Order received |
| order.status.preparing | قيد التحضير | Preparing |
| order.status.ready | جاهز للاستلام | Ready for pickup |
| order.status.picked | تم التسليم | Handed over |
| order.status.cancelled | أُلغي الطلب | Order cancelled |
| auth.login_title | دخول أصحاب المحلات | Owner login |
| auth.register_title | تسجيل محل / نقطة جديدة | Register a shop / point |
| auth.store_name | اسم المحل أو النقطة | Shop or point name |
| auth.area | المنطقة | Area |
| auth.username | اسم المستخدم | Username |
| auth.password | كلمة المرور | Password |
| auth.login | دخول | Log in |
| auth.register | تسجيل | Register |
| auth.logout | تسجيل الخروج | Log out |
| auth.bad_login | اسم المستخدم أو كلمة المرور غير صحيحة. جرّب مرة ثانية. | Wrong username or password. Try again. |
| dash.title | لوحة المحل | Dashboard |
| dash.your_code | رمز محلك للزبائن: {code} | Your customer code: {code} |
| dash.open / dash.closed | مفتوح / مغلق | Open / Closed |
| dash.call_next | ▶ نادِ التالي | ▶ Call next |
| dash.called_notice | تم نداء رقم {n} | Called number {n} |
| dash.skip | تخطّي الحالي (غير موجود) | Skip current (not here) |
| dash.walkin | + تذكرة ورقية لمن لا يملك جوالاً | + Paper ticket (no phone) |
| dash.walkin_notice | رقم التذكرة الورقية: {n} | Paper ticket number: {n} |
| dash.close_booking / dash.open_booking | إغلاق الحجز / فتح الحجز | Close booking / Open booking |
| dash.reset | يوم جديد (تصفير الطابور) | New day (reset line) |
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
| err.store_not_found | لم نجد محلاً بهذا الرمز. تأكد من الرمز وجرّب مرة ثانية. | No shop with this code. Check it and try again. |
| err.queue_closed | الحجز في هذا الطابور مغلق الآن. جرّب لاحقاً. | Booking for this line is closed now. Try later. |
| err.orders_disabled | هذا المحل لا يستقبل طلبات مسبقة الآن. | This shop isn't taking pre-orders now. |
| err.invalid_input | بعض البيانات ناقصة. راجعها وجرّب مرة ثانية. | Some details are missing. Check and try again. |
| err.username_taken | اسم المستخدم محجوز. اختر اسماً آخر. | Username taken. Choose another. |
| err.unauthorized | سجّل الدخول للمتابعة. | Log in to continue. |
| err.not_cancellable | لا يمكن إلغاء هذا الدور الآن. | This turn can't be cancelled now. |
| err.server | تعذّر إكمال طلبك. جرّب مرة ثانية. | Couldn't complete that. Try again. |
| err.network (app) | تعذّر الاتصال. تأكد من الإنترنت وجرّب مرة ثانية. | Couldn't connect. Check internet and try again. |
| err.timeout (app) | الإنترنت بطيء الآن. جرّب مرة ثانية. | Internet is slow. Try again. |
| err.rate_limit | طلبات كثيرة من هذا الجهاز. انتظر دقيقة وجرّب مرة ثانية. | Too many requests from this device. Wait a minute and try again. |
| err.not_found | لم نجد هذه الصفحة | Page not found |
| common.home | الرئيسية | Home |
| common.refresh | تحديث | Refresh |
| unit.minute / hour / less_minute | دقيقة / ساعة / أقل من دقيقة | min / hour / under a minute |
