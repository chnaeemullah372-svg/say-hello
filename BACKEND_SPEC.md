# Prestige Invoice — Backend Specification (Handoff to Backend Developer)

> **Status:** Frontend-only prototype. All data is in-memory (React state + `localStorage` for auth). This document lists every screen, action and data shape the backend must support so a developer can build it without re-reading the UI.

---

## 1. Tech expectations (recommended)

- REST or GraphQL, JSON bodies, JWT bearer auth.
- Multi-tenant: every table scoped by `business_id` (workspace).
- Timezone: store UTC, display in business locale (default `Asia/Kolkata`).
- Currency: default INR, but schema must allow multi-currency.

---

## 2. Authentication & Users

**Frontend right now:** hardcoded demo users in `src/lib/auth.tsx`, session in `localStorage` under `prestige_auth_user`.

**Demo credentials shown on `/login`:**

| Username | Password     | Role       |
| -------- | ------------ | ---------- |
| admin    | admin123     | Owner      |
| manager  | manager123   | Manager    |
| cashier  | cashier123   | Cashier    |

**Backend must provide:**

- `POST /auth/login` `{ username, password }` → `{ token, user }`
- `POST /auth/logout`
- `POST /auth/forgot-password` `{ email }`
- `POST /auth/reset-password` `{ token, newPassword }`
- `GET  /auth/me` → current user + role + permissions

**Password rules:** bcrypt/argon2 hash, min 8 chars, HIBP check recommended.

---

## 3. Roles & Permissions (RBAC)

Roles used by the UI: **Owner, Manager, Cashier, Accountant**. Defined in `src/lib/modules-data.ts → ROLE_PERMISSIONS`.

Recommended permission keys (backend can rename):

- `invoice.create`, `invoice.view`, `invoice.delete`
- `payment.record`
- `customer.manage`, `product.manage`, `inventory.manage`
- `purchase.manage`, `po.manage`, `expense.manage`
- `fund.manage`, `subscription.manage`, `commission.manage`
- `team.manage`, `settings.manage`, `reports.view`

Store roles in a **separate `user_roles` table** (never on the user/profile row) to avoid privilege escalation.

---

## 4. Modules → Endpoints → Data

Each module below maps 1:1 to a route in `src/routes/`.

### 4.1 Dashboard — `/`
Aggregated KPIs. No writes.
- `GET /dashboard/summary` → `{ revenue, outstanding, customerCount, lowStockCount, monthlySales[], recentInvoices[] }`

### 4.2 Customers — `/customers`
- `GET  /customers?search=&page=`
- `POST /customers` `{ name, phone, email, gstin?, address }`
- `PATCH /customers/:id`
- `DELETE /customers/:id`
- Fields: `id, name, phone, email, gstin?, address, balance` (balance = sum of unpaid invoices).

### 4.3 Products — `/products`
- CRUD `/products`
- Fields: `id, name, sku (unique), category, price, stock, lowStockAt, unit`.

### 4.4 Inventory — `/inventory`
- `GET /inventory` → same as products + movement history.
- `POST /inventory/adjustments` `{ productId, deltaQty, reason }`
- Auto-decrement stock when an invoice is saved; auto-increment on purchase received.

### 4.5 Invoices — `/invoices`, `/invoices/new`, `/invoices/:id`
- `GET  /invoices?status=&customerId=&from=&to=`
- `POST /invoices` — see body below
- `GET  /invoices/:id`
- `PATCH /invoices/:id` (edit unpaid only)
- `DELETE /invoices/:id`
- `GET  /invoices/:id/pdf` → PDF stream
- `POST /invoices/:id/email` `{ to, message }`

**Invoice body:**
```json
{
  "number": "INV-2026-0143",         // server can generate from sequence
  "customerId": "c1",
  "date": "2026-07-06",
  "dueDate": "2026-07-20",
  "items": [
    { "productId": "p1", "name": "…", "qty": 2, "rate": 1299, "discount": 5 }
  ],
  "taxRate": 18,
  "paid": 0,
  "notes": "Thank you for your business."
}
```
Server calculates: `subtotal, discount, taxable, tax, total, balance, status ∈ {paid, partial, unpaid}`.

**Invoice numbering:** per-business sequence, format `INV-YYYY-####`. Store in a `sequences` table to avoid gaps/races.

### 4.6 Payments — `/payments`
- `GET  /payments`
- `POST /payments` `{ invoiceId, amount, method, date, note? }` — updates invoice status + customer balance.
- `method ∈ { Cash, UPI, Card, Bank Transfer }` (extendable).

### 4.7 Purchases — `/purchases`
Supplier bills that increase stock.
- CRUD `/purchases`, fields: `id, number (PUR-YYYY-###), supplier, date, items[], amount, status ∈ {received, pending, partial}`.
- On `status = received`, increment `product.stock` for each line item.

