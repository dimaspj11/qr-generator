import { createServerFn } from "@tanstack/react-start";

export type ShortLink = {
  code: string;
  url: string;
  createdAt: string;
};

function readPayload(data: unknown): { url: string; code: string } {
  if (!data || typeof data !== "object") throw new Error("Enter a valid http or https link.");
  const url = "url" in data && typeof data.url === "string" ? data.url : "";
  const code = "code" in data && typeof data.code === "string" ? data.code : "";
  return { url, code };
}

export const createShortLink = createServerFn({ method: "POST" })
  .validator(readPayload)
  .handler(async ({ data }) => {
    const { createShortLinkRecord } = await import("./short-links.server");
    return createShortLinkRecord(data.url, data.code);
  });

export const listShortLinks = createServerFn({ method: "GET" }).handler(async () => {
  const { listShortLinkRecords } = await import("./short-links.server");
  return listShortLinkRecords();
});
