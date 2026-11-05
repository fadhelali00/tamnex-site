// End-to-end checks for the built site. Usage:
//   node scripts/build.mjs && TAMNEX_SALT=t TAMNEX_DATA_DIR=$(mktemp -d) TAMNEX_ORIGINS=http://127.0.0.1:8765 php -S 127.0.0.1:8765 -t site &
//   AXE=node_modules/axe-core/axe.min.js OUT=shots node tests/e2e.cjs
// Optional: BASE (default http://127.0.0.1:8765), PW_CHROMIUM (browser path), SHOTS=1 (review screenshots).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = (process.env.BASE || 'http://127.0.0.1:8765').replace(/\/$/, '');
const OUT = process.env.OUT || 'shots';
const AXE = process.env.AXE;
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'pricing-catalog.json'), 'utf8'));
fs.mkdirSync(OUT, { recursive: true });

const results = []; let failed = 0;
const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!ok) failed++; };
const H = s => { const [a, b = '00'] = s.split('.'); return Number(a) * 100 + Number(b); };
const fmt = h => Math.floor(h / 100).toLocaleString('en-US') + (h % 100 ? '.' + String(h % 100).padStart(2, '0') : '');

(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const PAGES = ['/', '/en/', '/preview/', '/preview/pricing/', '/en/preview/', '/en/preview/pricing/', '/preview/start/', '/en/preview/start/'];

  // 1. Layout at six widths, both themes, both languages; console, network, fonts, targets, axe
  for (const scheme of ['light', 'dark']) {
    for (const pg of PAGES) {
      for (const w of [360, 390, 768, 1024, 1280, 1920]) {
        const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme, bypassCSP: !!AXE });
        const p = await ctx.newPage();
        const errors = [], external = [];
        p.on('pageerror', e => errors.push(e.message));
        p.on('console', m => m.type() === 'error' && errors.push(m.text()));
        p.on('request', r => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) external.push(r.url()); });
        await p.goto(BASE + pg, { waitUntil: 'networkidle' });
        await p.evaluate(() => document.fonts.ready);
        const m = await p.evaluate(() => ({
          sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
          font: document.fonts.check('600 16px "IBM Plex Sans Arabic"'),
          small: [...document.querySelectorAll('a.btn, button, input:not([type=checkbox]), select, .nav a')]
            .filter(e => !e.closest('.hp, .skip') && e.offsetParent).filter(e => { const r = e.getBoundingClientRect(); return r.height < 40; })
            .map(e => (e.textContent || e.id).trim().slice(0, 18))
        }));
        const tag = `${scheme} ${pg} ${w}px`;
        check(`${tag} no horizontal scroll`, m.sw <= m.cw, `${m.sw}/${m.cw}`);
        check(`${tag} no console errors`, errors.length === 0, errors.join(' | ').slice(0, 300));
        check(`${tag} no third-party requests`, external.length === 0, external.join(' '));
        check(`${tag} self-hosted font`, m.font);
        check(`${tag} touch targets >= 40px`, m.small.length === 0, m.small.join(', '));
        if (AXE && (w === 390 || w === 1440 || w === 1280)) {
          await p.addScriptTag({ path: AXE });
          const v = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(x => `${x.id}(${x.nodes.length}): ${x.nodes[0].target}`));
          check(`${tag} axe WCAG 2.2 AA incl. contrast`, v.length === 0, v.join(' ; '));
        }
        await ctx.close();
      }
    }
  }

  // 2. Header glass edge >= 3:1 against the page, both themes (VF02)
  for (const scheme of ['light', 'dark']) {
    const p = await b.newPage({ colorScheme: scheme }); await p.goto(BASE + '/preview/');
    const r = await p.evaluate(() => {
      const lum = c => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
      const edge = getComputedStyle(document.querySelector('.topbar')).borderBottomColor;
      const bg = getComputedStyle(document.body).backgroundColor;
      const hdr = getComputedStyle(document.querySelector('.topbar')).backgroundColor;
      return { edge: ratio(edge, bg), alpha: hdr };
    });
    check(`${scheme} header edge contrast >= 3:1`, r.edge >= 3, r.edge.toFixed(2));
    check(`${scheme} header is 94% opaque`, /0\.94\)$/.test(r.alpha), r.alpha);
    await p.close();
  }

  // 3. Prices: home, /pricing and the catalog agree, monthly and annual, VAT totals
  for (const lang of ['', '/en']) {
    for (const pg of ['/preview/', '/preview/pricing/']) {
      const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
      await p.goto(BASE + lang + pg, { waitUntil: 'networkidle' });
      const read = () => p.evaluate(() => [...document.querySelectorAll('.plan')].map(c => ({ id: c.dataset.plan, amount: c.querySelector('.amount').textContent.trim(), billed: c.querySelector('.billed').textContent.trim() })));
      const annual = await read();
      await p.click('[data-cycle] [data-c="monthly"]');
      const monthly = await read();
      for (const plan of catalog.plans) {
        // the page must show the SOURCE's amounts (pricing-catalog v1), including its own VAT-inclusive totals: nothing is recomputed
        const id = plan.plan_id, c = plan.pricing.cycles;
        const a = annual.find(x => x.id === id), m = monthly.find(x => x.id === id);
        const mNet = H(c.monthly.amount), aNet = H(c.annual.amount_total), aEq = H(c.annual.amount_per_month);
        check(`${lang + pg} ${id} annual per-month = catalog`, a.amount === fmt(aEq), `${a.amount} vs ${fmt(aEq)}`);
        check(`${lang + pg} ${id} annual billed + VAT total`, a.billed.includes(fmt(aNet)) && a.billed.includes(fmt(H(c.annual.amount_total_incl_vat))), a.billed);
        check(`${lang + pg} ${id} monthly = catalog`, m.amount === fmt(mNet), `${m.amount}`);
        check(`${lang + pg} ${id} monthly VAT total`, m.billed.includes(fmt(H(c.monthly.amount_incl_vat))), m.billed);
      }
      await p.close();
    }
  }

  // 3b. Stealth teaser: one screen, no navigation, one email field, nothing that leads to the full site
  const ADMIN = process.env.TAMNEX_NOTIFY_EMAIL || '';
  for (const [lang, pg, okRe] of [['ar', '/', /قائمة الوصول المبكر/], ['en', '/en/', /early-access list/]]) {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } }); const q = await c.newPage();
    const bodies = []; q.on('response', async r => { if (r.url().includes('/api/')) bodies.push(await r.text().catch(() => '')); });
    await q.goto(BASE + pg, { waitUntil: 'networkidle' });
    const t = await q.evaluate(() => ({
      nav: document.querySelectorAll('nav, [data-nav]').length,
      inputs: [...document.querySelectorAll('input, select, textarea')].filter(e => !e.closest('.hp') && e.type !== 'hidden').map(e => e.type),
      buttons: [...document.querySelectorAll('button, a.btn')].map(e => e.hasAttribute('data-theme-btn') ? 'theme' : e.getAttribute('type') || 'link'),
      preview: /\/preview|\/start\/|\/pricing\//.test(document.documentElement.outerHTML),
      fits: document.documentElement.scrollHeight <= innerHeight * 1.6,
      dir: document.documentElement.dir
    }));
    check(`teaser ${lang}: no navigation menu`, t.nav === 0);
    check(`teaser ${lang}: exactly one email field`, JSON.stringify(t.inputs) === '["email"]', JSON.stringify(t.inputs));
    check(`teaser ${lang}: only the submit and theme buttons`, JSON.stringify(t.buttons.sort()) === '["submit","theme"]', JSON.stringify(t.buttons));
    check(`teaser ${lang}: no link or path to the full site`, !t.preview);
    check(`teaser ${lang}: direction`, t.dir === (lang === 'ar' ? 'rtl' : 'ltr'));
    await q.fill('#wl-email', 'not-an-email'); await q.click('[data-wl-submit]');
    check(`teaser ${lang}: invalid email is refused with a message`, (await q.textContent('#wl-err')).length > 0 && (await q.isVisible('#wl-form')));
    await q.fill('#wl-email', `waitlist-${lang}@example.com`); await q.click('[data-wl-submit]');
    await q.waitForSelector('[data-wl-ok]:not([hidden])');
    check(`teaser ${lang}: confirmation replaces the form and takes focus`, okRe.test(await q.textContent('[data-wl-ok]')) && !(await q.isVisible('#wl-form')) && (await q.evaluate(() => document.activeElement.hasAttribute('data-wl-ok'))));
    const html = await q.content();
    check(`teaser ${lang}: admin inbox never appears in the page or network responses`, !!ADMIN && !html.includes(ADMIN) && !bodies.some(x => x.includes(ADMIN)), ADMIN ? '' : 'TAMNEX_NOTIFY_EMAIL not set for this run');
    await c.close();
  }
  {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false }); const q = await c.newPage();
    await q.goto(BASE + '/'); await q.fill('#wl-email', 'nojs-waitlist@example.com'); await q.click('[data-wl-submit]');
    await q.waitForURL(/\/joined\/$/);
    check('teaser no-JS: plain post lands on the confirmation page', /قائمة الوصول المبكر/.test(await q.textContent('[data-wl-ok]')) && await q.isVisible('[data-wl-ok]'));
    await c.close();
  }

  // 4. Interactions (Arabic home, desktop)
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const net = []; p.on('request', r => { if (!r.url().startsWith(BASE)) net.push(r.url()); });
  await p.goto(BASE + '/preview/', { waitUntil: 'networkidle' });
  // Continuous Close dashboard (hero)
  check('close dashboard: 99.8% with live matching', (await p.textContent('[data-cd-pct]')) === '99.8%' && /مطابقة فورية نشطة/.test(await p.textContent('.cd .live')));
  check('hero has no debit/credit journal', !(await p.evaluate(() => /مدين|دائن/.test(document.querySelector('.hero').textContent))));
  check('adjustments log is collapsed until asked', !(await p.isVisible('[data-cd-logbox]')));
  await p.click('[data-cd-log]');
  check('adjustments log opens and reports expanded', await p.isVisible('[data-cd-logbox]') && (await p.getAttribute('[data-cd-log]', 'aria-expanded')) === 'true');
  await p.click('[data-cd-approve]');
  check('approving the Nexa draft completes readiness (human action)', (await p.textContent('[data-cd-pct]')) === '100%' && /باسمك/.test(await p.textContent('[data-cd-approved]')) && (await p.getAttribute('[data-cd-meter]', 'aria-valuenow')) === '100');
  await p.click('[data-cd-fs]');
  check('draft statements are a draft that needs approval', /مسودة/.test(await p.textContent('[data-cd-fs-done]')) && /اعتمادك/.test(await p.textContent('[data-cd-fs-done]')));
  // demo
  const verdict = () => p.textContent('[data-verdict]');
  const ring = () => p.textContent('[data-ring-n]');
  check('demo starts 5/8, blocked', (await ring()) === '5/8' && /3/.test(await verdict()));
  await p.click('[data-ex-act="bank"]');
  check('changed data marks the result stale until re-run', /أعد الفحص/.test(await verdict()));
  await p.click('[data-demo-run]');
  check('one exception cleared: 6/8 and blocker remains', (await ring()) === '6/8' && /ما زال/.test(await verdict()), await verdict());
  await p.click('[data-ex-act="accrual"]'); await p.click('[data-ex-act="inventory"]'); await p.click('[data-demo-run]');
  check('all cleared: 8/8, awaiting accountant review', (await ring()) === '8/8' && /بانتظار مراجعة المحاسب/.test(await verdict()));
  await p.click('[data-demo-reset]');
  check('reset returns to 5/8', (await ring()) === '5/8');
  // Nexa scenes
  await p.click('#tab-s2');
  await p.click('[data-nx-act="s2"]');
  check('Nexa cash plan is a draft only, nothing sent', /مسودة/.test(await p.textContent('[data-nx-done="s2"]')) && /لم يُرسَل/.test(await p.textContent('[data-nx-done="s2"]')));
  await p.click('#tab-s3'); await p.click('[data-nx-act="s3"]');
  check('Nexa purchase request approval is a human action, logged', /باسمك/.test(await p.textContent('[data-nx-done="s3"]')));
  // form
  await p.click('#lead-form [type=submit]');
  check('empty form: field errors and focus on the first', (await p.textContent('#e-name')).length > 0 && (await p.evaluate(() => document.activeElement.id)) === 'f-name');
  await p.fill('#f-name', 'اختبار'); await p.fill('#f-company', 'منشأة'); await p.fill('#f-email', 'name@company.com'); await p.fill('#f-phone', '0551234567');
  await p.selectOption('#f-sector', 'trade'); await p.check('#f-consent');
  await p.click('#lead-form [type=submit]');
  await p.waitForSelector('#form-msg:not(:empty)');
  const fm = await p.textContent('#form-msg');
  check('quote request is saved and confirmed', /وصلنا طلبك/.test(fm), fm);
  // choose plan starts registration with that plan
  await p.click('[data-choose="business"]'); await p.waitForURL(/\/start\/\?plan=business/);
  check('“اختر باقتك” opens registration with the plan selected', (await p.inputValue('#s-plan')) === 'business');
  // registration flow
  check('registration shows step 1 of 4 only', await p.isVisible('[data-step="1"]') && !(await p.isVisible('[data-step="2"]')) && /1/.test(await p.textContent('[data-step-of]')));
  await p.click('[data-next]');
  check('step 1 blocks with named errors', (await p.textContent('#se-company')).length > 0 && (await p.evaluate(() => document.activeElement.id)) === 's-company');
  await p.fill('#s-company', 'شركة الاختبار'); await p.selectOption('#s-sector', 'distribution'); await p.selectOption('#s-size', '11-50');
  await p.fill('#s-subdomain', 'admin'); await p.click('[data-next]');
  check('reserved subdomain refused', /محجوز/.test(await p.textContent('#se-subdomain')));
  await p.fill('#s-subdomain', 'test-co'); await p.fill('#s-cr', '1010123456'); await p.click('[data-next]');
  check('step 2 reached', await p.isVisible('[data-step="2"]'));
  await p.click('[data-back]'); check('back returns to step 1 with data kept', (await p.inputValue('#s-company')) === 'شركة الاختبار');
  await p.click('[data-next]');
  await p.fill('#s-first', 'فاضل'); await p.fill('#s-last', 'علي'); await p.selectOption('#s-job', 'cfo'); await p.fill('#s-email', 'flow@example.com'); await p.fill('#s-phone', '0551234567');
  await p.fill('#s-password', 'short'); await p.click('[data-next]');
  check('short password blocks step 2 (ERP policy: 12+)', /12/.test(await p.textContent('#se-password')));
  await p.fill('#s-password', 'Secure-pass-2026'); await p.fill('#s-password2', 'Different-2026'); await p.click('[data-next]');
  check('mismatched confirmation blocks step 2', (await p.textContent('#se-password2')).length > 0);
  await p.fill('#s-password2', 'Secure-pass-2026'); await p.click('[data-pw-toggle]');
  check('show/hide password toggle', (await p.getAttribute('#s-password', 'type')) === 'text');
  await p.click('[data-pw-toggle]'); await p.click('[data-next]');
  await p.check('input[name="vatreg"][value="yes"]'); await p.fill('#s-vat', '123'); await p.check('#s-terms'); await p.click('[data-next]');
  check('bad VAT number blocks step 3', /15/.test(await p.textContent('#se-vat')));
  await p.fill('#s-vat', '310123456700003'); await p.click('[data-next]');
  check('review lists the entered details', /شركة الاختبار/.test(await p.textContent('[data-review]')) && /test-co\.tamnex\.com/.test(await p.textContent('[data-review]')));
  check('review never shows the password', !/Secure-pass/.test(await p.textContent('[data-review]')));
  // A password only the server rejects (ERP common-password list) must come back with a visible error, not a silent jump.
  await p.click('[data-goto="2"]'); await p.fill('#s-password', '123456789012'); await p.fill('#s-password2', '123456789012');
  await p.click('[data-next]'); await p.click('[data-next]'); await p.click('[data-submit]');
  await p.waitForSelector('#se-password:not(:empty)');
  check('server-only rejection shows the field error and a message on step 2', await p.isVisible('[data-step="2"]') && (await p.textContent('#se-password')).length > 0 && (await p.textContent('#start-msg')).length > 0 && (await p.evaluate(() => document.activeElement.id)) === 's-password');
  await p.fill('#s-password', 'Secure-pass-2026'); await p.fill('#s-password2', 'Secure-pass-2026');
  await p.click('[data-next]'); await p.click('[data-next]');
  await p.click('[data-submit]');
  await p.waitForSelector('[data-holding]:not([hidden])');
  check('holding screen: welcome title, request received, focus moved', /أهلاً بك في تامنكس/.test(await p.textContent('[data-holding]')) && /استلمنا طلب انضمام/.test(await p.textContent('[data-holding]')) && (await p.evaluate(() => document.activeElement.hasAttribute('data-holding'))));
  await p.fill('#n-email', 'notify@example.com'); await p.click('[data-notify] [type=submit]');
  await p.waitForSelector('[data-notify-msg]:not(:empty)');
  check('launch-notification email can be updated', /سنرسل/.test(await p.textContent('[data-notify-msg]')));
  check('holding offers exactly sales and home', (await p.$$('[data-holding] .actions a')).length === 2 && /المبيعات/.test(await p.textContent('[data-holding] .actions a')));
  await p.screenshot({ path: `${OUT}/start-holding-ar.png`, fullPage: false });
  check('page made no third-party request', net.length === 0, net.join(' '));
  await ctx.close();

  // 5. Mobile drawer: opens, Esc closes and returns focus; reduced motion; language and theme
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p2 = await c2.newPage(); await p2.goto(BASE + '/en/preview/', { waitUntil: 'networkidle' });
  check('English page is LTR', (await p2.getAttribute('html', 'dir')) === 'ltr');
  await p2.focus('[data-menu-btn]'); await p2.keyboard.press('Enter');
  check('drawer opens and focuses its first link', (await p2.getAttribute('[data-nav]', 'data-open')) === 'true' && (await p2.evaluate(() => document.activeElement.closest('[data-nav]') !== null)));
  await p2.keyboard.press('Escape');
  check('Esc closes the drawer and returns focus to the button', (await p2.getAttribute('[data-nav]', 'data-open')) === 'false' && (await p2.evaluate(() => document.activeElement.hasAttribute('data-menu-btn'))));
  await p2.click('[data-theme-btn]');
  check('theme button switches to light explicitly', (await p2.getAttribute('html', 'data-theme')) === 'light');
  await c2.close();

  // 6. No JavaScript: everything readable, prices present, nav visible
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const p3 = await c3.newPage(); await p3.goto(BASE + '/preview/');
  const nj = await p3.evaluate(() => ({ nav: [...document.querySelectorAll('[data-nav] a')].filter(a => a.offsetParent).length, plans: document.querySelectorAll('.plan .amount').length, dash: !!document.querySelector('.cd .cd-checks').offsetParent, log: !!document.querySelector('[data-cd-logbox]').offsetParent }));
  check('no-JS: navigation visible', nj.nav >= 6, String(nj.nav));
  check('no-JS: plan prices rendered', nj.plans === catalog.plans.length);
  check('no-JS: close dashboard and its log readable', nj.dash && nj.log);
  await p3.goto(BASE + '/preview/start/');
  const ns = await p3.evaluate(() => ({ steps: [...document.querySelectorAll('.step')].filter(x => x.offsetParent).length, submit: !!document.querySelector('[data-submit]').offsetParent }));
  check('no-JS: registration is one complete form with a submit', ns.steps === 3 && ns.submit, JSON.stringify(ns));
  await c3.close();

  // 7. Review screenshots: ar/en x light/dark x desktop/mobile
  if (process.env.SHOTS) {
    for (const [lang, pg] of [['ar', '/'], ['en', '/en/'], ['ar', '/preview/'], ['en', '/en/preview/'], ['ar', '/preview/pricing/'], ['en', '/en/preview/pricing/'], ['ar', '/preview/start/'], ['en', '/en/preview/start/']]) {
      for (const scheme of ['light', 'dark']) {
        for (const [w, h, dev] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
          const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: dev === 'mobile' ? 2 : 1 });
          const q = await c.newPage(); await q.goto(BASE + pg, { waitUntil: 'networkidle' }); await q.evaluate(() => document.fonts.ready);
          const name = `${pg.includes('pricing') ? 'pricing' : pg.includes('start') ? 'start' : pg.includes('preview') ? 'home' : 'teaser'}-${lang}-${scheme}-${dev}`;
          await q.screenshot({ path: `${OUT}/${name}-fold.png` });
          await q.screenshot({ path: `${OUT}/${name}-full.png`, fullPage: true });
          await c.close();
        }
      }
    }
  }

  await b.close();
  console.log(results.filter(r => r.startsWith('FAIL')).join('\n'));
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
