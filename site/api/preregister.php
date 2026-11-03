<?php
// Tamnex company pre-registration ("أنشئ حسابك"). Saves the request; the live environment and the password are
// activated later through an emailed link. The password is stored only as a one-way hash (Argon2id, else bcrypt);
// the plain password is never written anywhere. No payment, no subdomain reservation here.
declare(strict_types=1);
require __DIR__ . '/_lib.php';
tx_headers();

$cfg = tx_config();
$in  = tx_input($cfg);
$lang = in_array($in['lang'] ?? '', ['ar', 'en'], true) ? $in['lang'] : 'ar';
$prefix = $lang === 'en' ? '/en' : '';

// Honeypot: look like success, store nothing.
if (!empty($in['website'])) tx_out(200, ['ok' => true, 'ref' => 'TMX-00000000'], $prefix . '/start/received/');

// Launch-notification email update for an existing registration.
if (($in['action'] ?? '') === 'notify') {
    $ref = tx_str($in, 'ref', 20);
    $email = strtolower(tx_str($in, 'email', 254));
    if (!preg_match('/^TMX-[0-9A-F]{8}$/', $ref) || !filter_var($email, FILTER_VALIDATE_EMAIL)) tx_out(422, ['ok' => false, 'error' => 'invalid']);
    tx_rate($cfg, 'notify', 10);
    tx_append($cfg, 'launch-notify.csv', ['utc_time', 'ref', 'email'], [gmdate('c'), $ref, $email]);
    tx_out(200, ['ok' => true]);
}

$v = [
    'company'   => tx_str($in, 'company', 160),
    'sector'    => tx_str($in, 'sector', 40),
    'size'      => tx_str($in, 'size', 10),
    'branches'  => tx_str($in, 'branches', 8),
    'cr'        => preg_replace('/\D/', '', tx_str($in, 'cr', 20)),
    'subdomain' => strtolower(tx_str($in, 'subdomain', 30)),
    'first'     => tx_str($in, 'first', 80),
    'last'      => tx_str($in, 'last', 80),
    'job'       => tx_str($in, 'job', 20),
    'email'     => strtolower(tx_str($in, 'email', 254)),
    'phone'     => preg_replace('/[\s\-()]/', '', tx_str($in, 'phone', 25)),
    'vatreg'    => tx_str($in, 'vatreg', 3),
    'vat'       => preg_replace('/\D/', '', tx_str($in, 'vat', 20)),
    'fy'        => tx_str($in, 'fy', 2),
    'plan'      => tx_str($in, 'plan', 20),
];
$password = is_string($in['password'] ?? null) ? (string) $in['password'] : '';
$terms = ($in['terms'] ?? null) === true || ($in['terms'] ?? null) === 'on';
$marketing = ($in['marketing'] ?? null) === true || ($in['marketing'] ?? null) === 'on';

$RESERVED = ['admin', 'www', 'api', 'app', 'mail', 'status', 'help', 'docs', 'static', 'assets', 'cdn', 'auth', 'login', 'billing', 'support', 'mcp', 'tamnex', 'evexa'];
$e = [];
if ($v['company'] === '') $e[] = 'company';
if (!in_array($v['sector'], ['trade', 'distribution', 'retail', 'services', 'accounting-office', 'other'], true)) $e[] = 'sector';
if (!in_array($v['size'], ['1-10', '11-50', '51-200', '201+'], true)) $e[] = 'size';
if (!in_array($v['branches'], ['1', '2-5', '6+'], true)) $e[] = 'branches';
if ($v['cr'] !== '' && !preg_match('/^\d{10}$/', $v['cr'])) $e[] = 'cr';
if ($v['subdomain'] !== '' && (!preg_match('/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/', $v['subdomain']) || in_array($v['subdomain'], $RESERVED, true))) $e[] = 'subdomain';
if ($v['first'] === '') $e[] = 'first';
if ($v['last'] === '') $e[] = 'last';
if (!in_array($v['job'], ['owner', 'cfo', 'accountant', 'ops', 'other'], true)) $e[] = 'job';
if (!filter_var($v['email'], FILTER_VALIDATE_EMAIL)) $e[] = 'email';
if (!preg_match('/^\+?\d{9,15}$/', $v['phone'])) $e[] = 'phone';
if (mb_strlen($password) < 10 || strlen($password) > 128 || !preg_match('/\p{L}/u', $password) || !preg_match('/\d/', $password)) $e[] = 'password';
if (!in_array($v['vatreg'], ['yes', 'no'], true)) $e[] = 'vatreg';
if ($v['vatreg'] === 'yes' && !preg_match('/^3\d{13}3$/', $v['vat'])) $e[] = 'vat';
if ($v['vatreg'] === 'no') $v['vat'] = '';
if (!preg_match('/^(?:[1-9]|1[0-2])$/', $v['fy'])) $e[] = 'fy';
if (!in_array($v['plan'], ['', 'launch', 'growth', 'scale', 'enterprise'], true)) $e[] = 'plan';
if (!$terms) $e[] = 'terms';
if ($e) tx_out(422, ['ok' => false, 'error' => 'invalid', 'fields' => $e], $prefix . '/start/?error=invalid');

tx_rate($cfg, 'prereg', 5);
if (tx_email_known($cfg, 'preregistrations.csv', $v['email'])) tx_out(409, ['ok' => false, 'error' => 'duplicate'], $prefix . '/start/?error=duplicate');

$ref = 'TMX-' . strtoupper(bin2hex(random_bytes(4)));
$hash = password_hash($password, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT);
unset($password);
tx_append($cfg, 'preregistrations.csv',
    ['utc_time', 'ref', 'company', 'sector', 'size', 'branches', 'cr', 'subdomain_pref', 'first', 'last', 'job', 'email', 'phone', 'password_hash', 'vat_registered', 'vat', 'fy_start_month', 'plan', 'lang', 'terms', 'marketing', 'ip_hash'],
    [gmdate('c'), $ref, $v['company'], $v['sector'], $v['size'], $v['branches'], $v['cr'], $v['subdomain'], $v['first'], $v['last'], $v['job'], $v['email'], $v['phone'], $hash, $v['vatreg'], $v['vat'], $v['fy'], $v['plan'], $lang, 'terms-v1', $marketing ? 'yes' : 'no', substr(tx_client_hash($cfg['salt']), 0, 16)]
);
tx_out(200, ['ok' => true, 'ref' => $ref], $prefix . '/start/received/');
