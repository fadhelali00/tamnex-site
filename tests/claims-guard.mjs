// Fails when the public page uses wording the claims register forbids (marketing/CLAIMS.md).
import { readFileSync } from 'node:fs';
const raw = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const html = raw.replace(/<[^>]+>/g, ' ');
// The demo shows synthetic contract amounts; it is excluded from the price rule only.
const outsideDemo = raw.replace(/<section class="demo"[\s\S]*?<\/section>/, '').replace(/<[^>]+>/g, ' ');
const banned = [
  [/محاسب آلي/, 'محاسب آلي'], [/إقفال بضغطة/, 'إقفال بضغطة'], [/البوت/, 'البوت'], [/يدير حساباتك/, 'يدير حساباتك'],
  [/14 يوماً/, 'trial offer (no onboarding yet)'], [/ابدأ استخدام/, 'ابدأ استخدام'],
  [/في يوم (عمل )?واحد/, 'one-day migration promise'], [/داخل المملكة/, 'in-Kingdom hosting claim'],
  [/ر\.س\s*(شهرياً|سنوياً)|\/\s*شهرياً/, 'prices are hidden until approved'], [/mithqal|مثقال/i, 'old product name'],
  [/[0-9]+\s*%\s*(توفير|دقة)/, 'invented savings/accuracy figure'], [/الأول في السوق|الأفضل/, 'superlative']
];
const hits = banned.filter(([re, why]) => (why.startsWith('prices') ? outsideDemo : html).search(re) > -1).map(([, why]) => why);
if (hits.length) { console.error('Banned wording on the page:', hits.join(', ')); process.exit(1); }
console.log('claims guard: ok');