### 4.8 Purchase Orders — `/purchase-orders`
- CRUD `/purchase-orders`, fields: `id, number (PO-YYYY-###), supplier, date, expected, items[], amount, status ∈ {open, received, cancelled}`.
- `POST /purchase-orders/:id/convert-to-purchase` → creates a Purchase and closes the PO.

### 4.9 Expenses — `/expenses`
- CRUD `/expenses`, fields: `id, category, note, date, amount, method`.
- Categories: seedable list (Rent, Utilities, Salaries, Marketing, Supplies, Other).

### 4.10 Fund Management — `/funds`
Bank / cash / wallet accounts.
- CRUD `/fund-accounts`, fields: `id, name, type ∈ {Bank, Cash, Wallet}, currency, balance`.
- `POST /fund-transfers` `{ fromId, toId, amount, date, note? }` — atomic double-entry.
- Payments and expenses should reference a `fundAccountId` so balances stay in sync.

### 4.11 Subscriptions — `/subscriptions`
Recurring invoices.
- CRUD `/subscriptions`, fields: `id, customerId, plan, amount, cycle ∈ {Monthly, Quarterly, Yearly}, nextBilling, status ∈ {active, paused, cancelled}`.
- Backend cron job: every day, generate invoices where `nextBilling <= today && status = active`, then advance `nextBilling` by cycle.

### 4.12 Commissions — `/commissions`
- `GET /commissions?period=`
- `POST /commissions/rules` `{ salespersonId, ratePct, appliesTo }`
- Backend calculates commission = `sum(invoice.total where salesperson = X in period) * ratePct`.
- `POST /commissions/:id/mark-paid`
- Fields: `id, salesperson, period, sales, ratePct, commission, status ∈ {pending, paid}`.

### 4.13 Team & Access — `/team`
- `GET  /team`
- `POST /team/invite` `{ email, role }` → sends email invite.
- `PATCH /team/:id` `{ role, status }`
- `DELETE /team/:id`
- Fields: `id, name, email, role, status ∈ {active, invited}, lastActive`.

### 4.14 Reports — `/reports`
- `GET /reports/sales?from=&to=&groupBy=day|week|month`
- `GET /reports/tax?from=&to=`
- `GET /reports/inventory-valuation`
- `GET /reports/customer-aging`
- Export as PDF/Excel/CSV.

### 4.15 Settings — `/settings`
- `GET/PATCH /settings/business` — name, logo, address, GSTIN, currency, invoice prefix.
- `GET/PATCH /settings/tax` — default tax rate, tax breakup (CGST/SGST/IGST).
- `GET/PATCH /settings/template` — invoice colors, footer text, terms.

---

## 5. Cross-cutting concerns

- **Audit log**: every mutation → `{ userId, action, entity, entityId, before, after, at }`.
- **Soft delete**: `deletedAt` on invoices/customers/products.
- **File uploads**: logo, product images, expense receipts → object storage (S3-compatible).
- **Notifications**: low-stock, overdue invoice, subscription renewed, PO expected today.
- **Multi-currency**: store `currency` on invoice + FX rate snapshot at creation.
- **Rate limit** auth endpoints, `/team/invite`, `/invoices/:id/email`.

---

## 6. Suggested table list

```
businesses, users, user_roles, sessions,
customers, products, inventory_movements,
invoices, invoice_items, payments,
purchases, purchase_items, purchase_orders, purchase_order_items,
expenses, expense_categories,
fund_accounts, fund_transfers,
subscriptions,
commission_rules, commissions,
team_invites,
audit_logs, sequences, settings, uploads
```

---

## 7. What the frontend already does (do NOT rebuild in FE)

- All screens, forms, validation UX, print stylesheet, theme toggle, responsive layouts.
- Client-side calculation of invoice totals (`calcInvoiceTotals` in `src/lib/dummy-data.ts`) — the server MUST re-run the same math authoritatively and reject client totals.
- Dummy seed data in `src/lib/dummy-data.ts` and `src/lib/modules-data.ts` — use it as sample fixtures when seeding a dev database.

---

## 8. Integration checklist for the backend dev

1. Wire `POST /auth/login` — replace the demo check in `src/lib/auth.tsx`.
2. Add an API client (`src/lib/api.ts`) that attaches the JWT.
3. Replace `StoreProvider` in-memory state with TanStack Query hooks per module.
4. Add server-generated invoice numbers (remove the client fallback in `invoices.new.tsx`).
5. Turn the "Demo only — backend pending" toast buttons into real mutations (Purchases, POs, Expenses, Funds, Subscriptions, Commissions, Team).
6. Enforce RBAC on the API and hide UI actions based on `me.permissions`.
