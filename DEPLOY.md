# نشر صفحة تامنكس على tamnex.com

**الحالة:** جاهزة للنشر، **لم تُنشر**. **المستودع:** `fadhelali00/tamnex-website`، والفرع `main` هو الإنتاج. الفحص على 2026-11-03: النطاق على Hostinger (NS `dns-parking.com`، A `2.57.91.91` صفحة ركن)، بلا MX ولا TXT. لا صلاحية لهذه الجلسة على الاستضافة أو DNS.

## ما يُرفع
محتوى مجلد `site/` كما هو، إلى جذر الموقع (`public_html`):
`index.html` · `404.html` · `.htaccess` · `robots.txt` · `sitemap.xml` · `og.png` · `favicon.ico` · `assets/` · `brand/` · `api/interest.php`.
لا يُرفع `marketing/` ولا `tests/` ولا أي ملف من خارج `site/`.

## النشر التلقائي من GitHub (بعد توفر الاستضافة)
hPanel ← **Websites** ← tamnex.com ← **Advanced ← Git**: المستودع `https://github.com/fadhelali00/tamnex-website.git`، الفرع `main`، مجلد التثبيت `public_html`، ثم فعّل **Auto Deployment** وانسخ رابط الـ Webhook إلى GitHub (Settings ← Webhooks). لأن الموقع داخل `site/`، اجعل مجلد النشر يشير إلى `site` إن أتاحت الإعدادات ذلك، وإلا فاستخدم الرفع اليدوي أدناه.

## الطريق أ: استضافة ويب لدى Hostinger
1. hPanel ← **Websites** ← أضف موقعاً لـ `tamnex.com` (إن لم يكن مضافاً). لا تشترِ خطة جديدة لهذا الغرض دون قرارك.
2. **File Manager** ← افتح `public_html` ← ارفع ملف `tamnex-site.zip` ← **Extract** ← احذف الملف المضغوط.
3. في المجلد **فوق** `public_html` (نفس مستوى `public_html`)، أنشئ ملفاً اسمه `tamnex-config.php` بهذا المحتوى، واستبدل القيمة بنص عشوائي طويل (لا يُكتب في المحادثة ولا GitHub):
   ```php
   <?php return ['salt' => 'ضع-هنا-40-حرفاً-عشوائياً-على-الأقل', 'origins' => ['https://tamnex.com', 'https://www.tamnex.com']];
   ```
   التسجيلات تُحفظ في `tamnex-data/interest.csv` بجانبه، خارج الموقع العام.
4. **Security ← SSL**: فعّل الشهادة المجانية لـ `tamnex.com` و`www.tamnex.com`، ثم **Force HTTPS**.
5. لا تغيّر سجلات DNS الأخرى، ولا تضف wildcard (`*.tamnex.com`)، ولا تربط `admin.tamnex.com` بهذا الموقع (D-SA-22 له خادم مستقل).

## الطريق ب: لا توجد خطة استضافة
الصفحة ملفات ثابتة + ملف PHP واحد للتسجيل. أي استضافة PHP/Apache تكفي. اختيار المزود وأي كلفة قرارك. استضافة ثابتة مجانية (مثل GitHub Pages) تعرض الصفحة لكنها لا تشغّل `interest.php`، فيبقى النموذج بلا استقبال ويُظهر رسالة «تعذّر الإرسال» الصادقة؛ لا تنشر بهذه الحالة دون بديل استقبال تعتمده.

## التحقق بعد النشر (لا يُقال «نُشر» قبل نجاحها)
```bash
curl -sI https://tamnex.com/ | grep -i -E "HTTP/|strict-transport|content-security"
```
```bash
curl -sI http://www.tamnex.com/ | grep -i -E "HTTP/|location"
```
```bash
curl -s -X POST https://tamnex.com/api/interest.php -H "Origin: https://tamnex.com" -H "Content-Type: application/json" -d '{"email":"test@example.com","sector":"other","need":"","consent":true,"company":""}'
```
المتوقع: `200` مع HSTS وCSP؛ تحويل `301` إلى `https://tamnex.com/`؛ `{"ok":true}` ثم احذف صف الاختبار من `interest.csv`. ثم افتح الصفحة من الجوال، وجرّب العرض والنموذج.

## الرجوع
احتفظ بنسخة `public_html` الحالية (صفحة الركن) قبل الرفع. للرجوع: احذف الملفات المرفوعة وأعد النسخة، أو استعد نسخة hPanel الاحتياطية.
