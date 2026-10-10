import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { generateImage } from "@/lib/imagine";
import { cn } from "@/lib/utils";

const SHAPES = [
  { id: "1:1", label: "Square" },
  { id: "3:4", label: "Portrait" },
  { id: "16:9", label: "Landscape" },
] as const;

type Ratio = (typeof SHAPES)[number]["id"];

export function TextImageTool() {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await generateImage({ data: { prompt, ratio } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSrc(result.src);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the image. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = src.startsWith("data:image/jpeg") ? "text-image.jpg" : "text-image.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <section className="mx-auto mt-6 grid w-full max-w-xl gap-6">
      <form
        className="rounded-panel border border-border bg-card p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <div className="flex flex-col gap-5">
          <div>
            <Label htmlFor="imagine-prompt">Description</Label>
            <textarea
              id="imagine-prompt"
              className="mt-2 min-h-28 w-full resize-y rounded-control border border-border bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-subtle"
              value={prompt}
              maxLength={1000}
              placeholder="A blue ceramic cup on a wooden table, soft daylight"
              onChange={(event) => setPrompt(event.target.value)}
            />
            <p className="mt-2 text-sm text-muted">Press Create image. Each picture uses your image quota.</p>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Shape</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SHAPES.map((item) => {
                const selected = ratio === item.id;
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
                      name="imagine-shape"
                      checked={selected}
                      onChange={() => setRatio(item.id)}
                    />
                    {item.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <Button type="submit" disabled={busy || prompt.trim().length < 2}>
            {busy ? "Drawing…" : "Create image"}
          </Button>
        </div>
      </form>

      <div className="rounded-panel border border-border bg-card p-5 text-center">
        {src ? (
          <img src={src} alt="Generated picture" className="mx-auto max-h-80 w-full rounded-sm object-contain" />
        ) : (
          <p className="flex min-h-48 items-center justify-center text-sm text-muted">
            {busy ? "Drawing the picture." : "Nothing drawn yet."}
          </p>
        )}
        <p className="mt-3 min-h-6 text-sm text-pretty" role="status">
          {error ? <span className="text-danger">{error}</span> : null}
        </p>
        <Button type="button" className="mt-3 w-full" disabled={!src} onClick={download}>
          <Download className="size-4" aria-hidden />
          Download
        </Button>
      </div>
    </section>
  );
}
