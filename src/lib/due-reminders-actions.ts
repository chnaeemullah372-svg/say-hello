// Client-callable wrapper around the due-reminder checker — lets Settings
// -> Alerts run a check on demand (for testing, or "don't want to wait for
// the next automatic run") without duplicating any of its logic or rules.
import { createServerFn } from "@tanstack/react-start";

export const runDueReminderCheckNow = createServerFn({ method: "POST" }).handler(async () => {
  const { runDueReminderCheck } = await import("@/lib/due-reminders.server");
  return runDueReminderCheck();
});
