<?php
// RATA ranking points: an append-only ledger. Entries are never edited or deleted; a change of result
// adds a reversal entry instead. Each entry has a unique source key, so nothing is credited twice.

// Stored category keys stay mabar / mini; members see them as Play Session and Internal Tournament.
const POINT_CATEGORIES = ['mabar' => 'Play Session', 'mini' => 'Internal Tournament', 'external' => 'External Tournament', 'adjustment' => 'Adjustment'];

// Internal Tournament (stored as activity 'mini'): points per player for the final placement. Each doubles partner gets the full points.
// With tied semi-finalists and no 3rd-place match, both get the 3rd-place points (joint 3rd).
const MINI_PLACES = ['champion' => 'Champion', 'runner_up' => 'Runner-up', 'third' => '3rd place', 'joint_third' => 'Joint 3rd', 'fourth' => '4th place', 'participant' => 'Participation'];
const MINI_POINTS = [
    'singles' => ['champion' => 12, 'runner_up' => 9, 'third' => 6, 'joint_third' => 6, 'fourth' => 3, 'participant' => 1],
    'doubles' => ['champion' => 10, 'runner_up' => 7, 'third' => 5, 'joint_third' => 5, 'fourth' => 3, 'participant' => 1],
];

// External tournaments: base points by result, times the category level multiplier, rounded half up.
const EXTERNAL_PLACES = ['champion' => 'Champion', 'runner_up' => 'Runner-up', 'semi' => 'Semi-finalist', 'quarter' => 'Quarter-finalist', 'participant' => 'Participation'];
const EXTERNAL_BASE = [
    'singles' => ['champion' => 30, 'runner_up' => 24, 'semi' => 18, 'quarter' => 12, 'participant' => 4],
    'doubles' => ['champion' => 24, 'runner_up' => 18, 'semi' => 14, 'quarter' => 9, 'participant' => 3],
];
const EXTERNAL_LEVELS = ['newbie' => ['Newbie', 1.0], 'beginner' => ['Beginner', 1.25], 'intermediate' => ['Intermediate', 1.5], 'advanced' => ['Advanced / Open', 2.0]];
const EXTERNAL_MIN_ENTRANTS = 4;
const EXTERNAL_CATEGORIES = ['womens' => "Women's", 'mens' => "Men's", 'mix' => 'Mix'];

function external_points(string $format, string $placement, string $level, int $entrants): int
{
    if ($entrants < EXTERNAL_MIN_ENTRANTS) {
        return 0;
    }
    return (int) round(EXTERNAL_BASE[$format][$placement] * EXTERNAL_LEVELS[$level][1], 0, PHP_ROUND_HALF_UP);
}

function seasons(): array
{
    static $all = null;
    return $all ??= array_map(fn($s) => ['id' => (int) $s['id'], 'name' => $s['name'], 'starts_on' => $s['starts_on']],
        rows('SELECT * FROM seasons ORDER BY starts_on, id'));
}

/**
 * The season a ledger entry is filed under: the latest one that started on or before the date. Seasons are
 * no longer shown (points keep adding up); the column only stays filled for the record.
 */
function season_for(string $date): array
{
    $found = seasons()[0];
    foreach (seasons() as $s) {
        if ($s['starts_on'] <= $date) {
            $found = $s;
        }
    }
    return $found;
}

function session_format(array $s): string
{
    return team_size($s['format']) === 1 ? 'singles' : 'doubles';
}

/**
 * Brings one session's Mabar entries in line with its results: +1 for attending (at least one finished match),
 * +1 for each winner of each finished regular match, reversals for entries whose result no longer stands.
 */
