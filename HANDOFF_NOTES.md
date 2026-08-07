# Handoff notes — CNVoice QA + UNI Invoice feature-gap analysis (in progress)

> Working doc for continuing this task in a fresh session (e.g. after switching to
> an environment with Full network access). Read this first, then continue from
> "Next steps" below — no need to re-investigate what's already listed here.

## Goal (two linked tasks, same repo)

1. **QA the live CNVoice app** (`https://cnvoice.es/`, this repo, "Prestige Invoice" /
   TanStack Start + Supabase): reproduce bugs, classify severity, add regression
   tests, fix Critical/High issues one at a time with verification. Deliverable:
   `QA_REPORT.md`.
2. **Feature/settings gap analysis against UNI Invoice** (`https://uniinvoice.co.in/`,
   a third-party reference app the user likes and wants CNVoice to reach parity
   with — functionally, not by copying source/assets). Deliverable:
   `FEATURE_GAP_ANALYSIS.md` and `SETTINGS_AUDIT.md`.

Explicit constraints from the user:
- Do **not** redesign/rewrite the app blindly, and do **not** blindly clone UNI
  Invoice's UI/code — independent implementation only, functional parity where it
  actually makes sense for this business.
- UNI Invoice is a reference, not automatically "correct" — call out its own UX/
  design flaws too instead of copying them.
- On the UNI Invoice account: it may hold real data. Only create obviously-named
  temporary test records (e.g. `ZZZ_TEST_DELETE_ME`) to observe what a
  toggle/setting actually does, and clean them up after.
- Fix order: Critical severity first, then High. Never mark something fixed
  without actually running its test + a browser check + full regression pass.

## Environment / access status (why this handoff exists)

- This repo's session was running in an environment whose network egress policy
  is an allowlist that does **not** include `uniinvoice.co.in` or `cnvoice.es`
  (confirmed via `curl` through the agent proxy → 403 at the proxy for both
  hosts, and even `www.google.com` — not a targeted block, just a locked-down
  allowlist). No browser automation against either live site was possible from
  that environment.
- User created a new Claude Code environment with **Network access = Full**
  to fix this. Continue this task in a session that uses that environment.
- Playwright (`npm i playwright`) was installed in a scratchpad dir in the old
  session — that scratchpad does **not** carry over to a new
  environment/container. Reinstall it fresh wherever this continues:
  `npm init -y && npm install playwright` in some scratch dir, and launch
  Chromium with `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`
  (pre-installed; do not run `playwright install`). If the new environment's
  proxy setup differs, check `/root/.ccr/README.md` and
  `curl -sS "$HTTPS_PROXY/__agentproxy/status"` before assuming network is broken.

## Credentials (NOT stored here on purpose — re-supply in chat)

- UNI Invoice: user already shared `chnaeemullah372@gmail.com` / a password in
  chat once (this file intentionally omits it — do not commit secrets to git).
  Ask the user to re-paste it in the new session.
- CNVoice (`cnvoice.es`): user said they'd self-signup and "use the one you
  already have" — but no CNVoice credentials were ever actually sent in this
  conversation. Still need to get these from the user.

## Findings already confirmed by reading CNVoice source (no browser needed) — feed these into QA_REPORT.md

All found by comparing `src/routes/invoices.new.tsx` (create-invoice screen math)
against `calcInvoiceTotals()` in `src/lib/dummy-data.ts:354` (the function every
*other* screen uses: Invoice View/Print, Invoices list, Statement, Reports,
Dashboard).

1. **[Critical] Shipping amount silently dropped everywhere except the create
   screen.** `invoices.new.tsx` adds `shippingAmount` into the Total shown while
   creating; `calcInvoiceTotals()` never adds it. Any invoice with a shipping
   charge shows a different (wrong, lower) total on View/Print/PDF/Invoices
   list/Statement/Reports/Dashboard than what was actually charged at creation.
2. **[High] Tax enabled/inclusive toggles aren't persisted.** `taxEnabled` /
   `taxInclusive` are local state only in `invoices.new.tsx`; the DB payload only
   stores `taxRate`. If a cashier types a tax % then disables Tax (or marks it
   inclusive) before saving, the invoice saves with `taxAmount = 0` at creation,
   but `calcInvoiceTotals()` later recomputes `taxable * taxRate / 100` on every
   view — a nonzero tax appears that was never actually charged.
3. **[Medium/High] "Preview" isn't a preview.** The bottom action bar's Preview
   button calls the same `save()` path as Save (`invoices.new.tsx` ~line 758) —
   it creates a real invoice (consumes a number) instead of a no-commit preview.
