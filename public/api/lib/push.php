<?php
// Web push notifications (new sessions, published schedules) to members' phones.
//
// Pushes carry no payload, so nothing has to be encrypted: the push only wakes the service worker
// (sw.js), which then asks the API for that subscription's pending notifications and shows them.
// Each push is signed with a VAPID key (ES256) that is created on first use and kept in the meta table.

/** Returns [private key PEM, public key as base64url uncompressed point]. */
function vapid_keys(): array
{
    $der = row("SELECT v FROM meta WHERE k = 'vapid_private'")['v'] ?? null;
    if (!$der) {
        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        if (!$key || !openssl_pkey_export($key, $pem)) {
            fail(500, 'Could not create the notification key.');
        }
        // stored as "<PEM label>|<base64 body>" (OpenSSL 1.1 writes "EC PRIVATE KEY", 3.x "PRIVATE KEY")
        $label = str_contains($pem, 'EC PRIVATE KEY') ? 'EC PRIVATE KEY' : 'PRIVATE KEY';
        $der = $label . '|' . preg_replace('/-----[^-]+-----|\s+/', '', $pem);
        q('INSERT INTO meta (k, v) VALUES (?, ?)', ['vapid_private', $der]);
    }
    [$label, $body] = explode('|', $der, 2);
    $pem = "-----BEGIN $label-----\n" . chunk_split($body, 64, "\n") . "-----END $label-----\n";
    $ec = openssl_pkey_get_details(openssl_pkey_get_private($pem))['ec'];
    $pad = fn($s) => str_pad($s, 32, "\0", STR_PAD_LEFT);
    return [$pem, b64url("\x04" . $pad($ec['x']) . $pad($ec['y']))];
}

function b64url(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}

/** VAPID Authorization header value for one push service origin. */
function vapid_auth(string $endpoint, string $pem, string $pub): string
{
    $u = parse_url($endpoint);
    $aud = $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
    $site = 'https://' . preg_replace('/[^a-z0-9.\-:]/i', '', $_SERVER['HTTP_HOST'] ?? 'ratateamtennis.id');
    $data = b64url(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.'
        . b64url(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => $site], JSON_UNESCAPED_SLASHES));
    openssl_sign($data, $der, $pem, OPENSSL_ALGO_SHA256);
    return 'vapid t=' . $data . '.' . b64url(ecdsa_raw($der)) . ', k=' . $pub;
}

/** DER ECDSA signature (SEQUENCE of two INTEGERs) to the 64-byte r||s form JWT wants. */
function ecdsa_raw(string $der): string
{
    $off = 2 + (ord($der[1]) & 0x80 ? ord($der[1]) & 0x7f : 0);
    $out = '';
    for ($i = 0; $i < 2; $i++) {
        $len = ord($der[$off + 1]);
        $int = ltrim(substr($der, $off + 2, $len), "\0");
        $out .= str_pad($int, 32, "\0", STR_PAD_LEFT);
        $off += 2 + $len;
    }
    return $out;
}

/** Body: {endpoint}. Stores this browser's push subscription for the logged-in member. */
function push_subscribe(): array
{
    $u = require_user();
    $ep = push_endpoint();
    $hash = hash('sha256', $ep);
    $have = row('SELECT id FROM push_subs WHERE ep_hash = ?', [$hash]);
    if ($have) {
        update('push_subs', (int) $have['id'], ['user_id' => (int) $u['id']]);
    } else {
        insert('push_subs', ['user_id' => (int) $u['id'], 'endpoint' => $ep, 'ep_hash' => $hash, 'created_at' => now()]);
    }
    return ['ok' => true];
}

function push_unsubscribe(): array
{
    push_drop(hash('sha256', push_endpoint()));
    return ['ok' => true];
}

/**
 * Called by the service worker when a push arrives. Body: {endpoint}.
 * The endpoint is an unguessable URL only that browser knows, so it identifies the subscription.
 * Each push carries one notification, so this hands out the oldest one still waiting.
 */
function push_pending(): array
{
    $sub = row('SELECT id FROM push_subs WHERE ep_hash = ?', [hash('sha256', push_endpoint())]);
    if (!$sub) {
        return ['notification' => null];
    }
    $n = row('SELECT n.id, n.title, n.body, n.url FROM push_queue p JOIN notifications n ON n.id = p.notification_id
              WHERE p.sub_id = ? AND n.created_at >= ? ORDER BY n.id LIMIT 1', [(int) $sub['id'], date('Y-m-d H:i:s', time() - 86400)]);
    if ($n) {
        q('DELETE FROM push_queue WHERE sub_id = ? AND notification_id = ?', [(int) $sub['id'], (int) $n['id']]);
        $n['id'] = (int) $n['id'];
    }
    return ['notification' => $n];
}

function push_endpoint(): string
{
    $ep = (string) (input()['endpoint'] ?? '');
    if (strlen($ep) > 1000 || !preg_match('#^https://[^\s/]+/#', $ep)) {
        fail(422, 'Invalid subscription.');
    }
    return $ep;
}

function push_drop(string $hash): void
{
    $sub = row('SELECT id FROM push_subs WHERE ep_hash = ?', [$hash]);
    if ($sub) {
        q('DELETE FROM push_queue WHERE sub_id = ?', [(int) $sub['id']]);
        q('DELETE FROM push_subs WHERE id = ?', [(int) $sub['id']]);
    }
}

/**
 * Queues a notification for members (all subscribed members, or only $userIds) and pushes it
 * after the API response has been sent, so the admin isn't kept waiting.
 */
function notify(string $title, string $body, string $url, ?array $userIds = null): void
{
    if ($userIds === []) {
        return;
    }
    $subs = $userIds === null
        ? rows('SELECT id, endpoint FROM push_subs')
        : rows('SELECT id, endpoint FROM push_subs WHERE user_id IN (' . implode(',', array_map('intval', $userIds)) . ')');
    if (!$subs) {
        return;
    }
    q('DELETE FROM push_queue WHERE notification_id IN (SELECT id FROM notifications WHERE created_at < ?)', [date('Y-m-d H:i:s', time() - 2 * 86400)]);
    $nid = insert('notifications', ['title' => $title, 'body' => $body, 'url' => $url, 'created_at' => now()]);
    foreach ($subs as $s) {
        insert('push_queue', ['sub_id' => (int) $s['id'], 'notification_id' => $nid]);
    }
    after_response(fn() => push_send($subs));
}

/** Sends an empty push to each subscription in parallel; drops the ones the push service says are gone. */
function push_send(array $subs): void
{
    [$pem, $pub] = vapid_keys();
    $mh = curl_multi_init();
    $handles = [];
    foreach ($subs as $s) {
        $ch = curl_init($s['endpoint']);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => '',
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => ['TTL: 86400', 'Urgency: normal', 'Content-Length: 0', 'Authorization: ' . vapid_auth($s['endpoint'], $pem, $pub)],
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[] = [$ch, $s];
    }
    do {
        $status = curl_multi_exec($mh, $running);
        if ($running) {
            curl_multi_select($mh, 1.0);
        }
    } while ($running && $status === CURLM_OK);
    foreach ($handles as [$ch, $s]) {
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        if ($code === 404 || $code === 410) {
            q('DELETE FROM push_queue WHERE sub_id = ?', [(int) $s['id']]);
            q('DELETE FROM push_subs WHERE id = ?', [(int) $s['id']]);
        } elseif ($code >= 400) {
            error_log("[bcs] push failed ($code): " . substr((string) curl_multi_getcontent($ch), 0, 200));
        }
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
}
