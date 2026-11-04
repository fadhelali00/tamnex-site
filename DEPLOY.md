# نشر صفحة تامنكس على tamnex.com

**الحالة:** جاهزة للنشر، **لم تُنشر**. **المستودع:** `fadhelali00/tamnex-site` (عام). الفرع `main` هو المصدر، وفرع `deploy` يبنيه CI تلقائياً بعد كل دمج في `main`، وفيه محتوى `site/` في جذره.

**البنية الحالية (تقرير البنية 2026-11-03):**
- Hostinger Single Web Hosting: موقع واحد، Git وPHP، بلا SSH، الخادم في فرانكفورت. تنتهي الخطة في **2026-12-03**، وتجديدها قرار المالك.
- DNS على Cloudflare، وكل السجلات DNS-only: `@` CNAME `tamnex.com.cdn.hstgr.net` و`www` CNAME. لا تغيير مطلوب.
- **لا تلمس** سجل `admin` (خادم UAT)، ولا تفعّل proxy عليه، ولا تضغط Reset DNS records، ولا تغيّر nameservers.

## الخطوات (مرة واحدة)
1. **الدمج:** بعد أن يصبح CI أخضر، يُدمج الـ PR في `main`. ينشئ CI فرع `deploy` خلال دقيقتين.
2. **ربط Git في Hostinger:** hPanel ← Websites ← tamnex.com ← Advanced ← **Git** ← Create a new repository:
   - Repository: `https://github.com/fadhelali00/tamnex-site.git`. المستودع عام، فلا حاجة لـ Deploy Key.
   - Branch: `deploy`.
   - Install path: اتركه فارغاً (`public_html` نفسه). إن طلب مجلداً فارغاً فاحذف محتوى `public_html` الافتراضي أولاً.
   - اضغط Create ثم **Deploy**، ثم فعّل **Auto Deployment** وانسخ رابط الـ Webhook إلى GitHub (المستودع ← Settings ← Webhooks ← Add webhook، Content type `application/json`).
3. **ملف الإعداد السري:** File Manager ← المجلد **فوق** `public_html` ← أنشئ `tamnex-config.php`:
   ```php
   <?php return ['salt' => 'نص-عشوائي-طويل-40-حرفاً-على-الأقل', 'origins' => ['https://tamnex.com', 'https://www.tamnex.com']];
   ```
   القيمة تُكتب في hPanel مباشرة، لا في المحادثة ولا في GitHub. التسجيلات تُحفظ في `tamnex-data/` بجانبه، خارج الموقع العام.
4. **SSL:** hPanel ← Security ← SSL: تأكد أن الشهادة فعّالة لـ `tamnex.com` و`www.tamnex.com`.
5. **PHP:** hPanel ← Advanced ← PHP Configuration: إصدار 8.1 أو أحدث. Argon2id مطلوب للتسجيل، وبدونه يرفض التسجيل بـ 503 بدل تجزئة لا يقرؤها النظام.

## التحقق بعد النشر (لا يُقال «نُشر» قبل نجاحها)
```bash
curl -sI https://tamnex.com/ | grep -i -E "HTTP/|strict-transport|content-security"
```
```bash
curl -sI http://www.tamnex.com/ | grep -i -E "HTTP/|location"
```
المتوقع: `200` مع HSTS وCSP، وتحويل `301` إلى `https://tamnex.com/`. ثم تجربة نموذج «اطلب عرضاً مباشراً» ومسار «أنشئ حسابك» من الجوال، وحذف صفوف الاختبار من ملفات `tamnex-data/`.

## الرجوع
Git في hPanel يعيد نشر أي commit سابق من فرع `deploy`. أو أعد `main` إلى commit سابق، فيعيد CI بناء `deploy`.
