import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const SHAPES = [
  { id: "1:1", label: "Square" },
  { id: "3:4", label: "Portrait" },
  { id: "16:9", label: "Landscape" },
] as const;

const SUBSCRIBE_URL = "https://puter.com/dashboard#billing";

type Ratio = (typeof SHAPES)[number]["id"];
type PuterClient = typeof import("@heyputer/puter.js").puter;

function detail(error: unknown) {
  if (error instanceof Error) return { code: "", message: error.message };
  if (!error || typeof error !== "object") return { code: "", message: "Could not create the image. Try again." };
  const record = error as {
    message?: unknown;
    code?: unknown;
    status?: unknown;
    error?: unknown;
  };
  const nested = record.error && typeof record.error === "object" ? (record.error as { message?: unknown; code?: unknown; status?: unknown }) : {};
  const code = [record.code, record.error, nested.code].find((item) => typeof item === "string") as string | undefined;
  const message = [record.message, nested.message].find((item) => typeof item === "string" && item.trim()) as string | undefined;
  const status = typeof record.status === "number" ? record.status : typeof nested.status === "number" ? nested.status : undefined;
  return {
    code: code ?? "",
    message: message || (status ? `Request failed (${status}).` : "Could not create the image. Try again."),
  };
}

function isSubscribeError(error: unknown, code: string, message: string) {
  return /insufficient_funds|subscription_required|usage_limited|quota|allowance/i.test(`${code} ${message}`) || (error && typeof error === "object" && "status" in error && (error as { status?: unknown }).status === 402);
}

export function TextImageTool() {
  const puterRef = useRef<PuterClient | null>(null);
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<Ratio>("1:1");
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [subscribe, setSubscribe] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("@heyputer/puter.js").then((mod) => {
      if (cancelled) return;
      puterRef.current = mod.puter;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function create() {
    const puter = puterRef.current;
    if (!puter) return;
    setBusy(true);
    setError("");
    setSubscribe(false);
    try {
      if (!puter.auth.isSignedIn()) {
        await puter.auth.signIn({ attempt_temp_user_creation: true });
      }
      const image = await puter.ai.txt2img(prompt.trim(), {
        model: "@cf/black-forest-labs/flux-1-schnell",
        provider: "cloudflare",
        aspect_ratio: ratio,
      });
      const next = image.currentSrc || image.src;
      if (!next) throw new Error("The image came back empty. Try again.");
      setSrc(next);
    } catch (caught) {
      const info = detail(caught);
      if (isSubscribeError(caught, info.code, info.message)) {
        setSubscribe(true);
        setError("Your free Puter allowance is used up. Subscribe to keep making images.");
      } else if (/popup_blocked|auth_window_closed|unauthorized|401/i.test(`${info.code} ${info.message}`)) {
        setError("Sign in to Puter in the window that opens. Free images use that account.");
      } else {
        setError(info.message);
      }
    } finally {
      setBusy(false);
    }
  }

  function download() {
    if (!src) return;
    const link = document.createElement("a");
    link.href = src;
    link.download = "text-image.png";
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
            <p className="mt-2 text-sm text-muted">
              A Puter window asks you to continue. A few images are free. After that, subscribe there.
            </p>
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
          <Button type="submit" disabled={!ready || busy || subscribe || prompt.trim().length < 2}>
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
        {subscribe ? (
          <a
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-accent px-4 text-sm font-medium text-accent-foreground"
            href={SUBSCRIBE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Subscribe to Puter
          </a>
        ) : (
          <Button type="button" className="mt-3 w-full" disabled={!src} onClick={download}>
            <Download className="size-4" aria-hidden />
            Download
          </Button>
        )}
      </div>
    </section>
  );
}
