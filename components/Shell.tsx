"use client";

import { createContext, useContext, useEffect, useRef, useState, type Dispatch } from "react";
import { Moon, RotateCcw, Sun, ChevronRight, Check } from "lucide-react";
import { StoreProvider, useStore, openIssuesFor, type LiveJob, type LiveMode } from "@/lib/store";
import { CAMPAIGN, PEOPLE } from "@/lib/seed";
import { api } from "@/lib/api";
import Setup from "./Setup";
import Review from "./Review";
import Board from "./Board";

/* ---------- Logo ---------- */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-label="Variant Sprint">
      <rect x="2.5" y="2.5" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="9.5" y="9.5" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
      <path d="M9.5 12.5 12 15l4.5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Luma status + toast contexts ---------- */
interface LumaStatus { checked: boolean; configured: boolean; model: string; reachable: boolean }
const LumaCtx = createContext<LumaStatus>({ checked: false, configured: false, model: "uni-1", reachable: false });
export const useLumaStatus = () => useContext(LumaCtx);

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

/* ---------- Live job: submit + poll ---------- */
type AnyDispatch = Dispatch<Parameters<ReturnType<typeof useStore>["dispatch"]>[0]>;

export interface LiveRequest {
  conceptId: string;
  mode: LiveMode;
  sourceAsset?: string;
  sourceGenerationId?: string;
  comment?: string;
  background?: string;
  preserve: string[];
}

export async function startLive(dispatch: AnyDispatch, req: LiveRequest) {
  const job: LiveJob = { conceptId: req.conceptId, mode: req.mode, state: "submitting", startedAt: Date.now() };
  dispatch({ type: "liveJob", job });
  dispatch({ type: "log", event: { actor: PEOPLE.ad.name, text: `Sent ${req.mode === "fix_detail" ? "product-detail fix" : "background-only change"} to Luma (image_edit)`, kind: "live", conceptId: req.conceptId } });
  const { ok, status, data } = await api<{ id?: string; state?: string; model?: string; prompt?: string; error?: string; detail?: string; status?: number }>(
    "/api/luma/generations",
    { method: "POST", body: JSON.stringify(req) },
  );
  if (!ok || !data.id) {
    dispatch({
      type: "liveJobPatch",
      patch: {
        state: "failed",
        failureCode: data.error || (status === 0 ? "network_error" : `http_${status}`),
        failureReason: data.detail || "The request could not be submitted.",
      },
    });
    return;
  }
  dispatch({ type: "liveJobPatch", patch: { state: (data.state as LiveJob["state"]) || "queued", generationId: data.id, prompt: data.prompt, model: data.model } });
}

function LiveJobRunner() {
  const { state, dispatch } = useStore();
  const job = state.liveJob;
  const toast = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!job || !job.generationId || (job.state !== "queued" && job.state !== "processing")) return;
    const elapsed = Date.now() - job.startedAt;
    const delay = elapsed < 8000 ? 8000 - elapsed : 2500; // uni-1 p50 is ~30s; skip wasted early polls
    timer.current = setTimeout(async () => {
      if (Date.now() - job.startedAt > 150_000) {
        dispatch({ type: "liveJobPatch", patch: { state: "failed", failureCode: "timeout", failureReason: "No result after 150 seconds. The seeded revision is still available." } });
        return;
      }
      const { ok, data } = await api<{ state?: string; failure_code?: string; failure_reason?: string; output?: { url: string }[]; error?: string; detail?: string }>(
        `/api/luma/generations/${job.generationId}`,
      );
      if (!ok) {
        // transient poll error: try again on next tick by nudging state
        dispatch({ type: "liveJobPatch", patch: { state: "processing" } });
        return;
      }
      if (data.state === "completed" && data.output?.[0]?.url) {
        dispatch({ type: "liveJobPatch", patch: { state: "completed", outputUrl: data.output[0].url } });
        dispatch({
          type: "addVersion",
          conceptId: job.conceptId,
          version: {
            src: data.output[0].url,
            origin: "luma",
            generationId: job.generationId,
            note: job.mode === "fix_detail" ? "Live Luma image_edit · re-anchored to Ref 02" : "Live Luma image_edit · background only",
            author: `Luma ${job.model || "uni-1"}`,
          },
          historyText: "Luma returned v{n} (live image_edit)",
        });
        toast("Luma revision ready — verify it against the reference before resolving");
      } else if (data.state === "failed") {
        dispatch({ type: "liveJobPatch", patch: { state: "failed", failureCode: data.failure_code || "generation_failed", failureReason: data.failure_reason || "Generation failed." } });
      } else {
        // A new job object re-runs this effect and schedules the next poll.
        dispatch({ type: "liveJobPatch", patch: { state: (data.state as LiveJob["state"]) || "processing" } });
      }
    }, delay);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [job, dispatch, toast]);

  return null;
}

