import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
export { buildEditPrompt } from "./prompt";

// Server-only helpers for the Luma Agents API (https://docs.agents.lumalabs.ai/).
// The API key is read from the server environment and never sent to the browser.

export const LUMA_BASE = process.env.LUMA_AGENTS_BASE_URL || "https://agents.lumalabs.ai/v1";
export const LUMA_MODEL = process.env.LUMA_MODEL || "uni-1";

export function lumaKey(): string | undefined {
  return process.env.LUMA_AGENTS_API_KEY || process.env.LUMA_API_KEY || undefined;
}

// Allow-list: the browser can only reference seeded asset names, never arbitrary paths.
const SEED_ASSETS: Record<string, string> = {
  "hero": "hero.jpg",
  "ref-sidepanel": "ref-sidepanel.jpg",
  "studio-square": "studio-square.jpg",
  "city-square-v1": "city-square-v1.jpg",
  "city-square-v2": "city-square-v2.jpg",
  "outdoor-square": "outdoor-square.jpg",
};

export function isSeedAsset(name: string) {
  return Object.prototype.hasOwnProperty.call(SEED_ASSETS, name);
}

export type ImageRef =
  | { url: string }
  | { data: string; media_type: string }
  | { generation_id: string };

// Prefer a public URL when the deployment exposes one (smaller requests);
// otherwise inline base64, which Luma accepts for small media.
export async function seedImageRef(name: string): Promise<ImageRef> {
  const file = SEED_ASSETS[name];
  const publicBase = process.env.PUBLIC_ASSET_BASE_URL;
  if (publicBase) return { url: `${publicBase.replace(/\/$/, "")}/seed/${file}` };
  const bytes = await readFile(path.join(process.cwd(), "public", "seed", file));
  return { data: bytes.toString("base64"), media_type: "image/jpeg" };
}

export async function lumaFetch(pathname: string, init?: RequestInit) {
  const key = lumaKey();
  if (!key) throw new Error("not_configured");
  return fetch(`${LUMA_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

// ---- Hardening: origin allow-list + rate limiting -------------------------------
// Only the app's own origins may call these routes from a browser. Requests without an
// Origin header (same-origin GETs, server tools) are allowed but still rate limited.
const DEFAULT_ORIGINS = [
  "https://lumaprototype.pplx.app",
  "https://sites.pplx.app", // Perplexity preview host
  "https://www.perplexity.ai",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function allowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const vercel = process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : [];
  return [...DEFAULT_ORIGINS, ...extra, ...vercel];
}

export function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  // Sandboxed preview iframes send the opaque origin "null".
  if (origin === "null") return true;
  return allowedOrigins().includes(origin);
}

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin && originAllowed(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

type Handler<C> = (req: Request, ctx: C) => Response | Promise<Response>;

export function withCors<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    const origin = req.headers.get("origin");
    if (!originAllowed(origin)) {
      return Response.json({ error: "forbidden_origin", detail: "This origin may not call the Luma proxy." }, { status: 403, headers: { Vary: "Origin" } });
    }
    const res = await handler(req, ctx);
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(corsHeaders(origin))) out.headers.set(k, v);
    return out;
  };
}

export const preflight = withCors(() => new Response(null, { status: 204 }));

// In-memory sliding-window limits (per instance; fine for a prototype).
const PER_IP_LIMIT = Number(process.env.LUMA_RATE_PER_IP || 5); // submissions per window per IP
const PER_IP_WINDOW_MS = 10 * 60 * 1000;
const GLOBAL_DAILY_LIMIT = Number(process.env.LUMA_DAILY_CAP || 40); // submissions per day, all users
const hits = new Map<string, number[]>();
let daily: { day: string; count: number } = { day: "", count: 0 };

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip")) || "unknown";
}

export function rateLimit(req: Request): { ok: true } | { ok: false; retryAfter: number; scope: "ip" | "daily" } {
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  if (daily.day !== today) daily = { day: today, count: 0 };
  if (daily.count >= GLOBAL_DAILY_LIMIT) return { ok: false, retryAfter: 3600, scope: "daily" };
  const ip = clientIp(req);
  const recent = (hits.get(ip) || []).filter((t) => now - t < PER_IP_WINDOW_MS);
  if (recent.length >= PER_IP_LIMIT) {
    return { ok: false, retryAfter: Math.ceil((PER_IP_WINDOW_MS - (now - recent[0])) / 1000), scope: "ip" };
  }
  recent.push(now);
  hits.set(ip, recent);
  daily.count += 1;
  if (hits.size > 5000) hits.clear();
  return { ok: true };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
}
