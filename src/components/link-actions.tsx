import { Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LinkActions({
  href,
  copied,
  onCopy,
  onMakeQr,
  onShorten,
  shortening,
}: {
  href: string;
  copied: boolean;
  onCopy: () => void;
  onMakeQr: () => void;
  onShorten?: () => void;
  shortening?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="button" variant="secondary" className="flex-1" onClick={onCopy}>
        <Copy className="size-4" aria-hidden />
        {copied ? "Copied" : "Copy"}
      </Button>
      {onShorten ? (
        <Button type="button" variant="secondary" className="flex-1" onClick={onShorten} disabled={shortening}>
          {shortening ? "Saving…" : "Shorten"}
        </Button>
      ) : null}
      <Button type="button" variant="secondary" className="flex-1" onClick={onMakeQr}>
        <QrCode className="size-4" aria-hidden />
        QR
      </Button>
      <a
        className="inline-flex min-h-11 flex-1 items-center justify-center rounded-control border border-border bg-raised px-4 text-sm font-medium text-foreground"
        href={href}
      >
        Open
      </a>
    </div>
  );
}
