/**
 * Normalizes a Pakistani phone number to E.164-ish "+92XXXXXXXXXX" format,
 * regardless of how staff type it in: with 0, with 92, with +92, with
 * spaces/dashes, etc. Used for WhatsApp numbers so every customer record
 * ends up in a single consistent, dial-able format.
 *
 * Examples:
 *   "03001234567"      -> "+923001234567"
 *   "3001234567"       -> "+923001234567"
 *   "923001234567"     -> "+923001234567"
 *   "+92 300 1234567"  -> "+923001234567"
 *   "0092 300 1234567" -> "+923001234567"
 *   "+919876543210"    -> "+919876543210" (already has a non-PK country
 *                          code — left as-is instead of getting "92" glued
 *                          on top and turned into a garbled number)
 */
export function normalizeWhatsAppNumber(raw: string): string {
  if (!raw) return "";
  let digits = raw.replace(/[^\d+]/g, "");

  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  // Strip a leading trunk 0 (e.g. 03001234567 -> 3001234567)
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Pakistani numbers (mobile or landline w/ area code) are always a
  // 10-digit subscriber number once the trunk 0 / country code is gone.
  // Only prepend "92" when what's left actually looks like a bare local
  // number (10 digits) — a customer's already-international number (a
  // different, or typo'd, country code — e.g. an Indian "+91..." number)
  // is 11+ digits and must NOT get "92" glued on top of it, or it silently
  // turns into a garbled, undeliverable number instead of the real one.
  if (!digits.startsWith("92") && digits.length === 10) {
    digits = `92${digits}`;
  }

  return `+${digits}`;
}
