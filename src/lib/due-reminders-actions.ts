// Client-callable wrapper around the due-reminder checker — lets Settings
// -> Alerts run a check on demand (for testing, or "don't want to wait for
// the next automatic run") without duplicating any of its logic or rules.
//
// This previously had no identity check at all: the server function ran
// unauthenticated with no tenant scope, so hitting it triggered reminder
// checks (and real WhatsApp sends) for EVERY active business on the
// platform, not just the caller's own — the same bug already fixed for
// runSubscriptionBillingNow in subscription-billing-actions.ts. Fixed the
// same way: require a real session and resolve the caller's own tenant
// before doing anything privileged.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTenantId } from "@/lib/server-auth";

export const runDueReminderCheckNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const { runDueReminderCheck } = await import("@/lib/due-reminders.server");
    return runDueReminderCheck({ tenantId });
  });
