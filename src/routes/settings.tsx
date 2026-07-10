import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Bell,
  Boxes,
  Building2,
  ChevronRight,
  DatabaseBackup,
  FileBarChart,
  FileCog,
  FileSignature,
  FileText,
  Hash,
  Image,
  Landmark,
  ListChecks,
  LockKeyhole,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Palette,
  PenLine,
  Percent,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Stamp,
  Store,
  Trash2,
  Upload,
  UserCog,
  Users,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import type { AccountType } from "@/lib/dummy-data";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — UniPay Invoice Control" },
      {
        name: "description",
        content:
          "Complete invoice app settings: business, GST, TDS, numbering, template, print, users, Gmail, WhatsApp, backup and admin controls.",
      },
    ],
  }),
  component: SettingsPage,
});

type SectionKey = keyof SettingsState;
type ActiveKey = SectionKey | "accounts" | "fundManagement";
type Category = {
  key: ActiveKey;
  title: string;
  subtitle: string;
  icon: typeof Store;
  badge?: string;
  tone: string;
};

type SettingsState = {
  business: Record<string, string | boolean>;
  invoice: Record<string, string | boolean>;
  tax: Record<string, any>;
  terms: Record<string, string | boolean>;
  numbering: Record<string, string | boolean>;
  print: Record<string, string | boolean>;
  items: Record<string, string | boolean>;
  payment: Record<string, string | boolean>;
  bank: Record<string, string | boolean>;
  users: Record<string, string | boolean>;
  notifications: Record<string, string | boolean>;
  gmail: Record<string, string | boolean>;
  whatsapp: Record<string, string | boolean>;
  backup: Record<string, string | boolean>;
  appearance: Record<string, string | boolean>;
  security: Record<string, string | boolean>;
};

const defaults: SettingsState = {
  business: {
    businessName: "Prestige Store",
    legalName: "Prestige Store Pvt Ltd",
    ownerName: "Admin User",
    mobile: "+91 90000 00000",
    whatsapp: "+91 90000 00000",
    email: "billing@prestige.store",
    website: "prestige.store",
    gstin: "27PPPPP1234P1Z5",
    pan: "PPPPP1234P",
    address: "Main market, Mumbai, Maharashtra 400001",
    state: "Maharashtra",
    country: "India",
    showLogo: true,
    showBusinessStamp: true,
  },
  invoice: {
    title: "TAX INVOICE",
    duplicateLabel: "ORIGINAL FOR RECIPIENT",
    defaultDueDays: "7",
    invoiceType: "gst",
    itemDescription: true,
    hsn: true,
    mrp: false,
    batch: false,
    serial: false,
    discount: true,
    receivedBalance: true,
    qrCode: true,
    signature: true,
    terms: "Goods once sold will not be taken back. Subject to local jurisdiction.",
    notes: "Thank you for your business.",
  },
  tax: {
    currency: "INR",
    symbol: "₹",
    gstEnabled: true,
    discountScope: "perItem",
    taxScope: "perItem",
    taxList: [
      { id: "t1", name: "GST", pct: "18", inclusive: false, enabled: true },
    ],
    interstateTax: "auto",
    cess: false,
    tds: true,
    tcs: false,
    rcm: false,
    tds194c: "1",
    tds194j: "10",
    tds194h: "5",
    tds194q: "0.1",
  },
  terms: {
    invoiceTerms: "Goods once sold will not be taken back. Subject to local jurisdiction.",
    estimateTerms: "This estimate is valid for 15 days from the date of issue.",
    purchaseTerms: "Payment due within 30 days of invoice date.",
    purchaseOrderTerms: "3 Once will not be refunded.",
    saleOrderTerms: "Payment 30 days after invoice date, order will be charged.",
    deliveryNoteTerms: "Goods once delivered will not be returned unless a manufacturing defect is present.",
  },
  numbering: {
    invoicePrefix: "INV-",
    invoiceNext: "1042",
    estimatePrefix: "EST-",
    estimateNext: "312",
    saleOrderPrefix: "SO-",
    saleOrderNext: "128",
    purchaseOrderPrefix: "PO-",
    purchaseOrderNext: "1",
    deliveryPrefix: "DN-",
    deliveryNext: "76",
    purchasePrefix: "PUR-",
    purchaseNext: "612",
    saleReturnPrefix: "SR-",
    saleReturnNext: "1",
    purchaseReturnPrefix: "PR-",
    purchaseReturnNext: "1",
    paymentPrefix: "RCPT-",
    paymentNext: "540",
    expensePrefix: "EXP-",
    expenseNext: "220",
    subscriptionPrefix: "SUB-",
    subscriptionNext: "1",
    productionPrefix: "PR-",
    productionNext: "1",
    businessLicenceName: "GSTIN",
    country: "Pakistan",
    currency: "PKR",
    currencyMajorUnit: "Rupee",
    currencyMinorUnit: "Paisa",
    separator: "and",
    suffix: "only",
    numberFormat: "1,000,000.00",
    dateFormat: "dd-mm-yyyy",
    financialYear: "2026-27",
    autoReset: true,
  },
  print: {
    paper: "a4",
    orientation: "portrait",
    marginTop: "12",
    marginRight: "10",
    marginBottom: "12",
    marginLeft: "10",
    copies: "1",
    thermal: false,
    repeatHeader: true,
    pageNumbers: true,
    paidWatermark: true,
    draftWatermark: true,
  },
  items: {
    stockTracking: true,
    lowStockAlert: true,
    lowStockQty: "5",
    negativeStock: false,
    barcode: true,
    productImage: false,
    unit: "PCS",
    priceList: "Retail",
    purchasePrice: true,
    salePrice: true,
  },
  payment: {
    cash: true,
    bank: true,
    upi: true,
    card: true,
    wallet: true,
    partialPayment: true,
    roundOff: true,
    dueReminderDays: "3,7,15",
    defaultMethod: "upi",
  },
  bank: {
    accountName: "Prestige Store",
    bankName: "HDFC Bank",
    accountNumber: "50100xxxxxx0021",
    ifsc: "HDFC0000123",
    branch: "Mumbai Fort",
    upi: "prestige@hdfcbank",
    showOnInvoice: true,
  },
  users: {
    allowStaffInvoice: true,
    allowStaffDelete: false,
    allowCashierReports: false,
    requireAdminForSettings: true,
    defaultRole: "staff",
    inviteByEmail: true,
  },
  notifications: {
    invoiceCreated: true,
    paymentReceived: true,
    lowStock: true,
    dailySummary: false,
    weeklyReport: true,
    overdueReminder: true,
    ownerEmail: "owner@prestige.store",
    reminderTime: "10:00",
  },
  gmail: {
    fromName: "Prestige Store",
    fromEmail: "",
    replyTo: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    invoiceMail: true,
    estimateMail: true,
    paymentMail: true,
  },
  whatsapp: {
    displayName: "Prestige Store",
    number: "",
    provider: "not-connected",
    invoiceMessage:
      "Hello {customer}, your invoice {invoice_no} of {amount} is ready. Please find the copy attached.",
    reminderMessage:
      "Hello {customer}, payment of {amount} is pending for invoice {invoice_no}.",
    sendInvoice: false,
    sendReminder: false,
    sendPaymentThanks: true,
  },
  backup: {
    autoBackup: true,
    backupTime: "02:00",
    includeImages: true,
    exportFormat: "xlsx",
    lastBackup: "Not generated yet",
  },
  appearance: {
    language: "en",
    dateFormat: "dd-mm-yyyy",
    numberFormat: "indian",
    density: "comfortable",
    dashboardStyle: "tile-grid",
    colorTheme: "prestige",
  },
  security: {
    sessionTimeout: "60",
    requireStrongPassword: true,
    allowGoogleLogin: true,
    allowPasswordLogin: true,
    blockInactiveUser: true,
    auditLog: true,
  },
};

