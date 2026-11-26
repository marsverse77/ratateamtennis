<?php
// Coach schedule and slot requests.
// Members pick an open slot on a coach's weekly schedule and ask for a Hitting or Coaching session there.
// Flow: requested (member) -> priced (admin quotes a price) -> approved (member accepts: a private session is
// created and the slot is blocked; the member then uploads the transfer proof on that session) -> paid
// (the session's payment is confirmed). Side exits: rejected (admin), declined (member says no to the price),
// cancelled (member withdraws before accepting), taken (someone else's request for the same time was accepted).

// Slot statuses (from the coach schedule sheet) and whether a member can request them.
const SLOT_STATUSES = [
    'AVAILABLE_FIXED' => 'Available · court set',
    'AVAILABLE_FIND_COURT' => 'Available · find your own court',
    'AVAILABLE_PRIVATE_OR_KUYY' => 'Available · private (or Kuyy)',
    'BLOCKED_REGULAR' => 'Blocked · regular / program',
    'BLOCKED_KUYY' => 'Blocked · Kuyy',
    'NOT_AVAILABLE' => 'Not available',
    'OFF' => 'Off',
];
const SLOT_OPEN = ['AVAILABLE_FIXED', 'AVAILABLE_FIND_COURT', 'AVAILABLE_PRIVATE_OR_KUYY'];
const REQUEST_KINDS = ['hitting' => 'Hitting', 'coaching' => 'Coaching'];
const REQUEST_OPEN = ['requested', 'priced'];
// How far ahead members can request (weeks, counting this one).
const SCHEDULE_WEEKS = 8;

function slot_out(array $s): array
{
    return [
        'id' => (int) $s['id'],
        'coach_key' => $s['coach_key'],
        'day' => (int) $s['day_iso'],
        'start' => $s['start_time'],
        'end' => $s['end_time'],
        'court' => $s['court'],
        'status' => $s['status'],
        'program' => $s['program'],
        'note' => $s['note'],
        'open' => in_array($s['status'], SLOT_OPEN, true),
    ];
}

function request_out(array $r, bool $full): array
{
    $out = [
        'id' => (int) $r['id'],
        'slot_id' => (int) $r['slot_id'],
        'coach_key' => $r['coach_key'],
        'coach' => $r['coach'] ?? '',
        'date' => $r['date'],
        'start' => $r['start_time'],
        'end' => $r['end_time'],
        'status' => request_state($r),
        'mine' => (int) $r['user_id'] === (int) (current_user()['id'] ?? 0),
    ];
    if ($full) {
        $out += [
            'user' => ['id' => (int) $r['user_id'], 'name' => $r['user_name'] ?? ''],
            'name' => $r['name'],
            'pax' => (int) $r['pax'],
            'kind' => $r['kind'],
            'kind_label' => REQUEST_KINDS[$r['kind']] ?? $r['kind'],
            'court' => $r['court'],
            'note' => $r['note'],
            'price' => (int) $r['price'],
            'admin_note' => $r['admin_note'],
            'bank' => ['name' => $r['bank_name'], 'account' => $r['bank_account'], 'holder' => $r['bank_holder']],
            'session_id' => $r['session_id'] ? (int) $r['session_id'] : null,
            'pay_status' => $r['pay_status'] ?? null,
            'created_at' => $r['created_at'],
            'priced_at' => $r['priced_at'],
            'decided_at' => $r['decided_at'],
            'quote_token' => $r['status'] === 'priced' ? booking_quote_token($r) : null,
        ];
    }
    return $out;
}

/** The stored status, with "paid" for an approved request whose session payment is confirmed. */
function request_state(array $r): string
{
    if ($r['status'] === 'approved' && ($r['pay_status'] ?? '') === 'approved') {
        return 'paid';
    }
    return $r['status'];
}

