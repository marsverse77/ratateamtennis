<?php
// JSON API. Route is passed as ?r=path, e.g. api/index.php?r=sessions/3/register

require __DIR__ . '/lib/db.php';
require __DIR__ . '/lib/scheduler.php';
require __DIR__ . '/lib/app.php';
require __DIR__ . '/lib/points.php';
require __DIR__ . '/lib/tournaments.php';
require __DIR__ . '/lib/coaching.php';
require __DIR__ . '/lib/audit.php';
require __DIR__ . '/lib/scoring.php';
require __DIR__ . '/lib/push.php';
require __DIR__ . '/lib/chat.php';

const PHOTO_DIR = __DIR__ . '/../uploads/avatars';
const PHOTO_URL = 'uploads/avatars';
const PROOF_DIR = __DIR__ . '/data/proofs';
const SESSION_PHOTO_DIR = __DIR__ . '/../uploads/sessions';
const SESSION_PHOTO_URL = 'uploads/sessions';
const BANNER_DIR = __DIR__ . '/../uploads/banners';
const BANNER_URL = 'uploads/banners';
const BLOG_DIR = __DIR__ . '/../uploads/blog';
const BLOG_URL = 'uploads/blog';
const HERO_DIR = __DIR__ . '/../uploads/hero';
const HERO_URL = 'uploads/hero';
// Banner sizes: square for the session card, 16:9 for the top of the session page.
const BANNER_SIZES = ['square' => 1080, 'wide' => 1920];
// Hitting Session options (key => label).
const HIT_FORMATS = ['open' => 'Open Hitting', 'rally' => 'Rally & Consistency', 'drills' => 'Drills & Hitting', 'points' => 'Point Play Practice'];
const HIT_LEVELS = ['all' => 'All Levels', 'first_timer' => 'First timer', 'newbie' => 'Newbie', 'beginner' => 'Beginner', 'intermediate' => 'Intermediate', 'advanced' => 'Advanced'];
const HIT_PARTNERS = ['rotate' => 'Rotate partners automatically', 'fixed' => 'Fixed hitting partner', 'free' => 'Free play / self-organized'];
const HIT_BALLS = ['provided' => 'Tennis balls provided', 'byo' => 'Bring your own balls'];
const LEVELS = ['first_timer', 'newbie', 'beginner', 'intermediate', 'advanced'];
const USER_COLS = 'id, name, email, phone, photo, coach, gender, instagram, level, experience, role, created_at';

$method = $_SERVER['REQUEST_METHOD'];
$route = trim((string) ($_GET['r'] ?? ''), '/');
$parts = $route === '' ? [] : explode('/', $route);

try {
    if ($method === 'POST' && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'bcs') {
        fail(400, 'Bad request.');
    }
    json_out(dispatch($method, $parts));
} catch (HttpError $e) {
    json_out(['error' => $e->getMessage()], $e->status);
} catch (PDOException $e) {
    error_log('[bcs] ' . $e);
    json_out(['error' => 'Database error. Please try again.'], 500);
} catch (RuntimeException $e) {
    json_out(['error' => $e->getMessage()], 422);
} catch (Throwable $e) {
    error_log('[bcs] ' . $e);
    json_out(['error' => 'Something went wrong on the server.'], 500);
}

function dispatch(string $method, array $p): array
{
    $n = count($p);
    $id = $n > 1 && ctype_digit($p[1]) ? (int) $p[1] : 0;
    $key = $method . ' ' . ($p[0] ?? '') . ($id ? '/:id' : ($n > 1 ? '/' . $p[1] : '')) . ($n > 2 ? '/' . implode('/', array_slice($p, 2)) : '');

    return match ($key) {
        'GET me' => ['user' => current_user(), 'activity_unread' => (current_user()['role'] ?? '') === 'admin' ? activity_unread((int) current_user()['id']) : 0],
        'POST auth/register' => auth_register(),
        'POST auth/login' => auth_login(),
        'POST auth/logout' => auth_logout(),
        'POST me' => me_update(),
        'GET home' => home(),
        'GET sessions' => sessions_list(),
        'POST sessions' => session_save(0),
        'GET sessions/:id' => session_detail($id),
        'POST sessions/:id' => session_save($id),
        'POST sessions/:id/delete' => session_delete($id),
        'POST sessions/:id/register' => session_register($id, true),
        'POST sessions/:id/unregister' => session_register($id, false),
        'POST sessions/:id/players' => session_players_edit($id),
        'POST sessions/:id/generate' => session_generate($id),
        'POST sessions/:id/status' => session_set_status($id),
        'POST matches/:id' => match_score($id),
        'GET matches/:id' => match_detail($id),
        'POST matches/:id/action' => match_action($id),
        'POST matches/:id/lineup' => match_lineup($id),
        'POST matches/:id/placement' => match_placement($id),
        'POST sessions/:id/matches' => match_create($id),
        'POST sessions/:id/round-time' => round_time($id),
        'POST sessions/:id/round-delete' => round_delete($id),
        'POST sessions/:id/pay' => session_pay($id),
        'POST sessions/:id/payments' => session_payment_admin($id),
        'POST refunds/:id' => refund_mark($id),
        'GET payments/:id/proof' => payment_proof($id),
        'GET finance' => finance(),
        'GET backup' => backup_download(),
        'POST sessions/:id/photos' => session_photo_add($id),
        'POST sessions/:id/photos/delete' => session_photo_delete($id),
        'POST sessions/:id/banner' => session_banner($id),
        'POST sessions/:id/posts' => session_post_add($id),
        'POST sessions/:id/posts/delete' => session_post_delete($id),
        'POST members/:id/comments' => timeline_comment_add($id),
        'POST members/:id/comments/delete' => timeline_comment_delete($id),
        'GET live' => live(),
        'GET leaderboard' => leaderboard(),
        'POST sessions/:id/placements' => session_placements($id),
        'GET external' => external_list(),
        'POST external' => external_save(0),
        'POST external/:id' => external_save($id),
        'POST external/:id/review' => external_review($id),
        'POST external/:id/delete' => external_delete($id),
        'GET external/:id/proof' => external_proof($id),
        'POST sessions/:id/attendance' => session_attendance($id),
        'POST rewards' => reward_claim(),
        'GET rewards' => rewards_list(),
        'POST rewards/:id' => reward_handle($id),
        'GET audit' => audit_list(),
        'POST hero' => hero_add(),
        'POST hero/delete' => hero_delete(),
        'POST hero/order' => hero_order(),
        'POST team-photo' => team_photo_set(),
        'POST team-photo/delete' => team_photo_reset(),
        'GET activity' => activity_list(),
        'GET sessions/:id/chat' => session_chat($id),
        'POST sessions/:id/chat' => session_chat_post($id),
        'POST chat/:id/delete' => chat_message_delete($id),
        'GET chats' => chats_list(),
        'POST chats' => chat_channel_create(),
        'GET chats/:id' => chat_channel($id),
        'POST chats/:id' => chat_channel_post($id),
        'POST chats/:id/delete' => chat_channel_delete($id),
        'GET members' => members_list(),
        'POST members' => member_create(),
        'GET members/:id' => member_detail($id),
        'POST members/:id' => member_edit($id),
        'POST members/:id/photo' => member_photo($id),
        'GET blog' => blog_list(),
        'POST blog' => blog_save(0),
        'POST blog/image' => blog_image(),
        'GET blog/:id' => blog_detail($id),
        'POST blog/:id' => blog_save($id),
        'GET push/key' => ['key' => vapid_keys()[1]],
        'POST push/subscribe' => push_subscribe(),
        'POST push/unsubscribe' => push_unsubscribe(),
        'POST push/pending' => push_pending(),
        default => fail(404, 'Not found.'),
    };
}

// ---- auth ----

