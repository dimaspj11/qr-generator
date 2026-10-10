export type WifiSecurity = "WPA" | "WEP" | "nopass";

function escapeWifi(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/([;,:"])/g, "\\$1");
}

/** WIFI: payload that phone cameras understand. */
export function wifiPayload(input: {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}): string | null {
  const ssid = input.ssid.trim();
  if (!ssid) return null;
  if (input.security !== "nopass" && input.password.length === 0) return null;
  const parts = [`T:${input.security}`, `S:${escapeWifi(ssid)}`];
  if (input.security !== "nopass") parts.push(`P:${escapeWifi(input.password)}`);
  if (input.hidden) parts.push("H:true");
  return `WIFI:${parts.join(";")};;`;
}

export type WifiNetwork = {
  ssid: string;
  password: string;
  security: string;
  hidden: boolean;
};

/** Read a WIFI: QR payload. Returns null when it is not a Wi-Fi code. */
export function parseWifiPayload(raw: string): WifiNetwork | null {
  const trimmed = raw.trim();
  if (!/^WIFI:/i.test(trimmed)) return null;
  const body = trimmed.slice(5);
  const parts: string[] = [];
  let buffer = "";
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === "\\" && index + 1 < body.length) {
      buffer += body[index + 1];
      index += 1;
      continue;
    }
    if (char === ";") {
      parts.push(buffer);
      buffer = "";
      continue;
    }
    buffer += char;
  }
  if (buffer) parts.push(buffer);
  const fields = new Map<string, string>();
  for (const part of parts) {
    const split = part.indexOf(":");
    if (split <= 0) continue;
    fields.set(part.slice(0, split).toUpperCase(), part.slice(split + 1));
  }
  const ssid = fields.get("S")?.trim() ?? "";
  if (!ssid) return null;
  const security = (fields.get("T") || "nopass").toUpperCase();
  return {
    ssid,
    password: fields.get("P") ?? "",
    security,
    hidden: /^true$/i.test(fields.get("H") ?? ""),
  };
}
