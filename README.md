# Variant Sprint — Aster One

A desktop-first Next.js prototype for an agency art director who is turning one approved product hero shot into six paid-social variants (3 creative directions × 1:1 and 4:5 placements).

- **Campaign Setup:** the approved hero, references, colorway, and claim. Locked and flexible rules are confirmed here before anything is generated, alongside the deliverables matrix.
- **Concept Review:** three concepts, each compared with the reference (side by side, a wipe against the previous version, or 2× zoom). City v1 has a pinned "wrong product detail" issue. The art director fixes it, verifies the fix, resolves it, and the version history records every step.
- **Approval Board:** each asset shows its lineage. You can toggle safe-zone and claim previews. Approval is per asset, and a change request blocks the whole set. There is a client sign-off view and an export manifest (table or JSON).

All content is fictional and seeded (`public/seed/`). **The whole demo works without a Luma API key.** Adding a key enables one live action: an `image_edit` through the Luma Agents API.

---

## Part 1 — Get a Luma API key

1. Sign in to Luma's developer platform and create an API key for the **Agents API**. Docs: https://docs.agents.lumalabs.ai/
2. Add billing or credits in your Luma account if you need to. **Every live edit is billed to that account.**
3. Copy the key. Keep it out of the code, git, and the browser.

## Part 2 — Deploy on Vercel

### Option A: from GitHub (recommended)

1. Push this folder to a new **private** GitHub repository:
   ```bash
   cd variant-sprint
   git remote add origin https://github.com/<you>/variant-sprint.git
   git push -u origin master   # or main
   ```
2. In Vercel, click **Add New → Project** and import the repo. Vercel detects the framework as **Next.js**. Keep the default build command (`next build`) and output settings.
3. Under **Settings → Environment Variables**, add:

   | Name | Value | Required |
   |---|---|---|
   | `LUMA_AGENTS_API_KEY` | your Luma key | Yes, for live edits |
   | `LUMA_MODEL` | `uni-1` (default) or `uni-1-max` | No |
   | `PUBLIC_ASSET_BASE_URL` | your deployment URL, e.g. `https://variant-sprint.vercel.app` | No. If set, references are sent as URLs instead of inline base64 |
   | `ALLOWED_ORIGINS` | comma-separated extra origins, e.g. a custom domain | No |
   | `LUMA_RATE_PER_IP` | live submissions per IP per 10 min (default `5`) | No |
   | `LUMA_DAILY_CAP` | live submissions per day across all users (default `40`) | No |

   **Do not set `STATIC_EXPORT`.** It is only for the static preview build in `scripts/build-preview.sh`, and it turns off the API routes.
4. Click **Deploy**. If you add or change variables after the first deploy, you need to **redeploy**.

### Option B: Vercel CLI

```bash
npm i -g vercel
cd variant-sprint
vercel link
vercel env add LUMA_AGENTS_API_KEY production
vercel --prod
```

## Part 3 — Verify the Luma connection

1. Open `https://<your-app>.vercel.app/api/luma/status`. It should return `{"configured": true, "model": "uni-1", ...}`.
2. In the app, confirm the locked rules, then go to **Concept Review**. On a concept, either:
   - click **Fix product detail**, then run it live, or
   - click **Change background only (live)**.
3. The job card moves through **submit → queued → processing → completed**. A completed result is added as a new version marked "Luma". Image generations usually take tens of seconds.
4. If it fails, the card shows the error code:
   - `not_configured`: the key is missing, so check the env var and redeploy.
   - `luma_error` with status 401: the key is invalid.
   - `rate_limited`: you hit the per-IP or daily cap.
   - `forbidden_origin`: add your domain to `ALLOWED_ORIGINS`.

   The **Use pre-generated revision** fallback keeps the demo moving whatever the error.

---

## How the integration works

```
Browser ──POST /api/luma/generations──▶ Next.js route (server) ──POST https://agents.lumalabs.ai/v1/generations──▶ Luma
Browser ──GET  /api/luma/generations/{id}──▶ Next.js route ──GET /v1/generations/{id}──▶ Luma (poll until completed/failed)
```

- The request body is `{ model: "uni-1", type: "image_edit", prompt, source, image_ref: [product detail ref, hero] }`. The prompt is built from the art director's issue comment and the locked rules (`lib/prompt.ts`).
- The browser can only reference **allow-listed seed assets** or a prior generation ID. It can never send arbitrary files or URLs.
- The key is read only in `lib/luma-server.ts`, a `server-only` module, and never reaches the browser.
- Edits inherit the source image's dimensions. The 4:5 portraits are separate assets, not edits of the squares. See https://docs.agents.lumalabs.ai/guides/images/editing/
- Luma output URLs are presigned and expire. A production version should copy approved files into agency storage.

## Security hardening

- **Origin allow-list:** browser calls from any origin outside the pplx.app/Vercel/localhost origins or `ALLOWED_ORIGINS` get `403`.
- **Rate limits:** per IP and per day, set by `LUMA_RATE_PER_IP` and `LUMA_DAILY_CAP`. They are in-memory, which is good enough for a prototype. A production version would use a shared store such as Vercel KV or Upstash.
- **Patched PostCSS** via npm `overrides`. `npm audit` reports 0 vulnerabilities.
- There are no user accounts. If you share the link widely, keep the daily cap low, or add Vercel password protection (Project → Settings → Deployment Protection).

## Run locally

```bash
npm install
LUMA_AGENTS_API_KEY=... npm run dev   # key optional
# open http://localhost:3000
```

## Project map

| Path | Purpose |
|---|---|
| `app/page.tsx`, `components/Shell.tsx` | App shell, navigation, live-job runner |
| `components/Setup.tsx` / `Review.tsx` / `Board.tsx` | The three screens |
| `lib/seed.ts`, `lib/store.tsx` | Seeded campaign data and review state |
| `lib/luma-server.ts` | Server-only Luma client, origin checks, rate limits |
| `app/api/luma/*` | `status`, `generations` (POST), `generations/[id]` (GET) |
| `scripts/build-preview.sh` | Static preview build for Perplexity hosting (not needed on Vercel) |
