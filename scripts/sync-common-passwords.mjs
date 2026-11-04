// Usage: node scripts/sync-common-passwords.mjs <erp>/apps/api/src/auth/common-passwords.ts site/api/_common-passwords.php
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(process.argv[2], 'utf8');
const arr = JSON.parse(src.slice(src.indexOf('= [') + 2, src.lastIndexOf(']') + 1).replace(/,\s*\]$/, ']'));
const php = `<?php
// Common leaked passwords (12..128 chars, lower-cased): the same list the Tamnex ERP enforces in
// apps/api/src/auth/common-passwords.ts (BR-SEC-006). Source: UK NCSC 100k + xato.net top-100k via
// SecLists (MIT). Regenerate with scripts/sync-common-passwords.mjs when the ERP list changes.
declare(strict_types=1);
return [\n${arr.map(p => '  ' + JSON.stringify(p).replace(/\$/g, '\\$') + ' => true,').join('\n')}\n];
`;
writeFileSync(process.argv[3], php);
console.log(arr.length, 'entries');
