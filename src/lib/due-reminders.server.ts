// Server-only. The automatic payment-reminder checker.
//
// Design note (read before changing this file): the WhatsApp engine
// (whatsapp-engine.server.ts) holds exactly one live socket per server
// process, so this checker runs IN-PROCESS via reminder-scheduler.server.ts
// — never as a separate cron-spawned Node process — or two sockets would
// fight over the same linked-device session.
//
// The one rule this whole file exists to enforce: WhatsApp Number, the
// queue, and any previously-calculated reminder date are NEVER the
// authority. Every run re-reads every unpaid/partial invoice fresh and
// asks "does this exact invoice, right now, still need this reminder?" —
// a due-date edit, a payment, or a settings change on invoice #482
// requires zero cleanup; the next run just computes a different answer.
//
// Duplicate protection is a database UNIQUE constraint on
// (invoice_id, reminder_date) in payment_reminder_sends, claimed with an
// INSERT before any WhatsApp send is attempted — so even two overlapping
// runs, a retried job, or a server restart mid-run can't double-send.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcInvoiceTotals } from "@/lib/dummy-data";

// All due-date/"today" math happens in one fixed business timezone, never
// the server host's own timezone — otherwise a reminder can fire a day
// early or late purely because of where the server happens to be hosted.
const BUSINESS_TIMEZONE = "Asia/Karachi";

function todayInBusinessTimezone(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE }).format(new Date());
}

