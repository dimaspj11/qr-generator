type QrDetector = {
  detect: (source: CanvasImageSource) => Promise<{ rawValue?: string }[]>;
};

let detector: QrDetector | null | undefined;
let jsQrPromise: Promise<(data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: "attemptBoth" }) => { data: string } | null> | null = null;

function getDetector() {
  if (detector !== undefined) return detector;
  const ctor = (
    window as unknown as {
      BarcodeDetector?: new (options: { formats: string[] }) => QrDetector;
    }
  ).BarcodeDetector;
  if (!ctor) {
    detector = null;
    return detector;
  }
  try {
    detector = new ctor({ formats: ["qr_code"] });
  } catch {
    detector = null;
  }
  return detector;
}

function loadJsQr() {
  jsQrPromise ??= import("jsqr").then((mod) => mod.default);
  return jsQrPromise;
}

async function readWithJsQr(data: ImageData) {
  const jsQR = await loadJsQr();
  const result = jsQR(new Uint8ClampedArray(data.data), data.width, data.height, {
    inversionAttempts: "attemptBoth",
  });
  return result?.data ?? null;
}

export async function readQrFromImageData(data: ImageData): Promise<string | null> {
  return readWithJsQr(data);
}

export async function readQrFromSource(source: CanvasImageSource, width: number, height: number): Promise<string | null> {
  const found = getDetector();
  if (found) {
    try {
      const codes = await found.detect(source);
      const value = codes.find((code) => code.rawValue)?.rawValue;
      if (value) return value;
    } catch {
      // Fall through to the pixel reader.
    }
  }
  for (const max of [1600, 1000, 640]) {
    const text = await readWithJsQr(imageDataFromSource(source, width, height, max));
    if (text) return text;
  }
  return null;
}

export async function readQrFromFile(file: Blob): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      return await readQrFromSource(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close();
    }
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return await readQrFromSource(image, image.naturalWidth, image.naturalHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function imageDataFromSource(source: CanvasImageSource, width: number, height: number, max = 1280): ImageData {
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
