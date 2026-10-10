import { createServerFn } from "@tanstack/react-start";

const RATIOS = ["1:1", "3:4", "16:9"] as const;

type Ratio = (typeof RATIOS)[number];

export type ImagineResult =
  | { ok: true; src: string }
  | { ok: false; error: string };

function readRequest(data: unknown): { prompt: string; ratio: Ratio } {
  if (!data || typeof data !== "object") throw new Error("Describe the picture.");
  const prompt = "prompt" in data && typeof data.prompt === "string" ? data.prompt.trim() : "";
  const ratio = "ratio" in data && typeof data.ratio === "string" ? data.ratio : "1:1";
  if (prompt.length < 2) throw new Error("Describe the picture.");
  if (prompt.length > 1000) throw new Error("Keep the description under 1,000 characters.");
  if (!RATIOS.includes(ratio as Ratio)) throw new Error("Choose a shape.");
  return { prompt, ratio: ratio as Ratio };
}

export const generateImage = createServerFn({ method: "POST" })
  .validator(readRequest)
  .handler(async ({ data }): Promise<ImagineResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false, error: "AI image generation is not available right now." };

    const response = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image-2.0",
        prompt: data.prompt,
        n: 1,
        aspect_ratio: data.ratio,
        resolution: "1k",
        response_format: "b64_json",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return { ok: false, error: "Too many images. Wait a moment and try again." };
      if (response.status === 400 || response.status === 403) {
        return { ok: false, error: "That description was rejected. Try a different one." };
      }
      return { ok: false, error: "Could not create the image. Try again." };
    }

    const body = (await response.json()) as { data?: { b64_json?: string; url?: string }[] };
    const image = body.data?.[0];
    if (image?.b64_json) return { ok: true, src: `data:image/jpeg;base64,${image.b64_json}` };
    if (image?.url) return { ok: true, src: image.url };
    return { ok: false, error: "The image came back empty. Try again." };
  });
