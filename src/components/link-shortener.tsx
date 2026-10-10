import { useEffect, useState, type FormEvent } from "react";
import { Copy, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { createShortLink, listShortLinks, type ShortLink } from "@/lib/short-links";

function shortPath(code: string) {
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
  return `${prefix}/s/${code}`;
}

function publicHref(code: string) {
  return `${window.location.origin}${shortPath(code)}`;
}

export function LinkShortener({ onMakeQr }: { onMakeQr: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const [code, setCode] = useState("");
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listShortLinks()
      .then((rows) => {
        if (!cancelled) setLinks(rows);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load recent links.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const created = await createShortLink({ data: { url, code } });
      setLinks((current) => [created, ...current.filter((item) => item.code !== created.code)].slice(0, 8));
      setStatus(publicHref(created.code));
      setUrl("");
      setCode("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not shorten that link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setError("Could not copy. Select the link and copy it manually.");
    }
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-xl rounded-panel border border-border bg-card p-5">
      <form className="flex flex-col gap-5" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="long-url">Long URL</Label>
          <input
            id="long-url"
            className="mt-2 h-11 w-full rounded-control border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-subtle"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://example.com/a-very-long-path"
            required
          />
        </div>
        <div>
          <Label htmlFor="custom-code">Custom ending</Label>
          <input
            id="custom-code"
            className="mt-2 h-11 w-full rounded-control border border-border bg-background px-3 font-mono text-base text-foreground outline-none placeholder:text-subtle"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="optional, like cafe-menu"
            maxLength={32}
            aria-describedby="custom-code-hint"
          />
          <p id="custom-code-hint" className="mt-2 text-sm text-muted">
            Leave this blank for a random ending. 3–32 letters, numbers, or hyphens.
          </p>
        </div>
        <Button type="submit" disabled={busy || url.trim().length === 0}>
          {busy ? "Saving…" : "Shorten link"}
        </Button>
      </form>

      <p className="mt-4 min-h-6 text-sm text-pretty" role="status">
        {error ? <span className="text-danger">{error}</span> : status ? <span className="text-muted">Link ready.</span> : null}
      </p>

      {status ? (
        <div className="mt-2 flex flex-col gap-3 rounded-preview border border-border bg-background p-4">
          <a
            className="flex min-h-11 items-center break-all font-mono text-base text-accent underline"
            href={new URL(status).pathname}
          >
            {status}
          </a>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => void copy(status)}>
              <Copy className="size-4" aria-hidden />
              {copied === status ? "Copied" : "Copy"}
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={() => onMakeQr(status)}>
              <QrCode className="size-4" aria-hidden />
              QR
            </Button>
          </div>
        </div>
      ) : null}

      <h2 className="mt-8 text-sm font-medium text-foreground">Recent links</h2>
      {links.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing shortened yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {links.map((link) => {
            const href = publicHref(link.code);
            return (
              <li key={link.code} className="rounded-control border border-border bg-background p-3">
                <a className="flex min-h-11 items-center break-all font-mono text-base text-accent underline" href={shortPath(link.code)}>
                  {href}
                </a>
                <p className="mt-1 break-all text-sm text-muted">{link.url}</p>
                <div className="mt-3 flex gap-2">
                  <Button type="button" variant="ghost" className="px-2" onClick={() => void copy(href)}>
                    {copied === href ? "Copied" : "Copy"}
                  </Button>
                  <Button type="button" variant="ghost" className="px-2" onClick={() => onMakeQr(href)}>
                    Make QR
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
