<?php
// Shared helpers for the public endpoints. Not reachable over HTTP (.htaccess denies files starting with "_").
declare(strict_types=1);

function tx_headers(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
}

/** Ends the request. A JSON body for fetch(); a 303 redirect for a plain HTML form post. */
function tx_out(int $code, array $body, ?string $redirect = null): void {
    if ($redirect !== null && !tx_wants_json()) { http_response_code(303); header('Location: ' . $redirect); exit; }
    http_response_code($code); echo json_encode($body, JSON_UNESCAPED_UNICODE); exit;
}

function tx_wants_json(): bool { return stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') === 0; }

/** Config lives one level above the web root and is never committed. */
function tx_config(): array {
    $file = dirname(__DIR__, 2) . '/tamnex-config.php';
    $cfg = is_file($file) ? (array) require $file : [];
    return [
        'data_dir' => $cfg['data_dir'] ?? (getenv('TAMNEX_DATA_DIR') ?: dirname(__DIR__, 2) . '/tamnex-data'),
        'salt'     => $cfg['salt'] ?? (getenv('TAMNEX_SALT') ?: ''),
        'origins'  => $cfg['origins'] ?? (getenv('TAMNEX_ORIGINS') ? explode(',', (string) getenv('TAMNEX_ORIGINS')) : ['https://tamnex.com', 'https://www.tamnex.com']),
    ];
}

/** Method, origin and size checks. Returns the decoded input (JSON or form). */
function tx_input(array $cfg): array {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') tx_out(405, ['ok' => false, 'error' => 'method']);
    if ($cfg['salt'] === '') tx_out(503, ['ok' => false, 'error' => 'not_configured']);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (!in_array($origin, $cfg['origins'], true)) tx_out(403, ['ok' => false, 'error' => 'origin']);
    $raw = file_get_contents('php://input', false, null, 0, 8193);
    if ($raw === false || strlen($raw) > 8192) tx_out(413, ['ok' => false, 'error' => 'size']);
    if (tx_wants_json()) { $in = json_decode($raw, true); if (!is_array($in)) tx_out(400, ['ok' => false, 'error' => 'json']); return $in; }
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/x-www-form-urlencoded') === 0) { parse_str($raw, $in); return $in; }
    tx_out(415, ['ok' => false, 'error' => 'type']);
    return [];
}

/** Trimmed single-line string, control characters removed, length capped. */
function tx_str(array $in, string $k, int $max): string {
    $v = $in[$k] ?? '';
    if (!is_string($v)) return '';
    return mb_substr(trim((string) preg_replace('/[\x00-\x1F\x7F]/u', ' ', $v)), 0, $max);
}

function tx_client_hash(string $salt): string {
    $fwd = trim(explode(',', (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''))[0]);
    $client = filter_var($fwd, FILTER_VALIDATE_IP) ? $fwd : ($_SERVER['REMOTE_ADDR'] ?? '');
    return hash_hmac('sha256', $client, $salt);
}

/** N requests per hour per salted client hash and bucket. The raw IP is never stored. */
function tx_rate(array $cfg, string $bucket, int $max): void {
    $dir = tx_dir($cfg);
    $f = $dir . '/rate-' . $bucket . '-' . substr(tx_client_hash($cfg['salt']), 0, 16) . '.json';
    $now = time();
    $hits = is_file($f) ? array_values(array_filter((array) json_decode((string) file_get_contents($f), true), fn($t) => is_int($t) && $t > $now - 3600)) : [];
    if (count($hits) >= $max) tx_out(429, ['ok' => false, 'error' => 'rate']);
    $hits[] = $now;
    file_put_contents($f, json_encode($hits), LOCK_EX);
}

function tx_dir(array $cfg): string {
    $d = $cfg['data_dir'];
    if (!is_dir($d) && !mkdir($d, 0700, true)) tx_out(500, ['ok' => false, 'error' => 'storage']);
    return $d;
}

/** Appends one CSV row with a spreadsheet formula-injection guard. */
function tx_append(array $cfg, string $name, array $header, array $row): void {
    $file = tx_dir($cfg) . '/' . $name;
    $cell = fn($v) => (preg_match('/^[=+\-@\t\r]/', (string) $v) ? "'" . $v : (string) $v);
    $new = !is_file($file);
    $fh = fopen($file, 'ab');
    if ($fh === false) tx_out(500, ['ok' => false, 'error' => 'storage']);
    flock($fh, LOCK_EX);
    if ($new) fputcsv($fh, $header, ',', '"', '');
    fputcsv($fh, array_map($cell, $row), ',', '"', '');
    flock($fh, LOCK_UN);
    fclose($fh);
    @chmod($file, 0600);
}

/** True when this email already has a pre-registration (one company per owner email, D155). */
function tx_email_known(array $cfg, string $name, string $email): bool {
    $file = tx_dir($cfg) . '/' . $name;
    if (!is_file($file)) return false;
    $fh = fopen($file, 'rb'); if ($fh === false) return false;
    $head = fgetcsv($fh, null, ',', '"', '');
    $i = $head ? array_search('email', $head, true) : false;
    $found = false;
    while ($i !== false && ($r = fgetcsv($fh, null, ',', '"', '')) !== false) { if (strtolower((string) ($r[$i] ?? '')) === $email) { $found = true; break; } }
    fclose($fh);
    return $found;
}
