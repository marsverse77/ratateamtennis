<?php
// Database connection and schema. Works with MySQL (production) and SQLite (fallback / local dev).

const SCHEMA_VERSION = 28;
const BACKUP_DIR = __DIR__ . '/../data/backups';

function config(): array
{
    static $cfg = null;
    if ($cfg === null) {
        $file = __DIR__ . '/../config.php';
        $cfg = is_file($file) ? require $file : [];
        $cfg += ['db_host' => 'localhost', 'db_name' => '', 'db_user' => '', 'db_pass' => ''];
        if (getenv('RATA_SQLITE')) {
            $cfg['db_name'] = '';
            $cfg['sqlite_path'] = getenv('RATA_SQLITE');
        }
    }
    return $cfg;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) {
        return $pdo;
    }
    $cfg = config();
    $opts = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    if ($cfg['db_name'] !== '') {
        $dsn = "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $cfg['db_user'], $cfg['db_pass'], $opts);
        $pdo->exec("SET time_zone = '+08:00'");
    } else {
        $path = $cfg['sqlite_path'] ?? __DIR__ . '/../data/rata.sqlite';
        $pdo = new PDO('sqlite:' . $path, null, null, $opts);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA busy_timeout = 5000');
        $pdo->exec('PRAGMA journal_mode = WAL');
    }
    migrate($pdo);
    return $pdo;
}

function is_mysql(PDO $pdo): bool
{
    return $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql';
}

