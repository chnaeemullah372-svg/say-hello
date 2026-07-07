import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/lib/theme";
import {
  MessageCircle, Sun, Moon, Sparkles, Building2, Percent, FileText, Layout,
  Hash, ScrollText, Landmark, PenLine, Users, Bell, DatabaseBackup, Palette,
  Trash2, Plus, Upload, Shield,
} from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [
    { title: "Settings — Prestige Invoice" },
    { name: "description", content: "Business profile, tax, TDS, invoice template, page layout, numbering, bank, signature, users, notifications, backup, WhatsApp and appearance." },
  ]}),
  component: SettingsPage,
});

const TABS: { value: string; label: string; icon: any }[] = [
  { value: "business", label: "Business", icon: Building2 },
  { value: "tax", label: "Tax & TDS", icon: Percent },
  { value: "numbering", label: "Numbering", icon: Hash },
  { value: "template", label: "Template", icon: FileText },
  { value: "page", label: "Page Layout", icon: Layout },
  { value: "terms", label: "Terms", icon: ScrollText },
  { value: "bank", label: "Bank", icon: Landmark },
  { value: "signature", label: "Signature", icon: PenLine },
  { value: "users", label: "Users & Roles", icon: Users },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "backup", label: "Backup", icon: DatabaseBackup },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "appearance", label: "Appearance", icon: Palette },
];

