// Contract + arithmetic tests for the public pricing catalog. Run: node --test tests/catalog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { loadCatalog, loadV1, publicPlans, priceFor, toHalalas, vatOf, assertValidV1 } from '../scripts/catalog.mjs';

const root = new URL('..', import.meta.url).pathname;
const schemaPath = root + 'contracts/pricing-catalog.v1.schema.json';
const schemaText = readFileSync(schemaPath, 'utf8');
const schema = JSON.parse(schemaText);
const UPSTREAM_SHA = '66ae61129107255dbf72d97f49135b90c5bb5c65b5d8ce0ecc8fa1fcdf5dca68'; // SA-11 PR #547, packages/schemas/src/pricing-catalog/v1.schema.sha256
const v1 = loadV1();
const c = loadCatalog();
const validator = () => { const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv, ['date-time']); return ajv.compile(schema); };

test('the pinned schema is the upstream v1 file, byte for byte (sha256) and matches its lock', () => {
  const sha = createHash('sha256').update(readFileSync(schemaPath)).digest('hex');
  assert.equal(sha, UPSTREAM_SHA, 'the pinned copy was edited; v1 is frozen upstream, adopt a v2 in its own batch');
  assert.equal(readFileSync(root + 'contracts/pricing-catalog.v1.schema.sha256', 'utf8').trim().split(/\s+/)[0], UPSTREAM_SHA, 'lock file differs from the pinned sha');
  const up = process.env.UPSTREAM_SCHEMA;
  if (up && existsSync(up)) assert.equal(readFileSync(up, 'utf8'), schemaText, 'pinned schema diverges from the SA-11 upstream file');
});

test('the upstream valid example is accepted and every one of the 22 upstream invalid examples is rejected', () => {
  const v = validator();
  const dir = root + 'tests/fixtures/pricing-catalog/';
  assert.ok(v(JSON.parse(readFileSync(dir + 'v1.example.json', 'utf8'))), JSON.stringify(v.errors));
  const bad = readdirSync(dir + 'invalid').filter(f => f.endsWith('.json'));
  assert.ok(bad.length >= 22, `expected the 22 invalid examples, found ${bad.length}`);
  for (const f of bad) assert.equal(v(JSON.parse(readFileSync(dir + 'invalid/' + f, 'utf8'))), false, `${f} must be rejected`);
});

test('the page catalog validates against the pinned v1 schema (Ajv 2020, strict, date-time registered)', async () => {
  const v = validator();
  assert.ok(v(v1), JSON.stringify(v.errors, null, 2));
  await assertValidV1(v1);
  const broken = structuredClone(v1); broken.plans[0].pricing.cycles.monthly.amount = 120; // a number instead of a decimal string
  await assert.rejects(() => assertValidV1(broken), /does not satisfy/);
});

test('RED (D98): the upstream valid example goes through the real read layer, whatever codes it carries', () => {
  const ex = root + 'tests/fixtures/pricing-catalog/v1.example.json';
  const up = JSON.parse(readFileSync(ex, 'utf8'));
  const cat = loadCatalog({ catalogPath: ex }); // must not throw: the page owns its presentation, the catalog owns what exists
  assert.deepEqual(publicPlans(cat).map(p => p.id), up.plans.map(p => p.plan_id));
  // every catalog feature and limit becomes a row, in a visible group; nothing from the page's own list is invented for it
  const codes = [...up.plans[0].features.map(f => f.code), ...up.plans[0].limits.map(l => l.code)];
  assert.deepEqual(cat.features.map(f => f.id).sort(), codes.sort());
  for (const f of cat.features) assert.ok(f.group && f.name.ar && f.name.en, `row ${f.id} lacks a group or a name`);
  assert.ok(cat.features.every(f => f.group === 'more' || ['core', 'limits', 'advanced', 'ai'].includes(f.group)));
  // the example's labels are the catalog's own (never replaced by the page's wording for another feature)
  assert.equal(cat.features.find(f => f.id === 'field_distribution').name.ar, 'التوزيع الميداني');
  assert.equal(cat.features.find(f => f.id === 'field_distribution').availability, 'after_launch');
  // prices are the example's own amounts, read as given
  for (const p of up.plans) {
    const got = priceFor(cat, cat.plans.find(x => x.id === p.plan_id), 'annual');
    assert.equal(got.charged, toHalalas(p.pricing.cycles.annual.amount_total));
    assert.equal(got.chargedTotal, toHalalas(p.pricing.cycles.annual.amount_total_incl_vat));
  }
  // a plan the page has no presentation for still renders, without badge or bullets
  const plain = cat.plans.filter(p => !loadCatalog().plans.some(x => x.id === p.id));
  for (const p of plain) assert.deepEqual([p.highlight, p.highlights], [null, []]);
});

