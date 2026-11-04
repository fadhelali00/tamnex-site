// @ts-check
/**
 * Read layer for the public pricing catalog. Templates and browser code never hold prices; they ask this module.
 * Money is parsed from decimal strings into integer halalas, so no float arithmetic touches prices.
 */
import { readFileSync } from 'node:fs';

/** @typedef {{kind:'listed', monthly:{amount:string}, annual:{amount:string, monthlyEquivalent:string, billedUpfront:boolean}} | {kind:'on_request'}} Pricing */
/** @typedef {{id:string, order:number, public:boolean, highlight:null|{ar:string,en:string}, name:{ar:string,en:string}, audience:{ar:string,en:string}, pricing:Pricing, values:Record<string,{kind:string,value?:number,addon?:boolean}>, highlights:string[]}} Plan */
/** @typedef {{id:string, group:string, availability:'launch'|'after_launch', name:{ar:string,en:string}}} Feature */
/** @typedef {{schema:string, schemaVersion:number, catalogVersion:string, effectiveFrom:string, source:{kind:string, dynamicLink:boolean}, currency:string, tax:{kind:string, ratePercent:number, pricesIncludeTax:boolean}, cycles:string[], defaultCycle:string, features:Feature[], plans:Plan[]}} Catalog */

/** @param {string} [path] @returns {Catalog} */
export function loadCatalog(path = new URL('../data/pricing-catalog.json', import.meta.url).pathname) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** @param {string} s decimal string with two places @returns {number} halalas */
export function toHalalas(s) {
  const m = /^(\d+)\.(\d{2})$/.exec(s);
  if (!m) throw new Error(`bad money string: ${s}`);
  return Number(m[1]) * 100 + Number(m[2]);
}

/** Half away from zero on non-negative integers. @param {number} h @param {number} pct */
export function vatOf(h, pct) { return Math.floor((h * pct + 50) / 100); }

/** @param {Catalog} c @returns {Plan[]} public plans in display order */
export function publicPlans(c) { return c.plans.filter(p => p.public).sort((a, b) => a.order - b.order); }

/**
 * Everything a price block needs, for one plan and one cycle.
 * @param {Catalog} c @param {Plan} p @param {'monthly'|'annual'} cycle
 */
export function priceFor(c, p, cycle) {
  if (p.pricing.kind !== 'listed') return null;
  const rate = c.tax.ratePercent;
  if (cycle === 'monthly') {
    const net = toHalalas(p.pricing.monthly.amount);
    const vat = vatOf(net, rate);
    return { cycle, perMonth: net, charged: net, chargedVat: vat, chargedTotal: net + vat, upfront: false };
  }
  const charged = toHalalas(p.pricing.annual.amount);
  const perMonth = toHalalas(p.pricing.annual.monthlyEquivalent);
  if (perMonth * 12 !== charged) throw new Error(`plan ${p.id}: annual ${charged} != 12 x ${perMonth}`);
  const vat = vatOf(charged, rate);
  return { cycle, perMonth, charged, chargedVat: vat, chargedTotal: charged + vat, upfront: p.pricing.annual.billedUpfront };
}

/** @param {number} h @param {'ar'|'en'} lang @param {boolean} [cents] */
export function money(h, lang, cents = false) {
  const whole = Math.floor(h / 100), frac = h % 100;
  const s = whole.toLocaleString('en-US') + (cents || frac ? '.' + String(frac).padStart(2, '0') : '');
  return s;
}

/** Label for a plan's value of a feature. @param {Catalog} c @param {Plan} p @param {Feature} f @param {Record<string,string>} t */
export function valueLabel(c, p, f, t) {
  const v = p.values[f.id] || { kind: 'not_included' };
  let label;
  switch (v.kind) {
    case 'included': label = t.v_included; break;
    case 'not_included': label = t.v_not_included; break;
    case 'unlimited': label = t.v_unlimited; break;
    case 'count': label = String(v.value) + (v.addon ? ' ' + t.v_addon_more : ''); break;
    case 'upto': label = t.v_upto.replace('{n}', String(v.value)); break;
    case 'contract': label = t.v_contract; break;
    default: label = t.v_not_included;
  }
  const soon = f.availability === 'after_launch' && v.kind !== 'not_included';
  return { label, soon, included: v.kind !== 'not_included' };
}
