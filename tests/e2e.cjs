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
  const PAGES = ['/', '/pricing/', '/en/', '/en/pricing/', '/start/', '/en/start/'];

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
    const p = await b.newPage({ colorScheme: scheme }); await p.goto(BASE + '/');
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
    for (const pg of ['/', '/pricing/']) {
      const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
      await p.goto(BASE + lang + pg, { waitUntil: 'networkidle' });
      const read = () => p.evaluate(() => [...document.querySelectorAll('.plan')].map(c => ({ id: c.dataset.plan, amount: c.querySelector('.amount').textContent.trim(), billed: c.querySelector('.billed').textContent.trim() })));
      const annual = await read();
      await p.click('[data-cycle] [data-c="monthly"]');
      const monthly = await read();
      for (const plan of catalog.plans) {
        const a = annual.find(x => x.id === plan.id), m = monthly.find(x => x.id === plan.id);
        if (plan.pricing.kind !== 'listed') { check(`${lang + pg} ${plan.id} shows on-request, no zero price`, !/\b0\b/.test(a.amount) && a.amount.length > 0, a.amount); continue; }
        const mNet = H(plan.pricing.monthly.amount), aNet = H(plan.pricing.annual.amount), aEq = H(plan.pricing.annual.monthlyEquivalent);
        const vat = h => Math.floor((h * catalog.tax.ratePercent + 50) / 100);
        check(`${lang + pg} ${plan.id} annual per-month = catalog`, a.amount === fmt(aEq), `${a.amount} vs ${fmt(aEq)}`);
        check(`${lang + pg} ${plan.id} annual billed + VAT total`, a.billed.includes(fmt(aNet)) && a.billed.includes(fmt(aNet + vat(aNet))), a.billed);
        check(`${lang + pg} ${plan.id} monthly = catalog`, m.amount === fmt(mNet), `${m.amount}`);
        check(`${lang + pg} ${plan.id} monthly VAT total`, m.billed.includes(fmt(mNet + vat(mNet))), m.billed);
      }
      await p.close();
    }
  }

  // 4. Interactions (Arabic home, desktop)
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const net = []; p.on('request', r => { if (!r.url().startsWith(BASE)) net.push(r.url()); });
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  // showcase tabs by keyboard (RTL: ArrowLeft goes forward)
  await p.focus('#tab-acc'); await p.keyboard.press('ArrowLeft');
  check('showcase tabs: arrow key moves selection (RTL)', (await p.getAttribute('#tab-inv', 'aria-selected')) === 'true');
  check('showcase: only the selected panel shows', await p.isVisible('#panel-inv') && !(await p.isVisible('#panel-acc')));
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
  check('Nexa adjustment creates a draft only, nothing posted', /مسودة/.test(await p.textContent('[data-nx-done="s2"]')) && /لم يُرحَّل/.test(await p.textContent('[data-nx-done="s2"]')));
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
  await p.click('[data-choose="growth"]'); await p.waitForURL(/\/start\/\?plan=growth/);
  check('“اختر باقتك” opens registration with the plan selected', (await p.inputValue('#s-plan')) === 'growth');
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
  check('weak password blocks step 2', /10/.test(await p.textContent('#se-password')));
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
  await p.click('[data-submit]');
  await p.waitForSelector('[data-holding]:not([hidden])');
  check('holding screen: finishing touches, reference number, focus moved', /نضع اللمسات الأخيرة/.test(await p.textContent('[data-holding]')) && /^TMX-[0-9A-F]{8}$/.test(await p.textContent('[data-ref]')) && (await p.evaluate(() => document.activeElement.hasAttribute('data-holding'))));
  await p.fill('#n-email', 'notify@example.com'); await p.click('[data-notify] [type=submit]');
  await p.waitForSelector('[data-notify-msg]:not(:empty)');
  check('launch-notification email can be updated', /سنرسل/.test(await p.textContent('[data-notify-msg]')));
  check('holding offers home and sales', (await p.$$('[data-holding] .actions a')).length === 2);
  await p.screenshot({ path: `${OUT}/start-holding-ar.png`, fullPage: false });
  check('page made no third-party request', net.length === 0, net.join(' '));
  await ctx.close();

  // 5. Mobile drawer: opens, Esc closes and returns focus; reduced motion; language and theme
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p2 = await c2.newPage(); await p2.goto(BASE + '/en/', { waitUntil: 'networkidle' });
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
  const p3 = await c3.newPage(); await p3.goto(BASE + '/');
  const nj = await p3.evaluate(() => ({ nav: [...document.querySelectorAll('[data-nav] a')].filter(a => a.offsetParent).length, plans: document.querySelectorAll('.plan .amount').length, panels: [...document.querySelectorAll('.sc-panel')].filter(x => x.offsetParent).length }));
  check('no-JS: navigation visible', nj.nav >= 6, String(nj.nav));
  check('no-JS: plan prices rendered', nj.plans === catalog.plans.length);
  check('no-JS: all showcase panels readable', nj.panels === 4);
  await p3.goto(BASE + '/start/');
  const ns = await p3.evaluate(() => ({ steps: [...document.querySelectorAll('.step')].filter(x => x.offsetParent).length, submit: !!document.querySelector('[data-submit]').offsetParent }));
  check('no-JS: registration is one complete form with a submit', ns.steps === 3 && ns.submit, JSON.stringify(ns));
  await c3.close();

  // 7. Review screenshots: ar/en x light/dark x desktop/mobile
  if (process.env.SHOTS) {
    for (const [lang, pg] of [['ar', '/'], ['en', '/en/'], ['ar', '/pricing/'], ['en', '/en/pricing/'], ['ar', '/start/'], ['en', '/en/start/']]) {
      for (const scheme of ['light', 'dark']) {
        for (const [w, h, dev] of [[1440, 900, 'desktop'], [390, 844, 'mobile']]) {
          const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: dev === 'mobile' ? 2 : 1 });
          const q = await c.newPage(); await q.goto(BASE + pg, { waitUntil: 'networkidle' }); await q.evaluate(() => document.fonts.ready);
          const name = `${pg.includes('pricing') ? 'pricing' : pg.includes('start') ? 'start' : 'home'}-${lang}-${scheme}-${dev}`;
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
