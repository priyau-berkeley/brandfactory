import { json, lumaKey, LUMA_MODEL, preflight, withCors } from "@/lib/luma-server";

export const dynamic = "force-dynamic";

async function get() {
  return json({ configured: Boolean(lumaKey()), model: LUMA_MODEL, api: "Luma Agents API · POST /v1/generations" });
}

export const GET = withCors(get);
export const OPTIONS = preflight;
