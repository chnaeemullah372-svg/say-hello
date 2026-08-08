import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Palette,
  PenLine,
  Percent,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Stamp,
  Store,
  Trash2,
  Upload,
  UserCog,
  Users,
  WalletCards,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import * as XLSX from "xlsx";
import {
  getWhatsAppStatus,
  connectWhatsAppQR,
  connectWhatsAppPhone,
  disconnectWhatsApp,
  resetWhatsAppSession,
  type WAStateUI,
  type WAStatus,
} from "@/lib/whatsapp-actions";
import { runDueReminderCheckNow } from "@/lib/due-reminders-actions";
import { setCurrencySymbol, type AccountType } from "@/lib/dummy-data";
import { CURRENCIES } from "@/lib/currencies";
import { useTheme } from "@/lib/theme";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — CN Invoice" },
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
type ActiveKey = SectionKey | "accounts" | "fundManagement" | "import";
type SettingsGroup = "Company Information" | "General Settings" | "Template Settings" | "Communication";
type Category = {
  key: ActiveKey;
  title: string;
  subtitle: string;
  icon: typeof Store;
  badge?: string;
  tone: string;
  group: SettingsGroup;
};
const SETTINGS_GROUPS: SettingsGroup[] = ["Company Information", "General Settings", "Template Settings", "Communication"];

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
  homeScreen: Record<string, string | boolean>;
  appearance: Record<string, string | boolean>;
  security: Record<string, string | boolean>;
  renameFields: Record<string, string>;
  templateSettings: Record<string, boolean>;
  customFields: { fields: CustomFieldDef[] };
};

type CustomFieldDef = {
  id: string;
  sequenceNo: number;
  fieldName: string;
  fieldType: "text" | "number" | "date" | "dropdown";
  alignment: "vertical" | "horizontal";
  placement: "top" | "bottom" | "total" | "end";
  inCalculation: boolean;
};

// Exported so pages that only need one section (e.g. the invoice view's
// Template Settings toggles) can merge server data over the same defaults
// shown here, instead of treating "no row saved yet" as everything-off.
export const templateSettingsDefaults: Record<string, boolean> = {
  showBankInEstimate: true, showAmountInWords: true, showBalanceInWords: true,
  showNotesInLedger: true, enableAdjustmentInLedger: true, showCompanyNameBelowSignature: true,
  showOldBalance: true, showAllPaymentDetails: true, showNotesInPdf: true,
  showTermsInFullRow: true, autoSaveOnSharePrint: true, enablePaidStamp: true,
  showTimeInDocuments: true, disableProductIfZeroStock: true, showAgentNameInInvoice: true,
  enableWarehouseManagement: true, showHeaderAllPages: false, showAttachmentsInPdf: false,
  showImageColumn: false, hideQuantityColumn: false, hideSrNoColumn: true,
  hideHsnColumn: false, hideRateColumn: false, hideDiscountColumn: false,
  hideTaxColumn: false, showSubtotal: false,
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
    printerChoice: "normal",
    printerConnection: "usb",
    printFormat: "text",
    printerSize: "58",
    maxCharsPerLine: "40",
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
    outstandingReminderEnabled: false,
    outstandingReminderInterval: "7",
    outstandingReminderMode: "whatsapp",
    outstandingReminderReferral: false,
    outstandingReminderTemplate:
      "Dear #CompanyName, this is a reminder that payment of #InvoiceNumber (of #Balance) is due today. It might be busy with your work, but it would be appreciated if you could look into this. Please let me know if you have any queries.",
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
    provider: "shoib",
    shoibApiBase: "https://hatelecom.xyz/api",
    shoibUsername: "",
    shoibPassword: "",
    shoibToken: "",
    connectionStatus: "disconnected",
    pairingBrandCode: "",
    invoiceMessage:
      "Hello {customer}, your invoice {invoice_no} of {amount} is ready. Please find the copy attached.",
    reminderMessage:
      "Hello {customer}, payment of {amount} is pending for invoice {invoice_no}.",
    sendInvoice: false,
    sendReminder: false,
    sendPaymentThanks: true,
    orderBookedMode: "whatsapp",
    orderBookedMessage: "Dear Customer, your order #OrderNo is booked successfully. Thanks",
    orderProcessingMode: "whatsapp",
    orderProcessingMessage: "Dear Customer, we are very excited to get your order on way, letting you know that your order #OrderNo is processing. This will be one of our best works to date. Regards",
    orderCompletedMode: "whatsapp",
    orderCompletedMessage: "Dear Customer, We are very happy to tell you that your order #OrderNo is completed and it will be out for delivery",
    orderCancelledMode: "whatsapp",
    orderCancelledMessage: "Dear Customer, we regret to inform you that your order #OrderNo has been cancelled. Please contact us for any queries.",
  },
  backup: {
    autoBackup: true,
    backupTime: "02:00",
    includeImages: true,
    exportFormat: "xlsx",
    lastBackup: "Not generated yet",
  },
  homeScreen: {
    salesWidget: true, salesRange: "monthly",
    purchaseWidget: true, purchaseRange: "monthly",
    paymentReceivedWidget: true, paymentReceivedRange: "monthly",
    paymentPaidWidget: true, paymentPaidRange: "monthly",
    outstandingBalanceWidget: true, outstandingBalanceRange: "allTime",
    expenseWidget: true, expenseRange: "monthly",
    profitLossWidget: true, profitLossRange: "monthly",
    orderStatisticsWidget: true, orderStatisticsRange: "allTime",
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
  renameFields: {
    billTo: "Bill To", shipTo: "Ship To", dueDate: "Due Date", reference: "Reference",
    baseAmount: "Base Amount", total: "Total", discount: "Discount", shippingAmount: "Shipping Amount",
    paid: "Paid", balance: "Balance", oldBalance: "Old Balance", amountInWords: "Amount in words",
    signature: "Signature", thankYou: "Thank you! Happy Business!", termsCondition: "Terms & Condition",
    taxableAmount: "Taxable Amount", vehicleNo: "Vehicle No", transportMode: "Transport Mode",
    payableTo: "Payable To", accountNo: "Account No", otherDetails: "Other Details",
    no: "No.", product: "Product", productCode: "Product Code", quantity: "Quantity", rate: "Rate",
    amount: "Amount", tax: "Tax",
    invoice: "Invoice", estimate: "Estimate", purchase: "Purchase", order: "Order",
    purchaseOrder: "Purchase Order", receipt: "Receipt", deliveryNote: "Delivery Note", saleReturn: "Sale Return",
    invoiceNo: "Invoice No.", purchaseNo: "Purchase No.", estimateNo: "Estimate No.",
    purchaseOrderNo: "Purchase Order No.", saleOrderNo: "Sale Order No.", saleReturnNo: "Sale Return No.",
    receiptNo: "Receipt No", deliveryNoteNo: "Delivery Note No.",
  },
  templateSettings: templateSettingsDefaults,
  customFields: { fields: [] },
};