function migrate(PDO $pdo): void
{
    $v = 0;
    try {
        $v = (int) $pdo->query("SELECT v FROM meta WHERE k = 'schema'")->fetchColumn();
        if ($v >= SCHEMA_VERSION) {
            return;
        }
    } catch (PDOException $e) {
        // meta table missing: fresh database
    }

    $mysql = is_mysql($pdo);
    if ($v >= 1) {
        // Keep a full copy of the data as it was before every schema upgrade.
        write_backup($pdo, 'pre-v' . SCHEMA_VERSION);
    }
    $pk = $mysql ? 'INT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    $engine = $mysql ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : '';

    $stmts = [
        "CREATE TABLE IF NOT EXISTS meta (k VARCHAR(50) PRIMARY KEY, v VARCHAR(255) NOT NULL)$engine",
        "CREATE TABLE IF NOT EXISTS users (
            id $pk,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(190) NULL UNIQUE,
            phone VARCHAR(40) NULL,
            password_hash VARCHAR(255) NULL,
            photo VARCHAR(255) NULL,
            photo_orig VARCHAR(255) NULL,
            coach VARCHAR(120) NOT NULL DEFAULT '',
            gender VARCHAR(10) NOT NULL DEFAULT '',
            instagram VARCHAR(60) NOT NULL DEFAULT '',
            level VARCHAR(20) NOT NULL DEFAULT '',
            experience TEXT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'member',
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS play_sessions (
            id $pk,
            title VARCHAR(120) NOT NULL,
            date VARCHAR(10) NOT NULL,
            start_time VARCHAR(5) NOT NULL,
            end_time VARCHAR(5) NOT NULL,
            location VARCHAR(160) NOT NULL DEFAULT '',
            description TEXT NULL,
            courts INT NOT NULL DEFAULT 1,
            max_players INT NOT NULL DEFAULT 8,
            format VARCHAR(30) NOT NULL DEFAULT 'americano',
            scoring VARCHAR(10) NOT NULL DEFAULT 'total',
            target INT NOT NULL DEFAULT 16,
            match_minutes INT NOT NULL DEFAULT 15,
            rounds INT NOT NULL DEFAULT 0,
            counts_overall INT NOT NULL DEFAULT 1,
            point_system VARCHAR(10) NOT NULL DEFAULT 'americano',
            games INT NOT NULL DEFAULT 4,
            no_ad INT NOT NULL DEFAULT 1,
            tb_points INT NOT NULL DEFAULT 7,
            fee INT NOT NULL DEFAULT 0,
            bank_name VARCHAR(60) NOT NULL DEFAULT '',
            bank_account VARCHAR(40) NOT NULL DEFAULT '',
            bank_holder VARCHAR(100) NOT NULL DEFAULT '',
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            banner_square VARCHAR(255) NULL,
            banner_wide VARCHAR(255) NULL,
            rule_version INT NOT NULL DEFAULT 2,
            activity VARCHAR(20) NOT NULL DEFAULT 'mabar',
            placements_at VARCHAR(19) NULL,
            frozen_at VARCHAR(19) NULL,
            coach_id INT NULL,
            coach_name VARCHAR(100) NOT NULL DEFAULT '',
            coach_ids VARCHAR(255) NOT NULL DEFAULT '',
            coach_names VARCHAR(255) NOT NULL DEFAULT '',
            hit_format VARCHAR(30) NOT NULL DEFAULT '',
            hit_level VARCHAR(30) NOT NULL DEFAULT '',
            hit_partners VARCHAR(20) NOT NULL DEFAULT '',
            hit_balls VARCHAR(20) NOT NULL DEFAULT '',
            with_games INT NOT NULL DEFAULT 1,
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS registrations (
            id $pk,
            session_id INT NOT NULL,
            user_id INT NOT NULL,
            status VARCHAR(12) NOT NULL DEFAULT 'confirmed',
            pay_status VARCHAR(12) NOT NULL DEFAULT 'none',
            amount INT NOT NULL DEFAULT 0,
            method VARCHAR(12) NOT NULL DEFAULT '',
            proof VARCHAR(255) NULL,
            paid_at VARCHAR(19) NULL,
            note VARCHAR(255) NULL,
            created_at VARCHAR(19) NOT NULL,
            UNIQUE (session_id, user_id),
            FOREIGN KEY (session_id) REFERENCES play_sessions(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )$engine",
        "CREATE TABLE IF NOT EXISTS matches (
            id $pk,
            session_id INT NOT NULL,
            round INT NOT NULL,
            court INT NOT NULL,
            start_time VARCHAR(5) NOT NULL DEFAULT '',
            a1 INT NOT NULL,
            a2 INT NULL,
            b1 INT NOT NULL,
            b2 INT NULL,
            score_a INT NOT NULL DEFAULT 0,
            score_b INT NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
            log TEXT NULL,
            first_server INT NULL,
            a_right INT NULL,
            b_right INT NULL,
            placement INT NOT NULL DEFAULT 0,
            lock_user INT NULL,
            lock_device VARCHAR(40) NULL,
            lock_at VARCHAR(19) NULL,
            started_at VARCHAR(19) NULL,
            paused_at VARCHAR(19) NULL,
            paused_secs INT NOT NULL DEFAULT 0,
            updated_at VARCHAR(19) NOT NULL,
            FOREIGN KEY (session_id) REFERENCES play_sessions(id) ON DELETE CASCADE
        )$engine",
        "CREATE TABLE IF NOT EXISTS session_photos (
            id $pk,
            session_id INT NOT NULL,
            user_id INT NOT NULL,
            post_id INT NULL,
            file VARCHAR(255) NOT NULL,
            created_at VARCHAR(19) NOT NULL,
            FOREIGN KEY (session_id) REFERENCES play_sessions(id) ON DELETE CASCADE
        )$engine",
        "CREATE TABLE IF NOT EXISTS session_posts (
            id $pk,
            session_id INT NOT NULL,
            user_id INT NOT NULL,
            body TEXT NULL,
            created_at VARCHAR(19) NOT NULL,
            FOREIGN KEY (session_id) REFERENCES play_sessions(id) ON DELETE CASCADE
        )$engine",
        "CREATE TABLE IF NOT EXISTS blog_posts (
            id $pk,
            title VARCHAR(160) NOT NULL,
            summary VARCHAR(300) NOT NULL DEFAULT '',
            body TEXT NULL,
            cover VARCHAR(255) NULL,
            author_id INT NOT NULL,
            status VARCHAR(12) NOT NULL DEFAULT 'draft',
            published_at VARCHAR(19) NULL,
            created_at VARCHAR(19) NOT NULL,
            updated_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS seasons (
            id $pk,
            name VARCHAR(60) NOT NULL,
            starts_on VARCHAR(10) NOT NULL,
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS point_ledger (
            id $pk,
            source_key VARCHAR(120) NOT NULL UNIQUE,
            user_id INT NOT NULL,
            season_id INT NOT NULL,
            category VARCHAR(20) NOT NULL,
            format VARCHAR(10) NOT NULL DEFAULT '',
            session_id INT NULL,
            match_id INT NULL,
            points INT NOT NULL,
            rule_version INT NOT NULL DEFAULT 2,
            note VARCHAR(255) NOT NULL DEFAULT '',
            external_id INT NULL,
            reverses INT NULL,
            reversed_at VARCHAR(19) NULL,
            created_by INT NULL,
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS session_placements (
            id $pk,
            session_id INT NOT NULL,
            user_id INT NOT NULL,
            place VARCHAR(12) NOT NULL,
            created_at VARCHAR(19) NOT NULL,
            UNIQUE (session_id, user_id)
        )$engine",
        "CREATE TABLE IF NOT EXISTS external_results (
            id $pk,
            user_id INT NOT NULL,
            partner_id INT NULL,
            partner_name VARCHAR(100) NOT NULL DEFAULT '',
            tournament VARCHAR(160) NOT NULL,
            organizer VARCHAR(160) NOT NULL DEFAULT '',
            event_date VARCHAR(10) NOT NULL,
            category VARCHAR(80) NOT NULL DEFAULT '',
            level VARCHAR(20) NOT NULL,
            format VARCHAR(10) NOT NULL,
            placement VARCHAR(12) NOT NULL,
            entrants INT NOT NULL,
            event_key VARCHAR(255) NOT NULL,
            proof_file VARCHAR(255) NULL,
            proof_link VARCHAR(500) NOT NULL DEFAULT '',
            notes VARCHAR(1000) NOT NULL DEFAULT '',
            status VARCHAR(16) NOT NULL DEFAULT 'pending',
            points INT NOT NULL DEFAULT 0,
            review_note VARCHAR(500) NOT NULL DEFAULT '',
            reviewed_by INT NULL,
            reviewed_at VARCHAR(19) NULL,
            created_at VARCHAR(19) NOT NULL,
            updated_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS coaching_attendance (
            id $pk,
            session_id INT NOT NULL,
            user_id INT NOT NULL,
            status VARCHAR(12) NOT NULL,
            confirmed_by INT NULL,
            confirmed_at VARCHAR(19) NOT NULL,
            UNIQUE (session_id, user_id)
        )$engine",
        "CREATE TABLE IF NOT EXISTS reward_redemptions (
            id $pk,
            user_id INT NOT NULL,
            kind VARCHAR(20) NOT NULL,
            status VARCHAR(12) NOT NULL DEFAULT 'requested',
            note VARCHAR(255) NOT NULL DEFAULT '',
            handled_by INT NULL,
            handled_at VARCHAR(19) NULL,
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS timeline_comments (
            id $pk,
            session_id INT NOT NULL,
            owner_id INT NOT NULL,
            user_id INT NOT NULL,
            body TEXT NOT NULL,
            mentions VARCHAR(255) NOT NULL DEFAULT '',
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS refunds (
            id $pk,
            session_id INT NOT NULL,
            user_id INT NOT NULL,
            amount INT NOT NULL DEFAULT 0,
            method VARCHAR(20) NOT NULL DEFAULT '',
            reason VARCHAR(20) NOT NULL DEFAULT 'cancelled',
            status VARCHAR(10) NOT NULL DEFAULT 'pending',
            created_at VARCHAR(19) NOT NULL,
            done_at VARCHAR(19) NULL,
            done_by INT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS chat_channels (
            id $pk,
            name VARCHAR(80) NOT NULL,
            description VARCHAR(255) NOT NULL DEFAULT '',
            created_by INT NOT NULL,
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS chat_messages (
            id $pk,
            session_id INT NULL,
            channel_id INT NULL,
            user_id INT NOT NULL,
            body TEXT NOT NULL,
            mentions VARCHAR(255) NOT NULL DEFAULT '',
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS hero_slides (
            id $pk,
            file VARCHAR(120) NOT NULL,
            sort INT NOT NULL DEFAULT 0,
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS activity_log (
            id $pk,
            user_id INT NULL,
            kind VARCHAR(30) NOT NULL,
            text VARCHAR(255) NOT NULL,
            url VARCHAR(255) NOT NULL DEFAULT '',
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS audit_log (
            id $pk,
            actor_id INT NULL,
            action VARCHAR(40) NOT NULL,
            entity VARCHAR(20) NOT NULL,
            entity_id INT NOT NULL,
            before_json TEXT NULL,
            after_json TEXT NULL,
            reason VARCHAR(255) NOT NULL DEFAULT '',
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS push_subs (
            id $pk,
            user_id INT NOT NULL,
            endpoint TEXT NOT NULL,
            ep_hash CHAR(64) NOT NULL UNIQUE,
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS notifications (
            id $pk,
            title VARCHAR(120) NOT NULL,
            body VARCHAR(255) NOT NULL,
            url VARCHAR(255) NOT NULL,
            created_at VARCHAR(19) NOT NULL
        )$engine",
        "CREATE TABLE IF NOT EXISTS push_queue (
            sub_id INT NOT NULL,
            notification_id INT NOT NULL,
            PRIMARY KEY (sub_id, notification_id)
        )$engine",
    ];
    foreach ($stmts as $sql) {
        $pdo->exec($sql);
    }
    if ($v < 13) {
        // v13: RATA points ledger and seasons. Season 1 starts on the day the new points rules went live.
        try {
            $pdo->exec('CREATE INDEX ledger_user_season ON point_ledger (user_id, season_id)');
            $pdo->exec('CREATE INDEX ledger_session ON point_ledger (session_id)');
        } catch (PDOException $e) {
            // already there
        }
        if (!(int) $pdo->query('SELECT COUNT(*) FROM seasons')->fetchColumn()) {
            $pdo->prepare('INSERT INTO seasons (name, starts_on, created_at) VALUES (?, ?, ?)')
                ->execute(['Season 1', '2026-10-23', date('Y-m-d H:i:s')]);
        }
    }
    // v2: member photos (fresh databases already have the column from CREATE TABLE).
    if ($v >= 1 && $v < 2) {
        $pdo->exec('ALTER TABLE users ADD COLUMN photo VARCHAR(255) NULL');
    }
    // v3: tennis scoring and the point-by-point scorer.
    if ($v >= 1 && $v < 3) {
        foreach ([
            "ALTER TABLE play_sessions ADD COLUMN point_system VARCHAR(10) NOT NULL DEFAULT 'americano'",
            'ALTER TABLE play_sessions ADD COLUMN games INT NOT NULL DEFAULT 4',
            'ALTER TABLE play_sessions ADD COLUMN no_ad INT NOT NULL DEFAULT 1',
            'ALTER TABLE play_sessions ADD COLUMN tb_points INT NOT NULL DEFAULT 7',
            'ALTER TABLE matches ADD COLUMN log TEXT NULL',
            'ALTER TABLE matches ADD COLUMN first_server INT NULL',
            'ALTER TABLE matches ADD COLUMN started_at VARCHAR(19) NULL',
        ] as $sql) {
            $pdo->exec($sql);
        }
    }
    // v4: session fees with transfer proofs, waiting list, and more profile fields.
    if ($v >= 1 && $v < 4) {
        foreach ([
            'ALTER TABLE play_sessions ADD COLUMN fee INT NOT NULL DEFAULT 0',
            "ALTER TABLE play_sessions ADD COLUMN bank_name VARCHAR(60) NOT NULL DEFAULT ''",
            "ALTER TABLE play_sessions ADD COLUMN bank_account VARCHAR(40) NOT NULL DEFAULT ''",
            "ALTER TABLE play_sessions ADD COLUMN bank_holder VARCHAR(100) NOT NULL DEFAULT ''",
            "ALTER TABLE registrations ADD COLUMN status VARCHAR(12) NOT NULL DEFAULT 'confirmed'",
            "ALTER TABLE registrations ADD COLUMN pay_status VARCHAR(12) NOT NULL DEFAULT 'none'",
            'ALTER TABLE registrations ADD COLUMN amount INT NOT NULL DEFAULT 0',
            "ALTER TABLE registrations ADD COLUMN method VARCHAR(12) NOT NULL DEFAULT ''",
            'ALTER TABLE registrations ADD COLUMN proof VARCHAR(255) NULL',
            'ALTER TABLE registrations ADD COLUMN paid_at VARCHAR(19) NULL',
            'ALTER TABLE registrations ADD COLUMN note VARCHAR(255) NULL',
            "ALTER TABLE users ADD COLUMN coach VARCHAR(120) NOT NULL DEFAULT ''",
            "ALTER TABLE users ADD COLUMN gender VARCHAR(10) NOT NULL DEFAULT ''",
            "ALTER TABLE users ADD COLUMN instagram VARCHAR(60) NOT NULL DEFAULT ''",
            "ALTER TABLE users ADD COLUMN level VARCHAR(20) NOT NULL DEFAULT ''",
            'ALTER TABLE users ADD COLUMN experience TEXT NULL',
        ] as $sql) {
            $pdo->exec($sql);
        }
    }
    // v6: keep the uncropped profile photo so members can re-crop it.
    if ($v >= 1 && $v < 6) {
        $pdo->exec('ALTER TABLE users ADD COLUMN photo_orig VARCHAR(255) NULL');
    }
    // v8: pause and resume the match timer.
    if ($v >= 1 && $v < 8) {
        $pdo->exec('ALTER TABLE matches ADD COLUMN paused_at VARCHAR(19) NULL');
        $pdo->exec('ALTER TABLE matches ADD COLUMN paused_secs INT NOT NULL DEFAULT 0');
    }
    // v9: session banners, doubles court positions, and session reviews (session_posts is created above).
    if ($v >= 1 && $v < 9) {
        foreach ([
            'ALTER TABLE play_sessions ADD COLUMN banner_square VARCHAR(255) NULL',
            'ALTER TABLE play_sessions ADD COLUMN banner_wide VARCHAR(255) NULL',
            'ALTER TABLE matches ADD COLUMN a_right INT NULL',
            'ALTER TABLE matches ADD COLUMN b_right INT NULL',
        ] as $sql) {
            $pdo->exec($sql);
        }
        try {
            $pdo->exec('ALTER TABLE session_photos ADD COLUMN post_id INT NULL');
        } catch (PDOException $e) {
            // session_photos was only just created above, already with post_id
        }
    }
    // v11: rule versions for the points system. Every session so far keeps the scoring rules it was
    // played under (rule_version 1), and sessions already completed are frozen so their results stay as they are.
    if ($v >= 1 && $v < 11) {
        $pdo->exec('ALTER TABLE play_sessions ADD COLUMN rule_version INT NOT NULL DEFAULT 1');
        $pdo->exec('ALTER TABLE play_sessions ADD COLUMN frozen_at VARCHAR(19) NULL');
        $pdo->prepare("UPDATE play_sessions SET frozen_at = ? WHERE status = 'completed'")->execute([date('Y-m-d H:i:s')]);
    }
    // v12: Mabar points rules. Placement-only matches (an extra final) give no RATA points, and
    // sessions that haven't started yet move to the new rules (rule_version 2).
    if ($v >= 1 && $v < 12) {
        $pdo->exec('ALTER TABLE matches ADD COLUMN placement INT NOT NULL DEFAULT 0');
        $pdo->exec("ALTER TABLE play_sessions ADD COLUMN activity VARCHAR(20) NOT NULL DEFAULT 'mabar'");
        $pdo->exec("UPDATE play_sessions SET rule_version = 2 WHERE status IN ('open', 'closed') AND frozen_at IS NULL
                    AND id NOT IN (SELECT session_id FROM matches WHERE status <> 'scheduled')");
    }
    // v14: Mini tournament placements and external tournament results (new tables are created above).
    if ($v >= 1 && $v < 14) {
        $pdo->exec('ALTER TABLE play_sessions ADD COLUMN placements_at VARCHAR(19) NULL');
        if ($v >= 13) {
            $pdo->exec('ALTER TABLE point_ledger ADD COLUMN external_id INT NULL');
        }
    }
    // v16: scorer audit trail (audit_log is created above) and the one-device scoring lock.
    if ($v >= 1 && $v < 16) {
        $pdo->exec('ALTER TABLE matches ADD COLUMN lock_user INT NULL');
        $pdo->exec('ALTER TABLE matches ADD COLUMN lock_device VARCHAR(40) NULL');
        $pdo->exec('ALTER TABLE matches ADD COLUMN lock_at VARCHAR(19) NULL');
    }
    // v17: one set of rules for every session (approved by the club on 2026-10-23). Sessions completed before
    // the points system move to the same rules as the rest (+1 RATA point per regular match won) and are no
    // longer locked; their matches and scores are unchanged, and the backup above keeps the data as it was.
    // The ledger backfill runs again so their points are posted.
    if ($v >= 1 && $v < 17) {
        $pdo->exec('UPDATE play_sessions SET rule_version = 2, frozen_at = NULL');
        $pdo->exec("DELETE FROM meta WHERE k = 'ledger_backfill'");
    }
    // v18: the session form briefly saved every session it created or edited as Coaching (the type picker
    // always sent its last option). Sessions that existed before v17 get the type and leaderboard setting
    // they had in the pre-v17 backup back; the ledger is synced again afterwards.
    if ($v >= 17 && $v < 18) {
        restore_session_types($pdo);
    }
    // v19: run the ledger backfill again; it now also gives finished singles Internal Tournaments their
    // placements from the session leaderboard (see auto_placements), so their players get RATA points.
    if ($v >= 1 && $v < 19) {
        $pdo->exec("DELETE FROM meta WHERE k = 'ledger_backfill'");
    }
    // v21: admin activity feed (activity_log is created above), started with past sign-ups and session registrations.
    if ($v >= 1 && $v < 21) {
        $add = $pdo->prepare('INSERT INTO activity_log (user_id, kind, text, url, created_at) VALUES (?, ?, ?, ?, ?)');
        $past = [];
        foreach ($pdo->query('SELECT id, name, created_at FROM users') as $u) {
            $past[] = [$u['id'], 'signup', $u['name'] . ' joined RATA', '#/members/' . $u['id'], $u['created_at']];
        }
        foreach ($pdo->query('SELECT r.user_id, r.created_at, u.name, s.id AS sid, s.title FROM registrations r
                              JOIN users u ON u.id = r.user_id JOIN play_sessions s ON s.id = r.session_id') as $r) {
            $past[] = [$r['user_id'], 'join', mb_substr($r['name'] . ' signed up for ' . $r['title'], 0, 255), '#/sessions/' . $r['sid'], $r['created_at']];
        }
        usort($past, fn($a, $b) => strcmp($a[4], $b[4]));
        foreach ($past as $row) {
            $add->execute($row);
        }
    }
    // v28: @mentions in chat messages (comma-separated user ids).
    if ($v >= 27 && $v < 28) {
        $pdo->exec("ALTER TABLE chat_messages ADD COLUMN mentions VARCHAR(255) NOT NULL DEFAULT ''");
    }
    // v27: session chats and chat channels (chat_channels and chat_messages are created above).
    if ($v < 27) {
        $pdo->exec('CREATE INDEX chat_session ON chat_messages (session_id, id)');
        $pdo->exec('CREATE INDEX chat_channel ON chat_messages (channel_id, id)');
    }
    // v26: Play Sessions also give +1 RATA point for attending (playing at least one finished match), as agreed
    // with the club on 2026-10-24. The ledger backfill runs again so past Play Sessions get it.
    if ($v >= 1 && $v < 26) {
        $pdo->exec("DELETE FROM meta WHERE k = 'ledger_backfill'");
    }
    // v25: Hitting Sessions (activity 'hitting'): format, skill level, partner arrangement and balls.
    if ($v >= 1 && $v < 25) {
        foreach (['hit_format VARCHAR(30)', 'hit_level VARCHAR(30)', 'hit_partners VARCHAR(20)', 'hit_balls VARCHAR(20)'] as $col) {
            $pdo->exec("ALTER TABLE play_sessions ADD COLUMN $col NOT NULL DEFAULT ''");
        }
    }
    // v24: coaching sessions can have several coaches: member ids in coach_ids and other names in
    // coach_names, both comma-separated (coach_id and coach_name from v23 are copied over and no longer used).
    if ($v >= 1 && $v < 24) {
        $pdo->exec("ALTER TABLE play_sessions ADD COLUMN coach_ids VARCHAR(255) NOT NULL DEFAULT ''");
        $pdo->exec("ALTER TABLE play_sessions ADD COLUMN coach_names VARCHAR(255) NOT NULL DEFAULT ''");
        if ($v >= 23) {
            $up = $pdo->prepare('UPDATE play_sessions SET coach_ids = ?, coach_names = ? WHERE id = ?');
            foreach ($pdo->query("SELECT id, coach_id, coach_name FROM play_sessions WHERE coach_id IS NOT NULL OR coach_name <> ''") as $r) {
                $up->execute([$r['coach_id'] ? (string) (int) $r['coach_id'] : '', (string) $r['coach_name'], $r['id']]);
            }
        }
    }
    // v24: refunds owed to players who paid and then cancelled (refunds is created above);
    // free entries are registrations with method 'free' (no column change).
    // v23: coaching sessions name their coach and can be drills only (no games).
    if ($v >= 1 && $v < 23) {
        $pdo->exec('ALTER TABLE play_sessions ADD COLUMN coach_id INT NULL');
        $pdo->exec("ALTER TABLE play_sessions ADD COLUMN coach_name VARCHAR(100) NOT NULL DEFAULT ''");
        $pdo->exec('ALTER TABLE play_sessions ADD COLUMN with_games INT NOT NULL DEFAULT 1');
    }
    // v22: homepage banner slides (hero_slides is created above).
    // v20: comments on timeline entries (timeline_comments is created above).
    // v15: coaching attendance and reward wallet (tables are created above).
    // v10: blog (blog_posts is created above with CREATE TABLE IF NOT EXISTS).
    // v7: push notifications (tables are created above with CREATE TABLE IF NOT EXISTS).
    if ($mysql) {
        $pdo->exec("INSERT INTO meta (k, v) VALUES ('schema', '" . SCHEMA_VERSION . "') ON DUPLICATE KEY UPDATE v = VALUES(v)");
    } else {
        $pdo->exec("INSERT OR REPLACE INTO meta (k, v) VALUES ('schema', '" . SCHEMA_VERSION . "')");
    }
}

/** v18 repair: sessions now marked Coaching that were another type in the newest pre-v17 backup. */
function restore_session_types(PDO $pdo): void
{
    $files = glob(BACKUP_DIR . '/pre-v17-*.json') ?: [];
    sort($files);
    $backup = $files ? json_decode((string) file_get_contents(end($files)), true) : null;
    $before = [];
    foreach ($backup['tables']['play_sessions'] ?? [] as $s) {
        $before[(int) $s['id']] = $s;
    }
    $st = $pdo->prepare('UPDATE play_sessions SET activity = ?, counts_overall = ? WHERE id = ?');
    foreach ($pdo->query("SELECT id FROM play_sessions WHERE activity = 'coaching'")->fetchAll(PDO::FETCH_COLUMN) as $id) {
        $old = $before[(int) $id] ?? null;
        if ($old && ($old['activity'] ?? 'mabar') !== 'coaching') {
            $st->execute([$old['activity'] ?? 'mabar', (int) $old['counts_overall'], (int) $id]);
        }
    }
    $pdo->exec("DELETE FROM meta WHERE k = 'ledger_backfill'");
}

/** Every table's rows, for a backup. */
function db_dump(PDO $pdo): array
{
    $tables = is_mysql($pdo)
        ? $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN)
        : $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
    $out = [];
    foreach ($tables as $t) {
        $out[$t] = $pdo->query('SELECT * FROM ' . preg_replace('/[^A-Za-z0-9_]/', '', $t))->fetchAll(PDO::FETCH_ASSOC);
    }
    return $out;
}

/** Saves a JSON copy of the whole database in api/data/backups (not reachable from the web). */
function write_backup(PDO $pdo, string $label): string
{
    if (!is_dir(BACKUP_DIR) && !mkdir(BACKUP_DIR, 0775, true) && !is_dir(BACKUP_DIR)) {
        throw new RuntimeException('Could not create the backup folder.');
    }
    $file = BACKUP_DIR . '/' . $label . '-' . date('Ymd-His') . '.json';
    $json = json_encode(['created_at' => date('Y-m-d H:i:s'), 'tables' => db_dump($pdo)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($file, $json, LOCK_EX) === false) {
        throw new RuntimeException('Could not write the database backup.');
    }
    return $file;
}

function now(): string
{
    return date('Y-m-d H:i:s');
}

function q(string $sql, array $params = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function row(string $sql, array $params = []): ?array
{
    $r = q($sql, $params)->fetch();
    return $r ?: null;
}

function rows(string $sql, array $params = []): array
{
    return q($sql, $params)->fetchAll();
}

function insert(string $table, array $data): int
{
    $cols = array_keys($data);
    $sql = "INSERT INTO $table (" . implode(',', $cols) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
    q($sql, array_values($data));
    return (int) db()->lastInsertId();
}

function update(string $table, int $id, array $data): void
{
    if (!$data) {
        return;
    }
    $set = implode(',', array_map(fn($c) => "$c = ?", array_keys($data)));
    q("UPDATE $table SET $set WHERE id = ?", [...array_values($data), $id]);
}
