import { json, lumaFetch, lumaKey, preflight, withCors } from "@/lib/luma-server";

export const dynamic = "force-dynamic";

// Poll proxy for GET /v1/generations/{generation_id}.
async function get(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "invalid_id", detail: "Bad generation id." }, 400);
  if (!lumaKey()) return json({ error: "not_configured", detail: "LUMA_AGENTS_API_KEY is not set." }, 503);
  try {
    const res = await lumaFetch(`/generations/${id}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return json({ error: "luma_error", status: res.status, detail: data?.detail || res.statusText }, 502);
    return json({
      id: data.id,
      state: data.state,
      model: data.model,
      failure_code: data.failure_code ?? null,
      failure_reason: data.failure_reason ?? null,
      output: (data.output || []).map((o: { type: string; url: string }) => ({ type: o.type, url: o.url })),
    });
  } catch (e) {
    return json({ error: "network_error", detail: e instanceof Error ? e.message : "Could not reach Luma." }, 502);
  }
}

export const GET = withCors(get);
export const OPTIONS = preflight;