const categories: Category[] = [
  // Company Information
  { key: "business", title: "Business Profile", subtitle: "Business details shown on documents: logo, GST, address and company info.", icon: Store, badge: "Main", tone: "text-primary bg-primary/10 ring-primary/20", group: "Company Information" },
  { key: "bank", title: "Bank / UPI", subtitle: "Bank and UPI details shown on invoices so customers know where to pay.", icon: Landmark, tone: "text-primary bg-primary/10 ring-primary/20", group: "Company Information" },
  { key: "tax", title: "Tax / GST / TDS", subtitle: "Set taxes and discounts for bills. Apply item-wise or on the full bill.", icon: Percent, badge: "TDS", tone: "text-coral bg-coral/10 ring-coral/20", group: "Company Information" },
  { key: "terms", title: "Terms & Condition", subtitle: "Terms shown on documents. Set different text for invoices, estimates, purchases, etc.", icon: FileSignature, tone: "text-jade bg-jade/10 ring-jade/20", group: "Company Information" },
  { key: "accounts", title: "Accounts & Categories", subtitle: "Create accounts for payments and expenses. Helps organize and track your money.", icon: Landmark, tone: "text-orchid bg-orchid/10 ring-orchid/20", group: "Company Information" },
  { key: "fundManagement", title: "Fund Management", subtitle: "Transfer money between payment accounts. Keeps proper records of fund movement.", icon: ArrowLeftRight, tone: "text-aqua bg-aqua/10 ring-aqua/20", group: "Company Information" },
  { key: "items", title: "Items & Stock", subtitle: "Products, units, low-stock alerts and warehouse tracking.", icon: Boxes, tone: "text-orchid bg-orchid/10 ring-orchid/20", group: "Company Information" },
  { key: "payment", title: "Payment", subtitle: "Cash, UPI and due-payment defaults used when recording payments.", icon: WalletCards, tone: "text-aqua bg-aqua/10 ring-aqua/20", group: "Company Information" },
  { key: "users", title: "Admin & Users", subtitle: "Add and manage staff members. Control what each person can access.", icon: ShieldCheck, badge: "Admin", tone: "text-coral bg-coral/10 ring-coral/20", group: "Company Information" },

  // General Settings
  { key: "numbering", title: "Prefix & Localization", subtitle: "Set invoice, estimate and other document numbers. Choose country, number & date format, currency.", icon: Hash, tone: "text-amber bg-amber/10 ring-amber/20", group: "General Settings" },
  { key: "homeScreen", title: "Home Screen", subtitle: "Customize what you see on the home screen. Set widgets to show monthly or all-time data.", icon: LayoutDashboard, tone: "text-sapphire bg-sapphire/10 ring-sapphire/20", group: "General Settings" },
  { key: "backup", title: "Backup / Export", subtitle: "Keep your data safe with a backup. Restore it anytime when needed.", icon: DatabaseBackup, tone: "text-orchid bg-orchid/10 ring-orchid/20", group: "General Settings" },
  { key: "import", title: "Import", subtitle: "Import clients and products from Excel. Add data quickly into the app.", icon: Upload, tone: "text-jade bg-jade/10 ring-jade/20", group: "General Settings" },
  { key: "notifications", title: "Alerts", subtitle: "Reminder message settings for unpaid bills and scheduled reports.", icon: Bell, tone: "text-amber bg-amber/10 ring-amber/20", group: "General Settings" },
  { key: "print", title: "Page & Print", subtitle: "Set document printing preferences. Choose A4/A3 or thermal printer and paper size.", icon: Printer, tone: "text-jade bg-jade/10 ring-jade/20", group: "General Settings" },
  { key: "appearance", title: "Appearance", subtitle: "Choose your preferred app language and theme.", icon: Palette, tone: "text-aqua bg-aqua/10 ring-aqua/20", group: "General Settings" },
  { key: "security", title: "Security", subtitle: "Login methods, session timeout and audit log.", icon: LockKeyhole, tone: "text-primary bg-primary/10 ring-primary/20", group: "General Settings" },

  // Template Settings
  { key: "invoice", title: "Invoice Setup", subtitle: "Choose which columns, terms and QR code appear on your invoices.", icon: ReceiptText, badge: "A-Z", tone: "text-sapphire bg-sapphire/10 ring-sapphire/20", group: "Template Settings" },
  { key: "renameFields", title: "Rename Field Name", subtitle: "Change field labels on invoices/documents. Use names that suit your business.", icon: PenLine, tone: "text-sapphire bg-sapphire/10 ring-sapphire/20", group: "Template Settings" },
  { key: "customFields", title: "Add Custom Fields", subtitle: "Add extra fields to documents. Store more details if needed.", icon: Plus, tone: "text-jade bg-jade/10 ring-jade/20", group: "Template Settings" },
  { key: "templateSettings", title: "Template Settings", subtitle: "Control what appears on invoices/documents. Show or hide fields and totals.", icon: FileText, tone: "text-coral bg-coral/10 ring-coral/20", group: "Template Settings" },

  // Communication
  { key: "whatsapp", title: "WhatsApp", subtitle: "Connect your account and set message templates.", icon: MessageCircle, tone: "text-jade bg-jade/10 ring-jade/20", group: "Communication" },
  { key: "gmail", title: "Gmail / Email", subtitle: "SMTP connection and email templates.", icon: Mail, badge: "Secret", tone: "text-sapphire bg-sapphire/10 ring-sapphire/20", group: "Communication" },
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
          (next as any)[key] = { ...(next as any)[key], ...(row.setting_value as Record<string, unknown>) };
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
    if (section === "tax" && settings.tax.symbol) setCurrencySymbol(settings.tax.symbol);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Complete control panel for invoice, tax, print, users, Gmail, WhatsApp and backup"
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
            <div className="space-y-4">
              {SETTINGS_GROUPS.map((group) => (
                <div key={group}>
                  <div className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group}</div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-1">
                    {categories.filter((c) => c.group === group).map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setActive(category.key)}
                        className={`group flex min-h-[88px] items-center gap-3.5 rounded-lg border p-3.5 text-left transition hover:bg-muted/60 xl:min-h-0 ${active === category.key ? "border-primary bg-primary/5 shadow-sm" : "bg-card"}`}
                      >
                        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-lg ring-1 ${category.tone}`}>
                          <category.icon className="h-6 w-6" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold leading-tight">{category.title}</span>
                            {category.badge && <Badge variant="secondary" className="hidden px-1.5 py-0 text-[10px] sm:inline-flex">{category.badge}</Badge>}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">{category.subtitle}</span>
                        </span>
                        <ChevronRight className="hidden h-5 w-5 shrink-0 text-muted-foreground xl:block" />
                      </button>
                    ))}
                  </div>
                </div>
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
            {active !== "accounts" && active !== "fundManagement" && active !== "import" && (
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
          {active === "import" && <ImportLinkPanel />}
          {active === "numbering" && <NumberingPanel data={settings.numbering} set={(k, v) => setField("numbering", k, v)} />}
          {active === "print" && <PrintPanel data={settings.print} set={(k, v) => setField("print", k, v)} />}
          {active === "renameFields" && <RenameFieldsPanel data={settings.renameFields} set={(k, v) => setField("renameFields", k, v)} />}
          {active === "customFields" && <CustomFieldsPanel data={settings.customFields} set={(v) => setField("customFields", "fields", v)} />}
          {active === "templateSettings" && <TemplateSettingsPanel data={settings.templateSettings} set={(k, v) => setField("templateSettings", k, v)} />}
          {active === "items" && <ItemsPanel data={settings.items} set={(k, v) => setField("items", k, v)} />}
          {active === "payment" && <PaymentPanel data={settings.payment} set={(k, v) => setField("payment", k, v)} />}
          {active === "bank" && <BankPanel data={settings.bank} set={(k, v) => setField("bank", k, v)} />}
          {active === "users" && <UsersPanel data={settings.users} set={(k, v) => setField("users", k, v)} />}
          {active === "notifications" && <NotificationsPanel data={settings.notifications} set={(k, v) => setField("notifications", k, v)} />}
          {active === "gmail" && <GmailPanel data={settings.gmail} set={(k, v) => setField("gmail", k, v)} />}
          {active === "whatsapp" && <WhatsAppPanel data={settings.whatsapp} set={(k, v) => setField("whatsapp", k, v)} isAdmin={user?.role === "admin"} />}
          {active === "backup" && <BackupPanel data={settings.backup} set={(k, v) => setField("backup", k, v)} />}
          {active === "homeScreen" && <HomeScreenPanel data={settings.homeScreen} set={(k, v) => setField("homeScreen", k, v)} />}
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
        <div className="grid gap-1.5">
          <Label>Currency</Label>
          <select
            value={data.currency}
            onChange={(e) => {
              const c = CURRENCIES.find((c) => c.code === e.target.value);
              set("currency", e.target.value);
              if (c) set("symbol", c.symbol);
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name} ({c.symbol})</option>)}
          </select>
        </div>
        <TextField label="Currency symbol (auto-set, editable)" value={data.symbol} onChange={(v) => set("symbol", v)} />
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
  const { accounts, deleteAccount } = useStore();
  return (
    <Panel>
      <PanelHeader icon={Landmark} title="Accounts & Categories" subtitle="Create accounts for payments, expenses, and warehouses. Helps organize and track your money and stock." />
      <div className="rounded-lg border bg-muted/25 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">{accounts.length} account{accounts.length !== 1 ? "s" : ""} set up</div>
            <div className="text-sm text-muted-foreground">Open Fund Management to add Payment/Category accounts and see live balances.</div>
          </div>
          <Button asChild><Link to="/funds"><Landmark className="mr-1.5 h-4 w-4" />Open Fund Management</Link></Button>
        </div>
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
  const { accounts, fundTransfers } = useStore();
  return (
    <Panel>
      <PanelHeader icon={ArrowLeftRight} title="Fund Management" subtitle="Transfer money between payment accounts. Keeps proper records of fund movement." />
      <div className="rounded-lg border bg-muted/25 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">{accounts.length} account{accounts.length !== 1 ? "s" : ""} · {fundTransfers.length} transfer{fundTransfers.length !== 1 ? "s" : ""} on record</div>
            <div className="text-sm text-muted-foreground">Open Fund Management to view balances and move money between accounts.</div>
          </div>
          <Button asChild><Link to="/funds"><ArrowLeftRight className="mr-1.5 h-4 w-4" />Open Fund Management</Link></Button>
        </div>
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
        <div className="mb-3 rounded-lg border bg-muted/25 p-3 text-xs text-muted-foreground">
          Currency code and symbol are set in one place — Tax &amp; Discount — so this page only controls the amount-in-words wording and number/date format, not the currency itself.
        </div>
        <Grid>
          <TextField label="Country" value={data.country} onChange={(v) => set("country", v)} />
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
        <SelectField label="Paper size" value={data.paper} onChange={(v) => set("paper", v)} options={["a4", "a5", "a3", "letter", "legal", "thermal-80mm", "thermal-58mm"]} />
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
      <SettingBlock title="Printer Setting" icon={Printer}>
        {data.printerChoice === "thermal" && (
          <div className="mb-3 rounded-lg border border-amber/40 bg-amber/10 p-3 text-xs">
            *** Note: Thermal Printer is in beta mode. Please configure thermal printer setting before using it. Printer Size is the printing width of 58mm/80mm. Maximum character in one line can be 40/45/56/64 — these vary by printer brand; see your printer's manual. Also: a browser can't pair Bluetooth directly — this becomes usable once packaged as a mobile app.
          </div>
        )}
        <div className="mb-3">
          <Label className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">Choose Printer</Label>
          <div className="grid grid-cols-2 gap-2">
            {(["normal", "thermal"] as const).map((v) => (
              <button key={v} type="button" onClick={() => set("printerChoice", v)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${data.printerChoice === v ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                {v} Printer
              </button>
            ))}
          </div>
        </div>
        {data.printerChoice === "thermal" ? (
          <Grid>
            <SelectField label="Printer connection" value={data.printerConnection} onChange={(v) => set("printerConnection", v)} options={["bluetooth", "usb"]} />
            <SelectField label="Print format" value={data.printFormat} onChange={(v) => set("printFormat", v)} options={["image", "text"]} />
            <SelectField label="Printer size (mm)" value={data.printerSize} onChange={(v) => set("printerSize", v)} options={["58", "80"]} />
            <TextField label="Maximum character in single line" value={data.maxCharsPerLine} onChange={(v) => set("maxCharsPerLine", v)} type="number" />
          </Grid>
        ) : (
          <SelectField label="Print Size" value={data.paper.toUpperCase()} onChange={(v) => set("paper", v.toLowerCase())} options={["A4", "A5", "A3", "LETTER", "LEGAL"]} />
        )}
      </SettingBlock>
    </Panel>
  );
}

function RenameFieldsPanel({ data, set }: { data: Record<string, string>; set: (k: string, v: string) => void }) {
  const groups: [string, [string, string][]][] = [
    ["Heading section", [
      ["invoice", "Invoice"], ["estimate", "Estimate"], ["purchase", "Purchase"], ["order", "Order"],
      ["purchaseOrder", "Purchase Order"], ["receipt", "Receipt"], ["deliveryNote", "Delivery Note"], ["saleReturn", "Sale Return"],
      ["invoiceNo", "Invoice No."], ["purchaseNo", "Purchase No."], ["estimateNo", "Estimate No."],
      ["purchaseOrderNo", "Purchase Order No."], ["saleOrderNo", "Sale Order No."], ["saleReturnNo", "Sale Return No."],
      ["receiptNo", "Receipt No"], ["deliveryNoteNo", "Delivery Note No."],
    ]],
    ["Product table", [
      ["no", "No."], ["product", "Product"], ["productCode", "Product Code"],
      ["quantity", "Quantity"], ["rate", "Rate"], ["amount", "Amount"], ["tax", "Tax"],
    ]],
    ["Client / Supplier section", [
      ["billTo", "Bill To"], ["shipTo", "Ship To"], ["dueDate", "Due Date"], ["reference", "Reference"],
    ]],
    ["General", [
      ["baseAmount", "Base Amount"], ["total", "Total"], ["discount", "Discount"], ["shippingAmount", "Shipping Amount"],
      ["paid", "Paid"], ["balance", "Balance"], ["oldBalance", "Old Balance"], ["amountInWords", "Amount in words"],
      ["signature", "Signature"], ["thankYou", "Thank you"], ["termsCondition", "Terms & Condition"],
      ["taxableAmount", "Taxable Amount"], ["vehicleNo", "Vehicle No"], ["transportMode", "Transport Mode"],
    ]],
    ["Banking section", [
      ["payableTo", "Payable To"], ["accountNo", "Account No"], ["otherDetails", "Other Details"],
    ]],
  ];
  return (
    <Panel>
      <PanelHeader icon={PenLine} title="Rename Field Name" subtitle="Change field labels on invoices/documents. Use names that suit your business." />
      {groups.map(([group, fields]) => (
        <SettingBlock key={group} title={group} icon={PenLine}>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map(([key, placeholder]) => (
              <div key={key} className="grid grid-cols-[110px_1fr] items-center gap-2">
                <Label className="text-xs text-muted-foreground">{placeholder}</Label>
                <Input value={data[key] ?? ""} placeholder={placeholder} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
          </div>
        </SettingBlock>
      ))}
    </Panel>
  );
}

function CustomFieldsPanel({ data, set }: { data: { fields: CustomFieldDef[] }; set: (fields: CustomFieldDef[]) => void }) {
  const fields = data.fields ?? [];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CustomFieldDef>({
    id: "", sequenceNo: fields.length, fieldName: "", fieldType: "text", alignment: "vertical", placement: "top", inCalculation: false,
  });

  const startAdd = () => {
    setDraft({ id: `f${Date.now()}`, sequenceNo: fields.length, fieldName: "", fieldType: "text", alignment: "vertical", placement: "top", inCalculation: false });
    setOpen(true);
  };
  const save = () => {
    if (!draft.fieldName.trim()) return toast.error("Field Name is required");
    set([...fields, draft]);
    setOpen(false);
  };
  const remove = (id: string) => set(fields.filter((f) => f.id !== id));

  return (
    <Panel>
      <PanelHeader icon={Plus} title="Add Custom Fields" subtitle="Add extra fields to documents. Store more details if needed." />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button onClick={startAdd}><Plus className="mr-1.5 h-4 w-4" />Add field</Button></DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Custom Field</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <TextField label="Sequence No" value={String(draft.sequenceNo)} onChange={(v) => setDraft({ ...draft, sequenceNo: +v || 0 })} type="number" />
            <TextField label="Field Name" value={draft.fieldName} onChange={(v) => setDraft({ ...draft, fieldName: v })} />
            <SelectField label="Field Type" value={draft.fieldType} onChange={(v) => setDraft({ ...draft, fieldType: v as CustomFieldDef["fieldType"] })} options={["text", "number", "date", "dropdown"]} />
            <SelectField label="Alignment" value={draft.alignment} onChange={(v) => setDraft({ ...draft, alignment: v as CustomFieldDef["alignment"] })} options={["vertical", "horizontal"]} />
            <SelectField label="Field Placement (PDF)" value={draft.placement} onChange={(v) => setDraft({ ...draft, placement: v as CustomFieldDef["placement"] })} options={["top", "bottom", "total", "end"]} />
            <div className="flex items-center gap-2">
              <Checkbox id="in-calc" checked={draft.inCalculation} onCheckedChange={(v) => setDraft({ ...draft, inCalculation: !!v })} />
              <Label htmlFor="in-calc" className="text-sm font-normal">Add field in calculation</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {fields.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          <Plus className="h-7 w-7" />
          <div className="font-medium">No Fields to show</div>
          <div className="text-xs">Tap "Add field" to create new fields.</div>
        </div>
      ) : (
        <div className="grid gap-2">
          {fields.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border bg-card p-3 text-sm">
              <div>
                <div className="font-medium">{f.fieldName}</div>
                <div className="text-xs text-muted-foreground capitalize">{f.fieldType} · {f.alignment} · {f.placement.replace(/^\w/, (c) => c.toUpperCase())} of Product Table</div>
              </div>
              <button type="button" onClick={() => remove(f.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function TemplateSettingsPanel({ data, set }: { data: Record<string, boolean>; set: (k: string, v: boolean) => void }) {
  const rows: [string, string][] = [
    ["showBankInEstimate", "Show bank / payment information in estimate"],
    ["showAmountInWords", "Show amount in words"],
    ["showBalanceInWords", "Show balance amount in words"],
    ["showNotesInLedger", "Show notes in ledger"],
    ["enableAdjustmentInLedger", "Enable Adjustment in ledger"],
    ["showCompanyNameBelowSignature", "Show company name below signature"],
    ["showOldBalance", "Show Old Balance"],
    ["showAllPaymentDetails", "Show All Payment Details"],
    ["showNotesInPdf", "Show Notes in pdf"],
    ["showTermsInFullRow", "Show terms and conditions in full row"],
    ["autoSaveOnSharePrint", "Auto save on share / print"],
    ["enablePaidStamp", "Enable paid stamp in invoice"],
    ["showTimeInDocuments", "Show time in documents"],
    ["disableProductIfZeroStock", "Disable the product if the inventory is zero"],
    ["showAgentNameInInvoice", "Show Agent Name in Invoice"],
    ["enableWarehouseManagement", "Enable Warehouse Management"],
    ["showHeaderAllPages", "Show header in all pages"],
    ["showAttachmentsInPdf", "Show Attachments in pdf"],
    ["showImageColumn", "Show Image Column"],
    ["hideQuantityColumn", "Hide Quantity Column"],
    ["hideSrNoColumn", "Hide Sr.No Column"],
    ["hideHsnColumn", "Hide HSN Code Column"],
    ["hideRateColumn", "Hide Rate Column"],
    ["hideDiscountColumn", "Hide Discount Column"],
    ["hideTaxColumn", "Hide Tax Column"],
    ["showSubtotal", "Show Subtotal"],
  ];
  return (
    <Panel>
      <PanelHeader icon={FileText} title="Template Settings" subtitle="Control what appears on invoices/documents. Show or hide fields and totals." />
      <div className="divide-y rounded-lg border">
        {rows.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm">{label}</span>
            <Switch checked={!!data[key]} onCheckedChange={(v) => set(key, v)} />
          </div>
        ))}
      </div>
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
  const [checking, setChecking] = useState(false);
  const [lastResult, setLastResult] = useState<{ checked: number; sent: number; skipped: number; failed: number } | null>(null);

  const runCheckNow = async () => {
    setChecking(true);
    try {
      const stats = await runDueReminderCheckNow();
      setLastResult(stats);
      toast.success(`Checked ${stats.checked} invoice(s) — ${stats.sent} sent, ${stats.skipped} skipped, ${stats.failed} failed`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not run the reminder check");
    } finally {
      setChecking(false);
    }
  };

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
      <SettingBlock title="Outstanding Amount Reminder" icon={Bell}>
        <ToggleField label="Enable reminder" checked={data.outstandingReminderEnabled} onChange={(v) => set("outstandingReminderEnabled", v)} />
        <p className="text-xs text-muted-foreground">
          Runs automatically once a day. Every unpaid/partial invoice is checked against its <strong>current</strong> due date and balance each time —
          editing a due date or clearing a payment takes effect on the very next run, with nothing to reset by hand.
        </p>
        <Grid>
          <SelectField
            label="Repeat every"
            value={data.outstandingReminderInterval}
            onChange={(v) => set("outstandingReminderInterval", v)}
            options={["7", "15", "alternate", "daily"]}
            optionLabels={{ "7": "7 days", "15": "15 days", alternate: "Alternate days", daily: "Daily" }}
          />
          <SelectField label="Message mode" value={data.outstandingReminderMode} onChange={(v) => set("outstandingReminderMode", v)} options={["whatsapp", "sms"]} />
        </Grid>
        <ToggleField
          label="Also send to referral number"
          checked={data.outstandingReminderReferral}
          onChange={(v) => set("outstandingReminderReferral", v)}
        />
        <TextAreaField label="Reminder message template (use #CompanyName, #InvoiceNumber, #Balance)" value={data.outstandingReminderTemplate} onChange={(v) => set("outstandingReminderTemplate", v)} />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={runCheckNow} disabled={checking}>
            <RefreshCw className={`mr-1.5 h-4 w-4 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking…" : "Run check now"}
          </Button>
          {lastResult && (
            <span className="text-xs text-muted-foreground">
              Last run: {lastResult.checked} checked, {lastResult.sent} sent, {lastResult.skipped} skipped, {lastResult.failed} failed
            </span>
          )}
        </div>
      </SettingBlock>
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

function WhatsAppPanel({ data, set, isAdmin }: PanelProps & { isAdmin: boolean }) {
  const statuses: [string, string, string][] = [
    ["orderBookedMode", "orderBookedMessage", "Booked"],
    ["orderProcessingMode", "orderProcessingMessage", "Processing"],
    ["orderCompletedMode", "orderCompletedMessage", "Completed"],
    ["orderCancelledMode", "orderCancelledMessage", "Cancelled"],
  ];

  const statusLabel: Record<WAStatus, string> = {
    disconnected: "Not connected",
    connecting: "Connecting…",
    qr_ready: "Scan the QR code",
    pairing: "Enter the pairing code",
    connected: "Connected",
  };

  const [wa, setWa] = useState<WAStateUI | null>(null);
  const [mode, setMode] = useState<"qr" | "phone">("qr");
  const [phoneInput, setPhoneInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = async () => {
    try {
      const state = await getWhatsAppStatus();
      setWa(state);
      return state;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read WhatsApp status");
      return null;
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
    if (wa && (wa.status === "connecting" || wa.status === "qr_ready" || wa.status === "pairing")) {
      pollRef.current = setTimeout(refresh, 3000);
    }
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wa?.status, wa?.qr, wa?.pairingCode]);

  const runAction = async (fn: () => Promise<WAStateUI>) => {
    setBusy(true);
    try {
      const state = await fn();
      setWa(state);
      return state;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "WhatsApp action failed");
      return null;
    } finally {
      setBusy(false);
    }
  };

  const connectQR = () => runAction(() => connectWhatsAppQR());
  const connectPhone = () => {
    if (!phoneInput.trim()) { toast.error("Enter the WhatsApp number to connect first"); return; }
    return runAction(() => connectWhatsAppPhone({ data: { phone: phoneInput, brandCode: data.pairingBrandCode || undefined } }));
  };
  const doDisconnect = async () => {
    const state = await runAction(() => disconnectWhatsApp());
    if (state) setDisconnectOpen(false);
  };
  const doReset = async () => {
    const state = await runAction(() => resetWhatsAppSession());
    if (state) { setResetOpen(false); setMode("qr"); }
  };

  return (
    <Panel>
      <PanelHeader icon={MessageCircle} title="WhatsApp" subtitle="Link this app's own WhatsApp number to send invoices and reminders directly — no third-party gateway." />
      {!isAdmin && (
        <div className="rounded-lg border border-amber/40 bg-amber/10 p-3 text-xs">
          Connection settings and linking are locked to Admin only. You can still see and use the message templates below.
        </div>
      )}
      {isAdmin && (
        <div className="rounded-lg border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-semibold">Connection</span>
            <Badge variant="outline" className={wa?.status === "connected" ? "border-accent/40 text-accent" : "border-muted-foreground/30 text-muted-foreground"}>
              {wa ? statusLabel[wa.status] : "Checking…"}
            </Badge>
          </div>

          {wa?.status === "connected" ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-accent/10 p-3 text-sm">
                Linked to <span className="font-semibold">{wa.phoneNumber ?? "this device"}</span>
                {wa.connectedAt && <span className="text-muted-foreground"> — since {new Date(wa.connectedAt).toLocaleString()}</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setDisconnectOpen(true)} disabled={busy}>
                  <LogOut className="mr-1.5 h-4 w-4" />Disconnect
                </Button>
                <Button type="button" variant="destructive" onClick={() => setResetOpen(true)} disabled={busy}>
                  <Wrench className="mr-1.5 h-4 w-4" />Auto-fix / Reset
                </Button>
              </div>
            </div>
          ) : (
            <fieldset disabled={busy} className={busy ? "opacity-70" : undefined}>
              <div className="mb-3 inline-flex rounded-lg border bg-muted/40 p-1">
                <button type="button" onClick={() => setMode("qr")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${mode === "qr" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  <QrCode className="mr-1 inline h-3.5 w-3.5" />QR code
                </button>
                <button type="button" onClick={() => setMode("phone")} className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${mode === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  <Smartphone className="mr-1 inline h-3.5 w-3.5" />Phone number
                </button>
              </div>

              {mode === "qr" ? (
                wa?.qrDataUrl ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-4">
                    <img src={wa.qrDataUrl} alt="WhatsApp QR code" className="h-56 w-56" />
                    <div className="text-xs text-muted-foreground">WhatsApp → Linked Devices → Link a Device → scan this</div>
                  </div>
                ) : (
                  <Button type="button" onClick={connectQR} disabled={busy}>{busy ? "Starting…" : "Show QR code"}</Button>
                )
              ) : (
                <div className="space-y-3">
                  <Grid>
                    <TextField label="WhatsApp number to connect" value={phoneInput} onChange={setPhoneInput} placeholder="923001234567" />
                    <TextField label="Custom pairing-code name (optional, 8 characters)" value={data.pairingBrandCode ?? ""} onChange={(v) => set("pairingBrandCode", v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))} placeholder="PRESTIGE" />
                  </Grid>
                  <Button type="button" onClick={connectPhone} disabled={busy}>{busy ? "Getting pairing code…" : "Get pairing code"}</Button>
                  {wa?.pairingCode && (
                    <div className="rounded-lg bg-primary p-4 text-center text-primary-foreground">
                      <div className="text-xs font-semibold uppercase tracking-wider opacity-80">Your pairing code</div>
                      <div className="mt-1 font-display text-3xl font-bold tracking-[0.3em]">{wa.pairingCode}</div>
                      <div className="mt-2 text-xs opacity-80">On that phone: WhatsApp → Linked Devices → Link with phone number → enter this code.</div>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          )}

          {wa?.lastError && <div className="mt-3 text-sm text-destructive">{wa.lastError}</div>}
        </div>
      )}

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Disconnect WhatsApp?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Invoices and reminders will stop sending on WhatsApp until you link a number again. The linked-device session stays saved, so reconnecting won't need a new QR or pairing code.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisconnectOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={doDisconnect}>{busy ? "Disconnecting…" : "Disconnect"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset WhatsApp session?</DialogTitle></DialogHeader>
          <p className="text-sm text-destructive">This wipes the saved linked-device session completely and starts a fresh QR code. Use this only if the connection is stuck or broken and Disconnect didn't help.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={doReset}>{busy ? "Resetting…" : "Reset session"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SettingBlock title="Message templates" icon={MessageCircle}>
        <TextAreaField label="Invoice message" value={data.invoiceMessage} onChange={(v) => set("invoiceMessage", v)} />
        <TextAreaField label="Payment reminder message" value={data.reminderMessage} onChange={(v) => set("reminderMessage", v)} />
      </SettingBlock>
      <ToggleGrid>
        <ToggleField label="Send invoice on WhatsApp" checked={data.sendInvoice} onChange={(v) => set("sendInvoice", v)} />
        <ToggleField label="Send due reminders" checked={data.sendReminder} onChange={(v) => set("sendReminder", v)} />
        <ToggleField label="Thank-you after payment" checked={data.sendPaymentThanks} onChange={(v) => set("sendPaymentThanks", v)} />
      </ToggleGrid>

      <SettingBlock title="Order Management — status message templates" icon={MessageCircle}>
        <div className="space-y-3">
          {statuses.map(([modeKey, msgKey, label]) => (
            <div key={modeKey} className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{label}</span>
                <div className="inline-flex rounded-lg border bg-muted/40 p-1">
                  {(["sms", "whatsapp"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => set(modeKey, v)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition ${data[modeKey] === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                      {v === "sms" ? "Normal SMS" : "WhatsApp"}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea rows={2} value={data[msgKey] ?? ""} onChange={(e) => set(msgKey, e.target.value)} />
            </div>
          ))}
        </div>
      </SettingBlock>
    </Panel>
  );
}

// Every collection the app stores, with the store methods needed to back
// it up, restore it, or wipe it. Kept in one place so Download/Export/
// Import/Reset all agree on exactly what "all business data" means.
function useBackupCollections() {
  const store = useStore();
  return [
    { key: "customers", label: "Customers", rows: store.customers, add: store.addCustomer, del: store.deleteCustomer },
    { key: "products", label: "Products", rows: store.products, add: store.addProduct, del: store.deleteProduct },
    { key: "invoices", label: "Invoices", rows: store.invoices, add: store.addInvoice, del: store.deleteInvoice },
    { key: "payments", label: "Payments", rows: store.payments, add: store.addPayment, del: store.deletePayment },
    { key: "estimates", label: "Estimates", rows: store.estimates, add: store.addEstimate, del: store.deleteEstimate },
    { key: "saleOrders", label: "Sale Orders", rows: store.saleOrders, add: store.addSaleOrder, del: store.deleteSaleOrder },
    { key: "purchaseOrders", label: "Purchase Orders", rows: store.purchaseOrders, add: store.addPurchaseOrder, del: store.deletePurchaseOrder },
    { key: "accounts", label: "Accounts", rows: store.accounts, add: store.addAccount, del: store.deleteAccount },
    { key: "fundTransfers", label: "Fund Transfers", rows: store.fundTransfers, add: store.addFundTransfer, del: store.deleteFundTransfer },
    { key: "deliveryNotes", label: "Delivery Notes", rows: store.deliveryNotes, add: store.addDeliveryNote, del: store.deleteDeliveryNote },
    { key: "saleReturns", label: "Sale Returns", rows: store.saleReturns, add: store.addSaleReturn, del: store.deleteSaleReturn },
    { key: "purchaseReturns", label: "Purchase Returns", rows: store.purchaseReturns, add: store.addPurchaseReturn, del: store.deletePurchaseReturn },
    { key: "productionEntries", label: "Production Entries", rows: store.productionEntries, add: store.addProductionEntry, del: store.deleteProductionEntry },
    { key: "subscriptions", label: "Subscriptions", rows: store.subscriptions, add: store.addSubscription, del: store.deleteSubscription },
    { key: "commissions", label: "Commissions", rows: store.commissions, add: store.addCommission, del: store.deleteCommission },
    { key: "whatsappLogs", label: "WhatsApp Logs", rows: store.whatsappLogs, add: null, del: store.deleteWhatsappLog },
    { key: "expenses", label: "Expenses", rows: store.expenses, add: store.addExpense, del: store.deleteExpense },
    { key: "purchases", label: "Purchases", rows: store.purchases, add: store.addPurchase, del: store.deletePurchase },
  ] as const;
}

function BackupPanel({ data, set }: PanelProps) {
  const collections = useBackupCollections();
  const [importing, setImporting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadBackup = () => {
    const payload: Record<string, unknown> = {
      app: "CN Invoice",
      exportedAt: new Date().toISOString(),
    };
    for (const c of collections) payload[c.key] = c.rows;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    set("lastBackup", new Date().toLocaleString());
    toast.success("Backup downloaded");
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    for (const c of collections) {
      const ws = XLSX.utils.json_to_sheet(c.rows as unknown as Record<string, unknown>[]);
      XLSX.utils.book_append_sheet(wb, ws, c.label.slice(0, 31));
    }
    XLSX.writeFile(wb, `export-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel file downloaded");
  };

  const importBackup = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Record<string, any[]>;
      let added = 0;
      let skippedCollections = 0;
      for (const c of collections) {
        const rows = parsed[c.key];
        if (!Array.isArray(rows) || rows.length === 0) continue;
        if (!c.add) { skippedCollections++; continue; }
        for (const row of rows) {
          try {
            await c.add(row as any);
            added++;
          } catch { /* skip a row that fails to import rather than aborting the whole restore */ }
        }
      }
      toast.success(`Restored ${added} record${added === 1 ? "" : "s"} from backup${skippedCollections ? ` (${skippedCollections} collection(s) skipped)` : ""}`);
    } catch {
      toast.error("Could not read that backup file — is it a valid export from this app?");
    } finally {
      setImporting(false);
    }
  };

  const resetData = async () => {
    setResetting(true);
    try {
      let deleted = 0;
      for (const c of collections) {
        for (const row of c.rows as { id: string }[]) {
          try {
            await c.del(row.id);
            deleted++;
          } catch { /* skip a row that fails to delete rather than aborting the whole reset */ }
        }
      }
      toast.success(`Deleted ${deleted} record${deleted === 1 ? "" : "s"}`);
      setResetOpen(false);
      setResetConfirmText("");
    } finally {
      setResetting(false);
    }
  };

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
        <ActionButton icon={DatabaseBackup} label="Download backup" onClick={downloadBackup} />
        <ActionButton icon={Upload} label={importing ? "Importing…" : "Import backup"} onClick={() => fileInputRef.current?.click()} disabled={importing} />
        <ActionButton icon={FileBarChart} label="Export Excel" onClick={exportExcel} />
        <ActionButton icon={Trash2} label="Reset data" danger onClick={() => setResetOpen(true)} />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importBackup(file);
          e.target.value = "";
        }}
      />

      <Dialog open={resetOpen} onOpenChange={(v) => { setResetOpen(v); if (!v) setResetConfirmText(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset all data?</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-destructive">
              This permanently deletes every customer, product, invoice, payment and other business record — there is no undo. Download a backup first if you're not sure.
            </p>
            <div className="grid gap-1.5">
              <Label>Type DELETE to confirm</Label>
              <Input value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)} placeholder="DELETE" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={resetConfirmText !== "DELETE" || resetting} onClick={resetData}>
              {resetting ? "Deleting…" : "Delete everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function ImportLinkPanel() {
  return (
    <Panel>
      <PanelHeader icon={Upload} title="Import" subtitle="Bring in multiple clients and products from a single Excel sheet." />
      <div className="rounded-lg border bg-muted/25 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-semibold">Bulk import clients or products</div>
            <div className="text-sm text-muted-foreground">Download a template, fill it in, and upload it back — no manual data entry.</div>
          </div>
          <Button asChild><Link to="/import"><Upload className="mr-1.5 h-4 w-4" />Open Import</Link></Button>
        </div>
      </div>
    </Panel>
  );
}

function HomeScreenPanel({ data, set }: PanelProps) {
  const widgets: [string, string, string][] = [
    ["salesWidget", "salesRange", "Sales"],
    ["purchaseWidget", "purchaseRange", "Purchases"],
    ["paymentReceivedWidget", "paymentReceivedRange", "Payment Received"],
    ["paymentPaidWidget", "paymentPaidRange", "Payment Paid"],
    ["outstandingBalanceWidget", "outstandingBalanceRange", "Outstanding Balance"],
    ["expenseWidget", "expenseRange", "Expense"],
    ["profitLossWidget", "profitLossRange", "Profit / Loss"],
    ["orderStatisticsWidget", "orderStatisticsRange", "Order Statistics"],
  ];
  return (
    <Panel>
      <PanelHeader icon={LayoutDashboard} title="Home Screen" subtitle="Customize what you see on the home screen. Set widgets to show monthly or yearly data." />
      <div className="grid gap-2">
        {widgets.map(([toggleKey, rangeKey, label]) => (
          <div key={toggleKey} className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
            <div className="flex items-center gap-3">
              <Switch checked={data[toggleKey]} onCheckedChange={(v) => set(toggleKey, v)} />
              <span className="font-medium">{label}</span>
            </div>
            <div className="inline-flex rounded-lg border bg-muted/40 p-1">
              {(["monthly", "allTime"] as const).map((v) => (
                <button key={v} type="button" onClick={() => set(rangeKey, v)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${data[rangeKey] === v ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {v === "monthly" ? "Monthly" : "All Time"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AppearancePanel({ data, set, theme, toggleTheme }: PanelProps & { theme: string; toggleTheme: () => void }) {
  return (
    <Panel>
      <PanelHeader icon={Palette} title="Appearance and app format" subtitle="Language, dashboard style, dates and visual density." />
      <Grid>
        <SelectField label="Language" value={data.language} onChange={(v) => set("language", v)} options={["en", "ur", "ar", "bg", "fr", "de", "hi", "id", "it", "km", "ku", "ms", "fa", "pt", "ru", "si"]} />
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

function SelectField({ label, value, onChange, options, optionLabels }: { label: string; value: string | boolean; onChange: (value: string) => void; options: string[]; optionLabels?: Record<string, string> }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select value={String(value)} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option} value={option}>{optionLabels?.[option] ?? humanize(option)}</SelectItem>)}
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

function ActionButton({ icon: Icon, label, danger, onClick, disabled }: { icon: typeof Store; label: string; danger?: boolean; onClick?: () => void; disabled?: boolean }) {
  return <Button variant={danger ? "destructive" : "outline"} onClick={onClick ?? (() => toast.info(`${label} action ready`))} disabled={disabled}><Icon className="mr-1.5 h-4 w-4" />{label}</Button>;
}

function humanize(value: string) {
  return value.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
