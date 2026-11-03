// @ts-check
/**
 * Renders the public pages from three inputs and nothing else:
 *   src/i18n/{ar,en}.json   words
 *   data/pricing-catalog.json   prices, features, limits (through scripts/catalog.mjs)
 *   this file   structure
 * Output: site/index.html, site/pricing/index.html, site/en/index.html, site/en/pricing/index.html,
 * plus site/data/pricing-catalog.json (a derived copy for the browser). No price literal lives here.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { loadCatalog, publicPlans, priceFor, money, valueLabel } from './catalog.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE = 'https://tamnex.com';
const catalog = loadCatalog();
/** @type {Record<'ar'|'en', Record<string, any>>} */
const T = {
  ar: JSON.parse(readFileSync(ROOT + 'src/i18n/ar.json', 'utf8')),
  en: JSON.parse(readFileSync(ROOT + 'src/i18n/en.json', 'utf8'))
};

/** @param {unknown} s */
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] || c);
/** @param {'ar'|'en'} lang @param {string} path */
const href = (lang, path) => (lang === 'ar' ? '' : '/en') + path;
/** @param {string} s @param {Record<string,string|number>} v */
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));

/** @param {'ar'|'en'} lang @param {'home'|'pricing'} page */
function head(lang, page) {
  const t = T[lang];
  const path = page === 'home' ? '/' : '/pricing/';
  const title = page === 'home' ? t.title_home : t.title_pricing;
  const desc = page === 'home' ? t.desc_home : t.desc_pricing;
  const url = SITE + href(lang, path);
  return `<!doctype html>
<html lang="${t.lang}" dir="${t.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="ar" href="${SITE + path}">
<link rel="alternate" hreflang="en" href="${SITE + '/en' + path}">
<link rel="alternate" hreflang="x-default" href="${SITE + path}">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#f8fafc" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#090d16" media="(prefers-color-scheme: dark)">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'; object-src 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Tamnex">
<meta property="og:locale" content="${t.ogLocale}">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(t.og_title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/brand/tamnex-mark.svg" type="image/svg+xml">
<link rel="preload" href="/assets/fonts/ibm-plex-sans-arabic-${lang === 'ar' ? 'arabic' : 'latin'}-600-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/styles.css">
<script src="/assets/theme.js"></script>
<script src="/assets/readiness.js" defer></script>
<script src="/assets/app.js" defer></script>
</head>`;
}

/** @param {'ar'|'en'} lang @param {'home'|'pricing'} page */
function header(lang, page) {
  const t = T[lang];
  const otherPath = (t.otherLang === 'ar' ? '' : '/en') + (page === 'home' ? '/' : '/pricing/');
  const wordmark = lang === 'ar' ? 'tamnex-wordmark-ar.svg' : 'tamnex-wordmark.svg';
  const w = lang === 'ar' ? 111 : 118;
  const sec = (/** @type {string} */ id) => (page === 'home' ? '' : href(lang, '/')) + '#' + id;
  return `<a class="skip" href="#main">${esc(t.skip)}</a>
<header class="topbar" data-topbar>
  <div class="topbar-in">
    <a class="brand" href="${href(lang, '/')}"><img src="/brand/${wordmark}" alt="${esc(t.brand_alt)}" width="${w}" height="36"></a>
    <nav class="nav" id="site-nav" aria-label="${esc(t.nav_label)}" data-nav>
      <a href="${sec('product')}">${esc(t.nav_product)}</a>
      <a href="${sec('features')}">${esc(t.nav_features)}</a>
      <a href="${sec('nexa')}">${esc(t.nav_nexa)}</a>
      <a href="${href(lang, '/pricing/')}"${page === 'pricing' ? ' aria-current="page"' : ''}>${esc(t.nav_pricing)}</a>
      <a href="${sec('faq')}">${esc(t.nav_faq)}</a>
      <a class="lang" href="${otherPath}" hreflang="${t.otherLang}" lang="${t.otherLang}">${esc(t.otherLangName)}</a>
      <a class="btn btn-sm nav-cta" href="${sec('request')}">${esc(t.nav_request)}</a>
    </nav>
    <button class="icon-btn theme-btn" type="button" data-theme-btn aria-label="${esc(t.theme_label)}: ${esc(t.theme_system)}" data-l-light="${esc(t.theme_light)}" data-l-dark="${esc(t.theme_dark)}" data-l-system="${esc(t.theme_system)}" data-l-label="${esc(t.theme_label)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9A7 7 0 0 1 12 3Z"/></svg>
    </button>
    <button class="icon-btn menu-btn" type="button" aria-expanded="false" aria-controls="site-nav" data-menu-btn data-l-open="${esc(t.menu_open)}" data-l-close="${esc(t.menu_close)}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg><span class="sr">${esc(t.menu_open)}</span>
    </button>
  </div>
</header>`;
}

