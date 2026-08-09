import { createFileRoute, redirect } from "@tanstack/react-router";

// This used to be a second, disconnected commission feature — a fully
// static demo page (hardcoded sample rows, a "Configure Rules" button that
// only ever showed "Demo only — backend pending") sitting next to Agents,
// which already implements the real thing against live commission data.
// Rather than leave two competing sources of truth on the same idea,
// this route now just hands off to the one that's real.
export const Route = createFileRoute("/commissions")({
  beforeLoad: () => {
    throw redirect({ to: "/agent" });
  },
});
