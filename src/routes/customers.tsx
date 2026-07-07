import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, Search, Phone, Mail, MapPin, Pencil, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/customers")({
  head: () => ({ meta: [
    { title: "Customers — Prestige Invoice" },
    { name: "description", content: "Manage your customer directory, contacts and outstanding balances." },
  ]}),
  component: CustomersPage,
});

function CustomersPage() {
  const { customers, addCustomer } = useStore();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", referralName: "", referralPhone: "" });

  const filtered = customers.filter((c) =>
    [c.name, c.phone, c.referralName ?? "", c.referralPhone ?? ""].join(" ").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customers · ${fmt(customers.reduce((s, c) => s + c.balance, 0))} outstanding`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="mr-1.5 h-4 w-4" />Add Customer</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New customer</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5"><Label>Customer Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" autoFocus /></div>
                <div className="grid gap-1.5"><Label>Customer Contact Number</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+92 300 …" /></div>
                <div className="grid gap-1.5"><Label>Referral Name <span className="text-xs text-muted-foreground">(optional)</span></Label><Input value={form.referralName} onChange={(e) => setForm({ ...form, referralName: e.target.value })} placeholder="Who referred them" /></div>
                <div className="grid gap-1.5"><Label>Referral Contact Number <span className="text-xs text-muted-foreground">(optional)</span></Label><Input value={form.referralPhone} onChange={(e) => setForm({ ...form, referralPhone: e.target.value })} placeholder="+92 300 …" /></div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                  if (!form.name) { toast.error("Customer name is required"); return; }
                  addCustomer(form);
                  toast.success("Customer added");
                  setForm({ name: "", phone: "", referralName: "", referralPhone: "" });
                  setOpen(false);
                }}>Save customer</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />


      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                      <div className="truncate font-semibold">{c.name}</div>
                      {c.gstin && <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">GSTIN {c.gstin}</div>}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2"><Phone className="h-3 w-3" /> {c.phone || "—"}</li>
                    {c.referralName && (
                      <li className="flex items-center gap-2">
                        <UserPlus className="h-3 w-3" />
                        <span className="truncate">Ref: {c.referralName}{c.referralPhone ? ` · ${c.referralPhone}` : ""}</span>
                      </li>
                    )}
                    {c.email && <li className="flex items-center gap-2"><Mail className="h-3 w-3" /> <span className="truncate">{c.email}</span></li>}
                    {c.address && <li className="flex items-start gap-2"><MapPin className="h-3 w-3 mt-0.5" /> {c.address}</li>}
                  </ul>

                </div>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => toast.info("Edit is a demo action")}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-xs text-muted-foreground">Outstanding</span>
                {c.balance > 0
                  ? <Badge className="bg-gold/20 text-gold-foreground border-gold/40" variant="outline">{fmt(c.balance)}</Badge>
                  : <Badge variant="outline" className="border-accent/30 text-accent">Settled</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
