/**
 * Client for the Shoib WhatsApp backend (https://github.com/chnaeemullah372-svg/Shoib-),
 * already running on the user's own VPS at hatelecom.xyz. This is the
 * exact method requested: phone-number pairing code (not QR), the same
 * one used by the Shoib mobile app.
 *
 * Endpoints confirmed from that repo's mobile client
 * (artifacts/mobile/lib/api.ts, app/connect.tsx, lib/auth.tsx):
 *   POST /panel/login          { username, password } -> { token, user }
 *   GET  /panel/me             (Bearer)                -> PanelUser
 *   POST /panel/wa/connect-phone (Bearer) { phone }     -> starts pairing
 *   GET  /panel/wa/status       (Bearer)                -> WAState
 *   POST /panel/send           (Bearer) { phone, text } -> { success, waMessageId }
 *   POST /panel/send-media     (Bearer) { phone, base64, caption, mime }
 */

export type ShoibWAStatus = "disconnected" | "connecting" | "qr_ready" | "pairing" | "connected";

export type ShoibWAState = {
  status: ShoibWAStatus;
  qr: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  connectedAt: string | null;
};

function base(apiBase?: string) {
  return (apiBase || "https://hatelecom.xyz/api").replace(/\/$/, "");
}

async function req<T>(apiBase: string, path: string, method: string, token?: string, body?: unknown): Promise<T> {
  const res = await fetch(`${base(apiBase)}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error((data && data.error) || `Shoib API error ${res.status}`);
  }
  return data as T;
}

export function shoibLogin(apiBase: string, username: string, password: string) {
  return req<{ token: string; user: { id: number; username: string; approved: boolean } }>(
    apiBase, "/panel/login", "POST", undefined, { username, password }
  );
}

export function shoibSignup(apiBase: string, username: string, password: string) {
  return req<{ message: string }>(apiBase, "/panel/signup", "POST", undefined, { username, password });
}

export function shoibStatus(apiBase: string, token: string) {
  return req<ShoibWAState>(apiBase, "/panel/wa/status", "GET", token);
}

export function shoibConnectPhone(apiBase: string, token: string, phone: string) {
  return req<{ success: boolean }>(apiBase, "/panel/wa/connect-phone", "POST", token, { phone });
}

export function shoibSendText(apiBase: string, token: string, phone: string, text: string) {
  return req<{ success: boolean; waMessageId: string }>(apiBase, "/panel/send", "POST", token, { phone, text });
}

export function shoibSendMedia(apiBase: string, token: string, phone: string, base64: string, caption?: string, mime = "application/pdf") {
  return req<{ success: boolean; waMessageId: string }>(apiBase, "/panel/send-media", "POST", token, { phone, base64, caption, mime });
}
