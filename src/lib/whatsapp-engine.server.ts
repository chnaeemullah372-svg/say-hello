// Server-only. The ".server.ts" suffix keeps this out of the client bundle —
// it holds a live WhatsApp socket connection and imports the service-role
// Supabase client, neither of which may ever reach the browser.
//
// This is a focused port of the connect/send/status-tracking parts of the
// WhatsAppbot reference project (github.com/chnaeemullah372-svg/WhatsAppbot,
// see artifacts/api-server/src/services/multiWhatsapp.ts) — adapted to run
// as a singleton inside this app's own long-running server process instead
// of as a separate hosted service. Deliberately NOT ported: the full chat
// inbox, presence tracking, contacts sync and call logging — cnvoice only
// needs to send transactional messages (invoices, reminders) and track
// their delivered/read status, not mirror a WhatsApp Web client.
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  type WASocket,
  type ConnectionState,
  type BaileysEventMap,
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SESSION_DIR = path.join(process.cwd(), ".whatsapp-session");
const silentLogger = pino({ level: "silent" });

export type WAStatus = "disconnected" | "connecting" | "qr_ready" | "pairing" | "connected";

export interface WAState {
  status: WAStatus;
  qr: string | null;
  pairingCode: string | null;
  phoneNumber: string | null;
  lastError: string | null;
  connectedAt: string | null;
}

/** Normalizes a phone number to international digits-only form (e.g. 0300-1234567 -> 923001234567). */
export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "92" + digits.slice(1); // bare local number defaults to Pakistan
  return digits;
}

let cachedVersion: [number, number, number] | null = null;
async function getWAVersion(): Promise<[number, number, number]> {
  if (cachedVersion) return cachedVersion;
  try {
    const { version } = await fetchLatestBaileysVersion();
    cachedVersion = version;
    return version;
  } catch {
    return [2, 3000, 1023223821];
  }
}

class WhatsAppEngine {
  private sock: WASocket | null = null;
  private state: WAState = { status: "disconnected", qr: null, pairingCode: null, phoneNumber: null, lastError: null, connectedAt: null };
  private pairingTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private brandCode: string | null = null;
  private badSessionRetried = false;

  getState(): WAState {
    return { ...this.state };
  }

  private async set(patch: Partial<WAState>) {
    this.state = { ...this.state, ...patch };
    await supabaseAdmin
      .from("whatsapp_session")
      .update({
        status: this.state.status,
        phone_number: this.state.phoneNumber,
        last_error: this.state.lastError,
        connected_at: this.state.connectedAt,
      })
      .not("id", "is", null); // the table only ever has the one seeded row
  }

