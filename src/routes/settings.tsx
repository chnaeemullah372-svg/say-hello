import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/lib/theme";
import { MessageCircle, Sun, Moon, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "Settings — Prestige Invoice" },
    { name: "description", content: "Business profile, tax, invoice template and appearance settings." },
  ]}),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, toggle } = useTheme();
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Configure your business and app preferences" />

      <Tabs defaultValue="business">
        <TabsList className="flex-wrap">
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="tax">Tax & Currency</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="template">Invoice template</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
        </TabsList>

        <TabsContent value="business">
          <Card><CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <Field label="Business name" defaultValue="Prestige Store" />
            <Field label="Owner name" defaultValue="Rajesh Kumar" />
            <Field label="Email" defaultValue="billing@prestige.store" />
            <Field label="Phone" defaultValue="+91 90000 00000" />
            <div className="md:col-span-2 grid gap-1.5">
              <Label>Address</Label>
              <Textarea rows={2} defaultValue="221B Baker Street, Mumbai, MH 400001" />
            </div>
            <Field label="GSTIN" defaultValue="27PPPPP1234P1Z5" />
            <Field label="Website" defaultValue="prestige.store" />
            <div className="md:col-span-2"><Button onClick={() => toast.success("Business profile saved")}>Save changes</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="tax">
          <Card><CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <Field label="Default tax rate (%)" defaultValue="18" type="number" />
            <Field label="Currency" defaultValue="INR" />
            <Field label="Currency symbol" defaultValue="₹" />
            <Field label="Financial year start" defaultValue="April" />
            <div className="md:col-span-2"><Button onClick={() => toast.success("Tax settings saved")}>Save changes</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="whatsapp">
          <Card><CardContent className="grid gap-4 p-6 md:grid-cols-2">
            <div className="md:col-span-2 flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold">WhatsApp Name</div>
                <div className="text-sm text-muted-foreground">Future WhatsApp message and reminder setup placeholder.</div>
              </div>
            </div>
            <Field label="WhatsApp Name" defaultValue="Prestige Store" />
            <Field label="Default WhatsApp Number" defaultValue="" />
            <div className="md:col-span-2"><Button onClick={() => toast.success("WhatsApp settings saved")}>Save changes</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="template">
          <Card><CardContent className="grid gap-6 p-6 md:grid-cols-[240px_minmax(0,1fr)]">
            <div className="grid gap-3">
              {["Classic Emerald", "Minimal Cream", "Bold Gold"].map((t, i) => (
                <button key={t} className={`rounded-xl border p-4 text-left transition hover:border-accent ${i === 0 ? "border-primary bg-primary/5" : ""}`}>
                  <div className="font-display font-semibold">{t}</div>
                  <div className="text-xs text-muted-foreground">Preview →</div>
                </button>
              ))}
            </div>
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Sparkles className="h-4 w-4" /></div>
                <div className="font-display font-bold">Prestige Store</div>
                <div className="ml-auto font-display text-2xl font-bold text-primary">INVOICE</div>
              </div>
              <div className="mt-4 h-2 rounded gold-hairline border-t border-dashed" />
              <div className="mt-6 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-3 w-full rounded bg-muted" />)}
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
              <div className="mt-6 flex justify-end"><div className="h-6 w-32 rounded bg-primary/20" /></div>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card><CardContent className="grid gap-4 p-6">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <div className="font-semibold">Theme</div>
                <div className="text-sm text-muted-foreground">Currently using <span className="capitalize font-medium text-foreground">{theme}</span> mode</div>
              </div>
              <Button variant="outline" onClick={toggle}>
                {theme === "dark" ? <><Sun className="mr-1.5 h-4 w-4" />Switch to light</> : <><Moon className="mr-1.5 h-4 w-4" />Switch to dark</>}
              </Button>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, defaultValue, type = "text" }: { label: string; defaultValue?: string; type?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input type={type} defaultValue={defaultValue} />
    </div>
  );
}