function auth_register(): array
{
    $name = str_in('name', 100, true);
    $email = strtolower(str_in('email', 190, true));
    $password = (string) (input()['password'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail(422, 'Please enter a valid email.');
    }
    if (strlen($password) < 8) {
        fail(422, 'Password must be at least 8 characters.');
    }
    if (row('SELECT id FROM users WHERE email = ?', [$email])) {
        fail(409, 'An account with this email already exists. Try logging in.');
    }
    // The very first account becomes the admin.
    $first = (int) q('SELECT COUNT(*) FROM users')->fetchColumn() === 0;
    $id = insert('users', [
        'name' => $name,
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => $first ? 'admin' : 'member',
        'created_at' => now(),
    ] + profile_in());
    login_as($id);
    if (!$first) {
        activity('signup', "$name joined RATA", "#/members/$id", true, $id);
    }
    return ['user' => row('SELECT ' . USER_COLS . ' FROM users WHERE id = ?', [$id])];
}

function auth_login(): array
{
    $email = strtolower(str_in('email', 190, true));
    $password = (string) (input()['password'] ?? '');
    $u = row('SELECT * FROM users WHERE email = ?', [$email]);
    if (!$u || !$u['password_hash'] || !password_verify($password, $u['password_hash'])) {
        usleep(400000);
        fail(401, 'Wrong email or password.');
    }
    login_as((int) $u['id']);
    unset($u['password_hash']);
    return ['user' => $u];
}

function auth_logout(): array
{
    start_session();
    $_SESSION = [];
    session_destroy();
    return ['ok' => true];
}

/**
 * Profile fields from the request body. Only keys that were sent are returned, so partial edits work.
 * The phone column holds the member's WhatsApp number.
 */
function profile_in(): array
{
    $in = input();
    $out = [];
    if (array_key_exists('phone', $in)) {
        $out['phone'] = str_in('phone', 40);
    }
    if (array_key_exists('coach', $in)) {
        $out['coach'] = str_in('coach', 120);
    }
    if (array_key_exists('gender', $in)) {
        $g = str_in('gender', 10);
        if (!in_array($g, ['', 'male', 'female'], true)) {
            fail(422, 'Unknown gender.');
        }
        $out['gender'] = $g;
    }
    if (array_key_exists('instagram', $in)) {
        // Accept "@name", "name" or a profile link; store just the handle.
        $ig = preg_replace('~^(https?://)?(www\.)?instagram\.com/~i', '', str_in('instagram', 200));
        $ig = ltrim(trim($ig, " /"), '@');
        $ig = preg_replace('~[/?].*$~', '', $ig);
        if ($ig !== '' && !preg_match('/^[A-Za-z0-9._]{1,30}$/', $ig)) {
            fail(422, 'Instagram account should look like @yourname.');
        }
        $out['instagram'] = $ig;
    }
    if (array_key_exists('level', $in)) {
        $l = str_in('level', 20);
        if ($l !== '' && !in_array($l, LEVELS, true)) {
            fail(422, 'Unknown tennis level.');
        }
        $out['level'] = $l;
    }
    if (array_key_exists('experience', $in)) {
        $out['experience'] = str_in('experience', 2000);
    }
    return $out;
}

function me_update(): array
{
    $u = require_user();
    $data = ['name' => str_in('name', 100, true)] + profile_in();
    $pw = (string) (input()['password'] ?? '');
    if ($pw !== '') {
        if (strlen($pw) < 8) {
            fail(422, 'Password must be at least 8 characters.');
        }
        $data['password_hash'] = password_hash($pw, PASSWORD_DEFAULT);
    }
    update('users', (int) $u['id'], $data);
    return ['user' => row('SELECT ' . USER_COLS . ' FROM users WHERE id = ?', [$u['id']])];
}

// ---- home / lists ----

function home(): array
{
    $today = date('Y-m-d');
    $upcoming = rows("SELECT * FROM play_sessions WHERE status IN ('open','live') AND date >= ? ORDER BY date, start_time LIMIT 4", [$today]);
    $members = rows('SELECT id, name, photo FROM users ORDER BY id LIMIT 12');
    $my = my_registrations();
    return [
        'slides' => hero_slides(),
        'team_photo' => team_photo(),
        'upcoming' => array_map('session_out', $upcoming),
        'live' => live()['matches'],
        'leaderboard' => array_slice(overall_standings(), 0, 5),
        'members' => $members,
        'member_count' => (int) q('SELECT COUNT(*) FROM users')->fetchColumn(),
        'mine' => $my['mine'],
        'waiting' => $my['waiting'],
    ];
}

/** Session ids the signed-in member is playing in, and the ones where they are on the waiting list. */
function my_registrations(): array
{
    $out = ['mine' => [], 'waiting' => []];
    if ($u = current_user()) {
        foreach (rows('SELECT session_id, status FROM registrations WHERE user_id = ?', [$u['id']]) as $r) {
            $out[$r['status'] === 'confirmed' ? 'mine' : 'waiting'][] = (int) $r['session_id'];
        }
    }
    return $out;
}

function sessions_list(): array
{
    $today = date('Y-m-d');
    $upcoming = rows("SELECT * FROM play_sessions WHERE status <> 'completed' AND (date >= ? OR status = 'live') ORDER BY date, start_time", [$today]);
    $past = rows("SELECT * FROM play_sessions WHERE status = 'completed' OR (date < ? AND status <> 'live') ORDER BY date DESC, start_time DESC LIMIT 100", [$today]);
    ['mine' => $mine, 'waiting' => $waiting] = my_registrations();
    return [
        'upcoming' => array_map('session_out', $upcoming),
        'past' => array_map('session_out', $past),
        'mine' => $mine,
        'waiting' => $waiting,
        'formats' => array_map(fn($f) => $f['label'], FORMATS),
        'hitting' => ['format' => HIT_FORMATS, 'level' => HIT_LEVELS, 'partners' => HIT_PARTNERS, 'balls' => HIT_BALLS],
    ];
}

// ---- sessions ----

/** Numbers the rounds 1, 2, 3… again after a round or a round's last match was removed. */
function compact_rounds(int $sid): void
{
    $n = 0;
    $moved = false;
    foreach (array_column(rows('SELECT DISTINCT round FROM matches WHERE session_id = ? ORDER BY round', [$sid]), 'round') as $r) {
        $n++;
        if ((int) $r !== $n) {
            q('UPDATE matches SET round = ? WHERE session_id = ? AND round = ?', [$n, $sid, $r]);
            $moved = true;
        }
    }
    if ($moved) {
        q('UPDATE play_sessions SET rounds = ? WHERE id = ?', [$n, $sid]);
    }
}

function session_detail(int $id): array
{
    compact_rounds($id); // also repairs schedules that got a gap before this existed
    $s = get_session($id);
    $players = session_players($id);
    $matches = rows('SELECT * FROM matches WHERE session_id = ? ORDER BY round, court', [$id]);
    $ids = $players;
    foreach ($matches as $m) {
        array_push($ids, $m['a1'], $m['a2'], $m['b1'], $m['b2']);
    }
    $regs = rows('SELECT r.*, u.name FROM registrations r JOIN users u ON u.id = r.user_id
                  WHERE r.session_id = ? ORDER BY r.created_at, r.id', [$id]);
    $names = names($ids);
    $u = current_user();
    $mine = $u ? current(array_filter($regs, fn($r) => (int) $r['user_id'] === (int) $u['id'])) : null;
    $admin = ($u['role'] ?? '') === 'admin';
    return [
        'session' => session_out($s),
        'waiting' => array_values(array_map(fn($r) => ['id' => (int) $r['user_id'], 'name' => $r['name']],
            array_filter($regs, fn($r) => $r['status'] === 'waiting'))),
        'my_registration' => $mine ? registration_out($mine) : null,
        'registrations' => $admin ? array_map('registration_out', $regs) : null,
        'photos' => session_photos($id),
        'posts' => session_posts($id),
        'can_add_photos' => $u && can_add_session_photos($s, $u),
        'can_chat' => can_session_chat($s, $u),
        'players' => with_photos(array_map(fn($pid) => ['id' => $pid, 'name' => $names[$pid] ?? 'Player'], $players)),
        'matches' => array_map(fn($m) => match_out($m, $names, $s), $matches),
        'standings' => session_standings($id),
        'registered' => $u ? in_array((int) $u['id'], $players, true) : false,
        'suggested_rounds' => suggested_rounds($s),
        'placements' => placements_out($s),
        'attendance' => attendance_out($s),
    ];
}

function session_save(int $id): array
{
    require_admin();
    $date = str_in('date', 10, true);
    $start = str_in('start_time', 5, true);
    $end = str_in('end_time', 5, true);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        fail(422, 'Date must be YYYY-MM-DD.');
    }
    if (!preg_match('/^\d{2}:\d{2}$/', $start) || !preg_match('/^\d{2}:\d{2}$/', $end)) {
        fail(422, 'Times must be HH:MM.');
    }
    $format = str_in('format', 30, true);
    if (!isset(FORMATS[$format])) {
        fail(422, 'Unknown game format.');
    }
    $points = str_in('point_system', 10) ?: 'americano';
    if (!in_array($points, ['americano', 'tennis'], true)) {
        fail(422, 'Unknown point system.');
    }
    $scoring = $points === 'tennis' ? 'free' : (str_in('scoring', 10) ?: 'total');
    if (!in_array($scoring, ['total', 'race', 'free'], true)) {
        fail(422, 'Unknown scoring type.');
    }
    $data = [
        'title' => str_in('title', 120, true),
        'date' => $date,
        'start_time' => $start,
        'end_time' => $end,
        'location' => str_in('location', 160),
        'description' => str_in('description', 2000),
        'courts' => int_in('courts', 1, 20, 1),
        'max_players' => int_in('max_players', 2, 200, 8),
        'format' => $format,
        'scoring' => $scoring,
        'target' => $scoring === 'free' ? 0 : int_in('target', 1, 99, 16),
        'match_minutes' => int_in('match_minutes', 5, 240, 15),
        'counts_overall' => empty(input()['counts_overall']) ? 0 : 1,
        'point_system' => $points,
        'games' => int_in('games', 1, 9, 4),
        'no_ad' => empty(input()['no_ad']) ? 0 : 1,
        'tb_points' => in_array((int) (input()['tb_points'] ?? 7), [4, 7, 10], true) ? (int) (input()['tb_points'] ?? 7) : 7,
        'fee' => int_in('fee', 0, 100000000, 0),
        'bank_name' => str_in('bank_name', 60),
        'bank_account' => str_in('bank_account', 40),
        'bank_holder' => str_in('bank_holder', 100),
        'activity' => in_array(str_in('activity', 20), ['mini', 'external', 'coaching', 'hitting'], true) ? str_in('activity', 20) : 'mabar',
    ];
    // Coaching: its coaches (members, and names of coaches who aren't members) and drills only or with games.
    $data['coach_ids'] = '';
    $data['coach_names'] = '';
    $data['with_games'] = 1;
    if ($data['activity'] === 'coaching') {
        $ids = array_values(array_unique(array_filter(array_map('intval', (array) (input()['coach_ids'] ?? [])))));
        if ($ids && count(rows('SELECT id FROM users WHERE id IN (' . implode(',', $ids) . ')')) !== count($ids)) {
            fail(422, 'Pick the coaches from the members list.');
        }
        $others = array_values(array_filter(array_map('trim', explode(',', str_in('coach_names', 255)))));
        if (!$ids && !$others) {
            fail(422, 'Add at least one coach for this session.');
        }
        $data['coach_ids'] = implode(',', $ids);
        $data['coach_names'] = implode(', ', $others);
        $data['with_games'] = empty(input()['with_games']) ? 0 : 1;
    }
    // Hitting Session: no games or points, just how the hitting is set up.
    $hit = ['hit_format' => HIT_FORMATS, 'hit_level' => HIT_LEVELS, 'hit_partners' => HIT_PARTNERS, 'hit_balls' => HIT_BALLS];
    foreach ($hit as $k => $opts) {
        $data[$k] = '';
        if ($data['activity'] === 'hitting') {
            $data[$k] = isset($opts[str_in($k, 30)]) ? str_in($k, 30) : array_key_first($opts);
        }
    }
    if ($data['fee'] > 0 && $data['bank_account'] === '') {
        fail(422, 'Add the bank account number so players know where to transfer.');
    }
    if ($id) {
        $old = get_session($id);
        if (is_frozen($old)) {
            // Frozen results: only the details (title, venue, description…) can still change.
            foreach (['format', 'scoring', 'target', 'counts_overall', 'point_system', 'games', 'no_ad', 'tb_points'] as $k) {
                $data[$k] = $old[$k];
            }
        }
        if (in_array($data['activity'], ['coaching', 'external', 'hitting'], true)) {
            $data['counts_overall'] = 0; // coaching never enters competitive totals; external points come from approved results
        }
        update('play_sessions', $id, $data);
        sync_session_ledger($id);
    } else {
        if (in_array($data['activity'], ['coaching', 'external', 'hitting'], true)) {
            $data['counts_overall'] = 0;
        }
        $id = insert('play_sessions', $data + ['status' => 'open', 'rounds' => 0, 'rule_version' => 2, 'created_at' => now()]);
        $from = (int) (input()['copy_banners_from'] ?? 0);
        if ($from && ($src = row('SELECT banner_square, banner_wide FROM play_sessions WHERE id = ?', [$from]))) {
            update('play_sessions', $id, array_filter([
                'banner_square' => copy_banner($src['banner_square'], $id),
                'banner_wide' => copy_banner($src['banner_wide'], $id),
            ]));
        }
        if (!array_key_exists('notify', input()) || !empty(input()['notify'])) {
            notify(
                'New session: ' . $data['title'],
                date('D j M', strtotime($data['date'])) . ' · ' . $data['start_time'] . ' WITA'
                    . ($data['location'] !== '' ? ' · ' . $data['location'] : '') . '. Tap to join.',
                '#/sessions/' . $id
            );
        }
    }
    return session_detail($id);
}

function session_delete(int $id): array
{
    require_admin();
    assert_not_frozen(get_session($id));
    q('DELETE FROM matches WHERE session_id = ?', [$id]);
    foreach (rows('SELECT proof FROM registrations WHERE session_id = ? AND proof IS NOT NULL', [$id]) as $r) {
        delete_proof($r['proof']);
    }
    q('DELETE FROM registrations WHERE session_id = ?', [$id]);
    q('DELETE FROM chat_messages WHERE session_id = ?', [$id]);
    foreach (rows('SELECT file FROM session_photos WHERE session_id = ?', [$id]) as $r) {
        @unlink(SESSION_PHOTO_DIR . '/' . basename($r['file']));
    }
    q('DELETE FROM session_photos WHERE session_id = ?', [$id]);
    q('DELETE FROM session_posts WHERE session_id = ?', [$id]);
    q('DELETE FROM timeline_comments WHERE session_id = ?', [$id]);
    $s = get_session($id);
    delete_banner($s['banner_square']);
    delete_banner($s['banner_wide']);
    q('DELETE FROM play_sessions WHERE id = ?', [$id]);
    sync_session_ledger($id);
    return ['ok' => true];
}

/**
 * Join or leave a session.
 * Free session: joining takes a spot straight away (or the waiting list when it is full).
 * Paid session: joining without a transfer proof puts you on the waiting list; see session_pay().
 */
function session_register(int $id, bool $join): array
{
    $u = require_user();
    $s = get_session($id);
    $uid = (int) $u['id'];
    $in = row('SELECT * FROM registrations WHERE session_id = ? AND user_id = ?', [$id, $uid]);
    if ($join && !$in) {
        if (!accepting_players($s)) {
            fail(409, 'Registration for this session is closed.');
        }
        $full = confirmed_count($id) >= (int) $s['max_players'];
        insert('registrations', [
            'session_id' => $id,
            'user_id' => $uid,
            'status' => (int) $s['fee'] > 0 || $full ? 'waiting' : 'confirmed',
            'created_at' => now(),
        ]);
        activity('join', $u['name'] . ' signed up for ' . $s['title'] . ($full ? ' (waiting list)' : ((int) $s['fee'] > 0 ? ' (payment pending)' : '')), "#/sessions/$id", true);
    } elseif ($join && $in['status'] === 'waiting' && (int) $s['fee'] === 0) {
        // A spot opened up in a free session: move from the waiting list into it.
        if (!accepting_players($s) || confirmed_count($id) >= (int) $s['max_players']) {
            fail(409, 'The session is still full.');
        }
        update('registrations', (int) $in['id'], ['status' => 'confirmed']);
        activity('join', $u['name'] . ' moved from the waiting list into ' . $s['title'], "#/sessions/$id", true);
    } elseif (!$join && $in) {
        if (has_player_matches($id, $uid)) {
            fail(409, 'You are already in the schedule. Ask an admin to remove you.');
        }
        q('DELETE FROM registrations WHERE id = ?', [$in['id']]);
        delete_proof($in['proof']);
        if (!refund_needed($s, $in, $u['name'], 'cancelled')) {
            activity('leave', $u['name'] . ' left ' . $s['title'], "#/sessions/$id", true);
        }
    }
    return session_detail($id);
}

/** Players can join (or pay for) a session while registration is open, and also once it has gone live. */
function accepting_players(array $s): bool
{
    return in_array($s['status'], ['open', 'live'], true);
}

function confirmed_count(int $sid): int
{
    return (int) q("SELECT COUNT(*) FROM registrations WHERE session_id = ? AND status = 'confirmed'", [$sid])->fetchColumn();
}

function registration_out(array $r): array
{
    return [
        'id' => (int) $r['id'],
        'user_id' => (int) $r['user_id'],
        'name' => $r['name'] ?? null,
        'status' => $r['status'],
        'pay_status' => $r['pay_status'],
        'amount' => (int) $r['amount'],
        'method' => $r['method'],
        'has_proof' => (bool) $r['proof'],
        'paid_at' => $r['paid_at'],
        'note' => $r['note'],
        'created_at' => $r['created_at'],
    ];
}

/**
 * Upload a transfer proof (multipart field "proof"). This takes a spot right away;
 * an admin can still reject the proof, which moves the player back to the waiting list.
 */
function session_pay(int $id): array
{
    $u = require_user();
    $s = get_session($id);
    $uid = (int) $u['id'];
    if ((int) $s['fee'] <= 0) {
        fail(409, 'This session has no fee.');
    }
    $reg = row('SELECT * FROM registrations WHERE session_id = ? AND user_id = ?', [$id, $uid]);
    if ($reg && $reg['pay_status'] === 'approved') {
        fail(409, 'Your payment is already confirmed.');
    }
    if (!$reg || $reg['status'] !== 'confirmed') {
        if (!accepting_players($s)) {
            fail(409, 'Registration for this session is closed.');
        }
        if (confirmed_count($id) >= (int) $s['max_players']) {
            fail(409, "Sorry, all paid spots are taken. You can stay on the waiting list.");
        }
    }
    $f = $_FILES['proof'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) {
        fail(422, $f && in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'That image is too big.' : 'Please choose your transfer proof.');
    }
    if ($f['size'] > 10 * 1024 * 1024) {
        fail(422, 'That image is too big (max 10 MB).');
    }
    $file = save_image($f['tmp_name'], PROOF_DIR, $id . '-' . $uid, 1600);
    $data = [
        'status' => 'confirmed',
        'pay_status' => 'submitted',
        'amount' => (int) $s['fee'],
        'method' => 'transfer',
        'proof' => $file,
        'paid_at' => now(),
        'note' => null,
    ];
    if ($reg) {
        update('registrations', (int) $reg['id'], $data);
        delete_proof($reg['proof']);
    } else {
        insert('registrations', $data + ['session_id' => $id, 'user_id' => $uid, 'created_at' => now()]);
    }
    activity('payment', $u['name'] . ' sent a payment proof for ' . $s['title'], "#/sessions/$id", true);
    return session_detail($id);
}

/**
 * Admin payment actions. Body: {user_id, action, note?}
 * approve:   proof checked, payment confirmed
 * reject:    proof not valid; player goes back to the waiting list
 * mark_paid: paid another way (e.g. cash); takes a spot
 * unpaid:    clear the payment and move the player to the waiting list
 */
function session_payment_admin(int $id): array
{
    require_admin();
    $s = get_session($id);
    $uid = int_in('user_id', 1, PHP_INT_MAX);
    $reg = row('SELECT * FROM registrations WHERE session_id = ? AND user_id = ?', [$id, $uid]) ?? fail(404, 'Registration not found.');
    $action = str_in('action', 12, true);
    $note = str_in('note', 255) ?: null;
    $notScheduled = function () use ($id, $uid): void {
        if (has_player_matches($id, $uid)) {
            fail(409, 'That player is already in the schedule. Clear the schedule first.');
        }
    };
    switch ($action) {
        case 'approve':
            if ($reg['pay_status'] !== 'submitted') {
                fail(409, 'There is no proof waiting for review.');
            }
            update('registrations', (int) $reg['id'], ['pay_status' => 'approved', 'note' => $note]);
            break;
        case 'reject':
            if (!in_array($reg['pay_status'], ['submitted', 'approved'], true)) {
                fail(409, 'There is no payment to reject.');
            }
            $notScheduled();
            update('registrations', (int) $reg['id'], [
                'status' => 'waiting', 'pay_status' => 'rejected', 'note' => $note ?? 'Transfer proof was not accepted.',
            ]);
            break;
        case 'mark_paid':
            if ($reg['status'] !== 'confirmed' && confirmed_count($id) >= (int) $s['max_players']) {
                fail(409, 'The session is full. Raise max players first.');
            }
            update('registrations', (int) $reg['id'], [
                'status' => 'confirmed',
                'pay_status' => 'approved',
                'method' => $reg['proof'] ? 'transfer' : 'cash',
                'amount' => (int) $reg['amount'] ?: (int) $s['fee'],
                'paid_at' => $reg['paid_at'] ?: now(),
                'note' => $note,
            ]);
            break;
        case 'free':
            // Free entry: plays without paying; shows in the finance recap but isn't money in.
            if ($reg['status'] !== 'confirmed' && confirmed_count($id) >= (int) $s['max_players']) {
                fail(409, 'The session is full. Raise max players first.');
            }
            update('registrations', (int) $reg['id'], [
                'status' => 'confirmed', 'pay_status' => 'approved', 'method' => 'free', 'amount' => 0,
                'paid_at' => now(), 'note' => $note,
            ]);
            delete_proof($reg['proof']);
            update('registrations', (int) $reg['id'], ['proof' => null]);
            break;
        case 'unpaid':
            $notScheduled();
            update('registrations', (int) $reg['id'], [
                'status' => 'waiting', 'pay_status' => 'none', 'amount' => 0, 'method' => '',
                'proof' => null, 'paid_at' => null, 'note' => $note,
            ]);
            delete_proof($reg['proof']);
            break;
        default:
            fail(422, 'Unknown action.');
    }
    return session_detail($id);
}

/** Sends a transfer proof image to its owner or an admin. Registration id in the route. */
function payment_proof(int $id): never
{
    $u = require_user();
    $reg = row('SELECT user_id, proof FROM registrations WHERE id = ?', [$id]) ?? fail(404, 'Not found.');
    if ((int) $reg['user_id'] !== (int) $u['id'] && $u['role'] !== 'admin') {
        fail(403, 'Not allowed.');
    }
    $path = $reg['proof'] ? PROOF_DIR . '/' . basename($reg['proof']) : '';
    if ($path === '' || !is_file($path)) {
        fail(404, 'No proof uploaded.');
    }
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}

function delete_proof(?string $file): void
{
    if ($file && is_file(PROOF_DIR . '/' . basename($file))) {
        @unlink(PROOF_DIR . '/' . basename($file));
    }
}

/**
 * Finance recap (admin). Query: from, to (session dates, YYYY-MM-DD), session (id).
 * Lists every registration with a payment, totals split into confirmed and still-to-check.
 */
/** Query: cat (all | mabar | mini | external), fmt (all | singles | doubles), gender (all | male | female). Overall RATA points leaderboard. */
function leaderboard(): array
{
    $cat = in_array($_GET['cat'] ?? '', ['mabar', 'mini', 'external'], true) ? $_GET['cat'] : 'all';
    $fmt = in_array($_GET['fmt'] ?? '', ['singles', 'doubles'], true) ? $_GET['fmt'] : 'all';
    $gender = in_array($_GET['gender'] ?? '', ['male', 'female'], true) ? $_GET['gender'] : 'all';
    $rows = with_profile(ledger_standings($cat, $fmt));
    if ($gender !== 'all') {
        // Ranked among that gender only.
        $rows = array_values(array_filter($rows, fn($r) => $r['gender'] === $gender));
        foreach ($rows as $i => &$r) {
            $r['rank'] = $i + 1;
        }
        unset($r);
    }
    return ['cat' => $cat, 'fmt' => $fmt, 'gender' => $gender, 'rows' => $rows];
}

/** Admin marks a match as a placement match (an extra final: no RATA points) or a regular one. Body: {placement: bool} */
function match_placement(int $id): array
{
    require_admin();
    $m = row('SELECT * FROM matches WHERE id = ?', [$id]) ?? fail(404, 'Match not found.');
    $s = get_session((int) $m['session_id']);
    assert_not_frozen($s);
    update('matches', $id, ['placement' => empty(input()['placement']) ? 0 : 1, 'updated_at' => now()]);
    audit('match_placement', 'match', $id, ['placement' => (bool) $m['placement']], ['placement' => !empty(input()['placement'])]);
    sync_session_ledger((int) $s['id']);
    return session_detail((int) $s['id']);
}

/** Admin download of the whole database as JSON. */
function backup_download(): void
{
    require_admin();
    $json = json_encode(['created_at' => now(), 'tables' => db_dump(db())], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="rata-backup-' . date('Ymd-His') . '.json"');
    header('Cache-Control: no-store');
    echo $json;
    exit;
}

function finance(): array
{
    require_admin();
    $where = ["r.pay_status IN ('submitted','approved')"];
    $args = [];
    $from = (string) ($_GET['from'] ?? '');
    $to = (string) ($_GET['to'] ?? '');
    $sid = (int) ($_GET['session'] ?? 0);
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $from)) {
        $where[] = 's.date >= ?';
        $args[] = $from;
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $to)) {
        $where[] = 's.date <= ?';
        $args[] = $to;
    }
    if ($sid) {
        $where[] = 's.id = ?';
        $args[] = $sid;
    }
    $list = rows('SELECT r.id, r.user_id, r.pay_status, r.amount, r.method, r.paid_at, r.proof, u.name,
                         s.id AS session_id, s.title, s.date, s.fee
                  FROM registrations r
                  JOIN play_sessions s ON s.id = r.session_id
                  JOIN users u ON u.id = r.user_id
                  WHERE ' . implode(' AND ', $where) . '
                  ORDER BY s.date DESC, s.start_time DESC, s.id, r.paid_at', $args);
    $sessions = [];
    $total = ['confirmed' => 0, 'pending' => 0, 'payments' => 0, 'free' => 0];
    foreach ($list as $r) {
        $k = (int) $r['session_id'];
        $sessions[$k] ??= ['id' => $k, 'title' => $r['title'], 'date' => $r['date'], 'fee' => (int) $r['fee'], 'paid' => 0, 'confirmed' => 0, 'pending' => 0, 'free' => 0];
        if ($r['method'] === 'free') {
            // Free entries are listed but are not money in.
            $sessions[$k]['free']++;
            $total['free']++;
            continue;
        }
        $bucket = $r['pay_status'] === 'approved' ? 'confirmed' : 'pending';
        $sessions[$k]['paid']++;
        $sessions[$k][$bucket] += (int) $r['amount'];
        $total[$bucket] += (int) $r['amount'];
        $total['payments']++;
    }
    return [
        'sessions' => array_values($sessions),
        'payments' => array_map(fn($r) => [
            'id' => (int) $r['id'],
            'user_id' => (int) $r['user_id'],
            'name' => $r['name'],
            'session_id' => (int) $r['session_id'],
            'title' => $r['title'],
            'date' => $r['date'],
            'pay_status' => $r['pay_status'],
            'amount' => (int) $r['amount'],
            'method' => $r['method'],
            'paid_at' => $r['paid_at'],
            'has_proof' => (bool) $r['proof'],
        ], $list),
        'total' => $total,
        'refunds' => refunds_out(),
        'all_sessions' => array_map(
            fn($x) => ['id' => (int) $x['id'], 'title' => $x['title'], 'date' => $x['date']],
            rows('SELECT id, title, date FROM play_sessions WHERE fee > 0 ORDER BY date DESC LIMIT 300')
        ),
    ];
}