/* ---------- Layout ---------- */
function Frame() {
  const { state, dispatch } = useStore();
  const [luma, setLuma] = useState<LumaStatus>({ checked: false, configured: false, model: "uni-1", reachable: false });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    api<{ configured?: boolean; model?: string }>("/api/luma/status").then(({ ok, data }) =>
      setLuma({ checked: true, reachable: ok, configured: Boolean(data.configured), model: data.model || "uni-1" }),
    );
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme;
  }, [state.theme]);

  const toast = (m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const lockedPending = state.constraints.filter((c) => c.kind === "locked" && !c.confirmed).length;
  const openIssues = state.issues.filter((i) => i.status === "open").length;
  const accepted = state.concepts.filter((c) => c.status === "accepted").length;
  const approved = state.assets.filter((a) => a.status === "approved").length;
  const isClient = state.role === "client";

  const steps = [
    {
      id: "setup" as const,
      n: 1,
      title: "Campaign setup",
      sub: state.setupConfirmed ? "Contract approved" : lockedPending ? `${lockedPending} locked rules to confirm` : "Ready to explore",
      done: state.setupConfirmed,
      disabled: isClient,
    },
    {
      id: "review" as const,
      n: 2,
      title: "Concept review",
      sub: !state.setupConfirmed ? "Waiting on setup" : openIssues ? `${openIssues} open issue${openIssues > 1 ? "s" : ""} · ${accepted}/3 accepted` : `${accepted}/3 directions accepted`,
      done: state.variantsBuilt,
      disabled: !state.setupConfirmed || isClient,
    },
    {
      id: "board" as const,
      n: 3,
      title: "Approval board",
      sub: state.variantsBuilt ? `${approved}/6 approved` : "Waiting on 3 accepted directions",
      done: approved === 6 && state.assets.length === 6,
      disabled: !state.variantsBuilt,
    },
  ];

  const lumaLabel = !luma.checked ? "Checking Luma API…" : !luma.reachable ? "Luma API: server offline" : luma.configured ? `Luma API · ${luma.model} connected` : "Luma API · key not set";
  const lumaChip = !luma.checked ? "chip" : luma.configured && luma.reachable ? "chip chip-ok" : "chip chip-warn";

  return (
    <LumaCtx.Provider value={luma}>
      <ToastCtx.Provider value={toast}>
        <LiveJobRunner />
        <div className="shell">
          <header className="topbar">
            <div className="brand">
              <Logo />
              <span>Variant Sprint</span>
            </div>
            <nav className="crumbs" aria-label="Breadcrumb">
              <span>{CAMPAIGN.agency}</span>
              <ChevronRight size={14} />
              <span>{CAMPAIGN.client}</span>
              <ChevronRight size={14} />
              <b>{CAMPAIGN.name}</b>
            </nav>
            <div className="spacer" />
            <span className={lumaChip} data-testid="status-luma" title="Live generation runs server-side through the Luma Agents API">
              <span className="dot" /> {lumaLabel}
            </span>
            <div className="seg" role="group" aria-label="Viewing as">
              <button aria-pressed={state.role === "ad"} onClick={() => dispatch({ type: "role", role: "ad" })} data-testid="button-role-ad">
                Art director
              </button>
              <button
                aria-pressed={state.role === "client"}
                onClick={() => (state.variantsBuilt ? dispatch({ type: "role", role: "client" }) : toast("Client review opens once the six variants exist"))}
                data-testid="button-role-client"
              >
                Client reviewer
              </button>
            </div>
            <button className="btn btn-ghost icon-btn" aria-label="Toggle theme" onClick={() => dispatch({ type: "theme" })} data-testid="button-theme">
              {state.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "reset" })} data-testid="button-reset">
              <RotateCcw size={14} /> Reset demo
            </button>
          </header>

          <aside className="sidebar">
            <div>
              <div className="eyebrow" style={{ padding: "0 10px 8px" }}>Variant sprint</div>
              <div className="steps">
                {steps.map((s) => (
                  <button
                    key={s.id}
                    className="step"
                    aria-current={state.screen === s.id ? "page" : undefined}
                    disabled={s.disabled}
                    onClick={() => dispatch({ type: "nav", screen: s.id })}
                    data-testid={`link-step-${s.id}`}
                  >
                    <span className={`step-num ${s.done ? "done" : ""}`}>{s.done ? <Check size={13} /> : s.n}</span>
                    <span>
                      <div className="step-title">{s.title}</div>
                      <div className="step-sub">{s.sub}</div>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="side-card">
              <div className="eyebrow">Deliverable</div>
              <div className="kv"><span>Assets</span><span>6 static · paid social</span></div>
              <div className="kv"><span>Placements</span><span>1:1 and 4:5</span></div>
              <div className="kv"><span>Due</span><span>{CAMPAIGN.due}</span></div>
              <div className="kv"><span>Viewing as</span><span>{isClient ? PEOPLE.client.name : PEOPLE.ad.name}</span></div>
            </div>

            <div className="side-card">
              <div className="eyebrow">Concept status</div>
              {state.concepts.map((c) => {
                const n = openIssuesFor(state, c.id).length;
                return (
                  <div className="kv" key={c.id}>
                    <span>{c.name}</span>
                    <span style={{ color: c.status === "accepted" ? "var(--ok)" : n ? "var(--issue)" : "var(--text-muted)" }}>
                      {!state.conceptsReady ? "—" : c.status === "accepted" ? "Accepted" : n ? `${n} issue` : "In review"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="spacer" />
            <p className="faint" style={{ fontSize: 11.5, margin: "0 6px", lineHeight: 1.5 }}>
              Prototype. Fictional brand and people. Seeded images are pre-generated; one live action calls the Luma Agents API from the server.
            </p>
          </aside>

          <main className="main">
            {state.screen === "setup" && <Setup />}
            {state.screen === "review" && <Review />}
            {state.screen === "board" && <Board />}
          </main>
        </div>
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </ToastCtx.Provider>
    </LumaCtx.Provider>
  );
}

export default function Shell() {
  return (
    <StoreProvider>
      <Frame />
    </StoreProvider>
  );
}
