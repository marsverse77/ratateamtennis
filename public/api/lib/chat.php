<?php
// Chat: one conversation per session for the players in it, and chat channels open to every member.
// Messages live in chat_messages with either session_id or channel_id set. Clients poll with ?after=<last id>.

const CHAT_MAX = 1000;
// A session chat push goes out only when the chat had been quiet this long, so a running conversation doesn't buzz every phone.
const CHAT_PUSH_QUIET = 600;

function chat_mention_ids(array $m): array
{
    return array_values(array_filter(array_map('intval', explode(',', (string) ($m['mentions'] ?? '')))));
}

/**
 * The members tagged in a message: ids the client sent whose "@Full Name" is still in the text,
 * limited to $allowed (the session's people) when given.
 */
function chat_mentions(string $body, ?array $allowed): array
{
    $ids = array_slice(array_values(array_unique(array_filter(array_map('intval', (array) (input()['mentions'] ?? []))))), 0, 20);
    if ($allowed !== null) {
        $ids = array_values(array_intersect($ids, $allowed));
    }
    $names = names($ids);
    return array_values(array_filter($ids, fn($id) => isset($names[$id]) && mb_stripos($body, '@' . $names[$id]) !== false));
}

/** Everyone who belongs to a session chat: registered players (confirmed or waiting) and the coaches. */
function session_chat_people(array $s): array
{
    $ids = array_map('intval', array_column(rows('SELECT user_id FROM registrations WHERE session_id = ?', [(int) $s['id']]), 'user_id'));
    return array_values(array_unique([...$ids, ...session_coach_ids($s)]));
}

/** Players registered for the session (confirmed or waiting), its coaches and admins can read and write its chat. */
function can_session_chat(array $s, ?array $u): bool
{
    if (!$u) {
        return false;
    }
    if ($u['role'] === 'admin' || in_array((int) $u['id'], session_coach_ids($s), true)) {
        return true;
    }
    return (bool) row('SELECT id FROM registrations WHERE session_id = ? AND user_id = ?', [(int) $s['id'], (int) $u['id']]);
}

function chat_messages_out(string $col, int $id, int $after): array
{
    $list = $after
        ? rows("SELECT * FROM chat_messages WHERE $col = ? AND id > ? ORDER BY id", [$id, $after])
        : array_reverse(rows("SELECT * FROM chat_messages WHERE $col = ? ORDER BY id DESC LIMIT 300", [$id]));
    $names = names(array_column($list, 'user_id'));
    $photos = photos(array_column($list, 'user_id'));
    $mnames = names(array_merge([], ...array_map('chat_mention_ids', $list)));
    $u = current_user();
    return array_map(fn($m) => [
        'id' => (int) $m['id'],
        'user' => ['id' => (int) $m['user_id'], 'name' => $names[(int) $m['user_id']] ?? 'Member', 'photo' => $photos[(int) $m['user_id']] ?? null],
        'body' => $m['body'],
        'mentions' => array_map(fn($mid) => ['id' => $mid, 'name' => $mnames[$mid] ?? 'Member'], chat_mention_ids($m)),
        'at' => $m['created_at'],
        'can_delete' => $u && ($u['role'] === 'admin' || (int) $u['id'] === (int) $m['user_id']),
    ], $list);
}

/** GET sessions/:id/chat?after=N. The first load also lists who joined and when. */
function session_chat(int $sid): array
{
    $s = get_session($sid);
    $u = require_user();
    if (!can_session_chat($s, $u)) {
        fail(403, 'Only players in this session can see its chat.');
    }
    $after = max(0, (int) ($_GET['after'] ?? 0));
    $joined = $after ? [] : array_map(fn($r) => ['name' => $r['name'], 'at' => $r['created_at']],
        rows('SELECT u.name, r.created_at FROM registrations r JOIN users u ON u.id = r.user_id WHERE r.session_id = ? ORDER BY r.created_at, r.id', [$sid]));
    $names = $after ? [] : names(session_chat_people($s));
    $people = with_photos(array_map(fn($id, $n) => ['id' => $id, 'name' => $n], array_keys($names), $names));
    return ['messages' => chat_messages_out('session_id', $sid, $after), 'joined' => $joined, 'people' => $people];
}

