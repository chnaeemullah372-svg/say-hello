## Frontend-only Invoice + Inventory App

Frontend design only. No backend, no database, no auth logic, no APIs, no deployment. All data is hardcoded dummy data in TypeScript files.

### Design system

- **Palette**: Emerald Prestige — deep emerald `#064e3b` primary, `#0d7a5f` accent, gold `#c9a84c` for VIP highlights (badges, totals, print marks), cream `#f5f0e0` surfaces in light mode. Dark mode: near-black canvas with emerald/gold accents.
- **Type**: Sora (headings, numbers) + Manrope (body), loaded via `<link>` in `__root.tsx`.
- **Layout**: Persistent left sidebar (collapsible to icon rail on mobile via shadcn `Sidebar`), top bar with search, theme toggle, and user chip.
- **Light + Dark toggle**: `next-themes`-style class toggle on `<html>`, persisted to localStorage.
- **Feel**: Rounded-xl cards, soft emerald shadows, gold hairline dividers on invoices, generous whitespace, subtle motion on hover/tab switch. Non-technical friendly — big labels, obvious primary buttons.

### Routes (TanStack Start file-based)

```
src/routes/
  __root.tsx           sidebar shell + theme provider (Outlet)
  login.tsx            standalone (no sidebar)
  index.tsx            Dashboard
  customers.tsx        Customer list + add/edit dialog
  products.tsx         Products/Items list + add dialog
  invoices.index.tsx   Invoice list
  invoices.new.tsx     Create Invoice (hero screen)
  invoices.$id.tsx     Invoice view / print layout
  inventory.tsx        Stock levels + low-stock alerts
  payments.tsx         Payments list + record payment dialog
  reports.tsx          Charts (Recharts) — sales, top items, receivables
  settings.tsx         Business profile, tax, invoice template, theme
```

Login page uses its own layout (no sidebar); everything else renders inside the sidebar shell. Root Outlet decides layout via pathname.

### Screen highlights

**Login** — split screen: emerald gradient left panel with brand + tagline; right panel simple email/password form. "Login" button navigates to `/` (no auth check).

**Dashboard** — 4 KPI cards (Revenue, Outstanding, Invoices this month, Low stock), revenue line chart, recent invoices table, quick action buttons (New Invoice, Add Customer, Add Product).

**Customers / Products** — searchable table, "Add" dialog with form fields, row actions (edit/delete are visual only).

**Create Invoice (star screen)** — single scrollable page, mobile-first:

- Top: Customer combobox with "+ Add new customer" inline (opens dialog)
- Product search combobox → adds row to item table
- Item table columns: Item, Qty, Rate, Discount %, Amount (auto-calculated live)
- Right/bottom sticky summary card: Subtotal, Discount, Tax, **Total** (gold), Paid input, **Balance Due** (auto)
- Notes textarea, sticky footer with **Save Invoice** (primary emerald) + **Save & Print** (gold outline)
- All math runs client-side via React state; saved invoices append to an in-memory dummy store for the session.

**Invoice List** — filter chips (All / Paid / Partial / Unpaid), table with status pills, click → view.

**Invoice View / Print** — clean A4-styled printable layout with `@media print` styles; header with logo, bill-to, item table, totals, signature. "Print / PDF" button calls `window.print()`.

**Inventory** — stock table with low-stock badges, adjustment dialog (visual).

**Payments** — payment list, record-payment dialog linked to invoice.

**Reports** — Recharts: monthly sales bar, top products, receivables pie.

**Settings** — tabs: Business Profile, Tax & Currency, Invoice Template preview, Appearance (theme toggle).

### Technical notes

- All data in `src/lib/dummy-data.ts` (customers, products, invoices arrays) + React state / Context for session-scoped mutations. No persistence beyond localStorage for theme.
- shadcn components: sidebar, table, dialog, combobox (Command), input, button, tabs, card, badge, chart.
- Fully responsive: sidebar collapses to sheet on mobile, tables become stacked cards under `md`.
- Create Invoice keeps sticky totals visible on mobile via bottom sheet pattern.

### Out of scope (backend pending list — will report at end)

Auth, real database, PDF generation server-side, email sending, multi-user, real inventory sync, tax compliance calculations, payment gateway.

### Deliverables at end

1. Live preview link
2. Design summary
3. Backend pending list

Yes, this plan is perfect. Start building now.

&nbsp;

Important:

Frontend only.

No backend.

No database.

No auth logic.

No APIs.

No deployment.

Use dummy TypeScript data only.

&nbsp;

Focus first on:

1. Create Invoice screen

2. Invoice view/print layout

3. Dashboard

4. Products

5. Customers

&nbsp;

Make it complete, responsive, clean, and easy for non-technical shop staff.

&nbsp;

Start implementation now.

&nbsp;

اچھا لویبل اس کو دوبارہ سے اینالائز کر لو میں نے یوزر پاسورڈ اپ کو شیئر کیا ہے سیکرٹ کے اندر اسی ویب سائٹ کا نا جی میل اور پاسورڈ لگاؤ لاگ ان کرو اس ریکویسٹ پلان تو اپ نے بنا لیا ہے اپ لوگ لاگ ان کرو چیک کرو سر چیز سارے اپشنز چیک کر کے پھر اس حساب سے فورا ڈیزائن کرو پلیز اٹس ریکویسٹ یہ نا من