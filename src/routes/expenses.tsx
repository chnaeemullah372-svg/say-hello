import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Receipt, Pencil, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/dummy-data";
import { toast } from "sonner";

export const Route = createFileRoute("/expenses")({
  head: () => ({ meta: [
    { title: "Expenses — Prestige Invoice" },
    { name: "description", content: "Record and categorise business expenses." },
  ]}),
  component: ExpensesPage,
});

const CATEGORIES = ["Rent", "Utilities", "Salaries", "Transport", "Supplies", "Marketing", "Maintenance", "Other"];

function ExpensesPage() {
  const { expenses, addExpense, updateExpense, deleteExpense } = useStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCat = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount; return acc;
  }, {});

  const startAdd = () => {
    setEditingId(null); setCategory(CATEGORIES[0]); setDescription(""); setAmount(0);
    setDate(new Date().toISOString().slice(0, 10)); setOpen(true);
  };
  const startEdit = (id: string) => {
    const e = expenses.find((x) => x.id === id);
    if (!e) return;
    setEditingId(id); setCategory(e.category); setDescription(e.description ?? ""); setAmount(e.amount); setDate(e.date);
    setOpen(true);
  };

  const save = async () => {
    if (amount <= 0) return toast.error("Enter an amount");
    setSaving(true);
    try {
      if (editingId) { await updateExpense(editingId, { category, description, amount, date }); toast.success("Updated"); }
      else { await addExpense({ category, description, amount, date }); toast.success("Expense recorded"); }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save expense");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Record shop, staff and operational spending"
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild><Button onClick={startAdd}><Plus className="mr-1.5 h-4 w-4" />Add Expense</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>{editingId ? "Edit Expense" : "New Expense"}</DialogTitle></DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-1.5">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5"><Label>Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(+e.target.value || 0)} /></div>
                  <div className="grid gap-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total this period</div>
          <div className="mt-2 font-display text-2xl font-bold text-primary">{fmt(total)}</div>
        </CardContent></Card>
        {Object.entries(byCat).slice(0, 3).map(([k, v]) => (
          <Card key={k}><CardContent className="p-5">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="mt-2 font-display text-xl font-bold">{fmt(v)}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Date</th>
                <th className="px-6 py-3 text-left">Category</th>
                <th className="px-6 py-3 text-left">Note</th>
                <th className="px-6 py-3 text-right">Amount</th>
                <th className="px-6 py-3 text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">No expenses yet — tap "Add Expense".</td></tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id} className="border-t hover:bg-muted/30">
                  <td className="px-6 py-3 text-muted-foreground">{e.date}</td>
                  <td className="px-6 py-3"><span className="flex items-center gap-2"><Receipt className="h-4 w-4 text-muted-foreground" />{e.category}</span></td>
                  <td className="px-6 py-3">{e.description || "—"}</td>
                  <td className="px-6 py-3 text-right font-semibold">{fmt(e.amount)}</td>
                  <td className="px-6 py-3 text-right">
                    <button type="button" onClick={() => startEdit(e.id)} className="mr-2 text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                    <button
                      type="button"
                      onClick={async () => { try { await deleteExpense(e.id); toast.success("Deleted"); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); } }}
                      className="text-destructive"
                    ><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
