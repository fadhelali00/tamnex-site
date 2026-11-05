// @ts-check
/**
 * Read layer for the public pricing catalog. Templates and browser code never hold prices; they ask this module.
 *
 * Two sources, kept apart on purpose:
 *   data/pricing-catalog.json       the SA-11 public projection `pricing-catalog` v1 (snake_case, money as decimal strings, VAT-inclusive
 *                                   amounts supplied by the source). Validated against the pinned ERP schema; the page never computes a price.
 *   data/pricing-presentation.json  page-owned only (customer line, highlight badge, card bullets, comparison grouping), keyed by
 *                                   plan_id + feature/limit code. None of it can live in the catalog (additionalProperties:false).
 * `loadCatalog` joins them into the shape the templates read, so the templates do not know the v1 field names.
 * Money is parsed from decimal strings into integer halalas, so no float arithmetic touches prices.
 */
import { readFileSync } from 'node:fs';

/** @typedef {{kind:'listed', monthly:{amount:string, total:string}, annual:{amount:string, monthlyEquivalent:string, total:string, billedUpfront:boolean}} | {kind:'on_request'}} Pricing */
/** @typedef {{id:string, order:number, public:boolean, highlight:null|{ar:string,en:string}, name:{ar:string,en:string}, audience:{ar:string,en:string}, pricing:Pricing, values:Record<string,{kind:string,value?:number,addon?:boolean}>, highlights:string[]}} Plan */
/** @typedef {{id:string, group:string, availability:'launch'|'after_launch', name:{ar:string,en:string}}} Feature */
/** @typedef {{schema:string, schemaVersion:number, catalogVersion:string, effectiveFrom:string, source:{kind:string, dynamicLink:boolean}, currency:string, tax:{kind:string, ratePercent:number, pricesIncludeTax:boolean}, cycles:string[], defaultCycle:string, features:Feature[], plans:Plan[]}} Catalog */

const DATA = new URL('../data/', import.meta.url).pathname;
const CONTRACT = new URL('../contracts/pricing-catalog.v1.schema.json', import.meta.url).pathname;

/** Fail Loudly: a catalog that does not satisfy the pinned v1 schema is never rendered. */
export async function assertValidV1(/** @type {unknown} */ catalog) {
  // Under NodeNext the packages are typed as namespaces, not constructors/functions: cast once, as the upstream README does.
  const Ajv2020 = /** @type {any} */ ((await import('ajv/dist/2020.js')).default);
  const addFormats = /** @type {any} */ ((await import('ajv-formats')).default);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv, ['date-time']);
  const validate = ajv.compile(JSON.parse(readFileSync(CONTRACT, 'utf8')));
  if (!validate(catalog)) throw new Error('pricing catalog does not satisfy pricing-catalog v1: ' + JSON.stringify(validate.errors));
}

/** @param {string} s decimal string with two places @returns {number} halalas */
export function toHalalas(s) {
  const m = /^(\d+)\.(\d{2})$/.exec(s);
  if (!m) throw new Error(`bad money string: ${s}`);
  return Number(m[1]) * 100 + Number(m[2]);
}

/** Half away from zero on non-negative integers. Used by the contract test only: the page reads the source's VAT-inclusive amounts. @param {number} h @param {number} pct */
export function vatOf(h, pct) { return Math.floor((h * pct + 50) / 100); }

/**
 * Join the v1 projection with the page-owned presentation.
 * @param {any} v1 @param {any} pres @returns {Catalog}
 */
