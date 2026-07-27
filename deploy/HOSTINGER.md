# Deploying UniInvoice on Hostinger (Node.js)

This app is a **TanStack Start (Node SSR)** application. It needs a Node.js
runtime that keeps a process running (it is **not** a static PHP/HTML site).
Use a Hostinger plan/feature that supports **Node.js apps** (hPanel →
"Node.js" / "Setup Node App", or Hostinger's git/AI deploy). Plain shared
hosting that only serves static files cannot run it.

## Exact settings to give Hostinger (or Hostinger's AI)

| Setting                 | Value                                             |
| ----------------------- | ------------------------------------------------- |
| Repository              | `chnaeemullah372-svg/say-hello`                   |
| Node.js version         | `20` or higher                                    |
| Install command         | `npm ci`  (falls back to `npm install`)           |
| Build command           | `npm run build:node`                              |
| Start command           | `npm start`                                       |
| Application entry file  | `.output/server/index.mjs`                        |
| Listens on              | `process.env.PORT` (Hostinger sets this for you)  |

> **Why `build:node` and not `build`?** The default `npm run build` targets
> Cloudflare (Lovable's hosting) and its output will not run under plain
> Node. `npm run build:node` sets `NITRO_PRESET=node-server`, producing
> `.output/server/index.mjs`, which `npm start` runs.

## Environment variables (set these in Hostinger's app panel)

Copy the real values from Supabase → Project Settings → API. These are the
same values as `.env.example`:

```
SUPABASE_URL=https://YOUR-REF.supabase.co
SUPABASE_PROJECT_ID=YOUR-REF
SUPABASE_PUBLISHABLE_KEY=YOUR-ANON-PUBLIC-KEY
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_PROJECT_ID=YOUR-REF
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-ANON-PUBLIC-KEY
```

The `VITE_*` values are baked into the browser bundle **at build time**, so
they must be present **before** the build command runs. If you set them only
after building, rebuild once.

Optional — only if you also run the daily WhatsApp reminder script
(`scripts/send-due-reminders.mjs`) as a cron job:

```
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY   # server-only, never in a VITE_ var
```

## Manual deploy over SSH (if you prefer doing it by hand)

```bash
cd ~/domains/YOURDOMAIN/public_html   # or wherever the app lives
git clone https://github.com/chnaeemullah372-svg/say-hello.git .
npm ci
# create .env with the variables above, then:
npm run build:node
PORT=3000 npm start                   # or register it with the panel's Node app manager
```

Point your domain at the running Node process (Hostinger's Node app manager
wires the domain to your app's port automatically once the app is created).

## If your plan turns out to be static-only

If the Node.js option is not available on your plan, this app can instead be
served as a **static SPA** (all data goes directly from the browser to
Supabase, so SSR is not required for it to work). Ask and this repo can be
adjusted to produce a static build for `public_html`. The trade-off is losing
server-side rendering and the server-run WhatsApp reminder cron.
