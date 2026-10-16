import { CHAT_MAX_LEN } from "./config";

/** Trim and collapse whitespace so " a   b " and "a b" count as the same text. */
export function normalizeBody(body: string): string {
  return body.replace(/\s+/g, " ").trim();
}

/**
 * Why a message is refused, or null when it is fine. Links, phone numbers and social handles are not allowed:
 * they invite scams and spam, and this chat is only for what people see at the station right now.
 * Shared by the server (authoritative) and the form (instant feedback).
 */
export function blockedReason(raw: string): string | null {
  const body = normalizeBody(raw);
  if (body.length === 0) return "Tulis pesan dulu.";
  if (body.length > CHAT_MAX_LEN) return `Pesan terlalu panjang (maksimal ${CHAT_MAX_LEN} karakter).`;

  const link = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|id|co|io|me|link|xyz|info|biz|app|ly|gl|wa)\b)/i;
  const handle = /@[a-z0-9_.]{3,}/i;
  // Digits separated by spaces, dots or dashes count as one number: "0812 3456 7890", "0812-3456-7890".
  const digits = body.replace(/(\d)[\s.\-()]+(?=\d)/g, "$1"); // no lookbehind: old iOS Safari cannot parse it
  const phone = /\d{8,}/;
  if (link.test(body) || handle.test(body) || phone.test(digits)) {
    return "Pesan tidak boleh berisi tautan, nomor telepon, atau akun media sosial.";
  }
  return null;
}
