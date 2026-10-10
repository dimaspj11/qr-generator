import { useMemo, useState } from "react";
import { LinkActions } from "@/components/link-actions";
import { Label } from "@/components/ui/label";
import { createShortLink } from "@/lib/short-links";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { whatsAppLink } from "@/lib/whatsapp-link";

export function WhatsAppTool({ onMakeQr }: { onMakeQr: (value: string) => void }) {
  const [country, setCountry] = useState("62");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const link = useMemo(() => whatsAppLink(country, phone, message), [country, phone, message]);

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setError("");
    } catch {
      setError("Could not copy. Select the link and copy it manually.");
    }
  }

  async function shorten() {
    if (!link) return;
    setBusy(true);
    setError("");
    try {
      const created = await createShortLink({ data: { url: link, code: "" } });
      const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
      const href = `${window.location.origin}${prefix}/s/${created.code}`;
      setShortUrl(href);
      setCopied("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not shorten that link.");
    } finally {
      setBusy(false);
    }
  }

  const shown = shortUrl || link;

  return (
    <section className="mx-auto mt-6 w-full max-w-xl rounded-panel border border-border bg-card p-5">
      <form className="flex flex-col gap-5" onSubmit={(event) => event.preventDefault()}>
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2">
          <div>
            <Label htmlFor="wa-country">Code</Label>
            <input
              id="wa-country"
              className="mt-2 h-11 w-full rounded-control border border-border bg-background px-3 font-mono text-base text-foreground outline-none"
              inputMode="numeric"
              autoComplete="tel-country-code"
              value={country}
              maxLength={4}
              onChange={(event) => {
                setShortUrl("");
                setCountry(event.target.value.replace(/\D/g, ""));
              }}
            />
          </div>
          <div>
            <Label htmlFor="wa-phone">Phone number</Label>
            <input
              id="wa-phone"
              className="mt-2 h-11 w-full rounded-control border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-subtle"
              inputMode="tel"
              autoComplete="tel"
              placeholder="812 3456 7890"
              value={phone}
              onChange={(event) => {
                setShortUrl("");
                setPhone(event.target.value);
              }}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="wa-message">Message</Label>
          <textarea
            id="wa-message"
            className="mt-2 min-h-24 w-full resize-y rounded-control border border-border bg-background px-3 py-3 text-base text-foreground outline-none placeholder:text-subtle"
            placeholder="Hello, I would like to order."
            value={message}
            maxLength={500}
            onChange={(event) => {
              setShortUrl("");
              setMessage(event.target.value);
            }}
          />
          <p className="mt-2 text-sm text-muted">A leading 0 is removed. Country code 62 is Indonesia.</p>
        </div>
      </form>

      <p className="mt-4 min-h-6 break-all font-mono text-sm text-accent" role="status">
        {shown ?? "Enter a phone number."}
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {shown ? (
        <div className="mt-3">
          <LinkActions
            href={shown}
            copied={copied === shown}
            shortening={busy}
            onCopy={() => void copy(shown)}
            onShorten={link ? () => void shorten() : undefined}
            onMakeQr={() => onMakeQr(shown)}
          />
        </div>
      ) : null}
    </section>
  );
}
