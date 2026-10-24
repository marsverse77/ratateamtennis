<?php
// Match schedule generation.
//
// americano: doubles, partners rotate every round, all rounds generated up front.
// mexicano:  doubles, round 1 random, each next round pairs players by current standings
//            (1st + 3rd vs 2nd + 4th, and so on down the table).
// singles:   one vs one, opponents rotate every round, all rounds generated up front.
// singles_gender: singles americano where men only play men and women only play women, in one
//            session. Courts are shared out each round so both groups get a fair number of matches.
//
// Each round fills as many courts as the player count allows. Extra players sit out,
// and the sit-outs rotate so everyone gets the same number of byes (+/- 1).

const FORMATS = [
    'americano' => ['label' => 'Doubles · Americano', 'team' => 2],
    'mexicano' => ['label' => 'Doubles · Mexicano', 'team' => 2],
    'singles_americano' => ['label' => 'Singles · Americano', 'team' => 1],
    'singles' => ['label' => 'Singles · Round robin', 'team' => 1],
    'singles_gender' => ['label' => 'Singles · Americano · Men vs men, women vs women', 'team' => 1, 'split' => true],
];

/** True when the format keeps men and women apart (own matches, own leaderboard). */
function split_gender(string $format): bool
{
    return !empty(FORMATS[$format]['split']);
}

function team_size(string $format): int
{
    return FORMATS[$format]['team'] ?? 2;
}

function suggested_rounds(array $s): int
{
    [$sh, $sm] = array_map('intval', explode(':', $s['start_time']));
    [$eh, $em] = array_map('intval', explode(':', $s['end_time']));
    $minutes = ($eh * 60 + $em) - ($sh * 60 + $sm);
    return max(1, intdiv(max(0, $minutes), max(5, (int) $s['match_minutes'])));
}

function round_start(array $s, int $round): string
{
    [$h, $m] = array_map('intval', explode(':', $s['start_time']));
    $t = $h * 60 + $m + ($round - 1) * (int) $s['match_minutes'];
    return sprintf('%02d:%02d', intdiv($t, 60) % 24, $t % 60);
}

/** Tracks how often players partnered, faced each other and sat out. */
class PairHistory
{
    public array $partner = [];
    public array $opp = [];
    public array $byes = [];
    public array $lastBye = [];

    public function key(int $a, int $b): string
    {
        return $a < $b ? "$a-$b" : "$b-$a";
    }

    public function addMatch(array $ta, array $tb): void
    {
        foreach ([$ta, $tb] as $t) {
            for ($i = 0; $i < count($t); $i++) {
                for ($j = $i + 1; $j < count($t); $j++) {
                    $k = $this->key($t[$i], $t[$j]);
                    $this->partner[$k] = ($this->partner[$k] ?? 0) + 1;
                }
            }
        }
        foreach ($ta as $a) {
            foreach ($tb as $b) {
                $k = $this->key($a, $b);
                $this->opp[$k] = ($this->opp[$k] ?? 0) + 1;
            }
        }
    }

    public function addBye(int $p, int $round): void
    {
        $this->byes[$p] = ($this->byes[$p] ?? 0) + 1;
        $this->lastBye[$p] = $round;
    }

    public function cost(array $ta, array $tb): int
    {
        $c = 0;
        foreach ([$ta, $tb] as $t) {
            if (count($t) === 2) {
                $c += 100 * ($this->partner[$this->key($t[0], $t[1])] ?? 0);
            }
        }
        foreach ($ta as $a) {
            foreach ($tb as $b) {
                $c += 10 * ($this->opp[$this->key($a, $b)] ?? 0);
            }
        }
        return $c;
    }
}

/** Builds history from existing match rows (for incremental rounds). */
function history_from_matches(array $players, array $matches): PairHistory
{
    $h = new PairHistory();
    $byRound = [];
    foreach ($matches as $m) {
        $ta = array_values(array_filter([(int) $m['a1'], (int) ($m['a2'] ?? 0)]));
        $tb = array_values(array_filter([(int) $m['b1'], (int) ($m['b2'] ?? 0)]));
        $h->addMatch($ta, $tb);
        foreach ([...$ta, ...$tb] as $p) {
            $byRound[(int) $m['round']][$p] = true;
        }
    }
    foreach ($byRound as $r => $playing) {
        foreach ($players as $p) {
            if (!isset($playing[$p])) {
                $h->addBye($p, $r);
            }
        }
    }
    return $h;
}

