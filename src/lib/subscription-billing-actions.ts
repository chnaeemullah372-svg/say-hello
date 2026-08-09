// Client-callable wrapper around the subscription-billing checker — lets
// staff bill a subscription immediately ("don't want to wait for the next
// automatic run") without duplicating any of its logic.
import { createServerFn } from "@tanstack/react-start";

export const runSubscriptionBillingNow = createServerFn({ method: "POST" }).handler(async () => {
  const { runSubscriptionBillingCheck } = await import("@/lib/subscription-billing.server");
  return runSubscriptionBillingCheck();
});
