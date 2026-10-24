<?php
// Audit trail for corrections and admin decisions, and the one-device scoring lock (spec v2, P4).

const LOCK_SECS = 90; // a scorer that hasn't written for this long no longer holds the match

function audit(string $action, string $entity, int $entityId, $before = null, $after = null, string $reason = ''): void
{
    insert('audit_log', [
        'actor_id' => current_user()['id'] ?? null,
        'action' => $action,
        'entity' => $entity,
        'entity_id' => $entityId,
        'before_json' => $before === null ? null : json_encode($before, JSON_UNESCAPED_UNICODE),
        'after_json' => $after === null ? null : json_encode($after, JSON_UNESCAPED_UNICODE),
        'reason' => mb_substr($reason, 0, 255),
        'created_at' => now(),
    ]);
}

/** The reason sent with a correction; required for changes to a finished match. */
function reason_in(bool $required): string
{
    $r = str_in('reason', 255);
    if ($required && $r === '') {
        fail(422, 'Give a reason for changing a finished match.');
    }
    return $r;
}

/** The scoring device: a random id each browser keeps, sent in the X-Device header. */
function device_id(): string
{
    return preg_replace('/[^A-Za-z0-9_-]/', '', substr((string) ($_SERVER['HTTP_X_DEVICE'] ?? ''), 0, 40));
}

function lock_active(array $m): bool
{
    return !empty($m['lock_at']) && time() - strtotime($m['lock_at']) < LOCK_SECS;
}

/** Stops a second device from scoring a match while another one is; takeover moves the lock here. */
function claim_lock(array $m, bool $takeover = false): void
{
    $u = current_user();
    $dev = device_id();
    $other = lock_active($m) && ((int) $m['lock_user'] !== (int) $u['id'] || (string) $m['lock_device'] !== $dev);
    if ($other && !$takeover) {
        $who = names([(int) $m['lock_user']])[(int) $m['lock_user']] ?? 'Someone';
        fail(409, "$who is scoring this match on another device. Tap Take over to score here.");
    }
    if ($other) {
        audit('scoring_takeover', 'match', (int) $m['id'], ['user' => (int) $m['lock_user']], ['user' => (int) $u['id']]);
    }
    q('UPDATE matches SET lock_user = ?, lock_device = ?, lock_at = ? WHERE id = ?', [(int) $u['id'], $dev, now(), $m['id']]);
}

/** Who is scoring the match right now, for the scorer screen. */
function lock_out(array $m): ?array
{
    if (!lock_active($m)) {
        return null;
    }
    $u = current_user();
    return [
        'name' => names([(int) $m['lock_user']])[(int) $m['lock_user']] ?? 'Someone',
        'mine' => $u && (int) $m['lock_user'] === (int) $u['id'] && (string) $m['lock_device'] === device_id(),
    ];
}

/** Admin: latest audit entries (?entity=match&id=12 narrows it). */
function audit_list(): array
{
    require_admin();
    $where = '1 = 1';
    $args = [];
    if (!empty($_GET['entity'])) {
        $where .= ' AND entity = ?';
        $args[] = (string) $_GET['entity'];
    }
    if (!empty($_GET['id'])) {
        $where .= ' AND entity_id = ?';
        $args[] = (int) $_GET['id'];
    }
    $rows = rows("SELECT * FROM audit_log WHERE $where ORDER BY id DESC LIMIT 300", $args);
    $names = names(array_filter(array_map(fn($r) => (int) $r['actor_id'], $rows)));
    return ['entries' => array_map(fn($r) => [
        'id' => (int) $r['id'],
        'actor' => $r['actor_id'] ? ['id' => (int) $r['actor_id'], 'name' => $names[(int) $r['actor_id']] ?? 'Member'] : null,
        'action' => $r['action'],
        'entity' => $r['entity'],
        'entity_id' => (int) $r['entity_id'],
        'before' => $r['before_json'] !== null ? json_decode($r['before_json'], true) : null,
        'after' => $r['after_json'] !== null ? json_decode($r['after_json'], true) : null,
        'reason' => $r['reason'],
        'created_at' => $r['created_at'],
    ], $rows)];
}

// ---- activity feed: what members do on the site, kept for admins with the date and time ----

/** Records something a member did; with $push, admins (other than the member) also get a notification. */
function activity(string $kind, string $text, string $url = '', bool $push = false, ?int $by = null): void
{
    $u = $by ? ['id' => $by] : current_user();
    $text = mb_substr($text, 0, 255);
    insert('activity_log', ['user_id' => $u['id'] ?? null, 'kind' => $kind, 'text' => $text, 'url' => $url, 'created_at' => now()]);
    if ($push) {
        $admins = array_map('intval', array_column(rows("SELECT id FROM users WHERE role = 'admin' AND id <> ?", [(int) ($u['id'] ?? 0)]), 'id'));
        notify('RATA activity', $text, $url ?: '#/activity', $admins);
    }
}

/** Activity entries this admin hasn't opened the feed for yet. */
function activity_unread(int $uid): int
{
    $seen = (int) (row('SELECT v FROM meta WHERE k = ?', ['activity_seen_' . $uid])['v'] ?? 0);
    return (int) q('SELECT COUNT(*) FROM activity_log WHERE id > ?', [$seen])->fetchColumn();
}

/** Admin: the activity feed, newest first, 100 at a time (?before=id for older, ?kind= to narrow it). Opening it marks it read. */
function activity_list(): array
{
    $admin = require_admin();
    $where = '1 = 1';
    $args = [];
    if (!empty($_GET['before'])) {
        $where .= ' AND id < ?';
        $args[] = (int) $_GET['before'];
    }
    if (!empty($_GET['kind'])) {
        $where .= ' AND kind = ?';
        $args[] = (string) $_GET['kind'];
    }
    $list = rows("SELECT * FROM activity_log WHERE $where ORDER BY id DESC LIMIT 101", $args);
    $more = count($list) > 100;
    $list = array_slice($list, 0, 100);
    $key = 'activity_seen_' . $admin['id'];
    $seen = (int) (row('SELECT v FROM meta WHERE k = ?', [$key])['v'] ?? 0);
    if (empty($_GET['before']) && empty($_GET['kind']) && $list && (int) $list[0]['id'] > $seen) {
        q('DELETE FROM meta WHERE k = ?', [$key]);
        q('INSERT INTO meta (k, v) VALUES (?, ?)', [$key, (string) $list[0]['id']]);
    }
    $av = photos(array_filter(array_map(fn($r) => (int) $r['user_id'], $list)));
    $names = names(array_filter(array_map(fn($r) => (int) $r['user_id'], $list)));
    return ['seen' => $seen, 'more' => $more, 'items' => array_map(fn($r) => [
        'id' => (int) $r['id'],
        'user' => $r['user_id'] ? ['id' => (int) $r['user_id'], 'name' => $names[(int) $r['user_id']] ?? 'Member', 'photo' => $av[(int) $r['user_id']] ?? null] : null,
        'kind' => $r['kind'],
        'text' => $r['text'],
        'url' => $r['url'],
        'created_at' => $r['created_at'],
    ], $list)];
}
