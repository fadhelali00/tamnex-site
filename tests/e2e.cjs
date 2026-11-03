// End-to-end checks for site/. Usage:
//   (cd site && python3 -m http.server 8765) &
//   AXE=/path/to/axe.min.js OUT=/tmp/shots node tests/e2e.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE || 'http://127.0.0.1:8765/';
const OUT = process.env.OUT || '/tmp/tamnex-shots';
const AXE = process.env.AXE;
fs.mkdirSync(OUT, { recursive: true });

const results = []; let failed = 0;
const check = (name, ok, info = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!ok) failed++; };

(async () => {
  const b = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

  // Layout, overflow, console, network, fonts, axe: every width in both themes
  for (const scheme of ['light', 'dark']) {
    for (const w of [320, 390, 768, 1440]) {
      const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme, deviceScaleFactor: 1, bypassCSP: !!AXE && (w === 390 || w === 1440) });
      const p = await ctx.newPage();
      const errors = [], external = [];
      p.on('pageerror', e => errors.push(e.message));
      p.on('console', m => m.type() === 'error' && errors.push(m.text()));
      p.on('request', r => { if (!r.url().startsWith(BASE) && !r.url().startsWith('data:')) external.push(r.url()); });
      await p.goto(BASE, { waitUntil: 'networkidle' });
      await p.evaluate(() => document.fonts.ready);
      const m = await p.evaluate(() => ({
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        font: document.fonts.check('600 16px "IBM Plex Sans Arabic"'),
        h1: document.querySelector('h1').getBoundingClientRect().bottom,
        cta: document.querySelector('.hero .btn').getBoundingClientRect().bottom,
        small: [...document.querySelectorAll('button, .btn, a.link, input:not([type=radio]):not([type=checkbox]), select, summary')].filter(e => !e.closest('.hp, .skip')).filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && r.height < 24; }).map(e => e.textContent.trim().slice(0, 20))
      }));
      check(`${scheme} ${w}px no horizontal overflow`, m.sw <= m.cw, `${m.sw}/${m.cw}`);
      check(`${scheme} ${w}px no console errors`, errors.length === 0, errors.join(' | '));
      check(`${scheme} ${w}px no external requests`, external.length === 0, external.join(' '));
      check(`${scheme} ${w}px self-hosted font loaded`, m.font);
      check(`${scheme} ${w}px primary action on first screen`, m.cta <= 900, `cta bottom ${Math.round(m.cta)}`);
      check(`${scheme} ${w}px no tiny targets`, m.small.length === 0, m.small.join(', '));
      await p.screenshot({ path: `${OUT}/${scheme}-${w}-fold.png` });
      await p.screenshot({ path: `${OUT}/${scheme}-${w}-full.png`, fullPage: true });
      if (AXE && (w === 390 || w === 1440)) {
        await p.addScriptTag({ path: AXE });
        const r = await p.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations.map(v => `${v.id}(${v.nodes.length})`));
        check(`${scheme} ${w}px axe WCAG 2.2 A/AA`, r.length === 0, r.join(', '));
      }
      await ctx.close();
    }
  }

  // Demo flow
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  const net = []; p.on('request', r => { if (!r.url().startsWith(BASE)) net.push(r.url()); });
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const read = () => p.evaluate(() => ({
    rings: [...document.querySelectorAll('[data-bind="ring-num"]')].map(e => e.textContent),
    verdict: document.querySelector('[data-bind="verdict"]').textContent,
    statuses: [...document.querySelectorAll('[data-bind="checks"] tr')].map(r => r.dataset.check + ':' + r.querySelector('.st').textContent),
    pv: document.querySelectorAll('[data-bind="pv-list"] li').length,
    ledger: ['l-bank', 'l-rent', 'l-accrued'].map(k => document.querySelector(`[data-bind="${k}"]`).textContent),
    msg1: document.querySelector('[data-bind="msg-1"]').textContent,
    msg3: document.querySelector('[data-bind="msg-3"]').textContent,
    events: (window.tamnexEvents || []).map(e => e.name)
  }));
  let s = await read();
  check('demo starts 5/8 on both rings', s.rings.every(r => r === '5/8') && s.rings.length === 2, s.rings.join(','));
  check('hero preview lists the 3 open checks', s.pv === 3);
  await p.click('[data-act="match"][data-id="RV-1047"]');
  s = await read(); check('wrong amount rejected', /المبلغ لا يطابق/.test(s.msg1));
  await p.click('[data-act="match"][data-id="RV-1039"]');
  s = await read(); check('already-used receipt rejected', /مربوط مسبقاً/.test(s.msg1));
  const ledger0 = s.ledger.join();
  await p.click('[data-act="match"][data-id="RV-1042"]');
  s = await read();
  check('correct match changes no balance', s.ledger.join() === ledger0);
  check('changed check shows unverified until re-run', s.statuses.includes('bank:غير متحقق') && /أعد الفحص/.test(s.verdict));
  await p.click('[data-act="dismiss"]');
  s = await read(); check('dismissing the alert does not pass the check', /لا يُغلق الفحص/.test(s.msg3));
  await p.click('[data-act="explain"]');
  await p.click('[data-act="draft"]');
  await p.check('input[name="evid"][value="VAL-1031"]');
  await p.click('[data-act="evidence"]');
  await p.click('.board [data-act="run"]');
  s = await read();
  check('draft alone keeps exception open and flags hygiene', s.statuses.includes('expected:مفتوح') && s.statuses.includes('hygiene:يحتاج مراجعة'), s.statuses.join(' '));
  check('partial path verdict: improved, blocker remains', /تحسنت الجاهزية، وما زال مانع/.test(s.verdict), s.verdict);
  check('rings agree after partial path', s.rings[0] === s.rings[1] && s.rings[0] === '6/8', s.rings.join(','));
  await p.click('[data-act="approve"]');
  await p.click('#step-4 [data-act="run"]');
  s = await read();
  check('full path verdict', /فحوص هذا السيناريو مكتملة، بانتظار مراجعة المحاسب/.test(s.verdict), s.verdict);
  check('rings 8/8', s.rings.every(r => r === '8/8'));
  check('ledger after approval', s.ledger.join('|') === '248,300.00|4,000.00|16,600.00', s.ledger.join('|'));
  check('events recorded', ['demo_start', 'demo_step', 'demo_complete'].every(n => s.events.includes(n)), s.events.join(','));
  await p.screenshot({ path: `${OUT}/demo-complete.png`, fullPage: false, clip: await p.locator('.demo').boundingBox() });
  await p.click('[data-act="reset"]');
  s = await read(); check('reset returns to 5/8', s.rings.every(r => r === '5/8') && s.ledger.join() === ledger0);
  check('demo made no network request', net.length === 0, net.join(' '));
  await ctx.close();

  // Example mode with reduced motion
  const c2 = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const p2 = await c2.newPage();
  await p2.goto(BASE, { waitUntil: 'networkidle' });
  await p2.click('[data-act="example"]');
  const v2 = await p2.textContent('[data-bind="verdict"]');
  check('example plays the right path to the end (reduced motion, instant)', /مكتملة، بانتظار مراجعة المحاسب/.test(v2), v2);
  // Mobile menu by keyboard
  await p2.focus('.menu-btn'); await p2.keyboard.press('Enter');
  check('menu opens with keyboard', (await p2.getAttribute('#site-nav', 'data-open')) === 'true');
  await p2.keyboard.press('Escape');
  check('Escape closes menu', (await p2.getAttribute('#site-nav', 'data-open')) === 'false');
  // Form
  await p2.click('#lead-form [type=submit]');
  check('empty form shows field errors', (await p2.textContent('#e-email')).length > 0 && (await p2.textContent('#e-consent')).length > 0);
  await p2.fill('#f-email', 'name@company.com'); await p2.selectOption('#f-sector', 'distribution'); await p2.check('#f-consent');
  await p2.click('#lead-form [type=submit]');
  const fm = await p2.textContent('#form-msg');
  check('endpoint unreachable on static preview: honest error, no fake success', /تعذّر الإرسال/.test(fm) && !/وصل تسجيلك/.test(fm), fm);
  await p2.screenshot({ path: `${OUT}/mobile-form.png`, clip: await p2.locator('.interest').boundingBox() });
  await c2.close();

  // No JavaScript
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const p3 = await c3.newPage();
  await p3.goto(BASE);
  const nojs = await p3.evaluate(() => ({ links: [...document.querySelectorAll('#site-nav a')].filter(a => a.offsetParent).length, h1: !!document.querySelector('h1').offsetParent, checks: document.querySelectorAll('[data-bind="checks"] tr').length }));
  check('no-JS: navigation links visible', nojs.links >= 5, String(nojs.links));
  check('no-JS: content and checks readable', nojs.h1 && nojs.checks === 8);
  await p3.screenshot({ path: `${OUT}/nojs-390.png`, fullPage: true });
  await c3.close();

  await b.close();
  console.log(results.join('\n'));
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