const categories: Category[] = [
  { key: "business", title: "Business Profile", subtitle: "Logo, GST, address", icon: Store, badge: "Main", tone: "text-primary bg-primary/10 ring-primary/20" },
  { key: "invoice", title: "Invoice Setup", subtitle: "Columns, terms, QR", icon: ReceiptText, badge: "A-Z", tone: "text-sapphire bg-sapphire/10 ring-sapphire/20" },
  { key: "tax", title: "Tax / GST / TDS", subtitle: "Rates and sections", icon: Percent, badge: "TDS", tone: "text-coral bg-coral/10 ring-coral/20" },
  { key: "terms", title: "Terms & Condition", subtitle: "Per-document terms text", icon: FileSignature, tone: "text-jade bg-jade/10 ring-jade/20" },
  { key: "accounts", title: "Accounts & Categories", subtitle: "Payment accounts & expense categories", icon: Landmark, tone: "text-orchid bg-orchid/10 ring-orchid/20" },
  { key: "fundManagement", title: "Fund Management", subtitle: "Transfer money between accounts", icon: ArrowLeftRight, tone: "text-aqua bg-aqua/10 ring-aqua/20" },
  { key: "numbering", title: "Prefix & Localization", subtitle: "Prefixes, country, currency, formats", icon: Hash, tone: "text-amber bg-amber/10 ring-amber/20" },
  { key: "print", title: "Page & Print", subtitle: "A4, thermal, PDF", icon: Printer, tone: "text-jade bg-jade/10 ring-jade/20" },
  { key: "items", title: "Items & Stock", subtitle: "Products, units, alerts", icon: Boxes, tone: "text-orchid bg-orchid/10 ring-orchid/20" },
  { key: "payment", title: "Payment", subtitle: "Cash, UPI, due", icon: WalletCards, tone: "text-aqua bg-aqua/10 ring-aqua/20" },
  { key: "bank", title: "Bank / UPI", subtitle: "Invoice bank details", icon: Landmark, tone: "text-primary bg-primary/10 ring-primary/20" },
  { key: "users", title: "Admin & Users", subtitle: "Roles and access", icon: ShieldCheck, badge: "Admin", tone: "text-coral bg-coral/10 ring-coral/20" },
  { key: "notifications", title: "Alerts", subtitle: "Reminders and reports", icon: Bell, tone: "text-amber bg-amber/10 ring-amber/20" },
  { key: "gmail", title: "Gmail / Email", subtitle: "SMTP templates", icon: Mail, badge: "Secret", tone: "text-sapphire bg-sapphire/10 ring-sapphire/20" },
  { key: "whatsapp", title: "WhatsApp", subtitle: "Future API setup", icon: MessageCircle, tone: "text-jade bg-jade/10 ring-jade/20" },
  { key: "backup", title: "Backup / Export", subtitle: "CSV, Excel, restore", icon: DatabaseBackup, tone: "text-orchid bg-orchid/10 ring-orchid/20" },
  { key: "appearance", title: "Appearance", subtitle: "Language and theme", icon: Palette, tone: "text-aqua bg-aqua/10 ring-aqua/20" },
  { key: "security", title: "Security", subtitle: "Login and audit", icon: LockKeyhole, tone: "text-primary bg-primary/10 ring-primary/20" },
];

