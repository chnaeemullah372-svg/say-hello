import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { Customer, Product, Invoice, Payment, InvoiceItem, Estimate, SaleOrder, PurchaseOrder, Account, FundTransfer, DeliveryNote, SaleReturn, PurchaseReturn, ProductionEntry, Subscription, Commission, WhatsAppLog } from "./dummy-data";

type Store = {
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  payments: Payment[];
  estimates: Estimate[];
  saleOrders: SaleOrder[];
  purchaseOrders: PurchaseOrder[];
  accounts: Account[];
  fundTransfers: FundTransfer[];
  deliveryNotes: DeliveryNote[];
  saleReturns: SaleReturn[];
  purchaseReturns: PurchaseReturn[];
  productionEntries: ProductionEntry[];
  subscriptions: Subscription[];
  commissions: Commission[];
  whatsappLogs: WhatsAppLog[];
  loading: boolean;
  addCustomer: (c: Omit<Customer, "id" | "balance"> & { balance?: number }) => Promise<Customer>;
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>;
  addProduct: (p: Omit<Product, "id">) => Promise<Product>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  addInvoice: (i: Omit<Invoice, "id" | "number"> & { number?: string }) => Promise<Invoice>;
  addPayment: (p: Omit<Payment, "id">) => Promise<Payment>;
  updateInvoice: (id: string, patch: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  addEstimate: (e: Omit<Estimate, "id" | "number">) => Promise<Estimate>;
  updateEstimate: (id: string, patch: Partial<Estimate>) => Promise<void>;
  deleteEstimate: (id: string) => Promise<void>;
  addSaleOrder: (s: Omit<SaleOrder, "id" | "number">) => Promise<SaleOrder>;
  updateSaleOrder: (id: string, patch: Partial<SaleOrder>) => Promise<void>;
  deleteSaleOrder: (id: string) => Promise<void>;
  addPurchaseOrder: (p: Omit<PurchaseOrder, "id" | "number">) => Promise<PurchaseOrder>;
  updatePurchaseOrder: (id: string, patch: Partial<PurchaseOrder>) => Promise<void>;
  deletePurchaseOrder: (id: string) => Promise<void>;
  addAccount: (a: Omit<Account, "id" | "currentBalance">) => Promise<Account>;
  updateAccount: (id: string, patch: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addFundTransfer: (f: Omit<FundTransfer, "id">) => Promise<FundTransfer>;
  addDeliveryNote: (d: Omit<DeliveryNote, "id" | "number">) => Promise<DeliveryNote>;
  updateDeliveryNote: (id: string, patch: Partial<DeliveryNote>) => Promise<void>;
  deleteDeliveryNote: (id: string) => Promise<void>;
  addSaleReturn: (s: Omit<SaleReturn, "id" | "number">) => Promise<SaleReturn>;
  updateSaleReturn: (id: string, patch: Partial<SaleReturn>) => Promise<void>;
  deleteSaleReturn: (id: string) => Promise<void>;
  addPurchaseReturn: (p: Omit<PurchaseReturn, "id" | "number">) => Promise<PurchaseReturn>;
  updatePurchaseReturn: (id: string, patch: Partial<PurchaseReturn>) => Promise<void>;
  deletePurchaseReturn: (id: string) => Promise<void>;
  addProductionEntry: (p: Omit<ProductionEntry, "id" | "number">) => Promise<ProductionEntry>;
  updateProductionEntry: (id: string, patch: Partial<ProductionEntry>) => Promise<void>;
  deleteProductionEntry: (id: string) => Promise<void>;
  addSubscription: (s: Omit<Subscription, "id">) => Promise<Subscription>;
  updateSubscription: (id: string, patch: Partial<Subscription>) => Promise<void>;
  deleteSubscription: (id: string) => Promise<void>;
  addCommission: (c: Omit<Commission, "id">) => Promise<Commission>;
  updateCommission: (id: string, patch: Partial<Commission>) => Promise<void>;
  deleteCommission: (id: string) => Promise<void>;
  getCustomer: (id: string) => Customer | undefined;
  getInvoice: (id: string) => Invoice | undefined;
  refresh: () => Promise<void>;
};

const StoreCtx = createContext<Store | null>(null);

// ---- Row <-> app-shape mapping (DB is snake_case, the UI is camelCase) ----

function customerFromRow(row: any): Customer {
  return {
    id: row.id,
    partyType: (row.party_type as Customer["partyType"]) ?? "client",
    name: row.name,
    contactPerson: row.contact_person ?? undefined,
    phone: row.phone ?? "",
    phone2: row.phone2 ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    email: row.email ?? undefined,
    website: row.website ?? undefined,
    region: row.region ?? undefined,
    gstin: row.gstin ?? undefined,
    businessId: row.business_id ?? undefined,
    panNo: row.pan_no ?? undefined,
    address: row.address ?? undefined,
    pinCode: row.pin_code ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    country: row.country ?? undefined,
    shippingSameAsBilling: row.shipping_same_as_billing ?? true,
    shippingPinCode: row.shipping_pin_code ?? undefined,
    shippingCity: row.shipping_city ?? undefined,
    shippingState: row.shipping_state ?? undefined,
    shippingCountry: row.shipping_country ?? undefined,
    referralName: row.referral_name ?? undefined,
    referralPhone: row.referral_phone ?? undefined,
    referralEmail: row.referral_email ?? undefined,
    referralAddress: row.referral_address ?? undefined,
    maxCreditLimit: row.max_credit_limit != null ? Number(row.max_credit_limit) : undefined,
    paymentTerms: row.payment_terms ?? undefined,
    openingBalance: Number(row.opening_balance ?? 0),
    openingDate: row.opening_date ?? undefined,
    bankName: row.bank_name ?? undefined,
    payableTo: row.payable_to ?? undefined,
    bankAccountNo: row.bank_account_no ?? undefined,
    ifscCode: row.ifsc_code ?? undefined,
    upiId: row.upi_id ?? undefined,
    balance: Number(row.balance ?? 0),
    payableBalance: Number(row.payable_balance ?? 0),
  };
}

function productFromRow(row: any): Product {
  return {
    id: row.id,
    itemType: (row.item_type as Product["itemType"]) ?? "product",
    name: row.name,
    sku: row.sku ?? "",
    description: row.description ?? undefined,
    barcode: row.barcode ?? undefined,
    category: row.category ?? "",
    price: Number(row.price ?? 0),
    mrp: Number(row.mrp ?? 0),
    wholesaleRate: Number(row.wholesale_rate ?? 0),
    purchaseRate: Number(row.purchase_rate ?? 0),
    stock: Number(row.stock ?? 0),
    lowStockAt: Number(row.low_stock_at ?? 0),
    unit: row.unit ?? "pc",
    taxPct: Number(row.tax_pct ?? 0),
    multiUnit: row.multi_unit ?? false,
    openingStockDate: row.opening_stock_date ?? undefined,
    imageUrl: row.image_url ?? undefined,
    warehouse: row.warehouse ?? undefined,
  };
}

function invoiceFromRow(row: any): Invoice {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customer_id ?? "",
    date: row.date,
    dueDate: row.due_date ?? "",
    items: (row.items ?? []) as InvoiceItem[],
    taxRate: Number(row.tax_rate ?? 0),
    discountMode: (row.discount_mode as Invoice["discountMode"]) ?? "rate",
    discountValue: Number(row.discount_value ?? 0),
    shippingAmount: Number(row.shipping_amount ?? 0),
    shippingAddress: row.shipping_address ?? undefined,
    paid: Number(row.paid ?? 0),
    notes: row.notes ?? undefined,
    terms: row.terms ?? undefined,
    attachments: (row.attachments ?? []) as import("./dummy-data").InvoiceAttachment[],
    commissionPct: Number(row.commission_pct ?? 0),
    commissionAgent: row.commission_agent ?? undefined,
    status: row.status as Invoice["status"],
  };
}

function paymentFromRow(row: any): Payment {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number ?? "",
    customerName: row.customer_name ?? "",
    amount: Number(row.amount ?? 0),
    method: row.method as Payment["method"],
    date: row.date,
  };
}

