export async function readQrFromImageData(data: ImageData): Promise<string | null> {
  const { default: jsQR } = await import("jsqr");
  const result = jsQR(new Uint8ClampedArray(data.data), data.width, data.height, {
    inversionAttempts: "attemptBoth",
  });
  return result?.data ?? null;
}

export function imageDataFromSource(source: CanvasImageSource, width: number, height: number): ImageData {
  const max = 1280;
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not read that image.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
