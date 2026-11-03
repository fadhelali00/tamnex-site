// Endpoint tests against PHP's built-in server. Run: node --test tests/endpoints.test.mjs (needs php on PATH)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 8790 + Math.floor(Math.random() * 100);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const DATA = mkdtempSync(join(tmpdir(), 'tamnex-data-'));
const SITE = new URL('../site/', import.meta.url).pathname;
let srv;

before(async () => {
  srv = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE], { env: { ...process.env, TAMNEX_SALT: 'test-salt', TAMNEX_DATA_DIR: DATA, TAMNEX_ORIGINS: ORIGIN }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(ORIGIN + '/robots.txt'); return; } catch { await new Promise(r => setTimeout(r, 100)); } }
  throw new Error('php server did not start');
});
after(() => srv.kill());

const post = (path, body, origin = ORIGIN, type = 'application/json') =>
  fetch(ORIGIN + path, { method: 'POST', redirect: 'manual', headers: { Origin: origin, 'Content-Type': type }, body: type === 'application/json' ? JSON.stringify(body) : body });

const good = (o = {}) => ({ lang: 'ar', company: 'شركة الاختبار', sector: 'distribution', size: '11-50', branches: '2-5', cr: '1010123456', subdomain: 'test-co', first: 'فاضل', last: 'علي', job: 'cfo', email: 'cfo@example.com', phone: '+966551234567', password: 'Secure-pass-2026', vatreg: 'yes', vat: '310123456700003', fy: '1', plan: 'growth', terms: true, marketing: false, website: '', ...o });

test('valid pre-registration returns a reference and is stored outside the web root', async () => {
  const r = await post('/api/preregister.php', good());
  const j = await r.json();
  assert.equal(r.status, 200); assert.match(j.ref, /^TMX-[0-9A-F]{8}$/);
  const csv = readFileSync(join(DATA, 'preregistrations.csv'), 'utf8');
  assert.match(csv, /cfo@example\.com/);
  assert.doesNotMatch(csv, /Secure-pass-2026/, 'plain password must never be stored');
  assert.match(csv, /\$(argon2id|2y)\$/, 'a one-way hash is stored');
  assert.ok(!existsSync(join(SITE, 'tamnex-data')));
});

test('same owner email twice is refused (one company per owner email)', async () => {
  const r = await post('/api/preregister.php', good({ company: 'أخرى', subdomain: '' }));
  assert.equal(r.status, 409);
});

test('invalid fields are named; reserved subdomain and bad VAT/CR rejected', async () => {
  const r = await post('/api/preregister.php', good({ email: 'x', cr: '123', vat: '123', subdomain: 'admin', terms: false, password: 'short1' }));
  const j = await r.json();
  assert.equal(r.status, 422);
  for (const f of ['email', 'cr', 'vat', 'subdomain', 'terms', 'password']) assert.ok(j.fields.includes(f), f);
});

test('VAT number not required when not VAT-registered', async () => {
  const r = await post('/api/preregister.php', good({ email: 'novat@example.com', vatreg: 'no', vat: '', subdomain: '' }));
  assert.equal(r.status, 200);
});

test('foreign origin and GET are refused', async () => {
  assert.equal((await post('/api/preregister.php', good(), 'https://evil.example')).status, 403);
  assert.equal((await fetch(ORIGIN + '/api/preregister.php')).status, 405);
});

test('plain HTML form post (no JS) redirects to the received page', async () => {
  const body = new URLSearchParams({ ...good({ email: 'nojs@example.com', subdomain: '' }), terms: 'on', marketing: '' }).toString();
  const r = await post('/api/preregister.php', body, ORIGIN, 'application/x-www-form-urlencoded');
  assert.equal(r.status, 303); assert.equal(r.headers.get('location'), '/start/received/');
});

test('formula injection is neutralised in the stored CSV', async () => {
  await post('/api/preregister.php', good({ email: 'inj@example.com', company: '=HYPERLINK("x")', subdomain: '' }));
  assert.match(readFileSync(join(DATA, 'preregistrations.csv'), 'utf8'), /'=HYPERLINK/);
});

test('launch-notify update needs a valid reference', async () => {
  assert.equal((await post('/api/preregister.php', { action: 'notify', ref: 'TMX-ABCDEF12', email: 'n@example.com' })).status, 200);
  assert.equal((await post('/api/preregister.php', { action: 'notify', ref: 'nope', email: 'n@example.com' })).status, 422);
});

test('rate limit: the 6th registration in an hour is refused', async () => {
  let last;
  for (let i = 0; i < 4; i++) last = await post('/api/preregister.php', good({ email: `r${i}@example.com`, subdomain: '' }));
  assert.equal(last.status, 429);
});

test('quote request endpoint accepts a valid request', async () => {
  const r = await post('/api/interest.php', { name: 'n', company: 'c', email: 'q@example.com', phone: '0551234567', sector: 'trade', branches: '1', plan: 'scale', lang: 'en', consent: true, website: '' });
  assert.equal(r.status, 200);
});

test('_lib.php is not executable as an endpoint', async () => {
  const r = await fetch(ORIGIN + '/api/_lib.php');
  assert.notEqual((await r.text()).includes('"ok":true'), true);
});