function estimateFromRow(row: any): Estimate {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customer_id ?? "",
    date: row.date,
    validUntil: row.valid_until ?? "",
    items: (row.items ?? []) as InvoiceItem[],
    taxRate: Number(row.tax_rate ?? 0),
    discountMode: (row.discount_mode as Estimate["discountMode"]) ?? "rate",
    discountValue: Number(row.discount_value ?? 0),
    shippingAmount: Number(row.shipping_amount ?? 0),
    notes: row.notes ?? undefined,
    status: row.status as Estimate["status"],
  };
}

function saleOrderFromRow(row: any): SaleOrder {
  return {
    id: row.id,
    number: row.number,
    customerId: row.customer_id ?? "",
    date: row.date,
    deliveryDate: row.delivery_date ?? "",
    items: (row.items ?? []) as InvoiceItem[],
    taxRate: Number(row.tax_rate ?? 0),
    discountMode: (row.discount_mode as SaleOrder["discountMode"]) ?? "rate",
    discountValue: Number(row.discount_value ?? 0),
    shippingAmount: Number(row.shipping_amount ?? 0),
    notes: row.notes ?? undefined,
    status: row.status as SaleOrder["status"],
  };
}

function purchaseOrderFromRow(row: any): PurchaseOrder {
  return {
    id: row.id,
    number: row.number,
    supplierId: row.supplier_id ?? "",
    supplierName: row.supplier_name ?? "",
    date: row.date,
    items: (row.items ?? []) as InvoiceItem[],
    total: Number(row.total ?? 0),
    status: row.status as PurchaseOrder["status"],
  };
}

function accountFromRow(row: any): Account {
  return {
    id: row.id,
    name: row.name,
    accountType: (row.account_type as Account["accountType"]) ?? "payment",
    openingBalance: Number(row.opening_balance ?? 0),
    openingDate: row.opening_date,
    currentBalance: Number(row.current_balance ?? 0),
  };
}

