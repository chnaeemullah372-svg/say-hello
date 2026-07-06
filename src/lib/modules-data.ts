// Dummy data for the additional feature modules (frontend only).

export type Purchase = {
  id: string; number: string; supplier: string; date: string;
  amount: number; status: "received" | "pending" | "partial";
};

export type PurchaseOrder = {
  id: string; number: string; supplier: string; date: string;
  expected: string; amount: number; status: "open" | "received" | "cancelled";
};

export type Expense = {
  id: string; category: string; note: string; date: string;
  amount: number; method: "Cash" | "UPI" | "Card" | "Bank";
};

export type FundAccount = {
  id: string; name: string; type: "Bank" | "Cash" | "Wallet";
  currency: string; balance: number;
};

export type Subscription = {
  id: string; customer: string; plan: string; amount: number;
  cycle: "Monthly" | "Quarterly" | "Yearly"; nextBilling: string;
  status: "active" | "paused" | "cancelled";
};

export type Commission = {
  id: string; salesperson: string; period: string; sales: number;
  ratePct: number; commission: number; status: "pending" | "paid";
};

export type TeamMember = {
  id: string; name: string; email: string; role: "Owner" | "Manager" | "Cashier" | "Accountant";
  status: "active" | "invited"; lastActive: string;
};

export const suppliersSeed = [
  "Metro Wholesale", "Kavya Fabrics", "Sunrise Electronics",
  "Golden Grains Co.", "Prime Home Décor",
];

export const purchasesSeed: Purchase[] = [
  { id: "pur1", number: "PUR-2026-021", supplier: "Metro Wholesale", date: "2026-07-01", amount: 48500, status: "received" },
  { id: "pur2", number: "PUR-2026-020", supplier: "Kavya Fabrics", date: "2026-06-28", amount: 22800, status: "partial" },
  { id: "pur3", number: "PUR-2026-019", supplier: "Sunrise Electronics", date: "2026-06-24", amount: 91200, status: "received" },
  { id: "pur4", number: "PUR-2026-018", supplier: "Golden Grains Co.", date: "2026-06-20", amount: 15700, status: "pending" },
];

export const purchaseOrdersSeed: PurchaseOrder[] = [
  { id: "po1", number: "PO-2026-014", supplier: "Metro Wholesale", date: "2026-07-03", expected: "2026-07-10", amount: 62000, status: "open" },
  { id: "po2", number: "PO-2026-013", supplier: "Prime Home Décor", date: "2026-06-30", expected: "2026-07-07", amount: 34500, status: "received" },
  { id: "po3", number: "PO-2026-012", supplier: "Sunrise Electronics", date: "2026-06-27", expected: "2026-07-04", amount: 128000, status: "open" },
  { id: "po4", number: "PO-2026-011", supplier: "Kavya Fabrics", date: "2026-06-22", expected: "2026-06-29", amount: 9800, status: "cancelled" },
];

export const expensesSeed: Expense[] = [
  { id: "ex1", category: "Rent", note: "Shop rent — July", date: "2026-07-01", amount: 35000, method: "Bank" },
  { id: "ex2", category: "Utilities", note: "Electricity bill", date: "2026-07-02", amount: 4200, method: "UPI" },
  { id: "ex3", category: "Salaries", note: "Cashier — Amit", date: "2026-07-01", amount: 22000, method: "Bank" },
  { id: "ex4", category: "Marketing", note: "Instagram ads", date: "2026-06-29", amount: 5500, method: "Card" },
  { id: "ex5", category: "Supplies", note: "Packaging bags", date: "2026-06-27", amount: 1800, method: "Cash" },
];

export const fundsSeed: FundAccount[] = [
  { id: "f1", name: "HDFC Current A/c", type: "Bank", currency: "INR", balance: 482300 },
  { id: "f2", name: "ICICI Savings", type: "Bank", currency: "INR", balance: 128600 },
  { id: "f3", name: "Cash Drawer", type: "Cash", currency: "INR", balance: 18400 },
  { id: "f4", name: "Paytm Wallet", type: "Wallet", currency: "INR", balance: 6200 },
];

export const subscriptionsSeed: Subscription[] = [
  { id: "s1", customer: "Aarav Traders", plan: "Monthly stationery", amount: 4500, cycle: "Monthly", nextBilling: "2026-08-01", status: "active" },
  { id: "s2", customer: "Elite Furnishings", plan: "Cleaning supplies", amount: 12000, cycle: "Quarterly", nextBilling: "2026-09-15", status: "active" },
  { id: "s3", customer: "Fresh Mart Grocers", plan: "Weekly produce", amount: 8800, cycle: "Monthly", nextBilling: "2026-07-15", status: "paused" },
  { id: "s4", customer: "Bright Electronics", plan: "AMC — devices", amount: 24000, cycle: "Yearly", nextBilling: "2027-01-10", status: "active" },
];

export const commissionsSeed: Commission[] = [
  { id: "cm1", salesperson: "Priya Sharma", period: "Jun 2026", sales: 486000, ratePct: 4, commission: 19440, status: "paid" },
  { id: "cm2", salesperson: "Amit Verma", period: "Jun 2026", sales: 218000, ratePct: 3, commission: 6540, status: "paid" },
  { id: "cm3", salesperson: "Priya Sharma", period: "Jul 2026", sales: 132000, ratePct: 4, commission: 5280, status: "pending" },
  { id: "cm4", salesperson: "Amit Verma", period: "Jul 2026", sales: 74000, ratePct: 3, commission: 2220, status: "pending" },
];

export const teamSeed: TeamMember[] = [
  { id: "t1", name: "Rajesh Kumar", email: "owner@prestige.store", role: "Owner", status: "active", lastActive: "Just now" },
  { id: "t2", name: "Priya Sharma", email: "priya@prestige.store", role: "Manager", status: "active", lastActive: "2h ago" },
  { id: "t3", name: "Amit Verma", email: "amit@prestige.store", role: "Cashier", status: "active", lastActive: "Yesterday" },
  { id: "t4", name: "Neha Iyer", email: "neha@prestige.store", role: "Accountant", status: "invited", lastActive: "—" },
];

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  Owner: ["Full access", "Manage users", "View reports", "Delete records", "Change settings"],
  Manager: ["Create invoices", "Manage inventory", "View reports", "Manage customers"],
  Cashier: ["Create invoices", "Record payments", "View own reports"],
  Accountant: ["View invoices", "Manage expenses", "Reconcile funds", "View reports"],
};
