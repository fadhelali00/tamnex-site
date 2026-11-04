// @ts-check
/* Stealth teaser: one-field waitlist. Without this file the form posts to /api/waitlist.php and lands on /joined/. */
(function () {
  'use strict';
  var form = /** @type {HTMLFormElement|null} */ (document.getElementById('wl-form'));
  if (!form) return;
  var f = form, D = f.dataset;
  var input = /** @type {HTMLInputElement} */ (document.getElementById('wl-email'));
  var errEl = /** @type {HTMLElement} */ (document.getElementById('wl-err'));
  var btn = /** @type {HTMLButtonElement} */ (f.querySelector('[data-wl-submit]'));
  var ok = /** @type {HTMLElement} */ (document.querySelector('[data-wl-ok]'));
  var langEl = /** @type {HTMLInputElement} */ (f.querySelector('[name="lang"]'));
  var hp = /** @type {HTMLInputElement} */ (document.getElementById('wl-website'));
  /** @param {string} text */
  var setErr = function (text) { errEl.textContent = text; input.setAttribute('aria-invalid', text ? 'true' : 'false'); };
  input.addEventListener('input', function () { if (errEl.textContent) setErr(''); });
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = input.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { setErr(D.eEmail || ''); input.focus(); return; }
    setErr(''); btn.disabled = true; btn.textContent = D.lSending || '';
    fetch(f.action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email, lang: langEl.value, website: hp.value }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.j.ok) { f.hidden = true; ok.hidden = false; ok.focus(); return; }
        if (res.status === 422) { setErr(D.eEmail || ''); input.focus(); return; }
        setErr(res.status === 429 ? (D.lRate || '') : (D.lFail || ''));
      })
      .catch(function () { setErr(D.lFail || ''); })
      .then(function () { btn.disabled = false; btn.textContent = D.lSubmit || ''; });
  });
})();
