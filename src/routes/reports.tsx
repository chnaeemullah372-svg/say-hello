import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmt, calcInvoiceTotals, type Customer, type Invoice, type Purchase, type Product, type Expense, type Payment, type SaleOrder, type SaleReturn, type PurchaseReturn, type Commission } from "@/lib/dummy-data";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStore } from "@/lib/store";
import { ChevronRight, FileSpreadsheet, Printer, Search } from "lucide-react";

export const Route = createFileRoute("/reports")({
  head: () => ({ meta: [
    { title: "Reports — CN Invoice" },
    { name: "description", content: "Sales, top products and receivables at a glance." },
  ]}),
  component: ReportsPage,
});

const colors = ["var(--color-primary)", "var(--color-accent)", "var(--color-gold)", "var(--color-chart-4)", "var(--color-chart-5)"];

const reportSections = [
  { title: "Sales", items: ["Sale / Purchase / Payment Report", "Gross & Net Sale Payment Report", "Overall Sales Report", "Outstanding Balance Report", "Unpaid Invoice Report", "Invoice Report", "Sale Order Report", "Sale Tax Report"] },
  { title: "Purchase", items: ["Sale / Purchase / Payment Report", "Gross & Net Purchase Payment Report", "Overall Purchase Report", "Unpaid Purchase Report", "Outstanding Payment Report", "Purchase Report", "Purchase Tax Report"] },
  { title: "Client Ledger / Transactions", items: ["Client Ledger / Transactions", "Client/Supplier Overall Report"] },
  { title: "Product", items: ["Inventory", "Product Report", "Product Sales Report", "Product Purchases Report"] },
  { title: "Other Reports", items: ["Payment Category Ledger / Transaction", "Expense Category Report", "Profit / Loss", "Product wise Profit / Loss", "Client wise Profit / Loss"] },
];

type ReportTable = { columns: string[]; rows: (string | number)[][]; total: number; dateFrom: string; dateTo: string };

function dateRange(dates: string[]): [string, string] {
  const valid = dates.filter(Boolean).sort();
  return valid.length ? [valid[0], valid[valid.length - 1]] : ["-", "-"];
}

function invoiceWithTotals(inv: Invoice) {
  const t = calcInvoiceTotals(inv.items, inv.taxRate, inv.discountMode, inv.discountValue, inv.shippingAmount);
  return { ...inv, ...t, balance: t.total - inv.paid };
}

