<?php
// Copy to config.php (the deploy workflow writes it from GitHub secrets).
// Leave DB_NAME empty to use the built-in SQLite file in api/data/.
return [
    'db_host' => 'localhost',
    'db_name' => '',
    'db_user' => '',
    'db_pass' => '',
];
