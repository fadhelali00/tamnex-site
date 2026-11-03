// Contract + arithmetic tests for the public pricing catalog. Run: node --test tests/catalog.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { loadCatalog, publicPlans, priceFor, toHalalas } from '../scripts/catalog.mjs';

const root = new URL('..', import.meta.url).pathname;
const schemaPath = root + 'contracts/pricing-catalog.v1.schema.json';
const schemaText = readFileSync(schemaPath, 'utf8');
const c = loadCatalog();

test('catalog validates against the pinned v1 schema', () => {
  const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false }); addFormats(ajv);
  const ok = ajv.validate(JSON.parse(schemaText), c);
  assert.ok(ok, JSON.stringify(ajv.errors, null, 2));
});

test('pinned schema matches its lock; and the SA-11 upstream copy when provided', () => {
  const sha = createHash('sha256').update(readFileSync(schemaPath)).digest('hex');
  assert.equal(sha, readFileSync(root + 'contracts/pricing-catalog.v1.schema.sha256', 'utf8').trim(), 'schema changed without updating the lock');
  const up = process.env.UPSTREAM_SCHEMA;
  if (up && existsSync(up)) assert.equal(readFileSync(up, 'utf8'), schemaText, 'pinned schema diverges from SA-11 upstream');
});

test('owner-approved prices, VAT 15% totals and annual amounts', () => {
  const want = {
    launch: { m: 12000, mTotal: 13800, a: 114000, aEq: 9500, aTotal: 131100 },
    growth: { m: 22000, mTotal: 25300, a: 186000, aEq: 15500, aTotal: 213900 },
    scale: { m: 32000, mTotal: 36800, a: 270000, aEq: 22500, aTotal: 310500 }
  };
  for (const [id, w] of Object.entries(want)) {
    const p = c.plans.find(x => x.id === id);
    const m = priceFor(c, p, 'monthly'), a = priceFor(c, p, 'annual');
    assert.equal(m.charged, w.m); assert.equal(m.chargedTotal, w.mTotal);
    assert.equal(a.charged, w.a); assert.equal(a.perMonth, w.aEq); assert.equal(a.chargedTotal, w.aTotal);
    assert.equal(a.upfront, true);
  }
});

test('stable ids, order, one descriptive highlight, no "best seller" claim', () => {
  assert.deepEqual(publicPlans(c).map(p => p.id), ['launch', 'growth', 'scale']);
  assert.deepEqual(c.plans.map(p => p.name.ar), ['الأساسية', 'الأعمال', 'المتقدمة']);
  assert.deepEqual(c.plans.map(p => p.name.en), ['Core', 'Business', 'Advanced']);
  assert.ok(c.plans.every(p => p.pricing.kind === 'listed'), 'no contact-sales plan');
  const hl = c.plans.filter(p => p.highlight);
  assert.equal(hl.length, 1); assert.equal(hl[0].id, 'growth');
  assert.doesNotMatch(JSON.stringify(c), /الأكثر مبيعاً|best[- ]?sell/i);
});

test('every plan value refers to a known feature, and every feature has a value per plan', () => {
  const ids = new Set(c.features.map(f => f.id));
  for (const p of c.plans) {
    for (const k of Object.keys(p.values)) assert.ok(ids.has(k), `${p.id}: unknown feature ${k}`);
    for (const f of c.features) assert.ok(p.values[f.id], `${p.id}: missing ${f.id}`);
    for (const h of p.highlights) assert.ok(ids.has(h));
  }
});

test('no add-on prices and no unlimited AI credit in the catalog', () => {
  assert.doesNotMatch(JSON.stringify(c), /credit|رصيد/i);
  for (const p of c.plans) assert.notEqual(p.values.ai_assistant.kind, 'unlimited');
});

test('money strings parse exactly', () => {
  assert.equal(toHalalas('1140.00'), 114000); assert.equal(toHalalas('0.05'), 5);
  assert.throws(() => toHalalas('95'));
});
