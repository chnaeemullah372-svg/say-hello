import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Plus, Trash2, Search, UserPlus, Save, Printer, FileText, X, ChevronDown,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useStore } from "@/lib/store";
import { calcInvoiceTotals, fmt, type InvoiceItem } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/invoices/new")({
  head: () => ({ meta: [
    { title: "Create Invoice — Prestige Invoice" },
    { name: "description", content: "Create a professional invoice in seconds — pick a customer, add products, print or save." },
  ]}),
  component: CreateInvoice,
});

function CreateInvoice() {
  const { customers, products, addCustomer, addInvoice, invoices } = useStore();
  const nextNumber = `INV-2026-${String(143 + (invoices.length - 5)).padStart(4, "0")}`;

  const [customerId, setCustomerId] = useState<string>("");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [taxRate, setTaxRate] = useState(18);
  const [paid, setPaid] = useState(0);
  const [notes, setNotes] = useState("Thank you for your business.");
  const [date] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));

  const [custOpen, setCustOpen] = useState(false);
  const [addCustOpen, setAddCustOpen] = useState(false);
  const [newCust, setNewCust] = useState({ name: "", phone: "", email: "", address: "", gstin: "" });

  const totals = useMemo(() => calcInvoiceTotals(items, taxRate), [items, taxRate]);
  const balance = totals.total - paid;
  const customer = customers.find((c) => c.id === customerId);

  const addItem = (productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.productId === p.id);
      if (existing) return prev.map((it) => it.productId === p.id ? { ...it, qty: it.qty + 1 } : it);
      return [...prev, { productId: p.id, name: p.name, qty: 1, rate: p.price, discount: 0 }];
    });
  };

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const save = (opts: { print?: boolean } = {}) => {
    if (!customerId) return toast.error("Please select a customer");
    if (!items.length) return toast.error("Add at least one item");
    const status = paid >= totals.total ? "paid" : paid > 0 ? "partial" : "unpaid";
    const inv = addInvoice({
      number: nextNumber, customerId, date, dueDate, items, taxRate, paid, notes, status,
    });
    toast.success(`Invoice ${inv.number} saved`);
    if (opts.print) {
      // Give router a tick to save then navigate
      setTimeout(() => { window.location.href = `/invoices/${inv.id}?print=1`; }, 200);
    } else {
      setTimeout(() => { window.location.href = `/invoices/${inv.id}`; }, 200);
    }
  };

  return (
    <div className="space-y-6 pb-32 lg:pb-6">
      <PageHeader
        title="Create Invoice"
        subtitle={<>Number <span className="font-mono font-semibold text-foreground">{nextNumber}</span> · Draft</> as unknown as string}
        action={
          <div className="hidden gap-2 lg:flex">
            <Button variant="outline" onClick={() => save({ print: true })}><Printer className="mr-1.5 h-4 w-4" />Save & Print</Button>
            <Button onClick={() => save()}><Save className="mr-1.5 h-4 w-4" />Save Invoice</Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6 min-w-0">
          {/* Customer + dates */}
          <Card>
            <CardContent className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Bill to</Label>
                  <div className="mt-2 flex gap-2">
                    <Popover open={custOpen} onOpenChange={setCustOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="min-w-0 flex-1 justify-between font-normal">
                          <span className="truncate">{customer ? customer.name : "Select customer…"}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[320px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search customers…" />
                          <CommandList>
                            <CommandEmpty>No customers found.</CommandEmpty>
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
                    <Button variant="outline" size="icon" onClick={() => setAddCustOpen(true)} aria-label="Add new customer">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                  {customer && (
                    <div className="mt-3 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                      <div className="text-foreground font-medium">{customer.name}</div>
                      <div>{customer.phone} · {customer.email}</div>
                      <div>{customer.address}</div>
                      {customer.gstin && <div className="mt-1">GSTIN {customer.gstin}</div>}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 content-start">
                  <div className="grid gap-1.5"><Label>Invoice date</Label><Input type="date" value={date} readOnly /></div>
                  <div className="grid gap-1.5"><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
                  <div className="grid gap-1.5 col-span-2"><Label>Tax rate (%)</Label>
                    <div className="flex gap-2">
                      {[0, 5, 12, 18, 28].map((t) => (
                        <Button key={t} type="button" size="sm" variant={taxRate === t ? "default" : "outline"} onClick={() => setTaxRate(t)}>{t}%</Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Product search + items */}
          <Card>
            <CardContent className="p-5">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Add items</Label>
              <ProductPicker onPick={addItem} />

              <div className="mt-5">
                {items.length === 0 ? (
                  <div className="grid place-items-center rounded-xl border border-dashed py-10 text-center text-muted-foreground">
                    <FileText className="mb-2 h-8 w-8" />
                    <p className="text-sm">Search a product above to add your first item.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="py-2 text-left">Item</th>
                          <th className="py-2 text-right w-20">Qty</th>
                          <th className="py-2 text-right w-28">Rate</th>
                          <th className="py-2 text-right w-24">Disc %</th>
                          <th className="py-2 text-right w-28">Amount</th>
                          <th className="py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, i) => {
                          const amt = it.qty * it.rate * (1 - it.discount / 100);
                          return (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-3 pr-2 font-medium">{it.name}</td>
                              <td className="py-3">
                                <Input type="number" min={1} value={it.qty} onChange={(e) => updateItem(i, { qty: Math.max(1, +e.target.value) })} className="h-9 text-right" />
                              </td>
                              <td className="py-3 pl-2">
                                <Input type="number" min={0} value={it.rate} onChange={(e) => updateItem(i, { rate: +e.target.value })} className="h-9 text-right" />
                              </td>
                              <td className="py-3 pl-2">
                                <Input type="number" min={0} max={100} value={it.discount} onChange={(e) => updateItem(i, { discount: Math.max(0, Math.min(100, +e.target.value)) })} className="h-9 text-right" />
                              </td>
                              <td className="py-3 pl-2 text-right font-semibold">{fmt(amt)}</td>
                              <td className="py-3 pl-2 text-right">
                                <Button variant="ghost" size="icon" onClick={() => removeItem(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardContent className="p-5">
              <Label>Notes / Terms</Label>
              <Textarea className="mt-2" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </CardContent>
          </Card>
        </div>

        {/* Summary — desktop */}
        <div className="hidden lg:block">
          <div className="sticky top-20">
            <SummaryCard totals={totals} paid={paid} setPaid={setPaid} balance={balance} onSave={save} />
          </div>
        </div>
      </div>

      {/* Mobile sticky footer with bottom sheet summary */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</div>
            <div className="truncate font-display text-xl font-bold text-primary">{fmt(totals.total)}</div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Sheet>
              <SheetTrigger asChild><Button variant="outline">Summary</Button></SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader><SheetTitle>Invoice summary</SheetTitle></SheetHeader>
                <div className="mt-4"><SummaryCard totals={totals} paid={paid} setPaid={setPaid} balance={balance} onSave={save} /></div>
              </SheetContent>
            </Sheet>
            <Button onClick={() => save()}><Save className="mr-1.5 h-4 w-4" />Save</Button>
          </div>
        </div>
      </div>

      {/* Inline add customer */}
      <Dialog open={addCustOpen} onOpenChange={setAddCustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Quick add customer</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5"><Label>Name</Label><Input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5"><Label>Phone</Label><Input value={newCust.phone} onChange={(e) => setNewCust({ ...newCust, phone: e.target.value })} /></div>
              <div className="grid gap-1.5"><Label>Email</Label><Input value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} /></div>
            </div>
            <div className="grid gap-1.5"><Label>Address</Label><Input value={newCust.address} onChange={(e) => setNewCust({ ...newCust, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddCustOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!newCust.name) return toast.error("Name required");
              const c = addCustomer(newCust);
              setCustomerId(c.id);
              setNewCust({ name: "", phone: "", email: "", address: "", gstin: "" });
              setAddCustOpen(false);
              toast.success("Customer added & selected");
            }}>Add & select</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductPicker({ onPick }: { onPick: (id: string) => void }) {
  const { products } = useStore();
  const [q, setQ] = useState("");
  const results = q ? products.filter((p) => (p.name + " " + p.sku).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

  return (
    <div className="relative mt-2">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="h-11 pl-9" placeholder="Search products by name or SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
      {q && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-lg">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">No products match "{q}"</div>
          ) : (
            <ul className="max-h-64 divide-y overflow-y-auto">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => { onPick(p.id); setQ(""); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-accent/10">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary text-xs font-bold">{p.sku.slice(0,2)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{p.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{p.category} · Stock {p.stock}</div>
                    </div>
                    <div className="text-sm font-semibold text-primary">{fmt(p.price)}</div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => setQ("")} className="flex w-full items-center justify-center gap-1 border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground hover:bg-muted">
            <X className="h-3 w-3" /> Close
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  totals, paid, setPaid, balance, onSave,
}: {
  totals: { subtotal: number; discount: number; tax: number; total: number };
  paid: number; setPaid: (n: number) => void; balance: number;
  onSave: (opts?: { print?: boolean }) => void;
}) {
  return (
    <Card className="border-primary/20 shadow-lg">
      <CardContent className="p-5">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Summary</div>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label="Subtotal" value={fmt(totals.subtotal)} />
          <Row label="Discount" value={`- ${fmt(totals.discount)}`} />
          <Row label="Tax" value={fmt(totals.tax)} />
          <div className="my-3 border-t border-dashed gold-hairline" />
          <div className="flex items-baseline justify-between">
            <span className="font-display text-sm font-semibold">Total</span>
            <span className="font-display text-2xl font-bold text-gold">{fmt(totals.total)}</span>
          </div>
        </dl>

        <div className="mt-4 grid gap-1.5">
          <Label className="text-xs">Amount paid</Label>
          <Input type="number" min={0} value={paid} onChange={(e) => setPaid(Math.max(0, +e.target.value))} />
        </div>

        <div className={`mt-3 flex items-center justify-between rounded-lg p-3 ${balance <= 0 ? "bg-accent/10 text-accent" : "bg-gold/10 text-gold-foreground"}`}>
          <span className="text-xs font-medium uppercase tracking-wider">Balance due</span>
          <span className="font-display text-lg font-bold">{fmt(Math.max(0, balance))}</span>
        </div>

        <div className="mt-4 grid gap-2">
          <Button onClick={() => onSave()} size="lg" className="w-full"><Save className="mr-1.5 h-4 w-4" />Save Invoice</Button>
          <Button variant="outline" onClick={() => onSave({ print: true })} className="w-full border-gold text-gold-foreground hover:bg-gold/10">
            <Printer className="mr-1.5 h-4 w-4" />Save & Print
          </Button>
          <Button asChild variant="ghost" className="w-full"><Link to="/invoices">Cancel</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
