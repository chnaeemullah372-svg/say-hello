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
  addProduct: (p: Omit<Product, "id">) => Promise<Product>;
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
    name: row.name,
    phone: row.phone ?? "",
    whatsapp: row.whatsapp ?? undefined,
    email: row.email ?? undefined,
    gstin: row.gstin ?? undefined,
    address: row.address ?? undefined,
    referralName: row.referral_name ?? undefined,
    referralPhone: row.referral_phone ?? undefined,
    referralEmail: row.referral_email ?? undefined,
    referralAddress: row.referral_address ?? undefined,
    balance: Number(row.balance ?? 0),
  };
}

function productFromRow(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku ?? "",
    category: row.category ?? "",
    price: Number(row.price ?? 0),
    stock: Number(row.stock ?? 0),
    lowStockAt: Number(row.low_stock_at ?? 0),
    unit: row.unit ?? "pc",
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
        name: c.name,
        phone: c.phone || null,
        whatsapp: c.whatsapp || null,
        email: c.email || null,
        gstin: c.gstin || null,
        address: c.address || null,
        referral_name: c.referralName || null,
        referral_phone: c.referralPhone || null,
        referral_email: c.referralEmail || null,
        referral_address: c.referralAddress || null,
        balance: c.balance ?? 0,
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save customer");
      const nc = customerFromRow(data);
      setCustomers((prev) => [nc, ...prev]);
      return nc;
    },

    addProduct: async (p) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("products").insert({
        name: p.name,
        sku: p.sku || null,
        category: p.category || null,
        price: p.price,
        stock: p.stock,
        low_stock_at: p.lowStockAt,
        unit: p.unit || "pc",
        created_by: userData.user?.id,
      }).select().single();
      if (error || !data) throw new Error(error?.message || "Could not save product");
      const np = productFromRow(data);
      setProducts((prev) => [np, ...prev]);
      return np;
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