/** @param {'ar'|'en'} lang */
function showcase(lang) {
  const t = T[lang];
  const tabs = [['acc', t.tab_acc], ['inv', t.tab_inv], ['pur', t.tab_pur], ['ai', t.tab_ai]];
  void orb;
  const table = (/** @type {string[]} */ cols, /** @type {string[][]} */ rows, /** @type {string[]|null} */ foot) =>
    `<div class="tscroll" tabindex="0" role="region" aria-label="${esc(t.sc_label)}"><table class="ui-table"><thead><tr>${cols.map((c, i) => `<th scope="col"${i ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td class="n"><bdi>${esc(c)}</bdi></td>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>${foot ? `<tfoot><tr><td>${esc(t.sc_total)}</td>${foot.map(f => `<td class="n"><bdi>${esc(f)}</bdi></td>`).join('')}</tr></tfoot>` : ''}</table></div>`;
  const panels = {
    acc: `<div class="ui-head"><b>${esc(t.sc_acc_title)}</b><span class="chip chip-ok"><i></i>${esc(t.sc_acc_state)}</span></div>${table(t.sc_cols_entry, t.sc_acc_rows, t.sc_acc_totals)}<p class="ui-note">${esc(t.sc_acc_note)}</p>`,
    inv: `<div class="ui-head"><b>${esc(t.sc_inv_title)}</b></div>${table(t.sc_cols_inv, t.sc_inv_rows, null)}<p class="ui-note">${esc(t.sc_inv_note)}</p>`,
    pur: `<div class="ui-head"><b>${esc(t.sc_pur_title)}</b></div><ol class="ui-flow">${t.sc_pur_steps.map((/** @type {string[]} */ s) => `<li><b>${esc(s[0])}</b><span><bdi>${esc(s[1])}</bdi></span></li>`).join('')}</ol><p class="ui-note">${esc(t.sc_pur_note)}</p>`,
    ai: `<div class="ui-head"><b>${esc(t.sc_ai_title)}</b><span class="chip chip-soon">${esc(t.soon)}</span></div><ul class="ui-insights">${t.sc_ai_items.map((/** @type {string[]} */ s) => `<li><b>${esc(s[0])}</b><span>${esc(s[1])}</span></li>`).join('')}</ul><p class="ui-note">${esc(t.sc_ai_note)}</p>`
  };
  return `<div class="showcase" data-showcase>
    <div class="sc-bar"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="sc-label">${esc(t.sc_label)}</span></div>
    <div class="sc-tabs" role="tablist" aria-label="${esc(t.sc_tabs_label)}">
      ${tabs.map(([id, name], i) => `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(name)}</button>`).join('')}
    </div>
    <div class="sc-body">
      <p class="sc-company">${esc(t.sc_company)}</p>
      ${tabs.map(([id], i) => `<div class="sc-panel" role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" tabindex="0"${i ? ' data-inactive' : ''}>${/** @type {any} */ (panels)[id]}</div>`).join('')}
    </div>
  </div>`;
}

/** @param {'ar'|'en'} lang */
function demo(lang) {
  const t = T[lang];
  const ex = [['bank', t.demo_ex_bank, t.demo_act_bank, t.demo_done_bank], ['accrual', t.demo_ex_accrual, t.demo_act_accrual, t.demo_done_accrual], ['inventory', t.demo_ex_inventory, t.demo_act_inventory, t.demo_done_inventory]];
  return `<div class="demo" data-demo data-l-done="${esc(t.demo_checks_done)}" data-l-stale="${esc(t.demo_stale)}" data-l-open="${esc(t.demo_open)}" data-l-better="${esc(t.demo_better)}" data-l-complete="${esc(t.demo_complete)}">
    <p class="demo-label">${esc(t.demo_label)} · ${esc(t.demo_period)}</p>
    <div class="demo-rings">
      <div class="ring" data-ring="before"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="r-track" cx="60" cy="60" r="50"/><circle class="r-arc r-5" cx="60" cy="60" r="50" pathLength="100"/></svg><span class="ring-n"><bdi>5/8</bdi><small>${esc(t.demo_before)}</small></span></div>
      <div class="ring" data-ring="after" role="img" aria-label="${esc(fill(t.demo_checks_done, { n: 5, t: 8 }))}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="r-track" cx="60" cy="60" r="50"/><circle class="r-arc r-5" cx="60" cy="60" r="50" pathLength="100" data-arc/></svg><span class="ring-n"><bdi data-ring-n>5/8</bdi><small>${esc(t.demo_after)}</small></span></div>
    </div>
    <ul class="demo-ex">
      ${ex.map(([id, label, act, done]) => `<li data-ex="${id}"><span class="ex-text"><b>${esc(label)}</b><small data-done-text hidden>${esc(done)}</small></span><button type="button" class="btn btn-ghost btn-sm" data-ex-act="${id}">${esc(act)}</button></li>`).join('')}
    </ul>
    <div class="demo-foot">
      <button type="button" class="btn btn-sm" data-demo-run>${esc(t.demo_run)}</button>
      <button type="button" class="btn btn-ghost btn-sm" data-demo-reset>${esc(t.demo_reset)}</button>
    </div>
    <p class="verdict v-open" data-verdict aria-live="polite">${esc(t.demo_open)}</p>
  </div>`;
}


/** Geometric light core for Nexa (no robot, no chat bubble). @param {string} cls */
let orbN = 0;
const orb = cls => { const g = 'nx-g' + (++orbN); return `<svg class="${cls}" viewBox="0 0 48 48" aria-hidden="true"><defs><radialGradient id="${g}" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#e0e7ff"/><stop offset=".45" stop-color="#818cf8"/><stop offset="1" stop-color="#2563eb"/></radialGradient></defs><circle class="orb-pulse" cx="24" cy="24" r="22" fill="none" stroke="#6366f1" stroke-width="1"/><circle cx="24" cy="24" r="14" fill="url(#${g})"/><path d="M24 14l2.6 7.4L34 24l-7.4 2.6L24 34l-2.6-7.4L14 24l7.4-2.6Z" fill="#fff" opacity=".9"/></svg>`; };

/** @param {'ar'|'en'} lang */
function nexa(lang) {
  const t = T[lang];
  const tbl = (/** @type {string[]} */ cols, /** @type {string[][]} */ rows) => `<div class="tscroll" tabindex="0" role="region" aria-label="${esc(t.sc_label)}"><table class="ui-table"><thead><tr>${cols.map((c, i) => `<th scope="col"${i ? ' class="n"' : ''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => i ? `<td class="n"><bdi>${esc(c)}</bdi></td>` : `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const tabs = [['s1', t.nx_s1_tab], ['s2', t.nx_s2_tab], ['s3', t.nx_s3_tab]];
  const s1 = `<div class="cmd"><span class="kbd" dir="ltr">${esc(t.nx_s1_kbd)}</span>${orb('orb orb-sm')}<span class="cmd-q" data-type="${esc(t.nx_s1_q)}">${esc(t.nx_s1_q)}</span></div>
      <div class="nx-answer"><p class="nx-who">${esc(t.nexa_badge)}</p><p>${esc(t.nx_s1_a)}</p>${tbl(t.nx_s1_cols, t.nx_s1_rows)}
      <button type="button" class="btn btn-ghost btn-sm" data-nx-act="s1">${esc(t.nx_s1_btn)}</button><p class="nx-done" data-nx-done="s1" hidden>${esc(t.nx_s1_done)}</p></div>`;
  const s2 = `<div class="radar"><div class="radar-ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="r-track" cx="60" cy="60" r="50"/><circle class="r-arc nx-arc" cx="60" cy="60" r="50" pathLength="1000"/></svg><span class="ring-n"><bdi>${esc(t.nx_s2_pct)}</bdi></span></div>
      <div><p class="nx-h">${esc(t.nx_s2_head)}</p><p class="nx-ready"><bdi>${esc(t.nx_s2_pct)}</bdi> ${esc(t.nx_s2_ready)}</p><p class="fine">${esc(t.nx_s2_den)}</p></div></div>
      <ul class="nx-checks">${t.nx_s2_items.map((/** @type {string[]} */ r, /** @type {number} */ i) => `<li><span>${esc(r[0])}</span>${i === t.nx_s2_items.length - 1 ? `<span class="chip chip-soon"><bdi>${esc(r[1])}</bdi></span>` : `<span class="chip chip-ok"><i></i>${esc(r[1])}</span>`}</li>`).join('')}</ul>
      <div class="nx-answer"><p class="nx-who">${esc(t.nexa_badge)}</p><p>${esc(t.nx_s2_sugg)}</p>${tbl(t.nx_s2_cols, t.nx_s2_rows)}
      <button type="button" class="btn btn-ghost btn-sm" data-nx-act="s2">${esc(t.nx_s2_btn)}</button><p class="nx-done" data-nx-done="s2" hidden>${esc(t.nx_s2_done)}</p></div>`;
  const s3 = `<div class="po"><div class="ui-head"><b>${esc(t.nx_s3_head)}</b><span class="fine">${esc(t.nx_s3_vendor)}</span></div>
      <div class="capsule">${orb('orb orb-sm')}<div><p class="nx-who">${esc(t.nexa_badge)}</p><p>${esc(t.nx_s3_price)}</p><p>${esc(t.nx_s3_stock)}</p><p class="nx-prop">${esc(t.nx_s3_prop)}</p>
      <button type="button" class="btn btn-sm" data-nx-act="s3">${esc(t.nx_s3_btn)}</button><p class="nx-done" data-nx-done="s3" hidden>${esc(t.nx_s3_done)}</p></div></div></div>`;
  const panels = { s1, s2, s3 };
  return `<section class="section nexa" id="nexa" aria-labelledby="nx-title">
  <div class="wrap">
    <div class="nx-head">${orb('orb orb-lg')}<div><h2 id="nx-title">${esc(t.nx_title)}</h2><p class="lead">${esc(t.nx_sub)}</p>
      <p class="nx-tags"><span class="demo-label">${esc(t.nx_label)}</span> <span class="chip chip-soon">${esc(t.soon)}</span></p></div></div>
    <div class="nx-stage card">
      <div class="sc-tabs" role="tablist" aria-label="${esc(t.nx_scenes_label)}">
        ${tabs.map(([id, name], i) => `<button type="button" role="tab" id="tab-${id}" aria-controls="panel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${esc(name)}</button>`).join('')}
      </div>
      ${tabs.map(([id], i) => `<div class="nx-panel" role="tabpanel" id="panel-${id}" aria-labelledby="tab-${id}" tabindex="0"${i ? ' data-inactive' : ''}>${/** @type {any} */ (panels)[id]}</div>`).join('')}
    </div>
    <ul class="nx-rules">${t.nx_rules.map((/** @type {string} */ r) => `<li>${esc(r)}</li>`).join('')}</ul>
  </div>
</section>`;
}

/** @param {'ar'|'en'} lang */
function features(lang) {
  const t = T[lang];
  const soon = `<span class="chip chip-soon">${esc(t.soon)}</span>`;
  return `<section class="section" id="features" aria-labelledby="f-title">
  <div class="wrap">
    <h2 id="f-title">${esc(t.f_title)}</h2>
    <p class="lead">${esc(t.f_sub)}</p>
    <div class="bento">
      <article class="card c-close"><div class="card-head"><h3>${esc(t.close_title)}</h3>${soon}</div><p>${esc(t.close_body)}</p>${demo(lang)}</article>
      <article class="card c-cycle"><h3>${esc(t.cycle_title)}</h3><p>${esc(t.cycle_body)}</p><ol class="flow">${t.cycle_steps.map((/** @type {string} */ s) => `<li>${esc(s)}</li>`).join('')}</ol></article>
      <article class="card c-ai"><div class="card-head"><h3>${esc(t.ai_title)}</h3>${soon}</div><p>${esc(t.ai_body)}</p><ul class="ticks">${t.ai_points.map((/** @type {string} */ s) => `<li>${esc(s)}</li>`).join('')}</ul><a class="btn btn-ghost btn-sm nx-ask" href="#nexa">${esc(t.nexa_ask)}</a></article>
      <article class="card c-sec"><h3>${esc(t.sec_title)}</h3><ul class="ticks">${t.sec_points.map((/** @type {string} */ s) => `<li>${esc(s)}</li>`).join('')}</ul></article>
      <article class="card c-mig"><div class="card-head"><h3>${esc(t.mig_title)}</h3>${soon}</div><p>${esc(t.mig_body)}</p></article>
      <article class="card c-dist"><div class="card-head"><h3>${esc(t.dist_title)}</h3>${soon}</div><p>${esc(t.dist_body)}</p></article>
    </div>
  </div>
</section>`;
}

/** Price block text for both cycles, from the catalog. @param {'ar'|'en'} lang @param {import('./catalog.mjs').Plan} p */
function priceBlock(lang, p) {
  const t = T[lang];
  if (p.pricing.kind !== 'listed') {
    return `<div class="price"><span class="amount amount-text">${esc(t.on_request)}</span></div><p class="billed">${esc(t.on_request_sub)}</p>`;
  }
  const m = /** @type {NonNullable<ReturnType<typeof priceFor>>} */ (priceFor(catalog, p, 'monthly'));
  const a = /** @type {NonNullable<ReturnType<typeof priceFor>>} */ (priceFor(catalog, p, 'annual'));
  const def = catalog.defaultCycle === 'monthly' ? m : a;
  const amt = { monthly: money(m.perMonth, lang), annual: money(a.perMonth, lang) };
  const billed = {
    monthly: fill(t.billed_monthly, { total: money(m.chargedTotal, lang) }),
    annual: fill(t.billed_annual, { net: money(a.charged, lang), total: money(a.chargedTotal, lang) })
  };
  const k = def.cycle;
  return `<div class="price"><span class="amount" data-monthly="${amt.monthly}" data-annual="${amt.annual}"><bdi>${amt[k]}</bdi></span><span class="unit">${esc(t.currency)} ${esc(t.per_month)}<small>${esc(t.before_vat)}</small></span></div>
      <p class="billed" data-monthly="${esc(billed.monthly)}" data-annual="${esc(billed.annual)}">${esc(billed[k])}</p>`;
}

/** @param {'ar'|'en'} lang @param {boolean} full */
function pricing(lang, full) {
  const t = T[lang];
  const plans = publicPlans(catalog);
  const feats = catalog.features;
  const req = (/** @type {string} */ id) => href(lang, '/') + `?plan=${id}#request`;
  const toggle = `<div class="cycle" role="radiogroup" aria-label="${esc(t.cycle_label)}" data-cycle>
      ${catalog.cycles.map(c => `<button type="button" role="radio" data-c="${c}" aria-checked="${c === catalog.defaultCycle}" tabindex="${c === catalog.defaultCycle ? 0 : -1}">${esc(c === 'monthly' ? t.cycle_monthly : t.cycle_annual)}</button>`).join('')}
    </div>`;
  const cards = plans.map(p => {
    const listed = p.pricing.kind === 'listed';
    return `<article class="plan${p.highlight ? ' plan-hl' : ''}" data-plan="${p.id}">
      <div class="plan-top"><h3>${esc(p.name[lang])}</h3>${p.highlight ? `<span class="chip chip-hl">${esc(p.highlight[lang])}</span>` : ''}</div>
      <p class="aud">${esc(p.audience[lang])}</p>
      ${priceBlock(lang, p)}
      <a class="btn ${p.highlight ? '' : 'btn-ghost'} btn-block" href="${req(p.id)}" data-choose="${p.id}">${esc(listed ? t.choose_plan : t.contact_sales)}</a>
      <p class="incl">${esc(t.card_more)}</p>
      <ul class="ticks">${p.highlights.map(fid => { const f = /** @type {import('./catalog.mjs').Feature} */ (feats.find(x => x.id === fid)); const v = valueLabel(catalog, p, f, t); return `<li><span>${esc(f.name[lang])}</span><b>${esc(v.label)}</b>${v.soon ? ` <span class="chip chip-soon">${esc(t.soon)}</span>` : ''}</li>`; }).join('')}</ul>
    </article>`;
  }).join('');
  const groups = ['core', 'limits', 'advanced', 'ai', 'enterprise'];
  const table = `<div class="table-scroll" tabindex="0" role="region" aria-labelledby="cmp-title"><table class="compare">
      <caption id="cmp-title">${esc(t.compare_title)}</caption>
      <thead><tr><th scope="col">${esc(t.compare_feature)}</th>${plans.map(p => `<th scope="col"${p.highlight ? ' class="hl"' : ''}>${esc(p.name[lang])}</th>`).join('')}</tr></thead>
      ${groups.map(g => `<tbody><tr class="grp"><th scope="rowgroup" colspan="${plans.length + 1}">${esc(t['group_' + g])}</th></tr>${feats.filter(f => f.group === g).map(f => `<tr><th scope="row">${esc(f.name[lang])}</th>${plans.map(p => { const v = valueLabel(catalog, p, f, t); return `<td class="${v.included ? 'yes' : 'no'}${p.highlight ? ' hl' : ''}">${esc(v.label)}${v.soon ? `<br><span class="chip chip-soon">${esc(t.soon)}</span>` : ''}</td>`; }).join('')}</tr>`).join('')}</tbody>`).join('')}
    </table></div>`;
  return `<section class="section pricing" id="pricing" aria-labelledby="p-title">
  <div class="wrap">
    <div class="p-head">
      <div>${full ? `<h1 id="p-title">${esc(t.p_title)}</h1>` : `<h2 id="p-title">${esc(t.p_title)}</h2>`}<p class="lead">${esc(t.p_sub)}</p></div>
      ${toggle}
    </div>
    <div class="plans">${cards}</div>
    <p class="prelaunch">${esc(t.prelaunch)}</p>
    ${full ? table + `<p class="fine">${esc(t.soon_note)}</p>` : `<p class="compare-link"><a class="link" href="${href(lang, '/pricing/')}">${esc(t.compare_link)}</a></p>`}
    <p class="fine price-version">${esc(fill(t.price_version, { v: catalog.catalogVersion }))}</p>
  </div>
</section>`;
}

/** @param {string[][]} items @param {string} id @param {string} title @param {'h2'|'h2'} tag */
function faq(items, id, title, tag) {
  return `<section class="section faq" id="${id}" aria-labelledby="${id}-title">
  <div class="wrap narrow">
    <${tag} id="${id}-title">${esc(title)}</${tag}>
    ${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}
  </div>
</section>`;
}

/** @param {'ar'|'en'} lang */
function request(lang) {
  const t = T[lang];
  const plans = publicPlans(catalog);
  const field = (/** @type {string} */ id, /** @type {string} */ label, /** @type {string} */ input) => `<div class="field"><label for="f-${id}">${esc(label)}</label>${input}<p class="err" id="e-${id}"></p></div>`;
  return `<section class="section request" id="request" aria-labelledby="r-title">
  <div class="wrap r-grid">
    <div><h2 id="r-title">${esc(t.r_title)}</h2><p class="lead">${esc(t.r_sub)}</p></div>
    <form class="form card" id="lead-form" action="/api/interest.php" method="post" novalidate data-endpoint="/api/interest.php" data-lang="${lang}"
      data-l-ok="${esc(t.r_ok)}" data-l-fail="${esc(t.r_fail)}" data-l-rate="${esc(t.r_rate)}" data-l-sending="${esc(t.r_sending)}" data-l-submit="${esc(t.r_submit)}"
      data-e-name="${esc(t.e_name)}" data-e-email="${esc(t.e_email)}" data-e-phone="${esc(t.e_phone)}" data-e-company="${esc(t.e_company)}" data-e-sector="${esc(t.e_sector)}" data-e-consent="${esc(t.e_consent)}">
      <div class="row2">
        ${field('name', t.r_name, `<input id="f-name" name="name" autocomplete="name" required aria-describedby="e-name" maxlength="120">`)}
        ${field('company', t.r_company, `<input id="f-company" name="company" autocomplete="organization" required aria-describedby="e-company" maxlength="160">`)}
      </div>
      <div class="row2">
        ${field('email', t.r_email, `<input id="f-email" name="email" type="email" inputmode="email" autocomplete="email" dir="ltr" required aria-describedby="e-email" maxlength="254">`)}
        ${field('phone', t.r_phone, `<input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" dir="ltr" required aria-describedby="e-phone" maxlength="20">`)}
      </div>
      <div class="row3">
        ${field('sector', t.r_sector, `<select id="f-sector" name="sector" required aria-describedby="e-sector"><option value="">${esc(t.r_sector_ph)}</option>${t.r_sectors.map((/** @type {string[]} */ s) => `<option value="${s[0]}">${esc(s[1])}</option>`).join('')}</select>`)}
        ${field('branches', t.r_branches, `<select id="f-branches" name="branches">${t.r_branches_opts.map((/** @type {string[]} */ s) => `<option value="${s[0]}">${esc(s[1])}</option>`).join('')}</select>`)}
        ${field('plan', t.r_plan, `<select id="f-plan" name="plan"><option value="">${esc(t.r_plan_none)}</option>${plans.map(p => `<option value="${p.id}">${esc(p.name[lang])}</option>`).join('')}</select>`)}
      </div>
      <div class="hp" aria-hidden="true"><label for="f-website">Website</label><input id="f-website" name="website" tabindex="-1" autocomplete="off"></div>
      <div class="field consent"><label><input id="f-consent" name="consent" type="checkbox" required aria-describedby="e-consent"> ${esc(t.r_consent)}</label><p class="err" id="e-consent"></p>
        <details class="privacy"><summary>${esc(t.r_privacy_title)}</summary><p>${esc(t.r_privacy)}</p></details></div>
      <button class="btn btn-lg" type="submit">${esc(t.r_submit)}</button>
      <p class="form-msg" id="form-msg" role="status" aria-live="polite"></p>
    </form>
  </div>
</section>`;
}

/** @param {'ar'|'en'} lang */
function footer(lang) {
  const t = T[lang];
  const wordmark = lang === 'ar' ? 'tamnex-wordmark-ar.svg' : 'tamnex-wordmark.svg';
  return `<footer class="foot"><div class="wrap foot-in">
  <div><img src="/brand/${wordmark}" alt="${esc(t.brand_alt)}" width="148" height="48" loading="lazy"><p>${esc(t.footer_tag)}</p></div>
  <nav aria-label="${esc(t.footer_nav)}" class="foot-nav">
    <a href="${href(lang, '/')}#product">${esc(t.nav_product)}</a><a href="${href(lang, '/')}#features">${esc(t.nav_features)}</a><a href="${href(lang, '/pricing/')}">${esc(t.nav_pricing)}</a><a href="${href(lang, '/')}#faq">${esc(t.nav_faq)}</a><a href="${href(lang, '/')}#request">${esc(t.nav_request)}</a>
  </nav>
  <p class="legal"><span dir="ltr">Tamnex by Evexa</span> · ${esc(t.rights)}</p>
</div></footer>`;
}

/** @param {'ar'|'en'} lang */
function home(lang) {
  const t = T[lang];
  return `${head(lang, 'home')}
<body>
${header(lang, 'home')}
<main id="main">
<section class="hero" id="product" aria-labelledby="hero-title">
  <div class="wrap hero-grid">
    <div class="hero-text">
      <h1 id="hero-title">${esc(t.hero_h1)}</h1>
      <p class="lead">${esc(t.hero_sub)}</p>
      <div class="actions"><a class="btn btn-lg" href="#pricing">${esc(t.cta_choose)}</a><a class="btn btn-lg btn-ghost" href="#request">${esc(t.cta_demo)}</a></div>
      <ul class="points">${t.hero_points.map((/** @type {string} */ s) => `<li>${esc(s)}</li>`).join('')}</ul>
    </div>
    ${showcase(lang)}
  </div>
</section>
<section class="trust" aria-labelledby="trust-title">
  <div class="wrap"><h2 id="trust-title" class="trust-title">${esc(t.trust_label)}</h2>
  <ul class="trust-grid">${t.trust_items.map((/** @type {string[]} */ s) => `<li><b>${esc(s[0])}</b><span>${esc(s[1])}</span></li>`).join('')}</ul></div>
</section>
${features(lang)}
${nexa(lang)}
${pricing(lang, false)}
${faq(t.faq, 'faq', t.faq_title, 'h2')}
${request(lang)}
</main>
${footer(lang)}
</body>
</html>
`;
}

/** @param {'ar'|'en'} lang */
function pricingPage(lang) {
  const t = T[lang];
  return `${head(lang, 'pricing')}
<body>
${header(lang, 'pricing')}
<main id="main">
${pricing(lang, true)}
${faq(t.pricing_faq, 'faq', t.faq_title, 'h2')}
</main>
${footer(lang)}
</body>
</html>
`;
}

const out = (/** @type {string} */ rel, /** @type {string} */ html) => { const p = ROOT + 'site/' + rel; mkdirSync(p.slice(0, p.lastIndexOf('/')), { recursive: true }); writeFileSync(p, html); };
out('index.html', home('ar'));
out('pricing/index.html', pricingPage('ar'));
out('en/index.html', home('en'));
out('en/pricing/index.html', pricingPage('en'));
mkdirSync(ROOT + 'site/data', { recursive: true });
copyFileSync(ROOT + 'data/pricing-catalog.json', ROOT + 'site/data/pricing-catalog.json');
writeFileSync(ROOT + 'site/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<!-- Tamnex by Evexa -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${['/', '/pricing/'].map(p => ['', '/en'].map(l => `  <url><loc>${SITE}${l}${p}</loc><lastmod>${catalog.effectiveFrom}</lastmod><xhtml:link rel="alternate" hreflang="ar" href="${SITE}${p}"/><xhtml:link rel="alternate" hreflang="en" href="${SITE}/en${p}"/></url>`).join('\n')).join('\n')}
</urlset>
`);
console.log('built: site/index.html, site/pricing/, site/en/, site/en/pricing/, catalog', catalog.catalogVersion);
