// Server functions the Settings -> WhatsApp UI calls. The handler bodies
// dynamically import the engine (which is service-role + holds a live
// socket) so none of that ever reaches the client bundle — same pattern
// already used for supabaseAdmin elsewhere in this app.
//
// Every handler resolves the CALLER's own business from their session
// (never trusts a tenant id from the client) and operates on that
// business's own WhatsApp engine instance — each business connects and
// scans its own WhatsApp, completely independent of every other business's.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireTenantId } from "@/lib/server-auth";

export type WAStatus = "disconnected" | "connecting" | "qr_ready" | "pairing" | "connected";

export interface WAStateUI {
  status: WAStatus;
  qr: string | null;
  qrDataUrl: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  connectedAt: string | null;
}

// QR images are rendered server-side (the `qrcode` package is Node-only)
// so the client only ever needs an <img src>, never a QR-drawing library.
async function stateWithQrImage(tenantId: string) {
  const { getEngineForTenant } = await import("@/lib/whatsapp-engine.server");
  const state = getEngineForTenant(tenantId).getState();
  if (!state.qr) return { ...state, qrDataUrl: null };
  const QRCode = (await import("qrcode")).default;
  const qrDataUrl = await QRCode.toDataURL(state.qr, { margin: 1, width: 280 });
  return { ...state, qrDataUrl };
}

export const getWhatsAppStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    return stateWithQrImage(tenantId);
  });

export const connectWhatsAppQR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const { getEngineForTenant } = await import("@/lib/whatsapp-engine.server");
    await getEngineForTenant(tenantId).connectQR();
    return stateWithQrImage(tenantId);
  });

export const connectWhatsAppPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { phone: string; brandCode?: string }) => data)
  .handler(async ({ data, context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const { getEngineForTenant } = await import("@/lib/whatsapp-engine.server");
    await getEngineForTenant(tenantId).connectPhone(data.phone, data.brandCode);
    return stateWithQrImage(tenantId);
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const { getEngineForTenant } = await import("@/lib/whatsapp-engine.server");
    await getEngineForTenant(tenantId).disconnect();
    return stateWithQrImage(tenantId);
  });

export const resetWhatsAppSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const { getEngineForTenant } = await import("@/lib/whatsapp-engine.server");
    await getEngineForTenant(tenantId).resetSession();
    return stateWithQrImage(tenantId);
  });

export const setWhatsAppBrandCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { brandCode: string }) => data)
  .handler(async ({ data, context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const brand = data.brandCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (brand.length !== 8) throw new Error("Pairing code name must be exactly 8 letters/numbers");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("whatsapp_session").upsert({ tenant_id: tenantId, pairing_brand_code: brand }, { onConflict: "tenant_id" });
    if (error) throw new Error(error.message);
    return { brandCode: brand };
  });

export const sendWhatsAppText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { phone: string; text: string }) => data)
  .handler(async ({ data, context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const { getEngineForTenant } = await import("@/lib/whatsapp-engine.server");
    const waMessageId = await getEngineForTenant(tenantId).sendText(data.phone, data.text);
    return { waMessageId };
  });

/** pdfBase64 is the raw PDF bytes, base64-encoded (server functions can only carry JSON-serializable data). */
export const sendWhatsAppDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { phone: string; pdfBase64: string; fileName: string; caption?: string }) => data)
  .handler(async ({ data, context }) => {
    const tenantId = await requireTenantId(context.supabase, context.userId);
    const { getEngineForTenant } = await import("@/lib/whatsapp-engine.server");
    const buffer = Buffer.from(data.pdfBase64, "base64");
    const waMessageId = await getEngineForTenant(tenantId).sendDocument(data.phone, buffer, data.fileName, data.caption);
    return { waMessageId };
  });