/** Requests with the coach name and the requester's payment on the session it became. */
function request_rows(string $where, array $args): array
{
    return rows("SELECT r.*, u.name AS user_name, c.coach, g.pay_status
                 FROM slot_requests r
                 JOIN users u ON u.id = r.user_id
                 LEFT JOIN (SELECT coach_key, MIN(coach) AS coach FROM coach_slots GROUP BY coach_key) c ON c.coach_key = r.coach_key
                 LEFT JOIN registrations g ON g.session_id = r.session_id AND g.user_id = r.user_id
                 WHERE $where ORDER BY r.date, r.start_time, r.id", $args);
}

function coaches(): array
{
    return array_map(fn($c) => ['key' => $c['coach_key'], 'name' => $c['coach']],
        rows('SELECT coach_key, MIN(coach) AS coach, MIN(id) AS first_id FROM coach_slots GROUP BY coach_key ORDER BY first_id'));
}

function monday(string $date): string
{
    $t = strtotime($date);
    return date('Y-m-d', strtotime('-' . ((int) date('N', $t) - 1) . ' days', $t));
}

/** GET schedule?coach=key&week=YYYY-MM-DD: one coach's slots for a week, with the bookings on it. */
function schedule(): array
{
    $u = current_user();
    $admin = ($u['role'] ?? '') === 'admin';
    $coaches = coaches();
    $coach = (string) ($_GET['coach'] ?? '');
    if (!in_array($coach, array_column($coaches, 'key'), true)) {
        $coach = $coaches[0]['key'] ?? '';
    }
    $thisWeek = monday(date('Y-m-d'));
    $week = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($_GET['week'] ?? '')) ? monday($_GET['week']) : $thisWeek;
    $last = date('Y-m-d', strtotime($thisWeek . ' +' . (SCHEDULE_WEEKS - 1) . ' weeks'));
    if ($week < $thisWeek) {
        $week = $thisWeek;
    }
    if ($week > $last) {
        $week = $last;
    }
    $dates = [];
    for ($i = 0; $i < 7; $i++) {
        $dates[] = date('Y-m-d', strtotime("$week +$i days"));
    }
    $slots = array_map('slot_out', rows('SELECT * FROM coach_slots WHERE coach_key = ? ORDER BY day_iso, start_time', [$coach]));
    // Taken times: accepted requests. Pending ones: the member's own (and, for admins, everyone's).
    $reqs = request_rows("r.coach_key = ? AND r.date BETWEEN ? AND ? AND r.status IN ('requested', 'priced', 'approved')", [$coach, $dates[0], $dates[6]]);
    $booked = [];
    $pending = [];
    foreach ($reqs as $r) {
        if ($r['status'] === 'approved') {
            $booked[] = ['date' => $r['date'], 'start' => $r['start_time'], 'end' => $r['end_time'], 'mine' => (int) $r['user_id'] === (int) ($u['id'] ?? 0),
                'session_id' => $admin || (int) $r['user_id'] === (int) ($u['id'] ?? 0) ? (int) $r['session_id'] : null];
        } elseif ($admin || (int) $r['user_id'] === (int) ($u['id'] ?? 0)) {
            $pending[] = request_out($r, true);
        }
    }
    // An assigned session consumes the same coach capacity, whatever channel created it.
    $visibleRequests = [];
    foreach ($reqs as $r) {
        if ($admin || (int) $r['user_id'] === (int) ($u['id'] ?? 0)) {
            $visibleRequests[(int) $r['id']] = true;
        }
    }
    foreach ([...coach_session_bookings($coach, $dates[0], $dates[6]), ...coach_recurring_kuyy_bookings($coach, $dates[0], $dates[6])] as $busy) {
        $mine = $busy['request_id'] && isset($visibleRequests[$busy['request_id']]) && !$admin;
        $booked[] = ['date' => $busy['date'], 'start' => $busy['start'], 'end' => $busy['end'], 'mine' => (bool) $mine,
            'session_id' => $admin || $mine ? $busy['session_id'] : null]
            + ($busy['channel'] === 'kuyy' ? ['channel' => 'kuyy'] : []);
    }
    return [
        'coaches' => $coaches,
        'coach' => $coach,
        'week' => $week,
        'this_week' => $thisWeek,
        'last_week' => $last,
        'dates' => $dates,
        'today' => date('Y-m-d'),
        'now' => date('H:i'),
        'slots' => $slots,
        'booked' => $booked,
        'pending' => $pending,
        'statuses' => SLOT_STATUSES,
        'kinds' => REQUEST_KINDS,
        'venues' => array_values(array_filter(array_column(rows("SELECT DISTINCT court FROM coach_slots WHERE court <> '' ORDER BY court"), 'court'))),
        'open_requests' => $admin ? (int) q("SELECT COUNT(*) FROM slot_requests WHERE status = 'requested'")->fetchColumn() : 0,
    ];
}

