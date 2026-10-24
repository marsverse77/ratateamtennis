<?php
// Shared helpers: responses, auth, input and standings.

date_default_timezone_set('Asia/Makassar'); // WITA

class HttpError extends Exception
{
    public function __construct(public int $status, string $message)
    {
        parent::__construct($message);
    }
}

function fail(int $status, string $message): never
{
    throw new HttpError($status, $message);
}

function json_out($data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $body = json_encode($data, JSON_UNESCAPED_UNICODE);
    $after = $GLOBALS['bcs_after'] ?? [];
    if (!$after) {
        echo $body;
        exit;
    }
    // Send the response first, then do the slow work (push notifications).
    ignore_user_abort(true);
    header('Content-Length: ' . strlen($body));
    header('Connection: close');
    echo $body;
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } elseif (function_exists('litespeed_finish_request')) {
        litespeed_finish_request();
    } else {
        @ob_end_flush();
        flush();
    }
    foreach ($after as $fn) {
        try {
            $fn();
        } catch (Throwable $e) {
            error_log('[bcs] ' . $e);
        }
    }
    exit;
}

/** Runs $fn after the JSON response has been sent. */
function after_response(callable $fn): void
{
    $GLOBALS['bcs_after'][] = $fn;
}

function input(): array
{
    static $in = null;
    if ($in === null) {
        $raw = file_get_contents('php://input');
        $in = $raw ? (json_decode($raw, true) ?: []) : [];
    }
    return $in;
}

function str_in(string $key, int $max = 255, bool $required = false): string
{
    $v = trim((string) (input()[$key] ?? ''));
    if ($required && $v === '') {
        fail(422, ucfirst(str_replace('_', ' ', $key)) . ' is required.');
    }
    return mb_substr($v, 0, $max);
}

function int_in(string $key, int $min, int $max, ?int $default = null): int
{
    $v = input()[$key] ?? $default;
    if (!is_numeric($v)) {
        fail(422, ucfirst(str_replace('_', ' ', $key)) . ' must be a number.');
    }
    return max($min, min($max, (int) $v));
}

// ---- auth ----

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_name('bcs_sid');
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    ini_set('session.gc_maxlifetime', (string) (60 * 60 * 24 * 30));
    session_start();
}

function current_user(): ?array
{
    static $user = false;
    if ($user === false) {
        start_session();
        $id = $_SESSION['uid'] ?? null;
        $user = $id ? row('SELECT id, name, email, phone, photo, role, created_at FROM users WHERE id = ?', [$id]) : null;
    }
    return $user;
}

function require_user(): array
{
    return current_user() ?? fail(401, 'Please log in first.');
}

function require_admin(): array
{
    $u = require_user();
    if ($u['role'] !== 'admin') {
        fail(403, 'Admins only.');
    }
    return $u;
}

function login_as(int $id): void
{
    start_session();
    session_regenerate_id(true);
    $_SESSION['uid'] = $id;
}

function public_user(array $u): array
{
    return ['id' => (int) $u['id'], 'name' => $u['name'], 'role' => $u['role']];
}

// ---- sessions & standings ----

function get_session(int $id): array
{
    return row('SELECT * FROM play_sessions WHERE id = ?', [$id]) ?? fail(404, 'Session not found.');
}

/** Sessions completed before the points system changed keep their results exactly as they are. */
function is_frozen(array $s): bool
{
    return !empty($s['frozen_at']);
}

function assert_not_frozen(array $s): void
{
    if (is_frozen($s)) {
        fail(409, "This session's results are locked, so they can't be changed.");
    }
}

