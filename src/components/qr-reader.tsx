import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { LinkActions } from "@/components/link-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { imageDataFromSource, readQrFromImageData } from "@/lib/read-qr";
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
            const data = imageDataFromSource(video, video.videoWidth, video.videoHeight);
            const text = await readQrFromImageData(data);
            if (stopped || !text) return;
            setResult(text);
            setShortUrl("");
            setError("");
            setScanning(false);
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
          } catch {
            if (!stopped) setError("Could not read the camera image.");
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
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser has no camera. Upload a picture instead.");
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
      setError("Camera permission was blocked. Upload a picture instead.");
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setShortUrl("");
    try {
      const bitmap = await createImageBitmap(file);
      const data = imageDataFromSource(bitmap, bitmap.width, bitmap.height);
      bitmap.close();
      const text = await readQrFromImageData(data);
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
  const shown = shortUrl || url;

  return (
    <section className="mx-auto mt-6 w-full max-w-xl rounded-panel border border-border bg-card p-5">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="flex-1" onClick={() => void startCamera()}>
          <Camera className="size-4" aria-hidden />
          {scanning ? "Scanning…" : "Use camera"}
        </Button>
        <Label
          htmlFor="qr-picture"
          className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-control border border-border bg-raised px-4 text-sm font-medium text-foreground"
        >
          <ImagePlus className="size-4" aria-hidden />
          Upload picture
        </Label>
        <input
          id="qr-picture"
          className="sr-only"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
      </div>

      {stream ? (
        <video ref={videoRef} className="mt-4 aspect-square w-full rounded-preview bg-background object-cover" muted playsInline />
      ) : null}

      <p className="mt-4 min-h-6 break-all text-sm text-pretty" role="status">
        {error ? <span className="text-danger">{error}</span> : result ? <span className="text-foreground">{result}</span> : <span className="text-muted">Point the camera at a code, or upload a picture.</span>}
      </p>

      {result && shown ? (
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
      {result && !shown ? (
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
