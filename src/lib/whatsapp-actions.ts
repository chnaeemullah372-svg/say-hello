// Server functions the Settings -> WhatsApp UI calls. The handler bodies
// dynamically import the engine (which is service-role + holds a live
// socket) so none of that ever reaches the client bundle — same pattern
// already used for supabaseAdmin elsewhere in this app.
import { createServerFn } from "@tanstack/react-start";

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
async function stateWithQrImage() {
  const { whatsappEngine } = await import("@/lib/whatsapp-engine.server");
  const state = whatsappEngine.getState();
  if (!state.qr) return { ...state, qrDataUrl: null };
  const QRCode = (await import("qrcode")).default;
  const qrDataUrl = await QRCode.toDataURL(state.qr, { margin: 1, width: 280 });
  return { ...state, qrDataUrl };
}

export const getWhatsAppStatus = createServerFn({ method: "GET" }).handler(async () => stateWithQrImage());

export const connectWhatsAppQR = createServerFn({ method: "POST" }).handler(async () => {
  const { whatsappEngine } = await import("@/lib/whatsapp-engine.server");
  await whatsappEngine.connectQR();
  return stateWithQrImage();
});

export const connectWhatsAppPhone = createServerFn({ method: "POST" })
  .validator((data: { phone: string; brandCode?: string }) => data)
  .handler(async ({ data }) => {
    const { whatsappEngine } = await import("@/lib/whatsapp-engine.server");
    await whatsappEngine.connectPhone(data.phone, data.brandCode);
    return stateWithQrImage();
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" }).handler(async () => {
  const { whatsappEngine } = await import("@/lib/whatsapp-engine.server");
  await whatsappEngine.disconnect();
  return stateWithQrImage();
});

export const resetWhatsAppSession = createServerFn({ method: "POST" }).handler(async () => {
  const { whatsappEngine } = await import("@/lib/whatsapp-engine.server");
  await whatsappEngine.resetSession();
  return stateWithQrImage();
});

export const setWhatsAppBrandCode = createServerFn({ method: "POST" })
  .validator((data: { brandCode: string }) => data)
  .handler(async ({ data }) => {
    const brand = data.brandCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (brand.length !== 8) throw new Error("Pairing code name must be exactly 8 letters/numbers");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("whatsapp_session").update({ pairing_brand_code: brand }).not("id", "is", null);
    if (error) throw new Error(error.message);
    return { brandCode: brand };
  });

export const sendWhatsAppText = createServerFn({ method: "POST" })
  .validator((data: { phone: string; text: string }) => data)
  .handler(async ({ data }) => {
    const { whatsappEngine } = await import("@/lib/whatsapp-engine.server");
    const waMessageId = await whatsappEngine.sendText(data.phone, data.text);
    return { waMessageId };
  });

/** pdfBase64 is the raw PDF bytes, base64-encoded (server functions can only carry JSON-serializable data). */
export const sendWhatsAppDocument = createServerFn({ method: "POST" })
  .validator((data: { phone: string; pdfBase64: string; fileName: string; caption?: string }) => data)
  .handler(async ({ data }) => {
    const { whatsappEngine } = await import("@/lib/whatsapp-engine.server");
    const buffer = Buffer.from(data.pdfBase64, "base64");
    const waMessageId = await whatsappEngine.sendDocument(data.phone, buffer, data.fileName, data.caption);
    return { waMessageId };
  });
