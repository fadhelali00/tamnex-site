// @ts-check
/* Registration flow. Without this file the page is one complete form that posts to /api/preregister.php. */
(function () {
  'use strict';
  var form = /** @type {HTMLFormElement|null} */ (document.getElementById('start-form'));
  if (!form) return;
  var f = form;
  var D = f.dataset;
  /** @param {string} s @param {ParentNode} [r] @returns {any} */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  /** @param {string} s @param {ParentNode} [r] @returns {any[]} */
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var steps = $$('.step', f);
  var total = steps.length;
  var cur = 1;
  var RESERVED = ['admin', 'www', 'api', 'app', 'mail', 'status', 'help', 'docs', 'static', 'assets', 'cdn', 'auth', 'login', 'billing', 'support', 'mcp', 'tamnex', 'evexa'];
  var back = $('[data-back]', f), next = $('[data-next]', f), submit = $('[data-submit]', f), msg = $('#start-msg');

  /** @param {string} name */
  var val = function (name) {
    var el = f.elements.namedItem(name);
    if (!el) return '';
    if (el instanceof RadioNodeList) return el.value;
    if (el instanceof HTMLInputElement && el.type === 'checkbox') return el.checked;
    return /** @type {HTMLInputElement} */ (el).value.trim();
  };
  var params = new URLSearchParams(location.search);
  var plan = params.get('plan');
  if (plan && $('#s-plan option[value="' + CSS.escape(plan) + '"]')) $('#s-plan').value = plan;
  if (params.get('error') === 'duplicate') { msg.className = 'form-msg bad'; msg.textContent = D.lDup; }

  /** @param {string} id @param {string} text */
  var err = function (id, text) {
    var e = $('#se-' + id, f); if (e) e.textContent = text || '';
    var input = $('#s-' + id, f) || $('[name="' + id + '"]', f);
    if (input) input.setAttribute('aria-invalid', text ? 'true' : 'false');
    return !text;
  };

  var vatToggle = function () {
    var yes = val('vatreg') === 'yes';
    var wrap = $('#s-vat', f).closest('.field');
    wrap.hidden = !yes; $('#s-vat', f).disabled = !yes;
  };
  $$('[name="vatreg"]', f).forEach(function (r) { r.addEventListener('change', function () { vatToggle(); err('vatreg', ''); }); });

  /** Validates one step; returns the id of the first bad field or ''. @param {number} n */
  var check = function (n) {
    var bad = [];
    var need = function (/** @type {string} */ id, /** @type {boolean} */ ok, /** @type {string} */ text) { if (!err(id, ok ? '' : text)) bad.push(id); };
    if (n === 1) {
      need('company', !!val('company'), D.eReq);
      need('sector', !!val('sector'), D.eReq);
      need('size', !!val('size'), D.eReq);
      var cr = String(val('cr')).replace(/\D/g, '');
      need('cr', !cr || /^\d{10}$/.test(cr), D.eCr);
      var sub = String(val('subdomain')).toLowerCase();
      $('#s-subdomain', f).value = sub;
      need('subdomain', !sub || (/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(sub) && RESERVED.indexOf(sub) < 0), RESERVED.indexOf(sub) > -1 ? D.eSubReserved : D.eSub);
    }
    if (n === 2) {
      need('first', !!val('first'), D.eReq);
      need('last', !!val('last'), D.eReq);
      need('job', !!val('job'), D.eReq);
      need('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(val('email'))), D.eEmail);
      need('phone', /^0?5\d{8}$/.test(String(val('phone')).replace(/[\s-]/g, '')), D.ePhone);
      var pw = String($('#s-password', f).value);
      // Mirrors ERP BR-SEC-006 (12..128 characters, not built from the email); the common-password list is checked by the server.
      var pwLen = Array.from(pw).length, local = String($('#s-email', f).value).split('@')[0].toLowerCase();
      need('password', pwLen >= 12 && pwLen <= 128 && !(local.length >= 4 && pw.toLowerCase().indexOf(local) !== -1), D.ePw);
      need('password2', pw === String($('#s-password2', f).value), D.ePw2);
    }
    if (n === 3) {
      need('vatreg', !!val('vatreg'), D.eReq);
      if (val('vatreg') === 'yes') need('vat', /^3\d{13}3$/.test(String(val('vat')).replace(/\D/g, '')), D.eVat);
      need('terms', !!val('terms'), D.eTerms);
    }
    return bad[0] || '';
  };

  var label = function (/** @type {string} */ name) {
    var el = $('#s-' + name, f);
    if (el && el.tagName === 'SELECT') return el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
    return String(val(name));
  };
  var review = function () {
    var groups = [
      [1, ['company', 'sector', 'size', 'branches', 'cr', 'subdomain']],
      [2, ['first', 'last', 'job', 'email', 'phone']],
      [3, ['vat', 'fy', 'plan']]
    ];
    $('[data-review]', f).innerHTML = groups.map(function (g) {
      var legend = $('legend', steps[/** @type {number} */ (g[0]) - 1]).textContent;
      var rows = /** @type {string[]} */ (g[1]).filter(function (n) { return val(n) && !(n === 'vat' && val('vatreg') !== 'yes'); }).map(function (n) {
        var lab = $('label[for="s-' + n + '"]', f);
        var shown = n === 'phone' ? '+966 ' + String(val('phone')).replace(/^0/, '') : n === 'subdomain' ? val('subdomain') + '.tamnex.com' : label(n);
        return '<div><dt>' + esc(lab ? lab.firstChild.textContent.trim() : n) + '</dt><dd>' + esc(String(shown)) + '</dd></div>';
      }).join('');
      if (g[0] === 3) rows = '<div><dt>' + esc($('.radios legend', f).textContent) + '</dt><dd>' + esc(val('vatreg') === 'yes' ? D.lYes : D.lNo) + '</dd></div>' + rows;
      return '<div class="rv-group"><div class="rv-head"><b>' + esc(legend) + '</b><button type="button" class="link-btn" data-goto="' + g[0] + '">' + esc(legend) + ' ✎</button></div>' + rows + '</div>';
    }).join('');
  };
  /** @param {string} s */
  var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return /** @type {any} */ ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };

  /** @param {number} n @param {boolean} focus */
  var show = function (n, focus) {
    cur = n;
    steps.forEach(function (s, i) { s.hidden = i + 1 !== n; });
    $$('[data-p]').forEach(function (li) {
      var k = +li.getAttribute('data-p');
      if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      li.classList.toggle('done', k < n);
    });
    $('[data-step-of]', f).textContent = D.lStep.replace('{n}', String(n)).replace('{t}', String(total));
    back.hidden = n === 1;
    next.hidden = n === total;
    submit.hidden = n !== total;
    if (n === total) review();
    if (focus) { var legend = $('legend', steps[n - 1]); legend.tabIndex = -1; legend.focus(); }
  };

  next.addEventListener('click', function () {
    var bad = check(cur);
    if (bad) { var el = $('#s-' + bad, f) || $('[name="' + bad + '"]', f); if (el) el.focus(); return; }
    show(cur + 1, true);
  });
  back.addEventListener('click', function () { show(cur - 1, true); });
  f.addEventListener('click', function (e) {
    var g = /** @type {HTMLElement} */ (e.target).closest('[data-goto]');
    if (g) show(+g.getAttribute('data-goto'), true);
  });

  f.addEventListener('submit', function (e) {
    e.preventDefault();
    for (var n = 1; n < total; n++) { var bad = check(n); if (bad) { show(n, false); var el = $('#s-' + bad, f) || $('[name="' + bad + '"]', f); if (el) el.focus(); return; } }
    if (val('website')) return;
    var phone = String(val('phone')).replace(/[\s-]/g, '').replace(/^0/, '');
    var body = {
      lang: D.lang, company: val('company'), sector: val('sector'), size: val('size'), branches: val('branches'),
      cr: String(val('cr')).replace(/\D/g, ''), subdomain: val('subdomain'), first: val('first'), last: val('last'), job: val('job'),
      email: val('email'), phone: '+966' + phone, password: String($('#s-password', f).value), vatreg: val('vatreg'), vat: String(val('vat')).replace(/\D/g, ''), fy: val('fy'), plan: val('plan'),
      terms: true, marketing: !!val('marketing'), website: ''
    };
    submit.disabled = true; submit.textContent = D.lSending; msg.textContent = ''; msg.className = 'form-msg';
    fetch(D.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.j.ok) {
          $('#s-password', f).value = ''; $('#s-password2', f).value = '';
          f.hidden = true;
          var hold = $('[data-holding]');
          hold.hidden = false;
          $('[data-ref]', hold).textContent = res.j.ref;
          $('#n-email').value = body.email;
          hold.setAttribute('data-ref-value', res.j.ref);
          $$('[data-progress] li').forEach(function (li) { li.classList.add('done'); li.removeAttribute('aria-current'); });
          hold.focus({ preventScroll: true }); hold.scrollIntoView({ block: 'start', behavior: 'auto' });
          var w = /** @type {any} */ (window); (w.tamnexEvents = w.tamnexEvents || []).push({ name: 'prereg_submit', data: { plan: body.plan || 'none' }, t: Date.now() });
          return;
        }
        if (res.status === 409) { msg.className = 'form-msg bad'; msg.textContent = D.lDup; return; }
        if (res.status === 422 && res.j.fields) {
          var map = { company: 1, sector: 1, size: 1, branches: 1, cr: 1, subdomain: 1, first: 2, last: 2, job: 2, email: 2, phone: 2, password: 2, vatreg: 3, vat: 3, fy: 3, plan: 3, terms: 3 };
          var first = res.j.fields[0]; show(/** @type {any} */ (map)[first] || 1, false); check(/** @type {any} */ (map)[first] || 1);
          var fe = $('#s-' + first, f); if (fe) fe.focus();
          return;
        }
        throw new Error(String(res.status));
      })
      .catch(function () { msg.className = 'form-msg bad'; msg.textContent = D.lFail; })
      .then(function () { submit.disabled = false; submit.textContent = D.lSubmit; });
  });

  var notify = $('[data-notify]');
  if (notify) {
    notify.addEventListener('submit', function (/** @type {Event} */ e) {
      e.preventDefault();
      var email = $('#n-email').value.trim(), out = $('[data-notify-msg]');
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
      $('#ne-email').textContent = ok ? '' : notify.dataset.eEmail;
      $('#n-email').setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok) return;
      fetch(D.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notify', ref: $('[data-holding]').getAttribute('data-ref-value'), email: email, lang: D.lang }) })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); out.className = 'form-msg ok'; out.textContent = notify.dataset.lOk; })
        .catch(function () { out.className = 'form-msg bad'; out.textContent = notify.dataset.lFail; });
    });
  }

  var tog = $('[data-pw-toggle]', f);
  if (tog) tog.addEventListener('click', function () {
    var i = $('#s-password', f), show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    tog.textContent = show ? tog.dataset.lHide : tog.dataset.lShow;
    tog.setAttribute('aria-pressed', String(show));
  });
  document.documentElement.classList.add('steps-on');
  $$('[data-js-step]').forEach(function (s) { s.removeAttribute('hidden'); });
  vatToggle();
  show(1, false);
})();
