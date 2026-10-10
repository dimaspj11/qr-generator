import { useEffect, useState, type FormEvent } from "react";
import * as Slider from "@radix-ui/react-slider";
import { ArrowLeftRight, Download, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { contrastRatio } from "@/lib/contrast";
import { cn } from "@/lib/utils";

type LevelId = "L" | "M" | "Q" | "H";
type Phase = "pending" | "empty" | "ready" | "error";

const LEVELS: { id: LevelId; name: string; recovery: string; detail: string }[] = [
  {
    id: "L",
    name: "Low",
    recovery: "7%",
    detail: "Pulih sekitar 7% kode yang rusak. Polanya paling kecil.",
  },
  {
    id: "M",
    name: "Medium",
    recovery: "15%",
    detail: "Pulih sekitar 15%. Pilihan yang aman untuk tautan dan catatan pendek.",
  },
  {
    id: "Q",
    name: "Quartile",
    recovery: "25%",
    detail: "Pulih sekitar 25%. Lebih baik jika hasil cetak bisa tergores.",
  },
  {
    id: "H",
    name: "High",
    recovery: "30%",
    detail: "Pulih sekitar 30%. Paling tahan rusak, tetapi polanya lebih rapat.",
  },
];

const PRESETS = [
  { id: "ink", label: "Ink", fg: "#141414", bg: "#f6f5f2" },
  { id: "inverse", label: "Inverse", fg: "#f6f5f2", bg: "#141414" },
  { id: "mist", label: "Mist", fg: "#1c2430", bg: "#d5dde6" },
  { id: "pine", label: "Pine", fg: "#1f3d34", bg: "#f3f6f4" },
] as const;

const EXAMPLES = [
  { label: "Sample link", value: "https://example.com" },
  { label: "Sample note", value: "Meet me at the north gate at noon." },
  { label: "Sample Wi-Fi", value: "WIFI:T:WPA;S:Cafe;P:secret123;;" },
] as const;

const DEFAULT_FG = PRESETS[0].fg;
const DEFAULT_BG = PRESETS[0].bg;
const MIN_SIZE = 128;
const MAX_SIZE = 1024;
const SIZE_STEP = 8;
const DEFAULT_SIZE = 320;
const QUIET_ZONE = 4;
const MAX_CHARS = 4000;
const MIN_CONTRAST = 3;

function parseHex(input: string): string | null {
  const value = input.trim();
  const full = /^#([0-9a-fA-F]{6})$/.exec(value);
  if (full?.[1]) return `#${full[1].toLowerCase()}`;
  const short = /^#([0-9a-fA-F]{3})$/.exec(value);
  if (short?.[1]) {
    const [r, g, b] = short[1].toLowerCase().split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return null;
}

function pngWidth(dataUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth);
    image.onerror = () => reject(new Error("Could not read the preview."));
    image.src = dataUrl;
  });
}

function fileName(content: string): string {
  try {
    const host = new URL(content.trim()).hostname.replace(/[^a-z0-9.-]/gi, "");
    if (host) return `qr-${host.slice(0, 48)}.png`;
  } catch {
    // Plain text has no host to use in the file name.
  }
  return "qr-code.png";
}

function friendlyQrError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/too big|too large|maximum/i.test(message)) {
    return "This text is too long for a QR code at this error correction level. Shorten it, or choose Low.";
  }
  return "Could not build a code from this text.";
}

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className="min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-2 flex gap-2">
        <input
          id={id}
          className="color-input shrink-0"
          type="color"
          value={parseHex(draft) ?? value}
          onChange={(event) => {
            const next = event.target.value.toLowerCase();
            setDraft(next);
            onChange(next);
          }}
        />
        <input
          aria-label={`${label} hex`}
          className="h-11 min-w-0 flex-1 rounded-control border border-border bg-background px-3 font-mono text-base tracking-wide text-foreground uppercase"
          value={draft}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          maxLength={7}
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const parsed = parseHex(next);
            if (parsed && next.length === 7) onChange(parsed);
          }}
          onBlur={() => {
            const parsed = parseHex(draft);
            if (parsed) {
              setDraft(parsed);
              onChange(parsed);
            } else {
              setDraft(value);
            }
          }}
        />
      </div>
    </div>
  );
}