/** POST sessions/:id/chat. Body: {body, after, mentions: [user ids]} */
function session_chat_post(int $sid): array
{
    $s = get_session($sid);
    $u = require_user();
    if (!can_session_chat($s, $u)) {
        fail(403, 'Only players in this session can write in its chat.');
    }
    $body = str_in('body', CHAT_MAX, true);
    $people = session_chat_people($s);
    // Admins aren't in the people list but can be tagged when they took part in the chat.
    $admins = array_map('intval', array_column(rows("SELECT DISTINCT m.user_id FROM chat_messages m JOIN users x ON x.id = m.user_id WHERE m.session_id = ? AND x.role = 'admin'", [$sid]), 'user_id'));
    $tagged = chat_mentions($body, array_merge($people, $admins));
    $last = row('SELECT created_at FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT 1', [$sid]);
    insert('chat_messages', ['session_id' => $sid, 'channel_id' => null, 'user_id' => (int) $u['id'], 'body' => $body, 'mentions' => implode(',', $tagged), 'created_at' => now()]);
    $url = '#/sessions/' . $sid . '?chat';
    $tagged = array_values(array_diff($tagged, [(int) $u['id']]));
    if ($tagged) {
        notify($u['name'] . ' mentioned you · ' . $s['title'], mb_substr($body, 0, 120), $url, $tagged);
    }
    if (!$last || strtotime(now()) - strtotime($last['created_at']) >= CHAT_PUSH_QUIET) {
        $to = array_values(array_diff($people, [(int) $u['id']], $tagged));
        notify($u['name'] . ' · ' . $s['title'], mb_substr($body, 0, 120), $url, $to);
    }
    return ['messages' => chat_messages_out('session_id', $sid, (int) (input()['after'] ?? 0))];
}

/** POST chat/:id/delete: the writer or an admin removes a message. */
function chat_message_delete(int $id): array
{
    $u = require_user();
    $m = row('SELECT * FROM chat_messages WHERE id = ?', [$id]) ?? fail(404, 'Message not found.');
    if ($u['role'] !== 'admin' && (int) $u['id'] !== (int) $m['user_id']) {
        fail(403, 'You can only remove your own messages.');
    }
    q('DELETE FROM chat_messages WHERE id = ?', [$id]);
    return ['ok' => true];
}

function channel_out(array $c, ?array $last = null): array
{
    $u = current_user();
    return [
        'id' => (int) $c['id'],
        'name' => $c['name'],
        'description' => $c['description'],
        'created_by' => ['id' => (int) $c['created_by'], 'name' => names([$c['created_by']])[(int) $c['created_by']] ?? 'Member'],
        'created_at' => $c['created_at'],
        'last' => $last ? ['name' => $last['name'], 'body' => mb_substr($last['body'], 0, 90), 'at' => $last['created_at']] : null,
        'messages' => (int) ($c['n'] ?? 0),
        'can_delete' => $u && ($u['role'] === 'admin' || (int) $u['id'] === (int) $c['created_by']),
    ];
}

