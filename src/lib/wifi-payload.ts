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
