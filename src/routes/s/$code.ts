import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/s/$code")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { resolveShortLink } = await import("@/lib/short-links.server");
        const target = await resolveShortLink(params.code);
        if (!target) {
          return new Response(
            `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Link not found</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#05060b;color:#f4f7fb;font-family:system-ui,sans-serif"><main style="text-align:center;padding:2rem"><h1 style="font-size:1.5rem;font-weight:500">Link not found</h1><p style="color:#a7b0be">This short link does not exist.</p><a href="/" style="color:#2ec8ff">Back to QR Generator</a></main></body></html>`,
            { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
          );
        }
        return new Response(null, { status: 302, headers: { location: target } });
      },
    },
  },
});