4. **[Medium] Invoice numbering race condition.** DB has an atomic sequence
   default (`invoice_number_seq`, see `supabase/migrations/20260728000000_
   bootstrap_schema.sql:235,342`), but if Settings → Prefix & Localization has a
   custom prefix configured, the app reads `app_settings.settings.numbering
   .invoiceNext`, computes the number client-side, inserts, then writes
   `invoiceNext + 1` back **after** the insert succeeds (`invoices.new.tsx`
   ~line 207-227) — non-atomic read-then-write. Two cashiers saving at the same
   moment can read the same `invoiceNext`; the second insert fails on the DB's
   `UNIQUE(number)` constraint.
5. **[Low/Medium] "Download PDF" doesn't generate a PDF** — calls `window.print()`,
   identical to the Print button (`invoices.$id.tsx` ~line 132). Misleading label.
6. **[Medium] Deleting an invoice doesn't reverse its side effects.**
   `deleteInvoice()` in `src/lib/store.tsx` only removes the invoice row; any
   Payment record, Commission record, or Account balance it created at save time
   stays behind as orphaned data.

Also noteworthy (not a bug, but corrects `BACKEND_SPEC.md` which says
"frontend-only prototype, all data in-memory"): `src/lib/store.tsx` is fully
wired to Supabase with real CRUD for customers, products, invoices, payments,
estimates, sale orders, purchase orders, accounts, fund transfers, delivery
notes, sale/purchase returns, production entries, subscriptions, commissions,
expenses, purchases. `BACKEND_SPEC.md` is stale — worth a note in the final
report, not a fix.

## Task list at time of handoff (recreate with TaskCreate in the new session; IDs won't carry over)

1. [in_progress] Deep-inspect existing codebase (auth, invoice calc, store, PDF,
   settings) — auth.tsx, store.tsx, invoices.new.tsx, invoices.$id.tsx,
   invoices.index.tsx, bootstrap_schema.sql all read. Still not read in depth:
   settings.tsx (beyond numbering/tax sections), payments.tsx, reports.tsx,
   statement.tsx, customers.tsx, products.tsx, inventory.tsx, dashboard
   (index.tsx), team.tsx, whatsapp-logs.tsx.
2. [completed] Playwright harness set up (needs redoing in new environment, see above).
3. [pending] Get CNVoice test credentials from user.
4. [pending] Systematically test every page/workflow on cnvoice.es (Dashboard,
   Customers, Products, Create/Edit/Delete invoice, tax/discount/totals, invoice
   numbering, save/draft, payments, search/filters, PDF/print, settings,
   logout/session, validation, mobile/responsive).
5. [pending] Write QA_REPORT.md (repro steps, likely code, severity, regression
   test per issue) — fold in the 6 findings above plus whatever live testing adds.
6. [pending] Add automated regression tests per issue.
7. [pending] Fix Critical severity issues one by one (test → browser-verify →
   full regression → confirm nothing else broke, before marking fixed).
8. [pending] Fix High severity issues one by one (same process).
9. [pending] Explore UNI Invoice systematically via Playwright — log in, confirm
   which modules/settings are reachable for this account (report locked-off
   areas immediately), then walk every module and every Settings sub-page/
   toggle/dropdown. Use ZZZ_TEST_DELETE_ME-style records to verify what a
   setting actually does; clean up after.
10. [pending] Re-inspect CNVoice module-by-module/setting-by-setting (combine
    live browser + already-read source) for the same comparison.
11. [pending] Write SETTINGS_AUDIT.md — option-by-option: what it does / why it
    exists / where stored / dependent modules / new-vs-existing-record effect /
    CNVoice equivalent status / correctness / recommendation.
12. [pending] Write FEATURE_GAP_ANALYSIS.md — per module: Reference Feature /
    Current CNVoice State / Status (MATCHED/PARTIAL/MISSING/DIFFERENT BY DESIGN/
    BROKEN/NEEDS DECISION) / Recommendation / Priority / Test Required.

Order agreed with the user for the *analysis*: explore UNI Invoice first (confirm
login + accessible modules, report back before going deep), map its
features/settings, then inspect/compare CNVoice, generate ideas, challenge them,
then write the two gap-analysis docs — no coding changes until that mapping is
done. The QA-and-fix track (tasks 3-8) and the gap-analysis track (tasks 9-12)
were both opened; user paused the fix track to prioritize the reference
comparison, but neither track is abandoned.

## Next steps (do these in order)

1. Confirm the new session's environment actually has working network access to
   both `uniinvoice.co.in` and `cnvoice.es` (quick `curl` check before spinning
   up Playwright).
2. Get UNI Invoice + CNVoice credentials from the user (re-ask; not stored here).
3. Log into UNI Invoice, report back which modules/settings are reachable for
   this account before going deep (user explicitly asked for this checkpoint).
4. Proceed with the systematic UNI Invoice crawl → CNVoice comparison → the two
   markdown deliverables, per the workflow the user specified (explore → map →
   inspect → compare → ideate → challenge → define → gaps → prioritize → *then*
   propose implementation, no coding yet).
