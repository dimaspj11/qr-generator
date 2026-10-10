import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { LinkActions } from "@/components/link-actions";
import { Button } from "@/components/ui/button";
import { readQrFromFile, readQrFromSource } from "@/lib/read-qr";
import { parseWifiPayload } from "@/lib/wifi-payload";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { createShortLink } from "@/lib/short-links";

function asUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function QrReader({ active, onMakeQr }: { active: boolean; onMakeQr: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [wifiNote, setWifiNote] = useState("");
  const [shortUrl, setShortUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  useEffect(() => {
    if (active || !stream) return;
    stream.getTracks().forEach((track) => track.stop());
    setStream(null);
    setScanning(false);
  }, [active, stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => setError("Could not start the camera."));
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    if (!scanning || !stream) return;
    let timer = 0;
    let stopped = false;
    const tick = () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        void (async () => {
          try {
            const text = await readQrFromSource(video, video.videoWidth, video.videoHeight);
            if (stopped || !text) return;
            setResult(text);
            setShortUrl("");
            setWifiNote("");
            setError("");
            setScanning(false);
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
          } catch {
            // A single camera frame can fail without ending the scan.
          }
        })();
      }
      timer = window.setTimeout(tick, 250);
    };
    timer = window.setTimeout(tick, 250);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [scanning, stream]);

  async function startCamera() {
    setError("");
    setResult("");
    setShortUrl("");
    setWifiNote("");
    if (!window.isSecureContext) {
      setError("Live camera needs a secure page. Use Take photo instead.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser has no live camera. Use Take photo instead.");
      return;
    }
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setStream(next);
      setScanning(true);
    } catch {
      setError("Camera permission was blocked. Use Take photo instead.");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setShortUrl("");
    setWifiNote("");
    try {
      const text = await readQrFromFile(file);
      if (!text) {
        setResult("");
        setError("No QR code found in that picture.");
        return;
      }
      setResult(text);
    } catch {
      setError("Could not read that picture.");
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
    } catch {
      setError("Could not copy. Select the text and copy it manually.");
    }
  }

  async function shorten(url: string) {
    setBusy(true);
    setError("");
    try {
      const created = await createShortLink({ data: { url, code: "" } });
      const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
      setShortUrl(`${window.location.origin}${prefix}/s/${created.code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not shorten that link.");
    } finally {
      setBusy(false);
    }
  }

  const url = result ? asUrl(result) : null;
  const wifi = result ? parseWifiPayload(result) : null;
  const shown = shortUrl || url;

  async function connectWifi() {
    if (!wifi) return;
    setError("");
    if (wifi.password) {
      try {
        await navigator.clipboard.writeText(wifi.password);
        setCopied(wifi.password);
      } catch {
        setWifiNote("Could not copy the password. Select it below, then join the network in settings.");
        return;
      }
    }
    const named = `"${wifi.ssid}"`;
    if (/Android/i.test(navigator.userAgent)) {
      setWifiNote(wifi.password ? `Password copied. Choose ${named} in Wi-Fi settings and paste it.` : `Choose ${named} in Wi-Fi settings.`);
      window.location.href = "intent:#Intent;action=android.settings.WIFI_SETTINGS;end";
      return;
    }
    setWifiNote(
      wifi.password
        ? `Password copied. This browser can't join Wi-Fi. Connect to ${named} in your settings.`
        : `This browser can't join Wi-Fi. Connect to ${named} in your settings.`,
    );
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-xl rounded-panel border border-border bg-card p-5">
      <div className="flex flex-col gap-2">
        <Picker label="Take photo" capture onPick={onFile} />
        <Picker label="Choose picture" onPick={onFile} />
        <Button type="button" variant="secondary" onClick={() => void startCamera()}>
          <Camera className="size-4" aria-hidden />
          {scanning ? "Scanning…" : "Live camera"}
        </Button>
      </div>

      {stream ? (
        <video ref={videoRef} className="mt-4 aspect-square w-full rounded-preview bg-background object-cover" muted autoPlay playsInline />
      ) : null}

      <p className="mt-4 min-h-6 break-all text-sm text-pretty" role="status">
        {error ? <span className="text-danger">{error}</span> : wifi ? <span className="text-foreground">Wi-Fi network found.</span> : result ? <span className="text-foreground">{result}</span> : <span className="text-muted">Point the camera at a code, or upload a picture.</span>}
      </p>

      {wifi ? (
        <div className="mt-3 grid gap-3">
          <dl className="grid gap-2 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Network</dt>
              <dd className="break-all text-right text-foreground">{wifi.ssid}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-muted">Security</dt>
              <dd>{wifi.security === "NOPASS" ? "None" : wifi.security}</dd>
            </div>
            {wifi.password ? (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-muted">Password</dt>
                <dd className="break-all text-right font-mono text-foreground">{wifi.password}</dd>
              </div>
            ) : null}
          </dl>
          {wifi.hidden ? <p className="text-sm text-muted">This network is hidden.</p> : null}
          <Button type="button" onClick={() => void connectWifi()}>
            Connect
          </Button>
          <p className="min-h-6 text-sm text-muted" role="status">
            {wifiNote}
          </p>
          <Button type="button" variant="secondary" onClick={() => onMakeQr(result)}>
            Open in QR tool
          </Button>
        </div>
      ) : null}

      {result && shown && !wifi ? (
        <div className="mt-3">
          <LinkActions
            href={shown}
            copied={copied === shown}
            shortening={busy}
            onCopy={() => void copy(shown)}
            onShorten={url ? () => void shorten(url) : undefined}
            onMakeQr={() => onMakeQr(shown)}
          />
        </div>
      ) : null}
      {result && !shown && !wifi ? (
        <div className="mt-3 flex flex-col gap-2">
          <Button type="button" variant="secondary" onClick={() => void copy(result)}>
            {copied === result ? "Copied" : "Copy text"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => onMakeQr(result)}>
            Open in QR tool
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Picker({
  label,
  capture,
  onPick,
}: {
  label: string;
  capture?: boolean;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <div className="relative min-h-11">
      <div
        className={
          capture
            ? "pointer-events-none inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-medium text-accent-foreground"
            : "pointer-events-none inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border bg-raised px-4 text-sm font-medium text-foreground"
        }
      >
        <ImagePlus className="size-4" aria-hidden />
        {label}
      </div>
      <input
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        type="file"
        accept="image/*"
        capture={capture ? "environment" : undefined}
        aria-label={label}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onPick(file);
        }}
      />
    </div>
  );
}