function session_out(array $s): array
{
    $counts = ['confirmed' => 0, 'waiting' => 0];
    foreach (rows('SELECT status, COUNT(*) AS n FROM registrations WHERE session_id = ? GROUP BY status', [$s['id']]) as $r) {
        $counts[$r['status']] = (int) $r['n'];
    }
    foreach (['id', 'courts', 'max_players', 'target', 'match_minutes', 'rounds', 'counts_overall', 'games', 'no_ad', 'tb_points', 'fee', 'rule_version'] as $k) {
        $s[$k] = (int) $s[$k];
    }
    $s['counts_overall'] = (bool) $s['counts_overall'];
    $s['no_ad'] = (bool) $s['no_ad'];
    $s['frozen'] = is_frozen($s);
    $s['with_games'] = session_has_games($s);
    $s['hitting'] = $s['activity'] === 'hitting' ? [
        'format' => HIT_FORMATS[$s['hit_format']] ?? '', 'level' => HIT_LEVELS[$s['hit_level']] ?? '',
        'partners' => HIT_PARTNERS[$s['hit_partners']] ?? '', 'balls' => HIT_BALLS[$s['hit_balls']] ?? '',
    ] : null;
    $ids = session_coach_ids($s);
    $n = names($ids);
    $s['coaches'] = [
        ...array_map(fn($id) => ['id' => $id, 'name' => $n[$id] ?? 'Coach'], $ids),
        ...array_map(fn($x) => ['id' => null, 'name' => $x], array_values(array_filter(array_map('trim', explode(',', (string) $s['coach_names']))))),
    ];
    $s['format_label'] = FORMATS[$s['format']]['label'] ?? $s['format'];
    $s['joined'] = $counts['confirmed'];
    $s['waiting'] = $counts['waiting'];
    if (!current_user()) {
        // Bank details are only shown to signed-in members.
        $s['bank_name'] = $s['bank_account'] = $s['bank_holder'] = '';
    }
    return $s;
}

/** Member ids of a coaching session's coaches. */
function session_coach_ids(array $s): array
{
    return array_values(array_filter(array_map('intval', explode(',', (string) ($s['coach_ids'] ?? '')))));
}

/** External Tournaments and drills-only coaching have no matches. */
function session_has_games(array $s): bool
{
    return !in_array($s['activity'], ['external', 'hitting'], true) && !($s['activity'] === 'coaching' && !(int) $s['with_games']);
}

function session_players(int $sid): array
{
    return array_map('intval', array_column(
        rows("SELECT user_id FROM registrations WHERE session_id = ? AND status = 'confirmed' ORDER BY created_at, id", [$sid]),
        'user_id'
    ));
}

/** Photo URLs by user id, for the ids that have one. */
function photos(array $ids): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    if (!$ids) {
        return [];
    }
    $in = implode(',', array_fill(0, count($ids), '?'));
    $out = [];
    foreach (rows("SELECT id, photo FROM users WHERE photo IS NOT NULL AND id IN ($in)", $ids) as $r) {
        $out[(int) $r['id']] = $r['photo'];
    }
    return $out;
}

/** Adds a photo field to rows that have an id. */
function with_photos(array $rows): array
{
    $ph = photos(array_column($rows, 'id'));
    foreach ($rows as &$r) {
        $r['photo'] = $ph[(int) $r['id']] ?? null;
    }
    return $rows;
}

function names(array $ids): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    if (!$ids) {
        return [];
    }
    $in = implode(',', array_fill(0, count($ids), '?'));
    $out = [];
    foreach (rows("SELECT id, name FROM users WHERE id IN ($in)", $ids) as $r) {
        $out[(int) $r['id']] = $r['name'];
    }
    return $out;
}