/** Picks who sits out this round: fewest byes first, not twice in a row if avoidable. */
function pick_sitters(array $players, int $count, PairHistory $h, int $round, bool $avoidRepeat = true): array
{
    if ($count <= 0) {
        return [];
    }
    $order = $players;
    shuffle($order);
    usort($order, function ($a, $b) use ($h, $round, $avoidRepeat) {
        $ba = $h->byes[$a] ?? 0;
        $bb = $h->byes[$b] ?? 0;
        if ($ba !== $bb) {
            return $ba <=> $bb;
        }
        if (!$avoidRepeat) {
            return 0;
        }
        $la = ($h->lastBye[$a] ?? -9) === $round - 1 ? 1 : 0;
        $lb = ($h->lastBye[$b] ?? -9) === $round - 1 ? 1 : 0;
        return $la <=> $lb;
    });
    return array_slice($order, 0, $count);
}

/** Best split of a group of players into two teams. */
function best_split(array $g, PairHistory $h): array
{
    if (count($g) === 2) {
        return [[$g[0]], [$g[1]], $h->cost([$g[0]], [$g[1]])];
    }
    $best = null;
    foreach ([[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]] as [$x, $y]) {
        $ta = [$g[$x[0]], $g[$x[1]]];
        $tb = [$g[$y[0]], $g[$y[1]]];
        $c = $h->cost($ta, $tb);
        if ($best === null || $c < $best[2]) {
            $best = [$ta, $tb, $c];
        }
    }
    return $best;
}

/** One rotation round: returns [matches, cost], matches = [[teamA, teamB], ...] with the lowest repeat cost found. */
function rotation_round(array $active, int $team, PairHistory $h): array
{
    $per = 2 * $team;
    $best = null;
    $bestCost = PHP_INT_MAX;
    $tries = min(300, 30 * count($active));
    for ($t = 0; $t < $tries; $t++) {
        shuffle($active);
        $matches = [];
        $cost = 0;
        foreach (array_chunk($active, $per) as $g) {
            [$ta, $tb, $c] = best_split($g, $h);
            $matches[] = [$ta, $tb];
            $cost += $c;
        }
        if ($cost < $bestCost) {
            $best = $matches;
            $bestCost = $cost;
            if ($cost === 0) {
                break;
            }
        }
    }
    return [$best ?? [], $bestCost];
}

/** Mexicano round: players ordered by standings, groups of 4 play 1+3 vs 2+4. */
function ranked_round(array $rankedActive): array
{
    $matches = [];
    foreach (array_chunk($rankedActive, 4) as $g) {
        if (count($g) === 4) {
            $matches[] = [[$g[0], $g[2]], [$g[1], $g[3]]];
        }
    }
    return $matches;
}

/** Picks sit-outs and matches for one round of a rotating format. Returns [sitters, matches]. */
function fair_round(array $players, int $sitCount, int $team, PairHistory $h, int $round): array
{
    // Who sits out changes who can meet, so try several fair sit-out sets.
    $best = null;
    for ($t = 0; $t < ($sitCount > 0 ? 16 : 1); $t++) {
        $try = pick_sitters($players, $sitCount, $h, $round, $t < 4);
        [$ms, $cost] = rotation_round(array_values(array_diff($players, $try)), $team, $h);
        foreach ($try as $p) {
            $cost += ($h->lastBye[$p] ?? -9) === $round - 1 ? 5 : 0; // sitting out twice in a row
        }
        if ($best === null || $cost < $best[2]) {
            $best = [$try, $ms, $cost];
        }
    }
    return [$best[0], $best[1]];
}

/**
 * Singles by gender: each group plays its own americano. Each round the courts go one at a time to the
 * group whose players have played the fewest matches on average, so a bigger group gets more courts.
 * $groups = [gender => [user ids]], every group has at least 2 players.
 */