test('GOLDEN: the current page catalog joins to exactly what it did before the read layer became tolerant', () => {
  const golden = JSON.parse(readFileSync(root + 'tests/fixtures/pricing-catalog/page-join.golden.json', 'utf8'));
  assert.deepEqual(loadCatalog(), golden);
});

test('contract invariants the schema cannot express: ids, same feature list in every plan, VAT, annual = 12 x monthly', () => {
  assert.deepEqual(v1.plans.map(p => p.plan_id), ['core', 'business', 'advanced']);
  assert.equal(new Set(v1.plans.map(p => p.plan_id)).size, v1.plans.length);
  const sig = p => JSON.stringify(p.features.map(f => [f.code, f.order, f.label, f.availability]));
  for (const p of v1.plans) assert.equal(sig(p), sig(v1.plans[0]), `${p.plan_id}: feature list differs from the first plan`);
  for (const p of v1.plans) assert.equal(new Set(p.features.map(f => f.code)).size, p.features.length, `${p.plan_id}: duplicate feature code`);
  const rate = Number(v1.tax.vat_percent);
  for (const p of v1.plans) {
    const { monthly, annual } = p.pricing.cycles;
    assert.equal(toHalalas(monthly.amount_incl_vat), toHalalas(monthly.amount) + vatOf(toHalalas(monthly.amount), rate), `${p.plan_id} monthly VAT`);
    assert.equal(toHalalas(annual.amount_total_incl_vat), toHalalas(annual.amount_total) + vatOf(toHalalas(annual.amount_total), rate), `${p.plan_id} annual VAT`);
    assert.equal(toHalalas(annual.amount_per_month) * 12, toHalalas(annual.amount_total), `${p.plan_id} annual != 12 x monthly equivalent`);
  }
});

test('owner-approved prices, VAT 15% totals and annual amounts (read from the source, never computed by the page)', () => {
  const want = {
    core: { m: 12000, mTotal: 13800, a: 114000, aEq: 9500, aTotal: 131100 },
    business: { m: 22000, mTotal: 25300, a: 186000, aEq: 15500, aTotal: 213900 },
    advanced: { m: 32000, mTotal: 36800, a: 270000, aEq: 22500, aTotal: 310500 }
  };
  for (const [id, w] of Object.entries(want)) {
    const p = c.plans.find(x => x.id === id);
    const m = priceFor(c, p, 'monthly'), a = priceFor(c, p, 'annual');
    assert.equal(m.charged, w.m); assert.equal(m.chargedTotal, w.mTotal);
    assert.equal(a.charged, w.a); assert.equal(a.perMonth, w.aEq); assert.equal(a.chargedTotal, w.aTotal);
    assert.equal(a.upfront, true);
  }
});

test('stable ids core/business/advanced, order, one descriptive highlight, no "best seller" claim, old ids gone', () => {
  assert.deepEqual(publicPlans(c).map(p => p.id), ['core', 'business', 'advanced']);
  assert.deepEqual(c.plans.map(p => p.name.ar), ['الأساسية', 'الأعمال', 'المتقدمة']);
  assert.deepEqual(c.plans.map(p => p.name.en), ['Core', 'Business', 'Advanced']);
  assert.ok(c.plans.every(p => p.pricing.kind === 'listed'), 'no contact-sales plan');
  const hl = c.plans.filter(p => p.highlight);
  assert.equal(hl.length, 1); assert.equal(hl[0].id, 'business');
  assert.doesNotMatch(JSON.stringify(c), /الأكثر مبيعاً|best[- ]?sell/i);
  for (const file of ['data/pricing-catalog.json', 'data/pricing-presentation.json', 'site/api/preregister.php'])
    assert.doesNotMatch(readFileSync(root + file, 'utf8'), /["']launch["']|["']growth["']|["']scale["']/, `${file} still uses an old plan id`);
});

