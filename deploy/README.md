# Deploying this app

This is a Node.js SSR app (TanStack Start, built with Nitro). It builds down
to a single `.output/server/index.mjs` file that runs as a plain Node HTTP
server and reads its port from the `PORT` environment variable — so it runs
on any Node.js host, managed or not.

## Using your own Supabase project instead of Lovable Cloud

If you're not deploying through Lovable, you won't have Lovable Cloud's
Supabase credentials — create your own free project at supabase.com instead.
A brand-new project starts with an empty database, so before the app will
work you need to create all its tables once:

1. Open your project on supabase.com → **SQL Editor** → **New query**.
2. Open `supabase/migrations/20260728000000_bootstrap_schema.sql` from this
   repo, copy its entire contents, paste into the SQL Editor, and click
   **Run**. This one script creates every table, security policy, and the
   invoice-attachments storage bucket — it's the de-duplicated, tested
   result of this project's whole migration history. (Ignore the other,
   older-dated files in `supabase/migrations/` if any exist locally — this
   is the one to run, and only this one, on a fresh project.)
3. Get your API credentials: **Project Settings** → **API** → copy the
   **Project URL**, **Project ID/Reference**, and the **anon / publishable**
   key. Never use the **service_role** key for the app's own env vars (see
   below) — that one is only for the WhatsApp reminder cron script.
4. Use those values as `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, and
   `VITE_SUPABASE_PUBLISHABLE_KEY` wherever this guide asks for them.
5. Sign up through the app itself once it's deployed — the **first account
   created becomes admin automatically**; everyone after that starts as
   "staff" and has to be promoted from the Team page.

Note: the "Login with Google" button routes through Lovable's own OAuth
relay (`@lovable.dev/cloud-auth-js`) and may not work once you're off
Lovable Cloud. Plain email/password sign-up and login always work regardless
of which Supabase project you use.

There are two supported hosting paths:

- **Hostinger Managed Node.js Web App Hosting** (recommended — no server
  administration, Hostinger handles the process manager, reverse proxy, and
  SSL for you). See below.
- **Your own VPS** (full control, but you manage Nginx/PM2/Certbot
  yourself). See [`setup-vps.sh`](#optional-self-managed-vps) further down.

Both deploy the exact same code — nothing in the app needs to change
between them.

## Hostinger Managed Node.js Web App Hosting

Requires a Hostinger **Business** web hosting plan or any **Cloud** hosting
plan (Node.js Web Apps aren't available on the cheapest Shared plans).

1. In **hPanel** → **Websites** → **Add Website**, choose **Node.js Web App**
   (or open an existing site's **Node.js** section).
2. Connect this GitHub repository (or paste its URL) so hPanel deploys
   straight from `main` on every push — no manual upload needed.
3. Set these fields:
   - **Application root**: `/` (repo root — `package.json` lives here)
   - **Node.js version**: 20 (latest 20.x) or 22 — this app requires
     `^20.19.0 || >=22.12.0` (declared in `package.json`'s `engines` field)
   - **Install command**: `npm ci`
   - **Build command**: `npm run build`
   - **Application startup file**: `.output/server/index.mjs`
     (equivalently, a startup/run command of `npm start`, which runs the
     same file — use whichever field hPanel exposes for your plan)
4. Add environment variables in the app's **Environment Variables** panel
   (copy the real values from Supabase → Project Settings → API):
   ```
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PROJECT_ID=your-project-ref
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_PROJECT_ID=your-project-ref
   SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
   ```
   Saving these triggers a rebuild. Hostinger sets `PORT` itself — don't set
   it manually, the app already listens on `process.env.PORT`.
5. Deploy. Once it's live, attach your domain to the site in hPanel the
   normal way and Hostinger issues SSL automatically — no `certbot` needed.
6. Every push to `main` redeploys automatically from then on.

You do **not** need PM2, Nginx, Certbot, systemd, or root/SSH access for
this path — Hostinger's managed environment handles all of that.

### Daily WhatsApp due-date reminders (managed hosting)

`scripts/send-due-reminders.mjs` needs to run once a day and needs
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service_role key, from
Supabase → Project Settings → API — never put this one in the app's own
`VITE_`/frontend env vars). Set it up as an hPanel **Cron Job** →
**Custom**, running once daily, e.g.:
```bash
cd /home/<your-hpanel-username>/public_html && SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/send-due-reminders.mjs
```
(Adjust the path to wherever hPanel deployed the repo — check the Node.js
app's file manager for the exact path.)

## Optional: self-managed VPS

If you'd rather run this on your own Ubuntu VPS instead of Hostinger's
managed Node.js hosting — full root access, your own Nginx/PM2/Certbot,
auto-deployed via GitHub Actions on every push to `main` — see
[`setup-vps.sh`](./setup-vps.sh) and the steps below. This path is entirely
optional; skip it if you're using Hostinger's managed hosting above.

1. SSH into your VPS the way you already do (password is fine for this step —
   it never leaves your terminal).
2. Copy `deploy/setup-vps.sh` onto the VPS (or `git clone` this repo
   temporarily just to grab the script, or paste its contents into a new
   file with `nano setup-vps.sh`).
3. Run it:
   ```bash
   bash setup-vps.sh
   ```
4. It prints three things at the end — follow them exactly:
   - A **public key** to add as a GitHub **Deploy Key** (Settings → Deploy
     keys on the repo) — lets the VPS pull the private repo.
   - A **private key** to add as a GitHub **Actions Secret** named
     `VPS_SSH_KEY` (Settings → Secrets and variables → Actions) — lets
     GitHub Actions log into the VPS to deploy.
   - `VPS_HOST` (the server's IP) and `VPS_USER` — add these as secrets too.
5. Clone the repo once by hand using the command the script prints, into
   `/var/www/say-hello`.
6. Create `/var/www/say-hello/.env` on the VPS (copy `.env.example`, fill
   in your real Supabase project values from Supabase → Project Settings
   → API).
7. Build and start it once by hand to make sure it works:
   ```bash
   cd /var/www/say-hello
   npm ci
   npm run build
   PORT=3000 pm2 start .output/server/index.mjs --name say-hello
   pm2 save
   pm2 startup   # follow the one printed command to survive reboots
   ```
8. Visit `http://YOUR_SERVER_IP` in a browser — the app should load.

Every push to `main` (from Claude or you) triggers
`.github/workflows/deploy.yml`, which SSHs in, pulls, rebuilds, and
restarts the app automatically — usually live within a minute.

### Daily WhatsApp due-date reminders (VPS)

Once WhatsApp is connected (Settings -> WhatsApp -> Get Pairing Code) and
Outstanding Amount Reminder is turned on (Settings -> Alerts), run
`scripts/send-due-reminders.mjs` once a day to message customers whose
invoices are overdue. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env` on the
VPS (from Supabase -> Project Settings -> API -> service_role — this key
bypasses RLS, so it must never end up in the frontend bundle), then add
a cron entry:
```bash
crontab -e
# add this line to run it every day at 10am server time:
0 10 * * * cd /var/www/say-hello && /usr/bin/node scripts/send-due-reminders.mjs >> /var/log/due-reminders.log 2>&1
```

### Adding a domain + HTTPS later (VPS)

Once you point a domain's A record at the server IP, run:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```
and update the `server_name` in `/etc/nginx/sites-available/say-hello`
from `_` to `yourdomain.com`.
