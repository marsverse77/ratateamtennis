<?php
// One calendar for private requests and coach assignments on ordinary/Kuyy sessions.

/**
 * Serialize ALL calendar writers before their first critical read. The existing schema row is a
 * database-wide mutex: an InnoDB row lock on MySQL, a writer lock on SQLite. A no-op UPDATE is
 * deliberate; taking a deferred transaction and reading first leaves a stale snapshot/race.
 * Keep this transaction short; defer notifications and destructive file cleanup until commit.
 */
function booking_write(callable $write): array
{
    $pdo = db();
    if ($pdo->inTransaction()) {
        throw new LogicException('Calendar writes must start their own locked transaction.');
    }
    $after = $GLOBALS['bcs_after'] ?? [];
    $pdo->beginTransaction();
    try {
        $pdo->exec("UPDATE meta SET v = v WHERE k = 'schema'");
        $result = $write();
        $pdo->commit();
        return $result;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        // notify() queues work after the HTTP response; failed transactions must not send it.
        $GLOBALS['bcs_after'] = $after;
        if ($e instanceof PDOException && (in_array((int) ($e->errorInfo[1] ?? 0), [5, 6, 1205, 1213], true)
            || $e->getCode() === '40001')) {
            fail(409, 'The schedule is being updated. Please refresh and try again.');
        }
        throw $e;
    }
}

function booking_date_valid(string $date): bool
{
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)) {
        return false;
    }
    $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
    return $parsed && $parsed->format('Y-m-d') === $date;
}

function booking_time_valid(string $time): bool
{
    return (bool) preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/D', $time);
}

/** Fresh template validation; requests are snapshots, not reservations of an old template. */
function booking_validate_slot(array $slot, string $date, ?array $request = null): void
{
    if (!in_array($slot['status'], SLOT_OPEN, true)) {
        fail(409, 'This time is not open for requests.');
    }
    if (!booking_date_valid($date) || (int) date('N', strtotime($date)) !== (int) $slot['day_iso']) {
        fail(422, 'That date does not match the slot.');
    }
    $start = $slot['start_time'];
    $end = $slot['end_time'];
    if (!booking_time_valid($start) || !booking_time_valid($end) || $start >= $end
        || $start < '06:00' || $end > '22:00' || strtotime($end) - strtotime($start) > 3600) {
        fail(409, 'This slot needs to be corrected by an admin.');
    }
    if ($date < date('Y-m-d') || ($date === date('Y-m-d') && $start <= date('H:i'))) {
        fail($request ? 409 : 422, 'This time has already passed.');
    }
    if ($request) {
        foreach (['coach_key', 'start_time', 'end_time'] as $field) {
            if ($request[$field] !== $slot[$field]) {
                fail(409, 'The schedule changed. Please request the current slot again.');
            }
        }
        if ($slot['status'] !== 'AVAILABLE_FIND_COURT' && $slot['court'] !== '' && $slot['court'] !== $request['court']) {
            fail(409, 'The court changed. Please request the current slot again.');
        }
    }
    if ($slot['status'] === 'AVAILABLE_FIXED' && $slot['court'] === '') {
        fail(409, 'An admin must set the court before this slot can be requested.');
    }
}

function booking_request_slot(array $request): array
{
    $slot = row('SELECT * FROM coach_slots WHERE id = ?', [$request['slot_id']])
        ?? fail(409, 'This slot is no longer available.');
    booking_validate_slot($slot, $request['date'], $request);
    return $slot;
}

/** A pre-patch race may have changed request.status while leaving its private session in place. */
function booking_assert_no_session(int $requestId): void
{
    if (row('SELECT id FROM play_sessions WHERE request_id = ? LIMIT 1', [$requestId])) {
        fail(409, 'This request already has a private session. Ask an admin to review it.');
    }
}