/**
 * A player who paid (or sent a proof) left the session: records a refund the admin owes them and
 * notifies the admins. Returns false when nothing was paid.
 */
function refund_needed(array $s, array $reg, string $name, string $reason): bool
{
    if (!in_array($reg['pay_status'], ['submitted', 'approved'], true) || (int) $reg['amount'] <= 0 || $reg['method'] === 'free') {
        return false;
    }
    insert('refunds', [
        'session_id' => (int) $s['id'], 'user_id' => (int) $reg['user_id'], 'amount' => (int) $reg['amount'],
        'method' => (string) $reg['method'], 'reason' => $reason, 'status' => 'pending', 'created_at' => now(),
    ]);
    activity('refund', ($reason === 'removed' ? "$name was removed from " : "$name cancelled ") . $s['title']
        . ' · refund ' . rupiah_text((int) $reg['amount']) . ($reg['pay_status'] === 'submitted' ? ' (proof not checked yet)' : ''), '#/finance', true);
    return true;
}

function rupiah_text(int $n): string
{
    return 'Rp ' . number_format($n, 0, ',', '.');
}

/** Body: {done: bool}. An admin marks a refund as paid back (or undoes that). */
function refund_mark(int $id): array
{
    $admin = require_admin();
    $r = row('SELECT * FROM refunds WHERE id = ?', [$id]) ?? fail(404, 'Refund not found.');
    $done = !empty(input()['done']);
    update('refunds', $id, $done ? ['status' => 'done', 'done_at' => now(), 'done_by' => (int) $admin['id']] : ['status' => 'pending', 'done_at' => null, 'done_by' => null]);
    audit($done ? 'refund_done' : 'refund_undo', 'refund', $id, ['status' => $r['status']], ['status' => $done ? 'done' : 'pending']);
    return finance();
}

/** Refunds still to pay back, and the last 30 paid back. */
function refunds_out(): array
{
    $list = [...rows("SELECT * FROM refunds WHERE status = 'pending' ORDER BY id"), ...rows("SELECT * FROM refunds WHERE status = 'done' ORDER BY done_at DESC LIMIT 30")];
    $names = names(array_column($list, 'user_id'));
    $titles = array_column(rows('SELECT id, title, date FROM play_sessions WHERE id IN (' . (implode(',', array_map('intval', array_column($list, 'session_id'))) ?: '0') . ')'), null, 'id');
    return array_map(fn($r) => [
        'id' => (int) $r['id'],
        'user_id' => (int) $r['user_id'],
        'name' => $names[(int) $r['user_id']] ?? 'Member',
        'session_id' => (int) $r['session_id'],
        'title' => $titles[$r['session_id']]['title'] ?? 'Deleted session',
        'date' => $titles[$r['session_id']]['date'] ?? '',
        'amount' => (int) $r['amount'],
        'method' => $r['method'],
        'reason' => $r['reason'],
        'status' => $r['status'],
        'created_at' => $r['created_at'],
        'done_at' => $r['done_at'],
    ], $list);
}

