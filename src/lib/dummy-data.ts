export type PartyType = "client" | "supplier" | "both";

export type Customer = {
  id: string;
  partyType: PartyType;
  name: string;
  contactPerson?: string;
  phone: string;
  phone2?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  region?: string;
  gstin?: string;
  businessId?: string;
  panNo?: string;
  address?: string;
  pinCode?: string;
  city?: string;
  state?: string;
  country?: string;
  shippingSameAsBilling?: boolean;
  shippingPinCode?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingCountry?: string;
  referralName?: string;
  referralPhone?: string;
  referralEmail?: string;
  referralAddress?: string;
  maxCreditLimit?: number;
  paymentTerms?: string;
  openingBalance?: number;
  openingDate?: string;
  bankName?: string;
  payableTo?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  upiId?: string;
  balance: number; // outstanding they owe us (client side)
  payableBalance?: number; // outstanding we owe them (supplier side)
};


export type ItemType = "product" | "service" | "composite";

export type Product = {
  id: string;
  itemType: ItemType;
  name: string;
  sku: string;
  description?: string;
  barcode?: string;
  category: string;
  price: number; // sale rate
  mrp?: number;
  wholesaleRate?: number;
  purchaseRate?: number;
  stock: number;
  lowStockAt: number;
  unit: string;
  taxPct?: number;
  multiUnit?: boolean;
  openingStockDate?: string;
  imageUrl?: string;
  warehouse?: string;
};

export type InvoiceItem = {
  productId: string;
  name: string;
  qty: number;
  rate: number;
  discount: number; // %
};

export type InvoiceAttachment = { name: string; path: string; type: string };

export type Invoice = {
  id: string;
  number: string;
  customerId: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  taxRate: number; // %
  discountMode?: "rate" | "flat";
  discountValue?: number;
  shippingAmount?: number;
  shippingAddress?: string;
  paid: number;
  notes?: string;
  terms?: string;
  attachments?: InvoiceAttachment[];
  commissionPct?: number;
  commissionAgent?: string;
  status: "paid" | "partial" | "unpaid";
};

export type Payment = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  method: string;
  date: string;
};

export type AccountType = "payment" | "category";
export type Account = {
  id: string;
  name: string;
  accountType: AccountType;
  openingBalance: number;
  openingDate: string;
  currentBalance: number;
};

export type FundTransfer = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  remarks?: string;
  date: string;
};

export type WhatsAppLogStatus = "pending" | "sent" | "failed";
export type WhatsAppLog = {
  id: string;
  customerId?: string;
  customerName?: string;
  whatsappNumber: string;
  messageType: "invoice" | "due_reminder" | "order_status" | "other";
  referenceId?: string;
  referenceNumber?: string;
  messageText?: string;
  status: WhatsAppLogStatus;
  errorMessage?: string;
  createdAt: string;
};

export type EstimateStatus = "open" | "accepted" | "declined" | "expired";
export type Estimate = {
  id: string;
  number: string;
  customerId: string;
  date: string;
  validUntil: string;
  items: InvoiceItem[];
  taxRate: number;
  discountMode?: "rate" | "flat";
  discountValue?: number;
  shippingAmount?: number;
  notes?: string;
  status: EstimateStatus;
};

export type SaleOrderStatus = "booked" | "processing" | "completed" | "cancelled";
export type SaleOrder = {
  id: string;
  number: string;
  customerId: string;
  date: string;
  deliveryDate: string;
  items: InvoiceItem[];
  taxRate: number;
  discountMode?: "rate" | "flat";
  discountValue?: number;
  shippingAmount?: number;
  notes?: string;
  status: SaleOrderStatus;
};

export type PurchaseOrderStatus = "pending" | "received" | "cancelled";
export type PurchaseOrder = {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: InvoiceItem[];
  total: number;
  status: PurchaseOrderStatus;
};

export type DeliveryNoteStatus = "pending" | "delivered" | "cancelled";
export type DeliveryNote = {
  id: string;
  number: string;
  customerId: string;
  date: string;
  items: InvoiceItem[];
  notes?: string;
  status: DeliveryNoteStatus;
};

export type SaleReturnStatus = "pending" | "refunded" | "cancelled";
export type SaleReturn = {
  id: string;
  number: string;
  customerId: string;
  date: string;
  items: InvoiceItem[];
  total: number;
  notes?: string;
  status: SaleReturnStatus;
};