/** Detect a stale confirmation screen, including same-second repricing or changed bank details. */
function booking_quote_token(array $r): string
{
    $terms = [];
    foreach (['id', 'user_id', 'slot_id', 'coach_key', 'date', 'start_time', 'end_time', 'court', 'name',
        'pax', 'kind', 'price', 'admin_note', 'bank_name', 'bank_account', 'bank_holder', 'priced_at'] as $field) {
        $terms[$field] = (string) ($r[$field] ?? '');
    }
    return hash('sha256', json_encode($terms, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

/** Exact legacy labels only. Never guess a member's identity from a substring or the time of day. */
function booking_coach_name(string $name): string
{
    return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $name)));
}

function session_legacy_schedule_keys(array $s): array
{
    $aliases = [];
    foreach (coaches() as $coach) {
        $aliases[booking_coach_name($coach['name'])] = $coach['key'];
        // The spreadsheet explicitly gives Degung & Jordy ONE grouped capacity.
        if ($coach['key'] === 'degung_jordy') {
            $aliases['degung'] = $aliases['jordy'] = 'degung_jordy';
        }
    }
    $names = array_filter(array_map('trim', explode(',', (string) ($s['coach_names'] ?? ''))));
    $ids = session_coach_ids($s);
    // v23 fields are a fallback for old manually imported sessions.
    if (!$ids && !empty($s['coach_id'])) {
        $ids[] = (int) $s['coach_id'];
    }
    if (!$names && !empty($s['coach_name'])) {
        $names[] = $s['coach_name'];
    }
    if ($ids) {
        $names = [...$names, ...array_column(rows('SELECT name FROM users WHERE id IN (' . implode(',', $ids) . ')'), 'name')];
    }
    $keys = [];
    foreach ($names as $name) {
        if (isset($aliases[booking_coach_name($name)])) {
            $keys[] = $aliases[booking_coach_name($name)];
        }
    }
    $keys = array_values(array_unique($keys));
    sort($keys);
    return $keys;
}

function session_schedule_keys(array $s): array
{
    // A real linked private session still occupies its coach even if an old race damaged request.status.
    if (!empty($s['request_id']) && ($r = row('SELECT coach_key FROM slot_requests WHERE id = ?', [(int) $s['request_id']]))) {
        return [$r['coach_key']];
    }
    $stored = $s['schedule_coach_keys'] ?? '';
    $keys = is_array($stored) ? $stored : array_filter(explode(',', $stored));
    // An explicit empty mapping is meaningful (a coach was unassigned). Old scalar coach_id/name
    // columns must not resurrect that assignment once stable metadata has been saved.
    $keys = $keys || !empty($s['schedule_channel']) ? array_values(array_unique($keys)) : session_legacy_schedule_keys($s);
    sort($keys);
    return $keys;
}

function session_schedule_channel(array $s): string
{
    if (!empty($s['request_id'])) {
        return 'private';
    }
    if (!empty($s['schedule_channel'])) {
        return $s['schedule_channel'];
    }
    // Compatibility for existing sessions only. New saves persist the explicit channel so renaming
    // a Kuyy event cannot accidentally release part of Anjas's participation window.
    return preg_match('/\bkuyy\b/iu', (string) ($s['title'] ?? '')) ? 'kuyy' : 'session';
}

