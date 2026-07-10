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

  // If it doesn't already carry the country code, add Pakistan's (92)
  if (!digits.startsWith("92")) {
    digits = `92${digits}`;
  }

  return `+${digits}`;
}
