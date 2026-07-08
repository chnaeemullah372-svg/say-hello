import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  customersSeed, productsSeed, invoicesSeed, paymentsSeed,
  type Customer, type Product, type Invoice, type Payment,
} from "./dummy-data";

type Store = {
  customers: Customer[];
  products: Product[];
  invoices: Invoice[];
  payments: Payment[];
  addCustomer: (c: Omit<Customer, "id" | "balance">) => Customer;
  addProduct: (p: Omit<Product, "id">) => Product;
  addInvoice: (i: Omit<Invoice, "id">) => Invoice;
  addPayment: (p: Omit<Payment, "id">) => void;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  getCustomer: (id: string) => Customer | undefined;
  getInvoice: (id: string) => Invoice | undefined;
};

const StoreCtx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(customersSeed);
  const [products, setProducts] = useState<Product[]>(productsSeed);
  const [invoices, setInvoices] = useState<Invoice[]>(invoicesSeed);
  const [payments, setPayments] = useState<Payment[]>(paymentsSeed);

  const value = useMemo<Store>(() => ({
    customers, products, invoices, payments,
    addCustomer: (c) => {
      const nc: Customer = { ...c, id: `c${Date.now()}`, balance: 0 };
      setCustomers((prev) => [nc, ...prev]);
      return nc;
    },
    addProduct: (p) => {
      const np: Product = { ...p, id: `p${Date.now()}` };
      setProducts((prev) => [np, ...prev]);
      return np;
    },
    addInvoice: (i) => {
      const ni: Invoice = { ...i, id: `i${Date.now()}` };
      setInvoices((prev) => [ni, ...prev]);
      return ni;
    },
    addPayment: (p) => {
      setPayments((prev) => [{ ...p, id: `pay${Date.now()}` }, ...prev]);
    },
    updateInvoice: (id, patch) => {
      setInvoices((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    },
    deleteInvoice: (id) => {
      setInvoices((prev) => prev.filter((i) => i.id !== id));
    },
    getCustomer: (id) => customers.find((c) => c.id === id),
    getInvoice: (id) => invoices.find((i) => i.id === id || i.number === id),
  }), [customers, products, invoices, payments]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const s = useContext(StoreCtx);
  if (!s) throw new Error("useStore must be used within StoreProvider");
  return s;
}