function daysBetween(fromDateOnly: string, toDateOnly: string): number {
  const from = new Date(`${fromDateOnly}T00:00:00Z`).getTime();
  const to = new Date(`${toDateOnly}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function intervalDaysFor(mode: string): number {
  if (mode === "15") return 15;
  if (mode === "alternate") return 2;
  if (mode === "daily") return 1;
  return 7;
}

function fmtMoney(n: number): string {
  return `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type ReminderInvoiceRow = {
  id: string;
  number: string;
  items: unknown;
  tax_rate: number | null;
  tax_inclusive: boolean | null;
  discount_mode: string | null;
  discount_value: number | null;
  shipping_amount: number | null;
  paid: number | null;
  due_date: string | null;
  customers: {
    id: string;
    name: string;
    whatsapp: string | null;
    whatsapp2: string | null;
    referral_phone: string | null;
  } | null;
};

/** A short, self-contained PDF — this runs with no browser/DOM, so it
 * can't reuse the interactive invoice view's template-driven builder. */
async function buildReminderPdfBase64(
  inv: ReminderInvoiceRow,
  balance: number,
  businessName: string,
): Promise<string> {
  const { default: jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default;
  const items = (inv.items ?? []) as { name: string; qty: number; rate: number; discount?: number }[];

  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(businessName || "Your Business", 14, 16);
  doc.setFontSize(10);
  doc.text(`Invoice ${inv.number}`, 14, 23);
  doc.text(`Due: ${inv.due_date ?? "-"}`, 140, 16);
  autoTable(doc, {
    startY: 32,
    head: [["Description", "Qty", "Rate", "Amount"]],
    body: items.map((it) => [it.name, String(it.qty), fmtMoney(it.rate), fmtMoney(it.qty * it.rate * (1 - (it.discount ?? 0) / 100))]),
    styles: { fontSize: 9 },
  });
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.text(`Balance due: ${fmtMoney(balance)}`, 140, finalY);
  return doc.output("datauristring").split(",")[1];
}

export type ReminderCheckStats = { checked: number; sent: number; skipped: number; failed: number };

// Every business runs this check independently — its own notification
// settings, its own unpaid invoices, its own WhatsApp connection. One
// business having reminders disabled (or no WhatsApp connected) never
// affects any other business's run.
export async function runDueReminderCheck(opts?: { tenantId?: string }): Promise<ReminderCheckStats> {
  const stats: ReminderCheckStats = { checked: 0, sent: 0, skipped: 0, failed: 0 };

  // opts.tenantId scopes this to one business — used by the "Run check now"
  // button so a staff member can only ever trigger reminders for their own
  // tenant, never every business on the platform. Omitted (the daily
  // heartbeat call) means every active business, as before.
  let businessesQuery = supabaseAdmin.from("businesses").select("id").eq("status", "active");
  if (opts?.tenantId) businessesQuery = businessesQuery.eq("id", opts.tenantId);
  const { data: activeBusinesses, error: businessesError } = await businessesQuery;
  if (businessesError) throw businessesError;

  for (const biz of activeBusinesses ?? []) {
    await runDueReminderCheckForTenant(biz.id, stats);
  }
  return stats;
}

async function runDueReminderCheckForTenant(tenantId: string, stats: ReminderCheckStats): Promise<void> {
  const [{ data: notifRow }, { data: businessRow }] = await Promise.all([
    supabaseAdmin.from("app_settings").select("setting_value").eq("tenant_id", tenantId).eq("setting_key", "settings.notifications").maybeSingle(),
    supabaseAdmin.from("app_settings").select("setting_value").eq("tenant_id", tenantId).eq("setting_key", "settings.business").maybeSingle(),
  ]);
  const notif = (notifRow?.setting_value as Record<string, any>) ?? {};
  if (!notif.outstandingReminderEnabled) return;
  if (notif.outstandingReminderMode && notif.outstandingReminderMode !== "whatsapp") return;

  const business = (businessRow?.setting_value as Record<string, any>) ?? {};
  const businessName: string = business.businessName || business.legalName || "our store";
  const today = todayInBusinessTimezone();
  const interval = intervalDaysFor(notif.outstandingReminderInterval ?? "7");
  const sendToReferral = !!notif.outstandingReminderReferral;
  const template: string =
    notif.outstandingReminderTemplate || "Dear #CompanyName, payment of #InvoiceNumber (#Balance) is due.";

  const { data: invoices, error } = await supabaseAdmin
    .from("invoices")
    .select("id, number, items, tax_rate, tax_inclusive, discount_mode, discount_value, shipping_amount, paid, due_date, customers(id, name, whatsapp, whatsapp2, referral_phone)")
    .eq("tenant_id", tenantId)
    .neq("status", "paid")
    .not("due_date", "is", null)
    .returns<ReminderInvoiceRow[]>();
  if (error) throw error;

  for (const inv of invoices ?? []) {
    stats.checked++;
    const totals = calcInvoiceTotals(
      (inv.items ?? []) as any,
      Number(inv.tax_rate ?? 0),
      (inv.discount_mode as "rate" | "flat") ?? "rate",
      Number(inv.discount_value ?? 0),
      Number(inv.shipping_amount ?? 0),
      Boolean(inv.tax_inclusive),
    );
    const balance = totals.total - Number(inv.paid ?? 0);
    if (balance <= 0 || !inv.due_date) { stats.skipped++; continue; }

    const daysOverdue = daysBetween(inv.due_date, today);
    if (daysOverdue < interval || daysOverdue % interval !== 0) { stats.skipped++; continue; }

    // Claim today's slot for this invoice — a unique-constraint violation
    // here means another run (or an earlier tick today) already handled
    // it, so this run backs off instead of sending a second time.
    const { error: claimError } = await supabaseAdmin
      .from("payment_reminder_sends")
      .insert({ invoice_id: inv.id, reminder_date: today, due_date_snapshot: inv.due_date, status: "pending", tenant_id: tenantId });
    if (claimError) { stats.skipped++; continue; }

    const customer = inv.customers;
    const numbers = [customer?.whatsapp, customer?.whatsapp2, sendToReferral ? customer?.referral_phone : null]
      .filter((n): n is string => !!n?.trim());

    if (numbers.length === 0) {
      await supabaseAdmin.from("payment_reminder_sends")
        .update({ status: "failed", error_message: "No WhatsApp number on file" })
        .eq("invoice_id", inv.id).eq("reminder_date", today);
      stats.failed++;
      continue;
    }

    const message = template
      .replace(/#CompanyName/g, businessName)
      .replace(/#InvoiceNumber/g, inv.number)
      .replace(/#Balance/g, fmtMoney(balance));

    try {
      const { getEngineForTenant } = await import("@/lib/whatsapp-engine.server");
      const engine = getEngineForTenant(tenantId);
      const pdfBase64 = await buildReminderPdfBase64(inv, balance, businessName).catch(() => null);

      let anyOk = false;
      let lastError: string | undefined;
      let lastMessageId: string | undefined;
      for (const number of numbers) {
        try {
          const id = pdfBase64
            ? await engine.sendDocument(number, Buffer.from(pdfBase64, "base64"), `${inv.number}.pdf`, message)
            : await engine.sendText(number, message);
          anyOk = true;
          lastMessageId = id;
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
        }
        await supabaseAdmin.from("whatsapp_logs").insert({
          customer_id: customer?.id ?? null,
          customer_name: customer?.name ?? null,
          whatsapp_number: number,
          wa_message_id: anyOk ? lastMessageId : null,
          message_type: "due_reminder",
          reference_id: inv.id,
          reference_number: inv.number,
          message_text: message,
          status: anyOk ? "sent" : "failed",
          error_message: anyOk ? null : lastError,
          tenant_id: tenantId,
        });
      }

      await supabaseAdmin.from("payment_reminder_sends")
        .update({ status: anyOk ? "sent" : "failed", wa_message_id: lastMessageId ?? null, error_message: anyOk ? null : lastError ?? "Unknown error" })
        .eq("invoice_id", inv.id).eq("reminder_date", today);
      if (anyOk) stats.sent++; else stats.failed++;
    } catch (err) {
      await supabaseAdmin.from("payment_reminder_sends")
        .update({ status: "failed", error_message: err instanceof Error ? err.message : String(err) })
        .eq("invoice_id", inv.id).eq("reminder_date", today);
      stats.failed++;
    }
  }
}