function generate_split_rounds(array $s, array $groups, array $existing, int $howMany): array
{
    $players = array_merge(...array_values($groups));
    $h = history_from_matches($players, $existing);
    $played = array_fill_keys(array_keys($groups), 0);
    $groupOf = [];
    foreach ($groups as $g => $ids) {
        foreach ($ids as $p) {
            $groupOf[$p] = $g;
        }
    }
    $lastRound = 0;
    foreach ($existing as $m) {
        $lastRound = max($lastRound, (int) $m['round']);
        foreach ([$m['a1'], $m['b1']] as $p) {
            if (isset($groupOf[(int) $p])) {
                $played[$groupOf[(int) $p]]++;
            }
        }
    }
    // Average matches per player in group $g once this round's courts so far are played.
    $load = function ($g, $alloc) use (&$played, $groups) {
        return ($played[$g] + 2 * $alloc[$g]) / count($groups[$g]);
    };
    $out = [];
    for ($i = 1; $i <= $howMany; $i++) {
        $round = $lastRound + $i;
        $alloc = array_fill_keys(array_keys($groups), 0);
        for ($c = 0; $c < (int) $s['courts']; $c++) {
            $pick = null;
            foreach ($groups as $g => $ids) {
                if ($alloc[$g] >= intdiv(count($ids), 2)) {
                    continue;
                }
                if ($pick === null) {
                    $pick = $g;
                    continue;
                }
                $d = $load($g, $alloc) - $load($pick, $alloc);
                if ($d < -1e-9 || (abs($d) < 1e-9 && count($ids) > count($groups[$pick]))) {
                    $pick = $g;
                }
            }
            if ($pick === null) {
                break;
            }
            $alloc[$pick]++;
        }
        $matches = [];
        foreach ($groups as $g => $ids) {
            if ($alloc[$g] === 0) {
                foreach ($ids as $p) {
                    $h->addBye($p, $round);
                }
                continue;
            }
            [$sitters, $ms] = fair_round($ids, count($ids) - 2 * $alloc[$g], 1, $h, $round);
            foreach ($ms as [$ta, $tb]) {
                $h->addMatch($ta, $tb);
                $matches[] = [$ta, $tb];
            }
            foreach ($sitters as $p) {
                $h->addBye($p, $round);
            }
            $played[$g] += 2 * $alloc[$g];
        }
        $out[$round] = $matches;
    }
    return $out;
}

/**
 * Generates rounds. $existing are match rows already in the schedule (kept), $ranking is the
 * current standings order (user ids), used by mexicano for rounds after the first.
 * Returns a list of rounds: [roundNumber => [[teamA, teamB], ...]].
 */
function generate_rounds(array $s, array $players, array $existing, int $howMany, array $ranking = []): array
{
    $team = team_size($s['format']);
    $per = 2 * $team;
    $courts = min((int) $s['courts'], intdiv(count($players), $per));
    if ($courts < 1) {
        throw new RuntimeException("Need at least $per players to generate matches.");
    }
    $h = history_from_matches($players, $existing);
    $lastRound = 0;
    foreach ($existing as $m) {
        $lastRound = max($lastRound, (int) $m['round']);
    }
    $out = [];
    for ($i = 1; $i <= $howMany; $i++) {
        $round = $lastRound + $i;
        $sitCount = count($players) - $courts * $per;
        if ($s['format'] === 'mexicano' && $round > 1 && $ranking) {
            $sitters = pick_sitters($players, $sitCount, $h, $round);
            $active = array_values(array_diff($players, $sitters));
            $pos = array_flip($ranking);
            usort($active, fn($a, $b) => ($pos[$a] ?? PHP_INT_MAX) <=> ($pos[$b] ?? PHP_INT_MAX));
            $matches = ranked_round($active);
        } else {
            [$sitters, $matches] = fair_round($players, $sitCount, $team, $h, $round);
        }
        foreach ($matches as [$ta, $tb]) {
            $h->addMatch($ta, $tb);
        }
        foreach ($sitters as $p) {
            $h->addBye($p, $round);
        }
        $out[$round] = $matches;
    }
    return $out;
}