export function joinCatalog(v1, pres) {
  const rows = /** @type {{code:string, group:string, name:{ar:string,en:string}, kind:'feature'|'limit'}[]} */ (pres.rows);
  const featureByCode = new Map(v1.plans[0].features.map((/** @type {any} */ f) => [f.code, f]));
  /** @type {Feature[]} */
  const features = rows.map(r => {
    if (r.kind === 'limit') return { id: r.code, group: r.group, name: r.name, availability: /** @type {const} */ ('launch') };
    const f = /** @type {any} */ (featureByCode.get(r.code));
    if (!f) throw new Error(`presentation row ${r.code} has no feature in the catalog`);
    return { id: r.code, group: r.group, name: r.name, availability: /** @type {'launch'|'after_launch'} */ (f.availability === 'coming_soon' ? 'after_launch' : 'launch') };
  });
  // a feature row follows the catalog's availability («coming_soon» shows as «after launch»); limits are available at launch
  const plans = /** @type {Plan[]} */ (v1.plans.map((/** @type {any} */ p) => {
    const pp = pres.plans[p.plan_id];
    if (!pp) throw new Error(`no presentation for plan ${p.plan_id}`);
    /** @type {Plan['values']} */
    const values = {};
    for (const f of p.features) values[f.code] = { kind: f.state === 'included' ? 'included' : 'not_included' };
    for (const l of p.limits) {
      values[l.code] = l.unlimited ? { kind: 'unlimited' }
        : pres.limitStyle?.[l.code] === 'upto' ? { kind: 'upto', value: l.value }
        : { kind: 'count', value: l.value, ...(l.extra_paid ? { addon: true } : {}) };
    }
    const c = p.pricing.cycles;
    return {
      id: p.plan_id, order: p.display_order + 1, public: true, highlight: pp.highlight, name: p.name, audience: pp.audience,
      pricing: { kind: 'listed', monthly: { amount: c.monthly.amount, total: c.monthly.amount_incl_vat },
        annual: { amount: c.annual.amount_total, monthlyEquivalent: c.annual.amount_per_month, total: c.annual.amount_total_incl_vat, billedUpfront: c.annual.billed === 'upfront' } },
      values, highlights: pp.highlights,
    };
  }));
  return {
    schema: v1.schema, schemaVersion: v1.schema_version,
    // shown to the visitor as the price version: date of the revision + its number (the source's revision is the integer)
    catalogVersion: `${v1.generated_at.slice(0, 10)}.${v1.catalog_revision}`, effectiveFrom: v1.generated_at.slice(0, 10),
    source: { kind: pres.source.kind, dynamicLink: pres.source.dynamicLink }, currency: v1.currency,
    tax: { kind: 'VAT', ratePercent: Number(v1.tax.vat_percent), pricesIncludeTax: !v1.tax.prices_exclude_vat },
    cycles: ['monthly', 'annual'], defaultCycle: pres.defaultCycle, features, plans,
  };
}

/** @param {{catalogPath?:string, presentationPath?:string}} [o] @returns {Catalog} */
export function loadCatalog(o = {}) {
  const v1 = JSON.parse(readFileSync(o.catalogPath ?? DATA + 'pricing-catalog.json', 'utf8'));
  const pres = JSON.parse(readFileSync(o.presentationPath ?? DATA + 'pricing-presentation.json', 'utf8'));
  return joinCatalog(v1, pres);
}

/** The raw v1 projection, for validation. @param {string} [path] */
export function loadV1(path = DATA + 'pricing-catalog.json') { return JSON.parse(readFileSync(path, 'utf8')); }

/** @param {Catalog} c @returns {Plan[]} public plans in display order */
export function publicPlans(c) { return c.plans.filter(p => p.public).sort((a, b) => a.order - b.order); }

/**
 * Everything a price block needs, for one plan and one cycle. The VAT-inclusive total is the source's own amount (never computed here).
 * @param {Catalog} c @param {Plan} p @param {'monthly'|'annual'} cycle
 */
export function priceFor(c, p, cycle) {
  void c;
  if (p.pricing.kind !== 'listed') return null;
  if (cycle === 'monthly') {
    const net = toHalalas(p.pricing.monthly.amount);
    const total = toHalalas(p.pricing.monthly.total);
    return { cycle, perMonth: net, charged: net, chargedVat: total - net, chargedTotal: total, upfront: false };
  }
  const charged = toHalalas(p.pricing.annual.amount);
  const perMonth = toHalalas(p.pricing.annual.monthlyEquivalent);
  if (perMonth * 12 !== charged) throw new Error(`plan ${p.id}: annual ${charged} != 12 x ${perMonth}`);
  const total = toHalalas(p.pricing.annual.total);
  return { cycle, perMonth, charged, chargedVat: total - charged, chargedTotal: total, upfront: p.pricing.annual.billedUpfront };
}

/** @param {number} h @param {'ar'|'en'} lang @param {boolean} [cents] */
export function money(h, lang, cents = false) {
  void lang;
  const whole = Math.floor(h / 100), frac = h % 100;
  const s = whole.toLocaleString('en-US') + (cents || frac ? '.' + String(frac).padStart(2, '0') : '');
  return s;
}

/** Label for a plan's value of a feature. @param {Catalog} c @param {Plan} p @param {Feature} f @param {Record<string,string>} t */
export function valueLabel(c, p, f, t) {
  void c;
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
