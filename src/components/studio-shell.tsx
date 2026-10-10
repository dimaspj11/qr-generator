import { useState } from "react";
import { LinkShortener } from "@/components/link-shortener";
import { QrStudio } from "@/components/qr-studio";
import { cn } from "@/lib/utils";

type Tool = "qr" | "short";

const TOOLS: { id: Tool; label: string }[] = [
  { id: "qr", label: "QR code" },
  { id: "short", label: "Short link" },
];

export function StudioShell() {
  const [tool, setTool] = useState<Tool>("qr");
  const [contentSeed, setContentSeed] = useState<{ token: number; value: string } | null>(null);

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
        <p className="mt-1 text-center text-pretty text-muted">
          {tool === "qr"
            ? "Type a link or any text. The preview updates immediately, then save a PNG."
            : "Paste a long URL. Share the short link, or turn it into a QR code."}
        </p>
      </header>

      <div className="sticky top-0 z-20 -mx-4 bg-background px-4 py-3">
        <div className="mx-auto flex w-full max-w-sm gap-2" role="tablist" aria-label="Tools">
        {TOOLS.map((item) => {
          const selected = tool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "min-h-11 flex-1 rounded-control border text-sm font-medium",
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
        <LinkShortener
          onMakeQr={(url) => {
            setContentSeed({ token: Date.now(), value: url });
            setTool("qr");
          }}
        />
      </div>
    </main>
  );
}
