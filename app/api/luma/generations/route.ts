import {
  LUMA_MODEL,
  buildEditPrompt,
  isSeedAsset,
  json,
  lumaFetch,
  lumaKey,
  preflight,
  rateLimit,
  withCors,
  seedImageRef,
  type ImageRef,
} from "@/lib/luma-server";

export const dynamic = "force-dynamic";

interface Body {
  mode: "fix_detail" | "change_background";
  sourceAsset?: string; // seeded asset name
  sourceGenerationId?: string; // chain from a prior Luma generation
  comment?: string;
  background?: string;
  preserve?: string[];
}

const UUID = /^[0-9a-f-]{36}$/i;

// Submit an image_edit job to the Luma Agents API. Returns immediately with the generation id;
// the browser polls /api/luma/generations/[id] (which calls GET /v1/generations/{id}).
async function submit(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json", detail: "Request body must be JSON." }, 400);
  }

  if (body.mode !== "fix_detail" && body.mode !== "change_background") {
    return json({ error: "invalid_mode", detail: "mode must be fix_detail or change_background." }, 400);
  }
  if (!lumaKey()) {
    return json(
      {
        error: "not_configured",
        detail: "LUMA_AGENTS_API_KEY is not set on the server. The seeded demo path still works.",
      },
      503,
    );
  }

  // Only reached when a key is configured: cap spend before calling Luma.
  const rl = rateLimit(req);
  if (!rl.ok) {
    return json(
      {
        error: "rate_limited",
        detail: rl.scope === "daily" ? "Daily live-generation cap reached for this demo." : "Too many live generations from this client. Try again shortly.",
        retryAfter: rl.retryAfter,
      },
      429,
      { "Retry-After": String(rl.retryAfter) },
    );
  }

  let source: ImageRef;
  if (body.sourceGenerationId) {
    if (!UUID.test(body.sourceGenerationId)) return json({ error: "invalid_source" , detail: "Bad generation id."}, 400);
    source = { generation_id: body.sourceGenerationId };
  } else if (body.sourceAsset && isSeedAsset(body.sourceAsset)) {
    source = await seedImageRef(body.sourceAsset);
  } else {
    return json({ error: "invalid_source", detail: "Unknown source asset." }, 400);
  }

  const preserve = (body.preserve || []).slice(0, 8).map((s) => String(s).slice(0, 160));
  const prompt = buildEditPrompt(body.mode, {
    comment: body.comment?.slice(0, 500),
    background: body.background?.slice(0, 300),
    preserve,
  });

  // Re-anchor to the approved references, not only the flawed generated image.
  const image_ref: ImageRef[] =
    body.mode === "fix_detail"
      ? [await seedImageRef("ref-sidepanel"), await seedImageRef("hero")]
      : [await seedImageRef("hero"), await seedImageRef("ref-sidepanel")];

  const payload = { model: LUMA_MODEL, type: "image_edit", prompt, source, image_ref };

  try {
    const res = await lumaFetch("/generations", { method: "POST", body: JSON.stringify(payload) });
    const requestId = res.headers.get("x-request-id") || undefined;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return json(
        { error: "luma_error", status: res.status, detail: data?.detail || res.statusText, requestId },
        res.status === 429 ? 429 : 502,
      );
    }
    return json({ id: data.id, state: data.state, model: data.model, prompt, requestId }, 201);
  } catch (e) {
    return json({ error: "network_error", detail: e instanceof Error ? e.message : "Could not reach Luma." }, 502);
  }
}

export const POST = withCors(submit);
export const OPTIONS = preflight;
