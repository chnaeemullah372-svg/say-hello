// Server-only. Boots a single in-process heartbeat that runs the due-date
// reminder checker roughly once every 24 hours, inside the SAME process as
// the WhatsApp engine (see due-reminders.server.ts for why this can never
// be a separate cron-spawned Node process — Baileys allows exactly one
// live socket per linked-device session).
//
// The 24h gate is read from persisted state, not just an in-memory timer,
// so a server restart (redeploy, crash) can never cause a day to be
// silently skipped OR cause two runs to fire close together.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CHECK_TICK_MS = 60 * 60 * 1000; // wake up hourly, but only act ~once/24h
const MIN_GAP_MS = 23 * 60 * 60 * 1000; // 23h buffer absorbs tick jitter

let started = false;

async function tick() {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "settings.notifications")
      .maybeSingle();
    const notif = (data?.setting_value as Record<string, unknown>) ?? {};
    const lastRunAt = notif.lastReminderRunAt ? new Date(notif.lastReminderRunAt as string).getTime() : 0;
    if (Date.now() - lastRunAt < MIN_GAP_MS) return;

    const { runDueReminderCheck } = await import("@/lib/due-reminders.server");
    const stats = await runDueReminderCheck();
    console.log(`[due-reminders] checked=${stats.checked} sent=${stats.sent} skipped=${stats.skipped} failed=${stats.failed}`);

    const { runSubscriptionBillingCheck } = await import("@/lib/subscription-billing.server");
    const subStats = await runSubscriptionBillingCheck();
    console.log(`[subscription-billing] billed=${subStats.billed} failed=${subStats.failed}`);

    await supabaseAdmin
      .from("app_settings")
      .update({ setting_value: { ...notif, lastReminderRunAt: new Date().toISOString() } })
      .eq("setting_key", "settings.notifications");
  } catch (err) {
    console.error("[due-reminders] tick failed:", err);
  }
}

export function ensureReminderSchedulerStarted() {
  if (started) return;
  started = true;
  void tick();
  setInterval(() => void tick(), CHECK_TICK_MS);
}
