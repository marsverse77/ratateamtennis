/* RATA Team: single-page app. Talks to api/index.php. */
(function () {
  'use strict';

  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const state = { user: null, pollTimer: null, route: '' };

  // ---------- utils ----------

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  // Smaller copy of an uploaded photo (shorter side at most w px: 200, 400 or 720) for places that show it small.
  // The full photo is only loaded where it is opened (photo viewer, transfer proof link).
  const thumb = (url, w = 400) => {
    const m = /^uploads\/((?:avatars|sessions|banners|blog)\/[\w.-]+\.(?:jpe?g|png|webp))$/.exec(url || '');
    return m ? `api/thumb.php?w=${w}&p=${encodeURIComponent(m[1])}` : url;
  };
  const AV = ['#cfe3f1', '#d5e3d3', '#fbf39a', '#f4dccb', '#dcd6f0'];
  const avatar = (p, cls = '') => p.photo
    ? `<span class="avatar photo ${cls}" style="background-image:url('${esc(thumb(p.photo, 200))}')" role="img" aria-label="${esc(p.name)}"></span>`
    : `<span class="avatar ${cls}" style="--av:${AV[(p.id || 0) % AV.length]}">${esc(initials(p.name))}</span>`;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const parseDate = (d) => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd); };
  const fmtDate = (d) => { const x = parseDate(d); return `${String(x.getDate()).padStart(2, '0')} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`; };
  const fmtDay = (d) => { const x = parseDate(d); return `${DAYS[x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}`; };
  const teamName = (t) => t.map((p) => esc(p.name)).join(' / ');
  const isAdmin = () => state.user && state.user.role === 'admin';
  const isCoach = () => state.user && ['admin', 'coach'].includes(state.user.role);
  const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');
  const LEVELS = { first_timer: 'First Timer', newbie: 'Newbie', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  const GENDERS = { male: 'Male', female: 'Female' };
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  // RATA wordmark (traced from the club logo, white on transparent).
  const LOGO = '<img class="logo" src="assets/img/mark.svg" alt="RATA">';
  const LOGO_TEAM = '<span class="logo-team"><img class="logo" src="assets/img/mark.svg" alt="RATA"><b>TEAM</b></span>';
  const ICON = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 4 6"/></svg>',
    person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    court: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M12 4v16M3 12h18M7 4v16M17 4v16"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/></svg>',
    chart: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="12" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="12" rx="1"/><rect x="16" y="4" width="4" height="16" rx="1"/></svg>',
    ball: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M5.5 6.5c3 2.5 3 8.5 0 11M18.5 6.5c-3 2.5-3 8.5 0 11"/></svg>',
    bars: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 20v-6M10 20V9M15 20v-8M20 20V4"/></svg>',
    palm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22c0-6 .5-10 1-13M13 9c-2-3-6-4-9-2 3 0 6 1 9 2zM13 9c1-3 5-5 8-4-3 1-6 2-8 4zM13 9c-3-1-6 1-7 4 2-2 5-3 7-4zM13 9c3 0 6 2 6 5-2-2-4-4-6-5z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    cash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/></svg>',
    insta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    crop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  };

  // A random id for this browser, so the scorer can tell this device from another one scoring the same match.
  const DEVICE = (() => {
    let id = '';
    try { id = localStorage.getItem('bcs_device') || ''; } catch (e) { /* storage blocked */ }
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { localStorage.setItem('bcs_device', id); } catch (e) { /* storage blocked */ }
    }
    return id;
  })();

  async function api(route, body) {
    const opts = { credentials: 'same-origin', headers: { 'X-Device': DEVICE } };
    if (body !== undefined) {
      opts.method = 'POST';
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['X-Requested-With'] = 'bcs';
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch('api/index.php?r=' + route, opts);
    } catch (e) {
      throw new Error('Network error. Check your connection.');
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function toast(msg, isErr) {
    const el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function formData(form) {
    const out = {};
    for (const el of form.elements) {
      if (!el.name || (el.type === 'radio' && !el.checked)) continue;
      out[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    }
    return out;
  }

  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  function poll(fn, ms) {
    stopPolling();
    state.pollTimer = setInterval(() => {
      if (document.hidden || modalRoot.firstChild) return;
      fn().catch(() => {});
    }, ms);
  }

  // ---------- shell ----------

  function renderTop() {
    const el = document.getElementById('top-actions');
    const L = window.BCS_LANG ? window.BCS_LANG.get() : 'en';
    const langBtn = `<button class="lang-btn" data-lang title="Bahasa Indonesia / English" data-notr><span class="${L === 'id' ? 'on' : ''}">ID</span> | <span class="${L === 'en' ? 'on' : ''}">EN</span></button>`;
    if (state.user) {
      el.innerHTML = `${langBtn}
        ${isAdmin() ? `<a class="btn sm ghost-light act-bell" href="#/activity" title="Member activity">Activity${state.unread ? `<span class="bell-count">${state.unread > 99 ? '99+' : state.unread}</span>` : ''}</a>` : ''}
        ${isAdmin() ? '<a class="btn sm ghost-light hide-m hide-l" href="#/approvals">Approvals</a><a class="btn sm ghost-light hide-m" href="#/finance">Finance</a><a class="btn sm ghost-light hide-m" href="#/sessions/new">+ New session</a>' : ''}
        <a class="btn sm ghost-light chat-top" href="#/chat" title="Chats" aria-label="Chats">${ICON.chat}</a>
        <a class="user-chip" href="#/me" title="My account">${avatar(state.user, 'dark')}<span class="hide-m">${esc(state.user.name.split(' ')[0])}</span></a>`;
    } else {
      el.innerHTML = `${langBtn}<a class="btn sm ghost-light hide-m" href="#/login">Log in</a><a class="btn" href="#/register">Join<span class="hide-m">&nbsp;the club</span> <span class="arrow"></span></a>`;
    }
  }

  // Admins: the count of member activity they haven't looked at yet, shown on the Activity button.
  async function refreshUnread() {
    if (!isAdmin()) return;
    try { const n = (await api('me')).activity_unread || 0; if (n !== state.unread) { state.unread = n; renderTop(); } } catch (e) { /* offline */ }
  }

  function setNav(key) {
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === key));
  }

  function needLogin(msg) {
    app.innerHTML = `<div class="wrap"><div class="card pad empty">
      ${LOGO}
      <h2>Members only</h2><p>${esc(msg || 'Log in to see your points and sessions.')}</p>
      <div class="row" style="justify-content:center"><a class="btn dark" href="#/login">Log in</a><a class="btn ghost" href="#/register">Create account</a></div>
    </div></div>`;
  }

  function showError(e) {
    if (e.status === 401) return needLogin();
    app.innerHTML = `<div class="wrap"><div class="card pad empty"><h2>Hmm.</h2><p>${esc(e.message)}</p><a class="btn dark" href="#/">Go home</a></div></div>`;
  }

  // ---------- shared pieces ----------

  function sessionCard(s, i, mine, waiting) {
    const d = parseDate(s.date);
    const full = s.joined >= s.max_players;
    const accepting = s.status === 'open' || s.status === 'live';
    let action;
    // Live sessions: players who joined get "Watch live"; everyone else is invited to join.
    if (s.status === 'live' && mine) action = `<a class="btn dark" href="#/sessions/${s.id}">Watch live <span class="arrow"></span></a>`;
    else if (mine) action = `<a class="btn ghost" href="#/sessions/${s.id}">You're in ✓</a>`;
    else if (waiting) action = `<a class="btn ghost" href="#/sessions/${s.id}">On the waiting list</a>`;
    else if (accepting && !full) action = `<a class="btn ${i % 2 ? 'ghost' : ''}" href="#/sessions/${s.id}">Join <span class="arrow"></span></a>`;
    else if (s.status === 'live') action = `<a class="btn dark" href="#/sessions/${s.id}">Watch live <span class="arrow"></span></a>`;
    else action = `<a class="btn ghost" href="#/sessions/${s.id}">${full && accepting ? 'Full · join waiting list' : 'View'}</a>`;
    const banner = s.banner_square || s.banner_wide;
    return `
      <article class="card scard">
        <div class="scard-img" ${banner ? `style="background-image:url('${esc(thumb(banner))}')"` : ''}>${banner ? '' : posterArt(s)}
          <div class="date-badge"><b>${String(d.getDate()).padStart(2, '0')}</b><span>${MONTHS[d.getMonth()]}</span></div>
          <div class="price-badge">${s.fee ? esc(rupiah(s.fee)) : 'Free'}</div>
        </div>
        <div>
          <h3><a href="#/sessions/${s.id}" style="text-decoration:none">${esc(s.title)}</a></h3>
          <p class="scard-tags">${activityTag(s)}${s.status === 'live' ? '<span class="tag live">Live now</span>' : ''}</p>
          <ul class="meta">
            <li>${ICON.clock}${esc(fmtDay(s.date))} · ${esc(s.start_time)}–${esc(s.end_time)} WITA</li>
            <li>${ICON.people}${s.hitting ? `${esc(s.hitting.format)} · ${esc(s.hitting.level)}` : s.coaches && s.coaches.length ? `Coach ${esc(s.coaches.map((c) => c.name).join(', '))}` : s.with_games ? esc(s.format_label) : 'Drills'} · ${s.courts} court${s.courts > 1 ? 's' : ''}</li>
            <li>${ICON.person}${s.joined} / ${s.max_players} joined${s.waiting ? ` · ${s.waiting} waiting` : ''}</li>
            ${s.location ? `<li>${ICON.pin}${esc(s.location)}</li>` : ''}
          </ul>
          ${action}
        </div>
      </article>`;
  }

  // Session card artwork when the admin hasn't uploaded a banner: the wordmark, the session type and its title.
  function posterArt(s) {
    const kind = { mabar: 'Play session', mini: 'Internal tournament', external: 'External tournament', coaching: 'Coaching session', hitting: 'Hitting session' }[s.activity] || 'Session';
    return `<div class="poster">${LOGO}<small>${esc(kind)}</small><b>${esc(s.title)}</b></div>`;
  }

  function boardTable(rows, opts = {}) {
    if (!rows.length) return `<div class="empty">${esc(opts.empty || 'No points yet.')}</div>`;
    return 'mabar' in rows[0] ? pointsBoard(rows, opts.cat || 'all') : sessionBoard(rows, opts);
  }

  // Men vs men, women vs women sessions: one leaderboard per gender.
  function sessionBoards(rows, opts = {}) {
    if (!rows.some((r) => r.gender !== undefined)) return boardTable(rows, opts);
    return [['male', 'Men'], ['female', 'Women'], ['', 'No gender set']].map(([g, label]) => {
      const list = rows.filter((r) => (r.gender || '') === g);
      return list.length ? `<h4 style="margin:12px 0 6px">${label}</h4>${boardTable(list, opts)}` : '';
    }).join('');
  }

  const boardRow = (r, me, cells) => `<tr class="${r.rank === 1 && (r.points > 0 || r.final) ? 'top' : ''} ${r.id === me ? 'me' : ''}">
    <td class="num">${r.rank}</td>
    <td><a class="person" href="#/members/${r.id}">${avatar(r, 'dark')}${esc(r.name)}</a>${r.final ? ` <span class="final-tag ${r.final}" title="${r.final === 'won' ? 'Won' : 'Lost'} the placement final">${r.final === 'won' ? '🏆 Final' : 'Final'}</span>` : ''}</td>
    ${cells}<td class="pts">${r.points}</td></tr>`;
  const signed = (n) => (n > 0 ? '+' : '') + n;

  // One session: RATA points are regular matches won. Game score, session stats and RATA points are kept apart.
  function sessionBoard(rows, opts = {}) {
    const me = state.user && state.user.id;
    const finals = rows.some((r) => r.final);
    return `<div class="table-scroll"><table class="board ${opts.compact ? 'compact' : ''}"><thead><tr><th class="num">#</th><th>Member</th>
      ${opts.compact ? '' : '<th class="num hide-m">Played</th>'}<th class="num" title="Regular matches won">W</th><th class="num" title="Regular matches lost">L</th>
      ${opts.compact ? '' : '<th class="num hide-m" title="Games won">GW</th><th class="num hide-m" title="Games lost">GL</th>'}<th class="num" title="Games won minus games lost">GD</th><th class="num" title="RATA ranking points">RATA pts</th></tr></thead><tbody>
      ${rows.map((r) => boardRow(r, me, `${opts.compact ? '' : `<td class="num hide-m">${r.played}</td>`}<td class="num">${r.wins}</td><td class="num">${r.losses}</td>
        ${opts.compact ? '' : `<td class="num hide-m">${r.gw}</td><td class="num hide-m">${r.gl}</td>`}<td class="num">${signed(r.diff)}</td>`)).join('')}
      </tbody></table></div>
      <p class="small muted board-legend">W / L = regular matches won and lost · GW / GL = games won and lost · GD = GW minus GL · RATA pts = +1 for attending (Play Session) and +1 for every regular match won. Order: W, then GD, then GW, then head-to-head.${finals ? ' The placement final decides the order between its players, with no points.' : ''}</p>`;
  }

  // RATA points from the points ledger. Every row has the same columns (match stats come from Play Sessions);
  // tapping the points opens the breakdown by source underneath.
  const LB_COUNT = { all: ['attended', 'Play Session'], mabar: ['attended', 'Play Session'], mini: ['mini_events', 'Internal Tournament'], external: ['external_events', 'External Tournament'] };
  // Overall: what each player took part in, e.g. "2 Play Session · 1 Internal · 1 External".
  const lbCounts = (r) => [['attended', 'Play Session'], ['mini_events', 'Internal'], ['external_events', 'External']].map(([k, l]) => [r[k] || 0, l])
    .filter(([n]) => n).map(([n, l]) => `${n} ${l}`).join(' · ') || '0 Play Session';
  function pointsBoard(rows, cat) {
    const me = state.user && state.user.id;
    const [countKey, countLabel] = LB_COUNT[cat] || LB_COUNT.all;
    const stats = cat !== 'external';
    const dash = '<td class="num">–</td>';
    const line = (label, pts, note) => `<div class="bk-line"><div><b>${label}</b><span class="small muted">${note}</span></div><b class="bk-pts">${pts}</b></div>`;
    const breakdown = (r) => {
      const parts = [];
      if (cat === 'all' || cat === 'mabar') parts.push(line(ACTIVITY.mabar, r.mabar, `${r.attended} attended · ${r.mabar - r.attended} won`));
      if (cat === 'all' || cat === 'mini') parts.push(line(ACTIVITY.mini, r.mini, cat === 'mini' ? `${r.mini_events} tournaments · final results` : 'Final tournament results'));
      if (cat === 'all' || cat === 'external') parts.push(line(ACTIVITY.external, r.external, cat === 'external' ? `${r.external_events} approved results` : 'Approved achievements'));
      if (cat === 'all' && r.adjustment) parts.push(line('Adjustment', r.adjustment, 'By an admin'));
      return `<tr class="bk-row hidden" data-bk-for="${r.id}"><td colspan="8"><div class="bk">
        <div class="bk-head">RATA PTS breakdown · ${esc(r.name)}</div>${parts.join('')}
        <div class="bk-line total"><b>Total</b><b class="bk-pts">${r.points}</b></div></div></td></tr>`;
    };
    return `<div class="table-scroll"><table class="board lb"><thead><tr><th class="num">#</th><th>Player</th>
      <th class="num">Played</th><th class="num">W</th><th class="num">L</th><th class="num">GW</th><th class="num">GD</th><th class="num">RATA PTS</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r.rank === 1 && r.points > 0 ? 'top' : ''} ${r.id === me ? 'me' : ''}">
        <td class="num">${r.rank}</td>
        <td><a class="person" href="#/members/${r.id}">${avatar(r, 'dark')}<span><span class="lb-name">${esc(r.name)}</span><span class="lb-sub">${cat === 'all' ? lbCounts(r) : `${r[countKey] || 0} ${countLabel}`}</span></span></a></td>
        ${stats ? `<td class="num">${r.played}</td><td class="num">${r.wins}</td><td class="num">${r.losses}</td><td class="num">${r.gw}</td><td class="num">${signed(r.diff)}</td>` : dash.repeat(5)}
        <td class="num"><button class="pts-btn" data-bk="${r.id}" aria-expanded="false">${r.points}<span class="chev">›</span></button></td></tr>${breakdown(r)}`).join('')}
      </tbody></table></div>
      <p class="small muted board-legend lb-legend">${[['Played', 'matches'], ['W', 'won'], ['L', 'lost'], ['GW', 'games won'], ['GD', 'games won minus games lost'], ['RATA PTS', 'ranking points. Tap the points to see the breakdown.']]
        .map(([k, v]) => `<span><b>${k}</b> <span>${v}</span></span>`).join('')}</p>`;
  }
  // One handler for every points board on the page.
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-lang]') && window.BCS_LANG) return window.BCS_LANG.set(window.BCS_LANG.get() === 'id' ? 'en' : 'id');
    const b = e.target.closest('[data-bk]');
    if (!b) return;
    const row = b.closest('table').querySelector(`[data-bk-for="${b.dataset.bk}"]`);
    const open = row.classList.toggle('hidden') === false;
    b.setAttribute('aria-expanded', open);
    b.classList.toggle('open', open);
  });

  function miniBoard(rows, limit = 5) {
    if (!rows.length) return '<div class="empty small">No players yet.</div>';
    return `<div class="mini-board">${rows.slice(0, limit).map((r) => `
      <a class="row-item ${r.rank === 1 && r.points > 0 ? 'top' : ''}" href="#/members/${r.id}" style="text-decoration:none">
        <span>${r.rank}</span>${avatar(r, 'dark')}<span>${esc(r.name)}</span><b>${r.points}</b>
      </a>`).join('')}</div>`;
  }

  const PLACEMENT_LABEL = 'Final placement match · No RATA points';
  // Session types. The stored keys stay mabar / mini; members see Play Session and Internal Tournament.
  const ACTIVITY = { mabar: 'Play Session', mini: 'Internal Tournament', external: 'External Tournament', coaching: 'Coaching', hitting: 'Hitting Session' };
  const SESSION_TYPES = {
    mabar: '+1 RATA point for attending and every match won',
    mini: 'RATA points by final placement',
    external: 'Sign up together; points from approved results',
    coaching: 'Attendance for rewards, no points',
    hitting: 'Practice with partners, no points',
  };
  const activityTag = (s) => `<span class="tag act-${esc(s.activity || 'mabar')}">${esc(ACTIVITY[s.activity] || ACTIVITY.mabar)}</span>`;

  function canScore(m) {
    if (!state.user) return false;
    if (isAdmin()) return true;
    return [...m.team_a, ...m.team_b].some((p) => p.id === state.user.id);
  }

  // "4 : 2" plus the current game ("30-15") for tennis matches in progress.
  function scoreText(m) {
    const st = m.state;
    if (st && st.mode === 'tennis' && m.status === 'live' && (st.display[0] !== '0' || st.display[1] !== '0' || st.tiebreak)) {
      return `${m.score_a} : ${m.score_b} <small>(${esc(st.display[0])}-${esc(st.display[1])}${st.tiebreak ? ' TB' : ''})</small>`;
    }
    return `${m.score_a} : ${m.score_b}`;
  }

  const serveDot = (m, p) => m.state && m.state.server === p.id && m.status === 'live' ? '<span class="serve-dot" title="Serving"></span>' : '';
  const teamNameServe = (m, t) => t.map((p) => `${serveDot(m, p)}${esc(p.name)}`).join(' / ');

  function scoreboard(m, opts = {}) {
    const cls = m.status === 'done' ? 'done' : m.status === 'scheduled' ? 'next' : '';
    const label = m.status === 'done' ? 'Final' : m.status === 'scheduled' ? 'Up next' : 'Live';
    return `<div class="scoreboard ${cls}" data-match="${m.id}">
      <div class="spread"><div class="head">Court ${m.court} · Round ${m.round}</div><span class="small" style="opacity:.8">${label}${m.start_time ? ' · ' + esc(m.start_time) : ''}</span></div>
      <div class="big-score"><span class="n">${m.score_a}</span><span class="colon">:</span><span class="n">${m.score_b}</span></div>
      ${m.state && m.state.mode === 'tennis' && m.status === 'live' ? `<div class="game-line">${m.state.tiebreak ? 'Tiebreak ' : 'Game '}${esc(m.state.display[0])} – ${esc(m.state.display[1])}</div>` : ''}
      <div class="teams"><div class="t">${teamNameServe(m, m.team_a)}</div><div class="t">${teamNameServe(m, m.team_b)}</div></div>
      ${opts.sub ? `<div class="sub">${esc(opts.sub)}</div>` : ''}
      <div class="actions"><a class="btn sm ${opts.controls && canScore(m) ? '' : 'ghost-light'}" href="#/score/${m.id}">${opts.controls && canScore(m) ? 'Open scorer' : 'Full screen'}</a></div>
    </div>`;
  }

  // ---------- score modal ----------

  function scoreTargetText(s) {
    if (s && s.point_system === 'tennis') return `Normal tennis · first to ${s.games} games · ${s.no_ad ? 'no-ad' : 'advantage'} · tiebreak to ${s.tb_points}`;
    if (!s || s.scoring === 'free' || !s.target) return 'Free scoring';
    return s.scoring === 'race' ? `First to ${s.target}` : `${s.target} total points`;
  }

  function openScoreModal(m, session, onSaved) {
    let a = m.score_a, b = m.score_b, status = m.status, busy = false;
    const close = () => { modalRoot.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    const draw = () => {
      modalRoot.innerHTML = `<div class="modal-bg"><div class="modal">
        <div class="scoreboard">
          <div class="spread"><div class="head">Court ${m.court} · Round ${m.round}</div><button class="btn sm ghost-light" data-close>Close</button></div>
          <div class="big-score"><span class="n">${a}</span><span class="colon">:</span><span class="n">${b}</span></div>
          <div class="teams"><div class="t">${teamName(m.team_a)}</div><div class="t">${teamName(m.team_b)}</div></div>
          <div class="score-ctrl">
            <div class="side"><button class="minus" data-d="a-1" aria-label="Minus one for left team">−</button><button class="plus" data-d="a+1">+1</button></div>
            <div class="side"><button class="plus" data-d="b+1">+1</button><button class="minus" data-d="b-1" aria-label="Minus one for right team">−</button></div>
          </div>
          <div class="sub">${esc(scoreTargetText(session))} · ${status === 'done' ? 'Finished' : status === 'live' ? 'Saved live, everyone sees it' : 'Not started'}</div>
          <div class="actions">
            ${status !== 'done' ? '<button class="btn sm" data-status="done">Finish match</button>' : '<button class="btn sm ghost-light" data-status="live">Reopen</button>'}
            ${isAdmin() && (a || b || status !== 'scheduled') ? '<button class="btn sm ghost-light" data-reset>Reset</button>' : ''}
          </div>
        </div></div></div>`;
    };

    const save = async (body) => {
      if (busy) return;
      // Changing a finished match, or resetting a scored one, needs a reason for the audit log.
      if ((status === 'done' && (body.score_a !== m.score_a || body.score_b !== m.score_b || (body.status && body.status !== 'done'))) || (body.status === 'scheduled' && (m.score_a || m.score_b || status === 'done'))) {
        const reason = prompt('Why are you changing this result? (kept in the audit log)');
        if (!reason) { a = m.score_a; b = m.score_b; draw(); return; }
        body.reason = reason;
      }
      busy = true;
      try {
        const data = await api('matches/' + m.id, body);
        const fresh = data.matches.find((x) => x.id === m.id);
        a = fresh.score_a; b = fresh.score_b; status = fresh.status;
        m = fresh;
        draw();
        onSaved && onSaved(data);
      } catch (e) {
        toast(e.message, true);
        draw();
      } finally {
        busy = false;
      }
    };

    modalRoot.onclick = (e) => {
      const t = e.target;
      if (t.classList.contains('modal-bg') || t.closest('[data-close]')) return close();
      const d = t.closest('[data-d]');
      if (d) {
        const [side, delta] = [d.dataset.d[0], Number(d.dataset.d.slice(1))];
        let na = a, nb = b;
        if (status === 'done' && delta > 0) return toast('Match finished. Tap Reopen to change the score.', true);
        if (side === 'a') na = Math.max(0, a + delta); else nb = Math.max(0, b + delta);
        if (na === a && nb === b) return;
        a = na; b = nb; draw();
        return save({ score_a: a, score_b: b, ...(status === 'done' && delta < 0 ? { status: 'live' } : {}) });
      }
      const st = t.closest('[data-status]');
      if (st) return save({ score_a: a, score_b: b, status: st.dataset.status });
      if (t.closest('[data-reset]')) {
        if (confirm('Reset this match to 0 : 0 and not started?')) save({ score_a: 0, score_b: 0, status: 'scheduled' });
      }
    };
    draw();
  }

  // ---------- views ----------

  // Homepage banner: the admin's photos as a slideshow (the built-in photo when there are none).
  function heroSlides(slides) {
    const list = slides && slides.length ? slides.map((x) => thumb(x.url, 720)) : ['assets/img/hero.jpg'];
    return `${list.map((u, i) => `<img class="hero-slide ${i ? '' : 'on'}" src="${esc(u)}" alt="RATA Team" ${i ? 'loading="lazy"' : ''}>`).join('')}
      ${list.length > 1 ? `<div class="hero-dots">${list.map((_, i) => `<button class="${i ? '' : 'on'}" data-slide="${i}" aria-label="Photo ${i + 1}"></button>`).join('')}</div>` : ''}
      ${isAdmin() ? '<button class="btn xs hero-edit" data-act="hero-edit">Edit banner</button>' : ''}`;
  }

  function startHero(el) {
    clearInterval(state.heroTimer);
    const slides = el.querySelectorAll('.hero-slide');
    let cur = 0;
    const show = (i) => {
      cur = (i + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('on', k === cur));
      el.querySelectorAll('.hero-dots button').forEach((b, k) => b.classList.toggle('on', k === cur));
    };
    const restart = () => { clearInterval(state.heroTimer); state.heroTimer = setInterval(() => { if (!document.hidden) show(cur + 1); }, 5000); };
    el.onclick = (e) => { const b = e.target.closest('[data-slide]'); if (b) { show(Number(b.dataset.slide)); restart(); } };
    if (slides.length < 2) return;
    let x0 = null;
    el.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
    el.ontouchend = (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) { show(cur + (dx < 0 ? 1 : -1)); restart(); }
    };
    restart();
  }

  // Admin: add, remove and reorder the homepage banner photos.
  function heroModal(slides, onChange) {
    const close = () => { modalRoot.innerHTML = ''; };
    const draw = () => {
      modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card wide"><div class="pad stack" style="padding:24px">
        <h2>Homepage banner</h2>
        <p class="small muted" style="margin:0">The photos slide every 5 seconds, in this order. Landscape photos work best (around 3:2); the sides may be cropped on phones. With no photos, the original picture is shown.</p>
        ${slides.length ? `<div class="hero-admin">${slides.map((x, i) => `<div class="hero-admin-row">
            <img src="${esc(thumb(x.url, 400))}" alt=""><span class="small muted">${i + 1}</span>
            <div class="row wrap-ok"><button class="btn xs ghost" data-move="-1" data-i="${i}" ${i ? '' : 'disabled'}>↑</button><button class="btn xs ghost" data-move="1" data-i="${i}" ${i < slides.length - 1 ? '' : 'disabled'}>↓</button><button class="btn xs danger" data-del="${x.id}">Remove</button></div>
          </div>`).join('')}</div>` : '<div class="card pad empty small">No photos yet: the original picture is shown.</div>'}
        <label class="btn dark" style="align-self:flex-start">+ Add photos<input type="file" accept="image/*" multiple hidden id="hero-file"></label>
        <div id="hero-msg"></div>
        <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-close>Done</button></div>
      </div></div></div>`;
      document.getElementById('hero-file').onchange = async (e) => {
        const files = [...e.target.files];
        const msg = document.getElementById('hero-msg');
        for (const [i, f] of files.entries()) {
          msg.innerHTML = `<div class="small muted">Uploading ${i + 1} of ${files.length}…</div>`;
          const fd = new FormData();
          fd.append('photo', await shrinkImage(f), 'banner.jpg');
          try {
            const res = await fetch('api/index.php?r=hero', { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'bcs' }, body: fd });
            let data = {};
            try { data = await res.json(); } catch (err) { /* non-JSON */ }
            if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
            slides = data.slides;
          } catch (err) { toast(err.message, true); }
        }
        draw(); onChange(slides);
      };
    };
    modalRoot.onclick = async (e) => {
      if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) return close();
      const mv = e.target.closest('[data-move]');
      const del = e.target.closest('[data-del]');
      try {
        if (mv) {
          const ids = slides.map((x) => x.id);
          const i = Number(mv.dataset.i);
          const j = i + Number(mv.dataset.move);
          [ids[i], ids[j]] = [ids[j], ids[i]];
          slides = (await api('hero/order', { ids })).slides;
        } else if (del) {
          if (!confirm('Remove this photo from the banner?')) return;
          slides = (await api('hero/delete', { id: Number(del.dataset.del) })).slides;
        } else return;
        draw(); onChange(slides);
      } catch (err) { toast(err.message, true); }
    };
    draw();
  }

  async function viewHome() {
    setNav('');
    const d = await api('home');
    const live = d.live[0];
    let lb = d.leaderboard;
    app.innerHTML = `
      <section class="wrap" style="padding-top:0;padding-bottom:0">
        <div class="hero">
          <div class="hero-copy">
            <div class="eyebrow">Bali · Tennis community</div>
            ${LOGO.replace('class="logo"', 'class="logo hero-word"')}
            <h1>Play. Train.<br>Compete.</h1>
            <p class="lead">Your next match starts here.</p>
            <div><a class="btn lg" href="#/sessions">Explore sessions <span class="arrow"></span></a></div>
            <div class="perks">
              <div class="perk">${ICON.people}A welcoming<br>community</div>
              <div class="perk">${ICON.bars}Quality<br>training</div>
              <div class="perk">${ICON.trophy}Real<br>competition</div>
            </div>
          </div>
          <div class="hero-photo" id="hero-photo">${heroSlides(d.slides)}</div>
        </div>
      </section>
      <div class="wrap" style="padding-top:8px">
        <div id="push-prompt"></div>
        <div class="home-grid">
          <div>
            <div class="section-head"><h2>Upcoming sessions</h2><a class="link small" href="#/sessions">View all sessions →</a></div>
            ${d.upcoming.length ? `<div class="session-cards">${d.upcoming.map((s, i) => sessionCard(s, i, (d.mine || []).includes(s.id), (d.waiting || []).includes(s.id))).join('')}</div>`
              : `<div class="card empty">No sessions scheduled yet.${isAdmin() ? ' <a class="link" href="#/sessions/new">Create one →</a>' : ''}</div>`}
          </div>
          <div style="display:flex;flex-direction:column">
            <div class="section-head spacer" style="visibility:hidden"><h2>&nbsp;</h2></div>
            <div class="live-card" style="flex:1">
              <div class="live-title">Live now</div>
              ${live ? `
                <div class="small" style="margin-top:12px;opacity:.85">Court ${live.court} · Round ${live.round}</div>
                <div class="live-line"><span class="who">${teamName(live.team_a)}</span><span class="pts">${live.score_a}</span></div>
                <div class="live-line"><span class="who">${teamName(live.team_b)}</span><span class="pts">${live.score_b}</span></div>
                <div class="small" style="opacity:.75">${esc(live.format_label)}${live.target ? ' · ' + live.target + (live.scoring === 'race' ? ' to win' : ' total points') : ''}${d.live.length > 1 ? ` · +${d.live.length - 1} more` : ''}</div>`
                : '<p class="live-empty">No matches being played right now. Scores show up here as soon as a match starts.</p>'}
              <div class="foot"><a class="more" href="#/live">View live scores →</a></div>
            </div>
          </div>
        </div>
        <div class="section-head" style="margin-top:28px"></div>
        <div class="home-grid">
          <div class="card pad">
            <div class="spread" style="margin-bottom:14px"><h2>Leaderboard</h2><span class="small muted">Total RATA points</span></div>
            ${boardTable(lb, { sessions: true, empty: 'Points appear here once the first session is completed.' })}
            <div style="margin-top:12px"><a class="link small" href="#/leaderboard">Full rankings →</a></div>
          </div>
          <div class="card members-strip">
            <div class="photo"></div>
            <a class="link" href="#/members" style="color:var(--ink)">Meet the members →</a>
            <div class="avatars">${d.members.map((m) => `<a href="#/members/${m.id}" title="${esc(m.name)}">${avatar(m)}</a>`).join('')}
              ${d.member_count > d.members.length ? `<span class="avatar">+${d.member_count - d.members.length}</span>` : ''}</div>
          </div>
        </div>
      </div>`;
    drawPushBox(document.getElementById('push-prompt'), true);
    const heroEl = document.getElementById('hero-photo');
    startHero(heroEl);
    heroEl.addEventListener('click', (e) => {
      if (e.target.closest('[data-act="hero-edit"]')) heroModal(d.slides || [], (slides) => { d.slides = slides; heroEl.innerHTML = heroSlides(slides); startHero(heroEl); });
    });
    poll(async () => { if (state.route === '' || state.route === '/') { const x = await api('home'); if (JSON.stringify(x.live) !== JSON.stringify(d.live)) render(); } }, 8000);
  }

  async function viewSessions() {
    setNav('sessions');
    const d = await api('sessions');
    app.innerHTML = `<div class="wrap">
      <div class="page-head"><div><h1>Sessions</h1><p class="muted">Pick a session, register, and play.</p></div>
        ${isAdmin() ? '<a class="btn" href="#/sessions/new">+ Create a session</a>' : ''}</div>
      ${d.upcoming.length ? `<div class="session-cards">${d.upcoming.map((s, i) => sessionCard(s, i, d.mine.includes(s.id), d.waiting.includes(s.id))).join('')}</div>`
        : '<div class="card empty">No upcoming sessions yet. Check back soon.</div>'}
      <div class="section-head"><h2>Past sessions</h2></div>
      ${d.past.length ? `<div class="card history">${d.past.map((s) => `
        <a href="#/sessions/${s.id}"><div><b>${esc(s.title)}</b><div class="small muted">${esc(fmtDate(s.date))} · ${esc(s.format_label)} · ${s.joined} players</div></div>
        <span class="tag done">${s.status === 'completed' ? 'Completed' : 'Ended'}</span></a>`).join('')}</div>`
        : '<div class="card empty">No past sessions yet.</div>'}
    </div>`;
  }

  async function viewSession(id, openReview, openChat) {
    setNav('sessions');
    let d = await api('sessions/' + id);
    let chat = null;
    const draw = () => {
      const s = d.session;
      _players = d.players;
      const myId = state.user && state.user.id;
      const rounds = {};
      d.matches.forEach((m) => (rounds[m.round] = rounds[m.round] || []).push(m));
      const roundNums = Object.keys(rounds).map(Number).sort((x, y) => x - y);
      const statusTag = s.status === 'live' ? '<span class="tag live">Live</span>' : s.status === 'completed' ? `<span class="tag done">Completed</span>`
        : s.status === 'closed' ? '<span class="tag">Registration closed</span>' : '<span class="tag yellow">Registration open</span>';
      const regBtn = registerActions(d);

      app.innerHTML = `<div class="wrap">
        <div class="${s.banner_wide ? 'session-top' : ''}">
        ${s.banner_wide ? `<div class="session-cover"><img src="${esc(thumb(s.banner_wide, 720))}" alt="${esc(s.title)}"></div>` : ''}
        <div class="session-banner ${s.banner_wide ? 'plain' : ''}">
          <div class="row wrap-ok">${statusTag}${activityTag(s)}${s.with_games ? `<span class="tag" style="background:rgba(255,255,255,.15);color:#fff">${esc(s.format_label)}</span>` : ''}</div>
          <h1>${esc(s.title)}</h1>
          <ul class="meta">
            <li>${ICON.clock}${esc(fmtDay(s.date))} · ${esc(s.start_time)}–${esc(s.end_time)} WITA</li>
            <li>${ICON.court}${s.courts} court${s.courts > 1 ? 's' : ''}</li>
            <li>${ICON.person}${s.joined} / ${s.max_players} joined${s.waiting ? ` · ${s.waiting} waiting` : ''}</li>
            <li>${ICON.cash}${s.fee ? esc(rupiah(s.fee)) + ' per player' : 'Free'}</li>
            ${s.coaches && s.coaches.length ? `<li>${ICON.person}Coach${s.coaches.length > 1 ? 'es' : ''}: ${s.coaches.map((c) => c.id ? `<a href="#/members/${c.id}" style="color:inherit">${esc(c.name)}</a>` : esc(c.name)).join(', ')}${s.activity === 'coaching' && !s.with_games ? ' · drills, no games' : ''}</li>` : ''}
            ${s.hitting ? `<li>${ICON.people}${esc(s.hitting.format)} · ${esc(s.hitting.level)}</li><li>${ICON.ball}${esc(s.hitting.partners)} · ${esc(s.hitting.balls)}</li>` : ''}
            ${s.activity === 'hitting' ? `<li>${ICON.trophy}Hitting Session · no RATA points</li>` : s.activity === 'coaching' ? `<li>${ICON.trophy}Coaching · paid sessions count toward a free reward every 30</li>`
              : s.activity === 'external' ? `<li>${ICON.trophy}External Tournament · RATA points from the result you submit after the event</li>`
              : `<li>${ICON.trophy}${esc(scoreTargetText(s))}${s.counts_overall ? (s.activity === 'mini' ? ' · RATA points by final placement' : ' · +1 RATA point for attending and per match won') : ''}</li>`}
            ${s.location ? `<li>${ICON.pin}${esc(s.location)}</li>` : ''}
          </ul>
          <div class="row wrap-ok">${regBtn}</div>
          ${myPaymentNote(d)}
        </div>
        </div>
        ${s.description ? `<p style="white-space:pre-line;margin-top:16px">${esc(s.description)}</p>` : ''}

        <div class="detail-grid">
          <div>
            ${isAdmin() ? adminBox(s) + paymentsBox(d) : ''}
            ${!s.with_games ? '' : `<div class="section-head" style="margin-top:${isAdmin() ? 28 : 8}px"><h2>Schedule</h2>
              ${d.matches.length ? `<span class="small muted">${roundNums.length} rounds · ${d.matches.length} matches${canScoreAny() ? ' · tap a match to score' : ' · tap a match for the big scoreboard'}</span>` : ''}</div>
            ${d.matches.length && canScoreAny() ? `<div class="row wrap-ok" style="margin-bottom:12px">${Array.from({ length: s.courts }, (_, i) => i + 1)
              .filter((c) => d.matches.some((m) => m.court === c && m.status !== 'done'))
              .map((c) => `<button class="btn sm dark" data-act="court" data-court="${c}">Score court ${c} ▶</button>`).join('')}</div>` : ''}
            ${roundNums.length ? roundNums.map((r) => {
              const playing = new Set(rounds[r].flatMap((m) => [...m.team_a, ...m.team_b].map((p) => p.id)));
              const sitting = d.players.filter((p) => !playing.has(p.id));
              return `
              <div class="round-head"><span class="tag yellow">Round ${r}</span><span class="small muted">${esc(rounds[r][0].start_time)}${sitting.length ? ' · Sitting out: ' + sitting.map((p) => esc(p.name)).join(', ') : ''}</span>
                ${isAdmin() && s.status !== 'completed' ? `<button class="link-btn" data-act="round-time" data-round="${r}" data-time="${esc(rounds[r][0].start_time)}">Edit time</button>` : ''}</div>
              <table class="sched"><tbody>${rounds[r].map((m) => {
                const mine = [...m.team_a, ...m.team_b].some((p) => p.id === myId);
                const sc = m.status === 'scheduled' ? '<span class="vs-badge">vs</span>' : `<span class="score-badge ${m.status === 'live' ? 'live' : ''}">${scoreText(m)}</span>`;
                return `${m.placement ? `<tr class="placement-row"><td colspan="6">${PLACEMENT_LABEL}</td></tr>` : ''}<tr class="clickable ${mine ? 'mine' : ''} ${m.placement ? 'placement' : ''}" data-match="${m.id}">
                  <td class="t">${esc(m.start_time)}</td><td class="ct">Court ${m.court}</td>
                  <td class="team ${m.status === 'done' && m.score_a > m.score_b ? 'win' : ''}">${teamNameServe(m, m.team_a)}</td>
                  <td class="vs">${sc}</td>
                  <td class="team ${m.status === 'done' && m.score_b > m.score_a ? 'win' : ''}">${teamNameServe(m, m.team_b)}</td>
                  ${isAdmin() ? `<td class="ed">${unplayed(m) && s.status !== 'completed' ? `<button class="link-btn" data-act="lineup" data-id="${m.id}" title="Change players, swap or remove this match">Edit</button>` : ''}
                    ${s.activity === 'mabar' ? `<button class="link-btn" data-act="placement" data-id="${m.id}" data-on="${m.placement ? 0 : 1}" title="${m.placement ? 'Count this as a regular match (+1 RATA point per winner)' : 'Make this an extra final that only decides placement (no RATA points)'}">${m.placement ? 'Make regular' : 'Make final'}</button>` : ''}</td>` : ''}</tr>`;
              }).join('')}</tbody></table>`;
            }).join('') : `<div class="card empty">${isAdmin() ? 'No matches yet. Add players, then press <b>Generate schedule</b>.' : 'The match schedule will appear here once the admin generates it.'}</div>`}
            ${isAdmin() && s.status !== 'completed' && d.matches.length ? '<div style="margin-top:10px"><button class="btn sm ghost" data-act="add-match">+ Add a match (final, placement…)</button></div>' : ''}`}
            ${d.can_chat ? `<div class="section-head" style="margin-top:28px" id="chat"><h2>Chat</h2><span class="small muted">Only players in this session can see this</span></div><div class="card chat-card"><div id="chat-slot"></div></div>` : ''}
            ${photosSection(d)}
          </div>
          <aside class="stack">
            ${s.fee ? (state.user ? bankCard(s, d) : `<div class="card pad bank-card"><div class="small muted">Registration fee</div><div class="fee-big">${esc(rupiah(s.fee))}</div><a class="btn dark" href="#/login" style="width:100%">Log in to request to join</a></div>`) : ''}
            ${placementsCard(d)}
            ${attendanceCard(d)}
            ${externalSessionCard(d)}
            ${!s.with_games ? '' : `<div class="card pad">
              <div class="spread"><h3>Session leaderboard</h3>${s.status === 'live' ? '<span class="tag live">Live</span>' : ''}</div>
              ${sessionBoards(d.standings, { compact: true, empty: 'No players yet.' })}
            </div>`}
            <div class="card pad">
              <h3 style="margin-bottom:12px">Registered players (${d.players.length})</h3>
              ${d.players.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:12px">${d.players.map((p) => `
                <a href="#/members/${p.id}" style="text-decoration:none;text-align:center;display:grid;justify-items:center;gap:4px">${avatar(p, 'md')}<span class="small">${esc(p.name.split(' ')[0])}</span></a>`).join('')}</div>`
                : '<p class="muted">No one yet. Be the first!</p>'}
            </div>
            ${d.waiting.length ? `<div class="card pad">
              <h3 style="margin-bottom:8px">Waiting list (${d.waiting.length})</h3>
              <ol class="waitlist">${d.waiting.map((p) => `<li><a href="#/members/${p.id}">${esc(p.name)}</a></li>`).join('')}</ol>
              ${s.fee ? '<p class="small muted" style="margin:8px 0 0">Spots go to whoever uploads a transfer proof first.</p>' : ''}
            </div>` : ''}
          </aside>
        </div>
      </div>`;
      if (isAdmin()) loadMemberOptions(d);
      if (d.can_chat) {
        chat = chat || chatBox({
          load: (after) => api(`sessions/${id}/chat&after=${after}`),
          send: (body, after, mentions) => api(`sessions/${id}/chat`, { body, after, mentions }),
          empty: 'No messages yet. Say hi to the other players!',
        });
        chat.mount(document.getElementById('chat-slot'));
      }
    };

    const canScoreAny = () => d.matches.some(canScore) && d.session.status !== 'completed';

    const run = async (fn, okMsg) => {
      try { d = await fn(); draw(); if (okMsg) toast(okMsg); } catch (e) { toast(e.message, true); }
    };

    app.onclick = async (e) => {
      const t = e.target;
      const act = t.closest('[data-act]');
      if (act) {
        const a = act.dataset.act;
        if (a === 'register') {
          const waitlist = d.session.fee > 0 || d.session.joined >= d.session.max_players;
          return run(() => api(`sessions/${id}/register`, {}), waitlist ? "You're on the waiting list." : "You're registered!");
        }
        if (a === 'unregister') {
          const paid = d.my_registration && ['submitted', 'approved'].includes(d.my_registration.pay_status);
          if (!confirm(paid ? 'Cancel your spot? Refunds are handled by the admin.' : 'Cancel your registration?')) return;
          return run(() => api(`sessions/${id}/unregister`, {}), 'Registration cancelled.');
        }
        if (a === 'pay') return payModal(d.session, (fresh) => { d = fresh; draw(); });
        if (a === 'copy-link') {
          try { await navigator.clipboard.writeText(act.dataset.copy); toast('Link copied.'); } catch (err) { toast(act.dataset.copy); }
          return;
        }
        if (a === 'photo') return photoViewer(d, Number(act.dataset.photo), (fresh) => { d = fresh; draw(); });
        if (a === 'review') return reviewModal(d.session, (fresh) => { d = fresh; draw(); });
        if (a === 'del-post') {
          if (!confirm('Delete this review and its photos?')) return;
          return run(() => api(`sessions/${id}/posts/delete`, { post_id: Number(act.dataset.post) }), 'Review deleted.');
        }
        if (a === 'copy') {
          try { await navigator.clipboard.writeText(act.dataset.copy); toast('Account number copied.'); } catch (err) { toast(act.dataset.copy); }
          return;
        }
        if (a === 'proof') return proofModal(Number(act.dataset.reg), act.dataset.name);
        if (a === 'pay-admin') {
          const action = act.dataset.action;
          let note;
          if (action === 'reject') {
            note = prompt('Why is the proof rejected? The player will see this.', 'Transfer not received');
            if (note === null) return;
          }
          if (action === 'unpaid' && !confirm('Clear this payment and move the player to the waiting list?')) return;
          const msg = { approve: 'Payment approved.', reject: 'Proof rejected. Player moved to the waiting list.', mark_paid: 'Marked as paid.', unpaid: 'Payment cleared.' }[action];
          return run(() => api(`sessions/${id}/payments`, { user_id: Number(act.dataset.user), action, note }), msg);
        }
        if (a === 'confirm-waiting') return run(() => api(`sessions/${id}/players`, { add: [Number(act.dataset.user)] }), 'Player confirmed.');
        if (a === 'generate') {
          const rounds = document.getElementById('gen-rounds').value;
          if (d.matches.length && !confirm('Replace the current schedule with a new one?')) return;
          return run(() => api(`sessions/${id}/generate`, { mode: 'replace', rounds, notify: true }), 'Schedule generated.');
        }
        if (a === 'next-round') return run(() => api(`sessions/${id}/generate`, { mode: 'next', rounds: 1, notify: true }), 'Round added.');
        if (a === 'clear') { if (confirm('Clear the whole schedule?')) return run(() => api(`sessions/${id}/generate`, { mode: 'clear' }), 'Schedule cleared.'); return; }
        if (a === 'status') {
          const st = act.dataset.status;
          if (st === 'completed' && !confirm('Finish this session? Points will be added to the overall leaderboard.')) return;
          return run(() => api(`sessions/${id}/status`, { status: st }), 'Session updated.');
        }
        if (a === 'add-player') {
          const sel = document.getElementById('add-player');
          if (!sel.value) return;
          return run(() => api(`sessions/${id}/players`, { add: [Number(sel.value)] }), 'Player added.');
        }
        if (a === 'remove-player') {
          return run(() => api(`sessions/${id}/players`, { remove: [Number(act.dataset.id)] }), 'Player removed.');
        }
        if (a === 'court') {
          const c = Number(act.dataset.court);
          const m = d.matches.find((x) => x.court === c && x.status === 'live') || d.matches.find((x) => x.court === c && x.status !== 'done');
          if (m) location.hash = '#/score/' + m.id;
          return;
        }
        if (a === 'lineup') return lineupModal(d, Number(act.dataset.id), (fresh) => { d = fresh; draw(); });
        if (a === 'add-match') return addMatchModal(d, (fresh) => { d = fresh; draw(); });
        if (a === 'ext-submit') return externalModal(null, () => toast('You can follow it on your profile.'), { tournament: d.session.title, event_date: d.session.date });
        if (a === 'attendance') {
          const attendance = {};
          app.querySelectorAll('[data-attend]').forEach((el) => { attendance[el.dataset.attend] = el.value; });
          return run(() => api(`sessions/${id}/attendance`, { attendance }), 'Attendance saved.');
        }
        if (a === 'placements') {
          const places = {};
          app.querySelectorAll('[data-place]').forEach((el) => { places[el.dataset.place] = el.value; });
          const confirmIt = act.dataset.confirm === '1';
          if (confirmIt && !confirm('Confirm the final placements? Players get their RATA points and a notification.')) return;
          return run(() => api(`sessions/${id}/placements`, { places, confirm: confirmIt }), confirmIt ? 'Placements confirmed. RATA points given.' : 'Draft saved. No points until you confirm.');
        }
        if (a === 'placement') {
          return run(() => api(`matches/${act.dataset.id}/placement`, { placement: act.dataset.on === '1' }),
            act.dataset.on === '1' ? 'Marked as a placement final: no RATA points.' : 'Marked as a regular match.');
        }
        if (a === 'round-time') return roundTimeModal(id, Number(act.dataset.round), act.dataset.time, (fresh) => { d = fresh; draw(); });
        if (a === 'delete') {
          if (!confirm('Delete this session and all its matches? This cannot be undone.')) return;
          try { await api(`sessions/${id}/delete`, {}); toast('Session deleted.'); location.hash = '#/sessions'; } catch (err) { toast(err.message, true); }
          return;
        }
      }
      if (t.closest('a[href="#/login"]')) sessionStorage.setItem('bcs_back', location.hash);
      const row = t.closest('tr[data-match]');
      if (row) location.hash = '#/score/' + row.dataset.match;
    };

    app.onchange = async (e) => {
      if (e.target.id !== 'session-photo-input') return;
      const files = [...e.target.files];
      e.target.value = '';
      if (!files.length) return;
      const label = document.getElementById('photo-add-label');
      let done = 0;
      try {
        for (const f of files) {
          if (label) label.lastChild.textContent = ` Uploading ${done + 1} of ${files.length}…`;
          d = await uploadImage(`sessions/${id}/photos`, 'photo', f);
          done++;
        }
        toast(done === 1 ? 'Photo added.' : `${done} photos added.`);
      } catch (err) {
        toast(err.message, true);
      }
      draw();
    };

    draw();
    if (openChat && d.can_chat) setTimeout(() => document.getElementById('chat').scrollIntoView({ behavior: 'smooth' }), 300);
    if (openReview && d.can_add_photos) reviewModal(d.session, (fresh) => { d = fresh; draw(); });
    else if (openReview && !state.user) sessionStorage.setItem('bcs_back', location.hash);
    poll(async () => {
      if (d.session.status === 'completed') return;
      const fresh = await api('sessions/' + id);
      if (JSON.stringify(fresh) !== JSON.stringify(d)) { d = fresh; draw(); }
    }, 3000);
  }

  // ---------- session photos ----------

  const photoThumb = (p) => `<button class="photo-thumb" data-act="photo" data-photo="${p.id}" style="background-image:url('${esc(thumb(p.url))}')" aria-label="Photo${p.by ? ' by ' + esc(p.by) : ''}"></button>`;

  // One review: who wrote it, the text, and its photos.
  function postCard(p, opts = {}) {
    return `<div class="post">
      ${opts.noAuthor ? '' : `<a class="post-who" href="#/members/${p.user.id}">${avatar(p.user, 'dark')}<b>${esc(p.user.name)}</b><span class="small muted">${esc(fmtDate(p.created_at.slice(0, 10)))}</span></a>`}
      ${p.body ? `<div class="post-body">${esc(p.body)}</div>` : ''}
      ${p.photos.length ? `<div class="post-photos">${p.photos.map(photoThumb).join('')}</div>` : ''}
      ${p.can_delete ? `<button class="link-btn post-del" data-act="del-post" data-post="${p.id}" data-session="${p.session_id}">Delete</button>` : ''}
    </div>`;
  }

  function photosSection(d) {
    const photos = d.photos || [];
    const posts = d.posts || [];
    const gallery = photos.filter((p) => !p.post_id);
    if (!photos.length && !posts.length && !d.can_add_photos) return '';
    const reviewed = state.user && posts.some((p) => p.user.id === state.user.id);
    return `<div class="section-head" style="margin-top:28px"><h2>Photos & reviews</h2>
        ${d.can_add_photos ? `<div class="row wrap-ok"><button class="btn sm ${reviewed ? 'ghost' : ''}" data-act="review">${reviewed ? 'Write another' : 'Write a review'}</button>
          <label class="btn sm dark" id="photo-add-label">${ICON.camera}<span> Add photos</span><input type="file" accept="image/*" multiple id="session-photo-input" hidden></label></div>` : ''}</div>
      ${gallery.length ? `<div class="photo-grid">${gallery.map(photoThumb).join('')}</div>` : ''}
      ${posts.length ? `<div class="posts">${posts.map((p) => postCard(p)).join('')}</div>` : ''}
      ${!gallery.length && !posts.length ? '<div class="card empty">No photos or reviews yet. Played in this session? Tell us how it went and share your best shots.</div>' : ''}`;
  }

  // Write a review (text, photos, or both) for a session. Photos are uploaded one by one after the text.
  function reviewModal(session, onDone) {
    const close = () => { modalRoot.innerHTML = ''; };
    let files = [];
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card">
      <form class="pad stack" id="rvform" style="padding:24px">
        <div><h2>How was it?</h2><p class="small muted" style="margin:4px 0 0">${esc(session.title)} · ${esc(fmtDay(session.date))}. Your review shows on the session page and on your profile timeline.</p></div>
        <textarea class="input" name="body" rows="4" maxlength="2000" placeholder="Nice community, great games…"></textarea>
        <div class="rv-photos" id="rv-photos"></div>
        <label class="btn sm ghost" style="align-self:start">${ICON.camera}<span> Add photos</span><input type="file" accept="image/*" multiple id="rv-input" hidden></label>
        <div id="rverr"></div>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn dark" id="rvbtn">Post</button></div>
      </form></div></div>`;
    const drawFiles = () => {
      document.getElementById('rv-photos').innerHTML = files.map((f, i) => `<span class="rv-thumb" style="background-image:url('${URL.createObjectURL(f)}')"><button type="button" data-rm="${i}" aria-label="Remove">×</button></span>`).join('');
    };
    document.getElementById('rv-input').onchange = (e) => { files = files.concat([...e.target.files]).slice(0, 10); e.target.value = ''; drawFiles(); };
    modalRoot.onclick = (e) => {
      if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) return close();
      const rm = e.target.closest('[data-rm]');
      if (rm) { files.splice(Number(rm.dataset.rm), 1); drawFiles(); }
    };
    document.getElementById('rvform').onsubmit = async (e) => {
      e.preventDefault();
      const btn = document.getElementById('rvbtn');
      btn.disabled = true;
      btn.textContent = 'Posting…';
      try {
        let data = await api(`sessions/${session.id}/posts`, { body: e.target.body.value, with_photos: files.length > 0 });
        const postId = data.post_id;
        for (let i = 0; i < files.length; i++) {
          btn.textContent = `Uploading ${i + 1} of ${files.length}…`;
          data = await uploadImage(`sessions/${session.id}/photos`, 'photo', files[i], { post_id: postId });
        }
        close(); toast('Thanks for your review!'); onDone(data);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Post';
        document.getElementById('rverr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
      }
    };
  }

  function photoViewer(d, photoId, onChange) {
    const list = d.photos || [];
    let i = Math.max(0, list.findIndex((p) => p.id === photoId));
    const close = () => { modalRoot.innerHTML = ''; document.removeEventListener('keydown', onKey); };
    const show = () => {
      const p = list[i];
      modalRoot.innerHTML = `<div class="modal-bg lightbox"><div class="lb-inner">
        <img src="${esc(p.url)}" alt="Session photo by ${esc(p.by)}">
        <div class="lb-bar"><span>Photo by <b>${esc(p.by)}</b> · ${i + 1} / ${list.length}</span>
          <span class="row">${list.length > 1 ? '<button class="btn sm ghost-light" data-lb="prev">‹</button><button class="btn sm ghost-light" data-lb="next">›</button>' : ''}
          <a class="btn sm ghost-light" href="${esc(p.url)}" download>Save</a>
          ${p.can_delete ? '<button class="btn sm danger" data-lb="delete">Delete</button>' : ''}
          <button class="btn sm" data-lb="close">Close</button></span></div>
      </div></div>`;
    };
    const step = (k) => { i = (i + k + list.length) % list.length; show(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') step(-1); if (e.key === 'ArrowRight') step(1); };
    document.addEventListener('keydown', onKey);
    modalRoot.onclick = async (e) => {
      const b = e.target.closest('[data-lb]');
      if (!b) { if (e.target.classList.contains('modal-bg')) close(); return; }
      const op = b.dataset.lb;
      if (op === 'close') return close();
      if (op === 'prev') return step(-1);
      if (op === 'next') return step(1);
      if (op === 'delete') {
        if (!confirm('Delete this photo?')) return;
        try {
          const fresh = await api(`sessions/${d.session.id}/photos/delete`, { photo_id: list[i].id });
          close(); toast('Photo deleted.'); onChange(fresh);
        } catch (err) { toast(err.message, true); }
      }
    };
    show();
  }

  // ---------- registration & payments ----------

  const PAY_LABEL = { none: 'Not paid', submitted: 'Proof to check', approved: 'Paid', rejected: 'Proof rejected' };

  function registerActions(d) {
    const s = d.session;
    const r = d.my_registration;
    const open = s.status === 'open' || s.status === 'live';
    const full = s.joined >= s.max_players;
    const canCancel = s.status === 'open' && !d.matches.length;
    const cancel = (label) => (canCancel ? `<button class="btn ghost-light" data-act="unregister">${label}</button>` : '');
    const payBtn = (label) => `<button class="btn" data-act="pay">${label} <span class="arrow"></span></button>`;
    if (!state.user) return open ? '<a class="btn" href="#/login">Log in to register <span class="arrow"></span></a>' : '';
    if (r && r.status === 'confirmed') {
      if (s.fee && r.pay_status === 'none') return `<span class="tag yellow">You're playing</span>${payBtn('Upload transfer proof')}`;
      return `<span class="tag yellow">You're playing</span>${cancel('Cancel my spot')}`;
    }
    if (r) {
      const take = open && !full ? (s.fee ? payBtn(`Pay ${rupiah(s.fee)} to take a spot`) : '<button class="btn" data-act="register">Take the open spot <span class="arrow"></span></button>') : '';
      return `<span class="tag">On the waiting list</span>${take}${open ? '<button class="btn ghost-light" data-act="unregister">Leave waiting list</button>' : ''}`;
    }
    if (!open) return '';
    if (full) return `<span class="tag">${s.fee ? 'Paid spots are full' : 'Session full'}</span><button class="btn ghost-light" data-act="register">Join the waiting list</button>`;
    if (s.fee) return `${payBtn('Request to join')}<button class="btn ghost-light" data-act="register">Waiting list (pay later)</button>`;
    return '<button class="btn" data-act="register">Request to join <span class="arrow"></span></button>';
  }

  function myPaymentNote(d) {
    const r = d.my_registration;
    if (!r || !d.session.fee) return '';
    if (r.pay_status === 'submitted') return '<p class="pay-note">We got your transfer proof. Your spot is held while the admin checks it.</p>';
    if (r.pay_status === 'approved') return `<p class="pay-note ok">Payment confirmed ✓ ${esc(rupiah(r.amount))}</p>`;
    if (r.pay_status === 'rejected') return `<p class="pay-note bad">Your transfer proof was not accepted${r.note ? ': ' + esc(r.note) : ''}. Upload a new one to get a spot back.</p>`;
    if (r.status === 'waiting') return '<p class="pay-note">Upload your transfer proof to take a spot. Spots go to whoever pays first.</p>';
    return '';
  }

  function bankCard(s, d) {
    const r = d.my_registration;
    const open = s.status === 'open' || s.status === 'live';
    const full = s.joined >= s.max_players;
    let act = '';
    if (r && r.pay_status === 'approved') act = '<div class="pay-chip approved">Payment confirmed ✓</div>';
    else if (r && r.pay_status === 'submitted') act = '<div class="pay-chip submitted">Proof uploaded, waiting for admin check</div>';
    else if (r && r.status === 'confirmed') act = '<button class="btn dark" data-act="pay" style="width:100%">Upload transfer proof</button>';
    else if (open && !full) act = `<button class="btn dark" data-act="pay" style="width:100%">${r ? 'Upload transfer proof' : 'Request to join & upload proof'}</button>`;
    else if (open && !r) act = '<button class="btn ghost" data-act="register" style="width:100%">Paid spots full · join waiting list</button>';
    return `<div class="card pad bank-card">
      <div class="small muted">Registration fee</div>
      <div class="fee-big">${esc(rupiah(s.fee))}</div>
      ${s.bank_account ? `<div class="bank">
        <div class="small muted">Transfer to</div>
        ${s.bank_name ? `<b>${esc(s.bank_name)}</b>` : ''}
        <div class="acct"><span>${esc(s.bank_account)}</span><button class="link-btn" data-act="copy" data-copy="${esc(s.bank_account)}">Copy</button></div>
        ${s.bank_holder ? `<div class="small">a.n. ${esc(s.bank_holder)}</div>` : ''}
      </div>` : ''}
      <p class="small muted" style="margin:10px 0 12px">After you transfer, upload the proof. You're registered as soon as it's uploaded.</p>
      ${act}
    </div>`;
  }

  function paymentsBox(d) {
    const s = d.session;
    const regs = d.registrations || [];
    if (!regs.length || (!s.fee && !d.waiting.length)) return '';
    const full = s.joined >= s.max_players;
    const sum = (k) => regs.filter((r) => r.pay_status === k).reduce((t, r) => t + r.amount, 0);
    const toCheck = regs.filter((r) => r.pay_status === 'submitted').length;
    const btn = (r, action, label, cls = 'ghost') => `<button class="btn xs ${cls}" data-act="pay-admin" data-user="${r.user_id}" data-action="${action}">${label}</button>`;
    const actions = (r) => {
      const out = [];
      if (r.has_proof) out.push(`<button class="btn xs ghost" data-act="proof" data-reg="${r.id}" data-name="${esc(r.name)}">View proof</button>`);
      if (!s.fee) {
        if (r.status === 'waiting' && !full) out.push(`<button class="btn xs dark" data-act="confirm-waiting" data-user="${r.user_id}">Confirm</button>`);
        return out.join('');
      }
      if (r.pay_status === 'submitted') out.push(btn(r, 'approve', 'Approve', 'dark'), btn(r, 'reject', 'Reject', 'danger'));
      else if (r.pay_status === 'approved') out.push(btn(r, 'unpaid', r.method === 'free' ? 'Remove free entry' : 'Mark unpaid'));
      else if (r.status === 'confirmed' || !full) out.push(btn(r, 'mark_paid', 'Mark paid (cash)'), btn(r, 'free', 'Free entry'));
      return out.join('');
    };
    return `<div class="card pad pay-box">
      <div class="spread"><h3>${s.fee ? 'Registrations & payments' : 'Waiting list'}</h3>
        ${s.fee ? `<span class="small muted">Confirmed ${esc(rupiah(sum('approved')))}${toCheck ? ` · <b>${toCheck} proof${toCheck > 1 ? 's' : ''} to check</b>` : ''}</span>` : ''}</div>
      <div class="table-scroll"><table class="pay-table"><tbody>${regs.map((r) => `<tr>
        <td><a href="#/members/${r.user_id}"><b>${esc(r.name)}</b></a><div class="small muted">${r.status === 'confirmed' ? 'Playing' : 'Waiting list'}${r.paid_at && r.method !== 'free' ? ' · paid ' + esc(r.paid_at.slice(5, 16)) : ''}</div></td>
        ${s.fee ? `<td><span class="pay-chip ${r.method === 'free' ? 'free' : r.pay_status}">${r.method === 'free' ? 'Free entry' : PAY_LABEL[r.pay_status] || r.pay_status}</span>${r.method === 'cash' ? ' <span class="small muted">cash</span>' : ''}${r.note && r.pay_status === 'rejected' ? `<div class="small muted">${esc(r.note)}</div>` : ''}</td>
        <td class="num">${r.amount ? esc(rupiah(r.amount)) : ''}</td>` : ''}
        <td class="acts">${actions(r)}</td></tr>`).join('')}</tbody></table></div>
    </div>`;
  }

  function payModal(s, onDone) {
    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card">
      <form class="pad stack" id="payform" style="padding:24px">
        <h2>Request to join · ${esc(rupiah(s.fee))}</h2>
        <div class="pay-steps">
          <div><b>1.</b> Transfer <b>${esc(rupiah(s.fee))}</b> to
            <div class="acct-box">${s.bank_name ? esc(s.bank_name) + ' · ' : ''}<b>${esc(s.bank_account)}</b> <button type="button" class="link-btn" data-copy="${esc(s.bank_account)}">Copy</button>
            ${s.bank_holder ? `<div class="small">a.n. ${esc(s.bank_holder)}</div>` : ''}</div></div>
          <div><b>2.</b> Upload a screenshot or photo of the transfer.</div>
        </div>
        <label class="proof-drop" id="proof-drop"><input type="file" accept="image/*" name="proof" id="proof-input" hidden>
          <span id="proof-label">Choose transfer proof</span></label>
        <div id="payerr"></div>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn dark" id="paybtn" disabled>Upload & register</button></div>
        <p class="small muted" style="margin:0">Your spot is held as soon as the proof is uploaded. If the admin can't match your transfer, you'll go back to the waiting list.</p>
      </form></div></div>`;
    const input = document.getElementById('proof-input');
    const btn = document.getElementById('paybtn');
    modalRoot.onclick = async (e) => {
      if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) return close();
      const cp = e.target.closest('[data-copy]');
      if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); toast('Account number copied.'); } catch (err) { /* no clipboard */ } }
    };
    input.onchange = () => {
      const f = input.files[0];
      btn.disabled = !f;
      const drop = document.getElementById('proof-drop');
      if (f) {
        drop.style.backgroundImage = `url('${URL.createObjectURL(f)}')`;
        drop.classList.add('has-img');
        document.getElementById('proof-label').textContent = 'Change image';
      }
    };
    document.getElementById('payform').onsubmit = async (e) => {
      e.preventDefault();
      if (!input.files[0]) return;
      btn.disabled = true;
      btn.textContent = 'Uploading…';
      try {
        const data = await uploadImage(`sessions/${s.id}/pay`, 'proof', input.files[0]);
        close();
        toast("Proof uploaded. You're registered!");
        onDone(data);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Upload & register';
        document.getElementById('payerr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
      }
    };
  }

  function proofModal(regId, name) {
    const close = () => { modalRoot.innerHTML = ''; };
    const src = `api/index.php?r=payments/${regId}/proof&t=${Date.now()}`;
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card proof-modal">
      <div class="pad stack" style="padding:20px">
        <div class="spread"><h3>Transfer proof · ${esc(name || '')}</h3><button class="btn sm ghost" data-close>Close</button></div>
        <a href="${src}" target="_blank" rel="noopener"><img src="${src}" alt="Transfer proof"></a>
      </div></div></div>`;
    modalRoot.onclick = (e) => { if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) close(); };
  }

  let memberCache = null;
  async function loadMemberOptions(d) {
    const sel = document.getElementById('add-player');
    if (!sel) return;
    if (!memberCache) memberCache = (await api('members')).members;
    const inSession = new Set(d.players.map((p) => p.id));
    sel.innerHTML = '<option value="">Add a member…</option>' + memberCache.filter((m) => !inSession.has(m.id))
      .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  }

  // Coaching: the coach confirms who attended and paid; paid sessions fill the reward wallet.
  function attendanceCard(d) {
    const at = d.attendance;
    if (!at) return '';
    if (!at.all) {
      return at.mine ? `<div class="card pad"><h3>Your attendance</h3><p class="small" style="margin:6px 0 0">${esc(at.labels[at.mine])}${at.mine === 'paid' ? ' · counts toward your coaching reward' : ''}</p></div>` : '';
    }
    return `<div class="card pad stack">
      <div class="spread"><h3>Attendance</h3><span class="small muted">${Object.values(at.all).filter((x) => x === 'paid').length} paid</span></div>
      ${d.players.length ? `<div class="stack" style="gap:8px">${d.players.map((p) => `<label class="row place-row">${avatar(p, 'dark')}<span>${esc(p.name)}</span>
        <select class="input" data-attend="${p.id}"><option value="">Not confirmed</option>${Object.entries(at.labels).map(([k, v]) => `<option value="${k}" ${at.all[p.id] === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>`).join('')}</div>
        <p class="hint">Only paid attendance counts toward rewards (1 reward every 30). A free reward session does not count.</p>
        <div><button class="btn sm dark" data-act="attendance">Save attendance</button></div>` : '<p class="small muted">No players registered yet.</p>'}
    </div>`;
  }

  // External Tournament session: no matches here; registered players submit their own result after the event.
  function externalSessionCard(d) {
    const s = d.session;
    if (s.activity !== 'external') return '';
    const me = state.user && d.players.some((p) => p.id === state.user.id);
    const after = s.date <= todayISO();
    return `<div class="card pad stack">
      <h3>External Tournament</h3>
      <p class="small muted" style="margin:0">RATA points come from the result each player submits after the event (with a photo or link as proof). An admin approves it on the Approvals page.</p>
      ${me && after ? '<button class="btn sm dark" data-act="ext-submit">Submit my result</button>' : me ? '<p class="small" style="margin:0">You can submit your result here once the tournament day comes.</p>' : ''}
    </div>`;
  }

  // Internal Tournament: final placements give the RATA points (no points per match won).
  function placementsCard(d) {
    const pl = d.placements;
    if (!pl) return '';
    const s = d.session;
    const edit = isAdmin();
    if (!edit && !pl.confirmed) return '';
    const current = pl.rows.length ? Object.fromEntries(pl.rows.map((r) => [r.id, r.place])) : (pl.suggested || {});
    const pts = (place) => pl.points[place];
    return `<div class="card pad stack placements">
      <div class="spread"><h3>Final placements</h3>${pl.confirmed ? '<span class="tag done">Confirmed</span>' : '<span class="tag yellow">Draft</span>'}</div>
      ${pl.confirmed ? '' : `<p class="small" style="margin:0"><b>Not confirmed yet</b>, so nobody has RATA points from this tournament.${pl.suggested ? (s.format.startsWith('singles') ? ' When you mark the session Completed, places are given automatically from the final session leaderboard. Only open this to change them.' : ' The places below are suggested from the session leaderboard: check them and press Confirm.') : ''}</p>`}
      ${pl.confirmed ? `<ol class="place-list">${pl.rows.map((r) => `<li><span class="place-badge ${r.place}">${esc(r.label)}</span><a class="person" href="#/members/${r.id}">${avatar(r, 'dark')}${esc(r.name)}</a><b>+${r.points}</b></li>`).join('')}</ol>` : ''}
      ${edit ? `<details ${pl.confirmed || (pl.suggested && s.format.startsWith('singles')) ? '' : 'open'}><summary class="small">${pl.confirmed ? 'Change placements' : 'Set placements (admin)'}</summary>
        <div class="stack" style="gap:8px;margin-top:10px">${d.players.map((p) => `<label class="row place-row">${avatar(p, 'dark')}<span>${esc(p.name)}</span>
          <select class="input" data-place="${p.id}">${Object.entries(pl.labels).map(([k, v]) => `<option value="${k}" ${(current[p.id] || 'participant') === k ? 'selected' : ''}>${esc(v)} · ${pts(k)}</option>`).join('')}</select></label>`).join('')}</div>
        <p class="hint">${s.format.startsWith('singles') ? 'One player per place.' : 'Give both partners the same place; each gets the full points.'} With no 3rd-place match, use Joint 3rd for both semi-finalists. Everyone else gets Participation.</p>
        <div class="row wrap-ok"><button class="btn sm ghost" data-act="placements" data-confirm="0">Save draft</button><button class="btn sm dark" data-act="placements" data-confirm="1">${pl.confirmed ? 'Save and confirm' : 'Confirm placements'}</button></div>
      </details>` : ''}
    </div>`;
  }

  function adminBox(s) {
    const hasMatches = s.rounds > 0;
    return `<div class="admin-box stack">
      <div class="spread"><h3>${ICON.trophy.replace('<svg', '<svg width="20" height="20"')} Admin</h3>
        <div class="row wrap-ok"><a class="btn sm ghost" href="#/sessions/${s.id}/edit">Edit details & banner</a><a class="btn sm ghost" href="#/sessions/new?from=${s.id}" title="Same settings, one week later. You can change the date and venue before saving.">Duplicate</a><button class="btn sm danger" data-act="delete">Delete</button></div></div>
      <div>
        <div class="small muted" style="margin-bottom:6px">Players</div>
        <div class="row wrap-ok"><select class="input" id="add-player" style="max-width:260px"><option>Loading…</option></select>
          <button class="btn sm dark" data-act="add-player">Add</button>
          <a class="link small" href="#/members">+ New member</a></div>
        <div class="row wrap-ok small" style="margin-top:8px" id="player-chips">${(currentPlayers() || []).map((p) =>
          `<span class="tag" style="text-transform:none">${esc(p.name)} <button title="Remove" data-act="remove-player" data-id="${p.id}" style="border:0;background:none;cursor:pointer;padding:0 2px">✕</button></span>`).join('')}</div>
      </div>
      ${!s.with_games ? '' : `<div>
        <div class="small muted" style="margin-bottom:6px">Schedule · ${esc(s.format_label)} · ${s.courts} court${s.courts > 1 ? 's' : ''}</div>
        <div class="row wrap-ok">
          <label class="row small">Rounds <input class="input" id="gen-rounds" type="number" min="1" max="50" value="${s.format === 'mexicano' ? 1 : suggestedRounds(s)}" style="width:80px"></label>
          <button class="btn sm" data-act="generate">${hasMatches ? 'Regenerate' : 'Generate schedule'} <span class="arrow"></span></button>
          ${hasMatches ? `<button class="btn sm ghost" data-act="next-round">+ Add ${s.format === 'mexicano' ? 'next Mexicano' : 'a'} round</button><button class="btn sm ghost" data-act="clear">Clear</button>` : ''}
        </div>
        ${s.format === 'singles_gender' ? '<div class="hint" style="margin-top:6px">Men only play men and women only play women. Courts are shared each round so both groups play about as often. Every player needs their gender set.</div>' : ''}
        ${s.format === 'mexicano' ? '<div class="hint" style="margin-top:6px">Mexicano: round 1 is random. When a round is done, add the next round and players are paired by the current standings.</div>' : ''}
      </div>`}
      ${!s.with_games ? '' : streamLinks(s)}
      <div>
        <div class="small muted" style="margin-bottom:6px">Session status</div>
        <div class="row wrap-ok">
          ${s.status !== 'open' && s.status !== 'completed' ? '<button class="btn sm ghost" data-act="status" data-status="open">Re-open registration</button>' : ''}
          ${s.status === 'open' ? '<button class="btn sm ghost" data-act="status" data-status="closed">Close registration</button>' : ''}
          ${s.status !== 'live' && s.status !== 'completed' ? '<button class="btn sm dark" data-act="status" data-status="live">Start live session</button>' : ''}
          ${s.status !== 'completed' ? '<button class="btn sm" data-act="status" data-status="completed">Finish session ✓</button>' : '<button class="btn sm ghost" data-act="status" data-status="live">Re-open session</button>'}
        </div>
      </div>
    </div>`;
  }

  // Players of the session being shown, set by viewSession before drawing the admin box.
  let _players = [];
  const currentPlayers = () => _players;
  const suggestedRounds = (s) => {
    const [sh, sm] = s.start_time.split(':').map(Number);
    const [eh, em] = s.end_time.split(':').map(Number);
    return Math.max(1, Math.floor(Math.max(0, eh * 60 + em - sh * 60 - sm) / Math.max(5, s.match_minutes)));
  };

  // Banner formats: square for the session card, 16:9 for the top of the session page.
  const BANNERS = {
    square: { label: 'Card banner', size: '1080 × 1080 px', ratio: 'square', aspect: 1, max: 1080 },
    wide: { label: 'Session page banner', size: '1920 × 1080 px', ratio: '16:9', aspect: 16 / 9, max: 1920 },
  };

  async function uploadBanner(sessionId, kind, blob) {
    const fd = new FormData();
    fd.append('kind', kind);
    fd.append('banner', blob, kind + '.jpg');
    const res = await fetch('api/index.php?r=sessions/' + sessionId + '/banner', {
      method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'bcs' }, body: fd,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data;
  }

  // fromId: duplicate that session (same settings, one week later); nothing is saved until the admin presses Create.
  async function viewSessionForm(id, fromId) {
    setNav('sessions');
    if (!isAdmin()) return needLogin('Only admins can create sessions.');
    const meta = await api('sessions');
    let s = { title: '', date: todayISO(), start_time: '16:00', end_time: '19:00', location: '', description: '', courts: 2, max_players: 8, format: 'americano', scoring: 'total', target: 16, match_minutes: 20, counts_overall: true, point_system: 'americano', games: 4, no_ad: true, tb_points: 7, fee: 0, bank_name: '', bank_account: '', bank_holder: '' };
    if (id) s = (await api('sessions/' + id)).session;
    if (!memberCache) memberCache = (await api('members')).members;
    if (fromId) {
      s = { ...(await api('sessions/' + fromId)).session };
      const next = parseDate(s.date);
      next.setDate(next.getDate() + 7);
      s.date = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
    }
    // per kind: the current url, a newly cropped blob, or removed
    const banners = Object.fromEntries(Object.keys(BANNERS).map((k) => [k, { url: s['banner_' + k] || null, blob: null, removed: false }]));
    const opt = (v, cur, label) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label ?? v)}</option>`;
    app.innerHTML = `<div class="wrap" style="max-width:1100px">
      <div class="card" style="overflow:hidden">
        <div style="height:140px;background:url(assets/img/hero.jpg) center 40%/cover"></div>
        <form class="pad stack" id="sform" style="padding:28px">
          <div><h1>${id ? 'Edit session' : fromId ? 'Duplicate session' : 'Create a session'}</h1><p class="muted" style="margin:6px 0 0">${fromId ? `A copy of <b>${esc(s.title)}</b>, one week later. Check the date and venue, then create it.` : 'Set the session. Generate the matches.'}</p></div>
          <fieldset class="type-pick"><legend>Session type</legend>
            ${Object.entries(SESSION_TYPES).map(([k, v]) => `<label><input type="radio" name="activity" value="${k}" ${(s.activity || 'mabar') === k ? 'checked' : ''}><span><b>${esc(ACTIVITY[k])}</b><small>${esc(v)}</small></span></label>`).join('')}
          </fieldset>
          <div class="form-grid">
            <label class="field full">Title<input class="input" name="title" required maxlength="120" value="${esc(s.title)}" placeholder="Saturday Social"></label>
            <label class="field">Date<input class="input" type="date" name="date" required value="${esc(s.date)}"></label>
            <div class="form-grid" style="gap:14px">
              <label class="field">Start time<input class="input" type="time" name="start_time" required value="${esc(s.start_time)}"></label>
              <label class="field">End time<input class="input" type="time" name="end_time" required value="${esc(s.end_time)}"></label>
            </div>
            <label class="field">Courts<select class="input" name="courts">${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => opt(n, s.courts)).join('')}</select></label>
            <label class="field">Max players<input class="input" type="number" name="max_players" min="2" max="200" value="${s.max_players}"></label>
            <div class="field full form-sub coaching-only"><b>Coaching</b><span class="hint">Tick the coaches (one or more). For a coach who isn't a member, type the name. Coaches can confirm attendance.</span></div>
            <div class="field full coaching-only">Coaches<div class="coach-pick">${[...memberCache.filter((m) => m.role === 'coach'), ...memberCache.filter((m) => m.role !== 'coach')].map((m) =>
              `<label class="${(s.coaches || []).some((c) => c.id === m.id) ? 'on' : ''}"><input type="checkbox" data-coach="${m.id}" ${(s.coaches || []).some((c) => c.id === m.id) ? 'checked' : ''}>${esc(m.name)}${m.role === 'coach' ? ' <small>coach</small>' : ''}</label>`).join('')}</div></div>
            <label class="field full coaching-only">Other coaches (not members)<input class="input" name="coach_names" maxlength="255" value="${esc((s.coaches || []).filter((c) => !c.id).map((c) => c.name).join(', '))}" placeholder="Names, separated by commas"></label>
            <fieldset class="type-pick full coaching-only games-pick"><legend>Games</legend>
              <label><input type="radio" name="with_games" value="" ${s.id && s.activity === 'coaching' && s.with_games ? '' : 'checked'}><span><b>Drills only</b><small>No games, no schedule or scoring</small></span></label>
              <label><input type="radio" name="with_games" value="1" ${s.id && s.activity === 'coaching' && s.with_games ? 'checked' : ''}><span><b>With games</b><small>Set the format and scoring below</small></span></label>
            </fieldset>
            <div class="field full form-sub hitting-only"><b>Hitting Session</b><span class="hint">Members practise together. No games to score and no RATA points.</span></div>
            <label class="field hitting-only">Hitting format<select class="input" name="hit_format">${Object.entries(meta.hitting.format).map(([k, v]) => opt(k, s.hit_format, v)).join('')}</select></label>
            <label class="field hitting-only">Skill level<select class="input" name="hit_level">${Object.entries(meta.hitting.level).map(([k, v]) => opt(k, s.hit_level, v)).join('')}</select></label>
            <fieldset class="type-pick full hitting-only hit-pick"><legend>Hitting partner arrangement</legend>
              ${Object.entries(meta.hitting.partners).map(([k, v], i) => `<label><input type="radio" name="hit_partners" value="${k}" ${(s.hit_partners || '') === k || (!s.hit_partners && !i) ? 'checked' : ''}><span><b>${esc(v)}</b></span></label>`).join('')}
            </fieldset>
            <fieldset class="type-pick full hitting-only hit-pick"><legend>Tennis balls</legend>
              ${Object.entries(meta.hitting.balls).map(([k, v], i) => `<label><input type="radio" name="hit_balls" value="${k}" ${(s.hit_balls || '') === k || (!s.hit_balls && !i) ? 'checked' : ''}><span><b>${esc(v.replace('Tennis balls provided', 'Provided').replace('Bring your own balls', 'Bring your own'))}</b></span></label>`).join('')}
            </fieldset>
            <div class="field full form-sub external-only"><b>External Tournament</b><span class="hint">A tournament outside RATA that members sign up for together. There are no matches to score here: after the event, each player submits their result from the session page, and approved results add RATA points.</span></div>
            <label class="field play-only">Game format<select class="input" name="format">${Object.entries(meta.formats).map(([k, v]) => opt(k, s.format, v)).join('')}</select></label>
            <label class="field play-only">Match length (minutes)<input class="input" type="number" name="match_minutes" min="5" max="240" value="${s.match_minutes}"><span class="hint">Used to time each round in the schedule.</span></label>
            <label class="field play-only">Point system<select class="input" name="point_system">
              ${opt('americano', s.point_system, 'Americano points (every point counts)')}${opt('tennis', s.point_system, 'Normal tennis (15-30-40, games, tiebreak)')}</select></label>
            <div class="tennis-only form-grid" style="gap:14px">
              <label class="field">Games to win<select class="input" name="games">${[3, 4, 5, 6, 7, 8].map((n) => opt(n, s.games)).join('')}</select><span class="hint">Tiebreak at games-all.</span></label>
              <label class="field">Tiebreak to<select class="input" name="tb_points">${opt(4, s.tb_points)}${opt(7, s.tb_points)}${opt(10, s.tb_points)}</select></label>
            </div>
            <label class="toggle tennis-only"><input type="checkbox" name="no_ad" ${s.no_ad ? 'checked' : ''}>
              <span><b>No-ad (sudden death)</b><br><span class="hint">At 40-40 the next point wins the game.</span></span></label>
            <label class="field americano-only">Scoring<select class="input" name="scoring">
              ${opt('total', s.scoring, 'Total points per match (Americano style)')}${opt('race', s.scoring, 'First to N points/games')}${opt('free', s.scoring, 'Free (timed, no limit)')}</select></label>
            <label class="field americano-only" id="target-field">Points per match<select class="input" name="target">${[6, 7, 9, 11, 12, 15, 16, 21, 24, 32].map((n) => opt(n, s.target)).join('')}</select></label>
            <div class="field full form-sub"><b>Registration fee</b><span class="hint">Leave the fee at 0 for a free session. With a fee, players register by uploading their transfer proof.</span></div>
            <label class="field">Fee per player (Rp)<input class="input" type="number" name="fee" min="0" step="1000" value="${s.fee || 0}" inputmode="numeric"></label>
            <label class="field">Bank<input class="input" name="bank_name" maxlength="60" value="${esc(s.bank_name || '')}" placeholder="BCA, Mandiri, BNI…"></label>
            <label class="field">Account number<input class="input" name="bank_account" maxlength="40" value="${esc(s.bank_account || '')}" inputmode="numeric"></label>
            <label class="field">Account holder<input class="input" name="bank_holder" maxlength="100" value="${esc(s.bank_holder || '')}" placeholder="Name on the account"></label>
            <label class="field full">Location<input class="input" name="location" maxlength="160" value="${esc(s.location)}" placeholder="Court name, area"></label>
            <div class="field full form-sub"><b>Banners</b><span class="hint">Optional. Make them in Canva or similar at these sizes; you can adjust the crop after picking.</span></div>
            <div class="full banner-pick" id="banner-pick"></div>
            <label class="field full">Notes<textarea class="input" name="description" maxlength="2000" placeholder="Level, what to bring…">${esc(s.description || '')}</textarea></label>
            <label class="toggle full counts-only"><input type="checkbox" name="counts_overall" ${s.counts_overall ? 'checked' : ''}>
              <span><b>Add results to overall leaderboard</b><br><span class="hint">Session points will be added to each member's overall total.</span></span></label>
            <label class="toggle full hitting-only" style="opacity:.6;cursor:not-allowed"><input type="checkbox" disabled>
              <span><b>Add results to overall leaderboard</b> <span class="tag">Disabled</span><br><span class="hint">Hitting Sessions don't give RATA points.</span></span></label>
            ${id ? '' : `<label class="toggle full"><input type="checkbox" name="notify" checked>
              <span><b>Notify members</b><br><span class="hint">Sends a push notification to every member who turned notifications on.</span></span></label>`}
          </div>
          <div id="ferr"></div>
          <div class="row" style="justify-content:flex-end">
            <a class="btn ghost" href="${id ? '#/sessions/' + id : '#/sessions'}">Cancel</a>
            <button class="btn dark" type="submit">${id ? 'Save changes' : 'Create session'} <span class="arrow"></span></button>
          </div>
        </form>
      </div></div>`;
    const form = document.getElementById('sform');
    const drawBanners = () => {
      document.getElementById('banner-pick').innerHTML = Object.entries(BANNERS).map(([k, b]) => {
        const cur = banners[k];
        const src = cur.blob ? URL.createObjectURL(cur.blob) : cur.removed ? null : cur.url;
        return `<div class="bp-item">
          <div class="bp-prev ${k}" style="aspect-ratio:${b.aspect}${src ? `;background-image:url('${esc(src)}')` : ''}">${src ? '' : `<span>${b.ratio}</span>`}</div>
          <div><b>${b.label}</b><div class="small muted">${b.ratio} · ${b.size}</div>
            <div class="row wrap-ok" style="margin-top:8px"><label class="btn xs dark">${src ? 'Change' : 'Upload'}<input type="file" accept="image/*" data-banner="${k}" hidden></label>
            ${src ? `<button type="button" class="btn xs ghost" data-banner-rm="${k}">Remove</button>` : ''}</div></div>
        </div>`;
      }).join('');
    };
    drawBanners();
    form.addEventListener('change', async (e) => {
      const k = e.target.dataset && e.target.dataset.banner;
      if (!k) return;
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const blob = await cropPhoto(file, { aspect: BANNERS[k].aspect, max: BANNERS[k].max, title: BANNERS[k].label, note: 'Drag to move, zoom to fit. This frame is exactly what members will see.', save: 'Use banner' });
      if (blob) { banners[k].blob = blob; banners[k].removed = false; drawBanners(); }
    });
    form.addEventListener('click', (e) => {
      const rm = e.target.closest('[data-banner-rm]');
      if (!rm) return;
      const k = rm.dataset.bannerRm;
      banners[k].blob = null;
      banners[k].removed = true;
      drawBanners();
    });
    const syncTarget = () => {
      // External Tournaments and drills-only coaching have no matches, so the scoring settings are hidden.
      const coaching = form.activity.value === 'coaching';
      const play = !['external', 'hitting'].includes(form.activity.value) && !(coaching && !formData(form).with_games);
      form.querySelectorAll('.hitting-only').forEach((el) => el.classList.toggle('hidden', form.activity.value !== 'hitting'));
      form.querySelectorAll('.coaching-only').forEach((el) => el.classList.toggle('hidden', !coaching));
      const tennis = form.point_system.value === 'tennis';
      form.querySelectorAll('.play-only').forEach((el) => el.classList.toggle('hidden', !play));
      form.querySelectorAll('.external-only').forEach((el) => el.classList.toggle('hidden', form.activity.value !== 'external'));
      form.querySelectorAll('.tennis-only').forEach((el) => el.classList.toggle('hidden', !play || !tennis));
      form.querySelectorAll('.americano-only').forEach((el) => el.classList.toggle('hidden', !play || tennis));
      if (play && !tennis) document.getElementById('target-field').classList.toggle('hidden', form.scoring.value === 'free');
      // Only Play Sessions and Internal Tournaments add to the overall leaderboard.
      form.querySelectorAll('.counts-only').forEach((el) => el.classList.toggle('hidden', !['mabar', 'mini'].includes(form.activity.value)));
    };
    form.scoring.onchange = syncTarget;
    form.point_system.onchange = syncTarget;
    form.querySelectorAll('[data-coach]').forEach((el) => { el.onchange = () => el.parentElement.classList.toggle('on', el.checked); });
    form.querySelectorAll('[name="with_games"]').forEach((el) => { el.onchange = syncTarget; });
    form.querySelectorAll('[name="activity"]').forEach((el) => {
      el.onchange = () => {
        if (['mabar', 'mini'].includes(el.value)) form.counts_overall.checked = true;
        syncTarget();
      };
    });
    syncTarget();
    form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        const body = formData(form);
        body.coach_ids = [...form.querySelectorAll('[data-coach]:checked')].map((el) => Number(el.dataset.coach));
        if (fromId) body.copy_banners_from = fromId;
        const data = await api(id ? 'sessions/' + id : 'sessions', body);
        const sid = data.session.id;
        try {
          for (const [k, b] of Object.entries(banners)) {
            if (b.blob) await uploadBanner(sid, k, b.blob);
            else if (b.removed && b.url) await api(`sessions/${sid}/banner`, { kind: k, remove: true });
          }
        } catch (err) { toast('Saved, but the banner did not upload: ' + err.message, true); }
        toast(id ? 'Saved.' : body.activity === 'external' ? 'Session created.' : 'Session created. Now add players and generate the schedule.');
        location.hash = '#/sessions/' + sid;
      } catch (err) {
        document.getElementById('ferr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
      }
    };
  }

  async function viewLive() {
    setNav('live');
    let d = await api('live');
    const draw = () => {
      app.innerHTML = `<div class="wrap">
        <div class="page-head"><div><h1>Live scores</h1><p class="muted">Updates automatically every few seconds.</p></div></div>
        ${d.sessions.length ? d.sessions.map((x) => `
          <section style="margin-bottom:34px">
            <div class="spread" style="margin-bottom:14px"><h2><a href="#/sessions/${x.session.id}" style="text-decoration:none">${esc(x.session.title)}</a></h2>
              <span class="small muted">${esc(x.session.format_label)} · ${esc(scoreTargetText(x.session))}</span></div>
            <div class="detail-grid" style="margin-top:0">
              <div class="stack">
                ${x.live.length ? `<div class="live-grid">${x.live.map((m) => scoreboard(m, { controls: true })).join('')}</div>`
                  : '<div class="card empty">No match in progress right now.</div>'}
                ${x.next.length ? `<h3 style="margin-top:24px">Up next</h3><div class="live-grid">${x.next.map((m) => scoreboard(m, { controls: true })).join('')}</div>` : ''}
                ${x.recent.length ? `<h3 style="margin-top:24px">Just finished</h3><div class="live-grid">${x.recent.map((m) => scoreboard(m)).join('')}</div>` : ''}
              </div>
              <aside class="card pad"><h3>Session leaderboard</h3>${sessionBoards(x.standings, { compact: true, empty: 'No players yet.' })}</aside>
            </div>
          </section>`).join('')
        : `<div class="card empty">${LOGO}<h2>Nothing live right now</h2><p>When a session starts, live scores show up here for everyone.</p><a class="btn dark" href="#/sessions">See sessions</a></div>`}
      </div>`;
    };
    app.onclick = (e) => {
      const b = e.target.closest('[data-score]');
      if (!b) return;
      const id = Number(b.dataset.score);
      for (const x of d.sessions) {
        const m = [...x.live, ...x.next, ...x.recent].find((y) => y.id === id);
        if (m) return openScoreModal(m, x.session, async () => { d = await api('live'); draw(); });
      }
    };
    draw();
    poll(async () => { const fresh = await api('live'); if (JSON.stringify(fresh.sessions) !== JSON.stringify(d.sessions)) { d = fresh; draw(); } }, 3000);
  }

  async function viewLeaderboard() {
    setNav('leaderboard');
    // Choices live in the address: #/leaderboard?tab=session&cat=mabar&fmt=singles
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const pick = { tab: q.get('tab') === 'session' ? 'session' : 'overall', cat: ['mabar', 'mini', 'external'].includes(q.get('cat')) ? q.get('cat') : 'mabar', fmt: ['singles', 'doubles'].includes(q.get('fmt')) ? q.get('fmt') : 'all' };
    const opt = (list, val) => list.map(([k, v]) => `<option value="${k}" ${k === val ? 'selected' : ''}>${v}</option>`).join('');
    const draw = async () => {
      const cat = pick.tab === 'session' ? pick.cat : 'all';
      const lb = await api(`leaderboard&cat=${cat}&fmt=${pick.fmt}`);
      history.replaceState(null, '', '#/leaderboard?' + new URLSearchParams(pick).toString());
      app.innerHTML = `<div class="wrap">
        <div class="page-head"><div><h1>Leaderboard</h1><p class="muted">RATA ranking points from Play Sessions (+1 for attending, +1 for every regular match you win), Internal Tournaments and External Tournaments. Points keep adding up.</p></div></div>
        <div class="seg lb-tabs" role="tablist"><button class="${pick.tab === 'session' ? 'on' : ''}" data-tab="session">By session</button><button class="${pick.tab === 'overall' ? 'on' : ''}" data-tab="overall">Overall Ranking</button></div>
        <div class="lb-filters">
          ${pick.tab === 'session' ? `<label class="lb-pick"><span>Activity type</span><select class="input" data-pick="cat">${opt([['mabar', ACTIVITY.mabar], ['mini', ACTIVITY.mini], ['external', ACTIVITY.external]], pick.cat)}</select></label>` : ''}
          <label class="lb-pick"><span>Format</span><select class="input" data-pick="fmt">${opt([['all', 'All'], ['singles', 'Singles'], ['doubles', 'Doubles']], pick.fmt)}</select></label>
        </div>
        <div class="card pad lb-card">${boardTable(lb.rows, { cat: lb.cat, empty: 'No RATA points here yet.' })}</div></div>`;
    };
    app.onclick = (e) => {
      const b = e.target.closest('[data-tab]');
      if (!b || b.dataset.tab === pick.tab) return;
      pick.tab = b.dataset.tab;
      draw();
    };
    app.onchange = (e) => {
      const s = e.target.closest('[data-pick]');
      if (!s) return;
      pick[s.dataset.pick] = s.value;
      draw();
    };
    await draw();
  }

  const SORTS = {
    rank: ['Overall ranking', (x, y) => (x.rank || 1e9) - (y.rank || 1e9) || x.name.localeCompare(y.name)],
    name: ['Name A–Z', (x, y) => x.name.localeCompare(y.name)],
    sessions: ['Most sessions', (x, y) => y.sessions - x.sessions || (x.rank || 1e9) - (y.rank || 1e9)],
    newest: ['Newest members', (x, y) => y.id - x.id],
  };

  function rankBadge(m) {
    if (!m.rank) return '<span class="rank-badge new">New member</span>';
    return `<span class="rank-badge ${m.rank === 1 ? 'gold' : ''}">#${m.rank} overall</span>`;
  }

  function photoBox(m, cls = '') {
    return m.photo
      ? `<div class="photo-box ${cls}"><img src="${esc(thumb(m.photo, 720))}" alt="${esc(m.name)}" loading="lazy"></div>`
      : `<div class="photo-box empty-photo ${cls}"><span>${esc(initials(m.name))}</span></div>`;
  }

  function eventBanner(s, joined) {
    if (!s) return '';
    const live = s.status === 'live';
    return `<section class="event-banner">
      <div class="event-copy">
        <span class="tag ${live ? 'live' : 'yellow'}">${live ? 'Live now' : 'Upcoming event'}</span>
        <h2>${esc(s.title)}</h2>
        <div class="event-when">${esc(fmtDate(s.date).toUpperCase())} · ${esc(s.start_time)} WITA</div>
        <div class="event-meta">${esc(s.format_label.split(' · ')[0])} · ${s.joined}/${s.max_players} players${s.location ? ' · ' + esc(s.location) : ''}</div>
        <div class="row wrap-ok" style="margin-top:6px">
          ${live && joined ? `<a class="btn" href="#/live">Watch live <span class="arrow"></span></a>`
            : `<a class="btn" href="#/sessions/${s.id}">${joined ? "You're in ✓" : 'Join now'} <span class="arrow"></span></a>`}
          <a class="btn ghost-light" href="#/sessions/${s.id}">View event</a>
        </div>
      </div>
    </section>`;
  }

  async function viewMembers() {
    setNav('members');
    const [d, ss] = await Promise.all([api('members'), api('sessions')]);
    const next = ss.upcoming.find((s) => s.status === 'live') || ss.upcoming.find((s) => s.status === 'open');
    let filter = '';
    let level = '';
    let gender = '';
    let sort = 'rank';
    try { sort = localStorage.getItem('bcs_member_sort') || 'rank'; } catch (e) { /* storage off */ }
    if (!SORTS[sort]) sort = 'rank';
    const draw = () => {
      const list = d.members.filter((m) => m.name.toLowerCase().includes(filter) && (!level || m.level === level) && (!gender || m.gender === gender)).sort(SORTS[sort][1]);
      document.getElementById('mcount').textContent = `${list.length} member${list.length === 1 ? '' : 's'}`;
      document.getElementById('mlist').innerHTML = list.length ? list.map((m) => `
        <a class="card society-card" href="#/members/${m.id}">
          ${photoBox(m)}
          <div class="society-info">
            <div class="row" style="gap:10px;flex-wrap:wrap"><h3>${esc(m.name)}</h3>${rankBadge(m)}${m.role === 'admin' ? '<span class="rank-badge new">Admin</span>' : ''}</div>
            <div class="spread"><span class="muted small">${m.points} pts · ${m.sessions} session${m.sessions === 1 ? '' : 's'}${m.level ? ` · <span class="level-chip ${esc(m.level)}">${esc(LEVELS[m.level] || m.level)}</span>` : ''}</span><span class="view-link">View profile <span class="arrow"></span></span></div>
            ${m.instagram ? `<span class="ig-link" role="link" tabindex="0" data-ig="${esc(m.instagram)}">${ICON.insta}@${esc(m.instagram)}</span>` : ''}
          </div>
        </a>`).join('')
        : '<div class="card empty" style="grid-column:1/-1">No members found.</div>';
    };
    app.innerHTML = `<div class="wrap">
      ${eventBanner(next, next && ss.mine.includes(next.id))}
      <div class="society-head">
        <div><h1>Meet the team.</h1><p class="muted lead-sm">The people behind every great session.</p></div>
        <div class="row wrap-ok society-tools">
          <label class="search-box">${ICON.search}<input class="input" id="msearch" placeholder="Search members…" aria-label="Search members"></label>
          <select class="input" id="mlevel" aria-label="Filter by level"><option value="">All levels</option>${Object.entries(LEVELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <select class="input" id="mgender" aria-label="Filter by gender"><option value="">All genders</option>${Object.entries(GENDERS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <select class="input" id="msort" aria-label="Sort members">${Object.entries(SORTS).map(([k, [label]]) => `<option value="${k}" ${k === sort ? 'selected' : ''}>${label}</option>`).join('')}</select>
          <span class="muted small" id="mcount"></span>
          ${isAdmin() ? '<button class="btn" data-act="new-member">+ Add member</button>' : ''}
        </div>
      </div>
      <div class="society-grid" id="mlist"></div></div>`;
    draw();
    document.getElementById('msearch').oninput = (e) => { filter = e.target.value.toLowerCase().trim(); draw(); };
    document.getElementById('mlevel').onchange = (e) => { level = e.target.value; draw(); };
    document.getElementById('mgender').onchange = (e) => { gender = e.target.value; draw(); };
    document.getElementById('msort').onchange = (e) => {
      sort = e.target.value;
      try { localStorage.setItem('bcs_member_sort', sort); } catch (err) { /* storage off */ }
      draw();
    };
    app.onclick = (e) => {
      const ig = e.target.closest('[data-ig]');
      if (ig) { e.preventDefault(); window.open('https://instagram.com/' + encodeURIComponent(ig.dataset.ig), '_blank', 'noopener'); return; }
      if (e.target.closest('[data-act="new-member"]')) memberModal();
    };
  }

  const instagramField = (m = {}) => `<label class="field">Instagram<input class="input" name="instagram" maxlength="200" value="${m.instagram ? '@' + esc(m.instagram) : ''}" placeholder="@yourname" autocapitalize="off" autocorrect="off"><span class="hint">Shown on your member card so people can find you.</span></label>`;

  function profileFields(m = {}, opts = {}) {
    const sel = (name, map, cur) => `<select class="input" name="${name}"><option value="">Choose…</option>${Object.entries(map)
      .map(([k, v]) => `<option value="${k}" ${cur === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
    return `
      <label class="field">WhatsApp number<input class="input" name="phone" maxlength="40" autocomplete="tel" inputmode="tel" value="${esc(m.phone || '')}" placeholder="08…"></label>
      <div class="form-grid" style="gap:14px">
        <label class="field">Gender${sel('gender', GENDERS, m.gender || '')}</label>
        <label class="field">Tennis level${sel('level', LEVELS, m.level || '')}</label>
      </div>
      ${opts.noInstagram ? '' : instagramField(m)}
      <label class="field">Coaching club / coach<input class="input" name="coach" maxlength="120" value="${esc(m.coach || '')}"></label>
      <label class="field">Tournament experience & achievements<textarea class="input" name="experience" maxlength="2000" rows="3" placeholder="Tournament name, year, result. One per line, e.g. Bali Open 2025, semi final">${esc(m.experience || '')}</textarea></label>`;
  }

  function memberModal(member) {
    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card">
      <form class="pad stack" id="mform" style="padding:24px">
        <h2>${member ? 'Edit member' : 'Add a member'}</h2>
        ${member ? '' : '<p class="muted small" style="margin:0">Email and password are optional. Add them so the member can log in. Members can also sign up themselves.</p>'}
        <label class="field">Name<input class="input" name="name" required maxlength="100" value="${esc(member ? member.name : '')}"></label>
        <label class="field">Email<input class="input" type="email" name="email" maxlength="190" value="${esc(member ? member.email || '' : '')}"></label>
        ${profileFields(member || {})}
        <label class="field">${member ? 'New password' : 'Password'}<input class="input" type="password" name="password" minlength="8" autocomplete="new-password" placeholder="${member ? 'Leave empty to keep' : 'At least 8 characters'}"></label>
        ${member ? `<label class="field">Role<select class="input" name="role"><option value="member" ${member.role === 'member' ? 'selected' : ''}>Member</option><option value="scorekeeper" ${member.role === 'scorekeeper' ? 'selected' : ''}>Scorekeeper (can score any match)</option><option value="coach" ${member.role === 'coach' ? 'selected' : ''}>Coach (confirms coaching attendance)</option><option value="admin" ${member.role === 'admin' ? 'selected' : ''}>Admin</option></select></label>` : ''}
        <div id="merr"></div>
        <div class="spread">
          ${member ? '<button type="button" class="btn sm danger" data-del>Delete member</button>' : '<span></span>'}
          <div class="row"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn dark" type="submit">Save</button></div>
        </div>
      </form></div></div>`;
    modalRoot.onclick = async (e) => {
      if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) return close();
      if (e.target.closest('[data-del]')) {
        if (!confirm(`Delete ${member.name}? This cannot be undone.`)) return;
        try { await api('members/' + member.id, { delete: true }); close(); memberCache = null; toast('Member deleted.'); location.hash = '#/members'; } catch (err) { toast(err.message, true); }
      }
    };
    document.getElementById('mform').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const data = await api(member ? 'members/' + member.id : 'members', formData(e.target));
        close();
        memberCache = null;
        toast('Saved.');
        if (location.hash === '#/members/' + data.member.id) render(); else location.hash = '#/members/' + data.member.id;
      } catch (err) {
        document.getElementById('merr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
      }
    };
  }

  // Downscales a photo in the browser (keeps uploads small on phones), falling back to the original file.
  async function shrinkImage(file) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement('canvas');
      c.width = Math.round(bmp.width * scale);
      c.height = Math.round(bmp.height * scale);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.88));
      return blob || file;
    } catch (e) {
      return file;
    }
  }

  // Lets the member pick the part of a photo to use (square by default): drag to move, slider or wheel/pinch to zoom.
  // Resolves to a JPEG blob, or null when cancelled.
  function cropPhoto(file, opts = {}) {
    const aspect = opts.aspect || 1; // width / height of the crop
    const maxOut = opts.max || 1000;
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); toast("Couldn't read that image.", true); resolve(null); };
      img.onload = () => {
        modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card crop-modal"><div class="pad stack" style="padding:20px">
          <h3>${esc(opts.title || 'Adjust your photo')}</h3>
          <div class="crop-frame" id="crop-frame" style="aspect-ratio:${aspect}"><img src="${url}" alt="" draggable="false"></div>
          <label class="row small" style="gap:10px">Zoom<input type="range" id="crop-zoom" min="1" max="4" step="0.01" value="1" style="flex:1"></label>
          <p class="small muted" style="margin:0">${esc(opts.note || 'Drag to move, zoom to fit. This square is exactly what shows on your member card and profile.')}</p>
          <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-crop="cancel">Cancel</button><button class="btn dark" data-crop="save">${esc(opts.save || 'Use photo')}</button></div>
        </div></div></div>`;
        const frame = document.getElementById('crop-frame');
        const el = frame.querySelector('img');
        const zoomInput = document.getElementById('crop-zoom');
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const size = frame.clientWidth; // frame width; its height is size / aspect
        const fh = size / aspect;
        let zoom = 1;
        let x = 0;
        let y = 0; // top-left of the image inside the frame, in frame pixels
        const scale = () => Math.max(size / W, fh / H) * zoom;
        const clamp = () => {
          const k = scale();
          x = Math.min(0, Math.max(size - W * k, x));
          y = Math.min(0, Math.max(fh - H * k, y));
        };
        const paint = () => {
          clamp();
          const k = scale();
          el.style.width = W * k + 'px';
          el.style.height = H * k + 'px';
          el.style.transform = `translate(${x}px, ${y}px)`;
        };
        const setZoom = (z) => {
          // keep the centre of the frame fixed while zooming
          const k0 = scale();
          const cx = (size / 2 - x) / k0;
          const cy = (fh / 2 - y) / k0;
          zoom = Math.min(4, Math.max(1, z));
          const k = scale();
          x = size / 2 - cx * k;
          y = fh / 2 - cy * k;
          zoomInput.value = zoom;
          paint();
        };
        x = (size - W * scale()) / 2;
        y = (fh - H * scale()) / 2;
        paint();

        const pts = new Map();
        let pinch = 0;
        frame.onpointerdown = (e) => { frame.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); };
        frame.onpointermove = (e) => {
          const prev = pts.get(e.pointerId);
          if (!prev) return;
          pts.set(e.pointerId, [e.clientX, e.clientY]);
          if (pts.size === 2) {
            const [a, b] = [...pts.values()];
            const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
            if (pinch) setZoom(zoom * (dist / pinch));
            pinch = dist;
            return;
          }
          x += e.clientX - prev[0];
          y += e.clientY - prev[1];
          paint();
        };
        frame.onpointerup = frame.onpointercancel = (e) => { pts.delete(e.pointerId); pinch = 0; };
        frame.onwheel = (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); };
        zoomInput.oninput = () => setZoom(Number(zoomInput.value));

        const done = (blob) => { URL.revokeObjectURL(url); modalRoot.innerHTML = ''; resolve(blob); };
        modalRoot.onclick = (e) => {
          const b = e.target.closest('[data-crop]');
          if (!b) return;
          if (b.dataset.crop === 'cancel') return done(null);
          const k = scale();
          const out = Math.min(maxOut, Math.round(size / k));
          const c = document.createElement('canvas');
          c.width = out;
          c.height = Math.round(out / aspect);
          c.getContext('2d').drawImage(img, -x / k, -y / k, size / k, fh / k, 0, 0, c.width, c.height);
          c.toBlob((blob) => done(blob || file), 'image/jpeg', 0.9);
        };
      };
      img.src = url;
    });
  }

  // Saves the cropped square plus the uncropped original (or keeps the stored original when re-cropping).
  async function uploadPhoto(memberId, cropped, original) {
    const fd = new FormData();
    fd.append('photo', cropped, 'photo.jpg');
    if (original) fd.append('original', await shrinkImage(original), 'original.jpg');
    else fd.append('keep_original', '1');
    const res = await fetch('api/index.php?r=members/' + memberId + '/photo', {
      method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'bcs' }, body: fd,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data;
  }

  // Re-opens the cropper on the stored original, so the member can re-frame without uploading again.
  async function recropPhoto(m) {
    const res = await fetch(m.photo_orig || m.photo, { credentials: 'same-origin' });
    if (!res.ok) throw new Error("Couldn't load the photo.");
    const blob = await res.blob();
    const cropped = await cropPhoto(blob);
    if (!cropped) return null;
    return uploadPhoto(m.id, cropped, m.photo_orig ? null : blob);
  }

  async function uploadImage(route, field, file, extra = {}) {
    const fd = new FormData();
    Object.entries(extra).forEach(([k, v]) => fd.append(k, v));
    fd.append(field, await shrinkImage(file), field + '.jpg');
    const res = await fetch('api/index.php?r=' + route, {
      method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'bcs' }, body: fd,
    });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data;
  }

  // ---- External tournament results ----
  const EXT_STATUS = { pending: ['Waiting for approval', 'yellow'], needs_revision: ['Needs changes', 'warn'], approved: ['Approved', 'ok'], rejected: ['Not approved', 'bad'] };

  function resultCard(r, opts = {}) {
    const st = EXT_STATUS[r.status] || [r.status, ''];
    // On the partner's own profile, "with" names the member who submitted it.
    const other = r.partner && opts.viewer === r.partner.id ? r.user : r.partner;
    const partner = other ? `with <a class="link" href="#/members/${other.id}">${esc(other.name)}</a>` : r.partner_name ? `with ${esc(r.partner_name)}` : '';
    return `<div class="ext-card" data-ext="${r.id}">
      <div class="ext-place ${r.placement}">${esc(r.placement_label)}</div>
      <div class="ext-body">
        <div class="spread" style="align-items:flex-start;gap:8px"><b>${esc(r.tournament)}</b>
          <span class="ext-status ${st[1]}">${st[0]}${r.status === 'approved' ? ` · ${r.points ? '+' + r.points + ' RATA pts' : 'no points'}` : ''}</span></div>
        <div class="small muted">${esc(fmtDate(r.event_date))}${r.organizer ? ' · ' + esc(r.organizer) : ''}${r.category ? ' · ' + esc(r.category) : ''} · ${esc(r.level_label)} · ${r.format === 'singles' ? 'Singles' : 'Doubles'} ${partner} · ${r.entrants} ${r.format === 'singles' ? 'players' : 'pairs'}</div>
        ${opts.who ? `<div class="small">Submitted by <a class="link" href="#/members/${r.user.id}">${esc(r.user.name)}</a> · ${esc(fmtDate(r.created_at.slice(0, 10)))}</div>` : ''}
        ${r.status !== 'approved' && r.estimate !== undefined && (opts.who || r.can_edit) ? `<div class="small">If approved: <b>${r.estimate ? r.estimate + ' RATA points' : `0 points (fewer than ${EXT_MIN} ${r.format === 'singles' ? 'players' : 'pairs'})`}</b></div>` : ''}
        ${r.review_note && r.status !== 'approved' ? `<div class="ext-note">${esc(r.review_note)}</div>` : ''}
        ${r.notes && opts.who ? `<div class="small" style="white-space:pre-line">${esc(r.notes)}</div>` : ''}
        ${(r.has_proof || r.proof_link) && (opts.who || r.can_edit) ? `<div class="row wrap-ok small">${r.has_proof ? `<a class="link" href="api/index.php?r=external/${r.id}/proof" target="_blank" rel="noopener">Proof photo</a>` : ''}${r.proof_link ? `<a class="link" href="${esc(r.proof_link)}" target="_blank" rel="noopener nofollow">Proof link ↗</a>` : ''}</div>` : ''}
        ${r.can_edit || r.can_withdraw ? `<div class="row wrap-ok">${r.can_edit ? `<button class="btn xs ghost" data-act="ext-edit" data-id="${r.id}">Edit</button>` : ''}${r.can_withdraw ? `<button class="btn xs ghost" data-act="ext-del" data-id="${r.id}">Withdraw</button>` : ''}</div>` : ''}
        ${opts.review ? `<div class="row wrap-ok ext-actions">
          ${r.status !== 'approved' ? `<button class="btn xs dark" data-act="ext-review" data-do="approve" data-id="${r.id}">Approve${r.estimate ? ' +' + r.estimate : ''}</button>` : ''}
          ${r.status !== 'needs_revision' ? `<button class="btn xs ghost" data-act="ext-review" data-do="revise" data-id="${r.id}">Ask for changes</button>` : ''}
          ${r.status !== 'rejected' ? `<button class="btn xs ghost" data-act="ext-review" data-do="reject" data-id="${r.id}">Reject</button>` : ''}
          ${r.status === 'approved' ? `<button class="btn xs ghost" data-act="ext-del" data-id="${r.id}">Delete (reverses points)</button>` : ''}</div>` : ''}
      </div></div>`;
  }
  const EXT_MIN = 4;

  function resultsSection(list, isMe, memberId) {
    if (!list.length && !isMe) return '';
    return `<div><div class="spread" style="margin-bottom:10px"><h2>Tournament results</h2>${isMe ? '<button class="btn sm dark" data-act="ext-new">+ Submit a result</button>' : isAdmin() ? `<button class="btn sm dark" data-act="ext-add-for" data-id="${memberId}">+ Add a result</button>` : ''}</div>
      ${list.length ? `<div class="card pad stack ext-list">${list.map((r) => resultCard(r, { viewer: memberId })).join('')}</div>`
        : '<div class="card pad empty small">Played an outside tournament? Submit your result with a photo or link as proof. Once an admin approves it, it adds RATA points.</div>'}</div>`;
  }

  async function externalModal(existing, onSaved, prefill = {}) {
    const close = () => { modalRoot.innerHTML = ''; };
    const meta = await api('external');
    const rules = meta.rules;
    if (!memberCache) memberCache = (await api('members')).members;
    const r = existing || { tournament: '', organizer: '', event_date: '', category: '', level: 'beginner', format: 'doubles', placement: 'champion', entrants: '', partner: null, partner_name: '', proof_link: '', notes: '', has_proof: false, ...prefill };
    const opt = (v, cur, label) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
    // An admin editing someone else's result: it keeps its review status (approved stays approved, with points worked out again).
    const adminEdit = existing && isAdmin() && existing.user && existing.user.id !== state.user.id;
    const lead = adminEdit ? `Editing ${esc(existing.user.name)}'s result as an admin. It keeps its status${existing.status === 'approved' ? ' and its RATA points are worked out again' : ''}.`
      : existing && existing.status === 'approved' ? 'Saving sends it back to an admin for approval. Its RATA points are paused until it is approved again.'
      : prefill.admin ? 'Added by an admin, so it is approved straight away and needs no proof.' : 'An admin checks it before it adds RATA points.';
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card wide">
      <form class="pad stack" id="extform" style="padding:24px">
        <h2>${existing ? 'Edit tournament result' : prefill.admin ? 'Add a tournament result' : 'Submit a tournament result'}</h2>
        <p class="small muted" style="margin:0">${lead} Points = base points for your result × the category level, and need at least ${rules.min_entrants} players or pairs in your category.</p>
        <div class="form-grid">
          ${prefill.admin ? `<label class="field full">Member<select class="input" name="member_id" required><option value="" disabled ${prefill.member_id ? '' : 'selected'}>Pick the member</option>${memberCache.map((x) => opt(x.id, prefill.member_id || '', x.name)).join('')}</select></label>` : ''}
          <label class="field full">Tournament<input class="input" name="tournament" required maxlength="160" value="${esc(r.tournament)}" placeholder="Bali Open 2026"></label>
          <label class="field">Organizer<input class="input" name="organizer" maxlength="160" value="${esc(r.organizer)}" placeholder="Club, federation…"></label>
          <label class="field">Date<input class="input" type="date" name="event_date" required max="${todayISO()}" value="${esc(r.event_date)}"></label>
          <label class="field">Category<select class="input" name="category" required><option value="" disabled ${rules.categories.includes(r.category) ? '' : 'selected'}>Pick one</option>${rules.categories.map((c) => `<option ${c === r.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="field">Category level<select class="input" name="level">${Object.entries(rules.levels).map(([k, v]) => opt(k, r.level, `${v[0]} (× ${v[1]})`)).join('')}</select></label>
          <label class="field">Format<select class="input" name="format">${opt('singles', r.format, 'Singles')}${opt('doubles', r.format, 'Doubles')}</select></label>
          <label class="field">${prefill.admin ? 'Result' : 'Your result'}<select class="input" name="placement">${Object.entries(rules.places).map(([k, v]) => opt(k, r.placement, v)).join('')}</select></label>
          <label class="field">Players or pairs in your category<input class="input" type="number" name="entrants" min="1" max="1024" required value="${esc(r.entrants)}" inputmode="numeric"></label>
          <label class="field doubles-only">Partner (member)<select class="input" name="partner_id"><option value="">Not a RATA member / no partner</option>${memberCache.filter((x) => prefill.admin || x.id !== state.user.id).map((x) => opt(x.id, r.partner ? r.partner.id : '', x.name)).join('')}</select></label>
          <label class="field doubles-only">Partner name (if not a member)<input class="input" name="partner_name" maxlength="100" value="${esc(r.partner_name || '')}"></label>
          <label class="field">Proof photo<input class="input" type="file" name="proof" accept="image/*"><span class="hint">${r.has_proof ? 'A photo is attached. Pick a new one to replace it.' : 'Draw, results board, certificate…'}</span></label>
          <label class="field">Or proof link<input class="input" name="proof_link" maxlength="500" value="${esc(r.proof_link || '')}" placeholder="https://"></label>
          <label class="field full">Notes for the admin<textarea class="input" name="notes" maxlength="1000">${esc(r.notes || '')}</textarea></label>
        </div>
        <div class="ext-estimate" id="extest"></div>
        <div id="exterr"></div>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn dark" type="submit">${adminEdit ? 'Save changes' : existing ? 'Save and resubmit' : prefill.admin ? 'Add result' : 'Submit for approval'}</button></div>
      </form></div></div>`;
    const form = document.getElementById('extform');
    const update = () => {
      const f = formData(form);
      form.querySelectorAll('.doubles-only').forEach((el) => el.classList.toggle('hidden', f.format !== 'doubles'));
      const n = Number(f.entrants);
      const base = rules.base[f.format][f.placement];
      const mult = rules.levels[f.level][1];
      document.getElementById('extest').innerHTML = !n ? '' : n < rules.min_entrants
        ? `Fewer than ${rules.min_entrants} in the category: <b>0 RATA points</b> (the result is still kept on your profile).`
        : `If approved: <b>${Math.round(base * mult + 1e-9)} RATA points</b> (${base} × ${mult})${f.format === 'doubles' && f.partner_id ? ', and the same for your partner' : ''}.`;
    };
    form.oninput = update; form.onchange = update; update();
    modalRoot.onclick = (e) => { if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) close(); };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData();
      const f = formData(form);
      Object.entries(f).forEach(([k, v]) => { if (k !== 'proof') fd.append(k, v); });
      if (f.format !== 'doubles') { fd.set('partner_id', ''); fd.set('partner_name', ''); }
      const file = form.proof.files[0];
      if (file) fd.append('proof', await shrinkImage(file), 'proof.jpg');
      const btn = form.querySelector('[type=submit]');
      btn.disabled = true;
      try {
        const res = await fetch('api/index.php?r=external' + (existing ? '/' + existing.id : ''), { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'bcs' }, body: fd });
        let data = {};
        try { data = await res.json(); } catch (err) { /* non-JSON */ }
        if (!res.ok) throw new Error(data.error || `Could not save (${res.status})`);
        close(); toast(adminEdit ? 'Result updated.' : prefill.admin ? 'Result added and approved.' : 'Sent for approval. You will get a notification when it is checked.'); onSaved();
      } catch (err) { btn.disabled = false; document.getElementById('exterr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
    };
  }

  // Admin: who corrected what and why (score corrections, takeovers, reviews, roles, placements…).
  const AUDIT_LABELS = {
    match_undo: 'Undid a point', match_reopen: 'Reopened a match', match_finish: 'Finished a match', match_serve: 'Corrected the server',
    match_correction: 'Corrected a score', match_done: 'Finished a match', match_scheduled: 'Reset a match', match_placement: 'Changed placement final',
    scoring_takeover: 'Took over scoring', session_status: 'Changed session status', placements_confirm: 'Confirmed tournament placements', placements_draft: 'Saved draft placements',
    external_approve: 'Approved a tournament result', external_add: 'Added a tournament result for a member', refund_done: 'Marked a refund as paid back', refund_undo: 'Undid a refund', external_edit: 'Edited a tournament result', hero_add: 'Added a homepage banner photo', hero_delete: 'Removed a homepage banner photo', placements_auto: 'Set placements from the leaderboard', external_reject: 'Rejected a tournament result', external_revise: 'Asked for changes to a result',
    reward_given: 'Gave a reward', reward_cancelled: 'Cancelled a reward claim', attendance: 'Confirmed coaching attendance', role_change: 'Changed a role', season_create: 'Started a season',
  };
  async function viewAudit() {
    setNav('');
    if (!state.user) return needLogin();
    if (!isAdmin()) return showError(new Error('Only admins can see the audit log.'));
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    const d = await api('audit' + (q.get('entity') ? '&entity=' + encodeURIComponent(q.get('entity')) : '') + (q.get('id') ? '&id=' + encodeURIComponent(q.get('id')) : ''));
    const fmt = (v) => (v === null || v === undefined ? '–' : esc(Object.entries(v).map(([k, x]) => `${k}: ${Array.isArray(x) ? x.join('-') : typeof x === 'object' && x !== null ? JSON.stringify(x) : x}`).join(', ')));
    const link = (e) => (e.entity === 'match' ? `<a class="link" href="#/score/${e.entity_id}">Match #${e.entity_id}</a>` : e.entity === 'session' ? `<a class="link" href="#/sessions/${e.entity_id}">Session #${e.entity_id}</a>`
      : e.entity === 'user' ? `<a class="link" href="#/members/${e.entity_id}">Member #${e.entity_id}</a>` : `${esc(e.entity)} #${e.entity_id}`);
    app.innerHTML = `<div class="wrap" style="max-width:1000px">
      <div class="page-head"><div><h1>Audit log</h1><p class="muted">Corrections and admin decisions, newest first. Points taps are kept in each match's own log.</p>
        ${q.get('entity') ? '<a class="link small" href="#/audit">Show everything</a>' : ''}</div></div>
      ${d.entries.length ? `<div class="card table-scroll"><table class="fin-table"><thead><tr><th>When</th><th>Who</th><th>What</th><th>Before</th><th>After</th><th>Reason</th></tr></thead><tbody>
        ${d.entries.map((e) => `<tr><td class="small">${esc(e.created_at.slice(0, 16))}</td><td>${e.actor ? esc(e.actor.name) : '–'}</td><td>${esc(AUDIT_LABELS[e.action] || e.action)}<div class="small">${link(e)}</div></td>
          <td class="small">${fmt(e.before)}</td><td class="small">${fmt(e.after)}</td><td class="small">${esc(e.reason || '')}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="card pad empty">Nothing recorded yet.</div>'}
    </div>`;
  }

  // Admin feed of what members do (sign-ups, joining or leaving sessions, payments, results, reviews, comments), with date and time.
  const ACTIVITY_KINDS = { '': 'Everything', signup: 'New members', join: 'Joined', leave: 'Left', payment: 'Payments', result: 'Results', external: 'External', review: 'Reviews', comment: 'Comments', reward: 'Rewards', refund: 'Refunds', chat: 'Chat' };

  // ---------- chat ----------

  // A chat box: messages (and "X joined" lines) by day, newest at the bottom, polled every few seconds.
  // load(after) and send(body, after) return {messages, joined?}. The box is one DOM node, so a page that
  // redraws can put the same node back without losing the conversation or what is being typed.
  function chatBox(opts) {
    let msgs = [];
    let joined = [];
    let last = 0;
    let people = [];
    const tagged = new Map(); // id -> name, picked from the @ list for the message being written
    const el = document.createElement('div');
    el.className = 'chat';
    el.innerHTML = `<div class="chat-log" aria-live="polite"><div class="muted small" style="text-align:center;padding:20px">Loading…</div></div>
      <div class="mention-pick hidden" role="listbox"></div>
      <form class="chat-form"><textarea class="input" rows="1" maxlength="1000" placeholder="Write a message…" required></textarea><button class="btn dark" type="submit">Send</button></form>`;
    const log = el.querySelector('.chat-log');
    const ta = el.querySelector('textarea');
    const pick = el.querySelector('.mention-pick');
    const time = (at) => at.slice(11, 16);
    // Message text with each tagged member's "@Full Name" turned into a link to their profile.
    const bodyHtml = (x) => {
      let html = esc(x.body);
      [...(x.mentions || [])].sort((a, b) => b.name.length - a.name.length).forEach((m) => {
        html = html.split(esc('@' + m.name)).join(`<a class="mention ${state.user && m.id === state.user.id ? 'me' : ''}" href="#/members/${m.id}">@${esc(m.name)}</a>`);
      });
      return html;
    };
    const draw = () => {
      const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      const items = [...joined.map((j) => ({ ...j, join: true })), ...msgs].sort((a, b) => a.at.localeCompare(b.at) || (a.join ? -1 : 1));
      let day = '';
      const me = state.user && state.user.id;
      log.innerHTML = items.length ? items.map((x, i) => {
        const d0 = x.at.slice(0, 10);
        const head = d0 !== day ? `<div class="chat-day">${esc(fmtDay(d0))} ${d0.slice(0, 4)}</div>` : '';
        day = d0;
        if (x.join) return head + `<div class="chat-join"><span>${esc(x.name)} joined</span></div>`;
        const prev = items[i - 1];
        const cont = prev && !prev.join && prev.user.id === x.user.id && prev.at.slice(0, 10) === d0;
        const mine = x.user.id === me;
        return head + `<div class="chat-msg ${mine ? 'mine' : ''} ${cont ? 'cont' : ''}">
          ${mine ? '' : `<a class="chat-av" href="#/members/${x.user.id}">${cont ? '' : avatar(x.user, 'dark')}</a>`}
          <div class="chat-bubble">${mine || cont ? '' : `<a class="chat-name" href="#/members/${x.user.id}">${esc(x.user.name)}</a>`}
            <div class="chat-text" data-notr>${bodyHtml(x)}</div>
            <div class="chat-meta">${x.can_delete ? `<button class="link-btn" data-chat-del="${x.id}">Delete</button>` : ''}<span>${esc(time(x.at))}</span></div></div></div>`;
      }).join('') : `<div class="muted small" style="text-align:center;padding:20px">${esc(opts.empty || 'No messages yet. Say hi!')}</div>`;
      if (nearBottom || opts.firstDraw) { log.scrollTop = log.scrollHeight; opts.firstDraw = false; }
    };
    const add = (r) => {
      if (r.joined) joined = r.joined;
      if (r.people) people = r.people;
      const have = new Set(msgs.map((m) => m.id));
      r.messages.forEach((m) => { if (!have.has(m.id)) msgs.push(m); });
      if (msgs.length) last = Math.max(last, ...msgs.map((m) => m.id));
    };
    const refresh = async () => { try { const r = await opts.load(last); if (r.messages.length || !last) { add(r); draw(); } } catch (e) { /* offline: try again later */ } };
    el.querySelector('form').onsubmit = async (e) => {
      e.preventDefault();
      const body = ta.value.trim();
      if (!body) return;
      const btn = el.querySelector('button[type=submit]');
      btn.disabled = true;
      const mentions = [...tagged].filter(([, n]) => body.includes('@' + n)).map(([id]) => id);
      try { add(await opts.send(body, last, mentions)); tagged.clear(); ta.value = ''; ta.style.height = ''; log.scrollTop = 1e9; draw(); log.scrollTop = log.scrollHeight; } catch (err) { toast(err.message, true); }
      btn.disabled = false;
      ta.focus();
    };
    // @ mentions: typing @ and part of a name lists the matching people; picking one writes "@Full Name ".
    let matches = [];
    let at = -1;
    const closePick = () => { pick.classList.add('hidden'); matches = []; };
    const showPick = () => {
      const upto = ta.value.slice(0, ta.selectionStart);
      const m = /(^|\s)@([^@\n]{0,30})$/.exec(upto);
      if (!m || !people.length) return closePick();
      const q = m[2].toLowerCase();
      at = upto.length - m[2].length - 1;
      const me = state.user && state.user.id;
      matches = people.filter((p) => p.id !== me && p.name.toLowerCase().includes(q)).slice(0, 6);
      if (!matches.length) return closePick();
      pick.innerHTML = matches.map((p, i) => `<button type="button" class="${i ? '' : 'on'}" data-pick="${i}">${avatar(p, 'dark')}<span>${esc(p.name)}</span></button>`).join('');
      pick.classList.remove('hidden');
    };
    const choose = (i) => {
      const p = matches[i];
      if (!p) return;
      const before = ta.value.slice(0, at);
      const after = ta.value.slice(ta.selectionStart);
      const ins = '@' + p.name + ' ';
      ta.value = before + ins + after;
      const pos = before.length + ins.length;
      ta.focus(); ta.setSelectionRange(pos, pos);
      tagged.set(p.id, p.name);
      closePick();
    };
    pick.addEventListener('mousedown', (e) => e.preventDefault());
    pick.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) choose(Number(b.dataset.pick)); });
    ta.addEventListener('input', showPick);
    ta.addEventListener('click', showPick);
    ta.addEventListener('blur', () => setTimeout(closePick, 150));
    ta.addEventListener('keydown', (e) => {
      if (!matches.length) return;
      const items = [...pick.querySelectorAll('[data-pick]')];
      const cur = items.findIndex((b) => b.classList.contains('on'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const nxt = (cur + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach((b, i) => b.classList.toggle('on', i === nxt));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault(); e.stopImmediatePropagation(); choose(Math.max(cur, 0));
      } else if (e.key === 'Escape') closePick();
    });
    if (opts.people) opts.people().then((list) => { people = list; }).catch(() => {});
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(hover: hover)').matches) { e.preventDefault(); el.querySelector('form').requestSubmit(); } });
    ta.addEventListener('input', () => { ta.style.height = ''; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-chat-del]');
      if (!b || !confirm('Delete this message?')) return;
      try { await api('chat/' + b.dataset.chatDel + '/delete', {}); msgs = msgs.filter((m) => m.id !== Number(b.dataset.chatDel)); draw(); } catch (err) { toast(err.message, true); }
    });
    opts.firstDraw = true;
    refresh();
    clearInterval(state.chatTimer);
    state.chatTimer = setInterval(() => { if (!document.hidden && document.body.contains(el)) refresh(); }, 4000);
    // Put the box back where a redraw left its placeholder, keeping focus and the cursor in the message.
    el.mount = (slot) => {
      if (!slot) return;
      const focus = document.activeElement === ta ? [ta.selectionStart, ta.selectionEnd] : null;
      slot.replaceWith(el);
      if (focus) { ta.focus(); ta.setSelectionRange(...focus); }
    };
    return el;
  }

  // Create a chat channel open to every member, then open it.
  function channelModal() {
    if (!state.user) return needLogin();
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card"><form class="pad stack" style="padding:24px" id="ch-form">
      <h2>Create Chat Channel</h2>
      <p class="small muted" style="margin:0">A place to talk with all RATA members, like a forum. Every member can read and write in it.</p>
      <label class="field">Channel name<input class="input" name="name" required maxlength="80" placeholder="Find a hitting partner, Sanur players…"></label>
      <label class="field">What is it about? <span class="muted">(optional)</span><input class="input" name="description" maxlength="255"></label>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" type="button" data-close>Cancel</button><button class="btn dark" type="submit">Create channel</button></div>
    </form></div></div>`;
    modalRoot.onclick = (e) => { if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) modalRoot.innerHTML = ''; };
    document.getElementById('ch-form').onsubmit = async (e) => {
      e.preventDefault();
      try { const r = await api('chats', formData(e.target)); modalRoot.innerHTML = ''; location.hash = '#/chat/' + r.channel.id; } catch (err) { toast(err.message, true); }
    };
  }

  async function viewChats() {
    setNav('');
    if (!state.user) return needLogin();
    const d = await api('chats');
    const lastLine = (l) => l ? `<span class="small muted chat-last" data-notr>${esc(l.name.split(' ')[0])}: ${esc(l.body)}</span>` : '<span class="small muted">No messages yet</span>';
    app.innerHTML = `<div class="wrap" style="max-width:820px">
      <div class="page-head"><div><h1>Chats</h1><p class="muted">Chat channels are open to every member. Each session also has its own chat for the players in it.</p></div>
        <button class="btn dark" data-act="new-channel">${ICON.chat} Create Chat Channel</button></div>
      <h2 style="margin-bottom:10px">Chat channels</h2>
      ${d.channels.length ? `<div class="card history">${d.channels.map((c) => `<a href="#/chat/${c.id}"><div><b>${esc(c.name)}</b>${c.description ? `<div class="small muted">${esc(c.description)}</div>` : ''}${lastLine(c.last)}</div>
        <div class="hist-right"><span class="small muted" style="white-space:nowrap">${c.last ? esc(fmtDay(c.last.at.slice(0, 10))) : ''}</span></div><span class="chev">›</span></a>`).join('')}</div>`
        : '<div class="card pad empty">No channels yet. Start the first one!</div>'}
      <h2 style="margin:24px 0 10px">Session chats</h2>
      ${d.sessions.length ? `<div class="card history">${d.sessions.map((s) => `<a href="#/sessions/${s.id}?chat"><div><b>${esc(s.title)}</b><div class="small muted">${esc(fmtDate(s.date))}</div>${lastLine(s.last)}</div>
        <div class="hist-right"></div><span class="chev">›</span></a>`).join('')}</div>`
        : '<div class="card pad empty">Join a session to chat with its players.</div>'}
    </div>`;
    app.onclick = (e) => { if (e.target.closest('[data-act="new-channel"]')) channelModal(); };
  }

  async function viewChannel(id) {
    setNav('');
    if (!state.user) return needLogin();
    const d = await api('chats/' + id);
    const c = d.channel;
    app.innerHTML = `<div class="wrap" style="max-width:820px">
      <div class="small" style="margin-bottom:14px"><a class="link" href="#/chat">‹ Chats</a> / ${esc(c.name)}</div>
      <div class="spread" style="align-items:flex-start;margin-bottom:12px"><div><h1 style="margin:0">${esc(c.name)}</h1>
        ${c.description ? `<p class="muted" style="margin:4px 0 0" data-notr>${esc(c.description)}</p>` : ''}<div class="small muted">Opened by ${esc(c.created_by.name)} · open to all members</div></div>
        ${c.can_delete ? '<button class="btn sm danger" data-act="del-channel">Delete channel</button>' : ''}</div>
      <div class="card chat-card"><div id="chat-slot"></div></div></div>`;
    const box = chatBox({
      load: (after) => api(`chats/${id}&after=${after}`),
      send: (body, after, mentions) => api('chats/' + id, { body, after, mentions }),
      people: async () => { if (!memberCache) memberCache = (await api('members')).members; return memberCache; },
      empty: 'No messages yet. Start the conversation!',
    });
    box.mount(document.getElementById('chat-slot'));
    app.onclick = async (e) => {
      if (!e.target.closest('[data-act="del-channel"]') || !confirm('Delete this channel and all its messages?')) return;
      try { await api(`chats/${id}/delete`, {}); toast('Channel deleted.'); location.hash = '#/chat'; } catch (err) { toast(err.message, true); }
    };
  }

  async function viewActivity() {
    setNav('');
    if (!state.user) return needLogin();
    if (!isAdmin()) return showError(new Error('Only admins can see member activity.'));
    const kind = new URLSearchParams(location.hash.split('?')[1] || '').get('kind') || '';
    const q = (before) => 'activity' + (kind ? '&kind=' + encodeURIComponent(kind) : '') + (before ? '&before=' + before : '');
    const d = await api(q(0));
    if (!kind) { state.unread = 0; renderTop(); }
    let items = d.items;
    let more = d.more;
    const row = (a) => `<a class="act-row ${!kind && a.id > d.seen ? 'new' : ''}" href="${esc(a.url || '#/activity')}">
        <span class="act-time">${esc(a.created_at.slice(11, 16))}</span>${a.user ? avatar(a.user, 'dark') : '<span></span>'}
        <span class="act-text">${esc(a.text)}</span></a>`;
    const draw = () => {
      let day = '';
      const list = items.map((a) => {
        const d0 = a.created_at.slice(0, 10);
        const head = d0 !== day ? `<div class="act-day">${esc(fmtDay(d0))} ${d0.slice(0, 4)}</div>` : '';
        day = d0;
        return head + row(a);
      }).join('');
      app.innerHTML = `<div class="wrap" style="max-width:820px">
        <div class="page-head"><div><h1>Member activity</h1><p class="muted">Everything members do on the site, newest first, with the date and time (WITA). It's kept for good. You also get a notification when someone signs up, joins or leaves a session, or sends a payment.</p></div></div>
        <div class="seg sub board-switch" style="margin-bottom:14px">${Object.entries(ACTIVITY_KINDS).map(([k, v]) => `<a class="${k === kind ? 'on' : ''}" href="#/activity${k ? '?kind=' + k : ''}">${v}</a>`).join('')}</div>
        ${items.length ? `<div class="card pad act-list">${list}</div>${more ? '<div style="text-align:center;margin-top:14px"><button class="btn ghost" data-act="older">Show older</button></div>' : ''}`
          : '<div class="card pad empty">Nothing recorded yet.</div>'}
      </div>`;
    };
    draw();
    app.onclick = async (e) => {
      const b = e.target.closest('[data-act="older"]');
      if (!b) return;
      b.disabled = true;
      try { const r = await api(q(items[items.length - 1].id)); items = items.concat(r.items); more = r.more; draw(); } catch (err) { b.disabled = false; toast(err.message, true); }
    };
  }

  // Admin queue: check submitted results and approve, ask for changes, or reject.
  async function viewApprovals() {
    setNav('');
    if (!state.user) return needLogin();
    if (!isAdmin()) return showError(new Error('Only admins can review tournament results.'));
    const status = new URLSearchParams(location.hash.split('?')[1] || '').get('status') || 'pending';
    const rewards = status === 'rewards';
    const [d, rw] = await Promise.all([api('external&status=' + encodeURIComponent(rewards ? 'pending' : status)), api('rewards')]);
    if (rewards) d.status = 'rewards';
    d.counts.rewards = rw.rewards.length;
    const tabs = [['pending', 'To check'], ['needs_revision', 'Needs changes'], ['approved', 'Approved'], ['rejected', 'Not approved'], ['rewards', 'Reward claims']];
    app.innerHTML = `<div class="wrap" style="max-width:900px">
      <div class="page-head"><div><h1>Tournament approvals</h1><p class="muted">External tournament results submitted by members. Only approved results add RATA points; the points are worked out from the result, the category level and the number of entrants.</p></div>
        <button class="btn dark" data-act="ext-add-for">+ Add a result for a member</button></div>
      <div class="seg sub board-switch" style="margin-bottom:14px">${tabs.map(([k, v]) => `<a class="${k === d.status ? 'on' : ''}" href="#/approvals?status=${k}">${v}${d.counts[k] ? ` (${d.counts[k]})` : ''}</a>`).join('')}</div>
      ${rewards ? (rw.rewards.length ? `<div class="card pad stack ext-list">${rw.rewards.map((r) => `<div class="ext-card"><div class="ext-place champion">🎁</div><div class="ext-body">
          <b>${esc(r.label)}</b><div class="small muted">Claimed by <a class="link" href="#/members/${r.user.id}">${esc(r.user.name)}</a> · ${esc(fmtDate(r.created_at.slice(0, 10)))}</div>
          <div class="row wrap-ok ext-actions"><button class="btn xs dark" data-act="reward" data-do="give" data-id="${r.id}">Mark as given</button><button class="btn xs ghost" data-act="reward" data-do="cancel" data-id="${r.id}">Cancel (back to wallet)</button></div></div></div>`).join('')}</div>`
          : '<div class="card pad empty">No reward claims waiting.</div>')
        : d.results.length ? `<div class="card pad stack ext-list">${d.results.map((r) => resultCard(r, { who: true, review: true })).join('')}</div>`
        : '<div class="card pad empty">Nothing here.</div>'}
    </div>`;
    app.onclick = async (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const id = Number(a.dataset.id);
      if (a.dataset.act === 'ext-add-for') return externalModal(null, () => render(), { admin: true });
      if (a.dataset.act === 'ext-edit') return externalModal(d.results.find((x) => x.id === id), () => render());
      if (a.dataset.act === 'reward') {
        try { await api(`rewards/${id}`, { action: a.dataset.do }); toast(a.dataset.do === 'give' ? 'Marked as given.' : 'Cancelled. The reward is back in their wallet.'); render(); } catch (err) { toast(err.message, true); }
        return;
      }
      if (a.dataset.act === 'ext-review') {
        const act = a.dataset.do;
        let note = '';
        if (act !== 'approve') {
          note = prompt(act === 'reject' ? 'Why is it not approved? The member sees this.' : 'What should the member change? They see this.');
          if (!note) return;
        }
        try { await api(`external/${id}/review`, { action: act, note }); toast(act === 'approve' ? 'Approved. Points added.' : 'Saved. The member was notified.'); render(); } catch (err) { toast(err.message, true); }
      }
      if (a.dataset.act === 'ext-del') {
        if (!confirm('Delete this result? Any RATA points it gave are reversed.')) return;
        try { await api(`external/${id}/delete`, {}); toast('Deleted.'); render(); } catch (err) { toast(err.message, true); }
      }
    };
  }

  // Coaching reward wallet: paid sessions toward the next reward, rewards earned and used.
  function walletCard(c, isMe) {
    const st = { requested: 'Claimed · waiting', given: 'Given', cancelled: 'Cancelled' };
    return `<div class="card pad stack wallet">
      <div class="spread"><h3>Coaching rewards</h3><span class="small muted">Not RATA points</span></div>
      <div><div class="spread small"><b>${c.progress} / ${c.threshold} paid sessions</b><span class="muted">${c.to_next} to the next reward</span></div>
        <div class="progress"><span style="width:${Math.round((c.progress / c.threshold) * 100)}%"></span></div></div>
      <div class="bcs-by"><div><b>${c.paid}</b><span>Paid sessions</span></div><div><b>${c.earned}</b><span>Earned</span></div><div><b>${c.available}</b><span>Available</span></div></div>
      ${isMe && c.available ? '<button class="btn dark" data-act="claim">Claim a reward</button>' : ''}
      ${c.redemptions.length ? `<ul class="ledger">${c.redemptions.map((r) => `<li><b>🎁</b><div><div>${esc(r.label)}</div><div class="small muted">${esc(st[r.status] || r.status)} · ${esc(fmtDate(r.created_at.slice(0, 10)))}${r.note ? ' · ' + esc(r.note) : ''}</div></div></li>`).join('')}</ul>` : ''}
    </div>`;
  }

  function claimModal(c, onSaved) {
    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card">
      <form class="pad stack" id="claimform" style="padding:24px">
        <h2>Claim a reward</h2>
        <p class="small muted" style="margin:0">You have ${c.available} reward${c.available === 1 ? '' : 's'} available. An admin confirms when it is ready.</p>
        ${Object.entries(c.kinds).map(([k, v], i) => `<label class="toggle"><input type="radio" name="kind" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${esc(v)}</b></span></label>`).join('')}
        <div id="claimerr"></div>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn dark">Claim</button></div>
      </form></div></div>`;
    modalRoot.onclick = (e) => { if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) close(); };
    document.getElementById('claimform').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('rewards', { kind: e.target.querySelector('[name=kind]:checked').value });
        close(); toast('Reward claimed. We will let you know when it is ready.'); onSaved();
      } catch (err) { document.getElementById('claimerr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
    };
  }

  // RATA points: the total, where it came from, and every ledger entry.
  function bcsCard(b) {
    const src = { ...ACTIVITY, adjustment: 'Adjustment' };
    const entry = (e) => `<li class="${e.reversed ? 'reversed' : ''}">
      <b class="${e.points < 0 ? 'neg' : ''}">${e.points > 0 ? '+' : ''}${e.points}</b>
      <div><div>${esc(e.note || src[e.category])}</div><div class="small muted">${esc(src[e.category] || e.category)}${e.format ? ' · ' + esc(e.format) : ''}${e.session_id ? ` · <a class="link" href="#/sessions/${e.session_id}">${esc(e.session_title || 'Session')}</a>` : ''} · ${esc(fmtDate(e.date))}${e.reversed ? ' · reversed' : ''}</div></div></li>`;
    // Corrections (an entry and the reversal that cancelled it) are kept for the record but folded away.
    const active = b.entries.filter((e) => !e.reversed && !e.is_reversal);
    const fixes = b.entries.filter((e) => e.reversed || e.is_reversal);
    const history = `<details ${active.length <= 5 ? 'open' : ''}><summary class="small">Points history (${active.length})</summary><ul class="ledger">${active.map(entry).join('') || '<li class="small muted">No points that still count.</li>'}</ul>
      ${fixes.length ? `<details class="small"><summary class="small muted">${fixes.length} corrected ${fixes.length === 1 ? 'entry' : 'entries'}</summary><ul class="ledger">${fixes.map(entry).join('')}</ul></details>` : ''}</details>`;
    return `<div class="card pad stack bcs-card">
      <h3>RATA points</h3>
      <div class="bcs-total"><b>${b.total}</b><span>RATA ranking points</span></div>
      <div class="bcs-by">${['mabar', 'mini', 'external'].map((k) => `<div><b>${b.by[k] || 0}</b><span>${src[k]}</span></div>`).join('')}</div>
      ${b.entries.length ? history
        : '<p class="small muted" style="margin:0">No RATA points yet. Play a Play Session to get your first one.</p>'}
    </div>`;
  }

  async function viewMember(id, isMe) {
    setNav(isMe ? '' : 'members');
    const d = await api('members/' + id);
    const m = d.member;
    const o = d.overall;
    const canEditPhoto = isMe || isAdmin();
    const completed = d.history.filter((h) => h.session.status === 'completed');
    const upcoming = d.history.filter((h) => h.session.status !== 'completed');
    let showAll = false;
    const histRow = (h) => `<a href="#/sessions/${h.session.id}">
      <div><b>${esc(fmtDate(h.session.date))}</b><div class="small muted">${esc(h.session.title)}${h.played ? ` · ${h.wins}/${h.played} won` : ''}</div></div>
      <div class="hist-right">
        ${['coaching', 'external', 'hitting'].includes(h.session.activity) ? activityTag(h.session) : h.session.status === 'completed'
          ? `${h.rank && h.played ? `<span class="small muted">Session rank <b class="rank-num">#${h.rank}</b></span>` : ''}<span class="plus">+${h.points} RATA pts</span>`
          : h.session.status === 'live' ? `<span class="tag live">${h.points} pts</span>` : '<span class="tag yellow">Registered</span>'}
      </div><span class="chev">›</span></a>`;
    const drawHistory = () => {
      const list = showAll ? completed : completed.slice(0, 3);
      document.getElementById('history').innerHTML = completed.length
        ? `<div class="card history">${list.map(histRow).join('')}</div>
           ${completed.length > 3 ? `<button class="btn lg" data-act="toggle-history" style="width:100%;margin-top:12px">${showAll ? 'Show recent only' : 'View full history'} <span class="arrow"></span></button>` : ''}`
        : `<div class="card empty">No completed sessions yet.${isMe ? ' <a class="link" href="#/sessions">Find a session →</a>' : ''}</div>`;
    };
    app.innerHTML = `<div class="wrap">
      <div class="small" style="margin-bottom:14px"><a class="link" href="#/members">‹ Members</a> / ${esc(m.name)}</div>
      <div class="profile">
        <div class="stack">
          <div class="eyebrow muted">Player profile</div>
          <div class="profile-photo">
            ${photoBox(m, 'big')}
            ${canEditPhoto ? `<div class="photo-edit">${m.photo ? `<button class="btn sm" data-act="recrop">${ICON.crop} Crop</button>` : ''}<label class="btn sm">${m.photo ? 'Change photo' : '+ Add photo'}<input type="file" accept="image/*" id="photo-input" hidden></label></div>` : ''}
          </div>
          <div class="row" style="gap:12px;flex-wrap:wrap"><h1 class="profile-name">${esc(m.name)}</h1><span class="tag">${m.role === 'admin' ? 'RATA Admin' : m.role === 'coach' ? 'RATA Coach' : m.role === 'scorekeeper' ? 'RATA Scorekeeper' : 'RATA Member'}</span></div>
          <div class="stat-strip">
            <div><b>${o.rank ? '#' + o.rank : '–'}</b><span>Overall rank</span></div>
            <div><b>${o.points}</b><span>${d.board === 'new' ? 'RATA points' : 'Total points'}</span></div>
            <div><b>${o.sessions}</b><span>Session${o.sessions === 1 ? '' : 's'}</span></div>
          </div>
          ${d.bcs && (d.board === 'new' || d.bcs.entries.length) ? bcsCard(d.bcs) : ''}
          ${d.coaching && (d.coaching.paid || d.coaching.redemptions.length) ? walletCard(d.coaching, isMe) : ''}
          ${playerInfo(m)}
          ${isMe ? `<div class="card pad stack" id="push-card"></div>` : ''}
          ${isMe ? `<div class="card pad stack"><h3>My account</h3><div class="small muted">${esc(m.email || '')}${m.phone ? ' · ' + esc(m.phone) : ''}</div>
            <button class="btn chat-create" data-act="new-channel">${ICON.chat} Create Chat Channel</button>
            <div class="row wrap-ok"><button class="btn sm ghost" data-act="edit-me">Edit profile</button><a class="btn sm ghost" href="#/chat">Chats</a>${isAdmin() ? '<a class="btn sm ghost" href="#/finance">Finance recap</a><a class="btn sm ghost" href="#/approvals">Tournament approvals</a><a class="btn sm ghost" href="#/activity">Member activity</a><a class="btn sm ghost" href="#/audit">Audit log</a>' : ''}${m.photo ? '<button class="btn sm ghost" data-act="remove-photo">Remove photo</button>' : ''}<button class="btn sm danger" data-act="logout">Log out</button></div></div>` : ''}
          ${isAdmin() && !isMe ? `<div class="row wrap-ok"><button class="btn ghost" data-act="edit-member">Edit member</button>${m.photo ? '<button class="btn ghost" data-act="remove-photo">Remove photo</button>' : ''}</div>` : ''}
        </div>
        <div class="stack">
          ${upcoming.length ? `<div><div class="spread" style="margin-bottom:10px"><h2>Upcoming</h2></div><div class="card history">${upcoming.map(histRow).join('')}</div></div>` : ''}
          <div><div class="spread" style="margin-bottom:10px"><h2>Session history</h2>
            <span class="small muted">${completed.length > 3 ? `Recent 3 of ${completed.length} sessions` : `${completed.length} session${completed.length === 1 ? '' : 's'}`}</span></div>
            <div id="history"></div></div>
          <div class="callout">${ICON.chart}<div><b>How RATA points work</b><div class="small">Play Session: +1 for attending and +1 for every regular match you win. Internal and External Tournaments: points for your final placement, and every player who takes part gets at least the participation points.</div></div></div>
          ${resultsSection(d.external || [], isMe, m.id)}
          ${timeline(d.timeline || [], isMe, m.id)}
        </div>
      </div></div>`;
    drawHistory();
    drawPushBox(document.getElementById('push-card'), false);
    const input = document.getElementById('photo-input');
    if (input) {
      input.onchange = async () => {
        const picked = input.files[0];
        input.value = '';
        if (!picked) return;
        const file = await cropPhoto(picked);
        if (!file) return;
        const label = input.closest('label');
        label.firstChild.textContent = 'Uploading…';
        try {
          const data = await uploadPhoto(id, file, picked);
          if (isMe) { state.user.photo = data.member.photo; renderTop(); }
          toast('Photo saved.');
          render();
        } catch (err) {
          toast(err.message, true);
          label.firstChild.textContent = m.photo ? 'Change photo' : '+ Add photo';
        }
      };
    }
    app.onsubmit = async (e) => {
      const f = e.target.closest('.tl-c-form');
      if (!f) return;
      e.preventDefault();
      const box = f.closest('.tl-comments');
      const btn = f.querySelector('button');
      btn.disabled = true;
      try {
        const r = await api(`members/${box.dataset.owner}/comments`, { session_id: Number(box.dataset.session), body: f.body.value });
        const item = d.timeline.find((x) => x.session.id === Number(box.dataset.session));
        item.comments = r.comments;
        box.outerHTML = tlComments(item, Number(box.dataset.owner));
      } catch (err) { btn.disabled = false; toast(err.message, true); }
    };
    app.onclick = async (e) => {
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'toggle-history') { showAll = !showAll; drawHistory(); }
      if (a.dataset.act === 'review') {
        const item = d.timeline.find((x) => x.session.id === Number(a.dataset.session));
        return reviewModal(item.session, () => render());
      }
      if (a.dataset.act === 'photo') {
        const item = d.timeline.find((x) => x.session.id === Number(a.closest('[data-tl]').dataset.tl));
        const list = [...item.posts.flatMap((p) => p.photos.map((ph) => ({ ...ph, by: p.user.name }))), ...item.photos.map((ph) => ({ ...ph, by: 'RATA' }))];
        return photoViewer({ photos: list, session: item.session }, Number(a.dataset.photo), () => {});
      }
      if (a.dataset.act === 'del-comment') {
        const box = a.closest('.tl-comments');
        try {
          const r = await api(`members/${box.dataset.owner}/comments/delete`, { comment_id: Number(a.dataset.id) });
          const item = d.timeline.find((x) => x.session.id === Number(box.dataset.session));
          item.comments = r.comments;
          box.outerHTML = tlComments(item, Number(box.dataset.owner));
        } catch (err) { toast(err.message, true); }
        return;
      }
      if (a.dataset.act === 'del-post') {
        if (!confirm('Delete this review and its photos?')) return;
        try { await api(`sessions/${a.dataset.session}/posts/delete`, { post_id: Number(a.dataset.post) }); toast('Review deleted.'); render(); } catch (err) { toast(err.message, true); }
      }
      if (a.dataset.act === 'recrop') {
        try {
          const data = await recropPhoto(m);
          if (!data) return;
          if (isMe) { state.user.photo = data.member.photo; renderTop(); }
          toast('Photo saved.'); render();
        } catch (err) { toast(err.message, true); }
      }
      if (a.dataset.act === 'remove-photo') {
        if (!confirm('Remove this photo?')) return;
        try {
          await api(`members/${id}/photo`, { remove: true });
          if (isMe) { state.user.photo = null; renderTop(); }
          toast('Photo removed.'); render();
        } catch (err) { toast(err.message, true); }
      }
      if (a.dataset.act === 'logout') {
        await api('auth/logout', {});
        state.user = null; memberCache = null; renderTop(); toast('Logged out.'); location.hash = '#/';
      }
      if (a.dataset.act === 'edit-me') editMeModal(m);
      if (a.dataset.act === 'new-channel') return channelModal();
      if (a.dataset.act === 'edit-member') memberModal(m);
      if (a.dataset.act === 'ext-new') externalModal(null, () => render());
      if (a.dataset.act === 'ext-add-for') externalModal(null, () => render(), { admin: true, member_id: Number(a.dataset.id) });
      if (a.dataset.act === 'claim') claimModal(d.coaching, () => render());
      if (a.dataset.act === 'ext-edit') externalModal(d.external.find((x) => x.id === Number(a.dataset.id)), () => render());
      if (a.dataset.act === 'ext-del') {
        if (!confirm('Withdraw this result?')) return;
        try { await api(`external/${a.dataset.id}/delete`, {}); toast('Withdrawn.'); render(); } catch (err) { toast(err.message, true); }
      }
    };
  }

  // Reclub-style timeline: each finished session the member played, their reviews, and the session's photos.
  // Comments on a timeline entry: one thread per session, shown on the timeline of everyone who played it.
  // Anyone logged in can write; the writer, the member whose profile it was written on, or an admin can delete.
  function tlComments(t, ownerId) {
    return `<div class="tl-comments" data-owner="${ownerId}" data-session="${t.session.id}">
      ${(t.comments || []).map((c) => `<div class="tl-comment">${avatar(c.user, 'dark')}<div><a class="tl-c-who" href="#/members/${c.user.id}">${esc(c.user.name)}</a> <span class="small muted">${esc(fmtDate(c.created_at.slice(0, 10)))}</span><div class="tl-c-body">${esc(c.body)}</div></div>
        ${c.can_delete ? `<button class="link-btn small" data-act="del-comment" data-id="${c.id}">Delete</button>` : ''}</div>`).join('')}
      ${state.user ? '<form class="tl-c-form"><input class="input" name="body" maxlength="1000" placeholder="Write a comment…" required autocomplete="off"><button class="btn sm dark">Send</button></form>' : ''}
    </div>`;
  }

  function timeline(items, isMe, ownerId) {
    if (!items.length) return '';
    return `<div><div class="spread" style="margin-bottom:10px"><h2>Timeline</h2></div><div class="card pad timeline">${items.map((t) => {
      const s = t.session;
      const extra = t.photos.length > 6 ? t.photos.length - 6 : 0;
      return `<div class="tl-item" data-tl="${s.id}">
        <a class="tl-head" href="#/sessions/${s.id}">
          <span class="tl-thumb ${s.banner ? '' : 'none'}" ${s.banner ? `style="background-image:url('${esc(s.banner)}')"` : ''}>${s.banner ? '' : LOGO}</span>
          <div><div class="tl-title">Joined <b>${esc(s.title)}</b></div>
            <div class="small muted">${esc(fmtDay(s.date))} ${parseDate(s.date).getFullYear()}${s.location ? ' · ' + esc(s.location) : ''}</div>
            ${t.with_count ? `<div class="small muted">Played with <b>${esc(t.with[0].name)}</b>${t.with_count > 1 ? ` and ${t.with_count - 1} other${t.with_count > 2 ? 's' : ''}` : ''}</div>` : ''}</div>
        </a>
        ${t.posts.map((p) => postCard(p, { noAuthor: true })).join('')}
        ${t.photos.length ? `<div class="post-photos">${t.photos.slice(0, 6).map(photoThumb).join('')}${extra ? `<a class="photo-more" href="#/sessions/${s.id}">+${extra}</a>` : ''}</div>` : ''}
        ${isMe && !t.posts.length ? `<button class="btn sm" data-act="review" data-session="${s.id}">How was it? Write a review</button>` : ''}
        ${tlComments(t, ownerId)}
      </div>`;
    }).join('')}</div></div>`;
  }

  function playerInfo(m) {
    const wa = m.phone ? m.phone.replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^0/, '62') : '';
    const rows = [
      m.level && ['Tennis level', `<span class="level-chip ${esc(m.level)}">${esc(LEVELS[m.level] || m.level)}</span>`],
      m.gender && ['Gender', esc(GENDERS[m.gender] || m.gender)],
      m.coach && ['Coaching club / coach', esc(m.coach)],
      m.instagram && ['Instagram', `<a class="link" href="https://instagram.com/${encodeURIComponent(m.instagram)}" target="_blank" rel="noopener">@${esc(m.instagram)}</a>`],
      m.phone && ['WhatsApp', `<a class="link" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">${esc(m.phone)}</a>`],
    ].filter(Boolean);
    if (!rows.length && !m.experience) return '';
    return `<div class="card pad player-info">
      ${rows.length ? `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
      ${m.experience ? `<div class="exp"><dt>Tournament experience & achievements</dt><dd>${esc(m.experience)}</dd></div>` : ''}
    </div>`;
  }

  function editMeModal(m) {
    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card">
      <form class="pad stack" id="meform" style="padding:24px">
        <h2>Edit profile</h2>
        <label class="field">Name<input class="input" name="name" required maxlength="100" value="${esc(m.name)}"></label>
        ${profileFields(m)}
        <label class="field">New password<input class="input" type="password" name="password" minlength="8" autocomplete="new-password" placeholder="Leave empty to keep"></label>
        <div id="meerr"></div>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn dark">Save</button></div>
      </form></div></div>`;
    modalRoot.onclick = (e) => { if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) close(); };
    document.getElementById('meform').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const d = await api('me', formData(e.target));
        state.user = d.user; renderTop(); close(); toast('Profile saved.'); render();
      } catch (err) { document.getElementById('meerr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
    };
  }

  function viewAuth(mode) {
    setNav('');
    if (state.user) { location.hash = '#/me'; return; }
    const reg = mode === 'register';
    app.innerHTML = `<div class="wrap"><div class="auth-wrap">
      <div class="logo-big">${LOGO_TEAM}</div>
      <form class="card pad stack" id="aform" style="padding:26px">
        <div><h2>${reg ? 'Join the club' : 'Welcome back'}</h2><p class="muted" style="margin:6px 0 0">${reg ? 'Create your member account to register for sessions and track your points.' : 'Log in to see your points and sessions.'}</p></div>
        ${reg ? `<div class="signup-photo"><label class="signup-photo-pick" id="su-photo" title="Add a profile photo"><span class="avatar lg">${ICON.camera}</span><input type="file" accept="image/*" id="su-photo-input" hidden></label>
          <div class="small"><b>Profile photo</b><div class="muted">Optional. Pick one and crop it to fit.</div><button type="button" class="link-btn" id="su-recrop" style="padding:0" hidden>Adjust crop</button></div></div>
          <label class="field">Full name<input class="input" name="name" required maxlength="100" autocomplete="name"></label>` : ''}
        <label class="field">Email<input class="input" type="email" name="email" required autocomplete="email"></label>
        <label class="field">Password<input class="input" type="password" name="password" required ${reg ? 'minlength="8" autocomplete="new-password" placeholder="At least 8 characters"' : 'autocomplete="current-password"'}></label>
        ${reg ? `${instagramField()}<div class="form-sub"><b>About you</b> <span class="hint">Optional. You can fill this in later.</span></div>${profileFields({}, { noInstagram: true })}` : ''}
        <div id="aerr"></div>
        <button class="btn dark lg" type="submit" style="width:100%">${reg ? 'Create account' : 'Log in'}</button>
        <p class="small muted" style="text-align:center;margin:0">${reg ? 'Already a member? <a class="link" href="#/login">Log in</a>' : 'New here? <a class="link" href="#/register">Create an account</a><br>Forgot your password? Ask an admin to reset it.'}</p>
      </form></div></div>`;
    let photo = null; // { original, cropped } picked at sign-up
    const showPhoto = () => {
      const url = URL.createObjectURL(photo.cropped);
      document.querySelector('#su-photo .avatar').outerHTML = `<span class="avatar lg photo" style="background-image:url('${url}')"></span>`;
      document.getElementById('su-recrop').hidden = false;
    };
    if (reg) {
      const input = document.getElementById('su-photo-input');
      input.onchange = async () => {
        const picked = input.files[0];
        input.value = '';
        if (!picked) return;
        const cropped = await cropPhoto(picked);
        if (cropped) { photo = { original: picked, cropped }; showPhoto(); }
      };
      document.getElementById('su-recrop').onclick = async () => {
        const cropped = await cropPhoto(photo.original);
        if (cropped) { photo.cropped = cropped; showPhoto(); }
      };
    }
    document.getElementById('aform').onsubmit = async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const d = await api(reg ? 'auth/register' : 'auth/login', formData(e.target));
        if (reg && photo) {
          try { d.user.photo = (await uploadPhoto(d.user.id, photo.cropped, photo.original)).member.photo; } catch (err) { toast("Account created, but the photo didn't upload: " + err.message, true); }
        }
        state.user = d.user;
        memberCache = null;
        renderTop();
        refreshUnread();
        toast(reg ? `Welcome, ${d.user.name.split(' ')[0]}!` + (d.user.role === 'admin' ? ' You are the admin.' : '') : 'Logged in.');
        const back = sessionStorage.getItem('bcs_back');
        sessionStorage.removeItem('bcs_back');
        location.hash = back || '#/me';
      } catch (err) {
        btn.disabled = false;
        document.getElementById('aerr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
      }
    };
  }

  // ---------- finance recap (admin) ----------

  // Players who paid and then cancelled (or were removed): money the admin owes back.
  function refundsCard(list) {
    if (!list.length) return '';
    const todo = list.filter((r) => r.status === 'pending');
    const row = (r) => `<tr><td>${esc(r.created_at.slice(0, 16))}</td><td><a class="link" href="#/members/${r.user_id}">${esc(r.name)}</a></td>
      <td>${r.date ? esc(fmtDate(r.date)) + ' · ' : ''}${esc(r.title)}<div class="small muted">${r.reason === 'removed' ? 'Removed by an admin' : 'Cancelled'} · paid by ${r.method === 'cash' ? 'cash' : 'transfer'}</div></td>
      <td class="num"><b>${esc(rupiah(r.amount))}</b></td>
      <td>${r.status === 'pending' ? `<button class="btn xs dark" data-act="refund" data-id="${r.id}" data-done="1">Mark refunded</button>`
        : `<span class="small muted">Refunded ${esc((r.done_at || '').slice(0, 10))}</span> <button class="link-btn small" data-act="refund" data-id="${r.id}" data-done="0">Undo</button>`}</td></tr>`;
    return `<div class="section-head"><h2>Refunds</h2><span class="small muted">${todo.length ? `<b>${todo.length} to pay back · ${esc(rupiah(todo.reduce((t, r) => t + r.amount, 0)))}</b>` : 'All paid back'}</span></div>
      <div class="card table-scroll" style="margin-bottom:20px"><table class="fin-table"><thead><tr><th>When</th><th>Member</th><th>Session</th><th class="num">Amount</th><th></th></tr></thead><tbody>
        ${list.map(row).join('')}</tbody></table></div>`;
  }

  async function viewFinance() {
    setNav('');
    if (!state.user) return needLogin();
    if (!isAdmin()) return showError(new Error('Only admins can see the finance recap.'));
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const f = { from: params.get('from') || '', to: params.get('to') || '', session: params.get('session') || '' };
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
    const d = await api('finance' + (qs ? '&' + qs : ''));
    const t = d.total;
    const statusLabel = { submitted: 'To check', approved: 'Confirmed' };
    app.innerHTML = `<div class="wrap">
      <div class="page-head"><div><h1>Finance recap</h1><p class="muted">Registration fees paid by transfer or cash. Filter by session date or pick one session.</p></div>
        <div class="row wrap-ok"><button class="btn ghost" data-act="csv" ${d.payments.length ? '' : 'disabled'}>Download CSV</button>
          <a class="btn ghost" href="api/index.php?r=backup" download title="A full copy of the app's data (members, sessions, matches, payments) as a JSON file">Download data backup</a></div></div>
      <form class="card pad fin-filters" id="finform">
        <label class="field">From<input class="input" type="date" name="from" value="${esc(f.from)}"></label>
        <label class="field">To<input class="input" type="date" name="to" value="${esc(f.to)}"></label>
        <label class="field">Session<select class="input" name="session"><option value="">All paid sessions</option>${d.all_sessions.map((x) =>
          `<option value="${x.id}" ${String(x.id) === f.session ? 'selected' : ''}>${esc(fmtDate(x.date))} · ${esc(x.title)}</option>`).join('')}</select></label>
        <div class="row" style="align-self:end"><button class="btn dark">Apply</button>${qs ? '<a class="btn ghost" href="#/finance">Reset</a>' : ''}</div>
        <div class="row wrap-ok quick full">${[['This month', 0], ['Last month', -1]].map(([l, k]) => `<button type="button" class="btn xs ghost" data-month="${k}">${l}</button>`).join('')}</div>
      </form>
      <div class="stat-tiles">
        <div class="card pad"><span>Confirmed</span><b>${esc(rupiah(t.confirmed))}</b></div>
        <div class="card pad"><span>Proofs to check</span><b>${esc(rupiah(t.pending))}</b></div>
        <div class="card pad"><span>Total received</span><b>${esc(rupiah(t.confirmed + t.pending))}</b></div>
        <div class="card pad"><span>Payments</span><b>${t.payments}</b></div>
        <div class="card pad"><span>Free entries</span><b>${t.free || 0}</b></div>
      </div>
      ${refundsCard(d.refunds || [])}
      <div class="section-head"><h2>By session</h2></div>
      ${d.sessions.length ? `<div class="card table-scroll"><table class="fin-table"><thead><tr><th>Date</th><th>Session</th><th class="num">Fee</th><th class="num">Paid</th><th class="num">Confirmed</th><th class="num">To check</th><th class="num">Free</th><th class="num">Total</th></tr></thead><tbody>
        ${d.sessions.map((x) => `<tr><td>${esc(fmtDate(x.date))}</td><td><a class="link" href="#/sessions/${x.id}">${esc(x.title)}</a></td><td class="num">${esc(rupiah(x.fee))}</td><td class="num">${x.paid}</td>
          <td class="num">${esc(rupiah(x.confirmed))}</td><td class="num">${x.pending ? esc(rupiah(x.pending)) : '–'}</td><td class="num">${x.free || '–'}</td><td class="num"><b>${esc(rupiah(x.confirmed + x.pending))}</b></td></tr>`).join('')}
      </tbody></table></div>` : '<div class="card empty">No payments for this filter yet.</div>'}
      ${d.payments.length ? `<div class="section-head"><h2>Payments</h2><span class="small muted">${d.payments.length}</span></div>
      <div class="card table-scroll"><table class="fin-table"><thead><tr><th>Paid at</th><th>Member</th><th>Session</th><th>Status</th><th>Method</th><th class="num">Amount</th><th></th></tr></thead><tbody>
        ${d.payments.map((p) => `<tr><td>${esc((p.paid_at || '').slice(0, 16))}</td><td><a class="link" href="#/members/${p.user_id}">${esc(p.name)}</a></td>
          <td>${esc(fmtDate(p.date))} · ${esc(p.title)}</td><td><span class="pay-chip ${p.method === 'free' ? 'free' : p.pay_status}">${p.method === 'free' ? 'Free entry' : statusLabel[p.pay_status] || p.pay_status}</span></td>
          <td>${p.method === 'free' ? 'Free entry' : p.method === 'cash' ? 'Cash' : 'Transfer'}</td><td class="num">${esc(rupiah(p.amount))}</td>
          <td>${p.has_proof ? `<button class="btn xs ghost" data-act="proof" data-reg="${p.id}" data-name="${esc(p.name)}">Proof</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
    </div>`;
    const form = document.getElementById('finform');
    const go = (vals) => {
      const q = new URLSearchParams(Object.entries(vals).filter(([, v]) => v)).toString();
      location.hash = '#/finance' + (q ? '?' + q : '');
    };
    form.onsubmit = (e) => { e.preventDefault(); go(formData(form)); };
    app.onclick = async (e) => {
      const m = e.target.closest('[data-month]');
      if (m) {
        const now = new Date();
        const a = new Date(now.getFullYear(), now.getMonth() + Number(m.dataset.month), 1);
        const b = new Date(a.getFullYear(), a.getMonth() + 1, 0);
        const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
        return go({ from: iso(a), to: iso(b), session: '' });
      }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      if (a.dataset.act === 'proof') return proofModal(Number(a.dataset.reg), a.dataset.name);
      if (a.dataset.act === 'refund') {
        try { await api(`refunds/${a.dataset.id}`, { done: a.dataset.done === '1' }); toast(a.dataset.done === '1' ? 'Marked as refunded.' : 'Back to the refund list.'); render(); } catch (err) { toast(err.message, true); }
        return;
      }
      if (a.dataset.act === 'csv') {
        const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const lines = [['Paid at', 'Member', 'Session date', 'Session', 'Status', 'Method', 'Amount'].map(cell).join(',')]
          .concat(d.payments.map((p) => [p.paid_at, p.name, p.date, p.title, statusLabel[p.pay_status] || p.pay_status, p.method || 'transfer', p.amount].map(cell).join(',')));
        const url = URL.createObjectURL(new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `rata-finance${f.from ? '-' + f.from : ''}${f.to ? '-to-' + f.to : ''}.csv`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    };
  }

  // ---------- full-screen scorer ----------

  let scorerCleanup = null;
  function leaveScorer() {
    if (scorerCleanup) { scorerCleanup(); scorerCleanup = null; }
  }

  // Server times are WITA (UTC+8) without a zone.
  const witaMs = (t) => (t ? Date.parse(t.replace(' ', 'T') + '+08:00') : NaN);
  // Seconds of play so far, leaving out time spent paused.
  const matchElapsed = (m) => Math.floor(((m.paused_at ? witaMs(m.paused_at) : Date.now()) - witaMs(m.started_at)) / 1000) - (m.paused_secs || 0);

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35, 0.7].forEach((at) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.value = 0.25;
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + at); o.stop(ctx.currentTime + at + 0.2);
      });
    } catch (e) { /* no audio */ }
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
  }

  async function viewScorer(matchId) {
    let d = await api('matches/' + matchId);
    // Someone else scoring this match on another device: this one only watches until it takes over.
    const lockedOut = () => d.can_score && d.lock && !d.lock.mine;
    const canNow = () => d.can_score && !lockedOut();
    document.body.classList.add('scoring');
    let queue = Promise.resolve();
    let pending = 0;
    let alarmed = false;
    let picking = false; // "Change server": the next tap on a name says who is serving now
    let wakeLock = null;
    const tryWake = async () => { try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* unsupported */ } };
    tryWake();
    const onVis = () => { if (!document.hidden) tryWake(); };
    document.addEventListener('visibilitychange', onVis);
    const timer = setInterval(() => drawTimer(), 1000);
    scorerCleanup = () => {
      document.body.classList.remove('scoring');
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
      try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };

    const remaining = () => {
      const m = d.match;
      if (!m.started_at) return null;
      return d.session.match_minutes * 60 - matchElapsed(m);
    };

    function drawTimer() {
      const el = document.getElementById('sc-timer');
      if (!el) return;
      const m = d.match;
      const r = remaining();
      if (r === null || m.status === 'scheduled') { el.textContent = `${d.session.match_minutes}:00`; el.className = 'sc-timer idle'; return; }
      if (m.status === 'done') { el.textContent = 'Final'; el.className = 'sc-timer idle'; return; }
      const a = Math.abs(r);
      el.textContent = (r < 0 ? '+' : '') + `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
      el.className = 'sc-timer' + (m.paused_at ? ' paused' : r <= 0 ? ' over' : r <= 60 ? ' soon' : '');
      if (r <= 0 && !alarmed && !m.paused_at) {
        alarmed = true;
        beep();
        toast(d.session.point_system === 'tennis' ? "Time! Finish the point. If the games are level, tap Tiebreak." : 'Time!');
      }
    }

    const sidePanel = (m, st, side) => {
      const team = side === 'a' ? m.team_a : m.team_b;
      const tennis = st.mode === 'tennis';
      const games = side === 'a' ? m.score_a : m.score_b;
      const done = m.status === 'done';
      const big = tennis && !done ? st.display[side === 'a' ? 0 : 1] : String(games);
      const serving = (p) => !done && st.server === p.id;
      const choosing = canNow() && !done && (!st.scored || picking);
      const right = st.right && st.right[side];
      const pos = (p) => (right ? `<em class="sc-pos">${p.id === right ? 'Right' : 'Left'}</em>` : '');
      const recv = (p) => (!done && st.receiver === p.id ? '<em class="sc-recv">Receiving</em>' : '');
      return `<button class="sc-side sc-${side} ${choosing && picking ? 'picking' : ''}" data-point="${side}" ${!canNow() || m.status === 'done' ? 'disabled' : ''}>
        <div class="sc-names">${team.map((p) => `<span class="sc-name ${serving(p) ? 'serving' : ''}" ${choosing ? `data-serve="${p.id}"` : ''}>${serving(p) ? '<i class="ball"></i>' : ''}${esc(p.name)}${pos(p)}${serving(p) && st.fault ? '<em class="sc-fault">Fault</em>' : ''}${recv(p)}</span>`).join('')}
          ${right && canNow() && !done ? `<span class="sc-posswap" data-right="${side}" role="button" title="Swap who plays on the right and left" aria-label="Swap right and left">⇅</span>` : ''}</div>
        <div class="sc-big">${esc(big)}</div>
        ${tennis && !done ? `<div class="sc-games"><span>Games</span><b>${games}</b></div>` : ''}
        ${canNow() && m.status !== 'done' ? '<div class="sc-tap">Tap to add a point</div>' : ''}
      </button>`;
    };

    function draw() {
      const m = d.match;
      const st = m.state;
      const s = d.session;
      const tennis = st.mode === 'tennis';
      const winner = m.status === 'done' ? (m.score_a > m.score_b ? m.team_a : m.score_b > m.score_a ? m.team_b : null) : null;
      app.innerHTML = `<div class="scorer ${m.status}">
        <header class="sc-top">
          <a class="sc-back" href="#/sessions/${s.id}" aria-label="Back to session">‹</a>
          <div class="sc-title"><b>Court ${m.court} · Round ${m.round}${d.rounds ? ' of ' + d.rounds : ''}</b><span>${esc(s.title)} · ${esc(m.start_time)} · ${esc(scoreTargetText(s))}</span></div>
          <div id="sc-timer" class="sc-timer"></div>
          ${canNow() && m.status === 'live' && m.started_at ? `<button class="sc-icon sc-pause ${m.paused_at ? 'on' : ''}" data-op="${m.paused_at ? 'resume' : 'pause'}" aria-label="${m.paused_at ? 'Resume timer' : 'Pause timer'}">${m.paused_at ? '▶' : '❚❚'}</button>` : ''}
          <button class="sc-icon" data-fs aria-label="Full screen">⛶</button>
        </header>
        ${m.placement ? `<div class="sc-banner sc-placement">${PLACEMENT_LABEL}</div>` : ''}
        ${lockedOut() ? `<div class="sc-banner ends"><span>${esc(d.lock.name)} is scoring this match on another device</span><button class="sc-btn yellow" data-op="takeover">Take over</button></div>` : ''}
        ${m.paused_at && m.status === 'live' ? '<div class="sc-banner paused">Timer paused · tap ▶ to carry on</div>' : ''}
        ${m.status !== 'done' && st.change_ends ? `<div class="sc-banner ends"><span>Switch court · players change ends</span>${canNow() ? '<button class="sc-btn yellow" data-op="ends">Done, switched ⇄</button>' : ''}</div>` : ''}
        ${m.status !== 'done' && st.flash ? `<div class="sc-banner fault">${st.flash === 'fault' ? `Fault · second serve for ${esc(teamName(st.server_side === 'a' ? m.team_a : m.team_b))}` : `Double fault · point to ${esc(teamName(st.server_side === 'a' ? m.team_b : m.team_a))}`}</div>` : ''}
        ${tennis && (st.tiebreak || st.note) ? `<div class="sc-banner ${st.tiebreak ? 'tb' : ''}">${esc(st.note || '')}${tennis ? ` · Games ${m.score_a}-${m.score_b}` : ''}</div>` : ''}
        ${m.status !== 'done' && canNow() && !st.scored ? '<div class="sc-banner">Tap a player name to choose who serves first, then tap a side to score.</div>' : ''}
        ${m.status !== 'done' && canNow() && st.scored && picking ? '<div class="sc-banner ends"><span>Tap the player who is serving now</span><button class="sc-btn ghost" data-pick="cancel">Cancel</button></div>' : ''}
        <main class="sc-court">${st.swapped ? sidePanel(m, st, 'b') + sidePanel(m, st, 'a') : sidePanel(m, st, 'a') + sidePanel(m, st, 'b')}</main>
        ${m.status === 'done' ? `<div class="sc-final"><span>Final ${m.score_a} : ${m.score_b}</span><b>${winner ? teamName(winner) + ' win' : 'Draw'}</b></div>` : ''}
        <footer class="sc-bottom">
          ${canNow() ? `
            <button class="sc-btn" data-op="undo" ${st.can_undo ? '' : 'disabled'}>↶ ${st.fault ? 'Undo fault' : 'Undo'}</button>
            ${m.status !== 'done' && st.server_side ? `<button class="sc-btn ${st.fault ? 'red' : 'fault'}" data-op="fault">${st.fault ? 'Double fault' : 'Fault'}</button>` : ''}
            <button class="sc-btn ghost" data-op="swap" title="Switch the sides the players are shown on">⇄ Switch sides</button>
            ${m.status !== 'done' && st.scored ? `<button class="sc-btn ghost ${picking ? 'on' : ''}" data-pick="server" title="Set who is serving if it is wrong">🎾 Change server</button>` : ''}
            ${tennis && st.can_tiebreak && m.status !== 'done' ? '<button class="sc-btn yellow" data-op="tiebreak">Tiebreak</button>' : ''}
            ${m.status === 'scheduled' ? '<button class="sc-btn" data-op="start">Start timer</button>' : ''}
            ${m.status === 'live' ? '<button class="sc-btn" data-op="finish">Finish match</button>' : ''}
            ${m.status === 'done' ? '<button class="sc-btn" data-op="reopen">Reopen</button>' : ''}
            ${isAdmin() ? `<button class="sc-btn ghost" data-edit>Edit score</button><a class="sc-btn ghost" href="#/audit?entity=match&id=${m.id}">History</a>` : ''}` : '<span class="sc-viewer">Live view · updates automatically</span>'}
          <span class="sc-spacer"></span>
          ${d.next ? `<a class="sc-btn ${m.status === 'done' ? 'yellow big' : 'ghost'}" href="#/score/${d.next.id}">Next: ${teamName(d.next.team_a)} vs ${teamName(d.next.team_b)} →</a>`
            : m.status === 'done' ? `<a class="sc-btn yellow big" href="#/sessions/${s.id}">Back to schedule</a>` : ''}
        </footer>
      </div>`;
      drawTimer();
    }

    const act = (body) => {
      pending++;
      queue = queue.then(async () => {
        try {
          d = await api(`matches/${matchId}/action`, body);
        } catch (e) {
          toast(e.message, true);
          try { d = await api('matches/' + matchId); } catch (err) { /* keep the last state */ }
        } finally {
          pending--;
          if (state.route === '/score/' + matchId || state.route === 'score/' + matchId || location.hash === '#/score/' + matchId) draw();
        }
      });
    };

    app.onclick = (e) => {
      const t = e.target;
      if (t.closest('[data-fs]')) {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
        return;
      }
      const pk = t.closest('[data-pick]');
      if (pk) { picking = pk.dataset.pick === 'server' ? !picking : false; return draw(); }
      const sv = t.closest('[data-serve]');
      if (sv) { e.stopPropagation(); picking = false; return act({ op: 'serve', player: Number(sv.dataset.serve) }); }
      const rt = t.closest('[data-right]');
      if (rt) { e.stopPropagation(); return act({ op: 'right', side: rt.dataset.right }); }
      const pt = t.closest('[data-point]');
      if (pt && picking) return toast("Tap the name of the player who's serving.");
      if (pt && !pt.disabled) {
        pt.classList.remove('flash'); void pt.offsetWidth; pt.classList.add('flash');
        if (navigator.vibrate) navigator.vibrate(15);
        return act({ op: pt.dataset.point });
      }
      const op = t.closest('[data-op]');
      if (op && !op.disabled) {
        if (op.dataset.op === 'finish' && !confirm('Finish this match with the current score?')) return;
        if (op.dataset.op === 'takeover' && !confirm('Take over scoring on this device? The other device stops scoring.')) return;
        if (d.match.status === 'done' && ['undo', 'reopen'].includes(op.dataset.op)) {
          const reason = prompt('This match is finished. Why are you changing it? (kept in the audit log)');
          if (!reason) return;
          return act({ op: op.dataset.op, reason });
        }
        return act({ op: op.dataset.op });
      }
      if (t.closest('[data-edit]')) {
        openScoreModal(d.match, d.session, async () => { d = await api('matches/' + matchId); draw(); });
      }
    };

    draw();
    poll(async () => {
      if (pending) return;
      const fresh = await api('matches/' + matchId);
      if (!pending && JSON.stringify(fresh) !== JSON.stringify(d)) { d = fresh; draw(); }
    }, 3000);
  }

  // A match nobody has scored yet (it may have been opened on the scorer).
  const unplayed = (m) => m.status === 'scheduled' || (m.status === 'live' && !m.score_a && !m.score_b && !(m.state && m.state.can_undo));

  // Player picker for admin match editing: the session's players first, then every other member
  // (picking one of those adds them to the session).
  async function playerSelect(d, name, cur, label) {
    if (!memberCache) memberCache = (await api('members')).members;
    const inSession = new Set(d.players.map((p) => p.id));
    const opt = (p, note) => `<option value="${p.id}" ${cur && p.id === cur.id ? 'selected' : ''}>${esc(p.name)}${note ? ` (${esc(note)})` : ''}</option>`;
    return `<select class="input" name="${name}" required>${cur ? '' : '<option value="">Choose a player…</option>'}
      <optgroup label="In this session">${d.players.map((p) => opt(p, label(p))).join('')}</optgroup>
      <optgroup label="Other members (joins the session)">${memberCache.filter((x) => !inSession.has(x.id)).map((p) => opt(p, '')).join('')}</optgroup></select>`;
  }

  // Admin: change who plays in a match nobody has scored yet, swap its slot, or remove it.
  async function lineupModal(d, matchId, onSaved) {
    const m = d.matches.find((x) => x.id === matchId);
    const close = () => { modalRoot.innerHTML = ''; };
    const inRound = new Map(); // player id -> court they play on in this round
    d.matches.filter((x) => x.round === m.round && x.id !== m.id)
      .forEach((x) => [...x.team_a, ...x.team_b].forEach((p) => inRound.set(p.id, x)));
    const here = new Set([...m.team_a, ...m.team_b].map((p) => p.id));
    const label = (p) => here.has(p.id) ? '' : inRound.has(p.id) ? `swap · court ${inRound.get(p.id).court}${unplayed(inRound.get(p.id)) ? '' : ', playing'}` : 'sitting out';
    const side = async (team, k) => (await Promise.all(team.map((p, i) => playerSelect(d, k + (i + 1), p, label)))).join('');
    const others = d.matches.filter((x) => x.id !== m.id && unplayed(x));
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card">
      <form class="pad stack" id="luform" style="padding:24px">
        <div><h2>Round ${m.round} · Court ${m.court}</h2><p class="small muted" style="margin:4px 0 0">${esc(m.start_time)} · no points yet</p></div>
        <div class="lineup"><div class="stack" style="gap:8px">${await side(m.team_a, 'a')}</div><b class="vs-badge">vs</b><div class="stack" style="gap:8px">${await side(m.team_b, 'b')}</div></div>
        <p class="hint" style="margin:0">Pick anyone. Someone sitting out (or a member not in the session yet) is brought in. Someone on another court in this round swaps places with the player they replace.</p>
        <label class="field">Swap this match's time slot with
          <select class="input" name="swap_with"><option value="">Keep it where it is</option>${others.map((x) => `<option value="${x.id}">R${x.round} · ${esc(x.start_time)} · Court ${x.court}: ${esc(teamName(x.team_a))} vs ${esc(teamName(x.team_b))}</option>`).join('')}</select></label>
        <div id="luerr"></div>
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px"><button type="button" class="btn danger" data-del>Remove match</button>
          <span class="row" style="gap:8px"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn dark">Save</button></span></div>
      </form></div></div>`;
    const send = async (body, msg) => {
      try {
        const data = await api(`matches/${m.id}/lineup`, body);
        memberCache = null; close(); toast(msg); onSaved(data);
      } catch (err) { document.getElementById('luerr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
    };
    modalRoot.onclick = (e) => {
      if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) close();
      if (e.target.closest('[data-del]') && confirm('Remove this match from the schedule?')) send({ delete: true }, 'Match removed.');
    };
    document.getElementById('luform').onsubmit = (e) => {
      e.preventDefault();
      const f = formData(e.target);
      const body = { swap_with: Number(f.swap_with) || 0 };
      ['a1', 'a2', 'b1', 'b2'].forEach((k) => { if (f[k]) body[k] = Number(f[k]); });
      send(body, 'Schedule updated.');
    };
  }

  // Admin: add a match by hand, e.g. a final or a placement match, in an existing round or a new one.
  async function addMatchModal(d, onSaved) {
    const s = d.session;
    const close = () => { modalRoot.innerHTML = ''; };
    const rounds = [...new Set(d.matches.map((m) => m.round))].sort((x, y) => x - y);
    const next = (rounds[rounds.length - 1] || 0) + 1;
    const timeOf = (r) => (d.matches.find((m) => m.round === r) || {}).start_time || '';
    const singles = String(s.format).startsWith('singles');
    const busy = (r) => new Set(d.matches.filter((m) => m.round === r && m.status !== 'done').flatMap((m) => [...m.team_a, ...m.team_b].map((p) => p.id)));
    let round = next;
    let placement = true;
    const label = (p) => (busy(round).has(p.id) ? `playing in round ${round}` : '');
    const team = async (k) => (await Promise.all((singles ? [1] : [1, 2]).map((i) => playerSelect(d, k + i, null, label)))).join('');
    const draw = async () => {
      modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card">
        <form class="pad stack" id="amform" style="padding:24px">
          <h2>Add a match</h2>
          <div class="form-grid">
            <label class="field">Round<select class="input" name="round">${rounds.map((r) => `<option value="${r}" ${r === round ? 'selected' : ''}>Round ${r}</option>`).join('')}<option value="${next}" ${round === next ? 'selected' : ''}>New round ${next}</option></select></label>
            <label class="field">Court<input class="input" type="number" name="court" min="1" max="99" value="1" required></label>
            <label class="field">Start time<input class="input" type="time" name="start_time" value="${esc(timeOf(round))}"></label>
          </div>
          <div class="lineup"><div class="stack" style="gap:8px">${await team('a')}</div><b class="vs-badge">vs</b><div class="stack" style="gap:8px">${await team('b')}</div></div>
          ${s.rule_version >= 2 ? `<label class="toggle"><input type="checkbox" name="placement" ${placement ? 'checked' : ''}>
            <span><b>Placement final (no RATA points)</b><br><span class="hint">An extra match to decide champion vs runner-up or another placing. It decides the order only: no point for the winner and no change to Played, W, L or games.</span></span></label>` : ''}
          <div id="amerr"></div>
          <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn dark">Add match</button></div>
        </form></div></div>`;
      const form = document.getElementById('amform');
      form.round.onchange = () => { round = Number(form.round.value); if (form.placement) placement = form.placement.checked; draw(); };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const f = formData(form);
        const body = { round: Number(f.round), court: Number(f.court), start_time: f.start_time, placement: !!(form.placement && form.placement.checked) };
        ['a1', 'a2', 'b1', 'b2'].forEach((k) => { if (f[k]) body[k] = Number(f[k]); });
        try {
          const data = await api(`sessions/${s.id}/matches`, body);
          memberCache = null; close(); toast('Match added.'); onSaved(data);
        } catch (err) { document.getElementById('amerr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
      };
    };
    modalRoot.onclick = (e) => { if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) close(); };
    draw();
  }

  function roundTimeModal(sessionId, round, time, onSaved) {
    const close = () => { modalRoot.innerHTML = ''; };
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal card">
      <form class="pad stack" id="rtform" style="padding:24px">
        <h2>Round ${round} time</h2>
        <label class="field">Start time<input class="input" type="time" name="start_time" required value="${esc(time)}"></label>
        <label class="toggle"><input type="checkbox" name="shift_following" checked>
          <span><b>Move the later rounds too</b><br><span class="hint">Keeps the same gap between rounds.</span></span></label>
        <div id="rterr"></div>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn dark">Save</button></div>
      </form></div></div>`;
    modalRoot.onclick = (e) => { if (e.target.classList.contains('modal-bg') || e.target.closest('[data-close]')) close(); };
    document.getElementById('rtform').onsubmit = async (e) => {
      e.preventDefault();
      try {
        const data = await api(`sessions/${sessionId}/round-time`, { round, ...formData(e.target) });
        close(); toast('Schedule updated.'); onSaved(data);
      } catch (err) { document.getElementById('rterr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
    };
  }

  // ---------- live stream: scorebug and TV board ----------
  // #/bug/<session>/<court>  transparent 1920×1080 scorebug for an OBS / vMix browser source
  //   ?pos=bl|br|tl|tr  corner (default bottom left) · ?photos=0 names only · ?next show the next match while the court is free
  // #/tv/<session>           full-screen board of every court (?court=N for one court, ?overlay for a transparent background)

  const FINAL_HOLD = 2 * 60 * 1000;

  async function viewBroadcast(kind, sessionId, court, params) {
    document.documentElement.classList.add('bcast');
    document.body.classList.add('bcast');
    scorerCleanup = () => {
      document.documentElement.classList.remove('bcast');
      document.body.classList.remove('bcast');
    };
    let d = await api('sessions/' + sessionId);
    const draw = () => { app.innerHTML = kind === 'bug' ? scorebug(d, court, params) : tvBoard(d, params); };
    draw();
    const clock = setInterval(draw, 1000); // keeps the match clock ticking between polls
    const prev = scorerCleanup;
    scorerCleanup = () => { clearInterval(clock); prev(); };
    poll(async () => { d = await api('sessions/' + sessionId); draw(); }, 2000);
  }

  // The match on a court worth showing: live, else finished in the last 2 minutes, else (optionally) the next one.
  function courtMatch(d, court, withNext) {
    const on = d.matches.filter((m) => m.court === court);
    return on.find((m) => m.status === 'live')
      || on.filter((m) => m.status === 'done' && Date.now() - witaMs(m.updated_at) < FINAL_HOLD).sort((x, y) => witaMs(y.updated_at) - witaMs(x.updated_at))[0]
      || (withNext ? on.find((m) => m.status === 'scheduled') : null);
  }

  function matchClock(d, m) {
    if (m.status !== 'live' || !m.started_at) return '';
    const left = d.session.match_minutes * 60 - matchElapsed(m);
    const a = Math.abs(left);
    return (left < 0 ? '+' : '') + `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`;
  }

  function bcastSide(d, m, side, opts) {
    const team = side === 'a' ? m.team_a : m.team_b;
    const st = m.state || {};
    const photo = (p) => (d.players.find((x) => x.id === p.id) || {}).photo || null;
    const live = m.status === 'live';
    const tennis = st.mode === 'tennis';
    const won = m.status === 'done' && (side === 'a' ? m.score_a > m.score_b : m.score_b > m.score_a);
    const games = side === 'a' ? m.score_a : m.score_b;
    return {
      won,
      names: team.map((p) => `<div class="bc-p">${live && st.server === p.id ? '<i class="bc-serve"></i>' : ''}${opts.photos ? avatar({ ...p, photo: photo(p) }, 'bc-av') : ''}<b>${esc(p.name)}</b>${live && st.fault && st.server === p.id ? '<em class="bc-fault">Fault</em>' : ''}</div>`).join(''),
      pts: tennis && live ? esc(st.display[side === 'a' ? 0 : 1]) : null,
      main: games,
    };
  }

  function scorebug(d, court, params) {
    const pos = ['bl', 'br', 'tl', 'tr'].includes(params.get('pos')) ? params.get('pos') : 'bl';
    const m = courtMatch(d, court, params.has('next'));
    if (!m) return `<div class="bug-stage ${pos}"></div>`;
    const st = m.state || {};
    const opts = { photos: params.get('photos') !== '0' };
    const a = bcastSide(d, m, 'a', opts);
    const b = bcastSide(d, m, 'b', opts);
    const hasPts = a.pts !== null;
    const flash = m.status === 'live' && st.flash ? (st.flash === 'fault' ? 'Fault' : 'Double fault') : '';
    const ends = m.status === 'live' && st.change_ends ? 'Change ends' : '';
    const tag = m.status === 'live' ? (flash || ends || st.note || matchClock(d, m)) : m.status === 'done' ? 'Final' : `Next · ${m.start_time}`;
    const row = (x) => `<div class="bug-row ${x.won ? 'won' : ''}"><div class="bug-who">${x.names}</div>
      ${hasPts ? `<div class="bug-pts">${x.pts}</div>` : ''}<div class="bug-gms">${x.main}</div></div>`;
    return `<div class="bug-stage ${pos}"><div class="bug ${hasPts ? 'has-pts' : ''}">
      <div class="bug-head"><span>${m.status === 'live' ? '<i class="bug-dot"></i>' : ''}Court ${court} · ${esc(d.session.title)} · R${m.round}</span>
        ${tag ? `<span class="bug-tag ${flash ? 'flt' : (ends || st.note) && m.status === 'live' ? 'hot' : ''}">${esc(tag)}</span>` : ''}</div>
      ${row(a)}${row(b)}</div></div>`;
  }

  function tvBoard(d, params) {
    const s = d.session;
    const only = Number(params.get('court')) || 0;
    const courts = Array.from({ length: s.courts }, (_, i) => i + 1).filter((c) => !only || c === only);
    const overlay = params.has('overlay');
    return `<div class="tv ${overlay ? 'overlay' : ''}">
      ${overlay ? '<span></span>' : `<div class="tv-head">${LOGO_TEAM}<div class="tv-title">${esc(s.title)}<span>${esc(fmtDay(s.date))} · ${esc(s.format_label)}</span></div></div>`}
      <div class="tv-courts">${courts.map((c) => {
        const m = courtMatch(d, c, true);
        if (!m) return `<div class="tv-court"><h2>Court ${c}</h2><div class="tv-row"><div class="who"><b class="tv-free">Court free</b></div></div></div>`;
        const st = m.state || {};
        const a = bcastSide(d, m, 'a', { photos: true });
        const b = bcastSide(d, m, 'b', { photos: true });
        const hasPts = a.pts !== null;
        const row = (x) => `<div class="tv-row ${hasPts ? 'has-pts' : ''} ${x.won ? 'won' : ''}"><div class="who">${x.names}</div>${hasPts ? `<div class="pts">${x.pts}</div>` : ''}<div class="gms">${x.main}</div></div>`;
        return `<div class="tv-court"><h2>Court ${c} ${m.status === 'live' ? '<span class="tv-pill live">Live</span>' : m.status === 'done' ? '<span class="tv-pill">Final</span>' : `<span class="tv-pill">Next · ${esc(m.start_time)}</span>`}</h2>
          <div class="tv-board">${row(a)}${row(b)}</div>
          <div class="tv-meta"><span>Round ${m.round} · ${esc(scoreTargetText(s))}</span><span>${m.status === 'live' && st.flash ? `<b class="tv-flt">${st.flash === 'fault' ? 'Fault' : 'Double fault'}</b> ` : ''}${esc(st.note || '')} ${matchClock(d, m)}</span></div></div>`;
      }).join('')}</div>
      ${overlay ? '<span></span>' : `<div class="tv-foot">${miniBoard(d.standings, 5)}</div>`}
    </div>`;
  }

  function streamLinks(s) {
    const base = location.href.split('#')[0];
    const courts = Array.from({ length: s.courts }, (_, i) => i + 1);
    const link = (path, label) => `<div class="stream-link"><span>${label}</span><code>${esc(base + '#' + path)}</code>
      <button class="link-btn" data-act="copy-link" data-copy="${esc(base + '#' + path)}">Copy</button><a class="link-btn" href="#${esc(path)}" target="_blank" rel="noopener">Open</a></div>`;
    return `<div>
      <div class="small muted" style="margin-bottom:6px">Live stream (YouTube / OBS)</div>
      <div class="stack" style="gap:6px">
        ${courts.map((c) => link(`/bug/${s.id}/${c}`, `Score overlay · Court ${c}`)).join('')}
        ${link(`/tv/${s.id}`, 'TV board · all courts')}
      </div>
      <div class="hint" style="margin-top:6px">In OBS add a <b>Browser</b> source, paste the overlay link, set it to 1920 × 1080. The background is transparent, so it sits on top of the camera. Add <code>?pos=br</code> for the bottom right corner, <code>?photos=0</code> for names only, <code>?next</code> to show the next match between games.</div>
    </div>`;
  }

  // ---------- blog ----------
  // Posts are plain text with a few marks: "## Heading", "> quote", **bold**, *italic*, [link](https://…),
  // and a photo on its own line as ![caption](uploads/blog/…jpg).

  function inlineMarks(t) {
    return esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a class="link" href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function renderPost(text) {
    return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map((block) => {
      const b = block.trim();
      if (!b) return '';
      const img = b.match(/^!\[([^\]]*)\]\((uploads\/blog\/[\w.-]+\.jpg)\)$/);
      if (img) return `<figure><a href="${esc(img[2])}" target="_blank" rel="noopener"><img src="${esc(thumb(img[2], 720))}" alt="${esc(img[1])}" loading="lazy" decoding="async"></a>${img[1] ? `<figcaption>${esc(img[1])}</figcaption>` : ''}</figure>`;
      if (b.startsWith('## ')) return `<h2>${inlineMarks(b.slice(3))}</h2>`;
      if (b.startsWith('> ')) return `<blockquote>${b.split('\n').map((l) => inlineMarks(l.replace(/^>\s?/, ''))).join('<br>')}</blockquote>`;
      return `<p>${b.split('\n').map(inlineMarks).join('<br>')}</p>`;
    }).join('');
  }

  const postDate = (p) => fmtDate((p.published_at || p.updated_at).slice(0, 10));

  async function viewBlog() {
    setNav('blog');
    const d = await api('blog');
    const drafts = d.posts.filter((p) => p.status === 'draft');
    const [first, ...rest] = d.posts.filter((p) => p.status !== 'draft');
    const card = (p) => `<a class="card blog-card" href="#/blog/${p.id}">
      <div class="blog-img ${p.cover ? '' : 'none'}" ${p.cover ? `style="background-image:url('${esc(thumb(p.cover))}')"` : ''}>${p.cover ? '' : LOGO}</div>
      <div class="blog-text">${p.status === 'draft' ? '<span class="tag">Draft</span>' : ''}<h3>${esc(p.title)}</h3>
        ${p.summary ? `<p class="muted small">${esc(p.summary)}</p>` : ''}<span class="small muted">${esc(postDate(p))}</span></div></a>`;
    app.innerHTML = `<div class="wrap">
      <div class="page-head"><div><h1>Blog</h1><p class="muted">News, stories and press releases from the team.</p></div>
        ${isAdmin() ? '<a class="btn" href="#/blog/new">+ Write a post</a>' : ''}</div>
      ${first ? `<div class="blog-feature">${card(first)}</div>${rest.length ? `<div class="blog-grid">${rest.map(card).join('')}</div>` : ''}`
        : `<div class="card empty">No posts yet.${isAdmin() ? ' <a class="link" href="#/blog/new">Write the first one →</a>' : ''}</div>`}
      ${drafts.length ? `<div class="section-head"><h2>Drafts</h2><span class="small muted">Only admins see these</span></div><div class="blog-grid">${drafts.map(card).join('')}</div>` : ''}
    </div>`;
  }

  async function viewPost(id) {
    setNav('blog');
    const p = (await api('blog/' + id)).post;
    document.title = p.title + ' · RATA Team';
    app.innerHTML = `<div class="wrap"><article class="post-page">
      <div class="small" style="margin-bottom:14px"><a class="link" href="#/blog">‹ Blog</a></div>
      ${p.status === 'draft' ? '<span class="tag">Draft · only admins can see this</span>' : ''}
      <h1>${esc(p.title)}</h1>
      <div class="muted small post-meta">${esc(postDate(p))} · ${esc(p.author.name)}${isAdmin() ? ` · <a class="link" href="#/blog/${p.id}/edit">Edit</a>` : ''}</div>
      ${p.summary ? `<p class="lead-sm post-lead">${esc(p.summary)}</p>` : ''}
      ${p.cover ? `<img class="post-cover" src="${esc(thumb(p.cover, 720))}" alt="">` : ''}
      <div class="post-text">${renderPost(p.body)}</div>
      <div class="row wrap-ok" style="margin-top:28px"><button class="btn ghost" data-act="share">${ICON.share} Share</button><a class="btn ghost" href="#/blog">More posts</a></div>
    </article></div>`;
    app.onclick = async (e) => {
      if (!e.target.closest('[data-act="share"]')) return;
      const url = location.href;
      try {
        if (navigator.share) await navigator.share({ title: p.title, url });
        else { await navigator.clipboard.writeText(url); toast('Link copied.'); }
      } catch (err) { /* cancelled */ }
    };
  }

  async function uploadBlogImage(blob) {
    const fd = new FormData();
    fd.append('image', blob, 'image.jpg');
    const res = await fetch('api/index.php?r=blog/image', { method: 'POST', credentials: 'same-origin', headers: { 'X-Requested-With': 'bcs' }, body: fd });
    let data = {};
    try { data = await res.json(); } catch (e) { /* non-JSON */ }
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data.url;
  }

  async function viewBlogEditor(id) {
    setNav('blog');
    if (!isAdmin()) return needLogin('Only admins can write posts.');
    const p = id ? (await api('blog/' + id)).post : { title: '', summary: '', body: '', cover: null, status: 'draft' };
    let cover = p.cover;
    app.innerHTML = `<div class="wrap" style="max-width:900px">
      <form class="card pad stack" id="bform" style="padding:24px">
        <div class="spread"><h1>${id ? 'Edit post' : 'Write a post'}</h1>${id ? `<a class="link small" href="#/blog/${id}">View post</a>` : ''}</div>
        <label class="field">Title<input class="input" name="title" required maxlength="160" value="${esc(p.title)}" placeholder="RATA Open 2026: 64 players, one big weekend"></label>
        <label class="field">Summary<textarea class="input" name="summary" maxlength="300" rows="2" placeholder="One or two sentences shown on the blog page and under the title">${esc(p.summary)}</textarea></label>
        <div class="field">Cover photo <span class="hint">16:9, 1920 × 1080 px</span>
          <div class="blog-cover-pick" id="cover-pick"></div></div>
        <div class="field">Text
          <div class="editor-bar">
            <button type="button" class="btn xs ghost" data-md="h">Heading</button>
            <button type="button" class="btn xs ghost" data-md="b"><b>B</b></button>
            <button type="button" class="btn xs ghost" data-md="i"><i>I</i></button>
            <button type="button" class="btn xs ghost" data-md="q">Quote</button>
            <button type="button" class="btn xs ghost" data-md="a">Link</button>
            <label class="btn xs dark">${ICON.camera}<span> Photo</span><input type="file" accept="image/*" id="body-photo" multiple hidden></label>
            <span class="sc-spacer"></span>
            <div class="seg"><button type="button" class="on" data-view="write">Write</button><button type="button" data-view="preview">Preview</button></div>
          </div>
          <textarea class="input editor" name="body" id="body" rows="18" maxlength="60000" placeholder="Write your story. Leave an empty line between paragraphs.">${esc(p.body || '')}</textarea>
          <div class="post-text editor-preview hidden" id="preview"></div>
          <span class="hint">Leave an empty line between paragraphs. Photos go where the cursor is; the text in [ ] becomes the caption.</span></div>
        <div id="berr"></div>
        <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          ${id ? '<button type="button" class="btn danger" data-del>Delete</button>' : '<span></span>'}
          <span class="row wrap-ok" style="gap:8px">
            <button type="submit" class="btn ghost" data-status="draft">${p.status === 'published' ? 'Unpublish (draft)' : 'Save draft'}</button>
            <button type="submit" class="btn dark" data-status="published">${p.status === 'published' ? 'Update' : 'Publish'}</button></span>
        </div>
      </form></div>`;
    const form = document.getElementById('bform');
    const ta = document.getElementById('body');
    const drawCover = () => {
      document.getElementById('cover-pick').innerHTML = `<div class="bp-prev" style="aspect-ratio:16/9;max-width:360px${cover ? `;background-image:url('${esc(cover)}')` : ''}">${cover ? '' : '<span>No cover yet</span>'}</div>
        <div class="row wrap-ok" style="margin-top:8px"><label class="btn xs dark">${cover ? 'Change' : 'Upload'}<input type="file" accept="image/*" id="cover-input" hidden></label>${cover ? '<button type="button" class="btn xs ghost" data-cover-rm>Remove</button>' : ''}</div>`;
    };
    drawCover();
    const insert = (before, after, placeholder) => {
      const [a, b] = [ta.selectionStart, ta.selectionEnd];
      const sel = ta.value.slice(a, b);
      const text = sel || placeholder;
      ta.setRangeText(before + text + after, a, b, 'end');
      ta.focus();
      if (!sel) ta.setSelectionRange(a + before.length, a + before.length + text.length);
    };
    // puts a block (heading, photo…) on its own paragraph at the cursor
    const insertBlock = (text) => {
      const a = ta.selectionStart;
      const pre = ta.value.slice(0, a).replace(/\n*$/, '');
      const post = ta.value.slice(ta.selectionEnd).replace(/^\n*/, '');
      ta.value = (pre ? pre + '\n\n' : '') + text + '\n\n' + post;
      const pos = (pre ? pre.length + 2 : 0) + text.length + 2;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    };
    form.addEventListener('change', async (e) => {
      if (e.target.id === 'cover-input') {
        const f = e.target.files[0];
        e.target.value = '';
        if (!f) return;
        const blob = await cropPhoto(f, { aspect: 16 / 9, max: 1920, title: 'Cover photo', note: 'Drag to move, zoom to fit.', save: 'Use photo' });
        if (!blob) return;
        try { cover = await uploadBlogImage(blob); drawCover(); } catch (err) { toast(err.message, true); }
      }
      if (e.target.id === 'body-photo') {
        const files = [...e.target.files];
        e.target.value = '';
        for (const f of files) {
          try {
            toast('Uploading photo…');
            const url = await uploadBlogImage(await shrinkImage(f));
            insertBlock(`![](${url})`);
          } catch (err) { toast(err.message, true); }
        }
      }
    });
    form.onclick = async (e) => {
      const md = e.target.closest('[data-md]');
      if (md) {
        const k = md.dataset.md;
        if (k === 'b') insert('**', '**', 'bold text');
        if (k === 'i') insert('*', '*', 'italic text');
        if (k === 'a') insert('[', '](https://)', 'link text');
        if (k === 'h') insertBlock('## Heading');
        if (k === 'q') insertBlock('> Quote');
        return;
      }
      const v = e.target.closest('[data-view]');
      if (v) {
        form.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('on', x === v));
        const prev = v.dataset.view === 'preview';
        document.getElementById('preview').innerHTML = renderPost(ta.value) || '<p class="muted">Nothing written yet.</p>';
        document.getElementById('preview').classList.toggle('hidden', !prev);
        ta.classList.toggle('hidden', prev);
        return;
      }
      if (e.target.closest('[data-cover-rm]')) { cover = null; drawCover(); return; }
      if (e.target.closest('[data-del]')) {
        if (!confirm('Delete this post? This cannot be undone.')) return;
        try { await api('blog/' + id, { delete: true }); toast('Post deleted.'); location.hash = '#/blog'; } catch (err) { toast(err.message, true); }
      }
    };
    form.onsubmit = async (e) => {
      e.preventDefault();
      const status = (e.submitter && e.submitter.dataset.status) || 'draft';
      try {
        const data = await api(id ? 'blog/' + id : 'blog', { ...formData(form), cover: cover || '', status });
        toast(status === 'published' ? 'Published.' : 'Draft saved.');
        location.hash = '#/blog/' + data.post.id;
      } catch (err) { document.getElementById('berr').innerHTML = `<div class="error-msg">${esc(err.message)}</div>`; }
    };
  }

  // ---------- push notifications ----------
  // New sessions and published schedules reach members' phones as push notifications (sw.js shows them).
  // iPhones only allow this for the app added to the home screen (iOS 16.4+).

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  async function pushSub() {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? reg.pushManager.getSubscription() : null;
  }

  // on | off | denied | ios-install (needs Add to Home Screen first) | unsupported
  async function pushStatus() {
    if (isIOS && !isStandalone() && !pushSupported()) return 'ios-install';
    if (!pushSupported()) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try {
      return Notification.permission === 'granted' && await pushSub() ? 'on' : 'off';
    } catch (e) { return 'off'; }
  }

  async function enablePush() {
    if (await Notification.requestPermission() !== 'granted') throw new Error('Notifications were not allowed.');
    const { key } = await api('push/key');
    const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
    const reg = await navigator.serviceWorker.register('sw.js');
    await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription()
      || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
    await api('push/subscribe', { endpoint: sub.endpoint });
  }

  async function disablePush() {
    const sub = await pushSub();
    if (!sub) return;
    await api('push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
    await sub.unsubscribe();
  }

  const PUSH_TEXT = {
    on: 'Notifications are on for this device.',
    off: 'Get a notification on this device when a new session opens or your schedule is out.',
    denied: 'Notifications are blocked for this site. Allow them in your browser or phone settings, then come back here.',
    'ios-install': 'On iPhone, tap the Share button, then <b>Add to Home Screen</b>. Open RATA from your home screen and turn notifications on there.',
    unsupported: "This browser can't show notifications. Try Chrome on Android, or Safari on iPhone after adding RATA to your home screen.",
  };

  // Fills a box (profile card or home banner) with the right text and button, and wires it up.
  async function drawPushBox(el, banner) {
    if (!el || !state.user) return;
    const st = await pushStatus();
    let dismissed = false;
    try { dismissed = localStorage.getItem('bcs_push_hide') === '1'; } catch (e) { /* storage off */ }
    if (banner && (dismissed || !['off', 'ios-install'].includes(st))) { el.innerHTML = ''; return; }
    if (st === 'on' && !banner) api('push/subscribe', { endpoint: (await pushSub()).endpoint }).catch(() => {}); // keep it linked to whoever is logged in
    el.innerHTML = banner
      ? `<div class="push-banner">${ICON.bell}<div>${PUSH_TEXT[st]}</div>${st === 'off' ? '<button class="btn sm dark" data-push="on">Turn on</button>' : ''}<button class="push-x" data-push="hide" aria-label="Hide">×</button></div>`
      : `<h3>Notifications</h3><div class="small muted">${PUSH_TEXT[st]}</div>
         ${st === 'off' ? '<div><button class="btn sm dark" data-push="on">Turn on notifications</button></div>' : st === 'on' ? '<div><button class="btn sm ghost" data-push="off">Turn off</button></div>' : ''}`;
    el.onclick = async (e) => {
      const b = e.target.closest('[data-push]');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      if (b.dataset.push === 'hide') {
        try { localStorage.setItem('bcs_push_hide', '1'); } catch (err) { /* storage off */ }
        el.innerHTML = '';
        return;
      }
      b.disabled = true;
      try {
        if (b.dataset.push === 'on') { await enablePush(); toast("Notifications are on. We'll let you know about new sessions."); }
        else { await disablePush(); toast('Notifications are off.'); }
      } catch (err) { toast(err.message || "Couldn't change notifications.", true); }
      drawPushBox(el, banner);
    };
  }

  // ---------- router ----------

  const baseTitle = document.title;
  async function render() {
    document.title = baseTitle;
    stopPolling();
    clearInterval(state.heroTimer);
    clearInterval(state.chatTimer);
    leaveScorer();
    app.onclick = null;
    app.onchange = null;
    modalRoot.innerHTML = '';
    const path = location.hash.replace(/^#/, '') || '/';
    state.route = path;
    const [bPath, bQuery] = path.split('?');
    const bp = bPath.split('/').filter(Boolean);
    const p = bp;
    if (bp[0] === 'bug' && bp[1] && bp[2]) return viewBroadcast('bug', Number(bp[1]), Number(bp[2]), new URLSearchParams(bQuery || '')).catch(() => { app.innerHTML = ''; });
    if (bp[0] === 'tv' && bp[1]) return viewBroadcast('tv', Number(bp[1]), 0, new URLSearchParams(bQuery || '')).catch(showError);
    window.scrollTo(0, 0);
    try {
      if (!p.length) return await viewHome();
      if (p[0] === 'score' && p[1]) return await viewScorer(Number(p[1]));
      if (p[0] === 'sessions' && p[1] === 'new') return await viewSessionForm(0, Number(new URLSearchParams(bQuery || '').get('from')) || 0);
      if (p[0] === 'sessions' && p[1] && p[2] === 'edit') return await viewSessionForm(Number(p[1]));
      if (p[0] === 'sessions' && p[1]) return await viewSession(Number(p[1]), new URLSearchParams(bQuery || '').has('review'), new URLSearchParams(bQuery || '').has('chat'));
      if (p[0] === 'sessions') return await viewSessions();
      if (p[0] === 'live') return await viewLive();
      if (p[0] === 'leaderboard') return await viewLeaderboard();
      if (p[0] === 'members' && p[1]) return await viewMember(Number(p[1]), state.user && state.user.id === Number(p[1]));
      if (p[0] === 'members') return await viewMembers();
      if (p[0] === 'me') {
        if (!state.user) { sessionStorage.setItem('bcs_back', '#/me'); return needLogin(); }
        return await viewMember(state.user.id, true);
      }
      if (p[0] === 'login' || p[0] === 'register') return viewAuth(p[0]);
      if (p[0] === 'finance') return await viewFinance();
      if (p[0] === 'approvals') return await viewApprovals();
      if (p[0] === 'audit') return await viewAudit();
      if (p[0] === 'activity') return await viewActivity();
      if (p[0] === 'chat' && p[1]) return await viewChannel(Number(p[1]));
      if (p[0] === 'chat') return await viewChats();
      if (p[0] === 'blog' && p[1] === 'new') return await viewBlogEditor(0);
      if (p[0] === 'blog' && p[1] && p[2] === 'edit') return await viewBlogEditor(Number(p[1]));
      if (p[0] === 'blog' && p[1]) return await viewPost(Number(p[1]));
      if (p[0] === 'blog') return await viewBlog();
      app.innerHTML = '<div class="wrap"><div class="card empty"><h2>Page not found</h2><a class="btn dark" href="#/">Go home</a></div></div>';
    } catch (e) {
      showError(e);
    }
  }

  window.addEventListener('hashchange', render);
  (async () => {
    try { const me = await api('me'); state.user = me.user; state.unread = me.activity_unread || 0; } catch (e) { state.user = null; }
    renderTop();
    render();
    // Admins: keep the activity count in the top bar fresh.
    setInterval(() => { if (!document.hidden && !state.route.startsWith('/activity')) refreshUnread(); }, 60000);
  })();

})();
