# Deploying to Hostinger (ratateamtennis.id)

Pushes to `main` run `.github/workflows/deploy.yml`, which uploads `public/` to the site's `public_html` folder over FTPS.

## One-time setup

1. **Hostinger FTP account.** hPanel → Websites → ratateamtennis.id → Files → FTP Accounts. Note the FTP host (IP or `ftp.ratateamtennis.id`), username and password (reset it if unknown).
2. **GitHub secrets.** github.com/marsverse77/ratateamtennis → Settings → Secrets and variables → Actions → New repository secret:
   - `FTP_SERVER` – the FTP host
   - `FTP_USERNAME` – the FTP username
   - `FTP_PASSWORD` – the FTP password
   - `FTP_SERVER_DIR` (optional) – remote folder, default `/public_html/`. If the FTP user is already rooted in `public_html`, set it to `/`.
3. **Run it.** Actions tab → Deploy to Hostinger → Run workflow (or push to `main`). Then open https://ratateamtennis.id.

## Database (MySQL)

The app stores members, sessions and scores in a database.

1. hPanel → Websites → ratateamtennis.id → Databases → **MySQL Databases**. Create a database and a user (Hostinger prefixes both, e.g. `u123456789_rata`). Note the password.
2. Add GitHub secrets (same place as the FTP ones):
   - `DB_NAME` – the full database name, e.g. `u123456789_rata`
   - `DB_USER` – the full database user, e.g. `u123456789_rata`
   - `DB_PASSWORD` – the database password
   - `DB_HOST` (optional) – default `localhost`, which is right for Hostinger web hosting
3. Re-run the deploy. The tables are created automatically on the first request.

Without `DB_NAME` the app falls back to a SQLite file at `public_html/api/data/rata.sqlite` (blocked from the web by `.htaccess`). That is fine for trying it out, but data in it does **not** move to MySQL when you add the secrets later, so set up MySQL before real use.

## First admin

The first account that signs up becomes the admin. Sign up right after the first deploy. Admins can make other members admins from the member's profile (Edit member → Role).

## Domain / SSL

The domain must point at this Hostinger hosting plan (hPanel → Domains; nameservers `ns1.dns-parking.com` / `ns2.dns-parking.com` if registered elsewhere). Turn on SSL under hPanel → Security → SSL.

## Alternative: hPanel Git deploy

hPanel → Advanced → Git can pull the repo directly (add the deploy key it shows under repo Settings → Deploy keys, then enable Auto Deployment and add its webhook URL under Settings → Webhooks). It copies the whole repo, not just `public/`, and cannot run a build, so the Actions workflow above is the default.