function SettingsPage() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [active, setActive] = useState<ActiveKey>("business");
  const [settings, setSettings] = useState<SettingsState>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SectionKey | null>(null);

  const activeCategory = useMemo(() => categories.find((c) => c.key === active) ?? categories[0], [active]);

  useEffect(() => {
    let mounted = true;
    async function loadSettings() {
      setLoading(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .like("setting_key", "settings.%");
      if (!mounted) return;
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      const next = structuredClone(defaults) as SettingsState;
      for (const row of data ?? []) {
        const key = row.setting_key.replace("settings.", "") as SectionKey;
        if (key in next && row.setting_value && typeof row.setting_value === "object" && !Array.isArray(row.setting_value)) {
          next[key] = { ...next[key], ...(row.setting_value as Record<string, string | boolean>) };
        }
      }
      setSettings(next);
    }
    loadSettings();
    return () => { mounted = false; };
  }, []);

  const setField = (section: SectionKey, field: string, value: any) => {
    setSettings((current) => ({ ...current, [section]: { ...current[section], [field]: value } }));
  };

  const saveSection = async (section: SectionKey) => {
    setSaving(section);
    const settingKey = `settings.${section}`;
    const { data: existing, error: readError } = await supabase
      .from("app_settings")
      .select("id")
      .eq("setting_key", settingKey)
      .maybeSingle();
    if (readError) {
      setSaving(null);
      toast.error(readError.message);
      return;
    }

    const payload = {
      setting_key: settingKey,
      setting_value: settings[section],
      updated_by: user?.id ?? null,
    };
    const result = existing?.id
      ? await supabase.from("app_settings").update(payload).eq("id", existing.id)
      : await supabase.from("app_settings").insert(payload);

    setSaving(null);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`${activeCategory.title} saved`);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="UniPay-style complete control panel for invoice, tax, print, users, Gmail, WhatsApp and backup"
        action={
          <Button asChild variant="outline">
            <Link to="/team"><ShieldCheck className="mr-1.5 h-4 w-4" />Admin Control</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} label="Invoice controls" value="42+" />
        <StatCard icon={UserCog} label="Admin access" value={user?.role ?? "staff"} />
        <StatCard icon={MessageCircle} label="WhatsApp" value="Ready" />
        <StatCard icon={Mail} label="Gmail" value="Secure" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="xl:sticky xl:top-20 xl:self-start">
          <CardContent className="p-3">
            <div className="mb-2 flex items-center justify-between px-2 py-1">
              <div>
                <div className="font-display text-base font-semibold">All settings</div>
                <div className="text-xs text-muted-foreground">Tap any option to edit</div>
              </div>
              {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
              {categories.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => setActive(category.key)}
                  className={`group flex min-h-[82px] items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-muted/60 xl:min-h-0 ${active === category.key ? "border-primary bg-primary/5 shadow-sm" : "bg-card"}`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ${category.tone}`}>
                    <category.icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold leading-tight">{category.title}</span>
                      {category.badge && <Badge variant="secondary" className="hidden px-1.5 py-0 text-[10px] sm:inline-flex">{category.badge}</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{category.subtitle}</span>
                  </span>
                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground xl:block" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ring-1 ${activeCategory.tone}`}>
              <activeCategory.icon className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xl font-bold leading-tight">{activeCategory.title}</h1>
              <p className="text-sm text-muted-foreground">{activeCategory.subtitle}</p>
            </div>
            {active !== "accounts" && active !== "fundManagement" && (
              <Button onClick={() => saveSection(active as SectionKey)} disabled={saving === active}>
                {saving === active ? <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Save
              </Button>
            )}
          </div>

          {active === "business" && <BusinessPanel data={settings.business} set={(k, v) => setField("business", k, v)} />}
          {active === "invoice" && <InvoicePanel data={settings.invoice} set={(k, v) => setField("invoice", k, v)} />}
          {active === "tax" && <TaxPanel data={settings.tax} set={(k, v) => setField("tax", k, v)} />}
          {active === "terms" && <TermsPanel data={settings.terms} set={(k, v) => setField("terms", k, v)} />}
          {active === "accounts" && <AccountsPanel />}
          {active === "fundManagement" && <FundManagementPanel />}
          {active === "numbering" && <NumberingPanel data={settings.numbering} set={(k, v) => setField("numbering", k, v)} />}
          {active === "print" && <PrintPanel data={settings.print} set={(k, v) => setField("print", k, v)} />}
          {active === "items" && <ItemsPanel data={settings.items} set={(k, v) => setField("items", k, v)} />}
          {active === "payment" && <PaymentPanel data={settings.payment} set={(k, v) => setField("payment", k, v)} />}
          {active === "bank" && <BankPanel data={settings.bank} set={(k, v) => setField("bank", k, v)} />}
          {active === "users" && <UsersPanel data={settings.users} set={(k, v) => setField("users", k, v)} />}
          {active === "notifications" && <NotificationsPanel data={settings.notifications} set={(k, v) => setField("notifications", k, v)} />}
          {active === "gmail" && <GmailPanel data={settings.gmail} set={(k, v) => setField("gmail", k, v)} />}
          {active === "whatsapp" && <WhatsAppPanel data={settings.whatsapp} set={(k, v) => setField("whatsapp", k, v)} />}
          {active === "backup" && <BackupPanel data={settings.backup} set={(k, v) => setField("backup", k, v)} />}
          {active === "appearance" && <AppearancePanel data={settings.appearance} set={(k, v) => setField("appearance", k, v)} theme={theme} toggleTheme={toggle} />}
          {active === "security" && <SecurityPanel data={settings.security} set={(k, v) => setField("security", k, v)} />}
        </div>
      </div>
    </div>
  );
}

function BusinessPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={Building2} title="Business identity" subtitle="This information prints on every invoice and report." />
      <Grid>
        <TextField label="Business / shop name" value={data.businessName} onChange={(v) => set("businessName", v)} />
        <TextField label="Legal / registered name" value={data.legalName} onChange={(v) => set("legalName", v)} />
        <TextField label="Owner / admin name" value={data.ownerName} onChange={(v) => set("ownerName", v)} />
        <TextField label="Mobile number" value={data.mobile} onChange={(v) => set("mobile", v)} />
        <TextField label="WhatsApp number" value={data.whatsapp} onChange={(v) => set("whatsapp", v)} />
        <TextField label="Email" value={data.email} onChange={(v) => set("email", v)} type="email" />
        <TextField label="Website" value={data.website} onChange={(v) => set("website", v)} />
        <TextField label="GSTIN" value={data.gstin} onChange={(v) => set("gstin", v)} />
        <TextField label="PAN" value={data.pan} onChange={(v) => set("pan", v)} />
        <TextField label="State" value={data.state} onChange={(v) => set("state", v)} />
        <TextField label="Country" value={data.country} onChange={(v) => set("country", v)} />
        <TextAreaField label="Full business address" value={data.address} onChange={(v) => set("address", v)} />
      </Grid>
      <div className="grid gap-3 md:grid-cols-2">
        <UploadBox icon={Image} title="Business logo" subtitle="Used in invoice header" />
        <UploadBox icon={Stamp} title="Shop stamp" subtitle="Optional stamp image" />
      </div>
      <ToggleGrid>
        <ToggleField label="Show logo on invoice" checked={data.showLogo} onChange={(v) => set("showLogo", v)} />
        <ToggleField label="Show stamp on invoice" checked={data.showBusinessStamp} onChange={(v) => set("showBusinessStamp", v)} />
      </ToggleGrid>
    </Panel>
  );
}