/** Stable capacity/source metadata for newly saved sessions; no rewrite/backfill of old bookings. */
function session_schedule_fields(array $data, ?array $old): array
{
    $in = input();
    $known = array_column(coaches(), 'key');
    if (array_key_exists('schedule_coach_keys', $in)) {
        if (!is_array($in['schedule_coach_keys'])) {
            fail(422, 'Choose the coach schedules from the list.');
        }
        $keys = $in['schedule_coach_keys'];
        foreach ($keys as $key) {
            if (!is_string($key) || !in_array($key, $known, true)) {
                fail(422, 'Unknown coach schedule.');
            }
        }
        $keys = array_values(array_unique($keys));
    } else {
        $oldIds = $old ? session_coach_ids($old) : [];
        $newIds = session_coach_ids($data);
        sort($oldIds);
        sort($newIds);
        $sameCoaches = $old && $oldIds === $newIds && $data['coach_names'] === $old['coach_names'];
        if ($old && !empty($old['schedule_channel']) && !$sameCoaches) {
            fail(422, 'Refresh and select the coach schedules when changing assigned coaches.');
        }
        $keys = $sameCoaches ? session_schedule_keys($old) : [];
    }
    // Matching assigned coaches cannot be hidden by submitting an empty selection.
    $keys = array_values(array_unique([...$keys, ...session_legacy_schedule_keys($data)]));
    sort($keys);
    $channel = array_key_exists('schedule_channel', $in) ? str_in('schedule_channel', 12)
        : ($old ? session_schedule_channel($old) : session_schedule_channel($data));
    if (!in_array($channel, ['session', 'kuyy'], true) && !($old && !empty($old['request_id']) && $channel === 'private')) {
        fail(422, 'Choose Standard session or Kuyy.');
    }
    if ($channel === 'kuyy' && !$keys) {
        fail(422, 'Select the coach schedule assigned to Kuyy.');
    }
    return ['schedule_coach_keys' => implode(',', $keys), 'schedule_channel' => $channel];
}

/** Occupancy for one assigned coach. Anjas participates in part of the shared Kuyy event. */
function session_schedule_interval(array $s, string $coach, bool $validate = false): array
{
    $start = $s['start_time'];
    $end = $s['end_time'];
    if ($coach === 'anjas' && session_schedule_channel($s) === 'kuyy') {
        $window = match ((int) date('N', strtotime($s['date']))) {
            3 => ['19:30', '21:00'],
            5 => ['19:00', '21:00'],
            default => null,
        };
        if ($window && times_overlap($start, $end, $window[0], $window[1])) {
            [$start, $end] = $window;
        } elseif ($validate) {
            fail(409, 'Anjas can join Kuyy only Wednesday 19:30–21:00 or Friday 19:00–21:00 WITA.');
        }
        // Keep an out-of-policy legacy assignment occupied as recorded; do not erase old data.
    }
    return ['date' => $s['date'], 'start' => $start, 'end' => $end];
}

/** Actual session assignments, including private sessions left behind by a legacy race. */
function coach_session_bookings(string $coach, string $from, string $to, int $exceptSession = 0, int $exceptRequest = 0): array
{
    $busy = [];
    foreach (rows('SELECT * FROM play_sessions WHERE date BETWEEN ? AND ? AND id <> ?', [$from, $to, $exceptSession]) as $s) {
        if ($exceptRequest && (int) $s['request_id'] === $exceptRequest) {
            continue;
        }
        if (in_array($coach, session_schedule_keys($s), true)) {
            $busy[] = session_schedule_interval($s, $coach) + ['session_id' => (int) $s['id'], 'request_id' => (int) $s['request_id'],
                'channel' => session_schedule_channel($s)];
        }
    }
    return $busy;
}

/** An explicit weekly BLOCKED_KUYY is a recurring commitment, not merely a dual-use offer. */
function coach_recurring_kuyy_bookings(string $coach, string $from, string $to): array
{
    $slots = rows("SELECT * FROM coach_slots WHERE coach_key = ? AND status = 'BLOCKED_KUYY'", [$coach]);
    $busy = [];
    for ($date = $from; $date <= $to; $date = date('Y-m-d', strtotime($date . ' +1 day'))) {
        foreach ($slots as $slot) {
            if ((int) $slot['day_iso'] === (int) date('N', strtotime($date))) {
                $busy[] = session_schedule_interval($slot + ['date' => $date, 'schedule_channel' => 'kuyy'], $coach)
                    + ['session_id' => null, 'request_id' => 0, 'channel' => 'kuyy'];
            }
        }
    }
    return $busy;
}

function booking_validate_private_channel(string $coach, string $date, string $start, string $end): void
{
    foreach (coach_recurring_kuyy_bookings($coach, $date, $date) as $busy) {
        if (times_overlap($start, $end, $busy['start'], $busy['end'])) {
            fail(409, 'This coach is assigned to Kuyy at that time.');
        }
    }
}

