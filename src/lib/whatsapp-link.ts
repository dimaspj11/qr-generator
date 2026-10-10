/** Build a wa.me link. Local numbers may start with 0; the country code is not doubled. */
export function whatsAppLink(country: string, local: string, message: string): string | null {
  const cc = country.replace(/\D/g, "");
  let digits = local.replace(/\D/g, "");
  if (!cc || !digits) return null;
  if (digits.startsWith("0")) digits = digits.slice(1);
  const full = digits.startsWith(cc) ? digits : `${cc}${digits}`;
  if (full.length < 8 || full.length > 15) return null;
  const url = new URL(`https://wa.me/${full}`);
  const text = message.trim();
  if (text) url.searchParams.set("text", text);
  return url.toString();
}