function fundTransferFromRow(row: any): FundTransfer {
  return {
    id: row.id,
    fromAccountId: row.from_account_id ?? "",
    toAccountId: row.to_account_id ?? "",
    amount: Number(row.amount ?? 0),
    remarks: row.remarks ?? undefined,
    date: row.date,
  };
}

function deliveryNoteFromRow(row: any): DeliveryNote {
  return {
    id: row.id, number: row.number, customerId: row.customer_id ?? "", date: row.date,
    items: (row.items ?? []) as InvoiceItem[], notes: row.notes ?? undefined, status: row.status,
  };
}
function saleReturnFromRow(row: any): SaleReturn {
  return {
    id: row.id, number: row.number, customerId: row.customer_id ?? "", date: row.date,
    items: (row.items ?? []) as InvoiceItem[], total: Number(row.total ?? 0), notes: row.notes ?? undefined, status: row.status,
  };
}
function purchaseReturnFromRow(row: any): PurchaseReturn {
  return {
    id: row.id, number: row.number, supplierId: row.supplier_id ?? "", date: row.date,
    items: (row.items ?? []) as InvoiceItem[], total: Number(row.total ?? 0), notes: row.notes ?? undefined, status: row.status,
  };
}
function productionEntryFromRow(row: any): ProductionEntry {
  return {
    id: row.id, number: row.number, productName: row.product_name ?? "", date: row.date,
    items: (row.items ?? []) as InvoiceItem[], quantityProduced: Number(row.quantity_produced ?? 0),
    notes: row.notes ?? undefined, status: row.status,
  };
}
function subscriptionFromRow(row: any): Subscription {
  return {
    id: row.id, customerId: row.customer_id ?? "", planName: row.plan_name ?? "", amount: Number(row.amount ?? 0),
    billingCycle: row.billing_cycle ?? "monthly", status: row.status, nextBillingDate: row.next_billing_date ?? undefined,
  };
}
function commissionFromRow(row: any): Commission {
  return {
    id: row.id, agentName: row.agent_name ?? "", invoiceId: row.invoice_id ?? undefined,
    commission: Number(row.commission ?? 0), status: row.status, date: row.date,
  };
}

