/* Tamnex page behaviour. The page reads completely without this file. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');
  var R = window.TamnexReadiness;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---------- Privacy-safe events: no third party, no ledger content ---------- */
  var sent = {};
  function track(name, data) {
    var ev = { name: name, data: data || {}, t: Date.now() };
    (window.tamnexEvents = window.tamnexEvents || []).push(ev);
    window.dispatchEvent(new CustomEvent('tamnex:event', { detail: ev }));
  }
  function trackOnce(name, data) { var k = name + JSON.stringify(data || {}); if (!sent[k]) { sent[k] = 1; track(name, data); } }

  /* ---------- Mobile menu ---------- */
  var menuBtn = $('.menu-btn'), nav = $('#site-nav');
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', function () {
      var open = menuBtn.getAttribute('aria-expanded') !== 'true';
      menuBtn.setAttribute('aria-expanded', String(open));
      nav.setAttribute('data-open', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { menuBtn.setAttribute('aria-expanded', 'false'); nav.setAttribute('data-open', 'false'); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.getAttribute('data-open') === 'true') { menuBtn.click(); menuBtn.focus(); }
    });
  }

  /* ---------- Demo ---------- */
  if (R) initDemo();

  function initDemo() {
    var state = R.initial();
    var msgs = { 1: null, 2: null, 3: null };
    var base = R.evaluate(state);
    var LABEL = { pass: 'مكتمل', open: 'مفتوح', attention: 'يحتاج مراجعة', unverified: 'غير متحقق' };
    var started = false, playing = false;

    function badge(st) { return '<span class="st st-' + st + '"><i></i>' + LABEL[st] + '</span>'; }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function setMsg(step, res, kind) { msgs[step] = res ? { text: res.message, kind: kind || (res.ok ? 'ok' : 'bad') } : null; }

    function apply(res, step, kind) {
      if (!started) { started = true; track('demo_start'); }
      if (res.ok) state = res.state;
      if (step) setMsg(step, res, kind);
      render(res.ok ? (res.flash || null) : null);
      return res.ok;
    }

    function render(flashIds) {
      var ev = R.evaluate(state);
      // rings (hero preview and board): same numbers, same source
      $$('[data-bind="ring"]').forEach(function (ring) {
        var pct = ev.complete / ev.total * 100;
        ring.querySelector('.ring-arc').style.strokeDasharray = pct + ' 100';
        ring.setAttribute('aria-label', ev.complete + ' من ' + ev.total + ' فحوص مكتملة');
        ring.setAttribute('data-done', String(ev.verdict.kind === 'done'));
      });
      $$('[data-bind="ring-num"]').forEach(function (el) { el.textContent = ev.complete + '/' + ev.total; });
      var pv = $('[data-bind="pv-list"]');
      if (pv) {
        var open = ev.items.filter(function (i) { return i.status !== 'pass'; });
        pv.innerHTML = open.length
          ? open.slice(0, 4).map(function (i) { return '<li>' + badge(i.status) + '<span>' + esc(i.title) + '</span></li>'; }).join('')
          : '<li>' + badge('pass') + '<span>فحوص السيناريو مكتملة، بانتظار المحاسب</span></li>';
      }
      var v = $('[data-bind="verdict"]');
      v.textContent = ev.verdict.text + (ev.verdict.kind === 'better' ? ' المتبقي: ' + ev.blockers.map(function (b) { return b.title; }).join('، ') + '.' : '');
      v.className = 'verdict v-' + ev.verdict.kind;
      $('[data-bind="checks"]').innerHTML = ev.items.map(function (i) {
        var fl = flashIds && flashIds.indexOf(i.id) > -1 ? ' class="flash"' : '';
        return '<tr' + fl + ' data-check="' + i.id + '"><td>' + esc(i.title) + (i.status !== 'pass' || i.id === 'inventory' ? '<small>' + esc(i.detail) + '</small>' : '') + '</td><td>' + badge(i.status) + '</td><td>' + esc(i.owner) + '</td></tr>';
      }).join('');
      $('[data-bind="l-bank"]').textContent = R.fmt(ev.ledger.bank);
      $('[data-bind="l-rent"]').textContent = R.fmt(ev.ledger.expense);
      $('[data-bind="l-accrued"]').textContent = R.fmt(ev.ledger.accrued);

      // step 1
      $$('[data-act="match"]').forEach(function (b) {
        var li = b.closest('li'), picked = state.matchedTo === b.dataset.id;
        li.setAttribute('data-picked', String(picked));
        b.textContent = picked ? 'ألغِ الربط' : 'اربط';
        b.disabled = !!state.matchedTo && !picked;
      });
      // step 2
      $('[data-bind="explain"]').hidden = !state.explained;
      $('[data-act="draft"]').disabled = state.accrual !== 'missing';
      $('[data-act="approve"]').disabled = state.accrual !== 'draft';
      // step 3
      $$('input[name="evid"]').forEach(function (r) { if (r.value === state.inventoryEvidence) r.checked = true; });
      // messages
      [1, 2, 3].forEach(function (n) {
        var el = $('[data-bind="msg-' + n + '"]'), m = msgs[n];
        el.textContent = m ? m.text : '';
        el.className = 'msg' + (m ? ' ' + m.kind : '');
      });
      // step states
      var done = {
        1: state.matchedTo === 'RV-1042',
        2: state.accrual === 'approved',
        3: state.inventoryEvidence === 'VAL-1031',
        4: ev.verdict.kind === 'done'
      };
      var current = [1, 2, 3, 4].filter(function (n) { return !done[n]; })[0];
      $$('.step').forEach(function (li) {
        var n = +li.dataset.step;
        li.setAttribute('data-state', done[n] ? 'done' : (n === current ? 'current' : 'todo'));
      });
      // evidence pack
      $('[data-bind="ba"]').innerHTML = ev.items.map(function (i, k) {
        return '<tr><td>' + esc(i.title) + '</td><td>' + badge(base.items[k].status) + '</td><td>' + badge(i.status) + '</td></tr>';
      }).join('');
      $('[data-bind="log"]').innerHTML = state.log.length
        ? state.log.map(function (l) { return '<li>' + esc(l.text) + (l.kind === 'decision' ? ' (المسؤول: المحاسب)' : '') + '</li>'; }).join('')
        : '<li>لا إجراءات بعد.</li>';
      if (ev.verdict.kind === 'done') trackOnce('demo_complete', { runs: state.runs });
    }

    var stepOf = { match: 1, explain: 2, draft: 2, approve: 2, evidence: 3, dismiss: 3, run: 4 };

    function act(name, el) {
      var res;
      switch (name) {
        case 'match':
          res = state.matchedTo === el.dataset.id ? R.unmatchBank(state) : R.matchBank(state, el.dataset.id);
          res.flash = ['bank']; break;
        case 'explain': res = R.explainAccrual(state); break;
        case 'draft': res = R.saveAccrualDraft(state); res.flash = ['expected', 'hygiene']; break;
        case 'approve': res = R.approveAccrual(state); res.flash = ['expected', 'hygiene']; break;
        case 'evidence':
          var picked = $('input[name="evid"]:checked');
          res = R.useInventoryEvidence(state, picked ? picked.value : ''); res.flash = ['inventory']; break;
        case 'dismiss':
          res = { ok: false, state: state, message: 'لا يُغلق الفحص بإخفاء التنبيه. يلزم دليل يغطي نهاية الفترة ويطابق الأستاذ.' };
          return apply(res, 3, 'info');
        case 'run': res = R.runChecks(state); res.flash = R.CHECKS.map(function (c) { return c.id; }); break;
        case 'reset':
          state = R.initial(); msgs = { 1: null, 2: null, 3: null }; render(); announce('أُعيدت التجربة إلى بدايتها.'); return;
        case 'example': return playExample();
        case 'skip':
          var on = el.getAttribute('aria-pressed') !== 'true';
          el.setAttribute('aria-pressed', String(on));
          $('#demo').classList.toggle('skip-guide', on); return;
      }
      if (!res) return;
      var ok = apply(res, stepOf[name] === 4 ? null : stepOf[name]);
      if (ok && stepOf[name]) track('demo_step', { step: stepOf[name], action: name });
    }

    var live = document.createElement('p'); live.className = 'sr'; live.setAttribute('role', 'status'); $('#demo').appendChild(live);
    function announce(t) { live.textContent = t; }

    $('#demo').addEventListener('click', function (e) {
      var b = e.target.closest('[data-act]');
      if (!b || b.disabled || playing) return;
      act(b.dataset.act, b);
    });

    function playExample() {
      state = R.initial(); msgs = { 1: null, 2: null, 3: null }; render();
      var seq = [
        function () { apply(R.matchBank(state, 'RV-1047'), 1); },
        function () { var r = R.matchBank(state, 'RV-1042'); r.flash = ['bank']; apply(r, 1); },
        function () { apply(R.explainAccrual(state), 2); setMsg(2, null); render(); },
        function () { var r = R.saveAccrualDraft(state); r.flash = ['expected', 'hygiene']; apply(r, 2); },
        function () { var r = R.approveAccrual(state); r.flash = ['expected', 'hygiene']; apply(r, 2); },
        function () { var r = R.useInventoryEvidence(state, 'VAL-1031'); r.flash = ['inventory']; apply(r, 3); },
        function () { var r = R.runChecks(state); r.flash = R.CHECKS.map(function (c) { return c.id; }); apply(r); }
      ];
      track('demo_example');
      if (reduce) { seq.forEach(function (f) { f(); }); announce('عُرض المثال كاملاً.'); return; }
      playing = true; var i = 0;
      (function next() {
        if (i >= seq.length) { playing = false; announce('انتهى المثال.'); return; }
        seq[i++](); setTimeout(next, 1100);
      })();
    }

    render();
  }

  /* ---------- Interest form ---------- */
  var form = $('#lead-form');
  if (form) {
    var out = $('#form-msg');
    var setErr = function (input, id, text) {
      $('#' + id).textContent = text || '';
      input.setAttribute('aria-invalid', text ? 'true' : 'false');
      return !text;
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = $('#f-email'), sector = $('#f-sector'), consent = $('#f-consent');
      var v = email.value.trim();
      var ok = setErr(email, 'e-email', !v ? 'اكتب بريدك الإلكتروني.' : (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? 'اكتب بريداً بالشكل name@company.com.' : ''));
      ok = setErr(sector, 'e-sector', sector.value ? '' : 'اختر القطاع.') && ok;
      ok = setErr(consent, 'e-consent', consent.checked ? '' : 'نحتاج موافقتك لنتواصل معك.') && ok;
      out.className = 'form-msg'; out.textContent = '';
      if (!ok) { var first = form.querySelector('[aria-invalid="true"]'); if (first) first.focus(); return; }
      if ($('#f-company').value) return; // honeypot
      var endpoint = form.getAttribute('data-endpoint');
      if (!endpoint) {
        out.className = 'form-msg bad';
        out.textContent = 'استقبال التسجيلات غير مفعّل في هذه النسخة بعد، فلم يُرسل شيء. سيُفعَّل قبل النشر العام.';
        return;
      }
      var btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'جارٍ الإرسال…';
      fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: v, sector: sector.value, need: $('#f-need').value, consent: true, company: '' })
      }).then(function (r) {
        if (!r.ok) throw new Error(String(r.status));
        out.className = 'form-msg ok'; out.textContent = 'وصل تسجيلك. نبلغك على بريدك عند الإطلاق.';
        form.reset(); track('lead_submit', { sector: sector.value });
      }).catch(function () {
        out.className = 'form-msg bad'; out.textContent = 'تعذّر الإرسال. تحقق من الاتصال وحاول مرة أخرى.';
      }).then(function () { btn.disabled = false; btn.textContent = 'سجّل اهتمامي'; });
    });
  }

  $$('[data-track]').forEach(function (a) { a.addEventListener('click', function () { track(a.dataset.track); }); });

})();