export type PurchaseReturnStatus = "pending" | "refunded" | "cancelled";
export type PurchaseReturn = {
  id: string;
  number: string;
  supplierId: string;
  date: string;
  items: InvoiceItem[];
  total: number;
  notes?: string;
  status: PurchaseReturnStatus;
};

export type ProductionEntryStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type ProductionEntry = {
  id: string;
  number: string;
  productName: string;
  date: string;
  items: InvoiceItem[];
  quantityProduced: number;
  notes?: string;
  status: ProductionEntryStatus;
};

export type SubscriptionStatus = "active" | "paused" | "cancelled";
export type Subscription = {
  id: string;
  customerId: string;
  planName: string;
  amount: number;
  billingCycle: "monthly" | "yearly";
  status: SubscriptionStatus;
  nextBillingDate?: string;
};

export type CommissionStatus = "pending" | "paid";
export type Commission = {
  id: string;
  agentName: string;
  invoiceId?: string;
  commission: number;
  status: CommissionStatus;
  date: string;
};

export const customersSeed: Customer[] = [
  { id: "c1", partyType: "client", name: "Aarav Traders", phone: "+91 98765 43210", email: "aarav@traders.in", gstin: "27AAAAA0000A1Z5", address: "Andheri West, Mumbai, MH", balance: 12500 },
  { id: "c2", partyType: "client", name: "Bright Electronics", phone: "+91 98111 22233", email: "sales@bright.in", gstin: "07BBBBB1111B2Z6", address: "Karol Bagh, New Delhi", balance: 0 },
  { id: "c3", partyType: "client", name: "Chennai Silks", phone: "+91 90000 33445", email: "billing@chennai-silks.in", address: "T Nagar, Chennai, TN", balance: 4800 },
  { id: "c4", partyType: "client", name: "Deepak & Sons", phone: "+91 99887 66554", email: "deepak@sons.co.in", gstin: "24CCCCC2222C3Z7", address: "Navrangpura, Ahmedabad, GJ", balance: 22300 },
  { id: "c5", partyType: "client", name: "Elite Furnishings", phone: "+91 97654 32100", email: "hello@elite.in", address: "Koramangala, Bengaluru, KA", balance: 0 },
  { id: "c6", partyType: "client", name: "Fresh Mart Grocers", phone: "+91 88990 11223", email: "orders@freshmart.in", address: "Sector 18, Noida, UP", balance: 1800 },
];

export const productsSeed: Product[] = [
  { id: "p1", itemType: "product", name: "Premium Cotton Shirt", sku: "SH-001", category: "Apparel", price: 1299, stock: 48, lowStockAt: 10, unit: "pc" },
  { id: "p2", itemType: "product", name: "Wireless Earbuds Pro", sku: "EL-104", category: "Electronics", price: 3499, stock: 6, lowStockAt: 10, unit: "pc" },
  { id: "p3", itemType: "product", name: "Basmati Rice 5kg", sku: "GR-050", category: "Grocery", price: 749, stock: 120, lowStockAt: 25, unit: "bag" },
  { id: "p4", itemType: "product", name: "Steel Water Bottle", sku: "HM-022", category: "Homeware", price: 499, stock: 3, lowStockAt: 10, unit: "pc" },
  { id: "p5", itemType: "product", name: "Office Chair Deluxe", sku: "FN-311", category: "Furniture", price: 8999, stock: 14, lowStockAt: 5, unit: "pc" },
  { id: "p6", itemType: "product", name: "LED Desk Lamp", sku: "EL-207", category: "Electronics", price: 1899, stock: 22, lowStockAt: 8, unit: "pc" },
  { id: "p7", itemType: "product", name: "Leather Wallet", sku: "AC-088", category: "Accessories", price: 1499, stock: 35, lowStockAt: 10, unit: "pc" },
  { id: "p8", itemType: "product", name: "Organic Green Tea 250g", sku: "GR-090", category: "Grocery", price: 349, stock: 60, lowStockAt: 15, unit: "box" },
];

