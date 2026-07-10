import { supabase } from "@/integrations/supabase/client";

export type WhatsAppSendInput = {
  webhookUrl: string;
  webhookApiKey?: string;
  toNumber: string;
  message: string;
  pdfUrl?: string;
};

export type WhatsAppSendResult = { ok: boolean; error?: string };

/**
 * Calls the self-hosted WhatsApp sender (Blito/Baileys-style webhook)
 * configured under Settings -> WhatsApp. The exact request shape below
 * ({ to, message, mediaUrl }) is a reasonable default for this style of
 * server, but may need a small tweak to match your specific gateway's API
 * — once you share its endpoint docs this can be finalized.
 */
export async function sendWhatsAppMessage(input: WhatsAppSendInput): Promise<WhatsAppSendResult> {
  if (!input.webhookUrl) {
    return { ok: false, error: "No WhatsApp webhook URL configured in Settings" };
  }
  try {
    const res = await fetch(input.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(input.webhookApiKey ? { Authorization: `Bearer ${input.webhookApiKey}` } : {}),
      },
      body: JSON.stringify({
        to: input.toNumber,
        message: input.message,
        mediaUrl: input.pdfUrl,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `Webhook returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error calling webhook" };
  }
}

/**
 * Sends a WhatsApp message and records the attempt in whatsapp_logs so it
 * shows up on the monitoring page, regardless of whether it succeeds.
 */
export async function sendAndLogWhatsApp(params: {
  webhookUrl: string;
  webhookApiKey?: string;
  customerId?: string;
  customerName?: string;
  toNumber: string;
  message: string;
  pdfUrl?: string;
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