function sync_session_ledger(int $sid): void
{
    $s = row('SELECT * FROM play_sessions WHERE id = ?', [$sid]);
    $expected = [];
    if ($s && (int) $s['rule_version'] >= 2 && (int) $s['counts_overall'] === 1 && $s['activity'] === 'mini' && $s['placements_at']) {
        // Internal Tournament: placement points once, and no Play Session points for its matches.
        $table = MINI_POINTS[session_format($s)];
        foreach (rows('SELECT user_id, place FROM session_placements WHERE session_id = ?', [$sid]) as $p) {
            $expected["mini:s$sid:u{$p['user_id']}:r{$s['rule_version']}"] = [
                'user_id' => (int) $p['user_id'], 'match_id' => null, 'points' => $table[$p['place']] ?? 0,
                'note' => (MINI_PLACES[$p['place']] ?? $p['place']) . ' · Internal Tournament', 'category' => 'mini',
            ];
        }
    }
    if ($s && (int) $s['rule_version'] >= 2 && (int) $s['counts_overall'] === 1 && $s['activity'] === 'mabar') {
        $ms = rows("SELECT * FROM matches WHERE session_id = ? AND status = 'done' AND placement = 0", [$sid]);
        $ids = [];
        foreach ($ms as $m) {
            array_push($ids, (int) $m['a1'], (int) $m['a2'], (int) $m['b1'], (int) $m['b2']);
        }
        $names = names(array_filter($ids));
        // Attendance: +1 once per session for every player with at least one finished match (placement finals too).
        $came = [];
        foreach (rows("SELECT a1, a2, b1, b2 FROM matches WHERE session_id = ? AND status = 'done'", [$sid]) as $m) {
            foreach ([$m['a1'], $m['a2'], $m['b1'], $m['b2']] as $uid) {
                if ($uid) {
                    $came[(int) $uid] = true;
                }
            }
        }
        foreach (array_keys($came) as $uid) {
            $expected["mabar:att:s$sid:u$uid:r{$s['rule_version']}"] = [
                'user_id' => $uid, 'match_id' => null, 'points' => 1, 'note' => 'Attended · ' . $s['title'], 'category' => 'mabar',
            ];
        }
        foreach ($ms as $m) {
            if (!($sides = match_sides($m))) {
                continue;
            }
            [$won, $lost] = $sides;
            $score = max((int) $m['score_a'], (int) $m['score_b']) . '-' . min((int) $m['score_a'], (int) $m['score_b']);
            $vs = implode(' / ', array_map(fn($id) => $names[$id] ?? 'Player', $lost));
            foreach ($won as $uid) {
                $expected["mabar:m{$m['id']}:u$uid:r{$s['rule_version']}"] = [
                    'user_id' => $uid, 'match_id' => (int) $m['id'], 'points' => 1, 'note' => "Won $score vs $vs", 'category' => 'mabar',
                ];
            }
        }
    }
    $active = rows("SELECT * FROM point_ledger WHERE session_id = ? AND category IN ('mabar', 'mini') AND reverses IS NULL AND reversed_at IS NULL", [$sid]);
    $season = $s ? season_for($s['date'])['id'] : 0;
    $fmt = $s ? session_format($s) : '';
    post_entries($expected, $active, $s ? 'Result changed' : 'Session removed',
        ['season_id' => $season, 'format' => $fmt, 'session_id' => $sid, 'rule_version' => (int) ($s['rule_version'] ?? 2)]);
}

/**
 * Makes the ledger match $expected (base source key => entry): entries that no longer stand are reversed,
 * missing ones are posted, and an entry whose points changed is reversed and posted again.
 */
