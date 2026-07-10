import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserPlus, Search, Phone, Mail, MapPin, Pencil, ChevronDown, ChevronUp, MessageCircle, Building2 } from "lucide-react";
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
};

function CustomersPage() {
  const { customers, addCustomer, updateCustomer } = useStore();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("client");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showMore, setShowMore] = useState(false);
  const [saving, setSaving] = useState(false);

  const visible = useMemo(
    () => customers.filter((c) => (tab === "both" ? true : c.partyType === tab || c.partyType === "both")),
    [customers, tab],
  );
  const filtered = visible.filter((c) =>
    [c.name, c.phone, c.contactPerson ?? "", c.email ?? ""].join(" ").toLowerCase().includes(q.toLowerCase())
  );

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
    });
    setShowMore(true);
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast.error("Name is required");
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
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