function has_player_matches(int $sid, int $uid): bool
{
    return (bool) row('SELECT id FROM matches WHERE session_id = ? AND (a1 = ? OR a2 = ? OR b1 = ? OR b2 = ?)', [$sid, $uid, $uid, $uid, $uid]);
}

/** Admin adds or removes players. Body: {add: [ids], remove: [ids]} */
function session_players_edit(int $id): array
{
    require_admin();
    assert_not_frozen(get_session($id));
    foreach ((array) (input()['add'] ?? []) as $uid) {
        $uid = (int) $uid;
        if (!row('SELECT id FROM users WHERE id = ?', [$uid])) {
            continue;
        }
        $reg = row('SELECT id FROM registrations WHERE session_id = ? AND user_id = ?', [$id, $uid]);
        if ($reg) {
            update('registrations', (int) $reg['id'], ['status' => 'confirmed']);
        } else {
            insert('registrations', ['session_id' => $id, 'user_id' => $uid, 'created_at' => now()]);
        }
    }
    foreach ((array) (input()['remove'] ?? []) as $uid) {
        $uid = (int) $uid;
        if (has_player_matches($id, $uid)) {
            fail(409, 'That player is already in the schedule. Clear the schedule first.');
        }
        $reg = row('SELECT * FROM registrations WHERE session_id = ? AND user_id = ?', [$id, $uid]);
        if ($reg) {
            q('DELETE FROM registrations WHERE id = ?', [$reg['id']]);
            delete_proof($reg['proof']);
            refund_needed(get_session($id), $reg, names([$uid])[$uid] ?? 'A player', 'removed');
        }
    }
    return session_detail($id);
}

/**
 * Body: {mode: "replace" | "next" | "rest" | "clear", rounds?: n}
 * rest:    redo the rounds that haven't started, with the current players (someone arrived late)
 * replace: regenerate the whole schedule (only if nothing has been scored yet)
 * next:    append rounds (mexicano uses current standings)
 */
function session_generate(int $id): array
{
    require_admin();
    $s = get_session($id);
    assert_not_frozen($s);
    if (!session_has_games($s)) {
        fail(409, 'This session has no games to schedule.');
    }
    $mode = str_in('mode', 10) ?: 'replace';
    $players = session_players($id);
    $existing = rows('SELECT * FROM matches WHERE session_id = ? ORDER BY round, court', [$id]);
    $scored = array_filter($existing, fn($m) => $m['status'] !== 'scheduled');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($mode === 'rest') {
            // Late arrivals: redo only the rounds nobody has started, keeping every played or live match.
            $started = [];
            foreach ($existing as $m) {
                if ($m['status'] !== 'scheduled') {
                    $started[(int) $m['round']] = true;
                }
            }
            $redo = [];
            foreach ($existing as $m) {
                if (!isset($started[(int) $m['round']])) {
                    $redo[(int) $m['round']] = true;
                }
            }
            if (!$redo) {
                fail(409, 'Every round has started already. Use "Add a round" instead.');
            }
            q('DELETE FROM matches WHERE session_id = ? AND round IN (' . implode(',', array_keys($redo)) . ')', [$id]);
            $existing = array_values(array_filter($existing, fn($m) => isset($started[(int) $m['round']])));
        }
        if ($mode === 'replace' || $mode === 'clear') {
            if ($scored) {
                fail(409, 'Some matches already have scores. Use "Add round" instead, or reset those scores first.');
            }
            q('DELETE FROM matches WHERE session_id = ?', [$id]);
            $existing = [];
        }
        if ($mode !== 'clear') {
            $default = $s['format'] === 'mexicano' ? 1 : suggested_rounds($s);
            $howMany = $mode === 'rest' ? count($redo) : int_in('rounds', 1, 50, $mode === 'next' ? 1 : $default);
            if ($s['format'] === 'mexicano') {
                $howMany = 1; // each mexicano round depends on the previous results
            }
            $ranking = array_column(session_standings($id, false), 'id');
            $rounds = split_gender($s['format'])
                ? generate_split_rounds($s, gender_groups($players), $existing, $howMany)
                : generate_rounds($s, $players, $existing, $howMany, $ranking);
            foreach ($rounds as $r => $matches) {
                foreach ($matches as $i => [$ta, $tb]) {
                    insert('matches', [
                        'session_id' => $id,
                        'round' => $r,
                        'court' => $i + 1,
                        'start_time' => round_start($s, $r),
                        'a1' => $ta[0],
                        'a2' => $ta[1] ?? null,
                        'b1' => $tb[0],
                        'b2' => $tb[1] ?? null,
                        'score_a' => 0,
                        'score_b' => 0,
                        'status' => 'scheduled',
                        'updated_at' => now(),
                    ]);
                }
            }
        }
        $total = (int) q('SELECT COALESCE(MAX(round), 0) FROM matches WHERE session_id = ?', [$id])->fetchColumn();
        update('play_sessions', $id, ['rounds' => $total]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    if ($mode !== 'clear' && !empty(input()['notify'])) {
        notify(
            ($mode === 'next' ? "Round $total is ready: " : ($mode === 'rest' ? 'Schedule updated: ' : 'Schedule is out: ')) . $s['title'],
            'See your court and start time.',
            '#/sessions/' . $id,
            $players
        );
    }
    return session_detail($id);
}

/** Players split into [male => ids, female => ids] for a men vs men, women vs women session. */
function gender_groups(array $players): array
{
    $groups = ['male' => [], 'female' => []];
    $missing = [];
    $names = names($players);
    foreach ($players ? rows('SELECT id, gender FROM users WHERE id IN (' . implode(',', array_map('intval', $players)) . ')') : [] as $u) {
        if (isset($groups[$u['gender']])) {
            $groups[$u['gender']][] = (int) $u['id'];
        } else {
            $missing[] = $names[(int) $u['id']] ?? 'Player';
        }
    }
    if ($missing) {
        fail(422, 'Set the gender of these players first (Members, edit): ' . implode(', ', $missing) . '.');
    }
    foreach (['male' => 'men', 'female' => 'women'] as $g => $label) {
        if (count($groups[$g]) === 1) {
            fail(422, "Only one of the players is in the $label group, so they have nobody to play. Add another or remove them.");
        }
        if (!$groups[$g]) {
            unset($groups[$g]);
        }
    }
    if (!$groups) {
        fail(422, 'Need at least 2 players to generate matches.');
    }
    return $groups;
}

function session_set_status(int $id): array
{
    require_admin();
    $status = str_in('status', 20, true);
    if (!in_array($status, ['open', 'closed', 'live', 'completed'], true)) {
        fail(422, 'Unknown status.');
    }
    $was = get_session($id);
    assert_not_frozen($was);
    update('play_sessions', $id, ['status' => $status]);
    if ($was['status'] !== $status) {
        audit('session_status', 'session', $id, ['status' => $was['status']], ['status' => $status]);
    }
    if ($status === 'completed') {
        // Matches that were being played count as finished.
        q("UPDATE matches SET status = 'done' WHERE session_id = ? AND status = 'live'", [$id]);
        if ($was['status'] !== 'completed') {
            // The session now shows on each player's timeline; invite them to leave a review.
            notify('How was ' . $was['title'] . '?', 'Thanks for playing! Share a review and your photos from the session.', '#/sessions/' . $id . '?review', session_players($id));
        }
    }
    sync_session_ledger($id);
    if ($status === 'completed') {
        auto_placements($id);
    }
    return session_detail($id);
}

// ---- live scoring ----

/** Body: {score_a, score_b, status?}. Admins and the players in the match can score. */
function match_score(int $id): array
{
    $u = require_user();
    $m = row('SELECT * FROM matches WHERE id = ?', [$id]) ?? fail(404, 'Match not found.');
    $s = get_session((int) $m['session_id']);
    $uid = (int) $u['id'];
    $inMatch = in_array($uid, array_map('intval', [$m['a1'], $m['a2'], $m['b1'], $m['b2']]), true);
    if (!can_score_match($m)) {
        fail(403, 'Only admins and the players in this match can score it.');
    }
    if ($s['status'] === 'completed' && $u['role'] !== 'admin') {
        fail(409, 'This session is finished.');
    }
    assert_not_frozen($s);
    claim_lock($m);
    $a = int_in('score_a', 0, 999, (int) $m['score_a']);
    $b = int_in('score_b', 0, 999, (int) $m['score_b']);
    $status = str_in('status', 20) ?: null;
    // Changing a finished match, or wiping a scored one, is a correction: reason required, kept in the audit log.
    $wasScored = (int) $m['score_a'] + (int) $m['score_b'] > 0 || $m['status'] === 'done';
    $correction = ($m['status'] === 'done' && ($a !== (int) $m['score_a'] || $b !== (int) $m['score_b'] || ($status !== null && $status !== 'done')))
        || ($status === 'scheduled' && $wasScored);
    $reason = reason_in($correction);
    if ($m['status'] === 'done' && $status === null && ($a > (int) $m['score_a'] || $b > (int) $m['score_b'])) {
        fail(409, 'This match is finished. Reopen it to change the score.');
    }
    if ($status !== null && !in_array($status, ['scheduled', 'live', 'done'], true)) {
        fail(422, 'Unknown match status.');
    }
    $tennis = $s['point_system'] === 'tennis';
    if ($status === null) {
        $status = !$tennis && score_finished($s, $a, $b) ? 'done' : (($a + $b) > 0 ? 'live' : $m['status']);
        if ($status === 'scheduled' && $m['status'] === 'live') {
            $status = 'live';
        }
    }
    if (!$tennis && $s['scoring'] === 'total' && (int) $s['target'] > 0 && $a + $b > (int) $s['target']) {
        fail(422, "Total points can't go over {$s['target']}.");
    }
    // A score typed in directly replaces the point-by-point log.
    $changed = $a !== (int) $m['score_a'] || $b !== (int) $m['score_b'];
    update('matches', $id, ['score_a' => $a, 'score_b' => $b, 'status' => $status, 'updated_at' => now()]
        + ($changed || $status === 'scheduled' ? ['log' => null] : [])
        + ($status === 'scheduled' ? ['started_at' => null, 'paused_at' => null, 'paused_secs' => 0] : []));
    if ($status !== 'scheduled' && $s['status'] !== 'live' && $s['status'] !== 'completed') {
        update('play_sessions', (int) $s['id'], ['status' => 'live']);
    }
    sync_session_ledger((int) $s['id']);
    if ($correction || $status !== $m['status'] && in_array($status, ['done', 'scheduled'], true)) {
        audit($correction ? 'match_correction' : 'match_' . $status, 'match', $id,
            ['score' => [(int) $m['score_a'], (int) $m['score_b']], 'status' => $m['status']], ['score' => [$a, $b], 'status' => $status], $reason);
    }
    if ($correction || $status === 'done' && $m['status'] !== 'done') {
        match_activity($s, $m, $a, $b, $correction);
    }
    return session_detail((int) $s['id']);
}

/** Activity feed line for a result entered (or corrected) on a match. */
function match_activity(array $s, array $m, int $a, int $b, bool $correction): void
{
    $n = names([$m['a1'], $m['a2'], $m['b1'], $m['b2']]);
    $side = fn($x, $y) => implode(' & ', array_filter([$n[(int) $x] ?? null, $n[(int) $y] ?? null]));
    activity('result', current_user()['name'] . ($correction ? ' corrected a result in ' : ' entered a result in ') . $s['title'] . ': '
        . $side($m['a1'], $m['a2']) . " {$a}–{$b} " . $side($m['b1'], $m['b2']), '#/sessions/' . $s['id']);
}

/** Everything live right now: matches being played and next up, in sessions marked live. */
function live(): array
{
    $sessions = rows("SELECT * FROM play_sessions WHERE status = 'live' ORDER BY date, start_time");
    $out = [];
    $all = [];
    foreach ($sessions as $s) {
        $ms = rows("SELECT * FROM matches WHERE session_id = ? ORDER BY round, court", [$s['id']]);
        $ids = [];
        foreach ($ms as $m) {
            array_push($ids, $m['a1'], $m['a2'], $m['b1'], $m['b2']);
        }
        $names = names($ids);
        $current = array_values(array_filter($ms, fn($m) => $m['status'] === 'live'));
        $next = array_values(array_filter($ms, fn($m) => $m['status'] === 'scheduled'));
        $recent = array_values(array_filter($ms, fn($m) => $m['status'] === 'done'));
        usort($recent, fn($x, $y) => strcmp($y['updated_at'], $x['updated_at']));
        $out[] = [
            'session' => session_out($s),
            'live' => array_map(fn($m) => match_out($m, $names, $s), $current),
            'next' => array_map(fn($m) => match_out($m, $names, $s), array_slice($next, 0, max(2, (int) $s['courts']))),
            'recent' => array_map(fn($m) => match_out($m, $names, $s), array_slice($recent, 0, 4)),
            'standings' => session_standings((int) $s['id']),
        ];
        foreach ($current as $m) {
            $all[] = match_out($m, $names, $s) + ['format_label' => FORMATS[$s['format']]['label'] ?? '', 'target' => (int) $s['target'], 'scoring' => $s['scoring']];
        }
    }
    return ['sessions' => $out, 'matches' => $all, 'at' => now()];
}

// ---- members ----

function members_list(): array
{
    $board = [];
    foreach (overall_standings() as $r) {
        $board[$r['id']] = $r;
    }
    $admin = (current_user()['role'] ?? '') === 'admin';
    $members = [];
    foreach (rows('SELECT ' . USER_COLS . ' FROM users ORDER BY name') as $u) {
        $r = $board[(int) $u['id']] ?? null;
        $m = [
            'id' => (int) $u['id'],
            'name' => $u['name'],
            'photo' => $u['photo'],
            'role' => $u['role'],
            'level' => $u['level'],
            'gender' => $u['gender'],
            'instagram' => $u['instagram'],
            'joined' => substr($u['created_at'], 0, 10),
            'points' => $r['points'] ?? 0,
            'sessions' => $r['sessions'] ?? 0,
            'rank' => $r && $r['points'] > 0 ? $r['rank'] : null,
        ];
        if ($admin) {
            $m['email'] = $u['email'];
            $m['phone'] = $u['phone'];
        }
        $members[] = $m;
    }
    return ['members' => $members];
}

function member_detail(int $id): array
{
    $u = row('SELECT ' . USER_COLS . ' FROM users WHERE id = ?', [$id]) ?? fail(404, 'Member not found.');
    $me = current_user();
    if (!$me || ((int) $me['id'] !== $id && $me['role'] !== 'admin')) {
        unset($u['email'], $u['phone']);
    } else {
        $u['photo_orig'] = row('SELECT photo_orig FROM users WHERE id = ?', [$id])['photo_orig'];
    }
    $overall = null;
    foreach (overall_standings() as $r) {
        if ($r['id'] === $id) {
            $overall = $r;
        }
    }
    $history = [];
    $ss = rows("SELECT s.* FROM play_sessions s JOIN registrations r ON r.session_id = s.id
                WHERE r.user_id = ? AND r.status = 'confirmed' ORDER BY s.date DESC, s.start_time DESC", [$id]);
    foreach ($ss as $s) {
        $st = session_standings((int) $s['id'], $s['status'] !== 'completed');
        $mine = current(array_filter($st, fn($r) => $r['id'] === $id)) ?: null;
        $history[] = [
            'session' => session_out($s),
            'points' => $mine['points'] ?? 0,
            'played' => $mine['played'] ?? 0,
            'wins' => $mine['wins'] ?? 0,
            'rank' => $mine['rank'] ?? null,
            'of' => count($st),
        ];
    }
    return [
        'member' => $u,
        'overall' => [
            'points' => $overall['points'] ?? 0,
            'sessions' => $overall['sessions'] ?? 0,
            'wins' => $overall['wins'] ?? 0,
            'played' => $overall['played'] ?? 0,
            'rank' => ($overall['points'] ?? 0) > 0 ? $overall['rank'] : null,
        ],
        'history' => $history,
        'timeline' => member_timeline($id, $ss),
        'external' => member_external($id),
        'coaching' => member_coaching($id),
        'bcs' => member_points($id),
    ];
}

/** Admin creates a member (email and password optional, e.g. for walk-in players). */
function member_create(): array
{
    require_admin();
    $email = strtolower(str_in('email', 190));
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail(422, 'Please enter a valid email.');
    }
    if ($email !== '' && row('SELECT id FROM users WHERE email = ?', [$email])) {
        fail(409, 'A member with this email already exists.');
    }
    $pw = (string) (input()['password'] ?? '');
    if ($pw !== '' && strlen($pw) < 8) {
        fail(422, 'Password must be at least 8 characters.');
    }
    $id = insert('users', [
        'name' => str_in('name', 100, true),
        'email' => $email ?: null,
        'password_hash' => $pw !== '' ? password_hash($pw, PASSWORD_DEFAULT) : null,
        'role' => 'member',
        'created_at' => now(),
    ] + profile_in());
    activity('member_add', current_user()['name'] . ' added a member: ' . str_in('name', 100), "#/members/$id");
    return member_detail($id);
}

/** Admin edits a member: name, email, phone, role, new password, or delete. */
function member_edit(int $id): array
{
    $admin = require_admin();
    $u = row('SELECT * FROM users WHERE id = ?', [$id]) ?? fail(404, 'Member not found.');
    $in = input();
    if (!empty($in['delete'])) {
        if ($id === (int) $admin['id']) {
            fail(409, "You can't delete your own account.");
        }
        $hasMatches = row('SELECT id FROM matches WHERE a1 = ? OR a2 = ? OR b1 = ? OR b2 = ?', [$id, $id, $id, $id]);
        if ($hasMatches) {
            fail(409, 'This member has played matches, so deleting would change past results.');
        }
        q('DELETE FROM registrations WHERE user_id = ?', [$id]);
        q('DELETE FROM chat_messages WHERE user_id = ?', [$id]);
        q('DELETE FROM users WHERE id = ?', [$id]);
        return ['deleted' => true];
    }
    $data = profile_in();
    if (isset($in['name'])) {
        $data['name'] = str_in('name', 100, true);
    }
    if (isset($in['email'])) {
        $email = strtolower(str_in('email', 190));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail(422, 'Please enter a valid email.');
        }
        if ($email !== '' && row('SELECT id FROM users WHERE email = ? AND id <> ?', [$email, $id])) {
            fail(409, 'Another member already uses this email.');
        }
        $data['email'] = $email ?: null;
    }
    if (isset($in['role'])) {
        $role = str_in('role', 20);
        if (!in_array($role, ['member', 'scorekeeper', 'coach', 'admin'], true)) {
            fail(422, 'Unknown role.');
        }
        if ($id === (int) $admin['id'] && $role !== 'admin') {
            fail(409, "You can't remove your own admin role.");
        }
        $data['role'] = $role;
        $was = row('SELECT role FROM users WHERE id = ?', [$id]);
        if ($was && $was['role'] !== $role) {
            audit('role_change', 'user', $id, ['role' => $was['role']], ['role' => $role]);
        }
    }
    if (!empty($in['password'])) {
        if (strlen((string) $in['password']) < 8) {
            fail(422, 'Password must be at least 8 characters.');
        }
        $data['password_hash'] = password_hash((string) $in['password'], PASSWORD_DEFAULT);
    }
    update('users', $id, $data);
    return member_detail($id);
}