function InvoicePanel({ data, set }: PanelProps) {
  const columns = [
    ["itemDescription", "Description column"], ["hsn", "HSN / SAC"], ["mrp", "MRP column"], ["batch", "Batch / expiry"],
    ["serial", "Serial number"], ["discount", "Discount column"], ["receivedBalance", "Received / balance"],
    ["qrCode", "UPI QR code"], ["signature", "Signature area"],
  ] as const;
  return (
    <Panel>
      <PanelHeader icon={FileCog} title="Invoice design and fields" subtitle="Controls every line, label and section on create-invoice and print." />
      <Grid>
        <TextField label="Invoice title" value={data.title} onChange={(v) => set("title", v)} />
        <TextField label="Copy label" value={data.duplicateLabel} onChange={(v) => set("duplicateLabel", v)} />
        <TextField label="Default due days" value={data.defaultDueDays} onChange={(v) => set("defaultDueDays", v)} type="number" />
        <SelectField label="Invoice type" value={data.invoiceType} onChange={(v) => set("invoiceType", v)} options={["gst", "bill-of-supply", "proforma", "retail", "export"]} />
      </Grid>
      <SettingBlock title="Visible invoice columns" icon={ListChecks}>
        <ToggleGrid>
          {columns.map(([key, label]) => <ToggleField key={key} label={label} checked={data[key]} onChange={(v) => set(key, v)} />)}
        </ToggleGrid>
      </SettingBlock>
      <Grid>
        <TextAreaField label="Default invoice notes" value={data.notes} onChange={(v) => set("notes", v)} />
      </Grid>
    </Panel>
  );
}

