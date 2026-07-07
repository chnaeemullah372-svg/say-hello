import { useMemo, useState, type ReactNode } from "react";
import { Calendar, Eye, FileText, Paperclip, Plus, Printer, Search, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/PageHeader";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export type PlaceholderRow = {
  id: string;
  number: string;
  party: string;
  date: string;
  amount: number;
  status: string;
};

export function ModulePlaceholder({
  title,
  subtitle,
  addLabel,
  partyLabel = "Party",
  rows,
  stats,
  icon,
}: {
  title: string;
  subtitle: string;
  addLabel: string;
  partyLabel?: string;
  rows: PlaceholderRow[];
  stats: { label: string; value: string }[];
  icon?: ReactNode;
}) {
  const [records, setRecords] = useState(rows);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<PlaceholderRow | null>(null);
  const [attachment, setAttachment] = useState("");
  const [form, setForm] = useState({
    number: `${rows[0]?.number.split("-").slice(0, -1).join("-") || title.slice(0, 2).toUpperCase()}-${String(rows.length + 1).padStart(3, "0")}`,
    party: "",
    date: new Date().toISOString().slice(0, 10),
    base: 0,
    discount: 0,
    tax: 0,
    shipping: 0,
    status: "open",
    notes: "",
  });

  const filtered = useMemo(() => records.filter((r) => {
    const matchesText = [r.number, r.party, r.status].join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesText && matchesStatus;
  }), [records, query, statusFilter]);

  const statuses = Array.from(new Set(records.map((r) => r.status)));
  const formTotal = Math.max(0, form.base - (form.base * form.discount) / 100 + (form.base * form.tax) / 100 + form.shipping);

  const saveRecord = () => {
    if (!form.party.trim()) return toast.error(`${partyLabel} is required`);
    const next: PlaceholderRow = {
      id: `${title.toLowerCase().replace(/\W+/g, "-")}-${Date.now()}`,
      number: form.number,
      party: form.party,
      date: form.date,
      amount: formTotal,
      status: form.status,
    };
    setRecords((prev) => [next, ...prev]);
    setOpen(false);
    setAttachment("");
    setForm((prev) => ({ ...prev, party: "", base: 0, discount: 0, tax: 0, shipping: 0, notes: "" }));
    toast.success(`${title.replace(/s$/, "")} saved`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {addLabel}
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
              <div className="mt-1.5 font-display text-lg font-bold sm:text-xl">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={`Search ${title.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              {statuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="hidden md:block">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">{partyLabel}</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30 cursor-pointer" onClick={() => setDetail(r)}>
                  <td className="px-4 py-3 font-medium">{r.number}</td>
                  <td className="px-4 py-3 flex items-center gap-2">{icon}{r.party}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.date}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmt(r.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className="capitalize">{r.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:hidden">
        {filtered.map((r) => (
          <button key={r.id} type="button" onClick={() => setDetail(r)} className="rounded-xl border bg-card p-4 text-left shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-xs text-muted-foreground">{r.number}</div>
                <div className="mt-1 font-semibold">{r.party}</div>
              </div>
              <Badge variant="outline" className="capitalize">{r.status}</Badge>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground"><Calendar className="mr-1 inline h-3.5 w-3.5" />{r.date}</div>
              <div className="text-right font-display font-bold text-primary">{fmt(r.amount)}</div>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{addLabel}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Number"><Input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["open", "sent", "pending", "processing", "received", "completed", "delivered", "credited", "refunded"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={partyLabel}><Input value={form.party} onChange={(e) => setForm({ ...form, party: e.target.value })} placeholder={`${partyLabel} name`} /></Field>
            <div className="rounded-xl border bg-muted/25 p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" />Amount details</div>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Base Amount"><Input type="number" value={form.base} onChange={(e) => setForm({ ...form, base: +e.target.value })} /></Field>
                <Field label="Discount %"><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: +e.target.value })} /></Field>
                <Field label="Tax %"><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: +e.target.value })} /></Field>
                <Field label="Shipping"><Input type="number" value={form.shipping} onChange={(e) => setForm({ ...form, shipping: +e.target.value })} /></Field>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-card px-3 py-2">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-xl font-bold text-primary">{fmt(formTotal)}</span>
              </div>
            </div>
            <Field label="Notes / Terms"><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Write notes, terms or dispatch remarks" /></Field>
            <div className="rounded-xl border border-dashed p-4">
              <Label className="mb-2 flex items-center gap-2"><Paperclip className="h-4 w-4 text-primary" />Attach document / screenshot</Label>
              <Input type="file" onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? "")} />
              {attachment && <div className="mt-2 text-xs text-muted-foreground">Attached: {attachment}</div>}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => toast.info("Preview ready in demo") }><Eye className="mr-1.5 h-4 w-4" />Preview</Button>
              <Button variant="outline" type="button" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" />Print</Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="button" onClick={saveRecord}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="sm:max-w-xl">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.number}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="rounded-xl border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">{partyLabel}</div>
                      <div className="mt-1 font-display text-lg font-bold">{detail.party}</div>
                      <div className="mt-1 text-sm text-muted-foreground">Date: {detail.date}</div>
                    </div>
                    <Badge variant="outline" className="capitalize">{detail.status}</Badge>
                  </div>
                  <div className="mt-5 flex items-baseline justify-between border-t pt-4">
                    <span className="text-sm text-muted-foreground">Total Amount</span>
                    <span className="font-display text-2xl font-bold text-primary">{fmt(detail.amount)}</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <Button variant="outline" onClick={() => toast.success("Send action queued") }><Send className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Send</span></Button>
                  <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Print</span></Button>
                  <Button variant="outline" onClick={() => toast.info("Preview opened") }><Eye className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Preview</span></Button>
                  <Button variant="outline" onClick={() => toast.info("Edit mode is ready")}>Edit</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
