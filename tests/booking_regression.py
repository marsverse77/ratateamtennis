#!/usr/bin/env python3
"""Exercise the real booking HTTP API against disposable SQLite or MariaDB.

No dependencies beyond Python 3, PHP CLI + PDO/mbstring, and (optionally)
MariaDB's local server binaries. Never reads an existing application's config.
"""
from __future__ import annotations

import argparse
import atexit
import calendar
import concurrent.futures
import contextlib
import datetime as dt
import http.cookiejar
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo


ROOT = Path(__file__).resolve().parents[1]
PARSER = argparse.ArgumentParser(description=__doc__)
PARSER.add_argument('--source', type=Path, default=ROOT, help='Checkout to test (can be an unpatched baseline)')
PARSER.add_argument('--php', default=os.environ.get('PHP', 'php'))
PARSER.add_argument('--backend', choices=['sqlite', 'mysql'], default='sqlite')
PARSER.add_argument('--mariadbd', default='mariadbd')
PARSER.add_argument('--mariadb-install-db', default='mariadb-install-db')
PARSER.add_argument('--mariadb-basedir')
PARSER.add_argument('--keep-temp', action='store_true', help='Keep disposable files and server log after the run')
ARGS, UNITTEST_ARGS = PARSER.parse_known_args()


def unused_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


class Client:
    def __init__(self, site):
        self.site = site
        self.cookies = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def call(self, route, body=None):
        request = urllib.request.Request(
            self.site.url + '/api/index.php?r=' + route,
            data=None if body is None else json.dumps(body).encode(),
            headers={'Content-Type': 'application/json', 'X-Requested-With': 'bcs'},
        )
        try:
            with self.http.open(request, timeout=20) as response:
                return response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            return error.code, json.loads(error.read())


class Site:
    def __init__(self):
        self.tmp = Path(tempfile.mkdtemp(prefix='rata-booking-test-'))
        self.public = self.tmp / 'public'
        self.processes = []
        self.logs = []
        self.closed = False
        atexit.register(self.close)
        self.env = dict(os.environ)
        self.env.pop('RATA_SQLITE', None)
        shutil.copytree(ARGS.source / 'public', self.public,
                        ignore=shutil.ignore_patterns('config.php', 'data', 'uploads'))
        (self.public / 'api/data').mkdir()
        self.log = open(self.tmp / 'server.log', 'w+')
        self.logs.append(self.log)
        if ARGS.backend == 'mysql':
            self.start_mysql()
        else:
            self.env['RATA_SQLITE'] = str(self.tmp / 'booking.sqlite')
        session_path = self.tmp / 'php-sessions'
        session_path.mkdir()
        self.env['PHP_CLI_SERVER_WORKERS'] = '8'
        port = unused_port()
        self.url = f'http://127.0.0.1:{port}'
        self.spawn([ARGS.php, '-d', 'session.save_path=' + str(session_path),
                    '-d', 'display_errors=0', '-S', f'127.0.0.1:{port}', '-t', str(self.public)], self.log)
        for _ in range(100):
            try:
                if Client(self).call('me')[0] == 200:
                    return
            except (OSError, ValueError):
                pass
            time.sleep(.05)
        raise RuntimeError('PHP server failed to start: ' + (self.tmp / 'server.log').read_text())

    def spawn(self, command, log):
        process = subprocess.Popen(command, stdout=log, stderr=log, env=self.env, start_new_session=True)
        self.processes.append(process)
        return process

    def start_mysql(self):
        data = self.tmp / 'mysql'
        data.mkdir()
        init = [ARGS.mariadb_install_db, '--no-defaults', '--datadir=' + str(data),
                '--auth-root-authentication-method=normal', '--skip-test-db']
        base = [] if not ARGS.mariadb_basedir else ['--basedir=' + ARGS.mariadb_basedir]
        subprocess.run(init + base, env=self.env, check=True, stdout=self.log, stderr=self.log)
        port = unused_port()
        self.spawn([ARGS.mariadbd, '--no-defaults', '--datadir=' + str(data),
                    '--socket=', '--bind-address=127.0.0.1', '--port=' + str(port),
                    '--pid-file=' + str(self.tmp / 'mysql.pid'), '--skip-log-bin'] + base, self.log)
        # Fresh local server only. No host, DSN, username or database from the
        # environment or application config is ever accepted by this runner.
        create = '$p=new PDO($argv[1],"root",""); $p->exec("CREATE DATABASE rata_booking_test");'
        for _ in range(100):
            completed = subprocess.run([ARGS.php, '-r', create, f'mysql:host=127.0.0.1;port={port}'],
                                       env=self.env, capture_output=True)
            if completed.returncode == 0:
                break
            time.sleep(.1)
        else:
            raise RuntimeError('Disposable MariaDB failed: ' + (self.tmp / 'server.log').read_text())
        config = {'db_host': f'127.0.0.1;port={port}', 'db_name': 'rata_booking_test',
                  'db_user': 'root', 'db_pass': ''}
        (self.public / 'api/config.php').write_text('<?php return json_decode(' +
            repr(json.dumps(config)) + ', true);\n')

    def fixture(self, command):
        completed = subprocess.run([ARGS.php, str(ROOT / 'tests/db_fixture.php'), str(self.public), 'rata-booking-tests'],
                                   input=json.dumps(command), text=True, env=self.env,
                                   capture_output=True, check=True)
        return json.loads(completed.stdout)

    def sql(self, sql, args=()):
        return self.fixture({'queries': [{'sql': sql, 'args': list(args)}]})[0]

    def close(self):
        if self.closed:
            return
        self.closed = True
        for process in reversed(self.processes):
            with contextlib.suppress(ProcessLookupError):
                os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(10)
            except subprocess.TimeoutExpired:
                with contextlib.suppress(ProcessLookupError):
                    os.killpg(process.pid, signal.SIGKILL)
                process.wait()
        for log in self.logs:
            log.close()
        if ARGS.keep_temp:
            print('Disposable test files:', self.tmp)
        else:
            shutil.rmtree(self.tmp, ignore_errors=True)