function SettingsPage() {
  const { theme, toggle } = useTheme();
  const save = (label: string) => () => toast.success(`${label} saved`);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Complete configuration for your business, invoices and app" />

      <Tabs defaultValue="business" className="gap-4">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="flex w-max flex-nowrap gap-1 sm:w-full sm:flex-wrap">
            {TABS.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5 whitespace-nowrap">
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* BUSINESS */}
        <TabsContent value="business">
          <SectionCard title="Business profile" desc="Shown on invoices, estimates and reports">
            <Grid>
              <Field label="Business name" defaultValue="Prestige Store" />
              <Field label="Legal / trade name" defaultValue="Prestige Store Pvt Ltd" />
              <Field label="Owner name" defaultValue="Rajesh Kumar" />
              <Field label="Business type">
                <Select defaultValue="retail"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="manufacturing">Manufacturing</SelectItem>
                    <SelectItem value="distributor">Distributor</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Industry" defaultValue="Jewellery & Accessories" />
              <Field label="Email" defaultValue="billing@prestige.store" type="email" />
              <Field label="Phone" defaultValue="+91 90000 00000" />
              <Field label="Alternate phone" defaultValue="+91 90000 00001" />
              <Field label="Website" defaultValue="prestige.store" />
              <Field label="GSTIN" defaultValue="27PPPPP1234P1Z5" />
              <Field label="PAN" defaultValue="PPPPP1234P" />
              <Field label="CIN / Reg. no." defaultValue="U74999MH2020PTC000000" />
              <FullWidth>
                <Label>Registered address</Label>
                <Textarea rows={2} defaultValue="221B Baker Street, Mumbai, MH 400001" />
              </FullWidth>
              <FullWidth>
                <Label>Shipping address (if different)</Label>
                <Textarea rows={2} placeholder="Leave blank if same as registered address" />
              </FullWidth>
              <Field label="City" defaultValue="Mumbai" />
              <Field label="State" defaultValue="Maharashtra" />
              <Field label="Country" defaultValue="India" />
              <Field label="Pincode" defaultValue="400001" />
            </Grid>
            <UploadRow label="Business logo" hint="PNG or JPG, up to 2 MB" />
            <SaveBar onSave={save("Business profile")} />
          </SectionCard>
        </TabsContent>

        {/* TAX & TDS */}
        <TabsContent value="tax">
          <SectionCard title="Tax & currency" desc="Applied by default on new invoices">
            <Grid>
              <Field label="Currency">
                <Select defaultValue="INR"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["INR","USD","EUR","GBP","AED","SAR","PKR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Currency symbol" defaultValue="₹" />
              <Field label="Decimal places" defaultValue="2" type="number" />
              <Field label="Rounding">
                <Select defaultValue="nearest"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No rounding</SelectItem>
                    <SelectItem value="nearest">Nearest</SelectItem>
                    <SelectItem value="up">Round up</SelectItem>
                    <SelectItem value="down">Round down</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Financial year starts">
                <Select defaultValue="apr"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Jan","Apr","Jul","Oct"].map(m => <SelectItem key={m} value={m.toLowerCase()}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Default tax rate (%)" defaultValue="18" type="number" />
            </Grid>
            <Separator className="my-2" />
            <div className="grid gap-3">
              <ToggleRow label="Enable GST" desc="Show CGST / SGST / IGST split on invoices" defaultChecked />
              <ToggleRow label="Inclusive of tax by default" desc="Item rate already contains tax" />
              <ToggleRow label="Enable cess" desc="Additional cess on specific goods" />
              <ToggleRow label="Enable TDS" desc="Deduct tax at source on eligible invoices" defaultChecked />
              <ToggleRow label="Enable TCS" desc="Collect tax at source" />
              <ToggleRow label="Reverse charge (RCM)" desc="Show RCM option on invoices" />
            </div>
            <Separator className="my-2" />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="font-display font-semibold">TDS sections</div>
                <Button size="sm" variant="outline"><Plus className="mr-1 h-3.5 w-3.5" />Add section</Button>
              </div>
              <div className="rounded-xl border">
                {[
                  { s: "194C", d: "Contractor payments", r: "1%" },
                  { s: "194J", d: "Professional / technical", r: "10%" },
                  { s: "194H", d: "Commission / brokerage", r: "5%" },
                  { s: "194Q", d: "Purchase of goods", r: "0.1%" },
                ].map((t, i) => (
                  <div key={t.s} className={`grid grid-cols-[80px_minmax(0,1fr)_60px_40px] items-center gap-3 p-3 ${i ? "border-t" : ""}`}>
                    <Badge variant="outline" className="justify-center">{t.s}</Badge>
                    <div className="truncate text-sm">{t.d}</div>
                    <div className="text-right text-sm font-medium">{t.r}</div>
                    <Button size="icon" variant="ghost" className="h-8 w-8"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
            </div>
            <SaveBar onSave={save("Tax settings")} />
          </SectionCard>
        </TabsContent>

        {/* NUMBERING */}
        <TabsContent value="numbering">
          <SectionCard title="Document numbering" desc="Prefix, suffix and next number for each document type">
            <div className="grid gap-3">
              {[
                { k: "Invoice", p: "INV-", n: "1042" },
                { k: "Estimate", p: "EST-", n: "312" },
                { k: "Sale order", p: "SO-", n: "128" },
                { k: "Delivery note", p: "DN-", n: "76" },
                { k: "Sale return", p: "SR-", n: "18" },
                { k: "Purchase order", p: "PO-", n: "204" },
                { k: "Purchase", p: "PUR-", n: "612" },
                { k: "Purchase return", p: "PR-", n: "9" },
                { k: "Payment in", p: "RCPT-", n: "540" },
                { k: "Payment out", p: "PAY-", n: "301" },
                { k: "Expense", p: "EXP-", n: "220" },
              ].map(d => (
                <div key={d.k} className="grid grid-cols-1 items-end gap-3 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
                  <div className="grid gap-1.5"><Label>Document</Label><Input value={d.k} readOnly className="bg-muted/40" /></div>
                  <div className="grid gap-1.5"><Label>Prefix</Label><Input defaultValue={d.p} /></div>
                  <div className="grid gap-1.5"><Label>Next number</Label><Input defaultValue={d.n} type="number" /></div>
                  <div className="grid gap-1.5"><Label>Suffix</Label><Input placeholder="-25/26" /></div>
                  <div className="flex items-center gap-2 pb-0.5">
                    <Switch defaultChecked id={`auto-${d.k}`} />
                    <Label htmlFor={`auto-${d.k}`} className="text-xs">Auto</Label>
                  </div>
                </div>
              ))}
            </div>
            <SaveBar onSave={save("Numbering")} />
          </SectionCard>
        </TabsContent>

        {/* TEMPLATE */}
        <TabsContent value="template">
          <SectionCard title="Invoice template" desc="Choose a template and customise columns">
            <div className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
              <div className="grid gap-3">
                {["Classic Emerald", "Minimal Cream", "Bold Gold", "Compact GST", "Thermal 80mm"].map((t, i) => (
                  <button key={t} className={`rounded-xl border p-3 text-left transition hover:border-accent ${i === 0 ? "border-primary bg-primary/5" : ""}`}>
                    <div className="font-display font-semibold text-sm">{t}</div>
                    <div className="text-xs text-muted-foreground">Preview →</div>
                  </button>
                ))}
              </div>
              <div className="grid gap-4">
                <Grid>
                  <Field label="Accent colour" defaultValue="#064e3b" />
                  <Field label="Font">
                    <Select defaultValue="sora"><SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sora">Sora + Manrope</SelectItem>
                        <SelectItem value="inter">Inter</SelectItem>
                        <SelectItem value="roboto">Roboto</SelectItem>
                        <SelectItem value="serif">Playfair (serif)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Title label" defaultValue="TAX INVOICE" />
                  <Field label="Duplicate label" defaultValue="ORIGINAL / DUPLICATE / TRIPLICATE" />
                </Grid>
                <div className="grid gap-2 rounded-xl border p-3">
                  <div className="font-display font-semibold text-sm">Show on invoice</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {["Logo","Company address","GSTIN","PAN","Bank details","Signature","QR / UPI","Terms & conditions","Notes","Discount column","HSN / SAC","Tax split (CGST/SGST)","Received / balance","Item image","Batch / expiry","Serial number"].map(k => (
                      <label key={k} className="flex items-center gap-2 text-sm"><Switch defaultChecked={!["Item image","Batch / expiry","Serial number"].includes(k)} /> {k}</label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <SaveBar onSave={save("Template")} />
          </SectionCard>
        </TabsContent>

        {/* PAGE LAYOUT */}
        <TabsContent value="page">
          <SectionCard title="Page layout" desc="Paper size, orientation and margins for printing / PDF">
            <Grid>
              <Field label="Page size">
                <Select defaultValue="a4"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                    <SelectItem value="a5">A5 (148 × 210 mm)</SelectItem>
                    <SelectItem value="letter">Letter (8.5 × 11 in)</SelectItem>
                    <SelectItem value="legal">Legal (8.5 × 14 in)</SelectItem>
                    <SelectItem value="thermal80">Thermal 80 mm</SelectItem>
                    <SelectItem value="thermal58">Thermal 58 mm</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Orientation">
                <Select defaultValue="portrait"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Copies per print" defaultValue="1" type="number" />
              <Field label="Print scale (%)" defaultValue="100" type="number" />
              <Field label="Margin top (mm)" defaultValue="12" type="number" />
              <Field label="Margin right (mm)" defaultValue="10" type="number" />
              <Field label="Margin bottom (mm)" defaultValue="12" type="number" />
              <Field label="Margin left (mm)" defaultValue="10" type="number" />
              <Field label="Header height (mm)" defaultValue="24" type="number" />
              <Field label="Footer height (mm)" defaultValue="18" type="number" />
            </Grid>
            <Separator className="my-2" />
            <div className="grid gap-3">
              <ToggleRow label="Show page numbers" defaultChecked />
              <ToggleRow label="Repeat header on every page" defaultChecked />
              <ToggleRow label="Watermark 'PAID' when settled" />
              <ToggleRow label="Watermark 'DRAFT' when unsent" defaultChecked />
            </div>
            <SaveBar onSave={save("Page layout")} />
          </SectionCard>
        </TabsContent>

        {/* TERMS */}
        <TabsContent value="terms">
          <SectionCard title="Terms & conditions / Notes" desc="Default text printed at the bottom of documents">
            <div className="grid gap-4">
              <FullWidth><Label>Invoice terms</Label>
                <Textarea rows={4} defaultValue={"1. Goods once sold will not be taken back.\n2. Interest @ 18% p.a. on overdue bills.\n3. Subject to Mumbai jurisdiction."} />
              </FullWidth>
              <FullWidth><Label>Estimate terms</Label>
                <Textarea rows={3} defaultValue={"Quotation valid for 15 days. Prices exclusive of GST."} />
              </FullWidth>
              <FullWidth><Label>Purchase order terms</Label>
                <Textarea rows={3} defaultValue={"Delivery within 7 days. Payment against delivery."} />
              </FullWidth>
              <FullWidth><Label>Default notes</Label>
                <Textarea rows={2} placeholder="Thank you for your business!" defaultValue="Thank you for your business!" />
              </FullWidth>
            </div>
            <SaveBar onSave={save("Terms")} />
          </SectionCard>
        </TabsContent>

        {/* BANK */}
        <TabsContent value="bank">
          <SectionCard title="Bank accounts" desc="Shown on invoices for payment">
            <div className="grid gap-3">
              {[
                { n: "HDFC Bank — Current", a: "50100xxxxxx0021", i: "HDFC0000123" },
                { n: "ICICI Bank — Savings", a: "00281xxxxxx0044", i: "ICIC0000028" },
              ].map((b, idx) => (
                <div key={b.n} className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
                  <Field label="Account name" defaultValue={b.n} />
                  <Field label="Account holder" defaultValue="Prestige Store" />
                  <Field label="Account number" defaultValue={b.a} />
                  <Field label="IFSC" defaultValue={b.i} />
                  <Field label="Branch" defaultValue="Mumbai — Fort" />
                  <Field label="UPI ID" defaultValue={`prestige${idx + 1}@hdfcbank`} />
                  <FullWidth className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm"><Switch defaultChecked={idx === 0} /> Default account</label>
                    <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="mr-1 h-3.5 w-3.5" />Remove</Button>
                  </FullWidth>
                </div>
              ))}
              <Button variant="outline"><Plus className="mr-1.5 h-4 w-4" />Add bank account</Button>
            </div>
            <SaveBar onSave={save("Bank details")} />
          </SectionCard>
        </TabsContent>

        {/* SIGNATURE */}
        <TabsContent value="signature">
          <SectionCard title="Signature & stamp" desc="Printed on invoices and estimates">
            <div className="grid gap-4 md:grid-cols-2">
              <UploadRow label="Signature image" hint="Transparent PNG recommended" />
              <UploadRow label="Company stamp" hint="Square PNG works best" />
              <Field label="Authorised signatory" defaultValue="Rajesh Kumar" />
              <Field label="Designation" defaultValue="Proprietor" />
            </div>
            <ToggleRow label="Show signature on invoice" defaultChecked />
            <ToggleRow label="Show stamp on invoice" />
            <SaveBar onSave={save("Signature")} />
          </SectionCard>
        </TabsContent>

        {/* USERS & ROLES */}
        <TabsContent value="users">
          <SectionCard title="Users & roles" desc="Manage staff access and permissions">
            <div className="rounded-xl border">
              {[
                { n: "Rajesh Kumar", e: "owner@prestige.store", r: "Admin" },
                { n: "Priya Sharma", e: "priya@prestige.store", r: "Manager" },
                { n: "Amit Verma", e: "amit@prestige.store", r: "Cashier" },
              ].map((u, i) => (
                <div key={u.e} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_140px_auto] ${i ? "border-t" : ""}`}>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{u.n}</div>
                    <div className="truncate text-xs text-muted-foreground">{u.e}</div>
                  </div>
                  <Badge variant={u.r === "Admin" ? "default" : "secondary"} className="hidden justify-center sm:flex"><Shield className="mr-1 h-3 w-3" />{u.r}</Badge>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost">Edit</Button>
                    {u.r !== "Admin" && <Button size="sm" variant="ghost" className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline"><Plus className="mr-1.5 h-4 w-4" />Invite user</Button>
            <Separator className="my-2" />
            <div className="grid gap-2">
              <div className="font-display font-semibold text-sm">Role permissions</div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-muted/40 text-left">
                    <tr><th className="p-2">Module</th><th className="p-2 text-center">Admin</th><th className="p-2 text-center">Manager</th><th className="p-2 text-center">Cashier</th></tr>
                  </thead>
                  <tbody>
                    {["Invoices","Estimates","Products","Inventory","Payments","Reports","Settings"].map(m => (
                      <tr key={m} className="border-t">
                        <td className="p-2">{m}</td>
                        <td className="p-2 text-center"><Switch defaultChecked disabled /></td>
                        <td className="p-2 text-center"><Switch defaultChecked={m !== "Settings"} /></td>
                        <td className="p-2 text-center"><Switch defaultChecked={["Invoices","Payments"].includes(m)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <SaveBar onSave={save("Users & roles")} />
          </SectionCard>
        </TabsContent>

        {/* NOTIFICATIONS */}
        <TabsContent value="notifications">
          <SectionCard title="Notifications & reminders" desc="Email, SMS and WhatsApp alerts">
            <div className="grid gap-3">
              <ToggleRow label="New invoice created" desc="Notify owner when a new invoice is saved" defaultChecked />
              <ToggleRow label="Payment received" desc="Ping when a customer pays" defaultChecked />
              <ToggleRow label="Overdue invoice reminder" desc="Auto reminder 3, 7 and 15 days after due date" defaultChecked />
              <ToggleRow label="Low stock alert" desc="When any product falls below its minimum" defaultChecked />
              <ToggleRow label="Daily sales summary" desc="9:00 PM daily digest" />
              <ToggleRow label="Weekly report" desc="Every Monday morning" />
            </div>
            <Separator className="my-2" />
            <Grid>
              <Field label="Notification email" defaultValue="owner@prestige.store" />
              <Field label="SMS sender ID" defaultValue="PRSTGE" />
              <Field label="Reminder time" defaultValue="10:00" type="time" />
              <Field label="Timezone">
                <Select defaultValue="ist"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ist">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="dxb">Asia/Dubai</SelectItem>
                    <SelectItem value="utc">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Grid>
            <SaveBar onSave={save("Notifications")} />
          </SectionCard>
        </TabsContent>

        {/* BACKUP */}
        <TabsContent value="backup">
          <SectionCard title="Backup, import & export" desc="Keep your data safe">
            <div className="grid gap-3 sm:grid-cols-2">
              <ActionCard title="Export all data" desc="Download a full JSON backup" btn="Download backup" onClick={() => toast.success("Backup ready")} />
              <ActionCard title="Import data" desc="Restore from a previous backup file" btn="Choose file" onClick={() => toast.info("Choose a .json file")} />
              <ActionCard title="Export invoices (CSV)" desc="For accountant / Excel" btn="Export CSV" onClick={() => toast.success("CSV downloaded")} />
              <ActionCard title="Export products (CSV)" desc="Item master export" btn="Export CSV" onClick={() => toast.success("CSV downloaded")} />
            </div>
            <Separator className="my-2" />
            <div className="grid gap-3">
              <ToggleRow label="Auto backup daily" desc="Runs every night at 2:00 AM" defaultChecked />
              <ToggleRow label="Include images in backup" />
            </div>
            <Separator className="my-2" />
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
              <div className="font-display font-semibold text-destructive">Danger zone</div>
              <p className="mt-1 text-sm text-muted-foreground">Permanently delete all transactions. This cannot be undone.</p>
              <Button variant="destructive" size="sm" className="mt-3"><Trash2 className="mr-1.5 h-3.5 w-3.5" />Reset business data</Button>
            </div>
          </SectionCard>
        </TabsContent>

        {/* WHATSAPP */}
        <TabsContent value="whatsapp">
          <SectionCard title="WhatsApp" desc="Send invoices and reminders on WhatsApp (coming soon)">
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent"><MessageCircle className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold">WhatsApp Business</div>
                <div className="text-sm text-muted-foreground">Placeholder for future WhatsApp API integration.</div>
              </div>
            </div>
            <Grid>
              <Field label="WhatsApp display name" defaultValue="Prestige Store" />
              <Field label="Default WhatsApp number" placeholder="+91…" />
              <Field label="Business category" defaultValue="Retail" />
              <Field label="Reply-to number" defaultValue="+91 90000 00000" />
            </Grid>
            <FullWidth>
              <Label>Default message template</Label>
              <Textarea rows={3} defaultValue={"Hello {customer}, your invoice {number} of ₹{amount} is ready. Please find the copy attached. — Prestige Store"} />
            </FullWidth>
            <div className="grid gap-3">
              <ToggleRow label="Send invoice on WhatsApp automatically" />
              <ToggleRow label="Send payment reminders on WhatsApp" />
              <ToggleRow label="Send thank-you note after payment" defaultChecked />
            </div>
            <SaveBar onSave={save("WhatsApp")} />
          </SectionCard>
        </TabsContent>

        {/* APPEARANCE */}
        <TabsContent value="appearance">
          <SectionCard title="Appearance" desc="Theme, density and language">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <div className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-gold" />Theme</div>
                <div className="text-sm text-muted-foreground">Currently using <span className="capitalize font-medium text-foreground">{theme}</span> mode</div>
              </div>
              <Button variant="outline" onClick={toggle}>
                {theme === "dark" ? <><Sun className="mr-1.5 h-4 w-4" />Switch to light</> : <><Moon className="mr-1.5 h-4 w-4" />Switch to dark</>}
              </Button>
            </div>
            <Grid>
              <Field label="Language">
                <Select defaultValue="en"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="hi">हिन्दी</SelectItem>
                    <SelectItem value="ur">اردو</SelectItem>
                    <SelectItem value="mr">मराठी</SelectItem>
                    <SelectItem value="gu">ગુજરાતી</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Density">
                <Select defaultValue="comfortable"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="comfortable">Comfortable</SelectItem>
                    <SelectItem value="spacious">Spacious</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Date format">
                <Select defaultValue="dmy"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dmy">DD/MM/YYYY</SelectItem>
                    <SelectItem value="mdy">MM/DD/YYYY</SelectItem>
                    <SelectItem value="ymd">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Number format">
                <Select defaultValue="in"><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">1,23,456.78 (Indian)</SelectItem>
                    <SelectItem value="intl">123,456.78 (International)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Grid>
            <SaveBar onSave={save("Appearance")} />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- helpers ---------- */
function SectionCard({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <Card><CardContent className="grid gap-5 p-5 sm:p-6">
      <div>
        <div className="font-display text-lg font-semibold">{title}</div>
        {desc && <div className="text-sm text-muted-foreground">{desc}</div>}
      </div>
      {children}
    </CardContent></Card>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function FullWidth({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`md:col-span-2 grid gap-1.5 ${className}`}>{children}</div>;
}

function Field({ label, defaultValue, type = "text", placeholder, children }: { label: string; defaultValue?: string; type?: string; placeholder?: string; children?: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children ?? <Input type={type} defaultValue={defaultValue} placeholder={placeholder} />}
    </div>
  );
}

function ToggleRow({ label, desc, defaultChecked }: { label: string; desc?: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{label}</div>
        {desc && <div className="text-xs text-muted-foreground">{desc}</div>}
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}

function UploadRow({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed p-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Button variant="outline" size="sm"><Upload className="mr-1.5 h-3.5 w-3.5" />Upload</Button>
    </div>
  );
}

function ActionCard({ title, desc, btn, onClick }: { title: string; desc: string; btn: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="font-display font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground">{desc}</div>
      <Button variant="outline" size="sm" className="mt-3" onClick={onClick}>{btn}</Button>
    </div>
  );
}

function SaveBar({ onSave }: { onSave: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-2">
      <Button variant="ghost">Reset</Button>
      <Button onClick={onSave}>Save changes</Button>
    </div>
  );
}
