// Fails when a published page uses wording that the claims register forbids (the claims register, kept in the private ERP repository).
import { readFileSync } from 'node:fs';
const pages = ['index.html', 'en/index.html', 'preview/index.html', 'preview/pricing/index.html', 'en/preview/index.html', 'en/preview/pricing/index.html'];
const banned = [
  [/محاسب آلي|إقفال بضغطة|البوت|يدير حساباتك/, 'banned AI wording'],
  [/auto-?(post|close|approve)|closes your books automatically/i, 'AI acting without approval'],
  [/تجربة مجانية|ابدأ التجربة|free trial|start (your )?trial|14 (يوماً|days)/i, 'trial offered before its path works'],
  [/ادفع الآن|pay now|checkout|اشترك الآن/i, 'payment before sale scope is ready'],
  [/في يوم (عمل )?واحد|in (one|a single) (business )?day/i, 'one-day migration promise'],
  [/داخل المملكة|hosted in (the )?(Kingdom|Saudi)/i, 'in-Kingdom hosting claim'],
  [/الأكثر مبيعاً|best[- ]?sell|most popular/i, 'unsupported best-seller label'],
  [/mithqal|مثقال/i, 'old product name'],
  [/[0-9]+\s*%\s*(توفير|دقة)|save [0-9]+%|[0-9]+% (more )?accura/i, 'invented savings/accuracy figure'],
  [/الأول في السوق|الأفضل|the best ERP|#1/i, 'superlative'],
  [/رصيد (AI|الذكاء)|AI credit/i, 'AI credit amount'],
  [/من أسابيع إلى دقائق|weeks to minutes/i, 'unmeasured time-saving claim'],
  [/zero-?day close/i, "another vendor's tagline (D39)"]
];
let bad = 0;
for (const pg of pages) {
  const text = readFileSync(new URL('../site/' + pg, import.meta.url), 'utf8').replace(/<[^>]+>/g, ' ');
  for (const [re, why] of banned) if (re.test(text)) { console.error(`${pg}: ${why} (${text.match(re)[0]})`); bad++; }
}
if (bad) process.exit(1);
console.log('claims guard: ok (' + pages.length + ' pages)');