/** GET chats: every channel (latest activity first) and the session chats the member is in. */
function chats_list(): array
{
    $u = require_user();
    $channels = rows('SELECT c.*, (SELECT COUNT(*) FROM chat_messages m WHERE m.channel_id = c.id) AS n FROM chat_channels c');
    $lastOf = function (string $col, int $id) {
        return row("SELECT m.body, m.created_at, u.name FROM chat_messages m JOIN users u ON u.id = m.user_id WHERE m.$col = ? ORDER BY m.id DESC LIMIT 1", [$id]);
    };
    $out = array_map(fn($c) => channel_out($c, $lastOf('channel_id', (int) $c['id'])), $channels);
    usort($out, fn($a, $b) => strcmp($b['last']['at'] ?? $b['created_at'], $a['last']['at'] ?? $a['created_at']));
    $sessions = [];
    $sql = $u['role'] === 'admin'
        ? "SELECT DISTINCT s.* FROM play_sessions s JOIN chat_messages m ON m.session_id = s.id ORDER BY s.date DESC LIMIT 30"
        : "SELECT s.* FROM play_sessions s JOIN registrations r ON r.session_id = s.id WHERE r.user_id = ? ORDER BY s.date DESC LIMIT 30";
    // Sessions with messages, plus upcoming ones and those from the last week; most recent conversation first.
    $recent = date('Y-m-d', strtotime(now()) - 7 * 86400);
    foreach (rows($sql, $u['role'] === 'admin' ? [] : [(int) $u['id']]) as $s) {
        $last = $lastOf('session_id', (int) $s['id']);
        if (!$last && $s['date'] < $recent) {
            continue;
        }
        $sessions[] = ['id' => (int) $s['id'], 'title' => $s['title'], 'date' => $s['date'], 'status' => $s['status'],
            'last' => $last ? ['name' => $last['name'], 'body' => mb_substr($last['body'], 0, 90), 'at' => $last['created_at']] : null];
    }
    usort($sessions, fn($a, $b) => [$b['last']['at'] ?? '', $a['date']] <=> [$a['last']['at'] ?? '', $b['date']]);
    $sessions = array_slice($sessions, 0, 15);
    return ['channels' => $out, 'sessions' => $sessions];
}

/** POST chats. Body: {name, description}. Any member can open a channel for everyone. */
function chat_channel_create(): array
{
    $u = require_user();
    $name = str_in('name', 80, true);
    $id = insert('chat_channels', ['name' => $name, 'description' => str_in('description', 255), 'created_by' => (int) $u['id'], 'created_at' => now()]);
    activity('chat', $u['name'] . ' opened the chat channel ' . $name, '#/chat/' . $id);
    return chat_channel((int) $id);
}

/** GET chats/:id?after=N */
function chat_channel(int $id): array
{
    require_user();
    $c = row('SELECT * FROM chat_channels WHERE id = ?', [$id]) ?? fail(404, 'Chat channel not found.');
    return ['channel' => channel_out($c), 'messages' => chat_messages_out('channel_id', $id, max(0, (int) ($_GET['after'] ?? 0)))];
}

/** POST chats/:id. Body: {body, after, mentions: [user ids]} */
function chat_channel_post(int $id): array
{
    $u = require_user();
    $c = row('SELECT * FROM chat_channels WHERE id = ?', [$id]) ?? fail(404, 'Chat channel not found.');
    $body = str_in('body', CHAT_MAX, true);
    $tagged = chat_mentions($body, null);
    insert('chat_messages', ['session_id' => null, 'channel_id' => $id, 'user_id' => (int) $u['id'], 'body' => $body, 'mentions' => implode(',', $tagged), 'created_at' => now()]);
    // Channels send no push for every message, only to members tagged in it.
    if ($tagged = array_values(array_diff($tagged, [(int) $u['id']]))) {
        notify($u['name'] . ' mentioned you · ' . $c['name'], mb_substr($body, 0, 120), '#/chat/' . $id, $tagged);
    }
    return ['messages' => chat_messages_out('channel_id', $id, (int) (input()['after'] ?? 0))];
}

/** POST chats/:id/delete: the member who opened the channel or an admin removes it with its messages. */
function chat_channel_delete(int $id): array
{
    $u = require_user();
    $c = row('SELECT * FROM chat_channels WHERE id = ?', [$id]) ?? fail(404, 'Chat channel not found.');
    if ($u['role'] !== 'admin' && (int) $u['id'] !== (int) $c['created_by']) {
        fail(403, 'Only the member who opened this channel or an admin can delete it.');
    }
    q('DELETE FROM chat_messages WHERE channel_id = ?', [$id]);
    q('DELETE FROM chat_channels WHERE id = ?', [$id]);
    return ['ok' => true];
}