function match_out(array $m, array $names, ?array $s = null): array
{
    $team = fn($ids) => array_map(fn($id) => ['id' => $id, 'name' => $names[$id] ?? 'Player'], array_values(array_filter($ids)));
    return [
        'id' => (int) $m['id'],
        'session_id' => (int) $m['session_id'],
        'round' => (int) $m['round'],
        'court' => (int) $m['court'],
        'start_time' => $m['start_time'],
        'team_a' => $team([(int) $m['a1'], (int) ($m['a2'] ?? 0)]),
        'team_b' => $team([(int) $m['b1'], (int) ($m['b2'] ?? 0)]),
        'score_a' => (int) $m['score_a'],
        'score_b' => (int) $m['score_b'],
        'status' => $m['status'],
        'first_server' => $m['first_server'] !== null ? (int) $m['first_server'] : null,
        'started_at' => $m['started_at'],
        'paused_at' => $m['paused_at'] ?? null,
        'paused_secs' => (int) ($m['paused_secs'] ?? 0),
        'updated_at' => $m['updated_at'],
        'placement' => !empty($m['placement']),
        'state' => $s ? match_state($s, $m) : null,
    ];
}

/**
 * Play Session: every regular match won gives each winning player +1 RATA point (attendance adds +1 per
 * session, see session_standings and sync_session_ledger).
 * Played, W, L, GW and GL count regular matches only; a placement match (an extra final) gives no points
 * and only decides the order between its players.
 */
function tally_v2(array &$t, array $m): void
{
    $sides = [
        [[(int) $m['a1'], (int) ($m['a2'] ?? 0)], (int) $m['score_a'], (int) $m['score_b']],
        [[(int) $m['b1'], (int) ($m['b2'] ?? 0)], (int) $m['score_b'], (int) $m['score_a']],
    ];
    foreach ($sides as [$ids, $for, $against]) {
        foreach (array_filter($ids) as $p) {
            $t[$p] ??= blank_v2();
            $t[$p]['played']++;
            $t[$p]['gw'] += $for;
            $t[$p]['gl'] += $against;
            $t[$p]['diff'] += $for - $against;
            if ($m['status'] === 'done' && $for > $against) {
                $t[$p]['wins']++;
                $t[$p]['points']++;
            } elseif ($m['status'] === 'done' && $for < $against) {
                $t[$p]['losses']++;
            }
        }
    }
}

function blank_v2(): array
{
    return ['points' => 0, 'played' => 0, 'wins' => 0, 'losses' => 0, 'gw' => 0, 'gl' => 0, 'diff' => 0];
}

/** Winning side's and losing side's players of a finished match, or null for a draw. */
function match_sides(array $m): ?array
{
    $a = array_values(array_filter([(int) $m['a1'], (int) ($m['a2'] ?? 0)]));
    $b = array_values(array_filter([(int) $m['b1'], (int) ($m['b2'] ?? 0)]));
    if ((int) $m['score_a'] === (int) $m['score_b']) {
        return null;
    }
    return (int) $m['score_a'] > (int) $m['score_b'] ? [$a, $b] : [$b, $a];
}

/**
 * Session order under the new rules: W, then GD, then GW, then head-to-head when exactly two players are
 * level, then name. A finished placement match then puts its winners ahead of its losers.
 */
function rank_v2(array $rows, array $regular, array $placement): array
{
    $key = fn($r) => [$r['wins'], $r['diff'], $r['gw']];
    usort($rows, fn($a, $b) => [...$key($b), $a['name']] <=> [...$key($a), $b['name']]);
    for ($i = 0; $i < count($rows) - 1; $i++) {
        $p = $rows[$i];
        $q = $rows[$i + 1];
        $tied3 = isset($rows[$i + 2]) && $key($rows[$i + 2]) === $key($p);
        $tiedBefore = $i > 0 && $key($rows[$i - 1]) === $key($p);
        if ($key($p) !== $key($q) || $tied3 || $tiedBefore) {
            continue;
        }
        $h2h = 0;
        foreach ($regular as $m) {
            if ($m['status'] !== 'done' || !($sides = match_sides($m))) {
                continue;
            }
            if (in_array($q['id'], $sides[0], true) && in_array($p['id'], $sides[1], true)) {
                $h2h++;
            } elseif (in_array($p['id'], $sides[0], true) && in_array($q['id'], $sides[1], true)) {
                $h2h--;
            }
        }
        if ($h2h > 0) {
            [$rows[$i], $rows[$i + 1]] = [$q, $p];
        }
    }
    foreach ($placement as $m) {
        if ($m['status'] !== 'done' || !($sides = match_sides($m))) {
            continue;
        }
        [$won, $lost] = $sides;
        $at = [];
        foreach ($rows as $i => $r) {
            if (in_array($r['id'], $won, true) || in_array($r['id'], $lost, true)) {
                $at[] = $i;
            }
        }
        $inMatch = array_map(fn($i) => $rows[$i], $at);
        $reordered = array_merge(
            array_filter($inMatch, fn($r) => in_array($r['id'], $won, true)),
            array_filter($inMatch, fn($r) => in_array($r['id'], $lost, true))
        );
        foreach (array_values($reordered) as $k => $r) {
            $r['final'] = in_array($r['id'], $won, true) ? 'won' : 'lost';
            $rows[$at[$k]] = $r;
        }
    }
    foreach ($rows as $i => &$r) {
        $r['rank'] = $i + 1;
    }
    return $rows;
}