export const invoicesSeed: Invoice[] = [
  {
    id: "i1", number: "INV-2026-0142", customerId: "c1", date: "2026-07-01", dueDate: "2026-07-15",
    items: [
      { productId: "p1", name: "Premium Cotton Shirt", qty: 5, rate: 1299, discount: 5 },
      { productId: "p7", name: "Leather Wallet", qty: 3, rate: 1499, discount: 0 },
    ],
    taxRate: 18, paid: 6000, status: "partial",
  },
  {
    id: "i2", number: "INV-2026-0141", customerId: "c2", date: "2026-06-28", dueDate: "2026-07-12",
    items: [{ productId: "p2", name: "Wireless Earbuds Pro", qty: 4, rate: 3499, discount: 10 }],
    taxRate: 18, paid: 14855, status: "paid",
  },
  {
    id: "i3", number: "INV-2026-0140", customerId: "c4", date: "2026-06-25", dueDate: "2026-07-09",
    items: [
      { productId: "p5", name: "Office Chair Deluxe", qty: 2, rate: 8999, discount: 0 },
      { productId: "p6", name: "LED Desk Lamp", qty: 4, rate: 1899, discount: 5 },
    ],
    taxRate: 18, paid: 0, status: "unpaid",
  },
  {
    id: "i4", number: "INV-2026-0139", customerId: "c3", date: "2026-06-22", dueDate: "2026-07-06",
    items: [{ productId: "p3", name: "Basmati Rice 5kg", qty: 20, rate: 749, discount: 3 }],
    taxRate: 5, paid: 10000, status: "partial",
  },
  {
    id: "i5", number: "INV-2026-0138", customerId: "c6", date: "2026-06-20", dueDate: "2026-07-04",
    items: [{ productId: "p8", name: "Organic Green Tea 250g", qty: 12, rate: 349, discount: 0 }],
    taxRate: 5, paid: 4398, status: "paid",
  },
];

export const paymentsSeed: Payment[] = [
  { id: "pay1", invoiceNumber: "INV-2026-0142", customerName: "Aarav Traders", amount: 6000, method: "UPI", date: "2026-07-02" },
  { id: "pay2", invoiceNumber: "INV-2026-0141", customerName: "Bright Electronics", amount: 14855, method: "Bank Transfer", date: "2026-06-29" },
  { id: "pay3", invoiceNumber: "INV-2026-0139", customerName: "Chennai Silks", amount: 10000, method: "Cash", date: "2026-06-23" },
  { id: "pay4", invoiceNumber: "INV-2026-0138", customerName: "Fresh Mart Grocers", amount: 4398, method: "UPI", date: "2026-06-21" },
];

export const monthlySales = [
  { month: "Jan", sales: 142000 },
  { month: "Feb", sales: 168000 },
  { month: "Mar", sales: 191000 },
  { month: "Apr", sales: 175000 },
  { month: "May", sales: 218000 },
  { month: "Jun", sales: 246000 },
  { month: "Jul", sales: 82000 },
];

export const topProducts = [
  { name: "Office Chair", value: 62000 },
  { name: "Earbuds Pro", value: 48000 },
  { name: "Cotton Shirt", value: 39000 },
  { name: "Basmati Rice", value: 22000 },
  { name: "Desk Lamp", value: 18000 },
];

export function calcInvoiceTotals(
  items: InvoiceItem[],
  taxRate: number,
  discountMode: "rate" | "flat" = "rate",
  discountValue = 0,
) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.rate, 0);
  const lineDiscount = items.reduce((s, it) => s + (it.qty * it.rate * it.discount) / 100, 0);
  const afterLineDiscount = subtotal - lineDiscount;
  // The invoice-level Discount-Rate/Flat field (set on the creation screen)
  // used to only affect the number shown while creating the invoice — once
  // saved, every other screen (the invoice view/print, Statement, Reports,
  // dashboards) recalculated from items alone and silently dropped it,
  // overstating the total by the discount amount everywhere else.
  const globalDiscount = discountMode === "rate" ? (afterLineDiscount * discountValue) / 100 : discountValue;
  const discount = lineDiscount + globalDiscount;
  const taxable = Math.max(0, afterLineDiscount - globalDiscount);
  const tax = (taxable * taxRate) / 100;
  const total = taxable + tax;
  return { subtotal, discount, tax, total };
}

// Currency symbol shown by fmt() below. Lives outside React so every
// existing `fmt(...)` call site — dozens of files — picks up the current
// Settings -> Tax & Discount -> Currency symbol without needing each one
// rewritten to a hook. Updated once on app load and again immediately
// whenever the Tax settings are saved (see AppShell.tsx / settings.tsx).
let currencySymbol = "Rs";
export function setCurrencySymbol(symbol: string) {
  if (symbol) currencySymbol = symbol;
}

export function fmt(n: number) {
  return `${currencySymbol} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
