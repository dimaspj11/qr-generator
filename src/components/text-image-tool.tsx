import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { contrastRatio } from "@/lib/contrast";
import { cn } from "@/lib/utils";

type Shape = "square" | "portrait" | "landscape";

const SHAPES: { id: Shape; label: string; width: number; height: number }[] = [
  { id: "square", label: "Square", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait", width: 1080, height: 1350 },
  { id: "landscape", label: "Landscape", width: 1920, height: 1080 },
];

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const trial = current ? `${current} ${word}` : word;
    if (ctx.measureText(trial).width <= maxWidth) {
      current = trial;
      continue;
    }
    if (current) lines.push(current);
    if (ctx.measureText(word).width <= maxWidth) {
      current = word;
      continue;
    }
    let piece = "";
    for (const char of word) {
      const next = piece + char;
      if (ctx.measureText(next).width <= maxWidth) piece = next;
      else {
        if (piece) lines.push(piece);
        piece = char;
      }
    }
    current = piece;
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function drawPoster(input: {
  text: string;
  shape: Shape;
  size: number;
  foreground: string;
  background: string;
  align: "left" | "center";
}): { url: string; fit: boolean } {
  const shape = SHAPES.find((item) => item.id === input.shape) ?? SHAPES[0];
  const canvas = document.createElement("canvas");
  canvas.width = shape.width;
  canvas.height = shape.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the image.");
  const pad = Math.round(shape.width * 0.08);
  const maxWidth = shape.width - pad * 2;
  const maxHeight = shape.height - pad * 2;
  let fontSize = input.size;
  let lines: string[] = [];
  let lineHeight = 0;
  let fit = true;
  while (fontSize >= 28) {
    ctx.font = `600 ${fontSize}px Manrope, sans-serif`;
    lines = input.text.split("\n").flatMap((part) => wrapLine(ctx, part, maxWidth));
    lineHeight = Math.round(fontSize * 1.25);
    if (lines.length * lineHeight <= maxHeight) {
      fit = true;
      break;
    }
    fit = false;
    fontSize -= 4;
  }
  ctx.fillStyle = input.background;
  ctx.fillRect(0, 0, shape.width, shape.height);
  ctx.fillStyle = input.foreground;
  ctx.font = `600 ${fontSize}px Manrope, sans-serif`;
  ctx.textBaseline = "top";
  const block = Math.min(lines.length * lineHeight, maxHeight);
  let y = Math.round((shape.height - block) / 2);
  const visible = lines.slice(0, Math.max(1, Math.floor(maxHeight / lineHeight)));
  for (const line of visible) {
    const width = ctx.measureText(line).width;
    const x = input.align === "center" ? Math.round((shape.width - width) / 2) : pad;
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return { url: canvas.toDataURL("image/png"), fit: fit && visible.length === lines.length };
}

export function TextImageTool() {
  const [text, setText] = useState("Hello");
  const [shape, setShape] = useState<Shape>("square");
  const [size, setSize] = useState(96);
  const [foreground, setForeground] = useState("#141414");
  const [background, setBackground] = useState("#f6f5f2");
  const [align, setAlign] = useState<"left" | "center">("center");
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const ratio = contrastRatio(foreground, background);

  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      setPreview(null);
      setNote("Type some text.");
      return;
    }
    let cancelled = false;
    void (async () => {
      await document.fonts.load(`600 ${size}px Manrope`);
      if (cancelled) return;
      try {
        const drawn = drawPoster({ text: trimmed, shape, size, foreground, background, align });
        if (cancelled) return;
        setPreview(drawn.url);
        setNote(
          !drawn.fit
            ? "Shorten the text. It does not all fit."
            : ratio < 3
              ? "Contrast is low. The text may be hard to read."
              : "Image ready.",
        );
      } catch {
        if (!cancelled) {
          setPreview(null);
          setNote("Could not draw that image.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [align, background, foreground, ratio, shape, size, text]);

  function download() {
    if (!preview) return;
    const link = document.createElement("a");
    link.href = preview;
    link.download = "text-image.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <section className="mx-auto mt-6 grid w-full max-w-xl gap-6">
      <form className="rounded-panel border border-border bg-card p-5" onSubmit={(event) => event.preventDefault()}>
        <div className="flex flex-col gap-5">
          <div>
            <Label htmlFor="poster-text">Text</Label>
            <textarea
              id="poster-text"
              className="mt-2 min-h-28 w-full resize-y rounded-control border border-border bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-subtle"
              value={text}
              maxLength={400}
              onChange={(event) => setText(event.target.value)}
              placeholder="A short line for a poster or story"
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Shape</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SHAPES.map((item) => {
                const selected = shape === item.id;
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
                    <input className="sr-only" type="radio" name="poster-shape" checked={selected} onChange={() => setShape(item.id)} />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Align</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["center", "left"] as const).map((item) => {
                const selected = align === item;
                return (
                  <label
                    key={item}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center justify-center rounded-control border text-sm font-medium capitalize",
                      selected
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-muted",
                    )}
                  >
                    <input className="sr-only" type="radio" name="poster-align" checked={selected} onChange={() => setAlign(item)} />
                    {item}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="poster-size">Text size</Label>
              <output htmlFor="poster-size" className="font-mono text-sm text-muted tabular-nums">
                {size}
              </output>
            </div>
            <input
              id="poster-size"
              className="mt-2 h-11 w-full accent-foreground"
              type="range"
              min={48}
              max={160}
              step={4}
              value={size}
              onChange={(event) => setSize(Number(event.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="poster-fg">Text color</Label>
              <input id="poster-fg" className="color-input mt-2" type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="poster-bg">Background</Label>
              <input id="poster-bg" className="color-input mt-2" type="color" value={background} onChange={(event) => setBackground(event.target.value)} />
            </div>
          </div>
        </div>
      </form>

      <div className="rounded-panel border border-border bg-card p-5 text-center">
        {preview ? (
          <img src={preview} alt="Preview of the text image" className="mx-auto max-h-80 w-full rounded-sm object-contain" />
        ) : (
          <p className="flex min-h-48 items-center justify-center text-sm text-muted">Type some text.</p>
        )}
        <p className="mt-3 min-h-6 text-sm text-muted" role="status">
          {note}
        </p>
        <Button type="button" className="mt-3 w-full" disabled={!preview} onClick={download}>
          <Download className="size-4" aria-hidden />
          Download PNG
        </Button>
      </div>
    </section>
  );
}
