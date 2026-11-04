<?php
// Stealth teaser waitlist ("سجّل اهتمامك"). One field: the visitor's email.
// Stores email, UTC time and language OUTSIDE the web root, then notifies the admin inbox by email.
// The admin address comes only from server config (tamnex-config.php 'notify_email' or env TAMNEX_NOTIFY_EMAIL)
// and is never written into any response.
declare(strict_types=1);
require __DIR__ . '/_lib.php';

tx_headers();
$cfg = tx_config();
$in = tx_input($cfg);
$lang = ($in['lang'] ?? '') === 'en' ? 'en' : 'ar';
$prefix = $lang === 'en' ? '/en' : '';

// Honeypot: look like success, store nothing.
if (!empty($in['website'])) tx_out(200, ['ok' => true], $prefix . '/joined/');

$email = strtolower(tx_str($in, 'email', 254));
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) tx_out(422, ['ok' => false, 'error' => 'invalid', 'fields' => ['email']], $prefix . '/');

tx_rate($cfg, 'waitlist', 10);
// Idempotent: a repeat sign-up is answered the same way, without a second row or a second notification.
if (tx_email_known($cfg, 'waitlist.csv', $email)) tx_out(200, ['ok' => true], $prefix . '/joined/');

$at = gmdate('c');
tx_append($cfg, 'waitlist.csv', ['utc_time', 'email', 'lang', 'ip_hash'], [$at, $email, $lang, substr(tx_client_hash($cfg['salt']), 0, 16)]);
tx_notify($cfg, 'Tamnex waitlist: new sign-up', "New early-access sign-up on tamnex.com\n\nEmail: {$email}\nTime (UTC): {$at}\nLanguage: {$lang}\n");
tx_out(200, ['ok' => true], $prefix . '/joined/');