// Builds the table + summary for one specific report, using real store data
// scoped to what that report's name actually means — previously every
// report (regardless of title) showed the same fake invoice snippet.
function buildReport(
  section: string,
  item: string,
  store: { invoices: Invoice[]; purchases: Purchase[]; customers: Customer[]; products: Product[]; expenses: Expense[]; payments: Payment[]; saleOrders: SaleOrder[]; saleReturns: SaleReturn[]; purchaseReturns: PurchaseReturn[]; commissions: Commission[] },
): ReportTable {
  const invoices = store.invoices.map(invoiceWithTotals);
  const customerName = (id?: string) => store.customers.find((c) => c.id === id)?.name ?? "-";

  const invoiceTable = (rows: typeof invoices, label = "Amount"): ReportTable => ({
    columns: ["Invoice #", "Customer", "Date", label, "Balance"],
    rows: rows.map((i) => [i.number, customerName(i.customerId), i.date, fmt(i.total), fmt(i.balance)]),
    total: rows.reduce((s, i) => s + i.total, 0),
    ...(() => { const [from, to] = dateRange(rows.map((i) => i.date)); return { dateFrom: from, dateTo: to }; })(),
  });

  const purchaseTable = (rows: Purchase[]): ReportTable => ({
    columns: ["Purchase #", "Supplier", "Date", "Total", "Paid", "Balance"],
    rows: rows.map((p) => [p.id.slice(0, 8), p.supplierName, p.date, fmt(p.total), fmt(p.paid), fmt(p.total - p.paid)]),
    total: rows.reduce((s, p) => s + p.total, 0),
    ...(() => { const [from, to] = dateRange(rows.map((p) => p.date)); return { dateFrom: from, dateTo: to }; })(),
  });

  switch (`${section}::${item}`) {
    case "Sales::Sale / Purchase / Payment Report":
    case "Sales::Overall Sales Report":
    case "Sales::Invoice Report":
      return invoiceTable(invoices);

    case "Sales::Gross & Net Sale Payment Report": {
      const rows = invoices;
      return {
        columns: ["Invoice #", "Customer", "Gross (before tax)", "Tax", "Net (paid)"],
        rows: rows.map((i) => [i.number, customerName(i.customerId), fmt(i.subtotal), fmt(i.tax), fmt(i.paid)]),
        total: rows.reduce((s, i) => s + i.paid, 0),
        ...(() => { const [from, to] = dateRange(rows.map((i) => i.date)); return { dateFrom: from, dateTo: to }; })(),
      };
    }

    case "Sales::Outstanding Balance Report":
      return invoiceTable(invoices.filter((i) => i.balance > 0));

    case "Sales::Unpaid Invoice Report":
      return invoiceTable(invoices.filter((i) => i.paid === 0));

    case "Sales::Sale Order Report": {
      const rows = store.saleOrders;
      return {
        columns: ["Order #", "Customer", "Delivery Date", "Status", "Items"],
        rows: rows.map((s) => [s.number, customerName(s.customerId), s.deliveryDate, s.status, String(s.items.length)]),
        total: rows.length,
        ...(() => { const [from, to] = dateRange(rows.map((s) => s.date)); return { dateFrom: from, dateTo: to }; })(),
      };
    }

    case "Sales::Sale Tax Report": {
      const rows = invoices.filter((i) => i.taxRate > 0);
      return {
        columns: ["Invoice #", "Customer", "Date", "Tax Rate", "Tax Amount"],
        rows: rows.map((i) => [i.number, customerName(i.customerId), i.date, `${i.taxRate}%`, fmt(i.tax)]),
        total: rows.reduce((s, i) => s + i.tax, 0),
        ...(() => { const [from, to] = dateRange(rows.map((i) => i.date)); return { dateFrom: from, dateTo: to }; })(),
      };
    }

    case "Purchase::Sale / Purchase / Payment Report":
    case "Purchase::Overall Purchase Report":
    case "Purchase::Purchase Report":
    case "Purchase::Gross & Net Purchase Payment Report":
      return purchaseTable(store.purchases);

    case "Purchase::Unpaid Purchase Report":
      return purchaseTable(store.purchases.filter((p) => p.paid === 0));

    case "Purchase::Outstanding Payment Report":
      return purchaseTable(store.purchases.filter((p) => p.total - p.paid > 0));

    case "Purchase::Purchase Tax Report": {
      const rows = store.purchases.map((p) => {
        const taxable = p.items.reduce((s, it) => s + it.qty * it.rate * (1 - it.discount / 100), 0);
        return { ...p, taxable };
      });
      return {
        columns: ["Purchase #", "Supplier", "Date", "Taxable Amount", "Total"],
        rows: rows.map((p) => [p.id.slice(0, 8), p.supplierName, p.date, fmt(p.taxable), fmt(p.total)]),
        total: rows.reduce((s, p) => s + p.total, 0),
        ...(() => { const [from, to] = dateRange(rows.map((p) => p.date)); return { dateFrom: from, dateTo: to }; })(),
      };
    }

    case "Client Ledger / Transactions::Client Ledger / Transactions": {
      const rows = store.customers.filter((c) => c.partyType !== "supplier");
      return {
        columns: ["Client", "Phone", "Invoices", "Total Billed", "Balance"],
        rows: rows.map((c) => {
          const own = invoices.filter((i) => i.customerId === c.id);
          const billed = own.reduce((s, i) => s + i.total, 0);
          return [c.name, c.phone || "-", String(own.length), fmt(billed), fmt(c.balance)];
        }),
        total: rows.reduce((s, c) => s + c.balance, 0),
        dateFrom: "-", dateTo: "-",
      };
    }

    case "Client Ledger / Transactions::Client/Supplier Overall Report": {
      const rows = store.customers;
      return {
        columns: ["Name", "Type", "Region", "Balance", "Payable"],
        rows: rows.map((c) => [c.name, c.partyType, c.region || "-", fmt(c.balance), fmt(c.payableBalance ?? 0)]),
        total: rows.reduce((s, c) => s + c.balance, 0),
        dateFrom: "-", dateTo: "-",
      };
    }

    case "Product::Inventory":
      return {
        columns: ["Product", "SKU", "Stock", "Low Stock At", "Unit"],
        rows: store.products.map((p) => [p.name, p.sku, String(p.stock), String(p.lowStockAt), p.unit]),
        total: store.products.reduce((s, p) => s + p.stock, 0),
        dateFrom: "-", dateTo: "-",
      };

    case "Product::Product Report":
      return {
        columns: ["Product", "Category", "Sale Rate", "Purchase Rate", "Stock"],
        rows: store.products.map((p) => [p.name, p.category, fmt(p.price), fmt(p.purchaseRate ?? 0), String(p.stock)]),
        total: store.products.length,
        dateFrom: "-", dateTo: "-",
      };

    case "Product::Product Sales Report": {
      const sold = new Map<string, { qty: number; amount: number }>();
      for (const i of invoices) {
        for (const it of i.items) {
          const cur = sold.get(it.name) ?? { qty: 0, amount: 0 };
          cur.qty += it.qty;
          cur.amount += it.qty * it.rate * (1 - it.discount / 100);
          sold.set(it.name, cur);
        }
      }
      const rows = [...sold.entries()];
      return {
        columns: ["Product", "Qty Sold", "Sales Amount"],
        rows: rows.map(([name, v]) => [name, String(v.qty), fmt(v.amount)]),
        total: rows.reduce((s, [, v]) => s + v.amount, 0),
        ...(() => { const [from, to] = dateRange(invoices.map((i) => i.date)); return { dateFrom: from, dateTo: to }; })(),
      };
    }

    case "Product::Product Purchases Report": {
      const bought = new Map<string, { qty: number; amount: number }>();
      for (const p of store.purchases) {
        for (const it of p.items) {
          const cur = bought.get(it.name) ?? { qty: 0, amount: 0 };
          cur.qty += it.qty;
          cur.amount += it.qty * it.rate * (1 - it.discount / 100);
          bought.set(it.name, cur);
        }
      }
      const rows = [...bought.entries()];
      return {
        columns: ["Product", "Qty Purchased", "Purchase Amount"],
        rows: rows.map(([name, v]) => [name, String(v.qty), fmt(v.amount)]),
        total: rows.reduce((s, [, v]) => s + v.amount, 0),
        ...(() => { const [from, to] = dateRange(store.purchases.map((p) => p.date)); return { dateFrom: from, dateTo: to }; })(),
      };
    }

    case "Other Reports::Payment Category Ledger / Transaction": {
      const byMethod = new Map<string, number>();
      for (const p of store.payments) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
      const rows = [...byMethod.entries()];
      return {
        columns: ["Payment Method", "Total Received"],
        rows: rows.map(([method, amt]) => [method, fmt(amt)]),
        total: rows.reduce((s, [, amt]) => s + amt, 0),
        ...(() => { const [from, to] = dateRange(store.payments.map((p) => p.date)); return { dateFrom: from, dateTo: to }; })(),
      };
    }

    case "Other Reports::Expense Category Report": {
      const byCategory = new Map<string, number>();
      for (const e of store.expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
      const rows = [...byCategory.entries()];
      return {
        columns: ["Category", "Total Spent"],
        rows: rows.map(([cat, amt]) => [cat, fmt(amt)]),
        total: rows.reduce((s, [, amt]) => s + amt, 0),
        ...(() => { const [from, to] = dateRange(store.expenses.map((e) => e.date)); return { dateFrom: from, dateTo: to }; })(),
      };
    }

    case "Other Reports::Profit / Loss": {
      // Sales returns and commissions were never subtracted, and purchase
      // returns never added back — so any shop paying agent commissions or
      // processing returns saw a profit figure that was systematically
      // too high.
      const sales = invoices.reduce((s, i) => s + i.total, 0);
      const salesReturns = store.saleReturns.reduce((s, r) => s + r.total, 0);
      const purchaseCost = store.purchases.reduce((s, p) => s + p.total, 0);
      const purchaseReturns = store.purchaseReturns.reduce((s, r) => s + r.total, 0);
      const expenseCost = store.expenses.reduce((s, e) => s + e.amount, 0);
      const commissionCost = store.commissions.reduce((s, c) => s + c.commission, 0);
      const netSales = sales - salesReturns;
      const netPurchases = purchaseCost - purchaseReturns;
      const profit = netSales - netPurchases - expenseCost - commissionCost;
      return {
        columns: ["Line", "Amount"],
        rows: [
          ["Sales", fmt(sales)],
          ["Sales Returns", fmt(-salesReturns)],
          ["Purchases", fmt(-purchaseCost)],
          ["Purchase Returns", fmt(purchaseReturns)],
          ["Expenses", fmt(-expenseCost)],
          ["Commissions", fmt(-commissionCost)],
          ["Net Profit / Loss", fmt(profit)],
        ],
        total: profit,
        dateFrom: "-", dateTo: "-",
      };
    }

    case "Other Reports::Product wise Profit / Loss": {
      const byProduct = new Map<string, { revenue: number; cost: number }>();
      for (const i of invoices) {
        for (const it of i.items) {
          const cur = byProduct.get(it.name) ?? { revenue: 0, cost: 0 };
          const product = store.products.find((p) => p.name === it.name);
          cur.revenue += it.qty * it.rate * (1 - it.discount / 100);
          cur.cost += it.qty * (product?.purchaseRate ?? 0);
          byProduct.set(it.name, cur);
        }
      }
      const rows = [...byProduct.entries()];
      return {
        columns: ["Product", "Revenue", "Cost", "Profit / Loss"],
        rows: rows.map(([name, v]) => [name, fmt(v.revenue), fmt(v.cost), fmt(v.revenue - v.cost)]),
        total: rows.reduce((s, [, v]) => s + (v.revenue - v.cost), 0),
        dateFrom: "-", dateTo: "-",
      };
    }

    case "Other Reports::Client wise Profit / Loss": {
      // This used to show Billed/Collected/Outstanding with no cost or
      // margin at all despite the report's name, and a permanently
      // hardcoded 0 total regardless of the data shown.
      let grandProfit = 0;
      const rows = store.customers.filter((c) => c.partyType !== "supplier").map((c) => {
        const own = invoices.filter((i) => i.customerId === c.id);
        const revenue = own.reduce((s, i) => s + i.total, 0);
        const cost = own.reduce((s, i) => s + i.items.reduce((is, it) => {
          const product = store.products.find((p) => p.id === it.productId || p.name === it.name);
          return is + it.qty * (product?.purchaseRate ?? 0);
        }, 0), 0);
        const profit = revenue - cost;
        grandProfit += profit;
        return [c.name, fmt(revenue), fmt(cost), fmt(profit)];
      });
      return {
        columns: ["Client", "Billed", "Cost", "Profit / Loss"],
        rows,
        total: grandProfit,
        dateFrom: "-", dateTo: "-",
      };
    }

    default:
      return { columns: ["No data"], rows: [], total: 0, dateFrom: "-", dateTo: "-" };
  }
}

function ReportsPage() {
  const store = useStore();
  const [selectedReport, setSelectedReport] = useState<{ section: string; item: string } | null>(null);
  const invoices = store.invoices.map(invoiceWithTotals);
  const paid = invoices.reduce((s, i) => s + i.paid, 0);
  const outstanding = invoices.reduce((s, i) => s + i.balance, 0);
  const receivables = [
    { name: "Collected", value: paid },
    { name: "Outstanding", value: outstanding },
  ];
  const report = selectedReport ? buildReport(selectedReport.section, selectedReport.item, store) : null;

  // These two charts used to render from a hardcoded sample array shipped
  // with the app — the exact same numbers forever, regardless of anything
  // actually sold. Both are now grouped from real invoice data.
  const monthlySales = (() => {
    const byMonth = new Map<string, number>();
    for (const i of invoices) {
      const key = i.date.slice(0, 7); // YYYY-MM
      byMonth.set(key, (byMonth.get(key) ?? 0) + i.total);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, sales]) => ({ month: new Date(`${key}-01T00:00:00`).toLocaleDateString("en-US", { month: "short" }), sales }));
  })();

  const topProducts = (() => {
    const byProduct = new Map<string, number>();
    for (const i of store.invoices) {
      for (const it of i.items) {
        byProduct.set(it.name, (byProduct.get(it.name) ?? 0) + it.qty * it.rate * (1 - it.discount / 100));
      }
    }
    return [...byProduct.entries()]
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, sales]) => ({ name, sales }));
  })();

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Business performance snapshot" />

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">All business reports</span>
          </div>
          <div className="divide-y">
            {reportSections.map((section) => (
              <div key={section.title}>
                <div className="bg-muted/50 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{section.title}</div>
                {section.items.map((item) => (
                  <button key={`${section.title}-${item}`} type="button" onClick={() => setSelectedReport({ section: section.title, item })} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted/50">
                    <span className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4 text-primary" />{item}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-display">Monthly sales</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySales} margin={{ left: -8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="sales" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display">Top products</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProducts} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v/1000}k`} />
                <YAxis type="category" dataKey="name" stroke="var(--color-muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={100} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                <Bar dataKey="sales" fill="var(--color-accent)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-display">Receivables split</CardTitle></CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] items-center">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={receivables} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                    {receivables.map((_, i) => <Cell key={i} fill={colors[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-3 text-sm">
              {receivables.map((r, i) => (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-sm" style={{ background: colors[i] }} />
                  <span className="min-w-[120px] text-muted-foreground">{r.name}</span>
                  <span className="font-display text-lg font-bold">{fmt(r.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedReport} onOpenChange={(v) => !v && setSelectedReport(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{selectedReport?.item}</DialogTitle></DialogHeader>
          {report && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">From</div><div className="font-medium">{report.dateFrom}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">To</div><div className="font-medium">{report.dateTo}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="font-display font-bold text-primary">{fmt(report.total)}</div></CardContent></Card>
              </div>
              <div className="max-h-[50vh] overflow-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>{report.columns.map((c) => <th key={c} className="px-4 py-2 text-left first:text-left [&:not(:first-child)]:text-right">{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {report.rows.length === 0 && <tr><td colSpan={report.columns.length} className="px-4 py-6 text-center text-muted-foreground">No records yet</td></tr>}
                    {report.rows.map((row, i) => (
                      <tr key={i} className="border-t">
                        {row.map((cell, j) => <td key={j} className="px-4 py-2 [&:not(:first-child)]:text-right">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print</Button>
                <Button onClick={() => setSelectedReport(null)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