// ---- photos ----

/** Upload (multipart field "photo") or remove ({remove: true}) a member photo. Own photo, or any as admin. */
/**
 * Set, re-crop or remove a member photo. Multipart fields:
 *   photo     the cropped square (required unless removing)
 *   original  the uncropped picture, kept so the member can re-crop later
 *   keep_original=1  re-crop: keep the stored original instead of sending it again
 * JSON {remove: true} clears both.
 */
function member_photo(int $id): array
{
    $me = require_user();
    if ((int) $me['id'] !== $id && $me['role'] !== 'admin') {
        fail(403, 'You can only change your own photo.');
    }
    $u = row('SELECT id, photo, photo_orig FROM users WHERE id = ?', [$id]) ?? fail(404, 'Member not found.');

    $new = null;
    $orig = null;
    if (empty(input()['remove'])) {
        $new = save_photo(upload_file('photo'), $id);
        if (!empty($_FILES['original']) && $_FILES['original']['error'] !== UPLOAD_ERR_NO_FILE) {
            $orig = PHOTO_URL . '/' . save_image(upload_file('original'), PHOTO_DIR, $id . '-o', 1600);
        } elseif (!empty($_POST['keep_original'])) {
            $orig = $u['photo_orig'];
        }
    }
    update('users', $id, ['photo' => $new, 'photo_orig' => $orig]);
    foreach ([$u['photo'], $u['photo_orig'] !== $orig ? $u['photo_orig'] : null] as $old) {
        if ($old && is_file(PHOTO_DIR . '/' . basename($old))) {
            @unlink(PHOTO_DIR . '/' . basename($old));
        }
    }
    return member_detail($id);
}

/** Checks a multipart image field and returns its temp path. */
function upload_file(string $field): string
{
    $f = $_FILES[$field] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) {
        fail(422, $f && in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'That photo is too big.' : 'Please choose a photo.');
    }
    if ($f['size'] > 10 * 1024 * 1024) {
        fail(422, 'That photo is too big (max 10 MB).');
    }
    return $f['tmp_name'];
}

/** Re-encodes an uploaded image as a JPEG (max 900px) so only clean image data is stored. */
function save_photo(string $tmp, int $id): string
{
    return PHOTO_URL . '/' . save_image($tmp, PHOTO_DIR, (string) $id, 900);
}

/** Re-encodes an image as a JPEG no larger than $max px into $dir and returns the new file name. */
function save_image(string $tmp, string $dir, string $prefix, int $max): string
{
    $info = @getimagesize($tmp);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP, IMAGETYPE_GIF], true)) {
        fail(422, 'Please upload a JPG, PNG or WebP image.');
    }
    if (!function_exists('imagecreatefromstring')) {
        fail(500, 'Image processing is not available on the server.');
    }
    $src = @imagecreatefromstring((string) file_get_contents($tmp));
    if (!$src) {
        fail(422, "Couldn't read that image.");
    }
    [$w, $h] = [imagesx($src), imagesy($src)];
    $scale = min(1, $max / max($w, $h));
    $nw = max(1, (int) round($w * $scale));
    $nh = max(1, (int) round($h * $scale));
    $dst = imagecreatetruecolor($nw, $nh);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        fail(500, 'Could not create the upload folder on the server.');
    }
    $name = $prefix . '-' . bin2hex(random_bytes(6)) . '.jpg';
    if (!imagejpeg($dst, $dir . '/' . $name, 85)) {
        fail(500, 'Could not save the image.');
    }
    return $name;
}

// ---- session photos ----

/** Players in the session (and admins) can share photos once it has started. */
function can_add_session_photos(array $s, array $u): bool
{
    if ($u['role'] === 'admin') {
        return true;
    }
    return in_array($s['status'], ['live', 'completed'], true)
        && (bool) row("SELECT id FROM registrations WHERE session_id = ? AND user_id = ? AND status = 'confirmed'", [$s['id'], $u['id']]);
}

