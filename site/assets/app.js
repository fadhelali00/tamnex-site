// @ts-check
/* Tamnex site behaviour. Every page reads completely without this file. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var rtl = doc.dir === 'rtl';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** @param {string} s @param {ParentNode} [r] @returns {any} */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  /** @param {string} s @param {ParentNode} [r] @returns {any[]} */
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /** Privacy-safe events: no third party, no ledger content. @param {string} name @param {object} [data] */
  function track(name, data) {
    var w = /** @type {any} */ (window);
    (w.tamnexEvents = w.tamnexEvents || []).push({ name: name, data: data || {}, t: Date.now() });
  }

  /* ---------- Mobile drawer: Esc closes and returns focus to the button ---------- */
  var menuBtn = $('[data-menu-btn]'), nav = $('[data-nav]');
  if (menuBtn && nav) {
    var setOpen = function (/** @type {boolean} */ open, /** @type {boolean} */ focusBack) {
      menuBtn.setAttribute('aria-expanded', String(open));
      nav.setAttribute('data-open', String(open));
      $('.sr', menuBtn).textContent = open ? menuBtn.dataset.lClose : menuBtn.dataset.lOpen;
      if (open) { var first = $('a', nav); if (first) first.focus(); }
      else if (focusBack) menuBtn.focus();
    };
    menuBtn.addEventListener('click', function () { setOpen(menuBtn.getAttribute('aria-expanded') !== 'true', true); });
    nav.addEventListener('click', function (/** @type {Event} */ e) { if (/** @type {HTMLElement} */ (e.target).closest('a')) setOpen(false, false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.getAttribute('data-open') === 'true') setOpen(false, true); });
    document.addEventListener('click', function (e) {
      var t = /** @type {Node} */ (e.target);
      if (nav.getAttribute('data-open') === 'true' && !nav.contains(t) && !menuBtn.contains(t)) setOpen(false, false);
    });
  }

  /* ---------- Theme: system -> light -> dark ---------- */
  var themeBtn = $('[data-theme-btn]');
  if (themeBtn) {
    var label = function () {
      var cur = doc.getAttribute('data-theme') || 'system';
      themeBtn.setAttribute('aria-label', themeBtn.dataset.lLabel + ': ' + themeBtn.dataset['l' + cur.charAt(0).toUpperCase() + cur.slice(1)]);
    };
    label();
    themeBtn.addEventListener('click', function () {
      var cur = doc.getAttribute('data-theme') || 'system';
      var next = cur === 'system' ? 'light' : cur === 'light' ? 'dark' : 'system';
      if (next === 'system') doc.removeAttribute('data-theme'); else doc.setAttribute('data-theme', next);
      try { if (next === 'system') localStorage.removeItem('tamnex-theme'); else localStorage.setItem('tamnex-theme', next); } catch { /* storage blocked */ }
      label();
    });
  }

  /* ---------- Tabs (showcase and Nexa scenes): WAI-ARIA tabs, arrows follow reading direction ---------- */
  $$('[role="tablist"]').forEach(function (tablist) {
    var tabs = $$('[role="tab"]', tablist);
    var select = function (/** @type {HTMLElement} */ tab, /** @type {boolean} */ focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var p = document.getElementById(t.getAttribute('aria-controls'));
        if (p) { if (on) p.removeAttribute('data-inactive'); else p.setAttribute('data-inactive', ''); }
      });
      if (focus) tab.focus();
      track('tab', { tab: tab.id });
      if (tab.id === 'tab-s1') typeQuestion();
    };
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (/** @type {KeyboardEvent} */ e) {
        var next = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[e.key];
        if (next) { e.preventDefault(); select(tabs[(i + next + tabs.length) % tabs.length], true); }
        if (e.key === 'Home') { e.preventDefault(); select(tabs[0], true); }
        if (e.key === 'End') { e.preventDefault(); select(tabs[tabs.length - 1], true); }
      });
    });
  });

  /* ---------- Nexa scenes: the question types itself once; buttons give an honest demo result ---------- */
  var typed = false;
  function typeQuestion() {
    var q = $('.cmd-q[data-type]');
    if (!q || typed || reduce) return;
    typed = true;
    var full = q.getAttribute('data-type'), n = 0;
    q.classList.add('typing'); q.textContent = '';
    var id = window.setInterval(function () {
      n += 2; q.textContent = full.slice(0, n);
      if (n >= full.length) { clearInterval(id); q.classList.remove('typing'); q.textContent = full; }
    }, 28);
  }
  var stage = $('.nx-stage');
  if (stage && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); var s1 = $('#tab-s1'); if (s1 && s1.getAttribute('aria-selected') === 'true') typeQuestion(); }
    }, { threshold: 0.4 });
    io.observe(stage);
  }
  $$('[data-nx-act]').forEach(function (b) {
    b.addEventListener('click', function () {
      var id = b.getAttribute('data-nx-act');
      var done = $('[data-nx-done="' + id + '"]'); if (done) done.hidden = false;
      b.disabled = true; track('nexa_scene', { scene: id });
    });
  });

  /* ---------- Continuous Close dashboard (hero demo) ---------- */
  var cd = $('[data-close]');
  if (cd) {
    var approve = $('[data-cd-approve]', cd), fsBtn = $('[data-cd-fs]', cd), logBtn = $('[data-cd-log]', cd), logBox = $('[data-cd-logbox]', cd);
    if (approve) approve.addEventListener('click', function () {
      var pct = $('[data-cd-pct]', cd), meter = $('[data-cd-meter]', cd), ok = $('[data-cd-approved]', cd);
      if (pct) pct.textContent = cd.getAttribute('data-l-done') || '100%';
      if (meter) { meter.setAttribute('data-complete', ''); meter.setAttribute('aria-valuenow', '100'); }
      var den = $('[data-cd-den]', cd); if (den) den.textContent = den.getAttribute('data-l-done') || den.textContent;
      if (ok) ok.hidden = false;
      approve.disabled = true; track('close_demo', { step: 'approve' });
    });
    if (fsBtn) fsBtn.addEventListener('click', function () {
      var d = $('[data-cd-fs-done]', cd); if (d) d.hidden = false;
      fsBtn.disabled = true; track('close_demo', { step: 'statements' });
    });
    if (logBtn && logBox) logBtn.addEventListener('click', function () {
      var open = logBtn.getAttribute('aria-expanded') !== 'true';
      logBtn.setAttribute('aria-expanded', String(open));
      if (open) logBox.setAttribute('data-open', ''); else logBox.removeAttribute('data-open');
    });
  }

  /* ---------- Monthly / annual: swaps text already rendered from the catalog ---------- */
  var cycle = $('[data-cycle]');
  if (cycle) {
    var radios = $$('[role="radio"]', cycle);
    var setCycle = function (/** @type {HTMLElement} */ r, /** @type {boolean} */ focus) {
      var c = r.dataset.c;
      radios.forEach(function (x) { var on = x === r; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
      $$('[data-monthly][data-annual]').forEach(function (el) {
        var v = el.getAttribute(c === 'monthly' ? 'data-monthly' : 'data-annual');
        var b = $('bdi', el); if (b) b.textContent = v; else el.textContent = v;
      });
      if (focus) r.focus();
      track('pricing_cycle', { cycle: c });
    };
    radios.forEach(function (r, i) {
      r.addEventListener('click', function () { setCycle(r, false); });
      r.addEventListener('keydown', function (/** @type {KeyboardEvent} */ e) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) < 0) return;
        e.preventDefault(); setCycle(radios[(i + 1) % radios.length], true);
      });
    });
  }

  /* ---------- Document-cycle card: one step lit at a time while visible ---------- */
  var flow = $('.c-cycle .flow');
  if (flow && !reduce && 'IntersectionObserver' in window) {
    var steps = $$('li', flow), k = 0, timer = 0;
    var tick = function () { steps.forEach(function (s, i) { s.classList.toggle('on', i === k); }); k = (k + 1) % steps.length; };
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && !timer) { tick(); timer = window.setInterval(tick, 1600); } else if (!e.isIntersecting && timer) { clearInterval(timer); timer = 0; } });
    }).observe(flow);
  }

  /* ---------- Continuous-close demo: short, sample data, one state machine ---------- */
  var R = /** @type {any} */ (window).TamnexReadiness;
  var demo = $('[data-demo]');
  if (R && demo) {
    var state = R.initial(), started = false;
    var verdict = $('[data-verdict]', demo);
    var render = function () {
      var ev = R.evaluate(state);
      var arc = $('[data-arc]', demo);
      arc.setAttribute('class', 'r-arc r-' + ev.complete);
      $('[data-ring-n]', demo).textContent = ev.complete + '/' + ev.total;
      $('[data-ring="after"]', demo).setAttribute('aria-label', demo.dataset.lDone.replace('{n}', ev.complete).replace('{t}', ev.total));
      var done = { bank: state.matchedTo === 'RV-1042', accrual: state.accrual === 'approved', inventory: state.inventoryEvidence === 'VAL-1031' };
      $$('[data-ex]', demo).forEach(function (li) {
        var d = /** @type {any} */ (done)[li.dataset.ex];
        li.setAttribute('data-state', d ? 'done' : 'open');
        $('[data-done-text]', li).hidden = !d;
        $('[data-ex-act]', li).disabled = d;
      });
      var kind = ev.verdict.kind === 'done' ? 'complete' : ev.verdict.kind;
      verdict.className = 'verdict v-' + kind;
      verdict.textContent = demo.dataset['l' + kind.charAt(0).toUpperCase() + kind.slice(1)];
      if (kind === 'complete') track('demo_complete');
    };
    var start = function () { if (!started) { started = true; track('demo_start'); } };
    demo.addEventListener('click', function (/** @type {Event} */ e) {
      var b = /** @type {HTMLButtonElement|null} */ (/** @type {HTMLElement} */ (e.target).closest('button'));
      if (!b || b.disabled) return;
      start();
      var act = b.dataset.exAct;
      if (act === 'bank') state = R.matchBank(state, 'RV-1042').state;
      if (act === 'accrual') { state = R.saveAccrualDraft(state).state; state = R.approveAccrual(state).state; }
      if (act === 'inventory') state = R.useInventoryEvidence(state, 'VAL-1031').state;
      if (b.hasAttribute('data-demo-run')) state = R.runChecks(state).state;
      if (b.hasAttribute('data-demo-reset')) state = R.initial();
      if (act) track('demo_step', { step: act });
      render();
    });
    render();
  }

  /* ---------- Request form ---------- */
  var form = /** @type {HTMLFormElement|null} */ ($('#lead-form'));
  if (form) {
    var f = form;
    var plan = new URLSearchParams(location.search).get('plan');
    var planSel = /** @type {HTMLSelectElement} */ ($('#f-plan', f));
    var pick = function (/** @type {string|null} */ id) { if (id && $('option[value="' + CSS.escape(id) + '"]', planSel)) planSel.value = id; };
    pick(plan);
    $$('[data-choose]').forEach(function (a) { a.addEventListener('click', function () { pick(a.dataset.choose); track('plan_choose', { plan: a.dataset.choose }); }); });
    var msg = $('#form-msg', f);
    var err = function (/** @type {string} */ id, /** @type {string} */ text) {
      var input = $('#f-' + id, f);
      $('#e-' + id, f).textContent = text || '';
      input.setAttribute('aria-invalid', text ? 'true' : 'false');
      return !text;
    };
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = function (/** @type {string} */ id) { return /** @type {HTMLInputElement} */ ($('#f-' + id, f)).value.trim(); };
      var ok = true;
      ok = err('name', v('name') ? '' : f.dataset.eName) && ok;
      ok = err('company', v('company') ? '' : f.dataset.eCompany) && ok;
      ok = err('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email')) ? '' : f.dataset.eEmail) && ok;
      ok = err('phone', /^\+?[0-9 ]{9,15}$/.test(v('phone').replace(/[-()]/g, '')) ? '' : f.dataset.ePhone) && ok;
      ok = err('sector', v('sector') ? '' : f.dataset.eSector) && ok;
      ok = err('consent', /** @type {HTMLInputElement} */ ($('#f-consent', f)).checked ? '' : f.dataset.eConsent) && ok;
      msg.className = 'form-msg'; msg.textContent = '';
      if (!ok) { var first = $('[aria-invalid="true"]', f); if (first) first.focus(); return; }
      if (v('website')) return; // honeypot
      var btn = $('[type=submit]', f); btn.disabled = true; btn.textContent = f.dataset.lSending;
      fetch(f.dataset.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: v('name'), company: v('company'), email: v('email'), phone: v('phone'), sector: v('sector'), branches: v('branches'), plan: v('plan'), lang: f.dataset.lang, consent: true, website: '' })
      }).then(function (r) {
        if (r.status === 429) { msg.className = 'form-msg bad'; msg.textContent = f.dataset.lRate; return; }
        if (!r.ok) throw new Error(String(r.status));
        msg.className = 'form-msg ok'; msg.textContent = f.dataset.lOk; f.reset(); track('lead_submit', { plan: planSel.value || 'none' });
      }).catch(function () { msg.className = 'form-msg bad'; msg.textContent = f.dataset.lFail; })
        .then(function () { btn.disabled = false; btn.textContent = f.dataset.lSubmit; });
    });
  }
})();