export function QrStudio({ contentSeed }: { contentSeed?: { token: number; value: string } | null }) {
  const [content, setContent] = useState<string>(EXAMPLES[0].value);
  const [level, setLevel] = useState<LevelId>("M");
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [foreground, setForeground] = useState<string>(DEFAULT_FG);
  const [background, setBackground] = useState<string>(DEFAULT_BG);
  const [phase, setPhase] = useState<Phase>("pending");
  const [errorMessage, setErrorMessage] = useState("");
  const [renderedWidth, setRenderedWidth] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selectedLevel = LEVELS.find((item) => item.id === level) ?? LEVELS[1];
  const ratio = contrastRatio(foreground, background);
  const lowContrast = ratio < MIN_CONTRAST;

  useEffect(() => {
    if (!contentSeed) return;
    setContent(contentSeed.value);
  }, [contentSeed]);

  useEffect(() => {
    if (content.length === 0) {
      setPhase("empty");
      setErrorMessage("");
      setRenderedWidth(null);
      setPreviewUrl(null);
      return;
    }

    if (content.length > MAX_CHARS) {
      setPhase("error");
      setErrorMessage("This is too long to encode. Shorten it below 4,000 characters.");
      setRenderedWidth(null);
      setPreviewUrl(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const QRCode = await import("qrcode");
          if (cancelled) return;
          const url = await QRCode.toDataURL(content, {
            errorCorrectionLevel: level,
            width: size,
            margin: QUIET_ZONE,
            color: { dark: foreground, light: background },
          });
          if (cancelled) return;
          const width = await pngWidth(url);
          if (cancelled) return;
          setPreviewUrl(url);
          setRenderedWidth(width);
          setErrorMessage("");
          setPhase("ready");
        } catch (error) {
          if (cancelled) return;
          setPhase("error");
          setRenderedWidth(null);
          setPreviewUrl(null);
          setErrorMessage(friendlyQrError(error));
        }
      })();
    }, 32);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [background, content, foreground, level, size]);

  const statusMessage =
    phase === "error"
      ? errorMessage
      : content.length === 0
        ? "Enter a link or some text."
        : lowContrast
          ? `Contrast is ${ratio.toFixed(1)}:1. Scanners may fail below 3:1.`
          : phase === "ready"
            ? "Code ready."
            : "Drawing the code.";

  const overlay =
    phase === "ready"
      ? null
      : phase === "error"
        ? "Can't encode this"
        : phase === "empty"
          ? "Nothing to encode yet"
          : "Drawing the code";

  function download() {
    if (!previewUrl || phase !== "ready") return;
    void (async () => {
      const blob = await (await fetch(previewUrl)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName(content);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    })();
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    download();
  }

  return (
    <form className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8" onSubmit={onSubmit}>
        <section className="order-2 rounded-panel border border-border bg-card p-5 lg:order-1">
          <div className="flex flex-col gap-6">
            <div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="qr-content">URL or text</Label>
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2"
                  onClick={() => setContent("")}
                  disabled={content.length === 0}
                >
                  Clear
                </Button>
              </div>
              <textarea
                id="qr-content"
                className="mt-2 min-h-28 w-full resize-y rounded-control border border-border bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-subtle"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                placeholder="https://example.com"
                aria-describedby="qr-content-hint qr-content-count"
              />
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <p id="qr-content-hint" className="text-sm text-pretty text-muted">
                  Berubah setiap kali teks diubah. Tautan, catatan, atau teks Wi-Fi semuanya bisa dikodekan.
                </p>
                <p id="qr-content-count" className="shrink-0 font-mono text-xs text-subtle tabular-nums">
                  {content.length} characters
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Examples">
                {EXAMPLES.map((example) => (
                  <Button
                    key={example.label}
                    type="button"
                    variant="secondary"
                    aria-pressed={content === example.value}
                    className={
                      content === example.value
                        ? "border-foreground bg-foreground text-background hover:bg-foreground"
                        : undefined
                    }
                    onClick={() => setContent(example.value)}
                  >
                    {example.label}
                  </Button>
                ))}
              </div>
            </div>

            <fieldset aria-describedby="qr-ecl-help">
              <legend className="text-sm font-medium text-foreground">Error correction</legend>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {LEVELS.map((item) => {
                  const selected = item.id === level;
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex min-h-11 flex-col items-center justify-center rounded-control border px-1 py-2 text-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foreground",
                        selected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background text-foreground",
                      )}
                    >
                      <input
                        className="sr-only"
                        type="radio"
                        name="qr-ecl"
                        value={item.id}
                        checked={selected}
                        aria-label={`${item.name}, ${item.recovery} recovery`}
                        onChange={() => setLevel(item.id)}
                      />
                      <span className="font-mono text-sm font-medium">{item.id}</span>
                      <span className={cn("text-xs", selected ? "opacity-70" : "text-muted")}>
                        {item.recovery}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p id="qr-ecl-help" className="mt-2 text-sm text-pretty text-muted">
                {selectedLevel.detail}
              </p>
            </fieldset>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="qr-size">Size</Label>
                <output htmlFor="qr-size" className="font-mono text-sm text-muted tabular-nums">
                  {size} px
                </output>
              </div>
              <Slider.Root
                className="relative mt-2 flex h-11 w-full touch-none items-center select-none"
                min={MIN_SIZE}
                max={MAX_SIZE}
                step={SIZE_STEP}
                value={[size]}
                onValueChange={(values) => {
                  const next = values[0];
                  if (next !== undefined) setSize(next);
                }}
              >
                <Slider.Track className="relative h-1 grow rounded-full bg-raised">
                  <Slider.Range className="absolute h-full rounded-full bg-foreground" />
                </Slider.Track>
                <Slider.Thumb
                  id="qr-size"
                  aria-describedby="qr-size-help"
                  aria-valuetext={`${size} pixels`}
                  className="qr-thumb block size-5 rounded-full border-2 border-background bg-foreground"
                />
              </Slider.Root>
              <p id="qr-size-help" className="text-sm text-pretty text-muted">
                Lebar PNG dalam piksel, dari {MIN_SIZE} sampai {MAX_SIZE}. Angka ini sudah termasuk batas putih di sekeliling kode.
              </p>
            </div>

            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField id="qr-fg" label="Foreground" value={foreground} onChange={setForeground} />
                <ColorField id="qr-bg" label="Background" value={background} onChange={setBackground} />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  setForeground(background);
                  setBackground(foreground);
                }}
              >
                <ArrowLeftRight className="size-4" aria-hidden />
                Swap colors
              </Button>
              <p id="qr-presets-label" className="mt-5 text-sm font-medium text-foreground">
                Presets
              </p>
              <div
                role="group"
                aria-labelledby="qr-presets-label"
                className="mt-2 grid grid-cols-4 gap-2"
              >
                {PRESETS.map((preset) => {
                  const selected = foreground === preset.fg && background === preset.bg;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${preset.label}: ${preset.fg} on ${preset.bg}`}
                      onClick={() => {
                        setForeground(preset.fg);
                        setBackground(preset.bg);
                      }}
                      className={cn(
                        "flex min-h-11 flex-col justify-center gap-1 rounded-control border bg-background px-2 py-2 text-xs text-muted",
                        selected ? "border-foreground text-foreground" : "border-border",
                      )}
                    >
                      <span className="flex h-5 overflow-hidden rounded-sm border border-border">
                        <span className="h-full flex-1" style={{ backgroundColor: preset.fg }} />
                        <span className="h-full flex-1" style={{ backgroundColor: preset.bg }} />
                      </span>
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <aside className="order-1 self-start max-lg:sticky max-lg:top-20 max-lg:z-10 max-lg:bg-background max-lg:pb-3 lg:sticky lg:top-6 lg:order-2">
          <div className="rounded-preview border border-border bg-card p-4" aria-busy={phase === "pending"}>
            <div className="relative mx-auto aspect-square w-48 overflow-hidden rounded-sm border border-border bg-raised lg:w-full">
              {previewUrl && phase === "ready" ? (
                <img
                  src={previewUrl}
                  alt="QR code preview"
                  className="qr-preview absolute inset-0 h-full w-full"
                />
              ) : null}
              {overlay ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center" aria-hidden>
                  <QrCode className="size-6 text-subtle" />
                  <p className="text-sm text-muted">{overlay}</p>
                </div>
              ) : null}
            </div>

            <p
              id="qr-status"
              role="status"
              aria-live="polite"
              className={cn(
                "mt-3 min-h-10 text-sm text-pretty",
                phase === "error" ? "text-danger" : lowContrast && phase === "ready" ? "text-warn" : "text-muted",
              )}
            >
              {statusMessage}
              {phase === "ready" && renderedWidth !== null && renderedWidth !== size
                ? ` Drawn at ${renderedWidth} px so every module fits.`
                : ""}
            </p>

            <Button type="submit" className="mt-3 w-full" disabled={phase !== "ready"}>
              <Download className="size-4" aria-hidden />
              Download PNG
            </Button>
          </div>
        </aside>
      </form>
  );
}
