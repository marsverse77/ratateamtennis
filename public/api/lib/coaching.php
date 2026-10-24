<?php
// Coaching loyalty (spec v2, P3): confirmed paid attendance counts toward rewards. Never RATA points.

const COACHING_THRESHOLD = 30;
const ATTENDANCE = ['paid' => 'Paid · attended', 'free' => 'Free reward session', 'absent' => 'Absent'];
const REWARD_KINDS = ['coaching' => 'Free coaching session', 'souvenir' => 'Souvenir'];

function is_coach(?array $u): bool
{
    return $u && in_array($u['role'], ['admin', 'coach'], true);
}

function require_coach(): array
{
    $u = require_user();
    if (!is_coach($u)) {
        fail(403, 'Only coaches and admins can do this.');
    }
    return $u;
}

/**
 * Coach or admin confirms who attended a coaching session. Body: {attendance: {user_id: paid | free | absent | ""}}
 * Only paid attendance counts toward rewards; a free (reward) session does not.
 */
function session_attendance(int $id): array
{
    $u = require_user();
    $s = get_session($id);
    if (!can_take_attendance($s, $u)) {
        fail(403, 'Only the coach and admins can do this.');
    }
    if ($s['activity'] !== 'coaching') {
        fail(409, 'Attendance is only for coaching sessions.');
    }
    $players = session_players($id);
    foreach ((array) (input()['attendance'] ?? []) as $uid => $status) {
        $uid = (int) $uid;
        if (!in_array($uid, $players, true)) {
            fail(422, 'Only players registered for this session can be marked.');
        }
        if ($status === '' || $status === null) {
            q('DELETE FROM coaching_attendance WHERE session_id = ? AND user_id = ?', [$id, $uid]);
            continue;
        }
        if (!isset(ATTENDANCE[$status])) {
            fail(422, 'Unknown attendance.');
        }
        $row = row('SELECT id, status FROM coaching_attendance WHERE session_id = ? AND user_id = ?', [$id, $uid]);
        if ($row && $row['status'] === $status) {
            continue;
        }
        $data = ['status' => $status, 'confirmed_by' => (int) $u['id'], 'confirmed_at' => now()];
        audit('attendance', 'session', $id, ['user' => $uid, 'status' => $row['status'] ?? null], ['user' => $uid, 'status' => $status]);
        if ($row) {
            update('coaching_attendance', (int) $row['id'], $data);
        } else {
            insert('coaching_attendance', $data + ['session_id' => $id, 'user_id' => $uid]);
        }
    }
    return session_detail($id);
}

/** Coaches and admins, and the members named as this session's coaches, confirm attendance. */
function can_take_attendance(array $s, ?array $u): bool
{
    return is_coach($u) || ($u && in_array((int) $u['id'], session_coach_ids($s), true));
}

/** Attendance of a coaching session: everything for coaches and admins, only your own row for a player. */
function attendance_out(array $s): ?array
{
    if ($s['activity'] !== 'coaching') {
        return null;
    }
    $u = current_user();
    $rows = array_column(rows('SELECT user_id, status FROM coaching_attendance WHERE session_id = ?', [$s['id']]), 'status', 'user_id');
    if (!can_take_attendance($s, $u)) {
        return ['mine' => $u ? ($rows[(int) $u['id']] ?? null) : null, 'labels' => ATTENDANCE];
    }
    return ['all' => (object) $rows, 'labels' => ATTENDANCE];
}

/** A member's coaching wallet: paid attendance, rewards earned, used and still available. */
function coaching_wallet(int $uid): array
{
    $paid = (int) q("SELECT COUNT(*) FROM coaching_attendance WHERE user_id = ? AND status = 'paid'", [$uid])->fetchColumn();
    $used = (int) q("SELECT COUNT(*) FROM reward_redemptions WHERE user_id = ? AND status <> 'cancelled'", [$uid])->fetchColumn();
    $earned = intdiv($paid, COACHING_THRESHOLD);
    return [
        'paid' => $paid,
        'threshold' => COACHING_THRESHOLD,
        'progress' => $paid % COACHING_THRESHOLD,
        'to_next' => COACHING_THRESHOLD - $paid % COACHING_THRESHOLD,
        'earned' => $earned,
        'redeemed' => $used,
        'available' => max(0, $earned - $used),
    ];
}