function TaxPanel({ data, set }: PanelProps) {
  const taxList: { id: string; name: string; pct: string; inclusive: boolean; enabled: boolean }[] = data.taxList ?? [];

  const updateTax = (id: string, patch: Partial<(typeof taxList)[number]>) => {
    set("taxList", taxList.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const addTax = () => {
    set("taxList", [...taxList, { id: `t${Date.now()}`, name: "New Tax", pct: "0", inclusive: false, enabled: true }]);
  };
  const removeTax = (id: string) => set("taxList", taxList.filter((t) => t.id !== id));

  return (
    <Panel>
      <PanelHeader icon={Percent} title="Tax, GST, TDS and currency" subtitle="Default calculations for invoice, purchase and payment entries." />
      <Grid>
        <SelectField label="Currency" value={data.currency} onChange={(v) => set("currency", v)} options={["INR", "USD", "EUR", "GBP", "AED", "PKR"]} />
        <TextField label="Currency symbol" value={data.symbol} onChange={(v) => set("symbol", v)} />
        <SelectField label="Interstate GST" value={data.interstateTax} onChange={(v) => set("interstateTax", v)} options={["auto", "igst", "cgst-sgst"]} />
      </Grid>

      <SettingBlock title="Discount setting" icon={Percent}>
        <div className="inline-flex rounded-lg border bg-muted/40 p-1">
          {(["perItem", "overallBill"] as const).map((v) => (
            <button key={v} type="button" onClick={() => set("discountScope", v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${data.discountScope === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {v === "perItem" ? "Per Item" : "Overall Bill"}
            </button>
          ))}
        </div>
      </SettingBlock>

      <SettingBlock title="Tax setting" icon={Percent}>
        <div className="mb-3 inline-flex rounded-lg border bg-muted/40 p-1">
          {(["perItem", "overallBill"] as const).map((v) => (
            <button key={v} type="button" onClick={() => set("taxScope", v)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${data.taxScope === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {v === "perItem" ? "Per Item" : "Overall Bill"}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {taxList.map((t) => (
            <div key={t.id} className="grid grid-cols-[1fr_90px_auto_auto_auto] items-center gap-2 rounded-lg border bg-card p-2">
              <Input value={t.name} onChange={(e) => updateTax(t.id, { name: e.target.value })} placeholder="Tax name" />
              <Input type="number" value={t.pct} onChange={(e) => updateTax(t.id, { pct: e.target.value })} placeholder="%" />
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Switch checked={t.inclusive} onCheckedChange={(v) => updateTax(t.id, { inclusive: v })} />
                Inclusive
              </label>
              <Switch checked={t.enabled} onCheckedChange={(v) => updateTax(t.id, { enabled: v })} />
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeTax(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addTax}><Plus className="mr-1.5 h-4 w-4" />Add new tax</Button>
      </SettingBlock>

      <ToggleGrid>
        <ToggleField label="Enable GST" checked={data.gstEnabled} onChange={(v) => set("gstEnabled", v)} />
        <ToggleField label="Enable cess" checked={data.cess} onChange={(v) => set("cess", v)} />
        <ToggleField label="Enable TDS" checked={data.tds} onChange={(v) => set("tds", v)} />
        <ToggleField label="Enable TCS" checked={data.tcs} onChange={(v) => set("tcs", v)} />
        <ToggleField label="Reverse charge (RCM)" checked={data.rcm} onChange={(v) => set("rcm", v)} />
      </ToggleGrid>
      <SettingBlock title="TDS sections" icon={Percent}>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="194C Contractor %" value={data.tds194c} onChange={(v) => set("tds194c", v)} type="number" />
          <TextField label="194J Professional %" value={data.tds194j} onChange={(v) => set("tds194j", v)} type="number" />
          <TextField label="194H Commission %" value={data.tds194h} onChange={(v) => set("tds194h", v)} type="number" />
          <TextField label="194Q Purchase %" value={data.tds194q} onChange={(v) => set("tds194q", v)} type="number" />
        </div>
      </SettingBlock>
    </Panel>
  );
}

function TermsPanel({ data, set }: PanelProps) {
  const fields: [string, string][] = [
    ["invoiceTerms", "Invoice Terms & Condition"],
    ["estimateTerms", "Estimate Terms & Condition"],
    ["purchaseTerms", "Purchase Terms & Condition"],
    ["purchaseOrderTerms", "Purchase Order Terms & Condition"],
    ["saleOrderTerms", "Sale Order Terms & Condition"],
    ["deliveryNoteTerms", "Delivery Note Terms & Condition"],
  ];
  return (
    <Panel>
      <PanelHeader icon={FileSignature} title="Terms & Condition" subtitle="Separate terms shown on each document type — invoices, estimates, purchases, etc." />
      <div className="grid gap-4">
        {fields.map(([key, label]) => (
          <div key={key} className="grid gap-1.5 rounded-lg border bg-card p-3">
            <Label className="text-sm font-semibold">{label}</Label>
            <Textarea rows={2} value={data[key] ?? ""} onChange={(e) => set(key, e.target.value)} placeholder="Write your terms and conditions…" />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AccountsPanel() {
  const { accounts, addAccount, updateAccount, deleteAccount } = useStore();
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("payment");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setSaving(true);
    try {
      await addAccount({ name: name.trim(), accountType, openingBalance, openingDate });
      toast.success("Account created");
      setName(""); setOpeningBalance(0); setOpeningDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <PanelHeader icon={Landmark} title="Accounts & Categories" subtitle="Create accounts for payments, expenses, and warehouses. Helps organize and track your money and stock." />
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[140px_1fr_140px_160px_auto]">
        <SelectField label="Select Type" value={accountType} onChange={(v) => setAccountType(v as AccountType)} options={["payment", "category"]} />
        <TextField label="Name" value={name} onChange={setName} />
        <TextField label="Opening Balance" value={String(openingBalance)} onChange={(v) => setOpeningBalance(+v || 0)} type="number" />
        <TextField label="Opening Date" value={openingDate} onChange={setOpeningDate} type="date" />
        <Button className="self-end" onClick={create} disabled={saving}><Plus className="mr-1.5 h-4 w-4" />Add</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-right">Opening</th><th className="px-3 py-2 text-right">Current Balance</th><th className="px-3 py-2 text-left">Date</th><th /></tr>
          </thead>
          <tbody>
            {accounts.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No accounts yet</td></tr>}
            {accounts.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="px-3 py-2 font-medium">{a.name}</td>
                <td className="px-3 py-2 capitalize text-muted-foreground">{a.accountType}</td>
                <td className="px-3 py-2 text-right">{a.openingBalance.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-semibold">{a.currentBalance.toFixed(2)}</td>
                <td className="px-3 py-2 text-muted-foreground">{a.openingDate}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={async () => { try { await deleteAccount(a.id); toast.success("Deleted"); } catch (err) { toast.error(err instanceof Error ? err.message : "Could not delete"); } }}
                    className="text-destructive hover:underline"
                  >Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function FundManagementPanel() {
  const { accounts, fundTransfers, addFundTransfer } = useStore();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";

  const transfer = async () => {
    if (!fromId || !toId) return toast.error("Select both accounts");
    if (amount <= 0) return toast.error("Enter an amount");
    setSaving(true);
    try {
      await addFundTransfer({ fromAccountId: fromId, toAccountId: toId, amount, remarks, date: new Date().toISOString().slice(0, 10) });
      toast.success("Transfer recorded");
      setFromId(""); setToId(""); setAmount(0); setRemarks("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record transfer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <PanelHeader icon={ArrowLeftRight} title="Fund Management" subtitle="Transfer money between payment accounts. Keeps proper records of fund movement." />
      {accounts.length === 0 ? (
        <div className="rounded-lg border bg-muted/25 p-4 text-sm text-muted-foreground">
          Create at least two accounts under "Accounts & Categories" first.
        </div>
      ) : (
        <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>From Account</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currentBalance.toFixed(2)})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>To Account</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name} ({a.currentBalance.toFixed(2)})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <TextField label="Amount" value={String(amount)} onChange={(v) => setAmount(+v || 0)} type="number" />
          <TextField label="Remarks" value={remarks} onChange={setRemarks} />
          <Button className="sm:col-span-2" onClick={transfer} disabled={saving}>{saving ? "Transferring…" : "Transfer"}</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">From</th><th className="px-3 py-2 text-left">To</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Remarks</th></tr>
          </thead>
          <tbody>
            {fundTransfers.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No transfers yet</td></tr>}
            {fundTransfers.map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-2 text-muted-foreground">{f.date}</td>
                <td className="px-3 py-2">{accountName(f.fromAccountId)}</td>
                <td className="px-3 py-2">{accountName(f.toAccountId)}</td>
                <td className="px-3 py-2 text-right font-semibold">{f.amount.toFixed(2)}</td>
                <td className="px-3 py-2 text-muted-foreground">{f.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function NumberingPanel({ data, set }: PanelProps) {
  const docs = [
    ["Invoice", "invoicePrefix", "invoiceNext"], ["Estimate", "estimatePrefix", "estimateNext"],
    ["Purchase", "purchasePrefix", "purchaseNext"], ["Purchase Order", "purchaseOrderPrefix", "purchaseOrderNext"],
    ["Sale Order", "saleOrderPrefix", "saleOrderNext"], ["Receipt", "paymentPrefix", "paymentNext"],
    ["Expense", "expensePrefix", "expenseNext"], ["Sale Return", "saleReturnPrefix", "saleReturnNext"],
    ["Purchase Return", "purchaseReturnPrefix", "purchaseReturnNext"], ["Delivery Note", "deliveryPrefix", "deliveryNext"],
    ["Subscription", "subscriptionPrefix", "subscriptionNext"], ["Production", "productionPrefix", "productionNext"],
  ] as const;
  return (
    <Panel>
      <PanelHeader icon={Hash} title="Prefix & Localization" subtitle="Prefix, next number and yearly reset for every document, plus country, currency and format." />
      <Grid>
        <TextField label="Financial year label" value={data.financialYear} onChange={(v) => set("financialYear", v)} />
        <ToggleField label="Auto reset numbers every financial year" checked={data.autoReset} onChange={(v) => set("autoReset", v)} />
      </Grid>
      <div className="grid gap-3">
        {docs.map(([label, prefix, next]) => (
          <div key={label} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_140px_140px]">
            <div className="flex items-center gap-3 font-medium"><FileText className="h-4 w-4 text-primary" />{label}</div>
            <TextField label="Prefix" value={data[prefix]} onChange={(v) => set(prefix, v)} />
            <TextField label="Next no." value={data[next]} onChange={(v) => set(next, v)} type="number" />
          </div>
        ))}
      </div>

      <SettingBlock title="Country & currency" icon={Landmark}>
        <Grid>
          <TextField label="Country" value={data.country} onChange={(v) => set("country", v)} />
          <TextField label="Currency" value={data.currency} onChange={(v) => set("currency", v)} />
          <TextField label="Currency major unit" value={data.currencyMajorUnit} onChange={(v) => set("currencyMajorUnit", v)} placeholder="e.g. Dollar / Euro / Rupee" />
          <TextField label="Currency minor unit" value={data.currencyMinorUnit} onChange={(v) => set("currencyMinorUnit", v)} placeholder="e.g. Cent / Paisa" />
          <TextField label="Separator (amount in words)" value={data.separator} onChange={(v) => set("separator", v)} />
          <TextField label="Suffix (amount in words)" value={data.suffix} onChange={(v) => set("suffix", v)} />
          <SelectField label="Number format" value={data.numberFormat} onChange={(v) => set("numberFormat", v)} options={["1,000,000.00", "10,00,000.00", "1.000.000,00", "1 000 000.00"]} />
          <SelectField label="Date format" value={data.dateFormat} onChange={(v) => set("dateFormat", v)} options={["dd-mm-yyyy", "mm-dd-yyyy", "yyyy-mm-dd"]} />
          <TextField label="Business Licence Name" value={data.businessLicenceName} onChange={(v) => set("businessLicenceName", v)} placeholder="e.g. GSTIN / VAT" />
        </Grid>
      </SettingBlock>
    </Panel>
  );
}

function PrintPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={Printer} title="Page layout and print" subtitle="A4, A5, thermal print, PDF margins and watermarks." />
      <Grid>
        <SelectField label="Paper size" value={data.paper} onChange={(v) => set("paper", v)} options={["a4", "a5", "letter", "legal", "thermal-80mm", "thermal-58mm"]} />
        <SelectField label="Orientation" value={data.orientation} onChange={(v) => set("orientation", v)} options={["portrait", "landscape"]} />
        <TextField label="Top margin (mm)" value={data.marginTop} onChange={(v) => set("marginTop", v)} type="number" />
        <TextField label="Right margin (mm)" value={data.marginRight} onChange={(v) => set("marginRight", v)} type="number" />
        <TextField label="Bottom margin (mm)" value={data.marginBottom} onChange={(v) => set("marginBottom", v)} type="number" />
        <TextField label="Left margin (mm)" value={data.marginLeft} onChange={(v) => set("marginLeft", v)} type="number" />
        <TextField label="Copies per print" value={data.copies} onChange={(v) => set("copies", v)} type="number" />
      </Grid>
      <ToggleGrid>
        <ToggleField label="Thermal printer mode" checked={data.thermal} onChange={(v) => set("thermal", v)} />
        <ToggleField label="Repeat header on each page" checked={data.repeatHeader} onChange={(v) => set("repeatHeader", v)} />
        <ToggleField label="Show page numbers" checked={data.pageNumbers} onChange={(v) => set("pageNumbers", v)} />
        <ToggleField label="Paid watermark" checked={data.paidWatermark} onChange={(v) => set("paidWatermark", v)} />
        <ToggleField label="Draft watermark" checked={data.draftWatermark} onChange={(v) => set("draftWatermark", v)} />
      </ToggleGrid>
    </Panel>
  );
}

function ItemsPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={Boxes} title="Product, service and inventory" subtitle="Stock controls used by products, purchases and invoices." />
      <Grid>
        <TextField label="Default unit" value={data.unit} onChange={(v) => set("unit", v)} />
        <TextField label="Low stock quantity" value={data.lowStockQty} onChange={(v) => set("lowStockQty", v)} type="number" />
        <SelectField label="Default price list" value={data.priceList} onChange={(v) => set("priceList", v)} options={["Retail", "Wholesale", "Distributor", "MRP"]} />
      </Grid>
      <ToggleGrid>
        <ToggleField label="Track stock" checked={data.stockTracking} onChange={(v) => set("stockTracking", v)} />
        <ToggleField label="Low stock alert" checked={data.lowStockAlert} onChange={(v) => set("lowStockAlert", v)} />
        <ToggleField label="Allow negative stock" checked={data.negativeStock} onChange={(v) => set("negativeStock", v)} />
        <ToggleField label="Barcode field" checked={data.barcode} onChange={(v) => set("barcode", v)} />
        <ToggleField label="Product image" checked={data.productImage} onChange={(v) => set("productImage", v)} />
        <ToggleField label="Purchase price" checked={data.purchasePrice} onChange={(v) => set("purchasePrice", v)} />
        <ToggleField label="Sale price" checked={data.salePrice} onChange={(v) => set("salePrice", v)} />
      </ToggleGrid>
    </Panel>
  );
}

function PaymentPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={Banknote} title="Payment and due settings" subtitle="Payment modes, partial payments, due reminders and rounding." />
      <Grid>
        <SelectField label="Default payment method" value={data.defaultMethod} onChange={(v) => set("defaultMethod", v)} options={["cash", "upi", "bank", "card", "wallet"]} />
        <TextField label="Due reminder days" value={data.dueReminderDays} onChange={(v) => set("dueReminderDays", v)} />
      </Grid>
      <ToggleGrid>
        <ToggleField label="Cash" checked={data.cash} onChange={(v) => set("cash", v)} />
        <ToggleField label="Bank transfer" checked={data.bank} onChange={(v) => set("bank", v)} />
        <ToggleField label="UPI" checked={data.upi} onChange={(v) => set("upi", v)} />
        <ToggleField label="Card" checked={data.card} onChange={(v) => set("card", v)} />
        <ToggleField label="Wallet" checked={data.wallet} onChange={(v) => set("wallet", v)} />
        <ToggleField label="Partial payment" checked={data.partialPayment} onChange={(v) => set("partialPayment", v)} />
        <ToggleField label="Round off totals" checked={data.roundOff} onChange={(v) => set("roundOff", v)} />
      </ToggleGrid>
    </Panel>
  );
}

function BankPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={Landmark} title="Bank account and UPI" subtitle="Details printed in invoice payment section." />
      <Grid>
        <TextField label="Account holder" value={data.accountName} onChange={(v) => set("accountName", v)} />
        <TextField label="Bank name" value={data.bankName} onChange={(v) => set("bankName", v)} />
        <TextField label="Account number" value={data.accountNumber} onChange={(v) => set("accountNumber", v)} />
        <TextField label="IFSC / routing code" value={data.ifsc} onChange={(v) => set("ifsc", v)} />
        <TextField label="Branch" value={data.branch} onChange={(v) => set("branch", v)} />
        <TextField label="UPI ID" value={data.upi} onChange={(v) => set("upi", v)} />
      </Grid>
      <ToggleField label="Show bank / UPI details on invoice" checked={data.showOnInvoice} onChange={(v) => set("showOnInvoice", v)} />
    </Panel>
  );
}

function UsersPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={Users} title="Admin, users and permissions" subtitle="Global permission defaults. Real member control is in Admin Control." />
      <div className="rounded-lg border bg-muted/25 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Team member management</div>
            <div className="text-sm text-muted-foreground">Open Admin Control to create admin, block users and change live roles.</div>
          </div>
          <Button asChild><Link to="/team"><ShieldCheck className="mr-1.5 h-4 w-4" />Open Admin Control</Link></Button>
        </div>
      </div>
      <Grid>
        <SelectField label="Default role for new users" value={data.defaultRole} onChange={(v) => set("defaultRole", v)} options={["staff", "cashier", "manager", "admin"]} />
      </Grid>
      <ToggleGrid>
        <ToggleField label="Staff can create invoices" checked={data.allowStaffInvoice} onChange={(v) => set("allowStaffInvoice", v)} />
        <ToggleField label="Staff can delete records" checked={data.allowStaffDelete} onChange={(v) => set("allowStaffDelete", v)} />
        <ToggleField label="Cashier can view reports" checked={data.allowCashierReports} onChange={(v) => set("allowCashierReports", v)} />
        <ToggleField label="Admin required for settings" checked={data.requireAdminForSettings} onChange={(v) => set("requireAdminForSettings", v)} />
        <ToggleField label="Invite users by email" checked={data.inviteByEmail} onChange={(v) => set("inviteByEmail", v)} />
      </ToggleGrid>
    </Panel>
  );
}

function NotificationsPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={Bell} title="Notifications and reminders" subtitle="Invoice, payment, stock and report alerts." />
      <Grid>
        <TextField label="Owner notification email" value={data.ownerEmail} onChange={(v) => set("ownerEmail", v)} type="email" />
        <TextField label="Reminder time" value={data.reminderTime} onChange={(v) => set("reminderTime", v)} type="time" />
      </Grid>
      <ToggleGrid>
        <ToggleField label="Invoice created" checked={data.invoiceCreated} onChange={(v) => set("invoiceCreated", v)} />
        <ToggleField label="Payment received" checked={data.paymentReceived} onChange={(v) => set("paymentReceived", v)} />
        <ToggleField label="Low stock alert" checked={data.lowStock} onChange={(v) => set("lowStock", v)} />
        <ToggleField label="Daily summary" checked={data.dailySummary} onChange={(v) => set("dailySummary", v)} />
        <ToggleField label="Weekly report" checked={data.weeklyReport} onChange={(v) => set("weeklyReport", v)} />
        <ToggleField label="Overdue reminder" checked={data.overdueReminder} onChange={(v) => set("overdueReminder", v)} />
      </ToggleGrid>
    </Panel>
  );
}

function GmailPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={Mail} title="Gmail / Email setup" subtitle="Password is stored only in project secrets; this screen keeps non-secret mail settings." />
      <div className="rounded-lg border border-amber/40 bg-amber/10 p-4 text-sm">
        Gmail password / app password is not shown here for security. Use the saved secret for backend mail sending; never paste it into visible UI.
      </div>
      <Grid>
        <TextField label="From name" value={data.fromName} onChange={(v) => set("fromName", v)} />
        <TextField label="From Gmail" value={data.fromEmail} onChange={(v) => set("fromEmail", v)} type="email" />
        <TextField label="Reply-to email" value={data.replyTo} onChange={(v) => set("replyTo", v)} type="email" />
        <TextField label="SMTP host" value={data.smtpHost} onChange={(v) => set("smtpHost", v)} />
        <TextField label="SMTP port" value={data.smtpPort} onChange={(v) => set("smtpPort", v)} type="number" />
      </Grid>
      <ToggleGrid>
        <ToggleField label="Email invoice after save" checked={data.invoiceMail} onChange={(v) => set("invoiceMail", v)} />
        <ToggleField label="Email estimate" checked={data.estimateMail} onChange={(v) => set("estimateMail", v)} />
        <ToggleField label="Email payment receipt" checked={data.paymentMail} onChange={(v) => set("paymentMail", v)} />
      </ToggleGrid>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => toast.info("Email test will be connected after mail backend step")}><Send className="mr-1.5 h-4 w-4" />Send test email</Button>
      </div>
    </Panel>
  );
}

function WhatsAppPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={MessageCircle} title="WhatsApp" subtitle="Placeholder and templates for the separate WhatsApp API process." />
      <Grid>
        <TextField label="WhatsApp display name" value={data.displayName} onChange={(v) => set("displayName", v)} />
        <TextField label="WhatsApp number" value={data.number} onChange={(v) => set("number", v)} />
        <SelectField label="Provider status" value={data.provider} onChange={(v) => set("provider", v)} options={["not-connected", "business-api", "blito", "manual"]} />
        <TextAreaField label="Invoice message template" value={data.invoiceMessage} onChange={(v) => set("invoiceMessage", v)} />
        <TextAreaField label="Reminder message template" value={data.reminderMessage} onChange={(v) => set("reminderMessage", v)} />
      </Grid>
      <ToggleGrid>
        <ToggleField label="Send invoice on WhatsApp" checked={data.sendInvoice} onChange={(v) => set("sendInvoice", v)} />
        <ToggleField label="Send due reminders" checked={data.sendReminder} onChange={(v) => set("sendReminder", v)} />
        <ToggleField label="Thank-you after payment" checked={data.sendPaymentThanks} onChange={(v) => set("sendPaymentThanks", v)} />
      </ToggleGrid>
    </Panel>
  );
}

function BackupPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={DatabaseBackup} title="Backup, import and export" subtitle="Business data safety tools." />
      <Grid>
        <TextField label="Backup time" value={data.backupTime} onChange={(v) => set("backupTime", v)} type="time" />
        <SelectField label="Export format" value={data.exportFormat} onChange={(v) => set("exportFormat", v)} options={["xlsx", "csv", "json", "pdf"]} />
        <TextField label="Last backup" value={data.lastBackup} onChange={(v) => set("lastBackup", v)} />
      </Grid>
      <ToggleGrid>
        <ToggleField label="Auto backup daily" checked={data.autoBackup} onChange={(v) => set("autoBackup", v)} />
        <ToggleField label="Include images" checked={data.includeImages} onChange={(v) => set("includeImages", v)} />
      </ToggleGrid>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ActionButton icon={DatabaseBackup} label="Download backup" />
        <ActionButton icon={Upload} label="Import backup" />
        <ActionButton icon={FileBarChart} label="Export Excel" />
        <ActionButton icon={Trash2} label="Reset data" danger />
      </div>
    </Panel>
  );
}

function AppearancePanel({ data, set, theme, toggleTheme }: PanelProps & { theme: string; toggleTheme: () => void }) {
  return (
    <Panel>
      <PanelHeader icon={Palette} title="Appearance and app format" subtitle="Language, dashboard style, dates and visual density." />
      <Grid>
        <SelectField label="Language" value={data.language} onChange={(v) => set("language", v)} options={["en", "ur", "hi", "ar"]} />
        <SelectField label="Date format" value={data.dateFormat} onChange={(v) => set("dateFormat", v)} options={["dd-mm-yyyy", "mm-dd-yyyy", "yyyy-mm-dd"]} />
        <SelectField label="Number format" value={data.numberFormat} onChange={(v) => set("numberFormat", v)} options={["indian", "international"]} />
        <SelectField label="Screen density" value={data.density} onChange={(v) => set("density", v)} options={["compact", "comfortable", "spacious"]} />
        <SelectField label="Dashboard style" value={data.dashboardStyle} onChange={(v) => set("dashboardStyle", v)} options={["tile-grid", "list", "analytics"]} />
        <SelectField label="Color theme" value={data.colorTheme} onChange={(v) => set("colorTheme", v)} options={["prestige", "emerald", "blue", "gold"]} />
      </Grid>
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <div className="font-semibold">Current theme</div>
          <div className="text-sm capitalize text-muted-foreground">{theme}</div>
        </div>
        <Button variant="outline" onClick={toggleTheme}><MonitorSmartphone className="mr-1.5 h-4 w-4" />Toggle theme</Button>
      </div>
    </Panel>
  );
}

function SecurityPanel({ data, set }: PanelProps) {
  return (
    <Panel>
      <PanelHeader icon={LockKeyhole} title="Security and login" subtitle="Password login, Google login, session timeout and audit controls." />
      <Grid>
        <TextField label="Session timeout minutes" value={data.sessionTimeout} onChange={(v) => set("sessionTimeout", v)} type="number" />
      </Grid>
      <ToggleGrid>
        <ToggleField label="Require strong password" checked={data.requireStrongPassword} onChange={(v) => set("requireStrongPassword", v)} />
        <ToggleField label="Allow Google login" checked={data.allowGoogleLogin} onChange={(v) => set("allowGoogleLogin", v)} />
        <ToggleField label="Allow password login" checked={data.allowPasswordLogin} onChange={(v) => set("allowPasswordLogin", v)} />
        <ToggleField label="Block inactive users" checked={data.blockInactiveUser} onChange={(v) => set("blockInactiveUser", v)} />
        <ToggleField label="Keep audit log" checked={data.auditLog} onChange={(v) => set("auditLog", v)} />
      </ToggleGrid>
    </Panel>
  );
}

type PanelProps = {
  data: Record<string, any>;
  set: (field: string, value: any) => void;
};

function Panel({ children }: { children: ReactNode }) {
  return <Card><CardContent className="space-y-5 p-4 sm:p-5">{children}</CardContent></Card>;
}

function PanelHeader({ icon: Icon, title, subtitle }: { icon: typeof Store; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="font-display text-lg font-bold">{title}</div>
        <div className="text-sm text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

function ToggleGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}

function TextField({ label, value, onChange, type = "text", placeholder }: { label: string; value: string | boolean; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input type={type} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function TextAreaField({ label, value, onChange }: { label: string; value: string | boolean; onChange: (value: string) => void }) {
  return (
    <div className="grid gap-1.5 md:col-span-2">
      <Label>{label}</Label>
      <Textarea rows={3} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string | boolean; onChange: (value: string) => void; options: string[] }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={String(value)} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option} value={option}>{humanize(option)}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: string | boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 rounded-lg border p-3">
      <Label className="text-sm font-medium leading-tight">{label}</Label>
      <Switch checked={Boolean(checked)} onCheckedChange={onChange} />
    </div>
  );
}

function SettingBlock({ title, icon: Icon, children }: { title: string; icon: typeof Store; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2 font-display font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</div>
      {children}
    </div>
  );
}

function UploadBox({ icon: Icon, title, subtitle }: { icon: typeof Store; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-5 w-5" /></div>
        <div><div className="font-medium">{title}</div><div className="text-xs text-muted-foreground">{subtitle}</div></div>
      </div>
      <Button variant="outline" size="sm"><Upload className="mr-1.5 h-3.5 w-3.5" />Upload</Button>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return (
    <Card><CardContent className="flex items-center gap-3 p-4">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      <div className="min-w-0"><div className="truncate text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="truncate font-display text-xl font-bold capitalize">{value}</div></div>
    </CardContent></Card>
  );
}

function ActionButton({ icon: Icon, label, danger }: { icon: typeof Store; label: string; danger?: boolean }) {
  return <Button variant={danger ? "destructive" : "outline"} onClick={() => toast.info(`${label} action ready`)}><Icon className="mr-1.5 h-4 w-4" />{label}</Button>;
}

function humanize(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
