import { supabase } from "@/integrations/supabase/client";
import { sendWhatsAppText, sendWhatsAppDocument } from "@/lib/whatsapp-actions";

export type WhatsAppSendResult = { ok: boolean; error?: string };

async function sendToNumber(
  toNumber: string,
  message: string,
  document?: { pdfBase64: string; fileName: string },
): Promise<WhatsAppSendResult & { waMessageId?: string }> {
  try {
    const { waMessageId } = document
      ? await sendWhatsAppDocument({ data: { phone: toNumber, pdfBase64: document.pdfBase64, fileName: document.fileName, caption: message } })
      : await sendWhatsAppText({ data: { phone: toNumber, text: message } });
    return { ok: true, waMessageId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach WhatsApp — is it connected in Settings?" };
  }
}

/**
 * Sends a WhatsApp message (optionally with a document attached) to one or
 * two numbers and records every attempt in whatsapp_logs so it shows up on
 * the monitoring page and this invoice's "Check History", regardless of
 * whether it succeeds. `wa_message_id` is stored per attempt so the engine's
 * delivered/read receipts (see whatsapp-engine.server.ts) can find it back.
 */
export async function sendAndLogWhatsApp(params: {
  customerId?: string;
  customerName?: string;
  toNumbers: (string | undefined | null)[];
  message: string;
  messageType: "invoice" | "due_reminder" | "order_status" | "other";
  referenceId?: string;
  referenceNumber?: string;
  document?: { pdfBase64: string; fileName: string };
}): Promise<WhatsAppSendResult> {
  const numbers = [...new Set(params.toNumbers.filter((n): n is string => !!n?.trim()))];
  if (numbers.length === 0) return { ok: false, error: "No WhatsApp number on file for this customer" };

  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", userData.user?.id ?? "").maybeSingle();
  let lastError: string | undefined;
  let anyOk = false;

  for (const toNumber of numbers) {
    const result = await sendToNumber(toNumber, params.message, params.document);
    if (result.ok) anyOk = true; else lastError = result.error;
    await supabase.from("whatsapp_logs").insert({
      customer_id: params.customerId || null,
      customer_name: params.customerName || null,
      whatsapp_number: toNumber,
      wa_message_id: result.waMessageId || null,
      message_type: params.messageType,
      reference_id: params.referenceId || null,
      reference_number: params.referenceNumber || null,
      message_text: params.message,
      status: result.ok ? "sent" : "failed",
      error_message: result.error || null,
      created_by: userData.user?.id,
      tenant_id: profile?.tenant_id,
    });
  }

  return anyOk ? { ok: true } : { ok: false, error: lastError };
}
