import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { wifiPayload, type WifiSecurity } from "@/lib/wifi-payload";
import { cn } from "@/lib/utils";

const SECURITY: { id: WifiSecurity; label: string }[] = [
  { id: "WPA", label: "WPA" },
  { id: "WEP", label: "WEP" },
  { id: "nopass", label: "None" },
];

export function WifiTool({ onMakeQr }: { onMakeQr: (value: string) => void }) {
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [security, setSecurity] = useState<WifiSecurity>("WPA");
  const [hidden, setHidden] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");

  const payload = wifiPayload({ ssid, password, security, hidden });

  useEffect(() => {
    if (!payload) {
      setPreview(null);
      setError("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const QRCode = await import("qrcode");
        const url = await QRCode.toDataURL(payload, {
          errorCorrectionLevel: "H",
          width: 320,
          margin: 4,
          color: { dark: "#141414", light: "#f6f5f2" },
        });
        if (!cancelled) {
          setPreview(url);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setPreview(null);
          setError("Could not build a Wi-Fi code.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payload]);

  function download() {
    if (!preview) return;
    const link = document.createElement("a");
    link.href = preview;
    link.download = "wifi-qr.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <section className="mx-auto mt-6 grid w-full max-w-xl gap-6">
      <form className="rounded-panel border border-border bg-card p-5" onSubmit={(event) => event.preventDefault()}>
        <div className="flex flex-col gap-5">
          <div>
            <Label htmlFor="wifi-ssid">Network name</Label>
            <input
              id="wifi-ssid"
              className="mt-2 h-11 w-full rounded-control border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-subtle"
              value={ssid}
              autoComplete="off"
              placeholder="Cafe Wi-Fi"
              onChange={(event) => setSsid(event.target.value)}
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Security</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SECURITY.map((item) => {
                const selected = security === item.id;
                return (
                  <label
                    key={item.id}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-center rounded-control border text-sm font-medium",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted",
                    )}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="wifi-security"
                      checked={selected}
                      onChange={() => setSecurity(item.id)}
                    />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          {security !== "nopass" ? (
            <div>
              <Label htmlFor="wifi-password">Password</Label>
              <input
                id="wifi-password"
                className="mt-2 h-11 w-full rounded-control border border-border bg-background px-3 text-base text-foreground outline-none"
                type="text"
                autoComplete="off"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
          ) : null}
          <label className="flex min-h-11 items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              className="size-4 accent-foreground"
              checked={hidden}
              onChange={(event) => setHidden(event.target.checked)}
            />
            Hidden network
          </label>
        </div>
      </form>

      <div className="rounded-panel border border-border bg-card p-5 text-center">
        {preview ? (
          <img src={preview} alt="QR code for this Wi-Fi network" className="mx-auto w-48 rounded-sm" />
        ) : (
          <p className="flex min-h-48 items-center justify-center text-sm text-muted">
            {security !== "nopass" && ssid.trim() && !password
              ? "Isi sandi. Tanpa sandi, kode WPA tidak bisa dipindai."
              : "Isi nama jaringan. Nama ini harus sama dengan SSID yang tampil di ponsel."}
          </p>
        )}
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1" disabled={!preview} onClick={download}>
            <Download className="size-4" aria-hidden />
            Download PNG
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={!payload}
            onClick={() => payload && onMakeQr(payload)}
          >
            Edit in QR tool
          </Button>
        </div>
      </div>
    </section>
  );
}
