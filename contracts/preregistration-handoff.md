# Pre-registration handoff to the ERP (owner password import)

Owner decision, 2026-11-04: the company owner chooses a password in step 2 of `/start/`. The ERP imports the
stored hash when it provisions the company, so the owner signs in with that same password. There is no
password-reset step by email. The activation email only announces that the environment is ready and gives a
direct sign-in link.

## Where the data is
`preregistrations.csv` lives in `TAMNEX_DATA_DIR` (outside `public_html`). It is UTF-8 with a header row, and
cells that start with `= + - @` are prefixed with `'` (formula guard; strip it on import).

| column | content |
|---|---|
| `ref` | `TMX-XXXXXXXX`, the reference shown to nobody but kept for support and notify updates |
| `company`, `sector`, `size`, `branches`, `cr`, `subdomain_pref` | company step |
| `first`, `last`, `job`, `email`, `phone` | owner (phone in `+9665XXXXXXXX`) |
| `password_hash` | **Argon2id PHC string**, see below |
| `vat_registered`, `vat`, `fy_start_month`, `plan` | tax and plan (`plan` = stable catalog id `launch`/`growth`/`scale`) |
| `lang`, `terms`, `marketing`, `utc_time`, `ip_hash` | consent and audit |

## Hash format (must stay compatible with `apps/api/src/auth/password.ts`)
- `$argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>`. These are the ERP's own `ARGON2_OPTIONS` (ADR-0011 §2.2).
- The hash is produced by PHP `password_hash(..., PASSWORD_ARGON2ID, memory_cost 19456, time_cost 2, threads 1)`.
- It is verified by `@node-rs/argon2` `verify(hash, password)`, the same call as the ERP's `verifyPassword`.
  `tests/endpoints.test.mjs` checks this end to end on every CI run.
- **There is no bcrypt fallback.** If the host lacks Argon2id, registration returns 503 instead of storing a hash
  the ERP cannot verify.
- **Policy mirrors ERP BR-SEC-006:**
  - 12..128 characters, no composition rules.
  - Not in the ERP common-password list. `site/api/_common-passwords.php` is generated from
    `apps/api/src/auth/common-passwords.ts` by `scripts/sync-common-passwords.mjs`; re-run that script whenever
    the ERP list changes.
  - Must not contain the email local part (4 or more characters).

## Import rules for the ERP team
1. Store `password_hash` as-is in the owner's credential and never re-hash it.
2. Treat the owner email as unique at signup (the site already refuses a second company for the same owner email).
3. After import, delete the CSV row or rotate the file. The hash is a credential and must not live in two places.
4. The activation email contains no password and no reset token: it carries the sign-in URL only.
