<?php
// Internal Tournament placements (stored as activity 'mini') and External Tournament results (RATA points spec v2, P2).

const EXTERNAL_DIR = __DIR__ . '/../data/external';

/**
 * Admin sets the final placements of an Internal Tournament. Body: {places: {user_id: place}, confirm: bool}
 * Players without a placement get Participation. Points are only given once placements are confirmed.
 */
function session_placements(int $id): array
{
    require_admin();
    $s = get_session($id);
    assert_not_frozen($s);
    if ((int) $s['rule_version'] < 2 || $s['activity'] !== 'mini') {
        fail(409, 'Placements are only for Internal Tournaments.');
    }
    $players = session_players($id);
    $places = [];
    foreach ((array) (input()['places'] ?? []) as $uid => $place) {
        $uid = (int) $uid;
        if (!in_array($uid, $players, true)) {
            fail(422, 'Only players in this tournament can get a placement.');
        }
        if (!isset(MINI_PLACES[$place])) {
            fail(422, 'Unknown placement.');
        }
        $places[$uid] = $place;
    }
    foreach ($players as $uid) {
        $places[$uid] ??= 'participant';
    }
    // One player per place in singles, one pair in doubles. Joint 3rd replaces 3rd and 4th.
    $size = team_size($s['format']);
    $count = array_count_values($places);
    $max = ['champion' => $size, 'runner_up' => $size, 'third' => $size, 'joint_third' => 2 * $size, 'fourth' => $size];
    foreach ($max as $place => $n) {
        if (($count[$place] ?? 0) > $n) {
            fail(422, 'Too many players marked ' . MINI_PLACES[$place] . ($size === 2 ? ' (one pair per place).' : ' (one player per place).'));
        }
    }
    if (!empty($count['joint_third']) && (!empty($count['third']) || !empty($count['fourth']))) {
        fail(422, 'Use either Joint 3rd, or 3rd and 4th place, not both.');
    }
    $confirm = !empty(input()['confirm']);
    if ($confirm && empty($count['champion'])) {
        fail(422, 'Pick the champion before confirming.');
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        q('DELETE FROM session_placements WHERE session_id = ?', [$id]);
        foreach ($places as $uid => $place) {
            insert('session_placements', ['session_id' => $id, 'user_id' => $uid, 'place' => $place, 'created_at' => now()]);
        }
        update('play_sessions', $id, ['placements_at' => $confirm ? now() : null]);
        audit($confirm ? 'placements_confirm' : 'placements_draft', 'session', $id, null, $places);
        sync_session_ledger($id);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    if ($confirm && !$s['placements_at']) {
        notify('Final placements: ' . $s['title'], 'The results are in. See your placement and RATA points.', '#/sessions/' . $id, $players);
    }
    return session_detail($id);
}

/**
 * Placements suggested by the session leaderboard: 1st champion, 2nd runner-up, then 3rd and 4th, everyone
 * else participation. In doubles each place goes to the next two players on the leaderboard.
 */
function suggested_placements(array $s): array
{
    $per = session_format($s) === 'singles' ? 1 : 2;
    $places = ['champion', 'runner_up', 'third', 'fourth'];
    $out = [];
    foreach (session_standings((int) $s['id'], false) as $i => $r) {
        $out[(int) $r['id']] = $places[intdiv($i, $per)] ?? 'participant';
    }
    return $out;
}

/**
 * A finished singles Internal Tournament whose placements nobody set gets them from its leaderboard, so its
 * players get their RATA points without waiting. The admin can still change them. Doubles pairs can't be read
 * from the leaderboard reliably, so they stay with the admin.
 */
function auto_placements(int $sid): void
{
    $s = row('SELECT * FROM play_sessions WHERE id = ?', [$sid]);
    if (!$s || $s['activity'] !== 'mini' || $s['status'] !== 'completed' || $s['placements_at'] || session_format($s) !== 'singles'
        || row('SELECT id FROM session_placements WHERE session_id = ? LIMIT 1', [$sid])) {
        return;
    }
    $places = suggested_placements($s);
    if (!$places) {
        return;
    }
    foreach ($places as $uid => $place) {
        insert('session_placements', ['session_id' => $sid, 'user_id' => $uid, 'place' => $place, 'created_at' => now()]);
    }
    update('play_sessions', $sid, ['placements_at' => now()]);
    audit('placements_auto', 'session', $sid, null, $places);
    sync_session_ledger($sid);
}

/** Placements of an Internal Tournament with the RATA points each one gives. */
function placements_out(array $s): ?array
{
    if ($s['activity'] !== 'mini' || (int) $s['rule_version'] < 2) {
        return null;
    }
    $table = MINI_POINTS[session_format($s)];
    $order = array_flip(array_keys(MINI_PLACES));
    $rows = rows('SELECT user_id, place FROM session_placements WHERE session_id = ?', [$s['id']]);
    usort($rows, fn($a, $b) => $order[$a['place']] <=> $order[$b['place']]);
    $names = names(array_map(fn($r) => (int) $r['user_id'], $rows));
    return [
        'confirmed' => (bool) $s['placements_at'],
        'suggested' => $s['placements_at'] || $rows ? null : suggested_placements($s),
        'points' => $table,
        'labels' => MINI_PLACES,
        'rows' => with_photos(array_map(fn($r) => [
            'id' => (int) $r['user_id'], 'name' => $names[(int) $r['user_id']] ?? 'Player',
            'place' => $r['place'], 'label' => MINI_PLACES[$r['place']], 'points' => $table[$r['place']],
        ], $rows)),
    ];
}

// ---- external tournaments ----

/** Submitted fields come as multipart (with a proof photo) or JSON. */
function ext_in(string $key, int $max = 255): string
{
    $v = $_POST[$key] ?? input()[$key] ?? '';
    return mb_substr(trim((string) $v), 0, $max);
}

function external_out(array $r, array $names): array
{
    $u = current_user();
    $own = $u && ((int) $u['id'] === (int) $r['user_id'] || (int) $u['id'] === (int) $r['partner_id']);
    $admin = ($u['role'] ?? '') === 'admin';
    return [
        'id' => (int) $r['id'],
        'user' => ['id' => (int) $r['user_id'], 'name' => $names[(int) $r['user_id']] ?? 'Member'],
        'partner' => $r['partner_id'] ? ['id' => (int) $r['partner_id'], 'name' => $names[(int) $r['partner_id']] ?? 'Member'] : null,
        'partner_name' => $r['partner_name'],
        'tournament' => $r['tournament'],
        'organizer' => $r['organizer'],
        'event_date' => $r['event_date'],
        'category' => $r['category'],
        'level' => $r['level'],
        'level_label' => EXTERNAL_LEVELS[$r['level']][0] ?? $r['level'],
        'format' => $r['format'],
        'placement' => $r['placement'],
        'placement_label' => EXTERNAL_PLACES[$r['placement']] ?? $r['placement'],
        'entrants' => (int) $r['entrants'],
        'status' => $r['status'],
        'points' => (int) $r['points'],
        'estimate' => external_points($r['format'], $r['placement'], $r['level'], (int) $r['entrants']),
        'review_note' => $r['review_note'],
        'reviewed_at' => $r['reviewed_at'],
        'created_at' => $r['created_at'],
        // Evidence is only shown to the people on the result and to admins.
        'proof_link' => $own || $admin ? $r['proof_link'] : '',
        'has_proof' => ($own || $admin) && (bool) $r['proof_file'],
        'notes' => $own || $admin ? $r['notes'] : '',
        'can_edit' => $admin || $own && (int) $u['id'] === (int) $r['user_id'],
        'can_withdraw' => $own && (int) $u['id'] === (int) $r['user_id'] && $r['status'] !== 'approved',
    ];
}

function external_list_out(array $rs): array
{
    $ids = [];
    foreach ($rs as $r) {
        array_push($ids, (int) $r['user_id'], (int) $r['partner_id']);
    }
    $names = names(array_filter($ids));
    return array_map(fn($r) => external_out($r, $names), $rs);
}

/** Admin: every result (?status= filters). Member: their own. */
function external_list(): array
{
    $u = require_user();
    $counts = [];
    if ($u['role'] === 'admin') {
        $status = in_array($_GET['status'] ?? '', ['pending', 'needs_revision', 'approved', 'rejected'], true) ? $_GET['status'] : 'pending';
        $rs = rows('SELECT * FROM external_results WHERE status = ? ORDER BY ' . ($status === 'pending' ? 'created_at' : 'updated_at DESC'), [$status]);
        foreach (rows('SELECT status, COUNT(*) AS n FROM external_results GROUP BY status') as $r) {
            $counts[$r['status']] = (int) $r['n'];
        }
    } else {
        $status = 'mine';
        $rs = rows('SELECT * FROM external_results WHERE user_id = ? OR partner_id = ? ORDER BY event_date DESC, id DESC', [$u['id'], $u['id']]);
    }
    return [
        'status' => $status,
        'counts' => $counts,
        'results' => external_list_out($rs),
        'rules' => ['places' => EXTERNAL_PLACES, 'base' => EXTERNAL_BASE, 'levels' => EXTERNAL_LEVELS, 'categories' => array_values(EXTERNAL_CATEGORIES), 'min_entrants' => EXTERNAL_MIN_ENTRANTS],
    ];
}

/**
 * Member submits (id 0) or corrects their result. Multipart fields plus optional "proof" image.
 * An admin can add a new result for a member (member_id): it needs no proof and is approved straight away.
 */
function external_save(int $id): array
{
    $u = require_user();
    $subject = $u;
    $byAdmin = false;
    if (!$id && $u['role'] === 'admin' && ($mid = (int) ext_in('member_id', 10))) {
        $subject = row('SELECT id, name FROM users WHERE id = ?', [$mid]) ?? fail(422, 'Pick the member.');
        $byAdmin = true;
    }
    $old = $id ? (row('SELECT * FROM external_results WHERE id = ?', [$id]) ?? fail(404, 'Result not found.')) : null;
    // The member who submitted a result can change it at any time (it goes back for approval);
    // an admin can change anyone's, and it keeps its review status.
    $adminEdit = $old && $u['role'] === 'admin' && (int) $old['user_id'] !== (int) $u['id'];
    if ($old && !$adminEdit && (int) $old['user_id'] !== (int) $u['id']) {
        fail(403, 'Only your own result can be changed.');
    }
    if ($adminEdit) {
        $subject = row('SELECT id, name FROM users WHERE id = ?', [(int) $old['user_id']]) ?? fail(404, 'Member not found.');
    }
    $data = [
        'tournament' => ext_in('tournament', 160),
        'organizer' => ext_in('organizer', 160),
        'event_date' => ext_in('event_date', 10),
        'category' => ext_in('category', 80),
        'level' => ext_in('level', 20),
        'format' => ext_in('format', 10),
        'placement' => ext_in('placement', 12),
        'entrants' => (int) ext_in('entrants', 6),
        'proof_link' => ext_in('proof_link', 500),
        'notes' => ext_in('notes', 1000),
        'partner_name' => '',
        'partner_id' => null,
    ];
    if ($data['tournament'] === '') {
        fail(422, 'Add the tournament name.');
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $data['event_date']) || $data['event_date'] > date('Y-m-d')) {
        fail(422, 'Pick the tournament date (it must be in the past).');
    }
    if (!in_array($data['category'], EXTERNAL_CATEGORIES, true)) {
        fail(422, "Pick the category: Women's, Men's or Mix.");
    }
    if (!isset(EXTERNAL_LEVELS[$data['level']])) {
        fail(422, 'Pick the category level.');
    }
    if (!in_array($data['format'], ['singles', 'doubles'], true)) {
        fail(422, 'Pick singles or doubles.');
    }
    if (!isset(EXTERNAL_PLACES[$data['placement']])) {
        fail(422, 'Pick your result.');
    }
    if ($data['entrants'] < 1 || $data['entrants'] > 1024) {
        fail(422, 'Add how many players or pairs entered your category.');
    }
    if ($data['proof_link'] !== '' && !preg_match('#^https?://#i', $data['proof_link'])) {
        fail(422, 'The proof link must start with https://');
    }
    if ($data['format'] === 'doubles') {
        $pid = (int) ext_in('partner_id', 10);
        if ($pid) {
            if ($pid === (int) $subject['id'] || !row('SELECT id FROM users WHERE id = ?', [$pid])) {
                fail(422, 'Pick your partner from the members list.');
            }
            $data['partner_id'] = $pid;
        } else {
            $data['partner_name'] = ext_in('partner_name', 100);
        }
    }
    $data['event_key'] = mb_strtolower(preg_replace('/\s+/', ' ', $data['tournament'])) . '|' . $data['event_date'] . '|'
        . mb_strtolower(preg_replace('/\s+/', ' ', $data['category'])) . '|' . $data['format'];
    if ($dup = external_duplicate((int) $subject['id'], $data['event_key'], $id)) {
        fail(409, 'This result is already approved for ' . ($byAdmin ? $subject['name'] : 'you') . ' (' . $dup['tournament'] . ', ' . $dup['event_date'] . ').');
    }
    $f = $_FILES['proof'] ?? null;
    if ($f && $f['error'] !== UPLOAD_ERR_NO_FILE) {
        if ($f['error'] !== UPLOAD_ERR_OK || $f['size'] > 10 * 1024 * 1024) {
            fail(422, 'That image is too big (max 10 MB).');
        }
        $data['proof_file'] = save_image($f['tmp_name'], EXTERNAL_DIR, 'ext-' . $subject['id'], 1600);
    }
    if (!$byAdmin && !$adminEdit && !($data['proof_file'] ?? $old['proof_file'] ?? null) && $data['proof_link'] === '') {
        fail(422, 'Add a photo or a link as proof (draw, results page, certificate…).');
    }
    $data += ['status' => $adminEdit ? $old['status'] : 'pending', 'updated_at' => now()];
    if ($adminEdit) {
        $data['points'] = $old['status'] === 'approved' ? external_points($data['format'], $data['placement'], $data['level'], $data['entrants']) : 0;
    } elseif ($old) {
        $data['points'] = 0;
    }
    if ($old) {
        if (isset($data['proof_file']) && $old['proof_file']) {
            @unlink(EXTERNAL_DIR . '/' . basename($old['proof_file']));
        }
        update('external_results', $id, $data);
    } else {
        $id = insert('external_results', $data + ['user_id' => (int) $subject['id'], 'created_at' => now()]);
    }
    if ($old) {
        sync_external_ledger($id);
    }
    if ($adminEdit) {
        $before = array_intersect_key($old, array_flip(['tournament', 'event_date', 'category', 'level', 'format', 'placement', 'entrants', 'points']));
        audit('external_edit', 'external', $id, $before, array_intersect_key($data, $before));
        activity('external', $u['name'] . ' edited the External Tournament result of ' . $subject['name'] . ': ' . EXTERNAL_PLACES[$data['placement']] . ' · ' . $data['tournament'], '#/members/' . $subject['id']);
        notify($data['tournament'], 'An admin updated your result: ' . EXTERNAL_PLACES[$data['placement']]
            . ($data['status'] === 'approved' ? ($data['points'] ? " ({$data['points']} RATA points)." : ' (no points).') : '.'), '#/me', array_filter([(int) $subject['id'], (int) $data['partner_id']]));
        return ['result' => external_list_out([row('SELECT * FROM external_results WHERE id = ?', [$id])])[0]];
    }
    if ($byAdmin) {
        $points = external_points($data['format'], $data['placement'], $data['level'], $data['entrants']);
        update('external_results', $id, ['status' => 'approved', 'points' => $points, 'reviewed_by' => (int) $u['id'], 'reviewed_at' => now()]);
        sync_external_ledger($id);
        audit('external_add', 'external', $id, null, ['member' => (int) $subject['id'], 'points' => $points]);
        activity('external', $u['name'] . ' added an External Tournament result for ' . $subject['name'] . ': ' . EXTERNAL_PLACES[$data['placement']] . ' · ' . $data['tournament'], '#/members/' . $subject['id']);
        notify($data['tournament'], 'An admin added your result: ' . EXTERNAL_PLACES[$data['placement']] . ($points ? " (+$points RATA points)." : '.'),
            '#/me', array_filter([(int) $subject['id'], (int) $data['partner_id']]));
        return ['result' => external_list_out([row('SELECT * FROM external_results WHERE id = ?', [$id])])[0]];
    }
    $admins = array_map('intval', array_column(rows("SELECT id FROM users WHERE role = 'admin'"), 'id'));
    notify('Tournament result to check', $u['name'] . ': ' . EXTERNAL_PLACES[$data['placement']] . ' · ' . $data['tournament'], '#/approvals', $admins);
    activity('external', $u['name'] . ($old ? ' updated' : ' submitted') . ' an External Tournament result: ' . EXTERNAL_PLACES[$data['placement']] . ' · ' . $data['tournament'], '#/approvals');
    return ['result' => external_list_out([row('SELECT * FROM external_results WHERE id = ?', [$id])])[0]];
}

