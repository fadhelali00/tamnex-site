<?php
// Tamnex pre-launch interest endpoint. No third party, no email sending.
// Stores one CSV row per sign-up OUTSIDE the web root. Configure TAMNEX_DATA_DIR and TAMNEX_SALT
// in the hosting panel (environment) or in ../tamnex-config.php; never commit real values.
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function out(int $code, array $body): void { http_response_code($code); echo json_encode($body, JSON_UNESCAPED_UNICODE); exit; }

$cfgFile = dirname(__DIR__, 2) . '/tamnex-config.php';           // one level above public_html
$cfg = is_file($cfgFile) ? (array) require $cfgFile : [];
$dataDir = $cfg['data_dir'] ?? getenv('TAMNEX_DATA_DIR') ?: dirname(__DIR__, 2) . '/tamnex-data';
$salt    = $cfg['salt'] ?? getenv('TAMNEX_SALT') ?: '';
$origins = $cfg['origins'] ?? ['https://tamnex.com', 'https://www.tamnex.com'];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') out(405, ['ok' => false, 'error' => 'method']);
if ($salt === '') out(503, ['ok' => false, 'error' => 'not_configured']);
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!in_array($origin, $origins, true)) out(403, ['ok' => false, 'error' => 'origin']);
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) out(415, ['ok' => false, 'error' => 'type']);
$raw = file_get_contents('php://input', false, null, 0, 4097);
if ($raw === false || strlen($raw) > 4096) out(413, ['ok' => false, 'error' => 'size']);
$in = json_decode($raw, true);
if (!is_array($in)) out(400, ['ok' => false, 'error' => 'json']);

// Honeypot: answer like success so bots learn nothing; store nothing.
if (!empty($in['company'])) out(200, ['ok' => true]);

$email  = is_string($in['email'] ?? null) ? trim($in['email']) : '';
$sector = is_string($in['sector'] ?? null) ? $in['sector'] : '';
$need   = is_string($in['need'] ?? null) ? $in['need'] : '';
$SECTORS = ['trade', 'distribution', 'retail', 'services', 'accounting-office', 'other'];
$NEEDS   = ['', 'close', 'migration', 'distribution', 'einvoice', 'ai'];
$errors = [];
if ($email === '' || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'email';
if (!in_array($sector, $SECTORS, true)) $errors[] = 'sector';
if (!in_array($need, $NEEDS, true)) $errors[] = 'need';
if (($in['consent'] ?? null) !== true) $errors[] = 'consent';
if ($errors) out(422, ['ok' => false, 'error' => 'invalid', 'fields' => $errors]);

if (!is_dir($dataDir) && !mkdir($dataDir, 0700, true)) out(500, ['ok' => false, 'error' => 'storage']);

// Rate limit: 5 sign-ups per hour per salted IP hash. The raw IP is never stored.
// Behind the CDN, REMOTE_ADDR is the CDN node; use the first X-Forwarded-For hop for the rate limit only.
$fwd = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0]);
$client = filter_var($fwd, FILTER_VALIDATE_IP) ? $fwd : ($_SERVER['REMOTE_ADDR'] ?? '');
$ipHash = hash_hmac('sha256', $client, $salt);
$rlFile = $dataDir . '/rate-' . substr($ipHash, 0, 16) . '.json';
$now = time();
$hits = is_file($rlFile) ? array_filter((array) json_decode((string) file_get_contents($rlFile), true), fn($t) => is_int($t) && $t > $now - 3600) : [];
if (count($hits) >= 5) out(429, ['ok' => false, 'error' => 'rate']);
$hits[] = $now;
file_put_contents($rlFile, json_encode(array_values($hits)), LOCK_EX);

// CSV with formula-injection guard.
$cell = fn(string $v) => (preg_match('/^[=+\-@\t\r]/', $v) ? "'" . $v : $v);
$row = [gmdate('c'), $cell(strtolower($email)), $sector, $need, 'consent-v1', substr($ipHash, 0, 16)];
$file = $dataDir . '/interest.csv';
$new = !is_file($file);
$fh = fopen($file, 'ab');
if ($fh === false) out(500, ['ok' => false, 'error' => 'storage']);
flock($fh, LOCK_EX);
if ($new) fputcsv($fh, ['utc_time', 'email', 'sector', 'need', 'consent', 'ip_hash'], ',', '"', '');
fputcsv($fh, $row, ',', '"', '');
flock($fh, LOCK_UN);
fclose($fh);
@chmod($file, 0600);
out(200, ['ok' => true]);
