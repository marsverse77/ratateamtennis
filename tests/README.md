# Booking regression tests

These tests call the real PHP HTTP API through independent authenticated clients.
They use a temporary copy of `public/`, a fresh database, and localhost PHP workers.
They do not use an existing `api/config.php`, production credentials, or an external
database. Both the web server and optional MariaDB server are stopped after the run.

## SQLite

Requirements: Python 3.9+ with timezone data; PHP 8.1+ CLI with PDO SQLite,
`mbstring`, and `ctype`; a platform supporting PHP's multiworker development server.

```sh
python3 tests/booking_regression.py
```

To select a PHP executable:

```sh
python3 tests/booking_regression.py --php /path/to/php
```

## MariaDB / InnoDB

Also requires PDO MySQL, `mariadbd`, and `mariadb-install-db`. The runner initializes
a new local datadir and binds a random loopback TCP port. It never connects to an
existing database. A database DSN cannot be supplied to this test runner.

```sh
python3 tests/booking_regression.py --backend mysql
```

For binaries outside PATH, supply `--mariadbd`, `--mariadb-install-db`, and, if
needed, `--mariadb-basedir`. Run as an ordinary user with write access to the system
temporary directory.

The MariaDB suite is necessary for concurrency coverage. It includes a test-only
trigger that delays insertion briefly to expose overlapping acceptances. Three
additional tests hold the booking mutex and request row, wait for an actual InnoDB
lock wait, then commit a competing cancellation, price change, or availability
change. They verify that acceptance reads committed state after acquiring the lock.
The application code has no test hooks or injected delays.

## What is covered

- The 230 seeded slots, combined Degung/Jordy capacity, 30-minute intervals, and
  adjacent end-exclusive bookings.
- Invalid calendar dates, invalid clock times, and zero/negative session durations
  are rejected before writing.
- Pending requests do not reserve capacity; accepted and paid requests do.
- Private booking versus Kuyy, in both directions, through coach names, member IDs,
  explicit scheduling identities, and legacy assignments.
- Explicit unassignment overrides legacy scalar coach fields; stable mappings
  survive member/title renames; older clients changing coach membership must send
  an explicit schedule mapping.
- Full Anjas participation on Wednesday 19:30–21:00 and Friday 19:00–21:00;
  Wednesday 21:00–22:00 remains private-only.
- An explicit recurring `BLOCKED_KUYY` marker covers the entire participation
  window and cannot overwrite a future private commitment. A dated Kuyy session
  may fulfil that marker; unassigned private-or-Kuyy slots remain bookable.
- Fresh availability checks at pricing and acceptance; court changes and
  close/reopen invalidate stale offers; stale price tokens cannot accept new terms.
- Simultaneous acceptance of the same request, competing members, Kuyy assignment,
  cancellation, repricing, and availability edits.
- Accepted private sessions cannot be moved independently of their request;
  deletion reopens capacity and retains request history.
- A legacy inconsistent request marked `priced` cannot create another private
  session or be repriced while its actual linked session still exists.
- Existing paid bookings survive availability edits and the additive v29→v30
  migration; migration backup and administrator slot edits are preserved.
- Paid booking overlays remain visible when the weekly template closes, while
  other members cannot see the private session ID or request details. Direct
  private-session detail URLs allow only the requester and administrators;
  ordinary public-session details remain accessible.

To test a baseline checkout without modifying it:

```sh
python3 tests/booking_regression.py --source /path/to/baseline-checkout
```

To run one case, append its unittest name, for example
`BookingRegression.test_simultaneous_accept_same_request_creates_exactly_one_session`.
Use `--keep-temp` to retain the disposable database and `server.log` for diagnosis.
The SQL fixture helper is CLI-only and must never be copied into a web root.
