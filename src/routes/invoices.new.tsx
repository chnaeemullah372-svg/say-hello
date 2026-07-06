import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus, Trash2, Search, UserPlus, Save, Printer, Download, FileText,
  ChevronDown, X, Truck, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt, type InvoiceItem } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices/new")({
  head: () => ({ meta: [
    { title: "Create Invoice — Prestige Invoice" },
    { name: "description", content: "Create a professional invoice with line items, tax, discount, notes and payment." },
  ]}),
  component: CreateInvoice,
});

type ItemMode = "product" | "service" | "fixed";

function CreateInvoice() {
  const { customers, products, addCustomer, addInvoice, invoices } = useStore();
  const nextNumber = `INV-2026-${String(143 + Math.max(0, invoices.length - 5)).padStart(4, "0")}`;

  const [customerId, setCustomerId] = useState<string>("");
  const [shippingSame, setShippingSame] = useState(true);
  const [shippingAddress, setShippingAddress] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [mode, setMode] = useState<ItemMode>("product");
  const [discountRate, setDiscountRate] = useState(0); // extra invoice-level discount %
  const [cgst, setCgst] = useState(9);
  const [sgst, setSgst] = useState(9);
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [shippingAmount, setShippingAmount] = useState(0);
  const [paidAdvance, setPaidAdvance] = useState(0);
  const [paidNow, setPaidNow] = useState(0);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Payment is due within 30 days of the invoice date unless otherwise agreed in writing. Late payments are subject to a 1.5% monthly fee.");
  const [period, setPeriod] = useState("7");
  const [reference, setReference] = useState("EST-56");
  const [date] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

  const [custOpen, setCustOpen] = useState(false);
  const [addCustOpen, setAddCustOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", phone: "", email: "", address: "", gstin: "" });

  const taxRate = cgst + sgst;
  const base = useMemo(() => calcInvoiceTotals(items, taxRate), [items, taxRate]);
  const extraDiscount = (base.subtotal - base.discount) * (discountRate / 100);
  const taxable = base.subtotal - base.discount - extraDiscount;
  const taxAmount = taxInclusive ? 0 : (taxable * taxRate) / 100;
  const total = taxable + taxAmount + shippingAmount;
  const totalPaid = paidAdvance + paidNow;
  const balance = total - totalPaid;
  const customer = customers.find((c) => c.id === customerId);

  const addBlankLine = () =>
    setItems((prev) => [...prev, { productId: "", name: "", qty: 1, rate: 0, discount: 0 }]);

  const addProduct = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.productId === p.id);
      if (existing) return prev.map((it) => it.productId === p.id ? { ...it, qty: it.qty + 1 } : it);
      return [...prev, { productId: p.id, name: p.name, qty: 1, rate: p.price, discount: 0 }];
    });
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => {
    setItems([]); setPaidAdvance(0); setPaidNow(0); setNotes(""); setDiscountRate(0); setShippingAmount(0);
    toast.info("Form cleared");
  };

  const save = (opts: { print?: boolean } = {}) => {
    if (!customerId) return toast.error("Please select a client");
    if (!items.length) return toast.error("Add at least one item");
    const status = totalPaid >= total ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
    const inv = addInvoice({
      number: nextNumber, customerId, date, dueDate,
      items: items.filter(i => i.name), taxRate, paid: totalPaid,
      notes: [notes, terms].filter(Boolean).join("\n\n"), status,
    });
    toast.success(`Invoice ${inv.number} saved`);
    setTimeout(() => {
      window.location.href = opts.print ? `/invoices/${inv.id}?print=1` : `/invoices/${inv.id}`;
    }, 200);
  };

  const productForItem = (id: string) => products.find(p => p.id === id);

  return (
    <div className="-m-4 sm:-m-6 lg:-m-8 pb-32 lg:pb-6">
      {/* Sticky action bar (mimics uni: Print · Download · Delete · Return · Delivery Note · + New Invoice) */}
      <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-2 border-b bg-background/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-display text-sm font-semibold">INVOICE</span>
          <span className="hidden font-mono text-xs text-muted-foreground sm:inline">{nextNumber}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <ActionBtn icon={Printer} label="Print" onClick={() => save({ print: true })} />
          <ActionBtn icon={Download} label="Download" onClick={() => save({ print: true })} />
          <ActionBtn icon={RotateCcw} label="Reset" onClick={reset} />
          <ActionBtn icon={Truck} label="Delivery Note" onClick={() => toast.info("Demo only — backend pending")} />
          <Button size="sm" onClick={() => save()} className="ml-1 h-8 bg-accent hover:bg-accent/90">
            <Plus className="mr-1 h-3.5 w-3.5" />New Invoice
          </Button>
        </div>
      </div>

      <div className="grid gap-4 p-4 sm:p-6 lg:p-8">
        {/* Header block: Bill To / Shipping / Meta */}
        <section className="rounded-xl border bg-card">
          <div className="grid gap-x-6 gap-y-3 p-5 md:grid-cols-[1fr_1fr_260px]">
            {/* Bill To */}
            <div className="space-y-3">
              <FieldRow label="Client">
                <div className="flex gap-1.5">
                  <Popover open={custOpen} onOpenChange={setCustOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="h-9 min-w-0 flex-1 justify-between font-normal">
                        <span className="truncate">{customer ? customer.name : "Select client…"}</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search clients…" />
                        <CommandList>
                          <CommandEmpty>No clients found.</CommandEmpty>
                          <CommandGroup>
                            {customers.map((c) => (
                              <CommandItem key={c.id} value={c.name} onSelect={() => { setCustomerId(c.id); setCustOpen(false); }}>
                                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                  {c.name.split(" ").map(w => w[0]).slice(0,2).join("")}
                                </div>
                                <div className="ml-2 min-w-0">
                                  <div className="truncate text-sm">{c.name}</div>
                                  <div className="truncate text-xs text-muted-foreground">{c.phone}</div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setAddCustOpen(true)} aria-label="Add new client">
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </FieldRow>
              <FieldRow label="Address">
                <Input className="h-9" readOnly value={customer?.address || ""} placeholder="Client address…" />
              </FieldRow>
              <FieldRow label="Shipping Address">
                <div className="space-y-1.5">
                  <Input
                    className="h-9"
                    value={shippingSame ? (customer?.address || "") : shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    disabled={shippingSame}
                    placeholder="Ship to…"
                  />
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <input type="checkbox" className="h-3 w-3 accent-primary" checked={shippingSame} onChange={(e) => setShippingSame(e.target.checked)} />
                    Same as billing
                  </label>
                </div>
              </FieldRow>
              <FieldRow label="Old Balance">
                <Input className="h-9" readOnly value={fmt(customer?.balance ?? 0)} />
              </FieldRow>
            </div>

            {/* spacer col on md+ */}
            <div className="hidden md:block" />

            {/* Meta right column */}
            <div className="space-y-3 md:border-l md:pl-6">
              <FieldRow label="Invoice Number" inline>
                <Input className="h-9 font-mono text-sm" value={nextNumber} readOnly />
              </FieldRow>
              <FieldRow label="Period" inline>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["0", "7", "15", "30", "45", "60", "90"].map((d) => (
                      <SelectItem key={d} value={d}>{d === "0" ? "Due on receipt" : `${d} Days`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
              <FieldRow label="Due Date" inline>
                <Input className="h-9" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </FieldRow>
              <FieldRow label="Invoice Date" inline>
                <Input className="h-9" type="date" value={date} readOnly />
              </FieldRow>
              <FieldRow label="Reference" inline>
                <Input className="h-9" value={reference} onChange={(e) => setReference(e.target.value)} />
              </FieldRow>
            </div>
          </div>

          {/* Tabs: Product / Service / Fixed Amount */}
          <div className="flex items-center gap-1 border-t bg-muted/30 px-5 py-2">
            {(["product", "service", "fixed"] as ItemMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                  mode === m ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-background"
                }`}
              >
                {m === "product" ? "Product" : m === "service" ? "Service" : "Fixed Amount"}
              </button>
            ))}
            <div className="ml-auto text-[11px] text-muted-foreground">{items.length} line(s)</div>
          </div>

          {/* Items table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="border-b bg-muted/20 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="w-[34%] px-3 py-2.5 text-left font-semibold">Particular</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Product Code</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Quantity</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Rate</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Unit</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No items yet — click <span className="font-semibold text-accent">+ Add New Item</span> below.
                  </td></tr>
                )}
                {items.map((it, i) => {
                  const p = productForItem(it.productId);
                  const amt = it.qty * it.rate * (1 - it.discount / 100);
                  return (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <ItemNameCell
                          value={it.name}
                          onPick={(pid, name, rate) => updateItem(i, { productId: pid, name, rate })}
                          onType={(v) => updateItem(i, { name: v })}
                          mode={mode}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{p?.sku || "—"}</td>
                      <td className="px-3 py-2">
                        <Input type="number" min={0} value={it.qty} onChange={(e) => updateItem(i, { qty: Math.max(0, +e.target.value) })} className="h-8 text-right" />
                      </td>
                      <td className="px-3 py-2">
                        <Input type="number" min={0} value={it.rate} onChange={(e) => updateItem(i, { rate: Math.max(0, +e.target.value) })} className="h-8 text-right" />
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{p?.unit || "pc"}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmt(amt)}</td>
                      <td className="px-3 py-2 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(i)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add new item bar */}
          <div className="border-t bg-accent/5">
            <AddItemBar mode={mode} onProduct={addProduct} onBlank={addBlankLine} />
          </div>
        </section>

        {/* Notes + Terms (left) · Base Amount (right) */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <section className="rounded-xl border bg-card p-5">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Notes</div>
              <Textarea rows={3} className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Write your notes…" />
            </section>
            <section className="rounded-xl border bg-card p-5">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Terms & Condition</div>
              <div className="mt-2 rounded-md bg-muted/40 p-3 text-xs">
                <div className="font-semibold text-foreground">Payment Terms:</div>
                <Textarea rows={2} className="mt-1 border-0 bg-transparent p-0 text-xs focus-visible:ring-0" value={terms} onChange={(e) => setTerms(e.target.value)} />
              </div>
              <div className="mt-3 grid gap-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Adjustment</Label>
                <Input className="h-9" placeholder="Adjustment note" />
              </div>
            </section>
          </div>

          {/* Base Amount panel */}
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="border-b bg-muted/40 px-4 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Base Amount</div>
              </div>
              <div className="divide-y">
                <SummaryLine label="Sub Total" value={fmt(base.subtotal)} />
                <SummaryLine
                  label="Discount Rate"
                  right={
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} max={100} value={discountRate} onChange={(e) => setDiscountRate(Math.max(0, Math.min(100, +e.target.value)))} className="h-7 w-16 text-right text-xs" />
                      <span className="text-[11px] text-muted-foreground">%</span>
                    </div>
                  }
                  sub={fmt(base.discount + extraDiscount)}
                />
                <SummaryLine
                  label="Gst"
                  hint="Exclusive"
                  right={
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} value={cgst} onChange={(e) => setCgst(Math.max(0, +e.target.value))} className="h-7 w-14 text-right text-xs" />
                      <span className="text-[11px] text-muted-foreground">%</span>
                    </div>
                  }
                />
                <SummaryLine
                  label="Tax"
                  hint={taxInclusive ? "Inclusive" : "Exclusive"}
                  right={
                    <div className="flex items-center gap-1">
                      <Input type="number" min={0} value={sgst} onChange={(e) => setSgst(Math.max(0, +e.target.value))} className="h-7 w-14 text-right text-xs" />
                      <span className="text-[11px] text-muted-foreground">%</span>
                      <label className="ml-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <input type="checkbox" className="h-3 w-3 accent-primary" checked={taxInclusive} onChange={(e) => setTaxInclusive(e.target.checked)} />
                        Inc
                      </label>
                    </div>
                  }
                  sub={fmt(taxAmount)}
                />
                <SummaryLine
                  label="Shipping Amount"
                  right={
                    <Input type="number" min={0} value={shippingAmount} onChange={(e) => setShippingAmount(Math.max(0, +e.target.value))} className="h-7 w-24 text-right text-xs" />
                  }
                />
              </div>

              {/* Total green bar */}
              <div className="flex items-center justify-between bg-accent px-4 py-3 text-accent-foreground">
                <span className="font-display text-sm font-semibold uppercase tracking-wider">Total</span>
                <span className="font-display text-lg font-bold tabular-nums">{fmt(total)}</span>
              </div>

              <div className="divide-y">
                <SummaryLine
                  label="Payment Advance"
                  icon={<Plus className="h-3 w-3" />}
                  right={
                    <Input type="number" min={0} value={paidAdvance} onChange={(e) => setPaidAdvance(Math.max(0, +e.target.value))} className="h-7 w-24 text-right text-xs" />
                  }
                />
                <SummaryLine
                  label="Payment"
                  icon={<Plus className="h-3 w-3" />}
                  right={
                    <Input type="number" min={0} value={paidNow} onChange={(e) => setPaidNow(Math.max(0, +e.target.value))} className="h-7 w-24 text-right text-xs" />
                  }
                />
              </div>

              {/* Balance dark bar */}
              <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
                <span className="font-display text-sm font-semibold uppercase tracking-wider">Balance</span>
                <span className="font-display text-lg font-bold tabular-nums">{fmt(Math.max(0, balance))}</span>
              </div>

              <div className="flex items-center justify-end gap-2 p-3">
                <Button variant="ghost" size="sm" asChild><Link to="/invoices">Cancel</Link></Button>
                <Button size="sm" onClick={() => save()} className="bg-accent hover:bg-accent/90">
                  <Save className="mr-1.5 h-3.5 w-3.5" />Save
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Mobile sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
            <div className="truncate font-display text-lg font-bold text-primary">{fmt(Math.max(0, balance))}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Sheet>
              <SheetTrigger asChild><Button variant="outline" size="sm">Totals</Button></SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader><SheetTitle>Base Amount</SheetTitle></SheetHeader>
                <div className="mt-4 space-y-2 text-sm">
                  <MobileRow label="Sub Total" value={fmt(base.subtotal)} />
                  <MobileRow label={`Discount (${discountRate}%)`} value={fmt(base.discount + extraDiscount)} />
                  <MobileRow label={`Tax (${taxRate}%)`} value={fmt(taxAmount)} />
                  <MobileRow label="Shipping" value={fmt(shippingAmount)} />
                  <div className="mt-3 flex items-center justify-between rounded-lg bg-accent px-3 py-2 text-accent-foreground">
                    <span className="text-xs font-semibold uppercase">Total</span>
                    <span className="font-display font-bold">{fmt(total)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-primary px-3 py-2 text-primary-foreground">
                    <span className="text-xs font-semibold uppercase">Balance</span>
                    <span className="font-display font-bold">{fmt(Math.max(0, balance))}</span>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Button size="sm" onClick={() => save()} className="bg-accent hover:bg-accent/90">
              <Save className="mr-1.5 h-3.5 w-3.5" />Save
            </Button>
          </div>
        </div>
      </div>

      {/* Add client dialog */}
      <Dialog open={addCustOpen} onOpenChange={setAddCustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quick add client</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Name</Label><Input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Phone</Label><Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Email</Label><Input value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} /></div>
            </div>
            <div className="grid gap-1.5"><Label>Address</Label><Input value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>GSTIN (optional)</Label><Input value={newCust.gstin} onChange={(e) => setNewCust({ ...newCust, gstin: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddCustOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!newCust.name) return toast.error("Name required");
              const c = addCustomer(newCust);
              setCustomerId(c.id);
              setNewCust({ name: "", phone: "", email: "", address: "", gstin: "" });
              setAddCustOpen(false);
              toast.success("Client added & selected");
            }}>Add & select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------- helpers ------------- */

function ActionBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={onClick}>
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

function FieldRow({ label, children, inline = false }: { label: string; children: React.ReactNode; inline?: boolean }) {
  if (inline) {
    return (
      <div className="grid grid-cols-[110px_1fr] items-center gap-2">
        <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
        {children}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2">
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SummaryLine({
  label, right, sub, hint, icon,
}: {
  label: string; right?: React.ReactNode; sub?: string; hint?: string; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-sm">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && <span className="grid h-4 w-4 place-items-center rounded-sm bg-accent/15 text-accent">{icon}</span>}
        <span className="truncate">{label}</span>
        {hint && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{hint}</span>}
      </div>
      <div className="flex items-center gap-3">
        {sub !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{sub}</span>}
        {right}
      </div>
    </div>
  );
}

function MobileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function ItemNameCell({
  value, onPick, onType, mode,
}: {
  value: string;
  onPick: (productId: string, name: string, rate: number) => void;
  onType: (v: string) => void;
  mode: ItemMode;
}) {
  const { products } = useStore();
  const [open, setOpen] = useState(false);
  const results = value ? products.filter(p => (p.name + " " + p.sku).toLowerCase().includes(value.toLowerCase())).slice(0, 5) : products.slice(0, 5);

  if (mode === "fixed") {
    return <Input value={value} onChange={(e) => onType(e.target.value)} placeholder="Fixed line description…" className="h-8" />;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            value={value}
            onChange={(e) => { onType(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={mode === "service" ? "Service name…" : "Search product…"}
            className="h-8 pr-7"
          />
          <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <ul className="max-h-64 divide-y overflow-y-auto">
          {results.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">No matches</li>}
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-accent/10"
                onClick={() => { onPick(p.id, p.name, p.price); setOpen(false); }}
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">{p.sku.slice(0, 2)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{p.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{p.sku} · Stock {p.stock}</div>
                </div>
                <span className="text-xs font-semibold text-primary tabular-nums">{fmt(p.price)}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

function AddItemBar({ mode, onProduct, onBlank }: { mode: ItemMode; onProduct: (id: string) => void; onBlank: () => void }) {
  const { products } = useStore();
  const [q, setQ] = useState("");
  const results = q ? products.filter(p => (p.name + " " + p.sku).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

  if (mode === "fixed" || mode === "service") {
    return (
      <button
        type="button"
        onClick={onBlank}
        className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold text-accent transition hover:bg-accent/10"
      >
        <Plus className="h-4 w-4" /> Add New Item
      </button>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 p-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product to add…" className="h-9 pl-8" />
        </div>
        <Button variant="outline" size="sm" onClick={onBlank} className="h-9 shrink-0">
          <Plus className="mr-1 h-3.5 w-3.5" /> Add New Item
        </Button>
      </div>
      {q && (
        <div className="absolute inset-x-2 top-[calc(100%-4px)] z-30 overflow-hidden rounded-lg border bg-popover shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">No products match "{q}"</div>
          ) : (
            <ul className="max-h-64 divide-y overflow-y-auto">
              {results.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { onProduct(p.id); setQ(""); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-accent/10"
                  >
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">{p.sku.slice(0, 2)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{p.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{p.sku} · {p.category} · Stock {p.stock}</div>
                    </div>
                    <span className="text-xs font-semibold text-primary tabular-nums">{fmt(p.price)}</span>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setQ("")} className="flex w-full items-center justify-center gap-1 border-t bg-muted/40 py-1.5 text-[11px] text-muted-foreground hover:bg-muted">
            <X className="h-3 w-3" /> Close
          </button>
        </div>
      )}
    </div>
  );
}
