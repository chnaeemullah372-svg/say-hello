# Deploying to your own VPS

This replaces Lovable's hosting with your own Ubuntu VPS, auto-deployed on
every `git push` to `main` via GitHub Actions. Claude never touches your
VPS directly — you run one script once, then everything is automatic.

## One-time setup (run this yourself, on the VPS)

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
   NITRO_PRESET=node-server npm run build
   PORT=3000 pm2 start .output/server/index.mjs --name say-hello
   pm2 save
   pm2 startup   # follow the one printed command to survive reboots
   ```
8. Visit `http://YOUR_SERVER_IP` in a browser — the app should load.

## After that

Every push to `main` (from Claude or you) triggers
`.github/workflows/deploy.yml`, which SSHs in, pulls, rebuilds, and
restarts the app automatically — usually live within a minute.

## Daily WhatsApp due-date reminders

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

## Adding a domain + HTTPS later

Once you point a domain's A record at the server IP, run:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```
and update the `server_name` in `/etc/nginx/sites-available/say-hello`
from `_` to `yourdomain.com`.