/** Admin: change one slot of the weekly schedule. Body: {status, court, program, note} */
function slot_edit(int $id): array
{
    require_admin();
    return booking_write(fn() => slot_edit_locked($id));
}

function slot_edit_locked(int $id): array
{
    $slot = row('SELECT * FROM coach_slots WHERE id = ?', [$id]) ?? fail(404, 'Slot not found.');
    $status = str_in('status', 30, true);
    if (!isset(SLOT_STATUSES[$status])) {
        fail(422, 'Unknown slot status.');
    }
    $data = ['status' => $status, 'court' => str_in('court', 100), 'program' => str_in('program', 100), 'note' => str_in('note', 255)];
    if ($status === 'AVAILABLE_FIXED' && $data['court'] === '') {
        fail(422, 'Set the court for a fixed-court slot.');
    }
    booking_validate_recurring_kuyy($slot, $data);
    audit('slot_edit', 'slot', $id, $slot, $data);
    update('coach_slots', $id, $data);
    if ($slot['status'] !== $status || $slot['court'] !== $data['court'] || $slot['program'] !== $data['program']) {
        // An old quote must be reviewed again after its availability/terms change. Approved/paid
        // bookings are historical commitments and are deliberately left untouched.
        q("UPDATE slot_requests SET status = 'requested', priced_at = NULL, priced_by = NULL
           WHERE slot_id = ? AND status = 'priced'", [$id]);
    }
    return ['slot' => slot_out(row('SELECT * FROM coach_slots WHERE id = ?', [$id]))];
}

/** Time ranges overlap (HH:MM strings, end not included). */
function times_overlap(string $a1, string $a2, string $b1, string $b2): bool
{
    return $a1 < $b2 && $b1 < $a2;
}

/** A committed private booking OR assigned session occupying this coach, if any. */
function slot_taken(string $coach, string $date, string $start, string $end, int $except = 0, int $exceptSession = 0): ?array
{
    foreach (rows("SELECT * FROM slot_requests WHERE coach_key = ? AND date = ? AND status = 'approved' AND id <> ?", [$coach, $date, $except]) as $r) {
        if (times_overlap($start, $end, $r['start_time'], $r['end_time'])) {
            return $r;
        }
    }
    foreach (coach_session_bookings($coach, $date, $date, $exceptSession, $except) as $busy) {
        if (times_overlap($start, $end, $busy['start'], $busy['end'])) {
            return $busy;
        }
    }
    return null;
}

/** Member: ask for a slot. Body: {slot_id, date, name, pax, kind, court, note} */
function request_create(): array
{
    require_user();
    return booking_write(fn() => request_create_locked());
}

function request_create_locked(): array
{
    $u = require_user();
    $slot = row('SELECT * FROM coach_slots WHERE id = ?', [int_in('slot_id', 1, PHP_INT_MAX)]) ?? fail(404, 'Slot not found.');
    $date = str_in('date', 10, true);
    booking_validate_slot($slot, $date);
    if ($date > date('Y-m-d', strtotime(monday(date('Y-m-d')) . ' +' . (SCHEDULE_WEEKS * 7 - 1) . ' days'))) {
        fail(422, 'That date is too far ahead.');
    }
    if (slot_taken($slot['coach_key'], $date, $slot['start_time'], $slot['end_time'])) {
        fail(409, 'Sorry, this time was just booked.');
    }
    booking_validate_private_channel($slot['coach_key'], $date, $slot['start_time'], $slot['end_time']);
    if (row("SELECT id FROM slot_requests WHERE user_id = ? AND slot_id = ? AND date = ? AND status IN ('requested', 'priced')", [$u['id'], $slot['id'], $date])) {
        fail(409, 'You already requested this time. We will reply with the price soon.');
    }
    $kind = str_in('kind', 12, true);
    if (!isset(REQUEST_KINDS[$kind])) {
        fail(422, 'Choose Hitting or Coaching.');
    }
    // A slot with a set court keeps it; otherwise the member says where they will play.
    $court = $slot['status'] !== 'AVAILABLE_FIND_COURT' && $slot['court'] !== '' ? $slot['court'] : str_in('court', 100);
    if ($court === '') {
        fail(422, 'Tell us which court you will play on.');
    }
    $name = str_in('name', 100, true);
    $id = insert('slot_requests', [
        'user_id' => (int) $u['id'],
        'slot_id' => (int) $slot['id'],
        'coach_key' => $slot['coach_key'],
        'date' => $date,
        'start_time' => $slot['start_time'],
        'end_time' => $slot['end_time'],
        'name' => $name,
        'pax' => int_in('pax', 1, 20, 1),
        'kind' => $kind,
        'court' => $court,
        'note' => str_in('note', 500),
        'status' => 'requested',
        'created_at' => now(),
    ]);
    activity('request', $u['name'] . ' requested ' . REQUEST_KINDS[$kind] . ' with ' . $slot['coach'] . ' · '
        . date('D j M', strtotime($date)) . ' ' . $slot['start_time'], '#/requests', true);
    return ['request' => request_out(request_rows('r.id = ?', [$id])[0], true)];
}

/** GET requests?status=: admins see every request, members their own. */
function requests_list(): array
{
    $u = require_user();
    $admin = $u['role'] === 'admin';
    $status = (string) ($_GET['status'] ?? '');
    $where = $admin ? '1 = 1' : 'r.user_id = ?';
    $args = $admin ? [] : [(int) $u['id']];
    $list = array_map(fn($r) => request_out($r, true), request_rows($where, $args));
    $counts = [];
    foreach ($list as $r) {
        $counts[$r['status']] = ($counts[$r['status']] ?? 0) + 1;
    }
    if ($status !== '') {
        $list = array_values(array_filter($list, fn($r) => $status === 'open' ? in_array($r['status'], REQUEST_OPEN, true)
            : ($status === 'closed' ? !in_array($r['status'], [...REQUEST_OPEN, 'approved', 'paid'], true) : $r['status'] === $status)));
    }
    // Newest activity first for closed lists; open ones stay in date order so the next one is on top.
    if ($status === 'closed') {
        $list = array_reverse($list);
    }
    $bank = $admin ? row("SELECT bank_name, bank_account, bank_holder FROM play_sessions WHERE bank_account <> '' ORDER BY id DESC LIMIT 1") : null;
    return ['requests' => $list, 'counts' => $counts, 'bank' => $bank, 'kinds' => REQUEST_KINDS];
}

/**
 * Body: {action, ...}
 * Admin:  price {price, note?, bank_name?, bank_account?, bank_holder?} (also re-prices), reject {note?}
 * Member: accept (creates the private session and blocks the slot), decline, cancel
 */
function request_action(int $id): array
{
    require_user();
    return booking_write(fn() => request_action_locked($id));
}

function request_action_locked(int $id): array
{
    $u = require_user();
    $admin = $u['role'] === 'admin';
    $r = row('SELECT * FROM slot_requests WHERE id = ?', [$id]) ?? fail(404, 'Request not found.');
    $mine = (int) $r['user_id'] === (int) $u['id'];
    $action = str_in('action', 12, true);
    $note = str_in('note', 500);
    $when = date('D j M', strtotime($r['date'])) . ' ' . $r['start_time'];
    switch ($action) {
        case 'price':
            require_admin();
            if (!in_array($r['status'], REQUEST_OPEN, true)) {
                fail(409, 'This request is already closed.');
            }
            booking_assert_no_session($id);
            booking_request_slot($r);
            booking_validate_private_channel($r['coach_key'], $r['date'], $r['start_time'], $r['end_time']);
            if (slot_taken($r['coach_key'], $r['date'], $r['start_time'], $r['end_time'], $id)) {
                fail(409, 'This time is already booked by another request.');
            }
            $price = int_in('price', 0, 100000000);
            $bank = ['bank_name' => str_in('bank_name', 60), 'bank_account' => str_in('bank_account', 40), 'bank_holder' => str_in('bank_holder', 100)];
            if ($price > 0 && $bank['bank_account'] === '') {
                fail(422, 'Add the bank account number so the member knows where to transfer.');
            }
            update('slot_requests', $id, ['status' => 'priced', 'price' => $price, 'admin_note' => $note, 'priced_by' => (int) $u['id'], 'priced_at' => now()] + $bank);
            notify('Your request has a price', REQUEST_KINDS[$r['kind']] . ' · ' . $when . ': ' . rupiah_text($price) . '. Tap to accept.', '#/schedule?requests', [(int) $r['user_id']]);
            break;
        case 'reject':
            require_admin();
            if (!in_array($r['status'], REQUEST_OPEN, true)) {
                fail(409, 'This request is already closed.');
            }
            booking_assert_no_session($id);
            update('slot_requests', $id, ['status' => 'rejected', 'admin_note' => $note, 'decided_at' => now()]);
            notify('Request not available', REQUEST_KINDS[$r['kind']] . ' · ' . $when . ($note !== '' ? ': ' . $note : ''), '#/schedule?requests', [(int) $r['user_id']]);
            break;
        case 'accept':
            if (!$mine) {
                fail(403, 'Only the member who asked can accept.');
            }
            if ($r['status'] !== 'priced') {
                fail(409, $r['status'] === 'requested' ? 'Wait for the admin to send the price first.' : 'This request is already closed.');
            }
            booking_assert_no_session($id);
            if (!hash_equals(booking_quote_token($r), str_in('quote_token', 64))) {
                fail(409, 'The offer changed or needs refreshing. Refresh and review the latest price before accepting.');
            }
            booking_request_slot($r);
            booking_validate_private_channel($r['coach_key'], $r['date'], $r['start_time'], $r['end_time']);
            if (slot_taken($r['coach_key'], $r['date'], $r['start_time'], $r['end_time'], $id)) {
                fail(409, 'Sorry, this time was just booked by someone else.');
            }
            $sid = request_session($r, $u);
            update('slot_requests', $id, ['status' => 'approved', 'session_id' => $sid, 'decided_at' => now()]);
            // Other open requests for the same coach and time can't happen any more.
            foreach (rows("SELECT * FROM slot_requests WHERE coach_key = ? AND date = ? AND status IN ('requested', 'priced') AND id <> ?", [$r['coach_key'], $r['date'], $id]) as $o) {
                if (times_overlap($r['start_time'], $r['end_time'], $o['start_time'], $o['end_time'])) {
                    update('slot_requests', (int) $o['id'], ['status' => 'taken', 'decided_at' => now()]);
                    notify('Time already booked', 'Your request for ' . date('D j M', strtotime($o['date'])) . ' ' . $o['start_time'] . ' was booked by someone else. Pick another time.', '#/schedule?requests', [(int) $o['user_id']]);
                }
            }
            activity('request', $u['name'] . ' accepted ' . rupiah_text((int) $r['price']) . ' for ' . REQUEST_KINDS[$r['kind']] . ' · ' . $when, "#/sessions/$sid", true);
            return ['request' => request_out(request_rows('r.id = ?', [$id])[0], true), 'session_id' => $sid];
        case 'decline':
        case 'cancel':
            if (!$mine) {
                fail(403, 'Only the member who asked can do this.');
            }
            if (!in_array($r['status'], $action === 'decline' ? ['priced'] : REQUEST_OPEN, true)) {
                fail(409, 'This request is already closed.');
            }
            booking_assert_no_session($id);
            update('slot_requests', $id, ['status' => $action === 'decline' ? 'declined' : 'cancelled', 'decided_at' => now()]);
            activity('request', $u['name'] . ($action === 'decline' ? ' declined the price for ' : ' cancelled their request for ') . $when, '#/requests', true);
            break;
        default:
            fail(422, 'Unknown action.');
    }
    return ['request' => request_out(request_rows('r.id = ?', [$id])[0], $admin || $mine)];
}

/** Creates the private session for an accepted request, with the member in it and the price to pay. */
function request_session(array $r, array $u): int
{
    $slot = row('SELECT * FROM coach_slots WHERE id = ?', [$r['slot_id']]);
    $coach = $slot['coach'] ?? '';
    $coaching = $r['kind'] === 'coaching';
    $pax = max(1, (int) $r['pax']);
    $desc = "Private request by {$r['name']} · {$pax} pax · with {$coach}.";
    if ($r['note'] !== '') {
        $desc .= "\n" . $r['note'];
    }
    $sid = insert('play_sessions', [
        'title' => ($coaching ? 'Private Coaching' : 'Private Hitting') . ' · ' . $r['name'],
        'date' => $r['date'],
        'start_time' => $r['start_time'],
        'end_time' => $r['end_time'],
        'location' => $r['court'],
        'description' => $desc,
        'courts' => 1,
        'max_players' => $pax,
        'format' => array_key_first(FORMATS),
        'scoring' => 'total',
        'target' => 16,
        'match_minutes' => 15,
        'counts_overall' => 0,
        'point_system' => 'americano',
        'fee' => (int) $r['price'],
        'bank_name' => $r['bank_name'],
        'bank_account' => $r['bank_account'],
        'bank_holder' => $r['bank_holder'],
        'activity' => $coaching ? 'coaching' : 'hitting',
        'coach_names' => $coaching ? $coach : '',
        'with_games' => 0,
        'hit_format' => $coaching ? '' : array_key_first(HIT_FORMATS),
        'hit_level' => $coaching ? '' : array_key_first(HIT_LEVELS),
        'hit_partners' => $coaching ? '' : 'free',
        'hit_balls' => $coaching ? '' : 'provided',
        'status' => 'open',
        'rounds' => 0,
        'rule_version' => 2,
        'request_id' => (int) $r['id'],
        'schedule_coach_keys' => $r['coach_key'],
        'schedule_channel' => 'private',
        'created_at' => now(),
    ]);
    // The member who asked holds the spot; the whole price is theirs to pay.
    insert('registrations', [
        'session_id' => $sid,
        'user_id' => (int) $u['id'],
        'status' => 'confirmed',
        'pay_status' => (int) $r['price'] > 0 ? 'none' : 'approved',
        'method' => (int) $r['price'] > 0 ? '' : 'free',
        'created_at' => now(),
    ]);
    return $sid;
}

/** Private (requested) sessions are only for the member who asked, and admins. */
function session_is_private_for(array $s, ?array $u): bool
{
    if (empty($s['request_id'])) {
        return false;
    }
    if (($u['role'] ?? '') === 'admin') {
        return false;
    }
    return !$u || !row('SELECT id FROM slot_requests WHERE id = ? AND user_id = ?', [(int) $s['request_id'], (int) $u['id']]);
}
