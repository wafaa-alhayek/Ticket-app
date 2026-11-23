# دور (Dor) — نظام تذاكر وطوابير

نظام بسيط لحجز الدور وتقليل الوقوف في الطوابير: طوابير الخبز، تعبئة المياه، الحلاقين في العيد، ونقاط التوزيع — وأيضاً للمطاعم والمقاهي مع **الطلب المسبق** والاستلام جاهزاً.

مصمم لغزة: **عربي بالكامل (RTL)**، ويعمل على **الإنترنت الضعيف جداً**.

## المزايا
- **للزبائن:** إدخال رمز المحل ← حجز دور ← صفحة تذكرة تعرض رقمك، الدور الحالي، عدد من أمامك، والوقت المتوقع. تتحدث تلقائياً كل 30 ثانية.
- **لأصحاب المحلات:** تسجيل دخول، عدة طوابير لكل محل (خبز / مياه / ...)، زر "نادِ التالي"، تخطي من لم يحضر، فتح/إغلاق الحجز، تصفير يومي.
- **تذاكر لمن لا يملك جوالاً:** زر يصدر رقماً يُكتب على ورقة، ويدخل نفس الطابور بعدل.
- **شاشة عرض** (`/s/<الرمز>/screen`) تُعرض على تلفاز أو جوال قديم أمام المكان.
- **الطلب المسبق:** قائمة أصناف، الزبون يطلب من البيت، المحل يغيّر الحالة (تحضير ← جاهز ← تم التسليم).
- **وقت انتظار ذكي:** يتعلم متوسط مدة الخدمة الحقيقية من سرعة المناداة.
- **عدالة:** تذكرة واحدة فعالة لكل رقم جوال في الطابور، وحد للحجوزات لكل جهاز.

## لماذا يعمل على الإنترنت الضعيف
- لا JavaScript، لا خطوط خارجية، لا صور، لا مكتبات — HTML وCSS مدمج فقط.
- الصفحة الرئيسية حوالي **1.5 كيلوبايت** مضغوطة (gzip).
- التحديث عبر `meta refresh` — يعمل حتى على المتصفحات القديمة وأجهزة KaiOS.
- كل الإجراءات نماذج POST عادية.

## التشغيل
يحتاج Node.js 22.5 أو أحدث، **بدون أي مكتبات خارجية** (يستخدم SQLite المدمج في Node).

```bash
npm start          # http://localhost:3000
npm test
```

متغيرات البيئة: `PORT` (افتراضي 3000)، `DB_FILE` (افتراضي `data/dor.db`).

يمكن تشغيله على خادم صغير، أو على **لابتوب داخل شبكة Wi-Fi محلية** في المكان نفسه بدون إنترنت خارجي — الزبائن القريبون يتصلون بالشبكة ويفتحون عنوان اللابتوب.

---

## English summary
Dor is a zero-dependency Node.js queue-ticket and pre-order app, Arabic-first (RTL), built for very slow connections in Gaza. Stores log in to run one or more lines (call next, skip, walk-in paper tickets, open/close, daily reset) and optional pre-orders with a menu. Clients join with a store code and get a self-refreshing ticket page with position and estimated wait. Pages are server-rendered, JS-free, and ~1.5 KB gzipped. Run with `npm start` (Node ≥ 22.5).

### Ideas for next steps
- SMS notification when your turn is near (local gateway)
- Offline-first PWA cache for the ticket page
- Admin view for aid organizations coordinating many distribution points
