import { useState } from "react";
import { LinkShortener } from "@/components/link-shortener";
import { QrReader } from "@/components/qr-reader";
import { QrStudio } from "@/components/qr-studio";
import { WhatsAppTool } from "@/components/whatsapp-tool";
import { WifiTool } from "@/components/wifi-tool";
import { cn } from "@/lib/utils";

type Tool = "qr" | "short" | "whatsapp" | "wifi" | "scan";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "qr", label: "QR code" },
  { id: "short", label: "Short link" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "wifi", label: "Wi-Fi" },
  { id: "scan", label: "Scan" },
];

const COPY: Record<Tool, string> = {
  qr: "Type a link or any text. The preview updates immediately, then save a PNG.",
  short: "Paste a long URL. Share the short link, or turn it into a QR code.",
  whatsapp: "Build a WhatsApp chat link, then shorten it or turn it into a QR code.",
  wifi: "Put a network on a QR code guests can scan to join.",
  scan: "Read a QR code with the camera or from a picture.",
};

export function StudioShell() {
  const [tool, setTool] = useState<Tool>("qr");
  const [contentSeed, setContentSeed] = useState<{ token: number; value: string } | null>(null);

  function openInQr(value: string) {
    setContentSeed({ token: Date.now(), value });
    setTool("qr");
  }

  return (
    <main className="page-shell mx-auto w-full max-w-5xl">
      <header className="mx-auto w-full max-w-xs">
        <h1>
          <img
            src="/logo.jpg"
            alt="QR Generator. Create your QR code instantly."
            width={1039}
            height={825}
            className="h-auto w-full"
          />
        </h1>
        <p className="mt-1 text-center text-pretty text-muted">{COPY[tool]}</p>
      </header>

      <div className="sticky top-0 z-20 -mx-4 bg-background px-4 py-3">
        <div className="mx-auto grid w-full max-w-lg grid-cols-2 gap-2 sm:grid-cols-3" role="tablist" aria-label="Tools">
          {TOOLS.map((item) => {
            const selected = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={cn(
                  "min-h-11 rounded-control border px-2 text-sm font-medium",
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-muted",
                )}
                onClick={() => setTool(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div hidden={tool !== "qr"}>
        <QrStudio contentSeed={contentSeed} />
      </div>
      <div hidden={tool !== "short"}>
        <LinkShortener onMakeQr={openInQr} />
      </div>
      <div hidden={tool !== "whatsapp"}>
        <WhatsAppTool onMakeQr={openInQr} />
      </div>
      <div hidden={tool !== "wifi"}>
        <WifiTool onMakeQr={openInQr} />
      </div>
      <div hidden={tool !== "scan"}>
        <QrReader active={tool === "scan"} onMakeQr={openInQr} />
      </div>
    </main>
  );
}