/** Session leaderboard. $includeLive counts points from matches still being played. */
function session_standings(int $sid, bool $includeLive = true): array
{
    $players = session_players($sid);
    $sess = row('SELECT activity, placements_at, format FROM play_sessions WHERE id = ?', [$sid]);
    $statuses = $includeLive ? "('done','live')" : "('done')";
    $t = array_fill_keys($players, blank_v2());
    $regular = $placement = [];
    foreach (rows("SELECT * FROM matches WHERE session_id = ? AND status IN $statuses ORDER BY round, id", [$sid]) as $m) {
        if (!empty($m['placement'])) {
            $placement[] = $m;
        } else {
            $regular[] = $m;
            tally_v2($t, $m);
        }
    }
    $names = names(array_keys($t));
    $out = [];
    foreach ($t as $id => $r) {
        $out[] = ['id' => $id, 'name' => $names[$id] ?? 'Player'] + $r;
    }
    $ranked = rank_v2($out, $regular, $placement);
    if ($sess['activity'] === 'mabar') {
        // Play Session: +1 for attending (at least one finished match) on top of +1 per regular match won.
        $came = [];
        foreach (rows("SELECT a1, a2, b1, b2 FROM matches WHERE session_id = ? AND status = 'done'", [$sid]) as $m) {
            foreach ([$m['a1'], $m['a2'], $m['b1'], $m['b2']] as $uid) {
                $came[(int) $uid] = true;
            }
        }
        foreach ($ranked as &$r) {
            $r['attended'] = isset($came[$r['id']]);
            $r['points'] += $r['attended'] ? 1 : 0;
        }
        unset($r);
    }
    if ($sess['activity'] === 'mini') {
        // An Internal Tournament gives placement points only, once placements are confirmed.
        $places = $sess['placements_at'] ? array_column(rows('SELECT user_id, place FROM session_placements WHERE session_id = ?', [$sid]), 'place', 'user_id') : [];
        foreach ($ranked as &$r) {
            $r['points'] = isset($places[$r['id']]) ? MINI_POINTS[session_format($sess)][$places[$r['id']]] : 0;
        }
        unset($r);
        if ($places) {
            // Final order follows the placements; match results only order players with the same placement.
            usort($ranked, fn($a, $b) => [$b['points'], $a['rank']] <=> [$a['points'], $b['rank']]);
            foreach ($ranked as $i => &$r) {
                $r['rank'] = $i + 1;
            }
            unset($r);
        }
    }
    return with_photos($ranked);
}

/** Overall leaderboard: RATA points from the points ledger (see points.php). */
function overall_standings(): array
{
    return ledger_standings();
}

/** True when the score reached the session's target and the match is finished. */
function score_finished(array $s, int $a, int $b): bool
{
    $target = (int) $s['target'];
    if ($target <= 0) {
        return false;
    }
    return $s['scoring'] === 'race' ? max($a, $b) >= $target : $a + $b >= $target;
}