function whatsAppLogFromRow(row: any): WhatsAppLog {
  return {
    id: row.id, customerId: row.customer_id ?? undefined, customerName: row.customer_name ?? undefined,
    whatsappNumber: row.whatsapp_number, messageType: row.message_type, referenceId: row.reference_id ?? undefined,
    referenceNumber: row.reference_number ?? undefined, messageText: row.message_text ?? undefined,
    status: row.status, errorMessage: row.error_message ?? undefined, createdAt: row.created_at,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [saleOrders, setSaleOrders] = useState<SaleOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [fundTransfers, setFundTransfers] = useState<FundTransfer[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[]>([]);
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!isAuthenticated) {
      setCustomers([]); setProducts([]); setInvoices([]); setPayments([]);
      setEstimates([]); setSaleOrders([]); setPurchaseOrders([]);
      setAccounts([]); setFundTransfers([]);
      setDeliveryNotes([]); setSaleReturns([]); setPurchaseReturns([]); setProductionEntries([]);
      setSubscriptions([]); setCommissions([]);
      setWhatsappLogs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [c, p, i, pay, est, so, po, acc, ft, dn, sr, pr, pe, sub, com, wl] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("estimates").select("*").order("created_at", { ascending: false }),
      supabase.from("sale_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").order("created_at", { ascending: false }),
      supabase.from("fund_transfers").select("*").order("created_at", { ascending: false }),
      supabase.from("delivery_notes").select("*").order("created_at", { ascending: false }),
      supabase.from("sale_returns").select("*").order("created_at", { ascending: false }),
      supabase.from("purchase_returns").select("*").order("created_at", { ascending: false }),
      supabase.from("production_entries").select("*").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("*").order("created_at", { ascending: false }),
      supabase.from("commissions").select("*").order("created_at", { ascending: false }),
      supabase.from("whatsapp_logs").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (c.error) toast.error(`Could not load customers: ${c.error.message}`);
    if (p.error) toast.error(`Could not load products: ${p.error.message}`);
    if (i.error) toast.error(`Could not load invoices: ${i.error.message}`);
    if (pay.error) toast.error(`Could not load payments: ${pay.error.message}`);
    if (est.error) toast.error(`Could not load estimates: ${est.error.message}`);
    if (so.error) toast.error(`Could not load sale orders: ${so.error.message}`);
    if (po.error) toast.error(`Could not load purchase orders: ${po.error.message}`);
    if (acc.error) toast.error(`Could not load accounts: ${acc.error.message}`);
    if (ft.error) toast.error(`Could not load fund transfers: ${ft.error.message}`);
    if (dn.error) toast.error(`Could not load delivery notes: ${dn.error.message}`);
    if (sr.error) toast.error(`Could not load sale returns: ${sr.error.message}`);
    if (pr.error) toast.error(`Could not load purchase returns: ${pr.error.message}`);
    if (pe.error) toast.error(`Could not load production entries: ${pe.error.message}`);
    if (sub.error) toast.error(`Could not load subscriptions: ${sub.error.message}`);
    if (com.error) toast.error(`Could not load commissions: ${com.error.message}`);
    if (wl.error) toast.error(`Could not load WhatsApp logs: ${wl.error.message}`);
    setCustomers((c.data ?? []).map(customerFromRow));
    setProducts((p.data ?? []).map(productFromRow));
    setInvoices((i.data ?? []).map(invoiceFromRow));
    setPayments((pay.data ?? []).map(paymentFromRow));
    setEstimates((est.data ?? []).map(estimateFromRow));
    setSaleOrders((so.data ?? []).map(saleOrderFromRow));
    setPurchaseOrders((po.data ?? []).map(purchaseOrderFromRow));
    setAccounts((acc.data ?? []).map(accountFromRow));
    setFundTransfers((ft.data ?? []).map(fundTransferFromRow));
    setDeliveryNotes((dn.data ?? []).map(deliveryNoteFromRow));
    setSaleReturns((sr.data ?? []).map(saleReturnFromRow));
    setPurchaseReturns((pr.data ?? []).map(purchaseReturnFromRow));
    setProductionEntries((pe.data ?? []).map(productionEntryFromRow));
    setSubscriptions((sub.data ?? []).map(subscriptionFromRow));
    setCommissions((com.data ?? []).map(commissionFromRow));
    setWhatsappLogs((wl.data ?? []).map(whatsAppLogFromRow));
    setLoading(false);
  };

  useEffect(() => {
    if (ready) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAuthenticated]);

  const value = useMemo<Store>(() => ({
    customers, products, invoices, payments, estimates, saleOrders, purchaseOrders, accounts, fundTransfers,
    deliveryNotes, saleReturns, purchaseReturns, productionEntries, subscriptions, commissions, whatsappLogs, loading, refresh,

    addCustomer: async (c) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("customers").insert({
        party_type: c.partyType ?? "client",
        name: c.name,
        contact_person: c.contactPerson || null,
        phone: c.phone || null,
        phone2: c.phone2 || null,
        whatsapp: c.whatsapp || null,
        email: c.email || null,
        website: c.website || null,
        region: c.region || null,
        gstin: c.gstin || null,
        business_id: c.businessId || null,
        pan_no: c.panNo || null,
        address: c.address || null,
        pin_code: c.pinCode || null,
        city: c.city || null,
        state: c.state || null,
        country: c.country || null,
        shipping_same_as_billing: c.shippingSameAsBilling ?? true,
        shipping_pin_code: c.shippingPinCode || null,
        shipping_city: c.shippingCity || null,
        shipping_state: c.shippingState || null,
        shipping_country: c.shippingCountry || null,
        referral_name: c.referralName || null,
        referral_phone: c.referralPhone || null,
        referral_email: c.referralEmail || null,
        referral_address: c.referralAddress || null,
        max_credit_limit: c.maxCreditLimit ?? null,
        payment_terms: c.paymentTerms || "No Due Date",
        opening_balance: c.openingBalance ?? 0,
        opening_date: c.openingDate || new Date().toISOString().slice(0, 10),
        bank_name: c.bankName || null,
        payable_to: c.payableTo || null,
        bank_account_no: c.bankAccountNo || null,
        ifsc_code: c.ifscCode || null,
        upi_id: c.upiId || null,
        balance: c.balance ?? c.openingBalance ?? 0,
        payable_balance: c.payableBalance ?? 0,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save customer");
      const nc = customerFromRow(data);
      setCustomers((prev) => [nc, ...prev]);
      return nc;
    },

    updateCustomer: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.partyType !== undefined) dbPatch.party_type = patch.partyType;
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.contactPerson !== undefined) dbPatch.contact_person = patch.contactPerson || null;
      if (patch.phone !== undefined) dbPatch.phone = patch.phone || null;
      if (patch.phone2 !== undefined) dbPatch.phone2 = patch.phone2 || null;
      if (patch.whatsapp !== undefined) dbPatch.whatsapp = patch.whatsapp || null;
      if (patch.email !== undefined) dbPatch.email = patch.email || null;
      if (patch.website !== undefined) dbPatch.website = patch.website || null;
      if (patch.region !== undefined) dbPatch.region = patch.region || null;
      if (patch.gstin !== undefined) dbPatch.gstin = patch.gstin || null;
      if (patch.businessId !== undefined) dbPatch.business_id = patch.businessId || null;
      if (patch.panNo !== undefined) dbPatch.pan_no = patch.panNo || null;
      if (patch.address !== undefined) dbPatch.address = patch.address || null;
      if (patch.pinCode !== undefined) dbPatch.pin_code = patch.pinCode || null;
      if (patch.city !== undefined) dbPatch.city = patch.city || null;
      if (patch.state !== undefined) dbPatch.state = patch.state || null;
      if (patch.country !== undefined) dbPatch.country = patch.country || null;
      if (patch.shippingSameAsBilling !== undefined) dbPatch.shipping_same_as_billing = patch.shippingSameAsBilling;
      if (patch.shippingPinCode !== undefined) dbPatch.shipping_pin_code = patch.shippingPinCode || null;
      if (patch.shippingCity !== undefined) dbPatch.shipping_city = patch.shippingCity || null;
      if (patch.shippingState !== undefined) dbPatch.shipping_state = patch.shippingState || null;
      if (patch.shippingCountry !== undefined) dbPatch.shipping_country = patch.shippingCountry || null;
      if (patch.referralName !== undefined) dbPatch.referral_name = patch.referralName || null;
      if (patch.referralPhone !== undefined) dbPatch.referral_phone = patch.referralPhone || null;
      if (patch.referralEmail !== undefined) dbPatch.referral_email = patch.referralEmail || null;
      if (patch.referralAddress !== undefined) dbPatch.referral_address = patch.referralAddress || null;
      if (patch.maxCreditLimit !== undefined) dbPatch.max_credit_limit = patch.maxCreditLimit ?? null;
      if (patch.paymentTerms !== undefined) dbPatch.payment_terms = patch.paymentTerms;
      if (patch.openingBalance !== undefined) dbPatch.opening_balance = patch.openingBalance;
      if (patch.openingDate !== undefined) dbPatch.opening_date = patch.openingDate;
      if (patch.bankName !== undefined) dbPatch.bank_name = patch.bankName || null;
      if (patch.payableTo !== undefined) dbPatch.payable_to = patch.payableTo || null;
      if (patch.bankAccountNo !== undefined) dbPatch.bank_account_no = patch.bankAccountNo || null;
      if (patch.ifscCode !== undefined) dbPatch.ifsc_code = patch.ifscCode || null;
      if (patch.upiId !== undefined) dbPatch.upi_id = patch.upiId || null;
      if (patch.balance !== undefined) dbPatch.balance = patch.balance;
      if (patch.payableBalance !== undefined) dbPatch.payable_balance = patch.payableBalance;
      const { data, error } = await supabase.from("customers").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) {
        const updated = customerFromRow(data);
        setCustomers((prev) => prev.map((c) => (c.id === id ? updated : c)));
      }
    },

    addProduct: async (p) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("products").insert({
        item_type: p.itemType ?? "product",
        name: p.name,
        sku: p.sku || null,
        description: p.description || null,
        barcode: p.barcode || null,
        category: p.category || null,
        price: p.price,
        mrp: p.mrp ?? 0,
        wholesale_rate: p.wholesaleRate ?? 0,
        purchase_rate: p.purchaseRate ?? 0,
        stock: p.stock,
        low_stock_at: p.lowStockAt,
        unit: p.unit || "pc",
        tax_pct: p.taxPct ?? 0,
        multi_unit: p.multiUnit ?? false,
        opening_stock_date: p.openingStockDate || undefined,
        image_url: p.imageUrl || null,
        warehouse: p.warehouse || null,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save product");
      const np = productFromRow(data);
      setProducts((prev) => [np, ...prev]);
      return np;
    },

    updateProduct: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.itemType !== undefined) dbPatch.item_type = patch.itemType;
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.sku !== undefined) dbPatch.sku = patch.sku || null;
      if (patch.description !== undefined) dbPatch.description = patch.description || null;
      if (patch.barcode !== undefined) dbPatch.barcode = patch.barcode || null;
      if (patch.category !== undefined) dbPatch.category = patch.category || null;
      if (patch.price !== undefined) dbPatch.price = patch.price;
      if (patch.mrp !== undefined) dbPatch.mrp = patch.mrp;
      if (patch.wholesaleRate !== undefined) dbPatch.wholesale_rate = patch.wholesaleRate;
      if (patch.purchaseRate !== undefined) dbPatch.purchase_rate = patch.purchaseRate;
      if (patch.stock !== undefined) dbPatch.stock = patch.stock;
      if (patch.lowStockAt !== undefined) dbPatch.low_stock_at = patch.lowStockAt;
      if (patch.unit !== undefined) dbPatch.unit = patch.unit;
      if (patch.taxPct !== undefined) dbPatch.tax_pct = patch.taxPct;
      if (patch.multiUnit !== undefined) dbPatch.multi_unit = patch.multiUnit;
      if (patch.openingStockDate !== undefined) dbPatch.opening_stock_date = patch.openingStockDate;
      if (patch.imageUrl !== undefined) dbPatch.image_url = patch.imageUrl || null;
      if (patch.warehouse !== undefined) dbPatch.warehouse = patch.warehouse || null;
      const { data, error } = await supabase.from("products").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) {
        const updated = productFromRow(data);
        setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
    },

    addInvoice: async (i) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("invoices").insert({
        ...(i.number ? { number: i.number } : {}),
        customer_id: i.customerId || null,
        date: i.date,
        due_date: i.dueDate || null,
        items: i.items as unknown as import("@/integrations/supabase/types").Json,
        tax_rate: i.taxRate,
        discount_mode: i.discountMode ?? "rate",
        discount_value: i.discountValue ?? 0,
        shipping_amount: i.shippingAmount ?? 0,
        shipping_address: i.shippingAddress || null,
        paid: i.paid,
        notes: i.notes || null,
        terms: i.terms || null,
        attachments: (i.attachments ?? []) as unknown as import("@/integrations/supabase/types").Json,
        commission_pct: i.commissionPct ?? 0,
        commission_agent: i.commissionAgent || null,
        status: i.status,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save invoice");
      const ni = invoiceFromRow(data);
      setInvoices((prev) => [ni, ...prev]);
      return ni;
    },

    addPayment: async (p) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("payments").insert({
        invoice_number: p.invoiceNumber,
        customer_name: p.customerName,
        amount: p.amount,
        method: p.method,
        date: p.date,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not record payment");
      const np = paymentFromRow(data);
      setPayments((prev) => [np, ...prev]);
      return np;
    },

    updateInvoice: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.customerId !== undefined) dbPatch.customer_id = patch.customerId || null;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate || null;
      if (patch.items !== undefined) dbPatch.items = patch.items;
      if (patch.taxRate !== undefined) dbPatch.tax_rate = patch.taxRate;
      if (patch.discountMode !== undefined) dbPatch.discount_mode = patch.discountMode;
      if (patch.discountValue !== undefined) dbPatch.discount_value = patch.discountValue;
      if (patch.shippingAmount !== undefined) dbPatch.shipping_amount = patch.shippingAmount;
      if (patch.shippingAddress !== undefined) dbPatch.shipping_address = patch.shippingAddress || null;
      if (patch.paid !== undefined) dbPatch.paid = patch.paid;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.terms !== undefined) dbPatch.terms = patch.terms;
      if (patch.attachments !== undefined) dbPatch.attachments = patch.attachments;
      if (patch.commissionPct !== undefined) dbPatch.commission_pct = patch.commissionPct;
      if (patch.commissionAgent !== undefined) dbPatch.commission_agent = patch.commissionAgent;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      const { data, error } = await supabase.from("invoices").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) {
        const updated = invoiceFromRow(data);
        setInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
      }
    },

    deleteInvoice: async (id) => {
      const { error } = await supabase.from("invoices").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    },

    addEstimate: async (e) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("estimates").insert({
        customer_id: e.customerId || null,
        date: e.date,
        valid_until: e.validUntil || null,
        items: e.items as unknown as import("@/integrations/supabase/types").Json,
        tax_rate: e.taxRate,
        discount_mode: e.discountMode ?? "rate",
        discount_value: e.discountValue ?? 0,
        shipping_amount: e.shippingAmount ?? 0,
        notes: e.notes || null,
        status: e.status,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save estimate");
      const ne = estimateFromRow(data);
      setEstimates((prev) => [ne, ...prev]);
      return ne;
    },
    updateEstimate: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.customerId !== undefined) dbPatch.customer_id = patch.customerId || null;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.validUntil !== undefined) dbPatch.valid_until = patch.validUntil || null;
      if (patch.items !== undefined) dbPatch.items = patch.items;
      if (patch.taxRate !== undefined) dbPatch.tax_rate = patch.taxRate;
      if (patch.discountMode !== undefined) dbPatch.discount_mode = patch.discountMode;
      if (patch.discountValue !== undefined) dbPatch.discount_value = patch.discountValue;
      if (patch.shippingAmount !== undefined) dbPatch.shipping_amount = patch.shippingAmount;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      const { data, error } = await supabase.from("estimates").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) {
        const updated = estimateFromRow(data);
        setEstimates((prev) => prev.map((e) => (e.id === id ? updated : e)));
      }
    },
    deleteEstimate: async (id) => {
      const { error } = await supabase.from("estimates").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setEstimates((prev) => prev.filter((e) => e.id !== id));
    },

    addSaleOrder: async (s) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("sale_orders").insert({
        customer_id: s.customerId || null,
        date: s.date,
        delivery_date: s.deliveryDate || null,
        items: s.items as unknown as import("@/integrations/supabase/types").Json,
        tax_rate: s.taxRate,
        discount_mode: s.discountMode ?? "rate",
        discount_value: s.discountValue ?? 0,
        shipping_amount: s.shippingAmount ?? 0,
        notes: s.notes || null,
        status: s.status,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save sale order");
      const ns = saleOrderFromRow(data);
      setSaleOrders((prev) => [ns, ...prev]);
      return ns;
    },
    updateSaleOrder: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.customerId !== undefined) dbPatch.customer_id = patch.customerId || null;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.deliveryDate !== undefined) dbPatch.delivery_date = patch.deliveryDate || null;
      if (patch.items !== undefined) dbPatch.items = patch.items;
      if (patch.taxRate !== undefined) dbPatch.tax_rate = patch.taxRate;
      if (patch.discountMode !== undefined) dbPatch.discount_mode = patch.discountMode;
      if (patch.discountValue !== undefined) dbPatch.discount_value = patch.discountValue;
      if (patch.shippingAmount !== undefined) dbPatch.shipping_amount = patch.shippingAmount;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      const { data, error } = await supabase.from("sale_orders").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) {
        const updated = saleOrderFromRow(data);
        setSaleOrders((prev) => prev.map((s) => (s.id === id ? updated : s)));
      }
    },
    deleteSaleOrder: async (id) => {
      const { error } = await supabase.from("sale_orders").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setSaleOrders((prev) => prev.filter((s) => s.id !== id));
    },

    addPurchaseOrder: async (p) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("purchase_orders").insert({
        supplier_id: p.supplierId || null,
        supplier_name: p.supplierName,
        date: p.date,
        items: p.items as unknown as import("@/integrations/supabase/types").Json,
        total: p.total,
        status: p.status,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save purchase order");
      const np = purchaseOrderFromRow(data);
      setPurchaseOrders((prev) => [np, ...prev]);
      return np;
    },
    updatePurchaseOrder: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.supplierId !== undefined) dbPatch.supplier_id = patch.supplierId || null;
      if (patch.supplierName !== undefined) dbPatch.supplier_name = patch.supplierName;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.items !== undefined) dbPatch.items = patch.items;
      if (patch.total !== undefined) dbPatch.total = patch.total;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      const { data, error } = await supabase.from("purchase_orders").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) {
        const updated = purchaseOrderFromRow(data);
        setPurchaseOrders((prev) => prev.map((p) => (p.id === id ? updated : p)));
      }
    },
    deletePurchaseOrder: async (id) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setPurchaseOrders((prev) => prev.filter((p) => p.id !== id));
    },

    addAccount: async (a) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("accounts").insert({
        name: a.name,
        account_type: a.accountType,
        opening_balance: a.openingBalance,
        opening_date: a.openingDate,
        current_balance: a.openingBalance,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save account");
      const na = accountFromRow(data);
      setAccounts((prev) => [na, ...prev]);
      return na;
    },
    updateAccount: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.name !== undefined) dbPatch.name = patch.name;
      if (patch.accountType !== undefined) dbPatch.account_type = patch.accountType;
      if (patch.openingBalance !== undefined) dbPatch.opening_balance = patch.openingBalance;
      if (patch.openingDate !== undefined) dbPatch.opening_date = patch.openingDate;
      if (patch.currentBalance !== undefined) dbPatch.current_balance = patch.currentBalance;
      const { data, error } = await supabase.from("accounts").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) {
        const updated = accountFromRow(data);
        setAccounts((prev) => prev.map((a) => (a.id === id ? updated : a)));
      }
    },
    deleteAccount: async (id) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    },

    addFundTransfer: async (f) => {
      if (f.fromAccountId === f.toAccountId) throw new Error("From and To accounts must be different");
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("fund_transfers").insert({
        from_account_id: f.fromAccountId || null,
        to_account_id: f.toAccountId || null,
        amount: f.amount,
        remarks: f.remarks || null,
        date: f.date,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not record transfer");
      const nf = fundTransferFromRow(data);
      setFundTransfers((prev) => [nf, ...prev]);

      // Move the balance between the two accounts
      const from = accounts.find((a) => a.id === f.fromAccountId);
      const to = accounts.find((a) => a.id === f.toAccountId);
      if (from) {
        const { data: d1 } = await supabase.from("accounts").update({ current_balance: from.currentBalance - f.amount } as any).eq("id", from.id).select().single();
        if (d1) setAccounts((prev) => prev.map((a) => (a.id === from.id ? accountFromRow(d1) : a)));
      }
      if (to) {
        const { data: d2 } = await supabase.from("accounts").update({ current_balance: to.currentBalance + f.amount } as any).eq("id", to.id).select().single();
        if (d2) setAccounts((prev) => prev.map((a) => (a.id === to.id ? accountFromRow(d2) : a)));
      }
      return nf;
    },

    addDeliveryNote: async (d) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("delivery_notes").insert({
        customer_id: d.customerId || null, date: d.date, items: d.items as unknown as import("@/integrations/supabase/types").Json,
        notes: d.notes || null, status: d.status, created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save delivery note");
      const n = deliveryNoteFromRow(data);
      setDeliveryNotes((prev) => [n, ...prev]);
      return n;
    },
    updateDeliveryNote: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.customerId !== undefined) dbPatch.customer_id = patch.customerId || null;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.items !== undefined) dbPatch.items = patch.items;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      const { data, error } = await supabase.from("delivery_notes").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) setDeliveryNotes((prev) => prev.map((x) => (x.id === id ? deliveryNoteFromRow(data) : x)));
    },
    deleteDeliveryNote: async (id) => {
      const { error } = await supabase.from("delivery_notes").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setDeliveryNotes((prev) => prev.filter((x) => x.id !== id));
    },

    addSaleReturn: async (s) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("sale_returns").insert({
        customer_id: s.customerId || null, date: s.date, items: s.items as unknown as import("@/integrations/supabase/types").Json,
        total: s.total, notes: s.notes || null, status: s.status, created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save sale return");
      const n = saleReturnFromRow(data);
      setSaleReturns((prev) => [n, ...prev]);
      return n;
    },
    updateSaleReturn: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.customerId !== undefined) dbPatch.customer_id = patch.customerId || null;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.items !== undefined) dbPatch.items = patch.items;
      if (patch.total !== undefined) dbPatch.total = patch.total;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      const { data, error } = await supabase.from("sale_returns").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) setSaleReturns((prev) => prev.map((x) => (x.id === id ? saleReturnFromRow(data) : x)));
    },
    deleteSaleReturn: async (id) => {
      const { error } = await supabase.from("sale_returns").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setSaleReturns((prev) => prev.filter((x) => x.id !== id));
    },

    addPurchaseReturn: async (p) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("purchase_returns").insert({
        supplier_id: p.supplierId || null, date: p.date, items: p.items as unknown as import("@/integrations/supabase/types").Json,
        total: p.total, notes: p.notes || null, status: p.status, created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save purchase return");
      const n = purchaseReturnFromRow(data);
      setPurchaseReturns((prev) => [n, ...prev]);
      return n;
    },
    updatePurchaseReturn: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.supplierId !== undefined) dbPatch.supplier_id = patch.supplierId || null;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.items !== undefined) dbPatch.items = patch.items;
      if (patch.total !== undefined) dbPatch.total = patch.total;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      const { data, error } = await supabase.from("purchase_returns").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) setPurchaseReturns((prev) => prev.map((x) => (x.id === id ? purchaseReturnFromRow(data) : x)));
    },
    deletePurchaseReturn: async (id) => {
      const { error } = await supabase.from("purchase_returns").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setPurchaseReturns((prev) => prev.filter((x) => x.id !== id));
    },

    addProductionEntry: async (p) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("production_entries").insert({
        product_name: p.productName, date: p.date, items: p.items as unknown as import("@/integrations/supabase/types").Json,
        quantity_produced: p.quantityProduced, notes: p.notes || null, status: p.status, created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save production entry");
      const n = productionEntryFromRow(data);
      setProductionEntries((prev) => [n, ...prev]);
      return n;
    },
    updateProductionEntry: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.productName !== undefined) dbPatch.product_name = patch.productName;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      if (patch.items !== undefined) dbPatch.items = patch.items;
      if (patch.quantityProduced !== undefined) dbPatch.quantity_produced = patch.quantityProduced;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      const { data, error } = await supabase.from("production_entries").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) setProductionEntries((prev) => prev.map((x) => (x.id === id ? productionEntryFromRow(data) : x)));
    },
    deleteProductionEntry: async (id) => {
      const { error } = await supabase.from("production_entries").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setProductionEntries((prev) => prev.filter((x) => x.id !== id));
    },

    addSubscription: async (s) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("subscriptions").insert({
        customer_id: s.customerId || null, plan_name: s.planName, amount: s.amount,
        billing_cycle: s.billingCycle, status: s.status, next_billing_date: s.nextBillingDate || null,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save subscription");
      const n = subscriptionFromRow(data);
      setSubscriptions((prev) => [n, ...prev]);
      return n;
    },
    updateSubscription: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.customerId !== undefined) dbPatch.customer_id = patch.customerId || null;
      if (patch.planName !== undefined) dbPatch.plan_name = patch.planName;
      if (patch.amount !== undefined) dbPatch.amount = patch.amount;
      if (patch.billingCycle !== undefined) dbPatch.billing_cycle = patch.billingCycle;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.nextBillingDate !== undefined) dbPatch.next_billing_date = patch.nextBillingDate || null;
      const { data, error } = await supabase.from("subscriptions").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) setSubscriptions((prev) => prev.map((x) => (x.id === id ? subscriptionFromRow(data) : x)));
    },
    deleteSubscription: async (id) => {
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setSubscriptions((prev) => prev.filter((x) => x.id !== id));
    },

    addCommission: async (c) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("commissions").insert({
        agent_name: c.agentName, invoice_id: c.invoiceId || null, commission: c.commission,
        status: c.status, date: c.date, created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save commission");
      const n = commissionFromRow(data);
      setCommissions((prev) => [n, ...prev]);
      return n;
    },
    updateCommission: async (id, patch) => {
      const dbPatch: Record<string, unknown> = {};
      if (patch.agentName !== undefined) dbPatch.agent_name = patch.agentName;
      if (patch.invoiceId !== undefined) dbPatch.invoice_id = patch.invoiceId || null;
      if (patch.commission !== undefined) dbPatch.commission = patch.commission;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.date !== undefined) dbPatch.date = patch.date;
      const { data, error } = await supabase.from("commissions").update(dbPatch as any).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      if (data) setCommissions((prev) => prev.map((x) => (x.id === id ? commissionFromRow(data) : x)));
    },
    deleteCommission: async (id) => {
      const { error } = await supabase.from("commissions").delete().eq("id", id);
      if (error) throw new Error(error.message);
      setCommissions((prev) => prev.filter((x) => x.id !== id));
    },

    getCustomer: (id) => customers.find((c) => c.id === id),
    getInvoice: (id) => invoices.find((i) => i.id === id || i.number === id),
  }), [customers, products, invoices, payments, estimates, saleOrders, purchaseOrders, accounts, fundTransfers,
      deliveryNotes, saleReturns, purchaseReturns, productionEntries, subscriptions, commissions, whatsappLogs, loading]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}