function post_entries(array $expected, array $active, string $why, array $common): void
{
    $have = [];
    foreach ($active as $e) {
        $base = preg_replace('/#\d+$/', '', $e['source_key']);
        // Kept only while it still stands with the same points; otherwise it is reversed (and re-posted if expected).
        if (isset($expected[$base]) && (int) $expected[$base]['points'] === (int) $e['points']) {
            $have[$base] = $e;
        }
    }
    $stale = array_filter($active, fn($e) => !in_array($e, $have, true));
    $missing = array_diff_key($expected, $have);
    if (!$stale && !$missing) {
        return;
    }
    $pdo = db();
    $own = !$pdo->inTransaction();
    if ($own) {
        $pdo->beginTransaction();
    }
    try {
        foreach ($stale as $e) {
            reverse_entry($e, $why);
        }
        foreach ($missing as $key => $e) {
            $n = (int) q('SELECT COUNT(*) FROM point_ledger WHERE source_key = ? OR source_key LIKE ?', [$key, $key . '#%'])->fetchColumn();
            insert('point_ledger', $e + $common + [
                'source_key' => $n ? "$key#" . ($n + 1) : $key,
                'created_by' => current_user()['id'] ?? null,
                'created_at' => now(),
            ]);
        }
        if ($own) {
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($own) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/** Cancels an entry by adding the opposite amount; the original stays for the record. */
function reverse_entry(array $e, string $why): void
{
    insert('point_ledger', [
        'source_key' => 'rev:' . $e['id'],
        'user_id' => (int) $e['user_id'],
        'season_id' => (int) $e['season_id'],
        'category' => $e['category'],
        'format' => $e['format'],
        'session_id' => $e['session_id'],
        'match_id' => $e['match_id'],
        'external_id' => $e['external_id'] ?? null,
        'points' => -(int) $e['points'],
        'rule_version' => (int) $e['rule_version'],
        'note' => 'Reversed: ' . $why . ' (' . $e['note'] . ')',
        'reverses' => (int) $e['id'],
        'created_by' => current_user()['id'] ?? null,
        'created_at' => now(),
    ]);
    update('point_ledger', (int) $e['id'], ['reversed_at' => now()]);
}

/** Brings an external result's entries in line with its review: approved results credit the member and partner. */
function sync_external_ledger(int $rid): void
{
    $r = row('SELECT * FROM external_results WHERE id = ?', [$rid]);
    $expected = [];
    if ($r && $r['status'] === 'approved' && (int) $r['points'] > 0) {
        $note = EXTERNAL_PLACES[$r['placement']] . ' · ' . $r['tournament'] . ($r['category'] !== '' ? ' (' . $r['category'] . ')' : '');
        foreach (external_credited($r) as $uid) {
            $expected["ext:$rid:u$uid"] = ['user_id' => $uid, 'points' => (int) $r['points'], 'note' => $note, 'category' => 'external', 'external_id' => $rid];
        }
    }
    $active = rows("SELECT * FROM point_ledger WHERE external_id = ? AND reverses IS NULL AND reversed_at IS NULL", [$rid]);
    post_entries($expected, $active, 'Result review changed', [
        'season_id' => $r ? season_for($r['event_date'])['id'] : 0, 'format' => $r['format'] ?? '', 'session_id' => null, 'match_id' => null, 'rule_version' => 2,
    ]);
}

/** Members an approved external result credits: the submitter, and the partner when they are a member not already credited for the event. */
function external_credited(array $r): array
{
    $ids = [(int) $r['user_id']];
    if ($r['partner_id'] && !external_duplicate((int) $r['partner_id'], $r['event_key'], (int) $r['id'])) {
        $ids[] = (int) $r['partner_id'];
    }
    return $ids;
}

/** Another approved result already credits this member for the same event, category and format. */
function external_duplicate(int $uid, string $eventKey, int $exceptId): ?array
{
    return row("SELECT * FROM external_results WHERE status = 'approved' AND event_key = ? AND id <> ? AND (user_id = ? OR partner_id = ?) ORDER BY id LIMIT 1",
        [$eventKey, $exceptId, $uid, $uid]);
}

/** Posts points for sessions played before the ledger existed (runs once, and again after a migration clears the flag). */
function ensure_ledger(): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;
    if (q("SELECT v FROM meta WHERE k = 'ledger_backfill'")->fetchColumn()) {
        return;
    }
    foreach (rows('SELECT id FROM play_sessions WHERE rule_version >= 2') as $s) {
        sync_session_ledger((int) $s['id']);
    }
    // Finished singles Internal Tournaments that never got placements get them from their leaderboard.
    foreach (rows("SELECT id FROM play_sessions WHERE activity = 'mini' AND status = 'completed' AND placements_at IS NULL") as $s) {
        auto_placements((int) $s['id']);
    }
    try {
        q("INSERT INTO meta (k, v) VALUES ('ledger_backfill', ?)", [now()]);
    } catch (PDOException $e) {
        // another request finished it first
    }
}

/**
 * The RATA points leaderboard, from the ledger. Points keep adding up; there are no seasons.
 * $cat: all | mabar | mini | external. $fmt: all | singles | doubles.
 * Played, W, L and games come from Play Session and Internal Tournament matches (same format filter); events counts the
 * Internal and External Tournaments a member got points for.
 */
function ledger_standings(string $cat = 'all', string $fmt = 'all'): array
{
    ensure_ledger();
    $where = '1 = 1';
    $args = [];
    if ($fmt !== 'all') {
        $where .= ' AND format = ?';
        $args[] = $fmt;
    }
    $pts = [];
    foreach (rows("SELECT user_id, category, SUM(points) AS p FROM point_ledger WHERE $where GROUP BY user_id, category", $args) as $r) {
        $pts[(int) $r['user_id']][$r['category']] = (int) $r['p'];
    }
    $events = [];
    foreach (rows("SELECT user_id, category, COUNT(*) AS n FROM point_ledger WHERE $where AND category IN ('mini', 'external')
                   AND reverses IS NULL AND reversed_at IS NULL GROUP BY user_id, category", $args) as $r) {
        $events[(int) $r['user_id']][$r['category']] = (int) $r['n'];
    }
    // Play Sessions attended (each gave +1): attendance entries that still stand.
    $attended = [];
    foreach (rows("SELECT user_id, COUNT(*) AS n FROM point_ledger WHERE $where AND category = 'mabar' AND source_key LIKE 'mabar:att:%'
                   AND reverses IS NULL AND reversed_at IS NULL GROUP BY user_id", $args) as $r) {
        $attended[(int) $r['user_id']] = (int) $r['n'];
    }
    $t = [];
    $sessions = [];
    // Match stats: Play Session matches, plus Internal Tournament matches on the overall and Internal Tournament boards.
    $acts = ['all' => "'mabar', 'mini'", 'mabar' => "'mabar'", 'mini' => "'mini'", 'external' => "''"][$cat];
    $sql = "SELECT m.*, s.format FROM matches m JOIN play_sessions s ON s.id = m.session_id
            WHERE s.rule_version >= 2 AND s.counts_overall = 1 AND s.activity IN ($acts) AND m.status = 'done' AND m.placement = 0";
    foreach (rows($sql) as $m) {
        if ($fmt === 'all' || session_format($m) === $fmt) {
            tally_v2($t, $m);
        }
    }
    $plays = [];
    $sql = "SELECT r.user_id, s.format, s.activity FROM registrations r JOIN play_sessions s ON s.id = r.session_id
            WHERE s.rule_version >= 2 AND s.counts_overall = 1 AND s.status = 'completed' AND r.status = 'confirmed'";
    foreach (rows($sql) as $r) {
        if ($fmt === 'all' || session_format($r) === $fmt) {
            $sessions[(int) $r['user_id']] = ($sessions[(int) $r['user_id']] ?? 0) + 1;
            if ($r['activity'] === 'mabar') {
                $plays[(int) $r['user_id']] = ($plays[(int) $r['user_id']] ?? 0) + 1;
            }
        }
    }
    $names = names(array_merge(array_keys($pts), array_keys($t), array_keys($sessions)));
    $out = [];
    foreach ($names as $id => $name) {
        $p = $pts[$id] ?? [];
        $by = ['mabar' => $p['mabar'] ?? 0, 'mini' => $p['mini'] ?? 0, 'external' => $p['external'] ?? 0];
        $total = array_sum($by) + ($p['adjustment'] ?? 0);
        // RATA points come from the ledger; the match stats only describe Play Sessions.
        $out[] = ['id' => $id, 'name' => $name, 'sessions' => $sessions[$id] ?? 0, 'play_sessions' => $plays[$id] ?? 0, 'attended' => $attended[$id] ?? 0,
            'mini_events' => $events[$id]['mini'] ?? 0, 'external_events' => $events[$id]['external'] ?? 0, 'points' => $cat === 'all' ? $total : $by[$cat],
            'events' => $cat === 'mini' || $cat === 'external' ? ($events[$id][$cat] ?? 0) : 0]
            + $by + ['adjustment' => $p['adjustment'] ?? 0] + ($t[$id] ?? blank_v2());
    }
    if ($cat !== 'all') {
        $out = array_values(array_filter($out, fn($r) => $r['points'] !== 0 || ($cat === 'mabar' && $r['played'])));
    }
    // RATA points, then regular wins, then GD, then GW, then name.
    usort($out, fn($a, $b) => [$b['points'], $b['wins'], $b['diff'], $b['gw'], $a['name']] <=> [$a['points'], $a['wins'], $a['diff'], $a['gw'], $b['name']]);
    foreach ($out as $i => &$r) {
        $r['rank'] = $i + 1;
    }
    return with_photos($out);
}

/** One member's RATA points, by source, with every ledger entry. */
function member_points(int $uid): array
{
    ensure_ledger();
    $entries = rows("SELECT l.*, s.title AS session_title, s.date AS session_date FROM point_ledger l
                     LEFT JOIN play_sessions s ON s.id = l.session_id
                     WHERE l.user_id = ? ORDER BY l.id DESC", [$uid]);
    $by = ['mabar' => 0, 'mini' => 0, 'external' => 0, 'adjustment' => 0];
    foreach ($entries as $e) {
        $by[$e['category']] = ($by[$e['category']] ?? 0) + (int) $e['points'];
    }
    return [
        'total' => array_sum($by),
        'by' => $by,
        'entries' => array_map(fn($e) => [
            'id' => (int) $e['id'],
            'points' => (int) $e['points'],
            'category' => $e['category'],
            'format' => $e['format'],
            'note' => $e['note'],
            'session_id' => $e['session_id'] !== null ? (int) $e['session_id'] : null,
            'session_title' => $e['session_title'],
            'date' => $e['session_date'] ?? substr($e['created_at'], 0, 10),
            'reversed' => $e['reversed_at'] !== null,
            'is_reversal' => $e['reverses'] !== null,
            'rule_version' => (int) $e['rule_version'],
            'created_at' => $e['created_at'],
        ], $entries),
    ];
}