/** Adding a recurring Kuyy commitment must not override already accepted dated bookings. */
function booking_validate_recurring_kuyy(array $slot, array $data): void
{
    if ($data['status'] !== 'BLOCKED_KUYY' || $slot['status'] === 'BLOCKED_KUYY') {
        return;
    }
    $sampleDate = date('Y-m-d', strtotime(monday(date('Y-m-d')) . ' +' . ((int) $slot['day_iso'] - 1) . ' days'));
    $sample = session_schedule_interval($slot + ['date' => $sampleDate, 'schedule_channel' => 'kuyy'], $slot['coach_key'], true);
    $future = rows("SELECT * FROM slot_requests WHERE coach_key = ? AND date >= ? AND status = 'approved'", [$slot['coach_key'], date('Y-m-d')]);
    foreach ($future as $r) {
        if ($r['date'] === date('Y-m-d') && $r['end_time'] <= date('H:i')) {
            continue;
        }
        if ((int) date('N', strtotime($r['date'])) === (int) $slot['day_iso']
            && times_overlap($sample['start'], $sample['end'], $r['start_time'], $r['end_time'])) {
            fail(409, 'An existing booking overlaps this recurring Kuyy assignment. Keep the booking or resolve it first.');
        }
    }
    // Existing Kuyy sessions are instances of this recurring marker, not a second assignment.
    foreach (coach_session_bookings($slot['coach_key'], date('Y-m-d'), '9999-12-31') as $busy) {
        if ($busy['date'] === date('Y-m-d') && $busy['end'] <= date('H:i')) {
            continue;
        }
        if ($busy['channel'] !== 'kuyy' && (int) date('N', strtotime($busy['date'])) === (int) $slot['day_iso']
            && times_overlap($sample['start'], $sample['end'], $busy['start'], $busy['end'])) {
            fail(409, 'An existing session overlaps this recurring Kuyy assignment. Keep the session or resolve it first.');
        }
    }
}

function booking_session_signature(array $s): array
{
    $signature = [];
    foreach (session_schedule_keys($s) as $coach) {
        $signature[$coach] = session_schedule_interval($s, $coach) + ['channel' => session_schedule_channel($s)];
    }
    return $signature;
}

/** Called inside booking_write(), before creating or modifying any assigned session. */
function booking_validate_session(array $data, ?array $old): void
{
    $candidate = $data + ($old ?? []);
    if ($old && !empty($old['request_id'])) {
        foreach (['date', 'start_time', 'end_time', 'location', 'activity', 'coach_ids', 'coach_names'] as $field) {
            if ((string) $data[$field] !== (string) $old[$field]) {
                fail(409, 'An accepted private booking cannot change its time, court or coach here. Cancel and request a new booking.');
            }
        }
        if ($data['schedule_coach_keys'] !== implode(',', session_schedule_keys($old)) || $data['schedule_channel'] !== 'private') {
            fail(409, 'The coach assignment of an accepted private booking cannot be changed.');
        }
    }
    // Allow harmless edits of grandfathered sessions, even if a legacy conflict already exists.
    if ($old && booking_session_signature($candidate) === booking_session_signature($old)) {
        return;
    }
    foreach (session_schedule_keys($candidate) as $coach) {
        $time = session_schedule_interval($candidate, $coach, true);
        if (slot_taken($coach, $time['date'], $time['start'], $time['end'], (int) ($old['request_id'] ?? 0), (int) ($old['id'] ?? 0))) {
            fail(409, 'This coach is already booked for that time.');
        }
        if (session_schedule_channel($candidate) !== 'kuyy') {
            foreach (coach_recurring_kuyy_bookings($coach, $time['date'], $time['date']) as $busy) {
                if (times_overlap($time['start'], $time['end'], $busy['start'], $busy['end'])) {
                    fail(409, 'This coach is assigned to Kuyy at that time.');
                }
            }
        }
    }
}
