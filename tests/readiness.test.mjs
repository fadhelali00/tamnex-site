// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const R = createRequire(import.meta.url)('../site/assets/readiness.js');

const ev = s => R.evaluate(s);
const status = (s, id) => ev(s).items.find(i => i.id === id).status;

test('starts at 5 of 8 with three open exceptions', () => {
  const e = ev(R.initial());
  assert.equal(e.total, 8);
  assert.equal(e.complete, 5);
  assert.deepEqual(e.blockers.map(b => b.id), ['bank', 'inventory', 'expected']);
  assert.equal(e.verdict.kind, 'open');
});

test('bank: wrong amount and already-used receipt are rejected, state unchanged', () => {
  const s0 = R.initial();
  const a = R.matchBank(s0, 'RV-1047');
  assert.equal(a.ok, false); assert.match(a.message, /المبلغ لا يطابق/); assert.equal(a.state, s0);
  const b = R.matchBank(s0, 'RV-1039');
  assert.equal(b.ok, false); assert.match(b.message, /مربوط مسبقاً/);
});

test('bank: correct match changes no balance and is unverified until re-run', () => {
  const s0 = R.initial();
  const r = R.matchBank(s0, 'RV-1042');
  assert.equal(r.ok, true);
  assert.deepEqual(ev(r.state).ledger, ev(s0).ledger);
  assert.equal(status(r.state, 'bank'), 'unverified');
  assert.equal(ev(r.state).verdict.kind, 'stale');
  const run = R.runChecks(r.state).state;
  assert.equal(status(run, 'bank'), 'pass');
  assert.equal(R.matchBank(run, 'RV-1042').ok, false); // no double match
});

test('accrual: a balanced draft does not resolve the exception and adds a hygiene flag', () => {
  let s = R.saveAccrualDraft(R.initial()).state;
  s = R.runChecks(s).state;
  assert.equal(status(s, 'expected'), 'open');
  assert.equal(status(s, 'hygiene'), 'attention');
  assert.equal(ev(s).ledger.expense, 0);
  assert.equal(R.approveAccrual(R.initial()).ok, false); // cannot approve without a draft
});

test('accrual: demo approval posts a balanced local entry only', () => {
  let s = R.approveAccrual(R.saveAccrualDraft(R.initial()).state).state;
  const L = ev(s).ledger, A = R.SCENARIO.accrual;
  assert.equal(L.expense - A.expenseBefore, A.amount);       // debit
  assert.equal(L.accrued - A.accruedBefore, A.amount); // credit
  assert.equal(L.bank, R.SCENARIO.bankBalance);
  s = R.runChecks(s).state;
  assert.equal(status(s, 'expected'), 'pass');
  assert.equal(status(s, 'hygiene'), 'pass');
});

test('inventory: stale evidence stays open; fresh evidence passes only after re-run', () => {
  let s = R.runChecks(R.initial()).state;
  assert.equal(status(s, 'inventory'), 'open');
  s = R.useInventoryEvidence(s, 'VAL-1031').state;
  assert.equal(status(s, 'inventory'), 'unverified');
  s = R.runChecks(s).state;
  assert.equal(status(s, 'inventory'), 'pass');
  s = R.useInventoryEvidence(s, 'VAL-1029').state; // switching back invalidates
  s = R.runChecks(s).state;
  assert.equal(status(s, 'inventory'), 'open');
});

test('full path ends "complete, awaiting accountant review"; partial path says a blocker remains', () => {
  let s = R.initial();
  s = R.matchBank(s, 'RV-1042').state;
  s = R.saveAccrualDraft(s).state;
  s = R.useInventoryEvidence(s, 'VAL-1031').state;
  let p = R.runChecks(s).state;
  assert.equal(ev(p).verdict.kind, 'better');
  assert.equal(ev(p).complete, 6);
  s = R.approveAccrual(s).state;
  s = R.runChecks(s).state;
  const e = ev(s);
  assert.equal(e.complete, 8);
  assert.equal(e.verdict.text, 'فحوص هذا السيناريو مكتملة، بانتظار مراجعة المحاسب.');
});

test('reset returns the original state; inputs are never mutated', () => {
  const s0 = R.initial(); const snap = JSON.stringify(s0);
  R.matchBank(s0, 'RV-1042'); R.saveAccrualDraft(s0); R.useInventoryEvidence(s0, 'VAL-1031'); R.runChecks(s0);
  assert.equal(JSON.stringify(s0), snap);
  assert.deepEqual(R.initial(), JSON.parse(snap));
});

test('money formatting uses integer halalas', () => {
  assert.equal(R.fmt(1150000), '11,500.00');
  assert.equal(R.fmt(61240000 - 60875000), '3,650.00');
  assert.equal(R.fmt(5), '0.05');
});
