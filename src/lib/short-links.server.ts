const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";
const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
const RECENT_KEY = "__recent";
const STORE = "short-links";

export type ShortLink = {
  code: string;
  url: string;
  createdAt: string;
};

type Backend = "sql" | "blobs" | "memory";

const memoryLinks = new Map<string, ShortLink>();

function randomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function normalizeTarget(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;
  return url.toString();
}

function normalizeCode(input: string | undefined): string | null {
  if (!input || !input.trim()) return null;
  const code = input.trim().toLowerCase();
  if (!CODE_PATTERN.test(code)) return null;
  return code;
}

function backend(): Backend {
  if (process.env.DATABASE_URL?.trim()) return "sql";
  if (process.env.NETLIFY === "true") return "blobs";
  if (import.meta.env.DEV) return "sql";
  return "memory";
}

function isConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /23505|unique|duplicate/i.test(message);
}

async function createInSql(url: string, requested: string | null): Promise<ShortLink> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const attempts = requested ? [requested] : Array.from({ length: 5 }, () => randomCode());
  for (const code of attempts) {
    try {
      const rows = await sql<{ code: string; url: string; created_at: string | Date }>`
        insert into short_links (code, url)
        values (${code}, ${url})
        returning code, url, created_at
      `;
      const row = rows[0];
      if (!row) throw new Error("Could not save that link.");
      return {
        code: row.code,
        url: row.url,
        createdAt: new Date(row.created_at).toISOString(),
      };
    } catch (error) {
      if (!isConflict(error)) throw error;
      if (requested) throw new Error("That ending is already used.");
    }
  }
  throw new Error("Could not save that link. Try again.");
}

async function createInMemory(url: string, requested: string | null): Promise<ShortLink> {
  if (requested && memoryLinks.has(requested)) throw new Error("That ending is already used.");
  let code = requested ?? randomCode();
  if (!requested) {
    for (let attempt = 0; attempt < 5 && memoryLinks.has(code); attempt += 1) code = randomCode();
    if (memoryLinks.has(code)) throw new Error("Could not save that link. Try again.");
  }
  const link = { code, url, createdAt: new Date().toISOString() };
  memoryLinks.set(code, link);
  return link;
}

async function createInBlobs(url: string, requested: string | null): Promise<ShortLink> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  const attempts = requested ? [requested] : Array.from({ length: 5 }, () => randomCode());
  for (const code of attempts) {
    const existing = await store.get(code, { type: "text" });
    if (existing) {
      if (requested) throw new Error("That ending is already used.");
      continue;
    }
    const createdAt = new Date().toISOString();
    await store.setJSON(code, { url, createdAt });
    const recent = await store.get(RECENT_KEY, { type: "json" });
    const codes = Array.isArray(recent) ? recent.filter((item) => typeof item === "string") : [];
    await store.setJSON(RECENT_KEY, [code, ...codes.filter((item) => item !== code)].slice(0, 12));
    return { code, url, createdAt };
  }
  throw new Error("Could not save that link. Try again.");
}

async function listFromSql(): Promise<ShortLink[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ code: string; url: string; created_at: string | Date }>`
    select code, url, created_at
    from short_links
    order by created_at desc
    limit 8
  `;
  return rows.map((row) => ({
    code: row.code,
    url: row.url,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

async function listFromMemory(): Promise<ShortLink[]> {
  return [...memoryLinks.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 8);
}

async function listFromBlobs(): Promise<ShortLink[]> {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore(STORE);
  const recent = await store.get(RECENT_KEY, { type: "json" });
  const codes = Array.isArray(recent) ? recent.filter((item) => typeof item === "string") : [];
  const links: ShortLink[] = [];
  for (const code of codes.slice(0, 8)) {
    const row = await store.get(code, { type: "json" });
    if (!row || typeof row !== "object") continue;
    const url = "url" in row && typeof row.url === "string" ? row.url : "";
    const createdAt = "createdAt" in row && typeof row.createdAt === "string" ? row.createdAt : "";
    if (!url) continue;
    links.push({ code, url, createdAt });
  }
  return links;
}

export async function createShortLinkRecord(rawUrl: string, rawCode?: string): Promise<ShortLink> {
  const url = normalizeTarget(rawUrl);
  if (!url) throw new Error("Enter a valid http or https link.");
  const requested = rawCode?.trim() ? normalizeCode(rawCode) : null;
  if (rawCode?.trim() && !requested) {
    throw new Error("Use 3–32 letters, numbers, or hyphens.");
  }
  const kind = backend();
  if (kind === "blobs") return createInBlobs(url, requested);
  if (kind === "sql") return createInSql(url, requested);
  return createInMemory(url, requested);
}

export async function listShortLinkRecords(): Promise<ShortLink[]> {
  const kind = backend();
  if (kind === "blobs") return listFromBlobs();
  if (kind === "sql") return listFromSql();
  return listFromMemory();
}

export async function resolveShortLink(code: string): Promise<string | null> {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  const kind = backend();
  if (kind === "blobs") {
    const { getStore } = await import("@netlify/blobs");
    const row = await getStore(STORE).get(normalized, { type: "json" });
    if (!row || typeof row !== "object" || !("url" in row) || typeof row.url !== "string") return null;
    return row.url;
  }
  if (kind === "memory") return memoryLinks.get(normalized)?.url ?? null;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ url: string }>`select url from short_links where code = ${normalized} limit 1`;
  return rows[0]?.url ?? null;
}
