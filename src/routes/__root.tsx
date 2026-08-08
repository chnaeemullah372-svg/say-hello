import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { getRuntimeSupabaseConfig } from "../lib/runtime-supabase-config";
import { ThemeProvider } from "@/lib/theme";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Dashboard — CN Invoice" },
      { name: "description", content: "Business overview: sales, purchases, payments, expenses and orders in one place." },
      { property: "og:title", content: "Dashboard — CN Invoice" },
      { property: "og:description", content: "Business overview: sales, purchases, payments, expenses and orders in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Dashboard — CN Invoice" },
      { name: "twitter:description", content: "Business overview: sales, purchases, payments, expenses and orders in one place." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // Embedded inline (rather than fetched from a separate URL) so it can't
  // be intercepted by a host's static-file routing before reaching the
  // app — see src/lib/runtime-supabase-config.ts for why this exists at
  // all. Must render before the app bundle hydrates.
  const runtimeConfigScript = `window.__RUNTIME_SUPABASE_CONFIG__ = ${JSON.stringify(getRuntimeSupabaseConfig())};`;

  // Starts the once-a-day due-reminder heartbeat exactly once per server
  // process, on the first request it handles after boot — this file only
  // ever renders server-side, so window is never defined here in
  // production, but the guard keeps it explicit and matches this
  // codebase's .server.ts-import convention (see reminder-scheduler.server.ts).
  if (typeof window === "undefined") {
    void import("@/lib/reminder-scheduler.server").then((m) => m.ensureReminderSchedulerStarted());
  }
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: runtimeConfigScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <StoreProvider>
            <AppShell>
              <Outlet />
            </AppShell>
            <Toaster richColors position="top-right" />
          </StoreProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
