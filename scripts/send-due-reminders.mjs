// Sends WhatsApp payment reminders for invoices whose due date has passed
// by the number of days configured in Settings -> Alerts -> Outstanding
// Amount Reminder. Meant to run once a day via cron on the VPS (it is NOT
// part of the Vite app bundle — run it directly with Node):
//
//   node scripts/send-due-reminders.mjs
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
// (the service role key is needed because this runs with no logged-in
// user — get it from Supabase -> Project Settings -> API -> service_role,
// and NEVER put it in the frontend .env, only in this server-side one).

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function getSetting(key) {
  const { data } = await supabase.from("app_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  return data?.setting_value ?? {};
}

async function shoibSendText(apiBase, token, phone, text) {
  const res = await fetch(`${apiBase.replace(/\/$/, "")}/panel/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ phone, text }),
  });
  if (!res.ok) throw new Error(`Shoib API error ${res.status}: ${await res.text()}`);
  return res.json();
}

function fmtMoney(n) {
  return `Rs ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcTotal(items, taxRate) {
  const base = (items ?? []).reduce((s, it) => s + it.qty * it.rate * (1 - (it.discount ?? 0) / 100), 0);
  return base + (base * (taxRate ?? 0)) / 100;
}

async function main() {
  const notif = await getSetting("settings.notifications");
  if (!notif.outstandingReminderEnabled) {
    console.log("Outstanding Amount Reminder is disabled in Settings -> Alerts. Nothing to do.");
    return;
  }
  const wa = await getSetting("settings.whatsapp");
  if (!wa.shoibToken) {
    console.log("WhatsApp isn't connected yet (Settings -> WhatsApp -> Get Pairing Code). Skipping.");
    return;
  }
  const business = await getSetting("settings.business");

  const daysOverdue = Number(notif.outstandingReminderDays ?? 7);
  const today = new Date();
  const targetDueDate = new Date(today);
  targetDueDate.setDate(targetDueDate.getDate() - daysOverdue);
  const targetDateStr = targetDueDate.toISOString().slice(0, 10);

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*, customers(id, name, whatsapp)")
    .neq("status", "paid")
    .eq("due_date", targetDateStr);

  if (error) throw error;
  if (!invoices?.length) {
    console.log(`No unpaid invoices due exactly ${daysOverdue} day(s) ago (${targetDateStr}).`);
    return;
  }

  const todayStr = today.toISOString().slice(0, 10);
  let sent = 0, skipped = 0;

  for (const inv of invoices) {
    const customer = inv.customers;
    if (!customer?.whatsapp) { skipped++; continue; }

    // Don't message the same invoice twice in one day if this runs more than once.
    const { data: already } = await supabase
      .from("whatsapp_logs")
      .select("id")
      .eq("reference_id", inv.id)
      .eq("message_type", "due_reminder")
      .gte("created_at", `${todayStr}T00:00:00Z`)
      .limit(1);
    if (already?.length) { skipped++; continue; }

    const total = calcTotal(inv.items, inv.tax_rate);
    const balance = total - Number(inv.paid ?? 0);
    const message = (notif.outstandingReminderTemplate || "Dear #CompanyName, your payment of #InvoiceNumber (#Balance) is due.")
      .replace(/#CompanyName/g, business.name || "our store")
      .replace(/#InvoiceNumber/g, inv.number)
      .replace(/#Balance/g, fmtMoney(balance));

    let status = "sent", errorMessage = null;
    try {
      await shoibSendText(wa.shoibApiBase || "https://hatelecom.xyz/api", wa.shoibToken, customer.whatsapp.replace(/\D/g, ""), message);
      sent++;
    } catch (err) {
      status = "failed";
      errorMessage = err instanceof Error ? err.message : String(err);
      skipped++;
    }

    await supabase.from("whatsapp_logs").insert({
      customer_id: customer.id,
      customer_name: customer.name,
      whatsapp_number: customer.whatsapp,
      message_type: "due_reminder",
      reference_id: inv.id,
      reference_number: inv.number,
      message_text: message,
      status,
      error_message: errorMessage,
    });
  }

  console.log(`Due reminders: ${sent} sent, ${skipped} skipped, out of ${invoices.length} candidate invoice(s).`);
}

main().catch((err) => {
  console.error("send-due-reminders failed:", err);
  process.exit(1);
});