class BookingRegression(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.site = Site()
        cls.addClassCleanup(cls.site.close)
        cls.clients = {}
        cls.users = {}
        for name in ['Admin', 'Member A', 'Member B', 'Anjas', 'Degung', 'Jordy']:
            client = Client(cls.site)
            email = name.lower().replace(' ', '.') + '@example.test'
            status, data = client.call('auth/register', {'name': name, 'email': email, 'password': 'test-password-only'})
            if status != 200:
                raise RuntimeError(f'Fixture registration failed: {status} {data}')
            cls.clients[name] = client
            cls.users[name] = data['user']['id']
        cls.original_slots = cls.site.sql('SELECT * FROM coach_slots ORDER BY id')
        cls.admin = cls.clients['Admin']
        cls.member = cls.clients['Member A']
        cls.other = cls.clients['Member B']
        today = dt.datetime.now(ZoneInfo('Asia/Makassar')).date()
        cls.monday = today - dt.timedelta(days=today.weekday()) + dt.timedelta(days=7)

    def setUp(self):
        self.site.fixture({'mode': 'reset', 'slots': self.original_slots})

    def day(self, day_iso):
        return (self.monday + dt.timedelta(days=day_iso - 1)).isoformat()

    def slot(self, key):
        return next(slot for slot in self.original_slots if slot['slot_key'] == key)

    def ok(self, response):
        status, body = response
        self.assertEqual(status, 200, body)
        return body

    def conflict(self, response):
        status, body = response
        self.assertEqual(status, 409, body)
        return body

    def request(self, key='anj-3-2030', client=None, **extra):
        slot = self.slot(key)
        return self.ok((client or self.member).call('requests', {
            'slot_id': slot['id'], 'date': self.day(int(slot['day_iso'])), 'name': 'Private member',
            'pax': 2, 'kind': 'coaching', 'court': 'Member court', **extra,
        }))['request']

    def price(self, request, amount=175000):
        return self.ok(self.admin.call('requests/' + str(request['id']), {
            'action': 'price', 'price': amount, 'bank_name': 'TEST BANK',
            'bank_account': 'TEST-ONLY', 'bank_holder': 'Fixture',
        }))['request']

    def accept(self, request, client=None):
        body = {'action': 'accept'}
        if 'quote_token' in request:
            body['quote_token'] = request['quote_token']
        return (client or self.member).call('requests/' + str(request['id']), body)

    def session_body(self, day=3, start='19:30', end='20:00', title='Kuyy Open Session', **extra):
        return {'title': title, 'date': self.day(day), 'start_time': start, 'end_time': end,
                'format': 'americano', 'activity': 'coaching', 'coach_names': 'Anjas',
                'location': 'Celuk', 'with_games': False, 'notify': False, **extra}

    def create_session(self, **extra):
        return self.ok(self.admin.call('sessions', self.session_body(**extra)))['session']

    def edit_slot(self, key, **extra):
        slot = self.slot(key)
        return self.admin.call('slots/' + str(slot['id']), {
            'status': slot['status'], 'court': slot['court'], 'program': slot['program'], 'note': slot['note'], **extra,
        })

    def assert_no_sessions(self):
        self.assertEqual(self.site.sql('SELECT COUNT(*) AS n FROM play_sessions')[0]['n'], 0)

    def test_seed_preserves_half_hours_grouping_and_end_exclusive_schedule(self):
        self.assertEqual(len(self.original_slots), 230)
        self.assertEqual({s['coach_key'] for s in self.original_slots}, {'anjas', 'degung_jordy'})
        for slot in self.original_slots:
            start = dt.datetime.strptime(slot['start_time'], '%H:%M')
            end = dt.datetime.strptime(slot['end_time'], '%H:%M')
            self.assertGreater(end, start, slot)
            self.assertLessEqual((end - start).total_seconds(), 3600, slot)
        slot = self.slot('anj-3-2030')
        self.assertEqual((slot['start_time'], slot['end_time']), ('20:30', '21:00'))
        request = self.price(self.request())
        accepted = self.ok(self.accept(request))
        session = self.site.sql('SELECT * FROM play_sessions WHERE id=?', [accepted['session_id']])[0]
        self.assertEqual((session['start_time'], session['end_time'], session['fee']), ('20:30', '21:00', 175000))
        adjacent = self.price(self.request('anj-3-2100'))
        self.ok(self.accept(adjacent))

    def test_pending_requests_do_not_reserve_capacity_and_paid_booking_stays_taken(self):
        first = self.price(self.request())
        second = self.price(self.request(client=self.other))
        accepted = self.ok(self.accept(first))
        self.conflict(self.accept(second, self.other))
        self.assertEqual(self.site.sql('SELECT status FROM slot_requests WHERE id=?', [second['id']])[0]['status'], 'taken')
        self.ok(self.admin.call('sessions/' + str(accepted['session_id']) + '/payments',
                                {'action': 'mark_paid', 'user_id': self.users['Member A']}))
        mine = self.ok(self.member.call('requests'))['requests']
        self.assertEqual(mine[0]['status'], 'paid')
        slot = self.slot('anj-3-2030')
        self.conflict(self.other.call('requests', {'slot_id': slot['id'], 'date': self.day(3),
                                                   'name': 'Other', 'pax': 1, 'kind': 'coaching'}))

    def test_invalid_calendar_date_is_rejected_before_request_insert(self):
        today = dt.datetime.now(ZoneInfo('Asia/Makassar')).date()
        last_day = calendar.monthrange(today.year, today.month)[1]
        impossible = f'{today.year:04d}-{today.month:02d}-{last_day + 1:02d}'
        # The baseline normalizes invalid day31 into next month; day32 gives
        # strtotime(false), whose weekday becomes Thursday. Match that old
        # behavior so a weekday mismatch cannot make this a false-positive test.
        legacy_day = (today.replace(day=last_day) + dt.timedelta(days=1)).isoweekday() if last_day < 31 else 4
        slot = next(s for s in self.original_slots if int(s['day_iso']) == legacy_day
                    and s['status'].startswith('AVAILABLE_'))
        status, body = self.member.call('requests', {'slot_id': slot['id'], 'date': impossible,
                                                     'name': 'Private', 'pax': 1, 'kind': 'coaching', 'court': 'Test court'})
        self.assertEqual(status, 422, body)
        self.assertEqual(self.site.sql('SELECT COUNT(*) AS n FROM slot_requests')[0]['n'], 0)

    def test_invalid_assigned_session_times_are_rejected_without_writes(self):
        for start, end in [('24:00', '25:00'), ('19:75', '21:00'), ('20:00', '19:30'), ('20:00', '20:00')]:
            with self.subTest(start=start, end=end):
                status, body = self.admin.call('sessions', self.session_body(start=start, end=end))
                self.assertEqual(status, 422, body)
                self.assert_no_sessions()

    def test_kuyy_names_block_all_wednesday_participation_and_leave_2100_open(self):
        self.create_session(start='19:30', end='20:00')
        for key in ['anj-3-1930', 'anj-3-2030']:
            slot = self.slot(key)
            self.conflict(self.member.call('requests', {'slot_id': slot['id'], 'date': self.day(3),
                                                        'name': 'Private', 'pax': 1, 'kind': 'coaching'}))
        self.ok(self.accept(self.price(self.request('anj-3-2100'))))

    def test_kuyy_member_ids_block_entire_friday_participation(self):
        self.create_session(day=5, start='20:00', end='20:30', coach_names='', coach_ids=[self.users['Anjas']])
        for key in ['anj-5-1900', 'anj-5-2000']:
            slot = self.slot(key)
            self.conflict(self.member.call('requests', {'slot_id': slot['id'], 'date': self.day(5),
                                                        'name': 'Private', 'pax': 1, 'kind': 'coaching'}))

    def test_private_accept_blocks_later_kuyy_assignment_even_if_display_interval_does_not_overlap(self):
        self.ok(self.accept(self.price(self.request('anj-3-2030'))))
        self.conflict(self.admin.call('sessions', self.session_body(start='19:30', end='20:00')))
        self.assertEqual(self.site.sql('SELECT COUNT(*) AS n FROM play_sessions')[0]['n'], 1)

    def test_kuyy_after_quote_is_checked_again_at_acceptance(self):
        request = self.price(self.request())
        self.create_session(start='19:30', end='20:00')
        self.conflict(self.accept(request))
        self.assertEqual(self.site.sql('SELECT COUNT(*) AS n FROM play_sessions WHERE request_id IS NOT NULL')[0]['n'], 0)

    def test_kuyy_before_price_is_checked_when_admin_quotes(self):
        request = self.request()
        self.create_session(start='19:30', end='20:00')
        self.conflict(self.admin.call('requests/' + str(request['id']),
                                     {'action': 'price', 'price': 0}))

    def test_other_coach_kuyy_does_not_consume_anjas(self):
        self.create_session(coach_names='Degung, Jordy')
        self.ok(self.accept(self.price(self.request())))

    def test_grouped_degung_jordy_is_one_capacity(self):
        # A single assigned member of the combined resource occupies that group.
        slot = next(s for s in self.original_slots if s['coach_key'] == 'degung_jordy'
                    and s['status'] == 'AVAILABLE_FIXED')
        self.create_session(day=int(slot['day_iso']), start=slot['start_time'], end=slot['end_time'],
                            title='Existing coaching', coach_names='', coach_ids=[self.users['Degung']])
        self.conflict(self.member.call('requests', {'slot_id': slot['id'], 'date': self.day(int(slot['day_iso'])),
                                                    'name': 'Private', 'pax': 1, 'kind': 'coaching'}))

    def test_status_change_after_quote_prevents_acceptance(self):
        for status in ['BLOCKED_KUYY', 'BLOCKED_REGULAR', 'OFF', 'NOT_AVAILABLE']:
            with self.subTest(status=status):
                self.setUp()
                request = self.price(self.request())
                self.ok(self.edit_slot('anj-3-2030', status=status))
                self.conflict(self.accept(request))
                self.assert_no_sessions()

    def test_status_change_before_quote_prevents_pricing(self):
        request = self.request()
        self.ok(self.edit_slot('anj-3-2030', status='OFF'))
        self.conflict(self.admin.call('requests/' + str(request['id']), {'action': 'price', 'price': 0}))

    def test_fixed_court_change_does_not_accept_stale_offer(self):
        request = self.price(self.request('anj-3-2100'))
        self.ok(self.edit_slot('anj-3-2100', court='Replacement court'))
        self.conflict(self.accept(request))
        self.assert_no_sessions()

    def test_old_quote_cannot_accept_a_new_price_without_fresh_confirmation(self):
        first = self.price(self.request(), 175000)
        second = self.price(first, 225000)
        self.conflict(self.accept(first))
        self.assert_no_sessions()
        accepted = self.ok(self.accept(second))
        self.assertEqual(self.site.sql('SELECT fee FROM play_sessions WHERE id=?', [accepted['session_id']])[0]['fee'], 225000)

    def test_closing_and_reopening_slot_does_not_reactivate_old_quote(self):
        request = self.price(self.request())
        self.ok(self.edit_slot('anj-3-2030', status='OFF'))
        self.ok(self.edit_slot('anj-3-2030'))
        self.conflict(self.accept(request))
        self.assert_no_sessions()
        fresh = self.price(request)
        self.ok(self.accept(fresh))

    def test_explicit_kuyy_mapping_blocks_capacity_without_matching_display_name(self):
        self.create_session(title='Community drills', coach_names='Coach A',
                            schedule_coach_keys=['anjas'], schedule_channel='kuyy')
        slot = self.slot('anj-3-2030')
        self.conflict(self.member.call('requests', {'slot_id': slot['id'], 'date': self.day(3),
                                                    'name': 'Private', 'pax': 1, 'kind': 'coaching'}))

    def test_schedule_exposes_assigned_kuyy_participation_and_no_other_week_lock(self):
        self.create_session(start='19:30', end='20:00')
        schedule = self.ok(self.member.call('schedule&coach=anjas&week=' + self.day(1)))
        busy = [b for b in schedule['booked'] if b['date'] == self.day(3)]
        self.assertTrue(any(b['start'] == '19:30' and b['end'] == '21:00' for b in busy), busy)
        next_week = (self.monday + dt.timedelta(days=7)).isoformat()
        later = self.ok(self.member.call('schedule&coach=anjas&week=' + next_week))
        self.assertEqual(later['booked'], [])

    def test_legacy_coach_assignments_remain_visible_without_backfill(self):
        session = self.create_session(start='19:30', end='20:00', coach_names='', coach_ids=[self.users['Anjas']])
        if 'schedule_coach_keys' in session:
            self.site.sql("UPDATE play_sessions SET schedule_coach_keys='', schedule_channel='' WHERE id=?", [session['id']])
        slot = self.slot('anj-3-2030')
        self.conflict(self.member.call('requests', {'slot_id': slot['id'], 'date': self.day(3),
                                                    'name': 'Private', 'pax': 1, 'kind': 'coaching'}))

    def test_explicit_unassignment_does_not_resurrect_legacy_scalar_coach(self):
        session = self.create_session(start='20:30', end='21:00', title='Legacy coaching')
        self.site.sql("UPDATE play_sessions SET coach_id=?, coach_name='Anjas', coach_ids='', coach_names='', "
                      "schedule_coach_keys='', schedule_channel='' WHERE id=?",
                      [self.users['Anjas'], session['id']])
        slot = self.slot('anj-3-2030')
        self.conflict(self.member.call('requests', {'slot_id': slot['id'], 'date': self.day(3),
                                                    'name': 'Private', 'pax': 1, 'kind': 'coaching'}))
        self.ok(self.admin.call('sessions/' + str(session['id']), self.session_body(
            start='20:30', end='21:00', title='Uncoached play', activity='mabar', coach_names='',
            schedule_coach_keys=[], schedule_channel='session')))
        saved = self.site.sql('SELECT * FROM play_sessions WHERE id=?', [session['id']])[0]
        self.assertEqual(saved['schedule_coach_keys'], '')
        self.assertEqual(saved['schedule_channel'], 'session')
        self.assertEqual(saved['coach_id'], self.users['Anjas'])
        self.assertEqual(saved['coach_name'], 'Anjas')
        self.ok(self.accept(self.price(self.request())))

    def test_stable_coach_mapping_survives_member_rename_and_metadata_edit(self):
        session = self.create_session(coach_names='', coach_ids=[self.users['Anjas']],
                                      schedule_coach_keys=['anjas'], schedule_channel='kuyy')
        try:
            self.ok(self.clients['Anjas'].call('me', {'name': 'Renamed Tennis Coach'}))
            # An old client sends the same coach identities and changes only title;
            # neither a renamed member nor missing new fields may release capacity.
            self.ok(self.admin.call('sessions/' + str(session['id']), self.session_body(
                title='Updated event title', coach_names='', coach_ids=[self.users['Anjas']])))
            saved = self.site.sql('SELECT * FROM play_sessions WHERE id=?', [session['id']])[0]
            self.assertEqual(saved['schedule_coach_keys'], 'anjas')
            self.assertEqual(saved['schedule_channel'], 'kuyy')
            slot = self.slot('anj-3-2030')
            self.conflict(self.member.call('requests', {'slot_id': slot['id'], 'date': self.day(3),
                                                        'name': 'Private', 'pax': 1, 'kind': 'coaching'}))
        finally:
            self.ok(self.clients['Anjas'].call('me', {'name': 'Anjas'}))

    def test_old_client_coach_membership_edit_requires_explicit_schedule_mapping(self):
        session = self.create_session(title='Standard coaching', start='20:30', end='21:00',
                                      coach_names='', coach_ids=[self.users['Anjas']],
                                      schedule_coach_keys=['anjas'], schedule_channel='session')
        try:
            self.ok(self.clients['Anjas'].call('me', {'name': 'Renamed Tennis Coach'}))
            before = self.site.sql('SELECT * FROM play_sessions WHERE id=?', [session['id']])[0]
            status, body = self.admin.call('sessions/' + str(session['id']), self.session_body(
                title='Standard coaching', start='20:30', end='21:00',
                coach_names='', coach_ids=[self.users['Anjas'], self.users['Member B']]))
            self.assertEqual(status, 422, body)
            self.assertEqual(self.site.sql('SELECT * FROM play_sessions WHERE id=?', [session['id']])[0], before)
        finally:
            self.ok(self.clients['Anjas'].call('me', {'name': 'Anjas'}))

    def test_explicit_kuyy_source_survives_title_rename(self):
        session = self.create_session(title='Kuyy community session', coach_names='Anjas',
                                      schedule_coach_keys=['anjas'], schedule_channel='kuyy')
        self.ok(self.admin.call('sessions/' + str(session['id']), self.session_body(
            title='Renamed community session', coach_names='Anjas')))
        saved = self.site.sql('SELECT * FROM play_sessions WHERE id=?', [session['id']])[0]
        self.assertEqual(saved['schedule_channel'], 'kuyy')
        slot = self.slot('anj-3-2030')
        self.conflict(self.member.call('requests', {'slot_id': slot['id'], 'date': self.day(3),
                                                    'name': 'Private', 'pax': 1, 'kind': 'coaching'}))

    def test_recurring_kuyy_marker_blocks_sibling_half_hour_but_not_2100(self):
        offered = self.price(self.request('anj-3-2030'))
        self.ok(self.edit_slot('anj-3-1930', status='BLOCKED_KUYY'))
        self.conflict(self.accept(offered))
        sibling = self.slot('anj-3-2030')
        self.conflict(self.other.call('requests', {'slot_id': sibling['id'], 'date': self.day(3),
                                                   'name': 'Private', 'pax': 1, 'kind': 'coaching'}))
        self.ok(self.accept(self.price(self.request('anj-3-2100'))))

    def test_future_private_booking_prevents_recurring_kuyy_commitment(self):
        accepted = self.ok(self.accept(self.price(self.request('anj-3-2030'))))
        before = self.site.sql('SELECT * FROM play_sessions WHERE id=?', [accepted['session_id']])[0]
        self.conflict(self.edit_slot('anj-3-1930', status='BLOCKED_KUYY'))
        self.assertEqual(self.site.sql('SELECT status FROM coach_slots WHERE id=?',
                                       [self.slot('anj-3-1930')['id']])[0]['status'], 'AVAILABLE_PRIVATE_OR_KUYY')
        self.assertEqual(self.site.sql('SELECT * FROM play_sessions WHERE id=?', [accepted['session_id']])[0], before)

    def test_unassigned_private_or_kuyy_slots_are_independently_bookable(self):
        first = self.price(self.request('anj-3-1930'))
        second = self.price(self.request('anj-3-2030', client=self.other))
        self.ok(self.accept(first))
        self.ok(self.accept(second, self.other))
        self.assertEqual(self.site.sql('SELECT COUNT(*) AS n FROM play_sessions')[0]['n'], 2)

    def test_actual_kuyy_session_can_fulfil_recurring_marker_once(self):
        self.ok(self.edit_slot('anj-3-1930', status='BLOCKED_KUYY'))
        session = self.create_session(schedule_coach_keys=['anjas'], schedule_channel='kuyy')
        self.assertEqual(session['schedule_channel'], 'kuyy')
        self.conflict(self.admin.call('sessions', self.session_body(
            schedule_coach_keys=['anjas'], schedule_channel='kuyy')))
        self.assertEqual(self.site.sql('SELECT COUNT(*) AS n FROM play_sessions')[0]['n'], 1)

    def test_anjas_kuyy_cannot_use_private_only_wednesday_2100(self):
        status, response = self.admin.call('sessions', self.session_body(start='21:00', end='22:00',
                                                                      schedule_coach_keys=['anjas'], schedule_channel='kuyy'))
        self.assertIn(status, [409, 422], response)
        self.assert_no_sessions()

    def test_private_hitting_consumes_same_coach_capacity(self):
        accepted = self.ok(self.accept(self.price(self.request(kind='hitting'))))
        self.assertEqual(self.site.sql('SELECT activity FROM play_sessions WHERE id=?', [accepted['session_id']])[0]['activity'], 'hitting')
        self.conflict(self.admin.call('sessions', self.session_body()))

    def test_capacity_edit_of_existing_private_cannot_desynchronize_request(self):
        request = self.price(self.request())
        accepted = self.ok(self.accept(request))
        before = self.site.sql('SELECT * FROM play_sessions WHERE id=?', [accepted['session_id']])[0]
        self.conflict(self.admin.call('sessions/' + str(accepted['session_id']),
                                     self.session_body(start='21:00', end='22:00', title=before['title'])))
        self.assertEqual(self.site.sql('SELECT * FROM play_sessions WHERE id=?', [accepted['session_id']])[0], before)
        self.assertEqual(self.site.sql('SELECT start_time FROM slot_requests WHERE id=?', [request['id']])[0]['start_time'], '20:30')

    def test_v29_upgrade_preserves_existing_bookings_payments_and_slot_edits(self):
        if int(self.site.sql("SELECT v FROM meta WHERE k='schema'")[0]['v']) < 30:
            self.skipTest('Baseline v29 has no v30 additive upgrade')
        request = self.price(self.request())
        accepted = self.ok(self.accept(request))
        self.ok(self.admin.call('sessions/' + str(accepted['session_id']) + '/payments',
                                {'action': 'mark_paid', 'user_id': self.users['Member A']}))
        self.ok(self.edit_slot('anj-3-2100', note='Admin edit to retain'))
        self.site.fixture({'queries': [
            {'sql': 'ALTER TABLE play_sessions DROP COLUMN schedule_coach_keys'},
            {'sql': 'ALTER TABLE play_sessions DROP COLUMN schedule_channel'},
            {'sql': "UPDATE meta SET v='29' WHERE k='schema'"},
        ]})
        # Read with Python/SQL through one connection would auto-migrate. Instead
        # the migration's own pre-v30 backup proves the actual prior schema data.
        self.ok(self.member.call('requests'))
        backups = sorted((self.site.public / 'api/data/backups').glob('pre-v30-*.json'))
        self.assertTrue(backups, 'The existing-db backup must be written before the additive migration')
        old = json.loads(backups[-1].read_text())['tables']
        self.assertEqual(int(self.site.sql("SELECT v FROM meta WHERE k='schema'")[0]['v']), 30)
        for table in ['slot_requests', 'registrations', 'coach_slots']:
            self.assertEqual(self.site.sql('SELECT * FROM ' + table + ' ORDER BY id'), sorted(old[table], key=lambda r: r['id']), table)
        sessions = self.site.sql('SELECT * FROM play_sessions ORDER BY id')
        for session in sessions:
            self.assertEqual(session.pop('schedule_coach_keys'), '')
            self.assertEqual(session.pop('schedule_channel'), '')
        self.assertEqual(sessions, old['play_sessions'])

    def test_legacy_priced_request_with_existing_private_cannot_accept_or_reprice_again(self):
        request = self.price(self.request())
        accepted = self.ok(self.accept(request))
        # Reproduce the inconsistency an old writer race can leave behind: the
        # actual session points to the request, whose row looks open again.
        self.site.sql("UPDATE slot_requests SET status='priced', session_id=NULL WHERE id=?", [request['id']])
        before_request = self.site.sql('SELECT * FROM slot_requests WHERE id=?', [request['id']])[0]
        before_session = self.site.sql('SELECT * FROM play_sessions WHERE id=?', [accepted['session_id']])[0]
        self.conflict(self.accept(request))
        self.conflict(self.admin.call('requests/' + str(request['id']),
                                     {'action': 'price', 'price': 225000, 'bank_account': 'TEST-ONLY'}))
        self.assertEqual(self.site.sql('SELECT * FROM slot_requests WHERE id=?', [request['id']])[0], before_request)
        self.assertEqual(self.site.sql('SELECT * FROM play_sessions WHERE id=?', [accepted['session_id']])[0], before_session)
        self.assertEqual(self.site.sql('SELECT COUNT(*) AS n FROM play_sessions')[0]['n'], 1)

    def test_session_edit_cannot_assign_anjas_over_accepted_private(self):
        self.ok(self.accept(self.price(self.request())))
        session = self.create_session(coach_names='Jordy')
        body = self.session_body(coach_names='Anjas', schedule_coach_keys=['anjas'], schedule_channel='kuyy')
        self.conflict(self.admin.call('sessions/' + str(session['id']), body))
        saved = self.site.sql('SELECT coach_names FROM play_sessions WHERE id=?', [session['id']])[0]
        self.assertEqual(saved['coach_names'], 'Jordy')

    def test_deleting_accepted_session_reopens_slot_and_keeps_history(self):
        request = self.price(self.request())
        accepted = self.ok(self.accept(request))
        self.ok(self.admin.call('sessions/' + str(accepted['session_id']) + '/delete', {}))
        saved = self.site.sql('SELECT * FROM slot_requests WHERE id=?', [request['id']])[0]
        self.assertEqual(saved['status'], 'cancelled')
        self.assertEqual(saved['price'], 175000)
        self.ok(self.accept(self.price(self.request(client=self.other)), self.other))

    def test_availability_edit_preserves_existing_approved_booking_and_payment(self):
        request = self.price(self.request())
        accepted = self.ok(self.accept(request))
        self.ok(self.admin.call('sessions/' + str(accepted['session_id']) + '/payments',
                                {'action': 'mark_paid', 'user_id': self.users['Member A']}))
        before = self.site.sql('SELECT * FROM slot_requests WHERE id=?', [request['id']])[0]
        payment = self.site.sql('SELECT * FROM registrations WHERE session_id=?', [accepted['session_id']])[0]
        self.ok(self.edit_slot('anj-3-2030', status='OFF'))
        self.assertEqual(self.site.sql('SELECT * FROM slot_requests WHERE id=?', [request['id']])[0], before)
        self.assertEqual(self.site.sql('SELECT * FROM registrations WHERE session_id=?', [accepted['session_id']])[0], payment)
        mine = self.ok(self.member.call('schedule&coach=anjas&week=' + self.day(1)))
        other = self.ok(self.other.call('schedule&coach=anjas&week=' + self.day(1)))
        closed = next(slot for slot in mine['slots'] if slot['id'] == request['slot_id'])
        self.assertFalse(closed['open'])
        own_bookings = [item for item in mine['booked'] if item['date'] == self.day(3)
                        and item['start'] == '20:30' and item['end'] == '21:00']
        other_bookings = [item for item in other['booked'] if item['date'] == self.day(3)
                          and item['start'] == '20:30' and item['end'] == '21:00']
        self.assertTrue(own_bookings)
        self.assertTrue(other_bookings)
        self.assertTrue(all(item['mine'] and item['session_id'] == accepted['session_id'] for item in own_bookings))
        self.assertTrue(all(not item['mine'] and item['session_id'] is None for item in other_bookings))
        self.assertTrue(all(set(item) == {'date', 'start', 'end', 'mine', 'session_id'} for item in other_bookings))
        self.assertEqual(other['pending'], [])

    def test_private_session_detail_is_limited_to_requester_and_admin(self):
        accepted = self.ok(self.accept(self.price(self.request())))
        route = 'sessions/' + str(accepted['session_id'])
        self.ok(self.member.call(route))
        self.ok(self.admin.call(route))
        anonymous = Client(self.site)
        for name, client in [('other member', self.other), ('anonymous', anonymous)]:
            with self.subTest(actor=name):
                status, body = client.call(route)
                self.assertEqual(status, 403, body)
        public = self.create_session(title='Public play', activity='mabar',
                                     start='09:00', end='10:00', coach_names='')
        self.ok(self.other.call('sessions/' + str(public['id'])))
        self.ok(anonymous.call('sessions/' + str(public['id'])))

    def login_again(self, name='Member A'):
        client = Client(self.site)
        self.ok(client.call('auth/login', {'email': name.lower().replace(' ', '.') + '@example.test',
                                          'password': 'test-password-only'}))
        return client

    def race(self, first, second):
        barrier = threading.Barrier(2)
        def call(fn):
            barrier.wait(timeout=5)
            return fn()
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(call, first), pool.submit(call, second)]
            return [future.result(timeout=20) for future in futures]

    def slow_session_inserts(self):
        if ARGS.backend == 'mysql':
            # Widen the old check-then-insert race using a fixture-only trigger;
            # no production hooks, source rewrites or arbitrary sleeps in app code.
            self.site.sql('CREATE TRIGGER test_slow_session_insert BEFORE INSERT ON play_sessions '
                          'FOR EACH ROW DO SLEEP(0.20)')

    def test_simultaneous_accept_same_request_creates_exactly_one_session(self):
        request = self.price(self.request())
        second_login = self.login_again()
        self.slow_session_inserts()
        results = self.race(lambda: self.accept(request), lambda: self.accept(request, second_login))
        self.assertEqual(sorted(status for status, _ in results), [200, 409], results)
        sessions = self.site.sql('SELECT * FROM play_sessions WHERE request_id=?', [request['id']])
        self.assertEqual(len(sessions), 1)
        saved = self.site.sql('SELECT * FROM slot_requests WHERE id=?', [request['id']])[0]
        self.assertEqual(saved['session_id'], sessions[0]['id'])

    def test_simultaneous_accept_two_members_has_one_winner_no_server_error(self):
        first = self.price(self.request())
        second = self.price(self.request(client=self.other))
        self.slow_session_inserts()
        results = self.race(lambda: self.accept(first), lambda: self.accept(second, self.other))
        self.assertEqual(sorted(status for status, _ in results), [200, 409], results)
        self.assertEqual(self.site.sql('SELECT COUNT(*) AS n FROM play_sessions')[0]['n'], 1)
        self.assertEqual(sorted(r['status'] for r in self.site.sql('SELECT status FROM slot_requests')),
                         ['approved', 'taken'])

    def test_simultaneous_private_accept_and_kuyy_assignment_has_one_winner(self):
        request = self.price(self.request())
        self.slow_session_inserts()
        results = self.race(lambda: self.accept(request),
                            lambda: self.admin.call('sessions', self.session_body()))
        self.assertEqual(sorted(status for status, _ in results), [200, 409], results)
        self.assertEqual(self.site.sql('SELECT COUNT(*) AS n FROM play_sessions')[0]['n'], 1)

    def test_accept_racing_cancel_cannot_leave_an_orphan_private_session(self):
        request = self.price(self.request())
        second_login = self.login_again()
        self.slow_session_inserts()
        results = self.race(lambda: self.accept(request),
                            lambda: second_login.call('requests/' + str(request['id']), {'action': 'cancel'}))
        self.assertEqual(sorted(status for status, _ in results), [200, 409], results)
        saved = self.site.sql('SELECT * FROM slot_requests WHERE id=?', [request['id']])[0]
        sessions = self.site.sql('SELECT * FROM play_sessions WHERE request_id=?', [request['id']])
        self.assertIn(saved['status'], ['approved', 'cancelled'])
        self.assertEqual(len(sessions), 1 if saved['status'] == 'approved' else 0)

    def test_accept_racing_reprice_keeps_fee_and_request_consistent(self):
        request = self.price(self.request())
        self.slow_session_inserts()
        results = self.race(lambda: self.accept(request),
                            lambda: self.admin.call('requests/' + str(request['id']),
                                                    {'action': 'price', 'price': 225000, 'bank_account': 'TEST-ONLY'}))
        self.assertTrue(all(status in [200, 409] for status, _ in results), results)
        saved = self.site.sql('SELECT * FROM slot_requests WHERE id=?', [request['id']])[0]
        sessions = self.site.sql('SELECT * FROM play_sessions WHERE request_id=?', [request['id']])
        if saved['status'] == 'approved':
            self.assertEqual(len(sessions), 1)
            self.assertEqual(sessions[0]['fee'], saved['price'])
        else:
            self.assertEqual(sessions, [])

    def test_accept_racing_slot_close_respects_commit_order(self):
        request = self.price(self.request())
        self.slow_session_inserts()
        results = self.race(lambda: self.accept(request),
                            lambda: self.edit_slot('anj-3-2030', status='OFF'))
        self.assertTrue(all(status in [200, 409] for status, _ in results), results)
        saved = self.site.sql('SELECT * FROM slot_requests WHERE id=?', [request['id']])[0]
        sessions = self.site.sql('SELECT * FROM play_sessions WHERE request_id=?', [request['id']])
        self.assertEqual(len(sessions), 1 if saved['status'] == 'approved' else 0)
        # Existing bookings survive a subsequent template edit; an edit that wins
        # first must be re-read by accept. Both serialized orders are legitimate.
        self.assertEqual(results[1][0], 200, results)

    def accept_after_committed_change(self, request, queries):
        """Force accept to wait while another transaction commits new state.

        INNODB_LOCK_WAITS is polled for a real wait, so the test does not rely on
        scheduling luck or a sleep duration to choose the winning transaction.
        """
        if ARGS.backend != 'mysql':
            self.skipTest('Deterministic row-lock ordering is tested on MariaDB')
        gate = subprocess.Popen([ARGS.php, str(ROOT / 'tests/db_fixture.php'), str(self.site.public),
                                 'rata-booking-tests'], env=self.site.env, text=True,
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        try:
            gate.stdin.write(json.dumps({'mode': 'gate', 'request_id': request['id']}) + '\n')
            gate.stdin.flush()
            self.assertEqual(gate.stdout.readline().strip(), 'READY')
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(self.accept, request)
                deadline = time.monotonic() + 8
                while time.monotonic() < deadline:
                    waiting = self.site.sql('SELECT COUNT(*) AS n FROM information_schema.INNODB_LOCK_WAITS')[0]['n']
                    if int(waiting):
                        break
                    if future.done():
                        self.fail('Acceptance did not wait for the locked booking transaction: ' + str(future.result()))
                    time.sleep(.02)
                else:
                    diagnostic = self.site.sql('SHOW FULL PROCESSLIST')
                    gate.stdin.write(json.dumps({'queries': []}) + '\n')
                    gate.stdin.flush()
                    gate.stdout.readline()
                    self.fail('API did not reach the row-lock barrier: ' + repr(diagnostic))
                gate.stdin.write(json.dumps({'queries': queries}) + '\n')
                gate.stdin.flush()
                self.assertEqual(gate.stdout.readline().strip(), 'COMMITTED')
                response = future.result(timeout=20)
            self.assertEqual(gate.wait(timeout=5), 0, gate.stderr.read())
            return response
        finally:
            if gate.poll() is None:
                gate.kill()
                gate.wait()
            for pipe in (gate.stdin, gate.stdout, gate.stderr):
                pipe.close()

    def test_accept_rereads_cancelled_request_after_waiting_for_writer(self):
        request = self.price(self.request())
        response = self.accept_after_committed_change(request, [
            {'sql': "UPDATE slot_requests SET status='cancelled' WHERE id=?", 'args': [request['id']]},
        ])
        self.conflict(response)
        self.assert_no_sessions()
        self.assertEqual(self.site.sql('SELECT status FROM slot_requests WHERE id=?', [request['id']])[0]['status'], 'cancelled')

    def test_accept_rereads_repriced_offer_after_waiting_for_writer(self):
        request = self.price(self.request())
        response = self.accept_after_committed_change(request, [
            {'sql': 'UPDATE slot_requests SET price=225000 WHERE id=?', 'args': [request['id']]},
        ])
        self.conflict(response)
        self.assert_no_sessions()
        self.assertEqual(self.site.sql('SELECT price FROM slot_requests WHERE id=?', [request['id']])[0]['price'], 225000)

    def test_accept_rereads_availability_after_waiting_for_writer(self):
        request = self.price(self.request())
        response = self.accept_after_committed_change(request, [
            {'sql': "UPDATE coach_slots SET status='OFF' WHERE id=?", 'args': [request['slot_id']]},
        ])
        self.conflict(response)
        self.assert_no_sessions()


if __name__ == '__main__':
    print('Booking regression backend:', ARGS.backend, '| source:', ARGS.source, flush=True)
    unittest.main(argv=[sys.argv[0], '-v', *UNITTEST_ARGS])