  private closeSocket() {
    if (this.pairingTimer) { clearTimeout(this.pairingTimer); this.pairingTimer = null; }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.sock) { try { this.sock.end(undefined); } catch { /* already closed */ } this.sock = null; }
  }

  private wipeCreds() {
    if (fs.existsSync(SESSION_DIR)) fs.rmSync(SESSION_DIR, { recursive: true, force: true });
  }

  async connectQR() {
    this.closeSocket();
    await this.set({ status: "connecting", qr: null, pairingCode: null, lastError: null });
    await this.boot(false, "");
  }

  async connectPhone(phone: string, brandCode?: string | null) {
    this.closeSocket();
    this.wipeCreds();
    const cleanPhone = normalizePhone(phone);
    const brand = (brandCode ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    this.brandCode = brand.length === 8 ? brand : null;
    await this.set({ status: "connecting", qr: null, pairingCode: null, lastError: null });
    await this.boot(true, cleanPhone);
  }

  async disconnect() {
    this.closeSocket();
    await this.set({ status: "disconnected", qr: null, pairingCode: null, connectedAt: null });
  }

  /** "Auto-fix": wipe stored credentials and start a completely fresh QR link. */
  async resetSession() {
    this.closeSocket();
    this.wipeCreds();
    await this.set({ status: "disconnected", qr: null, pairingCode: null, phoneNumber: null, connectedAt: null, lastError: null });
    await this.connectQR();
  }

  private async reconnectSaved() {
    this.closeSocket();
    await this.set({ status: "connecting", qr: null, pairingCode: null, lastError: null });
    await this.boot(false, "");
  }

  private async boot(usePairing: boolean, phone: string, pairingRetry = 0) {
    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const version = await getWAVersion();

    const sock = makeWASocket({
      version,
      auth: { creds: authState.creds, keys: makeCacheableSignalKeyStore(authState.keys, silentLogger) },
      logger: silentLogger,
      browser: Browsers.macOS("Safari"),
      markOnlineOnConnect: false,
      connectTimeoutMs: 120_000,
      keepAliveIntervalMs: 20_000,
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => ({ conversation: "" }),
    });
    this.sock = sock;
    let codeRequested = false;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update: Partial<ConnectionState>) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !usePairing) await this.set({ status: "qr_ready", qr });

      if (usePairing && phone && !codeRequested && connection !== "close") {
        codeRequested = true;
        this.pairingTimer = setTimeout(async () => {
          if (this.sock !== sock) return;
          if (sock.authState.creds.registered) return;
          try {
            const code = this.brandCode ? await sock.requestPairingCode(phone, this.brandCode) : await sock.requestPairingCode(phone);
            await this.set({ status: "pairing", pairingCode: code.replace(/(.{4})(.{4})/, "$1-$2"), qr: null });
          } catch (e) {
            await this.set({ status: "disconnected", lastError: `Could not get a pairing code: ${e instanceof Error ? e.message : "unknown error"}` });
          }
        }, 5000);
      }

      if (connection === "open") {
        if (this.pairingTimer) { clearTimeout(this.pairingTimer); this.pairingTimer = null; }
        this.badSessionRetried = false;
        const jid = sock.user?.id ?? null;
        const phoneNumber = jid ? `+${jid.split(":")[0].split("@")[0]}` : null;
        await this.set({ status: "connected", qr: null, pairingCode: null, connectedAt: new Date().toISOString(), phoneNumber, lastError: null });
      }

      if (connection === "close") {
        if (this.sock !== sock) return; // stale socket, already superseded
        if (this.pairingTimer) { clearTimeout(this.pairingTimer); this.pairingTimer = null; }
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isBadSession = statusCode === DisconnectReason.badSession;

        if (isBadSession && !this.badSessionRetried) {
          this.badSessionRetried = true;
          await this.set({ status: "connecting", lastError: null });
          this.reconnectTimer = setTimeout(() => { this.sock = null; void this.reconnectSaved(); }, 3000);
          return;
        }
        if (isLoggedOut || isBadSession) {
          this.wipeCreds();
          await this.set({ status: "disconnected", connectedAt: null, phoneNumber: null, lastError: "Logged out — please link again." });
          return;
        }
        if (usePairing && codeRequested && pairingRetry < 3) {
          await this.set({ status: "connecting", lastError: null });
          this.reconnectTimer = setTimeout(() => { this.sock = null; void this.boot(true, phone, pairingRetry + 1); }, 2000);
          return;
        }
        await this.set({ status: "disconnected", connectedAt: null, phoneNumber: null, lastError: "Connection closed." });
        if (!usePairing) this.reconnectTimer = setTimeout(() => void this.connectQR(), 8_000);
      }
    });

    sock.ev.on("messages.update", (updates: BaileysEventMap["messages.update"]) => {
      for (const update of updates) {
        const waMessageId = update.key.id;
        const status = update.update.status;
        if (waMessageId && status != null) void this.persistDeliveryStatus(waMessageId, status);
      }
    });
  }

  /** Baileys reports 2=sent (server ack), 3=delivered, 4=read, 5=played. */
  private async persistDeliveryStatus(waMessageId: string, baileysStatus: number) {
    const status = baileysStatus >= 4 ? "read" : baileysStatus === 3 ? "delivered" : baileysStatus === 2 ? "sent" : null;
    if (!status) return;
    await supabaseAdmin.from("whatsapp_logs").update({ status }).eq("wa_message_id", waMessageId);
  }

  private requireConnected(): WASocket {
    if (!this.sock || this.state.status !== "connected") throw new Error("WhatsApp is not connected — connect it from Settings first.");
    return this.sock;
  }

  async sendText(toPhone: string, text: string): Promise<string> {
    const sock = this.requireConnected();
    const jid = `${normalizePhone(toPhone)}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, { text });
    const id = result?.key.id;
    if (!id) throw new Error("WhatsApp did not return a message id");
    return id;
  }

  /** Sends a document (e.g. an invoice PDF) with an optional caption. Buffer is the raw file bytes. */
  async sendDocument(toPhone: string, buffer: Buffer, fileName: string, caption?: string): Promise<string> {
    const sock = this.requireConnected();
    const jid = `${normalizePhone(toPhone)}@s.whatsapp.net`;
    const result = await sock.sendMessage(jid, {
      document: buffer,
      mimetype: "application/pdf",
      fileName,
      caption,
    });
    const id = result?.key.id;
    if (!id) throw new Error("WhatsApp did not return a message id");
    return id;
  }
}

// Module-level singleton — one live socket for the whole server process.
// Only ONE instance of this server may run at a time (no horizontal
// scaling / multiple PM2 instances), or two sockets will fight over the
// same linked-device session and WhatsApp will force-close one of them.
export const whatsappEngine = new WhatsAppEngine();
