import { supabase } from "@/integrations/supabase/client";
import { shoibSendText } from "@/lib/shoib";

export type WhatsAppSendInput = {
  apiBase: string;
  token: string;
  toNumber: string;
  message: string;
};

export type WhatsAppSendResult = { ok: boolean; error?: string };

/**
 * Sends a text message through the connected Shoib WhatsApp gateway
 * (see src/lib/shoib.ts — the account is connected once from Settings ->
 * WhatsApp using a phone-number pairing code).
 */
export async function sendWhatsAppMessage(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
  if (!input.token) {
    return { ok: false, error: "WhatsApp isn't connected yet — connect it from Settings -> WhatsApp first" };
  }
  try {
    await shoibSendText(input.apiBase, input.token, input.toNumber.replace(/\D/g, ""), input.message);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not reach the WhatsApp gateway" };
  }
}

/**
 * Sends a WhatsApp message and records the attempt in whatsapp_logs so it
 * shows up on the monitoring page, regardless of whether it succeeds.
 */
export async function sendAndLogWhatsApp(params: {
  apiBase: string;
  token: string;
  customerId?: string;
  customerName?: string;
  toNumber: string;
  message: string;
  messageType: "invoice" | "due_reminder" | "order_status" | "other";
  referenceId?: string;
  referenceNumber?: string;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const result = await sendWhatsAppMessage(params);
  await supabase.from("whatsapp_logs").insert({
    customer_id: params.customerId || null,
    customer_name: params.customerName || null,
    whatsapp_number: params.toNumber,
    message_type: params.messageType,
    reference_id: params.referenceId || null,
    reference_number: params.referenceNumber || null,
    message_text: params.message,
    status: result.ok ? "sent" : "failed",
    error_message: result.error || null,
    created_by: userData.user?.id,
  });
  return result;
}
