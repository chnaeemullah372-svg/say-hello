import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserPlus, Search, Phone, Mail, MapPin, Pencil, ChevronDown, ChevronUp, MessageCircle, Building2, Receipt } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import { useStore } from "@/lib/store";
import { fmt, type Customer, type PartyType } from "@/lib/dummy-data";
import { normalizeWhatsAppNumber } from "@/lib/phone";
import { supabase } from "@/integrations/supabase/client";
import { sendAndLogWhatsApp } from "@/lib/whatsapp";
import { toast } from "sonner";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [
    { title: "Client / Supplier — Prestige Invoice" },
    { name: "description", content: "Manage clients and suppliers in one directory, with billing and shipping details." },
  ]}),
  component: CustomersPage,
});

type Tab = "client" | "supplier" | "both";

const emptyForm = {
  partyType: "client" as PartyType,
  name: "", contactPerson: "", phone: "", phone2: "", whatsapp: "", email: "", website: "", region: "",
  gstin: "", businessId: "", panNo: "",
  address: "", pinCode: "", city: "", state: "", country: "",
  shippingSameAsBilling: true, shippingPinCode: "", shippingCity: "", shippingState: "", shippingCountry: "",
  referralName: "", referralPhone: "", referralEmail: "", referralAddress: "",
  maxCreditLimit: 0, paymentTerms: "No Due Date",
  openingBalance: 0, openingDate: new Date().toISOString().slice(0, 10),
  bankName: "", payableTo: "", bankAccountNo: "", ifscCode: "", upiId: "",
};