function session_photos(int $sid): array
{
    $list = rows('SELECT p.id, p.user_id, p.post_id, p.file, p.created_at, u.name FROM session_photos p
                  LEFT JOIN users u ON u.id = p.user_id WHERE p.session_id = ? ORDER BY p.id DESC', [$sid]);
    $me = current_user();
    return array_map(fn($p) => [
        'id' => (int) $p['id'],
        'url' => SESSION_PHOTO_URL . '/' . $p['file'],
        'by' => $p['name'] ?? 'Member',
        'by_id' => (int) $p['user_id'],
        'post_id' => $p['post_id'] !== null ? (int) $p['post_id'] : null,
        'can_delete' => $me && ($me['role'] === 'admin' || (int) $me['id'] === (int) $p['user_id']),
    ], $list);
}

/** Upload one photo (multipart field "photo") to a session's gallery. */
function session_photo_add(int $id): array
{
    $u = require_user();
    $s = get_session($id);
    if (!can_add_session_photos($s, $u)) {
        fail(403, 'Only players in this session can add photos, once it has started.');
    }
    if ((int) q('SELECT COUNT(*) FROM session_photos WHERE session_id = ?', [$id])->fetchColumn() >= 200) {
        fail(409, 'This session already has 200 photos.');
    }
    $f = $_FILES['photo'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) {
        fail(422, $f && in_array($f['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) ? 'That photo is too big.' : 'Please choose a photo.');
    }
    if ($f['size'] > 10 * 1024 * 1024) {
        fail(422, 'That photo is too big (max 10 MB).');
    }
    $post = (int) ($_POST['post_id'] ?? 0);
    if ($post && !row('SELECT id FROM session_posts WHERE id = ? AND session_id = ? AND user_id = ?', [$post, $id, $u['id']])) {
        fail(404, 'Review not found.');
    }
    $file = save_image($f['tmp_name'], SESSION_PHOTO_DIR, (string) $id, 1600);
    insert('session_photos', ['session_id' => $id, 'user_id' => (int) $u['id'], 'post_id' => $post ?: null, 'file' => $file, 'created_at' => now()]);
    return session_detail($id);
}

/** Body: {photo_id}. The uploader or an admin can remove a photo. */
function session_photo_delete(int $id): array
{
    $u = require_user();
    $p = row('SELECT * FROM session_photos WHERE id = ? AND session_id = ?', [int_in('photo_id', 1, PHP_INT_MAX), $id]) ?? fail(404, 'Photo not found.');
    if ((int) $p['user_id'] !== (int) $u['id'] && $u['role'] !== 'admin') {
        fail(403, 'You can only remove your own photos.');
    }
    q('DELETE FROM session_photos WHERE id = ?', [$p['id']]);
    @unlink(SESSION_PHOTO_DIR . '/' . basename($p['file']));
    return session_detail($id);
}

// ---- session banners ----

/**
 * Admin sets or removes a session banner. Multipart: banner (image), kind (square | wide).
 * JSON {kind, remove: true} removes it.
 */
function session_banner(int $id): array
{
    require_admin();
    $s = get_session($id);
    $kind = (string) ($_POST['kind'] ?? input()['kind'] ?? '');
    if (!isset(BANNER_SIZES[$kind])) {
        fail(422, 'Unknown banner type.');
    }
    $new = null;
    if (empty(input()['remove'])) {
        $new = BANNER_URL . '/' . save_image(upload_file('banner'), BANNER_DIR, $id . '-' . $kind, BANNER_SIZES[$kind]);
    }
    update('play_sessions', $id, ['banner_' . $kind => $new]);
    delete_banner($s['banner_' . $kind]);
    return session_detail($id);
}

function delete_banner(?string $url): void
{
    if ($url && is_file(BANNER_DIR . '/' . basename($url))) {
        @unlink(BANNER_DIR . '/' . basename($url));
    }
}

/** Copies a banner file for a duplicated session, so deleting one session keeps the other's banner. */
function copy_banner(?string $url, int $id): ?string
{
    $src = $url ? BANNER_DIR . '/' . basename($url) : '';
    if (!$src || !is_file($src)) {
        return null;
    }
    $name = $id . '-' . preg_replace('/^\d+-/', '', pathinfo($src, PATHINFO_FILENAME)) . '.jpg';
    return @copy($src, BANNER_DIR . '/' . $name) ? BANNER_URL . '/' . $name : null;
}

// ---- reviews (posts on a session, shown on the session page and on each player's timeline) ----

/** Reviews for one or more sessions, newest first, with their photos. */
function session_posts(int ...$sids): array
{
    if (!$sids) {
        return [];
    }
    $in = implode(',', array_fill(0, count($sids), '?'));
    $posts = rows("SELECT p.*, u.name FROM session_posts p LEFT JOIN users u ON u.id = p.user_id
                   WHERE p.session_id IN ($in) ORDER BY p.id DESC", $sids);
    if (!$posts) {
        return [];
    }
    $pin = implode(',', array_fill(0, count($posts), '?'));
    $photos = [];
    foreach (rows("SELECT id, post_id, file FROM session_photos WHERE post_id IN ($pin) ORDER BY id", array_column($posts, 'id')) as $ph) {
        $photos[(int) $ph['post_id']][] = ['id' => (int) $ph['id'], 'url' => SESSION_PHOTO_URL . '/' . $ph['file']];
    }
    $me = current_user();
    $av = photos(array_column($posts, 'user_id'));
    return array_map(fn($p) => [
        'id' => (int) $p['id'],
        'session_id' => (int) $p['session_id'],
        'user' => ['id' => (int) $p['user_id'], 'name' => $p['name'] ?? 'Member', 'photo' => $av[(int) $p['user_id']] ?? null],
        'body' => (string) $p['body'],
        'created_at' => $p['created_at'],
        'photos' => $photos[(int) $p['id']] ?? [],
        'can_delete' => $me && ($me['role'] === 'admin' || (int) $me['id'] === (int) $p['user_id']),
    ], $posts);
}

/** Body: {body}. A player (or admin) writes a review; photos are then added with sessions/:id/photos and post_id. */
function session_post_add(int $id): array
{
    $u = require_user();
    $s = get_session($id);
    if (!can_add_session_photos($s, $u)) {
        fail(403, 'Only players in this session can post, once it has started.');
    }
    $body = str_in('body', 2000);
    $hasPhotos = !empty(input()['with_photos']);
    if ($body === '' && !$hasPhotos) {
        fail(422, 'Write something or add a photo.');
    }
    $postId = insert('session_posts', ['session_id' => $id, 'user_id' => (int) $u['id'], 'body' => $body, 'created_at' => now()]);
    activity('review', $u['name'] . ' posted a review on ' . $s['title'] . ($body !== '' ? ': ' . $body : ''), "#/sessions/$id");
    return session_detail($id) + ['post_id' => $postId];
}

/** Body: {post_id}. The writer or an admin removes a review and its photos. */
function session_post_delete(int $id): array
{
    $u = require_user();
    $p = row('SELECT * FROM session_posts WHERE id = ? AND session_id = ?', [int_in('post_id', 1, PHP_INT_MAX), $id]) ?? fail(404, 'Review not found.');
    if ((int) $p['user_id'] !== (int) $u['id'] && $u['role'] !== 'admin') {
        fail(403, 'You can only remove your own reviews.');
    }
    foreach (rows('SELECT file FROM session_photos WHERE post_id = ?', [$p['id']]) as $ph) {
        @unlink(SESSION_PHOTO_DIR . '/' . basename($ph['file']));
    }
    q('DELETE FROM session_photos WHERE post_id = ?', [$p['id']]);
    q('DELETE FROM session_posts WHERE id = ?', [$p['id']]);
    return session_detail($id);
}

/**
 * A member's timeline: every finished session they played, who played with them, their own reviews,
 * and the photos posted to the session.
 */
function member_timeline(int $id, array $sessions): array
{
    $done = array_values(array_filter($sessions, fn($s) => $s['status'] === 'completed'));
    if (!$done) {
        return [];
    }
    $sids = array_map(fn($s) => (int) $s['id'], $done);
    $in = implode(',', array_fill(0, count($sids), '?'));
    $players = [];
    foreach (rows("SELECT r.session_id, r.user_id, u.name FROM registrations r JOIN users u ON u.id = r.user_id
                   WHERE r.status = 'confirmed' AND r.session_id IN ($in) ORDER BY r.created_at, r.id", $sids) as $r) {
        $players[(int) $r['session_id']][] = ['id' => (int) $r['user_id'], 'name' => $r['name']];
    }
    $gallery = [];
    foreach (rows("SELECT id, session_id, file FROM session_photos WHERE post_id IS NULL AND session_id IN ($in) ORDER BY id DESC", $sids) as $ph) {
        $gallery[(int) $ph['session_id']][] = ['id' => (int) $ph['id'], 'url' => SESSION_PHOTO_URL . '/' . $ph['file']];
    }
    $mine = [];
    foreach (session_posts(...$sids) as $p) {
        if ($p['user']['id'] === $id) {
            $mine[$p['session_id']][] = $p;
        }
    }
    $comments = timeline_comments($sids);
    return array_map(function ($s) use ($id, $players, $gallery, $mine, $comments) {
        $sid = (int) $s['id'];
        $others = array_values(array_filter($players[$sid] ?? [], fn($p) => $p['id'] !== $id));
        return [
            'session' => ['id' => $sid, 'title' => $s['title'], 'date' => $s['date'], 'location' => $s['location'], 'banner' => $s['banner_square'] ?: $s['banner_wide']],
            'with' => array_slice($others, 0, 1),
            'with_count' => count($others),
            'posts' => $mine[$sid] ?? [],
            'photos' => $gallery[$sid] ?? [],
            'comments' => $comments[$sid] ?? [],
        ];
    }, $done);
}

// ---- comments on timeline entries (one thread per session) ----

/**
 * The comment thread for each of these sessions, oldest first, by session id. A session has one thread,
 * shown under that session on the timeline of every member who played it, so a comment also shows on
 * the writer's own timeline. owner_id keeps the profile it was written on (that member may delete it).
 */
function timeline_comments(array $sids): array
{
    if (!$sids) {
        return [];
    }
    $in = implode(',', array_fill(0, count($sids), '?'));
    $list = rows("SELECT c.*, u.name FROM timeline_comments c LEFT JOIN users u ON u.id = c.user_id
                  WHERE c.session_id IN ($in) ORDER BY c.id", $sids);
    $me = current_user();
    $av = photos(array_column($list, 'user_id'));
    $out = [];
    foreach ($list as $c) {
        $out[(int) $c['session_id']][] = [
            'id' => (int) $c['id'],
            'user' => ['id' => (int) $c['user_id'], 'name' => $c['name'] ?? 'Member', 'photo' => $av[(int) $c['user_id']] ?? null],
            'body' => $c['body'],
            'created_at' => $c['created_at'],
            'can_delete' => $me && ($me['role'] === 'admin' || in_array((int) $me['id'], [(int) $c['user_id'], (int) $c['owner_id']], true)),
        ];
    }
    return $out;
}

/** Body: {session_id, body}. Any member comments on a finished session, from the timeline of a member who played it. */
function timeline_comment_add(int $owner): array
{
    $u = require_user();
    $sid = int_in('session_id', 1, PHP_INT_MAX);
    $body = str_in('body', 1000, true);
    if (!row("SELECT r.id FROM registrations r JOIN play_sessions s ON s.id = r.session_id
              WHERE r.session_id = ? AND r.user_id = ? AND r.status = 'confirmed' AND s.status = 'completed'", [$sid, $owner])) {
        fail(404, 'That timeline entry was not found.');
    }
    // Tell the profile owner and everyone already in the thread, except the writer.
    $to = array_map('intval', array_column(rows('SELECT DISTINCT user_id FROM timeline_comments WHERE session_id = ?', [$sid]), 'user_id'));
    $to = array_values(array_diff(array_unique([$owner, ...$to]), [(int) $u['id']]));
    insert('timeline_comments', ['session_id' => $sid, 'owner_id' => $owner, 'user_id' => (int) $u['id'], 'body' => $body, 'created_at' => now()]);
    $title = (string) row('SELECT title FROM play_sessions WHERE id = ?', [$sid])['title'];
    notify($u['name'] . ' commented on ' . $title, mb_substr($body, 0, 120), '#/me', $to);
    activity('comment', $u['name'] . ' commented on ' . $title . ': ' . $body, '#/members/' . $u['id']);
    return ['comments' => timeline_comments([$sid])[$sid] ?? []];
}

/** Body: {comment_id}. The writer, the member whose profile it was written on, or an admin removes a comment. */
function timeline_comment_delete(int $owner): array
{
    $u = require_user();
    $c = row('SELECT * FROM timeline_comments WHERE id = ?', [int_in('comment_id', 1, PHP_INT_MAX)]) ?? fail(404, 'Comment not found.');
    if ($u['role'] !== 'admin' && !in_array((int) $u['id'], [(int) $c['user_id'], (int) $c['owner_id']], true)) {
        fail(403, 'You can only remove your own comments.');
    }
    q('DELETE FROM timeline_comments WHERE id = ?', [$c['id']]);
    return ['comments' => timeline_comments([(int) $c['session_id']])[(int) $c['session_id']] ?? []];
}

/** Adds level and gender to leaderboard rows. */
function with_profile(array $rows): array
{
    $ids = array_map('intval', array_column($rows, 'id'));
    if (!$ids) {
        return $rows;
    }
    $p = [];
    foreach (rows('SELECT id, level, gender FROM users WHERE id IN (' . implode(',', $ids) . ')') as $u) {
        $p[(int) $u['id']] = $u;
    }
    foreach ($rows as &$r) {
        $r['level'] = $p[$r['id']]['level'] ?? '';
        $r['gender'] = $p[$r['id']]['gender'] ?? '';
    }
    return $rows;
}

// ---- blog (news, press releases) ----

function blog_out(array $p, bool $full = false): array
{
    $out = [
        'id' => (int) $p['id'],
        'title' => $p['title'],
        'summary' => $p['summary'],
        'cover' => $p['cover'],
        'status' => $p['status'],
        'published_at' => $p['published_at'],
        'author' => ['id' => (int) $p['author_id'], 'name' => $p['author_name'] ?? 'RATA'],
        'updated_at' => $p['updated_at'],
    ];
    if ($full) {
        $out['body'] = (string) $p['body'];
    }
    return $out;
}

/** Published posts, newest first. Admins also see drafts. */
function blog_list(): array
{
    $admin = (current_user()['role'] ?? '') === 'admin';
    $posts = rows("SELECT b.*, u.name AS author_name FROM blog_posts b LEFT JOIN users u ON u.id = b.author_id
                   WHERE b.status = 'published'" . ($admin ? " OR b.status = 'draft'" : '') . '
                   ORDER BY COALESCE(b.published_at, b.created_at) DESC, b.id DESC');
    return ['posts' => array_map('blog_out', $posts)];
}

function blog_detail(int $id): array
{
    $p = row('SELECT b.*, u.name AS author_name FROM blog_posts b LEFT JOIN users u ON u.id = b.author_id WHERE b.id = ?', [$id]);
    if (!$p || ($p['status'] !== 'published' && (current_user()['role'] ?? '') !== 'admin')) {
        fail(404, 'Post not found.');
    }
    return ['post' => blog_out($p, true)];
}

/** Body: {title, summary, body, cover, status: draft|published} or {delete: true}. Admin only. */
function blog_save(int $id): array
{
    $admin = require_admin();
    $old = $id ? (row('SELECT * FROM blog_posts WHERE id = ?', [$id]) ?? fail(404, 'Post not found.')) : null;
    if ($old && !empty(input()['delete'])) {
        foreach (blog_images($old) as $f) {
            @unlink(BLOG_DIR . '/' . $f);
        }
        q('DELETE FROM blog_posts WHERE id = ?', [$id]);
        return ['deleted' => true];
    }
    $status = str_in('status', 12) ?: 'draft';
    if (!in_array($status, ['draft', 'published'], true)) {
        fail(422, 'Unknown status.');
    }
    $cover = str_in('cover', 255);
    if ($cover !== '' && !preg_match('#^' . BLOG_URL . '/[\w.-]+\.jpg$#', $cover)) {
        fail(422, 'Upload the cover photo again.');
    }
    $data = [
        'title' => str_in('title', 160, true),
        'summary' => str_in('summary', 300),
        'body' => str_in('body', 60000),
        'cover' => $cover ?: null,
        'status' => $status,
        'updated_at' => now(),
    ];
    if ($status === 'published' && (!$old || !$old['published_at'])) {
        $data['published_at'] = now();
    }
    if ($old) {
        update('blog_posts', $id, $data);
        // drop images that are no longer used by the post
        foreach (array_diff(blog_images($old), blog_images($data)) as $f) {
            @unlink(BLOG_DIR . '/' . $f);
        }
    } else {
        $id = insert('blog_posts', $data + ['author_id' => (int) $admin['id'], 'created_at' => now()]);
    }
    return blog_detail($id);
}

/** File names of the uploaded images a post uses (cover and photos in the text). */
function blog_images(array $p): array
{
    preg_match_all('#' . BLOG_URL . '/([\w.-]+\.jpg)#', ($p['cover'] ?? '') . ' ' . ($p['body'] ?? ''), $m);
    return array_values(array_unique($m[1]));
}

// ---- homepage banner: photos the admin uploads, shown as a slideshow (the built-in photo when there are none) ----

function hero_slides(): array
{
    return array_map(fn($r) => ['id' => (int) $r['id'], 'url' => HERO_URL . '/' . $r['file']],
        rows('SELECT * FROM hero_slides ORDER BY sort, id'));
}

/** Multipart field "photo": an admin adds a banner photo at the end of the slideshow. */
function hero_add(): array
{
    require_admin();
    $file = save_image(upload_file('photo'), HERO_DIR, 'hero', 1920);
    $sort = (int) q('SELECT COALESCE(MAX(sort), 0) FROM hero_slides')->fetchColumn() + 1;
    $id = insert('hero_slides', ['file' => $file, 'sort' => $sort, 'created_at' => now()]);
    audit('hero_add', 'hero', $id, null, ['file' => $file]);
    return ['slides' => hero_slides()];
}

/** Body: {id}. An admin removes a banner photo. */
function hero_delete(): array
{
    require_admin();
    $r = row('SELECT * FROM hero_slides WHERE id = ?', [int_in('id', 1, PHP_INT_MAX)]) ?? fail(404, 'Photo not found.');
    q('DELETE FROM hero_slides WHERE id = ?', [$r['id']]);
    @unlink(HERO_DIR . '/' . basename($r['file']));
    audit('hero_delete', 'hero', (int) $r['id'], ['file' => $r['file']], null);
    return ['slides' => hero_slides()];
}

/** Body: {ids: [...]}. An admin sets the slideshow order. */
function hero_order(): array
{
    require_admin();
    foreach (array_values((array) (input()['ids'] ?? [])) as $i => $id) {
        q('UPDATE hero_slides SET sort = ? WHERE id = ?', [$i + 1, (int) $id]);
    }
    return ['slides' => hero_slides()];
}

/** The homepage "Meet the members" photo set by an admin, or null for the built-in one. */
function team_photo(): ?string
{
    $file = q("SELECT v FROM meta WHERE k = 'team_photo'")->fetchColumn();
    return $file ? HERO_URL . '/' . $file : null;
}

/** Multipart field "photo": an admin replaces the homepage "Meet the members" photo. */
function team_photo_set(): array
{
    require_admin();
    $file = save_image(upload_file('photo'), HERO_DIR, 'team', 1600);
    $old = q("SELECT v FROM meta WHERE k = 'team_photo'")->fetchColumn();
    q("DELETE FROM meta WHERE k = 'team_photo'");
    q("INSERT INTO meta (k, v) VALUES ('team_photo', ?)", [$file]);
    if ($old) {
        @unlink(HERO_DIR . '/' . basename($old));
    }
    audit('team_photo', 'hero', 0, $old ? ['file' => $old] : null, ['file' => $file]);
    return ['team_photo' => team_photo()];
}

/** An admin goes back to the built-in "Meet the members" photo. */
function team_photo_reset(): array
{
    require_admin();
    $old = q("SELECT v FROM meta WHERE k = 'team_photo'")->fetchColumn();
    if ($old) {
        q("DELETE FROM meta WHERE k = 'team_photo'");
        @unlink(HERO_DIR . '/' . basename($old));
        audit('team_photo', 'hero', 0, ['file' => $old], null);
    }
    return ['team_photo' => null];
}

/** Multipart field "image": an admin uploads a photo for a post; returns its URL. */
function blog_image(): array
{
    require_admin();
    return ['url' => BLOG_URL . '/' . save_image(upload_file('image'), BLOG_DIR, 'post', 1920)];
}

// ---- full-screen scorer ----

function can_score_match(array $m): bool
{
    $u = current_user();
    if (!$u) {
        return false;
    }
    $uid = (int) $u['id'];
    return in_array($u['role'], ['admin', 'scorekeeper'], true) || in_array($uid, array_map('intval', [$m['a1'], $m['a2'], $m['b1'], $m['b2']]), true);
}

/** One match with its scoreboard state, plus the next unfinished match on the same court. */
function match_detail(int $id): array
{
    $m = row('SELECT * FROM matches WHERE id = ?', [$id]) ?? fail(404, 'Match not found.');
    $s = get_session((int) $m['session_id']);
    $next = row("SELECT * FROM matches WHERE session_id = ? AND court = ? AND id <> ? AND status <> 'done'
                 ORDER BY round, id LIMIT 1", [$m['session_id'], $m['court'], $id]);
    $names = names(array_filter([$m['a1'], $m['a2'], $m['b1'], $m['b2'], $next['a1'] ?? 0, $next['a2'] ?? 0, $next['b1'] ?? 0, $next['b2'] ?? 0]));
    return [
        'session' => session_out($s),
        'match' => match_out($m, $names, $s),
        'next' => $next ? match_out($next, $names, $s) : null,
        'can_score' => can_score_match($m) && !is_frozen($s) && ($s['status'] !== 'completed' || (current_user()['role'] ?? '') === 'admin'),
        'lock' => lock_out($m),
        'rounds' => (int) $s['rounds'],
    ];
}

/**
 * Body: {op: "a" | "b" | "fault" | "swap" | "ends" | "pause" | "resume" | "undo" | "tiebreak" | "serve" | "right" | "start" | "finish" | "reopen", player?: id, side?: "a"|"b"}
 * a/b add a point for that side; fault is a serve fault (the second one on a point is a double fault,
 * a point to the receivers); swap switches the sides the players are shown on; serve picks (or corrects)
 * who is serving; right swaps which doubles partner plays on the right.
 */
function match_action(int $id): array
{
    require_user();
    $m = row('SELECT * FROM matches WHERE id = ?', [$id]) ?? fail(404, 'Match not found.');
    $s = get_session((int) $m['session_id']);
    if (!can_score_match($m)) {
        fail(403, 'Only admins and the players in this match can score it.');
    }
    if ($s['status'] === 'completed' && current_user()['role'] !== 'admin') {
        fail(409, 'This session is finished.');
    }
    assert_not_frozen($s);
    $tennis = $s['point_system'] === 'tennis';
    $op = str_in('op', 10, true);
    if ($op === 'takeover') {
        claim_lock($m, true);
        return match_detail($id);
    }
    if (!in_array($op, ['pause', 'resume'], true)) {
        claim_lock($m);
    }
    $before = ['score' => [(int) $m['score_a'], (int) $m['score_b']], 'status' => $m['status']];
    // Undoing or reopening a finished match is a correction: it needs a reason and is kept in the audit log.
    $reason = reason_in($m['status'] === 'done' && in_array($op, ['undo', 'reopen'], true));
    $audited = in_array($op, ['undo', 'reopen', 'finish'], true) || ($op === 'serve' && !empty(match_state($s, $m)['scored']));
    $log = (string) ($m['log'] ?? '');
    $data = [];
    $status = $m['status'];

    if ($op === 'fault') {
        if ($status === 'done') {
            fail(409, 'This match is finished. Undo or reopen it to keep scoring.');
        }
        $st = match_state($s, $m);
        if (!$st['server_side']) {
            fail(409, 'Choose who serves first.');
        }
        if (empty($st['fault'])) {
            $log .= 'f';
            $status = 'live';
            $op = 'none';
        } else {
            $op = 'd'; // second fault on the point: double fault, scored below as a point to the receivers
        }
    }

    switch ($op) {
        case 'none':
            break;
        case 'swap':
        case 'ends':
            // "ends" is the scorer confirming the players changed ends: the same side swap
            $log .= 's';
            break;
        case 'pause':
            if ($status !== 'live' || !$m['started_at'] || $m['paused_at']) {
                fail(409, 'The timer is not running.');
            }
            $data['paused_at'] = now();
            break;
        case 'resume':
            if (!$m['paused_at']) {
                fail(409, 'The timer is not paused.');
            }
            $data['paused_secs'] = (int) $m['paused_secs'] + max(0, time() - strtotime($m['paused_at']));
            $data['paused_at'] = null;
            break;
        case 'a':
        case 'b':
        case 'd':
            if ($status === 'done') {
                fail(409, 'This match is finished. Undo or reopen it to keep scoring.');
            }
            $side = $op === 'd' ? ($st['server_side'] === 'a' ? 'b' : 'a') : $op;
            if (!$tennis) {
                $a = (int) $m['score_a'] + ($side === 'a' ? 1 : 0);
                $b = (int) $m['score_b'] + ($side === 'b' ? 1 : 0);
                if ($s['scoring'] === 'total' && (int) $s['target'] > 0 && $a + $b > (int) $s['target']) {
                    fail(409, "This match is already at {$s['target']} points.");
                }
                $data += ['score_a' => $a, 'score_b' => $b];
            }
            $log .= $op;
            $status = 'live';
            break;
        case 'undo':
            if ($log === '') {
                fail(409, 'Nothing to undo.');
            }
            $last = substr($log, -1);
            $log = substr($log, 0, -1);
            if (!$tennis && $last === 'd') {
                // the double fault went to whoever was receiving before it
                $last = match_state($s, array_merge($m, ['log' => $log]))['server_side'] === 'a' ? 'b' : 'a';
            }
            if (!$tennis && ($last === 'a' || $last === 'b')) {
                $k = $last === 'a' ? 'score_a' : 'score_b';
                $data[$k] = max(0, (int) $m[$k] - 1);
            }
            $status = 'live';
            break;
        case 'tiebreak':
            $st = match_state($s, $m);
            if (!$tennis || empty($st['can_tiebreak'])) {
                fail(409, 'A tiebreak can only start when the games are level.');
            }
            $log .= 't';
            $status = 'live';
            break;
        case 'serve':
            // Before the first point this picks the first server; after that it corrects who is serving now.
            $p = (int) (input()['player'] ?? 0);
            $slot = array_search($p, array_map('intval', [$m['a1'], $m['a2'], $m['b1'], $m['b2']]), true);
            if ($slot === false || $p === 0) {
                fail(422, 'That player is not in this match.');
            }
            if (empty(match_state($s, $m)['scored'])) {
                $data['first_server'] = $p;
                $log = preg_replace('/[1-4]/', '', $log);
            } elseif (match_state($s, $m)['server'] !== $p) {
                $log .= (string) ($slot + 1);
            }
            break;
        case 'right':
            // Doubles: swap which partner plays on the right (deuce) side for one team.
            $side = (string) (input()['side'] ?? '');
            $ids = $side === 'a' ? [(int) $m['a1'], (int) $m['a2']] : ($side === 'b' ? [(int) $m['b1'], (int) $m['b2']] : []);
            if (count(array_filter($ids)) !== 2) {
                fail(422, 'Only doubles teams have a right and left side.');
            }
            $now = match_state($s, $m)['right'][$side];
            $data[$side . '_right'] = $now === $ids[0] ? $ids[1] : $ids[0];
            break;
        case 'start':
            $status = $status === 'done' ? 'done' : 'live';
            break;
        case 'finish':
            $status = 'done';
            break;
        case 'reopen':
            $status = 'live';
            break;
        default:
            fail(422, 'Unknown action.');
    }

    $m = array_merge($m, $data, ['log' => $log]);
    if ($tennis) {
        $st = match_state($s, $m);
        $data['score_a'] = $st['games'][0];
        $data['score_b'] = $st['games'][1];
        if (in_array($op, ['a', 'b', 'd'], true) && $st['finished']) {
            $status = 'done';
        }
    } elseif (in_array($op, ['a', 'b', 'd'], true) && score_finished($s, (int) $m['score_a'], (int) $m['score_b'])) {
        $status = 'done';
    }
    $data += ['log' => $log === '' ? null : $log, 'status' => $status, 'updated_at' => now()];
    if ($status !== 'scheduled' && !$m['started_at']) {
        $data['started_at'] = now();
    }
    update('matches', $id, $data);
    if ($status !== 'scheduled' && !in_array($s['status'], ['live', 'completed'], true)) {
        update('play_sessions', (int) $s['id'], ['status' => 'live']);
    }
    if ($status === 'done' || $m['status'] === 'done') {
        sync_session_ledger((int) $s['id']);
    }
    if ($status === 'done' && $m['status'] !== 'done' || $op === 'reopen' && $m['status'] === 'done') {
        match_activity($s, $m, (int) ($data['score_a'] ?? $m['score_a']), (int) ($data['score_b'] ?? $m['score_b']), $op === 'reopen');
    }
    if ($audited) {
        audit('match_' . $op, 'match', $id, $before, ['score' => [(int) ($data['score_a'] ?? $m['score_a']), (int) ($data['score_b'] ?? $m['score_b'])], 'status' => $status]
            + ($op === 'serve' ? ['server' => (int) (input()['player'] ?? 0)] : []), $reason);
    }
    return match_detail($id);
}

/** True for a match nobody has scored yet (it may have been opened on the scorer). */
function match_unplayed(array $m): bool
{
    return $m['status'] === 'scheduled'
        || ($m['status'] === 'live' && (string) ($m['log'] ?? '') === '' && (int) $m['score_a'] === 0 && (int) $m['score_b'] === 0);
}

/**
 * Admin can put any member in a match: someone not registered for the session yet is added as a
 * confirmed player (so a final or placement match can use anyone). Returns the session's player ids.
 */
function ensure_session_players(int $sid, array $ids): array
{
    foreach (array_unique(array_filter($ids)) as $uid) {
        row('SELECT id FROM users WHERE id = ?', [$uid]) ?? fail(422, 'That member no longer exists.');
        $reg = row('SELECT id, status FROM registrations WHERE session_id = ? AND user_id = ?', [$sid, $uid]);
        if (!$reg) {
            insert('registrations', ['session_id' => $sid, 'user_id' => $uid, 'status' => 'confirmed', 'created_at' => now()]);
        } elseif ($reg['status'] !== 'confirmed') {
            update('registrations', (int) $reg['id'], ['status' => 'confirmed']);
        }
    }
    return session_players($sid);
}

/**
 * Admin adds an extra match, e.g. a final or a placement match.
 * Body: {round, court, start_time?, a1, a2?, b1, b2?}. round can be a new round after the last one.
 */
function match_create(int $sid): array
{
    require_admin();
    $s = get_session($sid);
    assert_not_frozen($s);
    $size = team_size($s['format']);
    $round = int_in('round', 1, 999);
    $court = int_in('court', 1, 99);
    $time = str_in('start_time', 5) ?: round_start($s, $round);
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) {
        fail(422, 'Time must be HH:MM.');
    }
    $in = input();
    $p = [];
    foreach (['a1', 'a2', 'b1', 'b2'] as $k) {
        $p[$k] = (int) ($in[$k] ?? 0) ?: null;
    }
    if ($size === 1) {
        $p['a2'] = $p['b2'] = null;
    }
    $picked = array_filter($p);
    if (count($picked) !== ($size === 1 ? 2 : 4)) {
        fail(422, 'Pick a player for every place in the match.');
    }
    if (count($picked) !== count(array_unique($picked))) {
        fail(422, 'A player can only be in one place in the match.');
    }
    foreach ($picked as $uid) {
        $busy = row("SELECT court FROM matches WHERE session_id = ? AND round = ? AND status <> 'done' AND (a1 = ? OR a2 = ? OR b1 = ? OR b2 = ?)",
            [$sid, $round, $uid, $uid, $uid, $uid]);
        if ($busy) {
            fail(409, (names([$uid])[$uid] ?? 'A player') . " is already in a round $round match (court {$busy['court']}).");
        }
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        ensure_session_players($sid, $picked);
        insert('matches', $p + [
            'session_id' => $sid, 'round' => $round, 'court' => $court, 'start_time' => $time,
            'placement' => (int) $s['rule_version'] >= 2 && !empty($in['placement']) ? 1 : 0,
            'score_a' => 0, 'score_b' => 0, 'status' => 'scheduled', 'updated_at' => now(),
        ]);
        $total = (int) q('SELECT COALESCE(MAX(round), 0) FROM matches WHERE session_id = ?', [$sid])->fetchColumn();
        update('play_sessions', $sid, ['rounds' => $total]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return session_detail($sid);
}

/**
 * Admin rearranges a match that hasn't been scored. Body: {a1, a2, b1, b2, swap_with?} or {delete: true}
 * Players: a player brought in who is already playing another not-yet-started match in the same
 * round swaps places with the player they replace, so nobody plays twice in a round.
 * swap_with: another not-yet-started match id; the two matches trade round, court and start time.
 */
function match_lineup(int $id): array
{
    require_admin();
    $m = row('SELECT * FROM matches WHERE id = ?', [$id]) ?? fail(404, 'Match not found.');
    $sid = (int) $m['session_id'];
    assert_not_frozen(get_session($sid));
    if (!match_unplayed($m)) {
        fail(409, 'This match already has points. Reset its score first (Edit score on the scorer), then change it.');
    }
    $in = input();
    $pdo = db();
    $pdo->beginTransaction();
    try {
        if (!empty($in['delete'])) {
            q('DELETE FROM matches WHERE id = ?', [$id]);
            $total = (int) q('SELECT COALESCE(MAX(round), 0) FROM matches WHERE session_id = ?', [$sid])->fetchColumn();
            update('play_sessions', $sid, ['rounds' => $total]);
            $pdo->commit();
            return session_detail($sid);
        }
        $slots = ['a1', 'a2', 'b1', 'b2'];
        $players = ensure_session_players($sid, array_map(fn($k) => (int) ($in[$k] ?? 0), $slots));
        $new = [];
        foreach ($slots as $k) {
            $new[$k] = array_key_exists($k, $in) ? ((int) $in[$k] ?: null) : ($m[$k] !== null ? (int) $m[$k] : null);
            if (($m[$k] === null) !== ($new[$k] === null)) {
                fail(422, 'Every place in the match needs a player.');
            }
            if ($new[$k] !== null && !in_array($new[$k], $players, true)) {
                fail(422, 'That player is not confirmed for this session.');
            }
        }
        $picked = array_filter($new);
        if (count($picked) !== count(array_unique($picked))) {
            fail(422, 'A player can only be in one place in the match.');
        }
        foreach ($slots as $k) {
            $p = $new[$k];
            $out = $m[$k] !== null ? (int) $m[$k] : null;
            if ($p === null || $p === $out || in_array($p, array_map('intval', array_filter([$m['a1'], $m['a2'], $m['b1'], $m['b2']])), true)) {
                continue; // unchanged, or just moved within this match
            }
            $other = row('SELECT * FROM matches WHERE session_id = ? AND round = ? AND id <> ? AND (a1 = ? OR a2 = ? OR b1 = ? OR b2 = ?)',
                [$sid, $m['round'], $id, $p, $p, $p, $p]);
            if ($other) {
                if (!match_unplayed($other)) {
                    fail(409, (names([$p])[$p] ?? 'That player') . " is already playing on court {$other['court']} in this round.");
                }
                foreach ($slots as $ok) {
                    if ((int) $other[$ok] === $p) {
                        update('matches', (int) $other['id'], [$ok => $out, 'updated_at' => now()]);
                    }
                }
            }
        }
        // back to not started, so the scorer starts fresh (serve choice, timer) with the new line-up
        $changed = array_map('intval', array_values($new)) !== array_map('intval', [$m['a1'], $m['a2'], $m['b1'], $m['b2']]);
        update('matches', $id, $new + ['status' => 'scheduled', 'started_at' => null, 'paused_at' => null, 'paused_secs' => 0, 'updated_at' => now()]
            + ($changed ? ['first_server' => null, 'a_right' => null, 'b_right' => null] : []));

        $with = (int) ($in['swap_with'] ?? 0);
        if ($with && $with !== $id) {
            $o = row('SELECT * FROM matches WHERE id = ? AND session_id = ?', [$with, $sid]) ?? fail(404, 'Match not found.');
            if (!match_unplayed($o)) {
                fail(409, 'You can only swap with a match that has no points yet.');
            }
            update('matches', $id, ['round' => $o['round'], 'court' => $o['court'], 'start_time' => $o['start_time']]);
            update('matches', $with, ['round' => $m['round'], 'court' => $m['court'], 'start_time' => $m['start_time']]);
            if ((int) $o['round'] !== (int) $m['round']) {
                // moving into another round must not put anyone on court twice in that round
                foreach ([(int) $m['round'], (int) $o['round']] as $r) {
                    $ids = [];
                    foreach (rows('SELECT a1, a2, b1, b2 FROM matches WHERE session_id = ? AND round = ?', [$sid, $r]) as $x) {
                        $ids = array_merge($ids, array_map('intval', array_filter(array_values($x))));
                    }
                    if (count($ids) !== count(array_unique($ids))) {
                        fail(409, "That swap would put a player in two matches in round $r. Swap players first, or pick another match.");
                    }
                }
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return session_detail($sid);
}

/** Admin moves a round to a new start time. Body: {round, start_time: "HH:MM", shift_following: bool} */
function round_time(int $id): array
{
    require_admin();
    assert_not_frozen(get_session($id));
    $round = int_in('round', 1, 999);
    $time = str_in('start_time', 5, true);
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $time)) {
        fail(422, 'Time must be HH:MM.');
    }
    $cur = row('SELECT start_time FROM matches WHERE session_id = ? AND round = ? ORDER BY court LIMIT 1', [$id, $round])
        ?? fail(404, 'Round not found.');
    $mins = fn($t) => (int) substr($t, 0, 2) * 60 + (int) substr($t, 3, 2);
    $delta = $mins($time) - $mins($cur['start_time'] ?: $time);
    $shift = !empty(input()['shift_following']);
    $ms = rows('SELECT id, round, start_time FROM matches WHERE session_id = ? AND round ' . ($shift ? '>=' : '=') . ' ?', [$id, $round]);
    foreach ($ms as $m) {
        $t = (int) $m['round'] === $round ? $mins($time) : $mins($m['start_time'] ?: '00:00') + $delta;
        $t = (($t % 1440) + 1440) % 1440;
        update('matches', (int) $m['id'], ['start_time' => sprintf('%02d:%02d', intdiv($t, 60), $t % 60)]);
    }
    return session_detail($id);
}

/** Admin deletes a whole round nobody has scored. Later rounds move up one number and take over its time. Body: {round} */
function round_delete(int $id): array
{
    require_admin();
    assert_not_frozen(get_session($id));
    $round = int_in('round', 1, 999);
    $ms = rows('SELECT * FROM matches WHERE session_id = ? AND round = ?', [$id, $round]) ?: fail(404, 'Round not found.');
    foreach ($ms as $m) {
        if (!match_unplayed($m)) {
            fail(409, "A match in round $round already has points. Reset its score first, or remove the other matches one by one.");
        }
    }
    $mins = fn($t) => (int) substr($t, 0, 2) * 60 + (int) substr($t, 3, 2);
    $next = row('SELECT start_time FROM matches WHERE session_id = ? AND round > ? ORDER BY round, court LIMIT 1', [$id, $round]);
    $delta = $next && $ms[0]['start_time'] && $next['start_time'] ? $mins($next['start_time']) - $mins($ms[0]['start_time']) : 0;
    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('DELETE FROM matches WHERE session_id = ? AND round = ?', [$id, $round]);
        foreach (rows('SELECT id, round, start_time FROM matches WHERE session_id = ? AND round > ?', [$id, $round]) as $m) {
            $t = ((($m['start_time'] ? $mins($m['start_time']) - $delta : 0) % 1440) + 1440) % 1440;
            update('matches', (int) $m['id'], ['round' => (int) $m['round'] - 1] + ($m['start_time'] ? ['start_time' => sprintf('%02d:%02d', intdiv($t, 60), $t % 60)] : []));
        }
        $total = (int) q('SELECT COALESCE(MAX(round), 0) FROM matches WHERE session_id = ?', [$id])->fetchColumn();
        update('play_sessions', $id, ['rounds' => $total]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return session_detail($id);
}
