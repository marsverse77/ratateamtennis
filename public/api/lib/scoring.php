<?php
// Point-by-point scoring for the full-screen scorer.
//
// Each match keeps a log of what happened, one character per event:
//   a / b  a point for side A / side B
//   t      switch to a tiebreak now (only when the games are level, e.g. when time runs out)
//   f      first-serve fault on the point being played (no point yet; shows FAULT until the point ends)
//   d      double fault: a point to the receiving side
//   s      players switch sides (display only; also how the scorer confirms a change of ends)
//   1-4    correction: the player in slot a1 / a2 / b1 / b2 is serving now (the rotation carries on from them)
//
// Tennis: players change ends after every odd game (1, 3, 5…) and every 6 points of a tiebreak.
// The scorer shows a "Switch court" prompt until an "s" is logged or the next point is played.
// Everything shown on the scoreboard (games, 15/30/40, tiebreak points, who serves, finished)
// is worked out by replaying that log, so "undo" is just dropping the last character.
//
// Americano sessions: each point adds 1 to that side; serve rotates every AMERICANO_SERVE_EVERY points.
// Tennis sessions: normal games (0/15/30/40), one set to `games`, win by 2, tiebreak at games-all,
// deuce either "no-ad" (deciding point) or advantage. Serve changes every game; in a tiebreak the
// next player serves 1 point, then 2 each.

const AMERICANO_SERVE_EVERY = 4;

/** Serving order: first server, first player of the other side, partner of first server, other partner. */
function serve_order(array $m): array
{
    $a = array_values(array_filter([(int) $m['a1'], (int) ($m['a2'] ?? 0)]));
    $b = array_values(array_filter([(int) $m['b1'], (int) ($m['b2'] ?? 0)]));
    $first = (int) ($m['first_server'] ?? 0);
    if (in_array($first, $b, true)) {
        [$a, $b] = [$b, $a];
    }
    if (in_array($first, $a, true) && $a[0] !== $first) {
        $a = array_reverse($a);
    }
    $order = [];
    for ($i = 0; $i < max(count($a), count($b)); $i++) {
        if (isset($a[$i])) {
            $order[] = $a[$i];
        }
        if (isset($b[$i])) {
            $order[] = $b[$i];
        }
    }
    return $order;
}

/**
 * The serving order after the scorer says player $p is serving at rotation index $idx:
 * $p serves now, then the other team's next server, then $p's partner, then the other opponent.
 */
function serve_reorder(array $order, array $m, int $p, int $idx): array
{
    $n = count($order);
    $a = array_values(array_filter([(int) $m['a1'], (int) ($m['a2'] ?? 0)]));
    $b = array_values(array_filter([(int) $m['b1'], (int) ($m['b2'] ?? 0)]));
    if (!$n || (!in_array($p, $a, true) && !in_array($p, $b, true))) {
        return $order;
    }
    [$team, $opp] = in_array($p, $a, true) ? [$a, $b] : [$b, $a];
    $o1 = null;
    for ($k = 1; $k <= $n; $k++) {
        if (in_array($order[($idx + $k) % $n], $opp, true)) {
            $o1 = $order[($idx + $k) % $n];
            break;
        }
    }
    $o1 ??= $opp[0] ?? null;
    $seq = array_values(array_filter([
        $p,
        $o1,
        current(array_diff($team, [$p])) ?: null,
        current(array_diff($opp, [$o1])) ?: null,
    ]));
    $new = $order;
    foreach ($seq as $k => $q) {
        $new[($idx + $k) % $n] = $q;
    }
    return $new;
}

/** Player id for a log digit 1-4 (slots a1, a2, b1, b2). */
function slot_player(array $m, string $c): int
{
    return (int) ($m[['1' => 'a1', '2' => 'a2', '3' => 'b1', '4' => 'b2'][$c]] ?? 0);
}

/**
 * Doubles court positions: who plays on the right (deuce) side for each team, and who receives
 * the point being played (right side on even points of a game, left side on odd ones).
 */
function court_positions(array $m, ?int $server, ?string $serverSide, int $pointNo): array
{
    $team = fn($x, $y) => array_values(array_filter([(int) $m[$x], (int) ($m[$y] ?? 0)]));
    $teams = ['a' => $team('a1', 'a2'), 'b' => $team('b1', 'b2')];
    $right = [];
    foreach ($teams as $k => $ids) {
        $pick = (int) ($m[$k . '_right'] ?? 0);
        $right[$k] = count($ids) === 2 ? (in_array($pick, $ids, true) ? $pick : $ids[0]) : null;
    }
    $receiver = null;
    if ($server && $serverSide) {
        $rs = $serverSide === 'a' ? 'b' : 'a';
        $ids = $teams[$rs];
        if (count($ids) === 2) {
            $left = current(array_diff($ids, [$right[$rs]]));
            $receiver = $pointNo % 2 === 0 ? $right[$rs] : $left;
        } else {
            $receiver = $ids[0] ?? null;
        }
    }
    return ['right' => $right, 'receiver' => $receiver, 'serve_from' => $server ? ($pointNo % 2 === 0 ? 'right' : 'left') : null];
}