function redemption_out(array $r, array $names): array
{
    return [
        'id' => (int) $r['id'],
        'user' => ['id' => (int) $r['user_id'], 'name' => $names[(int) $r['user_id']] ?? 'Member'],
        'kind' => $r['kind'],
        'label' => REWARD_KINDS[$r['kind']] ?? $r['kind'],
        'status' => $r['status'],
        'note' => $r['note'],
        'created_at' => $r['created_at'],
        'handled_at' => $r['handled_at'],
    ];
}

/** Wallet plus reward history, for the member themself, coaches and admins. */
function member_coaching(int $uid): ?array
{
    $u = current_user();
    if (!$u || ((int) $u['id'] !== $uid && !is_coach($u))) {
        return null;
    }
    $rs = rows('SELECT * FROM reward_redemptions WHERE user_id = ? ORDER BY id DESC', [$uid]);
    return coaching_wallet($uid) + ['kinds' => REWARD_KINDS, 'redemptions' => array_map(fn($r) => redemption_out($r, names([$uid])), $rs)];
}

/** Member claims an earned reward. Body: {kind: coaching | souvenir} */
function reward_claim(): array
{
    $u = require_user();
    $kind = str_in('kind', 20, true);
    if (!isset(REWARD_KINDS[$kind])) {
        fail(422, 'Pick free coaching or a souvenir.');
    }
    if (coaching_wallet((int) $u['id'])['available'] < 1) {
        fail(409, 'No reward available yet. Every ' . COACHING_THRESHOLD . ' paid coaching sessions earn one.');
    }
    insert('reward_redemptions', ['user_id' => (int) $u['id'], 'kind' => $kind, 'created_at' => now()]);
    $admins = array_map('intval', array_column(rows("SELECT id FROM users WHERE role = 'admin'"), 'id'));
    notify('Reward claimed', $u['name'] . ': ' . REWARD_KINDS[$kind], '#/approvals?status=rewards', $admins);
    activity('reward', $u['name'] . ' claimed a reward: ' . REWARD_KINDS[$kind], '#/approvals?status=rewards');
    return ['coaching' => member_coaching((int) $u['id'])];
}

/** Admin list of reward claims (?status=requested by default). */
function rewards_list(): array
{
    require_admin();
    $status = in_array($_GET['status'] ?? '', ['requested', 'given', 'cancelled'], true) ? $_GET['status'] : 'requested';
    $rs = rows('SELECT * FROM reward_redemptions WHERE status = ? ORDER BY id DESC', [$status]);
    $names = names(array_map(fn($r) => (int) $r['user_id'], $rs));
    return ['status' => $status, 'rewards' => array_map(fn($r) => redemption_out($r, $names), $rs)];
}

/** Admin marks a claim as given or cancels it (the reward goes back to the wallet). Body: {action: give | cancel, note?} */
function reward_handle(int $id): array
{
    $admin = require_admin();
    $r = row('SELECT * FROM reward_redemptions WHERE id = ?', [$id]) ?? fail(404, 'Claim not found.');
    $status = ['give' => 'given', 'cancel' => 'cancelled'][str_in('action', 10, true)] ?? fail(422, 'Unknown action.');
    audit('reward_' . $status, 'reward', $id, ['status' => $r['status']], ['status' => $status]);
    update('reward_redemptions', $id, ['status' => $status, 'note' => str_in('note', 255), 'handled_by' => (int) $admin['id'], 'handled_at' => now()]);
    notify('Your reward', $status === 'given' ? REWARD_KINDS[$r['kind']] . ' is ready. Enjoy!' : 'Your reward claim was cancelled and is back in your wallet.', '#/me', [(int) $r['user_id']]);
    return rewards_list();
}
