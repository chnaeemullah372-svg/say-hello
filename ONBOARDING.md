# CN Invoice — Project Onboarding

Read this before touching anything. It exists so a **new agent session** (Claude Code or otherwise) that has never seen this project can pick it up safely — without breaking what's already working, without redoing finished work, and without guessing at conventions the owner has already stated explicitly.

## What this is

**CN Invoice** — a multi-tenant invoicing/billing SaaS for small businesses (built for the Pakistani/Indian market), cloned feature-for-feature from a competitor app called **"UNI Invoice"**. The owner (the human who runs this project) speaks Roman Urdu/Urdu and is a business owner, not a developer — explain things in plain terms, don't assume they'll read code.

The mandate, stated by the owner: functionality must match UNI Invoice exactly. Visual design can be better/different **except** where the owner has explicitly demanded literal pixel/structural parity (the rich document-creation cards, and the Template Design screen under Settings — both call out "same as it is" specifically).

## Repository / branches

- Repo: `chnaeemullah372-svg/say-hello`.
- **`main`** — production. The owner deploys this to Hostinger **manually** (see Deployment below). Treat `main` as live.
- **`uni-invoice`** — a static snapshot/backup branch created from `main` on 2026-08-10, before further work continued. It is **not** meant to receive commits — it's a restore point in case a future agent breaks `main` badly enough that reverting individual commits isn't practical. If you need to compare "what did it look like before things went wrong," diff against this branch.
- Working convention established this project: batch related changes → PR → merge to `main` → reset the working branch from `main` (`git fetch origin main && git checkout -B <branch> origin/main && git push --force-with-lease`) before starting the next batch. **Never stack new work on top of an already-merged PR's branch** — restart from `main` first.

## Deployment — read this before "fixing" CI

- `.github/workflows/deploy.yml` ("Deploy to VPS") points at a **dead VPS**. It will fail or do nothing. **This is known and expected — do not try to fix it, do not disable it, do not investigate it as a bug.**
- The owner deploys to **Hostinger manually** themselves after merging to `main`. That's the real deployment path. If the owner reports something is broken "on the live site," they mean the Hostinger deployment, which may lag behind `main` until they redeploy — always ask (or infer from context) whether you're looking at `main`'s code or the live site's current behavior before assuming a bug is/isn't fixed.
- Production URL used for live testing throughout this project: `cnvoice.es`.

## Stack

- **Frontend:** TanStack Start + TanStack Router (file-based routing in `src/routes/`), React, Tailwind, shadcn/Radix UI components.
- **Backend:** Supabase (Postgres + RLS + Storage + Auth). No custom backend server beyond a few TanStack `.server.ts` files (`src/lib/*.server.ts`) for things that must run server-side (WhatsApp engine, due-date reminder scheduler, subscription billing).
- **PDF generation:** jsPDF + jspdf-autotable, all funneled through one shared module: `src/lib/pdf-builder.ts` (`buildDocumentPdf` for standard A4-style documents, `buildReceiptPdf` for thermal/custom-width receipts). Every document type (Invoice, Estimate, Sale Order, Purchase, Purchase Order, Delivery Note, Sale Return, Purchase Return) renders through this one module — don't build a one-off PDF layout for a new document type, extend the shared builder instead.
- **WhatsApp:** a self-hosted Baileys-based engine (`src/lib/whatsapp-engine.server.ts`, `src/lib/whatsapp-actions.ts`, `src/lib/whatsapp.ts`) — not a third-party API. It is explicitly documented (in its own code comments) as **single-process only** — running multiple Node instances/PM2 clusters against the same WhatsApp session will cause disconnects. If WhatsApp connectivity issues come up, check the hosting process count before assuming it's a code bug (the owner has been told this and said they'll manage it on the hosting side).

## Multi-tenant architecture — the most important thing to not break

Every business that signs up is a **tenant**, isolated by `tenant_id` on essentially every table, enforced by Postgres RLS policies (see `supabase/migrations/20260808040000_multi_tenant_foundation.sql` and `20260809000000_tenant_scoped_numbering.sql`). Key points:

- New signups create a business that sits in a **pending-approval** state until a platform admin approves it (`AppShell.tsx` gates the whole app on `user.businessStatus`). Don't remove this gate.
- Document numbering (invoice/estimate/PO numbers etc.) is **per-tenant**, using an atomic Postgres function (`next_document_number` / `assign_doc_number`) — this was a real regression fixed mid-project (two tenants used to be able to collide on the same invoice number). Don't revert to a global sequence.
- `src/lib/store.tsx` is the central data-access layer (`useStore()` hook) — every `insert()` call into a tenant-scoped table **must** include `tenant_id`. A real bug this project — `addPurchase` was missing it — caused RLS violations. If you touch `store.tsx`, check every insert call still stamps `tenant_id`.
- Staff permissions are two-layered: a coarse Postgres enum role (`admin | manager | cashier | staff`) plus a finer per-module `staff_permissions` table overlay (`src/lib/permissions.ts`, `useStaffPermission` hook). Don't collapse this back to role-only checks without checking both layers.

## Settings architecture