/** Replays a match log and returns the live scoreboard state. */
function match_state(array $s, array $m): array
{
    $log = (string) ($m['log'] ?? '');
    $order = serve_order($m);
    $tennis = ($s['point_system'] ?? 'americano') === 'tennis';

    $sideA = array_map('intval', array_filter([$m['a1'], $m['a2'] ?? 0]));
    $sideOf = fn($p) => $p === null ? null : (in_array($p, $sideA, true) ? 'a' : 'b');
    $swapped = substr_count($log, 's') % 2 === 1;
    // FAULT while a first-serve fault is pending; "Double fault" until the next point
    $pointLog = str_replace(['t', 's', '1', '2', '3', '4'], '', $log);
    $flash = substr($pointLog, -1) === 'f' ? 'fault' : (substr($pointLog, -1) === 'd' ? 'double' : null);

    if (!$tennis) {
        $n = 0;
        foreach (str_split($log) as $c) {
            if (ctype_digit($c)) {
                $order = serve_reorder($order, $m, slot_player($m, $c), intdiv($n, AMERICANO_SERVE_EVERY));
            } elseif (in_array($c, ['a', 'b', 'd'], true)) {
                $n++;
            }
        }
        $server = $order ? $order[intdiv($n, AMERICANO_SERVE_EVERY) % count($order)] : null;
        return [
            'mode' => 'americano',
            'server' => $server,
            'server_side' => $sideOf($server),
            'scored' => $n > 0,
        ] + court_positions($m, $server, $sideOf($server), $n) + [
            'points' => [(int) $m['score_a'], (int) $m['score_b']],
            'fault' => $flash === 'fault',
            'flash' => $flash,
            'swapped' => $swapped,
            'can_undo' => $log !== '',
        ];
    }

    $N = max(1, (int) ($s['games'] ?? 4));
    $TB = max(1, (int) ($s['tb_points'] ?? 7));
    $noAd = !empty($s['no_ad']);
    $games = [0, 0];
    $pts = [0, 0];
    $tb = false;
    $done = false;
    $played = 0; // games completed, drives the serve rotation

    $winGame = function (int $i) use (&$games, &$pts, &$tb, &$done, &$played, $N): void {
        $o = 1 - $i;
        $games[$i]++;
        $played++;
        $pts = [0, 0];
        if ($tb) {
            $tb = false;
            $done = true;
        } elseif ($games[$i] >= $N && $games[$i] - $games[$o] >= 2) {
            $done = true;
        } elseif ($games[0] === $N && $games[1] === $N) {
            $tb = true;
        }
    };

    $endsDue = false;
    $rotation = function () use (&$tb, &$played, &$pts) {
        return $tb ? $played + intdiv(array_sum($pts) + 1, 2) : $played;
    };
    $serverNow = function () use (&$order, $rotation) {
        return $order ? $order[$rotation() % count($order)] : null;
    };
    $scored = false;

    foreach (str_split($log) as $c) {
        if ($done || $c === '') {
            break;
        }
        if ($c === 's') {
            $endsDue = false;
            continue;
        }
        if ($c === 'f') {
            continue;
        }
        if (ctype_digit($c)) {
            $order = serve_reorder($order, $m, slot_player($m, $c), $rotation());
            continue;
        }
        $endsDue = false;
        if ($c === 'd') {
            $c = $sideOf($serverNow()) === 'a' ? 'b' : 'a';
        }
        if ($c === 't') {
            if (!$tb && $games[0] === $games[1]) {
                $tb = true;
                $pts = [0, 0];
            }
            continue;
        }
        $i = $c === 'a' ? 0 : 1;
        $o = 1 - $i;
        $pts[$i]++;
        $scored = true;
        if ($tb) {
            if ($pts[$i] >= $TB && $pts[$i] - $pts[$o] >= 2) {
                $winGame($i);
            }
        } elseif ($noAd ? $pts[$i] >= 4 : ($pts[$i] >= 4 && $pts[$i] - $pts[$o] >= 2)) {
            $winGame($i);
        }
        if (!$done) {
            $endsDue = $tb ? array_sum($pts) > 0 && array_sum($pts) % 6 === 0
                : array_sum($pts) === 0 && ($games[0] + $games[1]) % 2 === 1;
        }
    }

    $server = $serverNow();
    $call = ['0', '15', '30', '40'];
    $display = $tb ? [(string) $pts[0], (string) $pts[1]] : [$call[min(3, $pts[0])], $call[min(3, $pts[1])]];
    $note = null;
    if ($tb) {
        $note = "Tiebreak to $TB";
    } elseif ($pts[0] >= 3 && $pts[1] >= 3) {
        if ($pts[0] === $pts[1]) {
            $note = $noAd ? 'Deciding point' : 'Deuce';
        } else {
            $lead = $pts[0] > $pts[1] ? 0 : 1;
            $display[$lead] = 'AD';
            $note = 'Advantage';
        }
    }
    return [
        'mode' => 'tennis',
        'games' => $games,
        'display' => $display,
        'tiebreak' => $tb,
        'note' => $note,
        'finished' => $done,
        'server' => $server,
        'server_side' => $sideOf($server),
        'scored' => $scored,
    ] + court_positions($m, $server, $sideOf($server), array_sum($pts)) + [
        'fault' => $flash === 'fault' && !$done,
        'flash' => $done ? null : $flash,
        'swapped' => $swapped,
        'change_ends' => $endsDue && !$done,
        'can_tiebreak' => !$done && !$tb && $games[0] === $games[1],
        'can_undo' => $log !== '',
    ];
}