function CustomersPage() {
  const { customers, addCustomer, updateCustomer } = useStore();
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "balance">("name");
  const [tab, setTab] = useState<Tab>("client");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waTarget, setWaTarget] = useState<Customer | null>(null);
  const [waMessage, setWaMessage] = useState("");
  const [waSending, setWaSending] = useState(false);

  const sendWa = async () => {
    if (!waTarget?.whatsapp) return;
    setWaSending(true);
    try {
      const { data } = await supabase.from("app_settings").select("setting_value").eq("setting_key", "settings.whatsapp").maybeSingle();
      const wa = (data?.setting_value as Record<string, string>) ?? {};
      const result = await sendAndLogWhatsApp({
        apiBase: wa.shoibApiBase || "https://hatelecom.xyz/api",
        token: wa.shoibToken || "",
        customerId: waTarget.id,
        customerName: waTarget.name,
        toNumber: waTarget.whatsapp,
        message: waMessage,
        messageType: "other",
      });
      if (result.ok) { toast.success("Sent"); setWaOpen(false); }
      else toast.error(result.error || "Could not send");
    } finally {
      setWaSending(false);
    }
  };

  const visible = useMemo(
    () => customers.filter((c) => (tab === "both" ? true : c.partyType === tab || c.partyType === "both")),
    [customers, tab],
  );
  const filtered = useMemo(() => {
    const list = visible.filter((c) =>
      [c.name, c.phone, c.contactPerson ?? "", c.email ?? ""].join(" ").toLowerCase().includes(q.toLowerCase())
    );
    return [...list].sort((a, b) => {
      if (sortBy === "balance") {
        const av = tab === "supplier" ? (a.payableBalance ?? 0) : a.balance;
        const bv = tab === "supplier" ? (b.payableBalance ?? 0) : b.balance;
        return bv - av;
      }
      return a.name.localeCompare(b.name);
    });
  }, [visible, q, sortBy, tab]);

  const outstanding = tab === "supplier"
    ? visible.reduce((s, c) => s + (c.payableBalance ?? 0), 0)
    : visible.reduce((s, c) => s + c.balance, 0);

  const startAdd = () => { setEditingId(null); setForm({ ...emptyForm, partyType: tab === "both" ? "client" : tab }); setShowMore(false); setOpen(true); };
  const startEdit = (c: Customer) => {
    setEditingId(c.id);
    setForm({
      partyType: c.partyType, name: c.name, contactPerson: c.contactPerson ?? "", phone: c.phone,
      phone2: c.phone2 ?? "", whatsapp: c.whatsapp ?? "", email: c.email ?? "", website: c.website ?? "", region: c.region ?? "",
      gstin: c.gstin ?? "", businessId: c.businessId ?? "", panNo: c.panNo ?? "",
      address: c.address ?? "", pinCode: c.pinCode ?? "", city: c.city ?? "", state: c.state ?? "", country: c.country ?? "",
      shippingSameAsBilling: c.shippingSameAsBilling ?? true, shippingPinCode: c.shippingPinCode ?? "", shippingCity: c.shippingCity ?? "",
      shippingState: c.shippingState ?? "", shippingCountry: c.shippingCountry ?? "",
      referralName: c.referralName ?? "", referralPhone: c.referralPhone ?? "", referralEmail: c.referralEmail ?? "", referralAddress: c.referralAddress ?? "",
      maxCreditLimit: c.maxCreditLimit ?? 0, paymentTerms: c.paymentTerms ?? "No Due Date",
      openingBalance: c.openingBalance ?? 0, openingDate: c.openingDate ?? new Date().toISOString().slice(0, 10),
      bankName: c.bankName ?? "", payableTo: c.payableTo ?? "", bankAccountNo: c.bankAccountNo ?? "", ifscCode: c.ifscCode ?? "", upiId: c.upiId ?? "",
    });
    setShowMore(true);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error("Name is required");
    const duplicate = customers.some((c) => c.id !== editingId && c.name.trim().toLowerCase() === form.name.trim().toLowerCase());
    if (duplicate) return toast.error("Client/Supplier with this name already exists");
    if (saving) return;
    setSaving(true);
    const payload = { ...form, whatsapp: form.whatsapp ? normalizeWhatsAppNumber(form.whatsapp) : "" };
    try {
      if (editingId) {
        await updateCustomer(editingId, payload);
        toast.success("Saved");
      } else {
        await addCustomer(payload);
        toast.success(`${form.partyType === "supplier" ? "Supplier" : "Client"} added`);
      }
      setOpen(false);
      setForm(emptyForm);
      setShowMore(false);
      setEditingId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Client / Supplier"
        subtitle={`${visible.length} ${tab === "supplier" ? "suppliers" : tab === "both" ? "contacts" : "clients"} · ${fmt(outstanding)} outstanding`}
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setShowMore(false); setEditingId(null); } }}>
            <DialogTrigger asChild>
              <Button onClick={startAdd}><UserPlus className="mr-1.5 h-4 w-4" />New {tab === "supplier" ? "Supplier" : "Client"}</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader><DialogTitle>{editingId ? "Edit contact" : "New contact"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-3 gap-1.5 rounded-lg border bg-muted/40 p-1">
                  {(["client", "supplier", "both"] as PartyType[]).map((t) => (
                    <button
                      key={t} type="button"
                      onClick={() => setForm({ ...form, partyType: t })}
                      className={`rounded-md py-1.5 text-xs font-semibold capitalize transition ${form.partyType === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}
                    >{t}</button>
                  ))}
                </div>

                <div className="grid gap-1.5"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Company or full name" autoFocus /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>Contact Number</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 …" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Contact Number 2</Label><Input value={form.phone2} onChange={(e) => setForm({ ...form, phone2: e.target.value })} /></div>
                  <div className="grid gap-1.5"><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} placeholder="+92 300 …" /></div>
                </div>

                <Button type="button" variant="ghost" size="sm" className="justify-start px-2 text-accent hover:text-accent" onClick={() => setShowMore((v) => !v)}>
                  {showMore ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
                  {showMore ? "Hide additional details" : "Add More Details"}
                </Button>

                {showMore && (
                  <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                      <div className="grid gap-1.5"><Label>Website</Label><Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5"><Label>GSTIN / Tax ID</Label><Input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
                      <div className="grid gap-1.5"><Label>Business ID</Label><Input value={form.businessId} onChange={(e) => setForm({ ...form, businessId: e.target.value })} /></div>
                    </div>
                    <div className="grid gap-1.5"><Label>Region</Label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></div>

                    <div className="border-t pt-3 grid gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Billing address</div>
                      <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" />
                      <div className="grid grid-cols-2 gap-3">
                        <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
                        <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input value={form.pinCode} onChange={(e) => setForm({ ...form, pinCode: e.target.value })} placeholder="Pin code" />
                        <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Checkbox id="ship-same" checked={form.shippingSameAsBilling} onCheckedChange={(v) => setForm({ ...form, shippingSameAsBilling: !!v })} />
                      <Label htmlFor="ship-same" className="text-sm font-normal">Shipping address same as billing</Label>
                    </div>
                    {!form.shippingSameAsBilling && (
                      <div className="grid gap-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Input value={form.shippingCity} onChange={(e) => setForm({ ...form, shippingCity: e.target.value })} placeholder="Shipping city" />
                          <Input value={form.shippingState} onChange={(e) => setForm({ ...form, shippingState: e.target.value })} placeholder="Shipping state" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input value={form.shippingPinCode} onChange={(e) => setForm({ ...form, shippingPinCode: e.target.value })} placeholder="Shipping pin code" />
                          <Input value={form.shippingCountry} onChange={(e) => setForm({ ...form, shippingCountry: e.target.value })} placeholder="Shipping country" />
                        </div>
                      </div>
                    )}

                    <div className="border-t pt-3 grid gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Referral details (optional)</div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input value={form.referralName} onChange={(e) => setForm({ ...form, referralName: e.target.value })} placeholder="Referral name" />
                        <Input value={form.referralPhone} onChange={(e) => setForm({ ...form, referralPhone: e.target.value })} placeholder="Referral phone" />
                      </div>
                    </div>

                    <div className="border-t pt-3 grid gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Credit &amp; opening balance</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Max Credit Limit</Label><Input type="number" value={form.maxCreditLimit} onChange={(e) => setForm({ ...form, maxCreditLimit: +e.target.value || 0 })} /></div>
                        <div className="grid gap-1.5">
                          <Label className="text-xs font-normal text-muted-foreground">Payment Terms</Label>
                          <select
                            value={form.paymentTerms}
                            onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                            className="h-9 rounded-md border bg-background px-3 text-sm"
                          >
                            {["No Due Date", "Due on Receipt", "Net 7", "Net 15", "Net 30", "Net 45", "Net 60"].map((v) => <option key={v} value={v}>{v}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Opening Balance</Label><Input type="number" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: +e.target.value || 0 })} /></div>
                        <div className="grid gap-1.5"><Label className="text-xs font-normal text-muted-foreground">Opening Date</Label><Input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })} /></div>
                      </div>
                    </div>

                    <div className="border-t pt-3 grid gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bank details (optional)</div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="Bank name" />
                        <Input value={form.payableTo} onChange={(e) => setForm({ ...form, payableTo: e.target.value })} placeholder="Payable to" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input value={form.bankAccountNo} onChange={(e) => setForm({ ...form, bankAccountNo: e.target.value })} placeholder="Account number" />
                        <Input value={form.ifscCode} onChange={(e) => setForm({ ...form, ifscCode: e.target.value })} placeholder="IFSC code" />
                      </div>
                      <Input value={form.upiId} onChange={(e) => setForm({ ...form, upiId: e.target.value })} placeholder="UPI ID" />
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border bg-card p-1">
          {(["client", "supplier", "both"] as Tab[]).map((t) => (
            <button
              key={t} type="button" onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >{t}</button>
          ))}
        </div>
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="inline-flex rounded-lg border bg-card p-1">
          {([["name", "By Company Name"], ["balance", "By Balance"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setSortBy(v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${sortBy === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.length === 0 && (
          <Card className="md:col-span-2 xl:col-span-3"><CardContent className="py-10 text-center text-sm text-muted-foreground">
            No {tab === "supplier" ? "suppliers" : "clients"} yet — tap "New" to add one.
          </CardContent></Card>
        )}
        {filtered.map((c) => (
          <Card key={c.id} className="transition hover:border-accent/50 hover:shadow-md">
            <CardContent className="p-5">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div className="truncate font-semibold">{c.name}</div>
                        <Badge variant="outline" className="px-1.5 py-0 text-[9px] capitalize">{c.partyType}</Badge>
                      </div>
                      {c.gstin && <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">GSTIN {c.gstin}</div>}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    {c.contactPerson && <li className="flex items-center gap-2"><Building2 className="h-3 w-3" /> {c.contactPerson}</li>}
                    <li className="flex items-center gap-2"><Phone className="h-3 w-3" /> {c.phone || "—"}</li>
                    {c.whatsapp && <li className="flex items-center gap-2"><MessageCircle className="h-3 w-3" /> {c.whatsapp}</li>}
                    {c.email && <li className="flex items-center gap-2"><Mail className="h-3 w-3" /> <span className="truncate">{c.email}</span></li>}
                    {c.address && <li className="flex items-start gap-2"><MapPin className="h-3 w-3 mt-0.5" /> {c.address}</li>}
                  </ul>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => startEdit(c)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">{c.partyType === "supplier" ? "Payable" : "Outstanding"}</span>
                {(c.partyType === "supplier" ? (c.payableBalance ?? 0) : c.balance) > 0
                  ? <Badge className="bg-gold/20 text-gold-foreground border-gold/40" variant="outline">{fmt(c.partyType === "supplier" ? (c.payableBalance ?? 0) : c.balance)}</Badge>
                  : <Badge variant="outline" className="border-accent/30 text-accent">Settled</Badge>}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                <a href={c.phone ? `tel:${c.phone}` : undefined} onClick={(e) => !c.phone && e.preventDefault()}
                  className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-semibold transition ${c.phone ? "border-sapphire/30 text-sapphire hover:bg-sapphire/10" : "cursor-not-allowed border-muted text-muted-foreground/40"}`}>
                  <Phone className="h-3.5 w-3.5" />Call
                </a>
                <a href={c.phone ? `sms:${c.phone}` : undefined} onClick={(e) => !c.phone && e.preventDefault()}
                  className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-semibold transition ${c.phone ? "border-amber/30 text-amber hover:bg-amber/10" : "cursor-not-allowed border-muted text-muted-foreground/40"}`}>
                  <MessageCircle className="h-3.5 w-3.5" />SMS
                </a>
                <button
                  type="button"
                  disabled={!c.whatsapp}
                  onClick={() => { setWaTarget(c); setWaMessage(`Hello ${c.name}, `); setWaOpen(true); }}
                  className={`flex items-center justify-center gap-1 rounded-md border py-1.5 text-xs font-semibold transition ${c.whatsapp ? "border-accent/30 text-accent hover:bg-accent/10" : "cursor-not-allowed border-muted text-muted-foreground/40"}`}
                >
                  <MessageCircle className="h-3.5 w-3.5" />WA
                </button>
                <Link to="/statement" search={{ customer: c.id } as any}
                  className="flex items-center justify-center gap-1 rounded-md border border-primary/30 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/10">
                  <Receipt className="h-3.5 w-3.5" />Ledger
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={waOpen} onOpenChange={setWaOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Send WhatsApp to {waTarget?.name}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div className="text-xs text-muted-foreground">To: {waTarget?.whatsapp}</div>
            <Textarea rows={4} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWaOpen(false)}>Cancel</Button>
            <Button onClick={sendWa} disabled={waSending}>{waSending ? "Sending…" : "Send"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
