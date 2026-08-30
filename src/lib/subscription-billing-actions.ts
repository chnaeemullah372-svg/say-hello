// Client-callable wrapper around the subscription-billing checker — lets
// staff bill a subscription immediately ("don't want to wait for the next
// automatic run") without duplicating any of its logic.
//
// This previously had no identity check at all: the server function ran
// unauthenticated and, worse, called the checker with no tenant scope —
// so hitting this endpoint billed EVERY active business on the platform,
// not just the caller's own. It only looked safe because the button lives
// on a page behind the app's login redirect; the server function itself
// never enforced that, and never scoped to one tenant either. Fixed the
// same way team-actions.ts's server functions are: require a real session
// and resolve the caller's own tenant before doing anything privileged.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTenantId } from "@/lib/server-auth";

export const runSubscriptionBillingNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const { runSubscriptionBillingCheck } = await import("@/lib/subscription-billing.server");
    return runSubscriptionBillingCheck({ tenantId });
  });
