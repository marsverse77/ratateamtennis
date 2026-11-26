<?php
// CLI-only fixture helper. The Python runner passes a copied application inside its
// own temporary directory; this must never be served or pointed at a real site.
if (PHP_SAPI !== 'cli' || !isset($argv[1], $argv[2]) || $argv[2] !== 'rata-booking-tests') {
    exit(2);
}
require $argv[1] . '/api/lib/db.php';
$in = json_decode((string) fgets(STDIN), true, 512, JSON_THROW_ON_ERROR);
$pdo = db();
if (($in['mode'] ?? '') === 'gate') {
    // Hold both the shared booking mutex and the target request. The unpatched
    // API reads the old request and waits later; the patched API waits first.
    $pdo->beginTransaction();
    $pdo->exec("UPDATE meta SET v=v WHERE k='schema'");
    q('UPDATE slot_requests SET status=status WHERE id=?', [(int) $in['request_id']]);
    echo "READY\n";
    flush();
    $release = json_decode((string) fgets(STDIN), true, 512, JSON_THROW_ON_ERROR);
    foreach ($release['queries'] ?? [] as $query) {
        q($query['sql'], $query['args'] ?? []);
    }
    $pdo->commit();
    echo "COMMITTED\n";
} elseif (($in['mode'] ?? '') === 'reset') {
    $pdo->exec(is_mysql($pdo) ? 'SET FOREIGN_KEY_CHECKS=0' : 'PRAGMA foreign_keys=OFF');
    foreach (array_keys(db_dump($pdo)) as $table) {
        if (!in_array($table, ['meta', 'users', 'coach_slots', 'seasons'], true)) {
            $pdo->exec('DELETE FROM ' . $table);
        }
    }
    $pdo->exec('DELETE FROM coach_slots');
    foreach ($in['slots'] as $slot) {
        insert('coach_slots', $slot);
    }
    $pdo->exec(is_mysql($pdo) ? 'SET FOREIGN_KEY_CHECKS=1' : 'PRAGMA foreign_keys=ON');
    if (is_mysql($pdo)) {
        $pdo->exec('DROP TRIGGER IF EXISTS test_slow_session_insert');
    }
    echo json_encode(['ok' => true]);
} else {
    $out = [];
    foreach ($in['queries'] ?? [] as $query) {
        $st = $pdo->prepare($query['sql']);
        $st->execute($query['args'] ?? []);
        $out[] = $st->columnCount() ? $st->fetchAll(PDO::FETCH_ASSOC) : ['affected' => $st->rowCount(), 'id' => $pdo->lastInsertId()];
    }
    echo json_encode($out, JSON_THROW_ON_ERROR);
}
