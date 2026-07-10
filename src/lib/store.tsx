import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import type { Customer, Product, Invoice, Payment, InvoiceItem } from "./dummy-data";

type Store = {
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  payments: Payment[];
  loading: boolean;
  addCustomer: (c: Omit<Customer, "id" | "balance"> & { balance?: number }) => Promise<Customer>;
  updateCustomer: (id: string, patch: Partial<Customer>) => Promise<void>;
  addProduct: (p: Omit<Product, "id">) => Promise<Product>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  addInvoice: (i: Omit<Invoice, "id" | "number"> & { number?: string }) => Promise<Invoice>;
  addPayment: (p: Omit<Payment, "id">) => Promise<Payment>;
  updateInvoice: (id: string, patch: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
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
    paid: Number(row.paid ?? 0),
    notes: row.notes ?? undefined,
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

export function StoreProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, ready } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!isAuthenticated) {
      setCustomers([]); setProducts([]); setInvoices([]); setPayments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [c, p, i, pay] = await Promise.all([
      supabase.from("customers").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("invoices").select("*").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
    ]);
    if (c.error) toast.error(`Could not load customers: ${c.error.message}`);
    if (p.error) toast.error(`Could not load products: ${p.error.message}`);
    if (i.error) toast.error(`Could not load invoices: ${i.error.message}`);
    if (pay.error) toast.error(`Could not load payments: ${pay.error.message}`);
    setCustomers((c.data ?? []).map(customerFromRow));
    setProducts((p.data ?? []).map(productFromRow));
    setInvoices((i.data ?? []).map(invoiceFromRow));
    setPayments((pay.data ?? []).map(paymentFromRow));
    setLoading(false);
  };

  useEffect(() => {
    if (ready) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, isAuthenticated]);

  const value = useMemo<Store>(() => ({
    customers, products, invoices, payments, loading, refresh,

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
        balance: c.balance ?? 0,
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
        customer_id: i.customerId || null,
        date: i.date,
        due_date: i.dueDate || null,
        items: i.items as unknown as import("@/integrations/supabase/types").Json,
        tax_rate: i.taxRate,
        discount_mode: i.discountMode ?? "rate",
        discount_value: i.discountValue ?? 0,
        shipping_amount: i.shippingAmount ?? 0,
        paid: i.paid,
        notes: i.notes || null,
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
      if (patch.paid !== undefined) dbPatch.paid = patch.paid;
      if (patch.notes !== undefined) dbPatch.notes = patch.notes;
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

    getCustomer: (id) => customers.find((c) => c.id === id),
    getInvoice: (id) => invoices.find((i) => i.id === id || i.number === id),
  }), [customers, products, invoices, payments, loading]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}