test('the PHP endpoints accept exactly the catalog plan_id values (registration and quote request)', () => {
  const want = ['', ...v1.plans.map(p => p.plan_id)].map(x => `'${x}'`).join(', ');
  for (const f of ['site/api/preregister.php', 'site/api/interest.php'])
    assert.ok(readFileSync(root + f, 'utf8').includes(`[${want}]`), `${f}: plan allow-list is not [${want}]`);
});

test('every plan value refers to a known row, every row has a value per plan, presentation is keyed by plan_id and a code', () => {
  const ids = new Set(c.features.map(f => f.id));
  for (const p of c.plans) {
    for (const k of Object.keys(p.values)) assert.ok(ids.has(k), `${p.id}: unknown feature ${k}`);
    for (const f of c.features) assert.ok(p.values[f.id], `${p.id}: missing ${f.id}`);
    for (const h of p.highlights) assert.ok(ids.has(h), `${p.id}: unknown highlight ${h}`);
  }
  const pres = JSON.parse(readFileSync(root + 'data/pricing-presentation.json', 'utf8'));
  assert.deepEqual(Object.keys(pres.plans).sort(), v1.plans.map(p => p.plan_id).sort());
  // presentation never leaks into the catalog (the schema also rejects it)
  assert.doesNotMatch(JSON.stringify(v1), /"audience"|"highlight"|"highlights"|"group"/);
});

test('coming-soon features are shown honestly, and a limit "up to" keeps its style', () => {
  const soon = c.features.filter(f => f.availability === 'after_launch').map(f => f.id).sort();
  assert.deepEqual(soon, ['ai_assistant', 'api', 'cost_centers_price_lists', 'orders']);
  assert.equal(c.plans[0].values.customers.kind, 'upto');
  assert.equal(c.plans[2].values.customers.kind, 'unlimited');
  assert.equal(c.plans[0].values.users.addon, true);
});

test('no add-on prices and no unlimited AI credit in the catalog', () => {
  assert.doesNotMatch(JSON.stringify(v1), /credit|رصيد/i);
  for (const p of c.plans) assert.notEqual(p.values.ai_assistant.kind, 'unlimited');
  for (const p of v1.plans) for (const l of p.limits) assert.ok(typeof l.extra_paid === 'boolean');
});

test('SA-11 TRD §20.6: nothing in the shipped repo holds a credential, the admin host or a database driver', () => {
  const dirs = ['site', 'scripts', 'src', 'data', 'contracts'];
  const files = [];
  const walk = d => { for (const e of readdirSync(root + d, { withFileTypes: true })) { const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (/\.(php|js|mjs|cjs|json|html|css|txt|md|xml|htaccess)$/.test(e.name) || e.name === '.htaccess') files.push(p); } };
  for (const d of dirs) walk(d);
  assert.ok(files.length > 20, 'the scan found no files');
  const rules = [
    ['connection URL', /\b(postgres(ql)?|mysql|mariadb|mongodb|redis):\/\/[^\s"']+/i],
    ['database driver', /\b(new\s+PDO|mysqli_connect|pg_connect|sqlite3|require\(['"](pg|mysql2?|sqlite3|mongodb)['"]\)|from\s+['"](pg|mysql2?|sqlite3|mongodb)['"])/i],
    ['admin host', /\badmin\.tamnex\.com\b/i],
    ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['cloud key', /\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{35}\b|\bsk-[A-Za-z0-9]{20,}\b/],
    ['hard-coded secret', /\b(api[_-]?key|secret|token|passwd|password)\b\s*[:=]\s*['"][^'"\s]{8,}['"]/i],
  ];
  const hits = [];
  for (const f of files) {
    const text = readFileSync(root + f, 'utf8');
    for (const [name, re] of rules) { const m = re.exec(text); if (m) hits.push(`${f}: ${name}: ${m[0].slice(0, 40)}`); }
  }
  assert.deepEqual(hits, []);
  // the scan really sees violations (negative control)
  assert.ok(rules[0][1].test('postgres://user:pw@host/db') && rules[2][1].test('https://admin.tamnex.com/x') && rules[4][1].test('AKIAABCDEFGHIJKLMNOP'));
});

test('money strings parse exactly', () => {
  assert.equal(toHalalas('1140.00'), 114000); assert.equal(toHalalas('0.05'), 5);
  assert.throws(() => toHalalas('95'));
});