/** Admin review. Body: {action: approve | reject | revise, note?} */
function external_review(int $id): array
{
    $admin = require_admin();
    $r = row('SELECT * FROM external_results WHERE id = ?', [$id]) ?? fail(404, 'Result not found.');
    $action = str_in('action', 10, true);
    $note = str_in('note', 500);
    $status = ['approve' => 'approved', 'reject' => 'rejected', 'revise' => 'needs_revision'][$action] ?? fail(422, 'Unknown action.');
    if ($status !== 'approved' && $note === '') {
        fail(422, $status === 'rejected' ? 'Say why it is rejected.' : 'Say what needs fixing.');
    }
    $points = $status === 'approved' ? external_points($r['format'], $r['placement'], $r['level'], (int) $r['entrants']) : 0;
    if ($status === 'approved' && ($dup = external_duplicate((int) $r['user_id'], $r['event_key'], $id))) {
        fail(409, 'Already approved for this member: result #' . $dup['id'] . ' (' . $dup['tournament'] . ').');
    }
    $pdo = db();
    $pdo->beginTransaction();
    try {
        update('external_results', $id, [
            'status' => $status, 'points' => $points, 'review_note' => $note,
            'reviewed_by' => (int) $admin['id'], 'reviewed_at' => now(), 'updated_at' => now(),
        ]);
        sync_external_ledger($id);
        audit('external_' . $action, 'external', $id, ['status' => $r['status'], 'points' => (int) $r['points']], ['status' => $status, 'points' => $points], $note);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    $who = array_filter([(int) $r['user_id'], (int) $r['partner_id']]);
    $msg = [
        'approved' => $points ? "Approved: +$points RATA points." : 'Approved. Fewer than ' . EXTERNAL_MIN_ENTRANTS . ' entrants in the category, so no RATA points.',
        'rejected' => 'Not approved: ' . $note,
        'needs_revision' => 'Please update it: ' . $note,
    ][$status];
    notify($r['tournament'], $msg, '#/me', $status === 'approved' ? $who : [(int) $r['user_id']]);
    return external_list();
}

/** Submitter withdraws a result that isn't approved; an admin can remove any (approved points are reversed). */
function external_delete(int $id): array
{
    $u = require_user();
    $r = row('SELECT * FROM external_results WHERE id = ?', [$id]) ?? fail(404, 'Result not found.');
    if ($u['role'] !== 'admin' && ((int) $r['user_id'] !== (int) $u['id'] || $r['status'] === 'approved')) {
        fail(403, 'Not allowed.');
    }
    q('DELETE FROM external_results WHERE id = ?', [$id]);
    sync_external_ledger($id);
    if ($r['proof_file']) {
        @unlink(EXTERNAL_DIR . '/' . basename($r['proof_file']));
    }
    return ['ok' => true];
}

function external_proof(int $id): never
{
    $u = require_user();
    $r = row('SELECT * FROM external_results WHERE id = ?', [$id]) ?? fail(404, 'Not found.');
    if (!in_array((int) $u['id'], [(int) $r['user_id'], (int) $r['partner_id']], true) && $u['role'] !== 'admin') {
        fail(403, 'Not allowed.');
    }
    $path = $r['proof_file'] ? EXTERNAL_DIR . '/' . basename($r['proof_file']) : '';
    if ($path === '' || !is_file($path)) {
        fail(404, 'No proof photo.');
    }
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: private, no-store');
    header('X-Content-Type-Options: nosniff');
    readfile($path);
    exit;
}

/** A member's external results for their profile: approved ones for everyone, all of them for the member and admins. */
function member_external(int $uid): array
{
    $u = current_user();
    $all = $u && ((int) $u['id'] === $uid || $u['role'] === 'admin');
    $rs = rows('SELECT * FROM external_results WHERE (user_id = ? OR partner_id = ?)' . ($all ? '' : " AND status = 'approved'") . ' ORDER BY event_date DESC, id DESC', [$uid, $uid]);
    return external_list_out($rs);
}