`src/routes/settings.tsx` is one large file (~2900 lines) that renders every settings category through a shared `active`/`setActive` pattern with query-string sections (`?section=<key>`). Each category is its own component (`BusinessPanel`, `TaxPanel`, `TemplateSettingsPanel`, etc.) taking `data`/`set` props that write into one big `settings` object saved to the `app_settings` table (one row per `tenant_id` + `setting_key`, e.g. `settings.business`, `settings.templateSettings`).

**Template Design** (`TemplateDesignScreen` in the same file) is a special case: it's a *dedicated live-preview screen*, not a generic settings form — the owner was explicit, after several rounds of feedback, that it must structurally match UNI Invoice's own Template Design screen (live document preview on top, a template pager, a Setting/text-size/color toolbar, a Watermark row with position/opacity/image gallery, Cancel/Save at the bottom). If you touch this screen, **look at how it's built before changing it** — it's intentionally not a plain form, and simplifying it back into one risks repeating a mistake already corrected twice this project.

## Known, real, currently-unresolved issues

1. ~~`business-assets` Storage bucket does not exist in production~~ — **resolved**: confirmed live (upload now hits real RLS policy checks instead of "Bucket not found"), Business Logo/Stamp/Watermark upload all work now.
2. **`settings_audit_log` table does not exist in production**, same root cause as #1 used to be: the migration that creates it (`supabase/migrations/20260809010000_staff_permissions_and_audit.sql`) is in the repo but was never applied to the live database. Settings' "View change history" silently shows "No changes recorded yet" always (swallows the `PGRST205` error instead of surfacing it) — someone needs to run that migration's SQL in the Supabase SQL editor (no service-role key in this environment to do it programmatically).
3. A systematic audit flagged 8 tables as possibly missing `tenant_id` on insert in `store.tsx` (`customers`, `delivery_notes`, `sale_returns`, `purchase_returns`, `production_entries`, `commissions`, `expenses`, `purchases`). Only `purchases` was concretely confirmed and fixed. The rest were never re-verified — worth checking if you're in that file anyway.
4. Task "End-to-end multi-tenant verification" (sign up a second real business end-to-end and confirm full isolation) was never completed.
5. **No delete-customer button anywhere in the UI** (`deleteCustomer` exists and works in `store.tsx`, just never wired up in `customers.tsx`). Every ZZZ_TEST customer created during testing across this whole project is stuck in the DB forever as a result — clearly named and harmless, but worth fixing or at least deciding is intentional.
6. **Sale Returns adjust `customer.balance` directly but are invisible on the Statement page** (which only reads Invoices + Payments) — recording a Sale Return will create the same kind of Statement-vs-Customer-list balance mismatch that editing Opening Balance / an invoice's amount used to cause (both of those are now fixed, see git history on `claude/cnvoice-audit-fixes-kcmnw6`). Needs a decision: either make Statement show Sale Returns too, or stop them from touching `balance` directly and compute everything from Statement's own live formula instead.

## What NOT to touch without a good reason

- **`.github/workflows/deploy.yml`** — dead VPS, intentionally ignored, see Deployment above.
- **`src/lib/pdf-builder.ts`'s existing layout math** — the fixed offsets (header band height, party block Y positions, table start Y) were tuned through several rounds of visual bug-fixing (address text overlapping phone numbers, etc.) using real rendered PDFs, not guesses. If you need to change them, re-render and visually inspect the output (render to PNG via `pdftoppm`, don't just trust the code compiles).
- **RLS policies / tenant_id scoping** — see Multi-tenant section above. A "small tweak" here can leak one business's data into another's view.
- **`AGENTS.md`** — a Lovable-platform auto-generated stub about not rewriting git history on the connected branch; leave it alone, it's not project documentation.
- **`BACKEND_SPEC.md`** — **outdated**, describes a pre-Supabase, in-memory/localStorage prototype called "Prestige Invoice." It predates the entire multi-tenant/Supabase/WhatsApp build described in this document and does not reflect current reality. Don't use it as a reference; this ONBOARDING.md supersedes it.

## Environment / credentials

- `.env` is gitignored; real Supabase keys live only in the sandbox/VPS, not in git. `SUPABASE_SERVICE_ROLE_KEY` is intentionally **not** set in this environment — there is no way to run privileged DB operations (like the missing-bucket fix above) directly from here. SQL that needs to run against the live database gets **pasted as plain text for the owner to run themselves** in the Supabase SQL editor — the owner's device can't open file attachments, so literal pasted SQL in chat is the only reliable way to hand it off.
- Live login used for testing throughout this project: `chnaeemullah372@gmail.com` (ask the owner before assuming this still works — passwords can change).
- Test data convention: prefix anything created for live testing with `ZZZ_TEST` and clean it up afterward. Never modify real (non-test) tenant data without asking first.

## Working style the owner expects

- Live-test against production after non-trivial changes (Playwright is set up for this — see any `scratchpad/pw/*.mjs` scripts from past sessions for the login/proxy boilerplate pattern). Don't just say something works — show it.
- `npx tsc --noEmit -p .` and `npm run build` before considering any change done.
- The owner gives feedback in rounds and expects the *exact* thing they described, not a reasonable-sounding reinterpretation — when a screenshot or screen-recording is provided as a reference, match its actual structure, not just its general idea. If a request is genuinely ambiguous and no reference exists, ask a scoped clarifying question rather than guessing a second time.
- This is an actively evolving, long-running project — expect to pick up mid-stream, not to receive a clean, finished spec.
