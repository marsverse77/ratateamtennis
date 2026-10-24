# RATA Team Tennis

Tennis community app for RATA Team, Bali: play sessions, coaching, tournaments, live scores, leaderboards, members and a blog. Live at https://ratateamtennis.id

The look is black and white with italic condensed headings (see `public/assets/css/app.css`, the "RATA Team theme" block at the end). The RATA wordmark is an inline SVG (`LOGO` in `app.js`, and `assets/img/mark.svg`).

## What it does

- **Sessions**: admins create a session (date, time, courts, max players, game format, scoring). Members register themselves, or admins add players.
- **Auto-schedule**: one click generates every round and court.
  - *Doubles · Americano*: partners rotate every round, nobody partners the same person twice while it can be avoided.
  - *Doubles · Mexicano*: round 1 is random, each next round pairs players by the current standings (1st + 3rd vs 2nd + 4th).
  - *Singles · Round robin*: opponents rotate every round.
  - Extra players sit out in turn, so everyone plays the same number of matches (±1).
- **Live scoring**: admins and the players in a match tap +1 / −1. Everyone watching the Live page or the session page sees it within a few seconds. Matches finish automatically when the points target is reached.
- **Leaderboards**: a session leaderboard, plus an overall leaderboard that adds up points from every completed session (sessions can opt out).
- **Members**: member list, profiles with overall points, rank, and points per session.
- **Accounts**: members sign up and log in to see their own points and sessions. **The first account created becomes the admin**; admins can promote other members from their profile.

Points: each player earns the points their side won in each match (Americano style). Ties are broken by wins, then point difference.

## Code

```
public/                  deployed as-is to public_html (no build step)
  index.html             app shell
  assets/js/app.js       single-page frontend (hash routes: #/sessions, #/live, ...)
  assets/css/app.css
  assets/img/            wordmark, app icons, homepage and members photos
  api/index.php          JSON API (api/index.php?r=sessions/3)
  api/lib/db.php         PDO connection + schema (MySQL, or SQLite fallback)
  api/lib/scheduler.php  match generation
  api/lib/app.php        auth, standings, helpers
```

### Run locally

```
RATA_SQLITE=/tmp/rata.sqlite php -S 127.0.0.1:8000 -t public
```

Open http://127.0.0.1:8000 and create the first account (it becomes the admin).

## Deploy

Every push to `main` deploys `public/` to Hostinger (`public_html`) via GitHub Actions over FTPS, and writes `api/config.php` from the `DB_*` secrets. See [docs/DEPLOY.md](docs/DEPLOY.md).
