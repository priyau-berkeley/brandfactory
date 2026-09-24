// Browser-side API client. Only talks to this app's own server routes; the Luma key stays server-side.
// NEXT_PUBLIC_API_BASE is empty on Vercel (same origin) and set to a proxy placeholder for the static preview.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: "network_error", detail: e instanceof Error ? e.message : "Network error" } as T };
  }
}
