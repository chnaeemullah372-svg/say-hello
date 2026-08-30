// Server-only. Subscriptions used to promise "automated recurring billing"
// in its own page copy while nothing anywhere ever read next_billing_date
// — it was a plain persisted list with no engine behind it. This is that
// engine: once a day (see reminder-scheduler.server.ts, which calls this
// from the same in-process heartbeat used for due-date reminders), every
// active subscription whose next_billing_date has arrived gets a real
// invoice and its date rolled forward by one cycle.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUSINESS_TIMEZONE = "Asia/Karachi";

function todayInBusinessTimezone(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE }).format(new Date());
}

function nextCycleDate(from: string, cycle: string): string {
  const d = new Date(`${from}T00:00:00Z`);
  if (cycle === "yearly") d.setUTCFullYear(d.getUTCFullYear() + 1);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// Each business's subscriptions bill independently, scoped by tenant_id —
// two businesses could otherwise have subscriptions due the same day and
// each would need its own invoice numbering/customer balance untouched by
// the other.
export async function runSubscriptionBillingCheck(opts?: { tenantId?: string }): Promise<{ billed: number; failed: number }> {
  const today = todayInBusinessTimezone();
  let billed = 0;
  let failed = 0;

  // opts.tenantId scopes this to one business — used by the "Run billing
  // check now" button so a staff member can only ever trigger billing for
  // their own tenant, never every business on the platform. Omitted (the
  // daily heartbeat call) means every active business, as before.
  let businessesQuery = supabaseAdmin.from("businesses").select("id").eq("status", "active");
  if (opts?.tenantId) businessesQuery = businessesQuery.eq("id", opts.tenantId);
  const { data: activeBusinesses, error: businessesError } = await businessesQuery;
  if (businessesError) throw businessesError;

  for (const biz of activeBusinesses ?? []) {
    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select("id, customer_id, plan_name, amount, billing_cycle, next_billing_date, status")
      .eq("tenant_id", biz.id)
      .eq("status", "active")
      .lte("next_billing_date", today);

    for (const s of subs ?? []) {
      if (!s.customer_id) continue;
      try {
        let number: string | undefined;
        try {
          const { data } = await supabaseAdmin.rpc("next_document_number", { p_doc_type: "invoice", p_tenant_id: biz.id });
          if (data) number = data as string;
        } catch { /* fall back to the DB's own numbering if the RPC isn't available */ }

        const { data: inv, error } = await supabaseAdmin.from("invoices").insert({
          ...(number ? { number } : {}),
          customer_id: s.customer_id,
          date: today,
          due_date: today,
          items: [{ productId: "", name: s.plan_name || "Subscription", qty: 1, rate: s.amount, discount: 0 }],
          tax_rate: 0, discount_mode: "rate", discount_value: 0, shipping_amount: 0, paid: 0, status: "unpaid",
          tenant_id: biz.id,
        }).select().single();
        if (error || !inv) { failed++; continue; }

        const { data: cust } = await supabaseAdmin.from("customers").select("balance").eq("id", s.customer_id).maybeSingle();
        if (cust) {
          await supabaseAdmin.from("customers").update({ balance: Number(cust.balance ?? 0) + Number(s.amount) }).eq("id", s.customer_id);
        }

        await supabaseAdmin.from("subscriptions").update({ next_billing_date: nextCycleDate(s.next_billing_date ?? today, s.billing_cycle) }).eq("id", s.id);
        billed++;
      } catch {
        failed++;
      }
    }
  }

  return { billed, failed };
}
