"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Check, CircleAlert, Columns2, History, Layers, LoaderCircle, MapPin, RotateCcw,
  Square, WandSparkles, X, ZoomIn, ZoomOut, Sparkles, Lock, ImageIcon, CircleCheck,
} from "lucide-react";
import { useStore, openIssuesFor, activeVersion, type LiveMode } from "@/lib/store";
import { ISSUE_CATEGORIES, PEOPLE, REFERENCES, type Concept, type Issue, type Version } from "@/lib/seed";
import { buildEditPrompt } from "@/lib/prompt";
import { startLive, useLumaStatus, useToast } from "./Shell";

type CompareMode = "side" | "wipe" | "single";

function useTick(active: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}

const assetNameFromSrc = (src: string) => src.replace(/^seed\//, "").replace(/\.jpg$/, "");

export default function Review() {
  const { state, dispatch } = useStore();
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    if (state.conceptsReady) return;
    const t = setTimeout(() => dispatch({ type: "conceptsReady" }), 1400);
    return () => clearTimeout(t);
  }, [state.conceptsReady, dispatch]);

  const concept = state.concepts.find((c) => c.id === state.selectedConceptId)!;
  const accepted = state.concepts.filter((c) => c.status === "accepted").length;

  const build = () => {
    setBuilding(true);
    setTimeout(() => dispatch({ type: "buildVariants" }), 1600);
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <div className="eyebrow">Step 2 · Concept review</div>
        <h1 className="h1" style={{ marginTop: 4 }}>Approve one direction at a time, then fill the six slots</h1>
        <p className="muted" style={{ margin: "6px 0 0", maxWidth: 760 }}>
          Each concept is compared against the approved hero. Pin anything that drifts; fix the concept without discarding what already works.
        </p>
      </div>

      {!state.conceptsReady ? (
        <>
          <div className="concept-strip">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 94, borderRadius: 14 }} />)}
          </div>
          <div className="review-grid">
            <div className="skeleton" style={{ height: 560, borderRadius: 14 }} />
            <div className="skeleton" style={{ height: 420, borderRadius: 14 }} />
          </div>
          <p className="muted row" style={{ marginTop: 14 }}><LoaderCircle size={15} className="spin" /> Generating one concept per direction from the brief and Ref 01…</p>
        </>
      ) : (
        <>
          <div className="concept-strip">
            {state.concepts.map((c) => {
              const v = activeVersion(c);
              const open = openIssuesFor(state, c.id).length;
              return (
                <button key={c.id} className="concept-card" aria-pressed={c.id === concept.id} onClick={() => dispatch({ type: "selectConcept", id: c.id })} data-testid={`card-concept-${c.id}`}>
                  <img src={v.src} alt="" />
                  <div className="col" style={{ gap: 4, minWidth: 0 }}>
                    <div className="row" style={{ justifyContent: "space-between" }}>
                      <span className="h3">{c.name}</span>
                      <span className="mono faint">v{v.n}</span>
                    </div>
                    <span className="faint" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.territory}</span>
                    <span>
                      {c.status === "accepted" ? (
                        <span className="chip chip-ok"><Check size={12} /> Accepted</span>
                      ) : open ? (
                        <span className="chip chip-issue"><span className="dot" /> {open} open issue{open > 1 ? "s" : ""}</span>
                      ) : (
                        <span className="chip">Ready for review</span>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <ConceptWorkspace key={concept.id} concept={concept} />

          <div className="cta-bar">
            <div className="progress" aria-hidden><i style={{ width: `${(accepted / 3) * 100}%` }} /></div>
            <span className="muted" style={{ fontSize: 13 }}>
              {building
                ? "Adapting accepted directions into square and portrait placements…"
                : accepted === 3
                  ? "All three directions accepted. Variants will inherit each accepted version."
                  : `${accepted} of 3 directions accepted. Variants stay locked until every direction is approved.`}
            </span>
            <div className="spacer" />
            {state.variantsBuilt ? (
              <button className="btn btn-primary btn-lg" onClick={() => dispatch({ type: "nav", screen: "board" })} data-testid="button-go-board">
                Open approval board <ArrowRight size={16} />
              </button>
            ) : (
              <button className="btn btn-primary btn-lg" disabled={accepted < 3 || building} onClick={build} data-testid="button-build-variants">
                {building ? <LoaderCircle size={16} className="spin" /> : <Layers size={16} />} Build six placement variants
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */

function ConceptWorkspace({ concept }: { concept: Concept }) {
  const { state, dispatch } = useStore();
  const [mode, setMode] = useState<CompareMode>("side");
  const [refId, setRefId] = useState<string>("ref-01");
  const [pinning, setPinning] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);
  const [activeIssue, setActiveIssue] = useState<string | null>(null);
  const [wipe, setWipe] = useState(50);
  const [tab, setTab] = useState<"issues" | "contract" | "history">("issues");
  const [composer, setComposer] = useState<{ mode: LiveMode; issueId?: string } | null>(null);

  const v = activeVersion(concept);
  const prev = concept.versions.length > 1 ? concept.versions[concept.versions.findIndex((x) => x.id === v.id) - 1] ?? concept.versions[0] : undefined;
  const issues = state.issues.filter((i) => i.conceptId === concept.id);
  const ref = REFERENCES.find((r) => r.id === refId)!;
  const hasNewer = (iss: Issue) => {
    const iv = concept.versions.find((x) => x.id === iss.versionId);
    return iv ? v.n > iv.n : false;
  };

  const onStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!pinning) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDraft({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
    setPinning(false);
    setTab("issues");
  };
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoom) return;
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  };

  const imgStyle = zoom ? { transformOrigin: `${origin.x}% ${origin.y}%` } : undefined;

  const currentPane = (
    <div
      className={`pane ${pinning ? "pinning" : ""} ${zoom ? "zoomed" : ""}`}
      onClick={onStageClick}
      onMouseMove={onMove}
      data-testid="pane-current"
    >
      <span className="pane-label">
        {concept.name} · v{v.n} {v.origin === "luma" && <span className="chip chip-accent" style={{ height: 18 }}><Sparkles size={11} /> Luma</span>}
      </span>
      <img className="pane-img" src={v.src} alt={`${concept.name} version ${v.n}`} style={imgStyle} crossOrigin={v.origin === "luma" ? "anonymous" : undefined} />
      {!zoom &&
        issues.map((iss, idx) => {
          const onThis = iss.versionId === v.id;
          const carried = !onThis && iss.status === "open";
          if (!onThis && !carried) return null;
          return (
            <span key={iss.id}>
              {activeIssue === iss.id && <span className="pin-region" style={{ left: `${iss.x}%`, top: `${iss.y}%` }} />}
              <button
                className={`pin ${iss.status === "resolved" ? "resolved" : ""} ${activeIssue === iss.id ? "active" : ""}`}
                style={{ left: `${iss.x}%`, top: `${iss.y}%`, opacity: carried ? 0.85 : 1, borderStyle: carried ? "dashed" : "solid" }}
                onClick={(e) => { e.stopPropagation(); setActiveIssue(iss.id); setTab("issues"); }}
                title={carried ? "Open issue carried from an earlier version — verify here" : iss.category}
                data-testid={`pin-issue-${iss.id}`}
              >
                {idx + 1}
              </button>
            </span>
          );
        })}
      {draft && <span className="pin draft" style={{ left: `${draft.x}%`, top: `${draft.y}%` }}>+</span>}
    </div>
  );

  return (
    <div className="review-grid">
      <section className="card" style={{ overflow: "hidden" }}>
        <div className="stage-toolbar">
          <div className="seg" role="group" aria-label="Compare mode">
            <button aria-pressed={mode === "side"} onClick={() => setMode("side")} data-testid="button-mode-side"><Columns2 size={13} /> Reference</button>
            <button aria-pressed={mode === "wipe"} disabled={!prev} onClick={() => setMode("wipe")} data-testid="button-mode-wipe" title={!prev ? "Needs a second version" : ""}><Layers size={13} /> vs previous</button>
            <button aria-pressed={mode === "single"} onClick={() => setMode("single")} data-testid="button-mode-single"><Square size={13} /> Single</button>
          </div>
          {mode === "side" && (
            <div className="seg" role="group" aria-label="Reference">
              {REFERENCES.map((r) => (
                <button key={r.id} aria-pressed={refId === r.id} onClick={() => setRefId(r.id)} data-testid={`button-ref-${r.id}`}>{r.id === "ref-01" ? "Ref 01 hero" : "Ref 02 detail"}</button>
              ))}
            </div>
          )}
          <div className="spacer" />
          <button className={`btn btn-sm ${zoom ? "btn-accent" : ""}`} onClick={() => setZoom((z) => !z)} data-testid="button-zoom">
            {zoom ? <ZoomOut size={14} /> : <ZoomIn size={14} />} {zoom ? "Exit zoom" : "Zoom 2×"}
          </button>
          <button
            className={`btn btn-sm ${pinning ? "btn-accent" : ""}`}
            onClick={() => { setPinning((p) => !p); setZoom(false); setMode(mode === "wipe" ? "side" : mode); }}
            disabled={state.role === "client"}
            data-testid="button-pin"
          >
            <MapPin size={14} /> {pinning ? "Click the image…" : "Pin an issue"}
          </button>
        </div>

        <div className="stage">
          {mode === "side" && (
            <div className="compare">
              <div className={`pane ${zoom ? "zoomed" : ""}`} onMouseMove={onMove}>
                <span className="pane-label"><Lock size={11} /> {ref.label}</span>
                <img className="pane-img fit-contain" src={ref.src} alt={ref.label} style={imgStyle} />
              </div>
              {currentPane}
            </div>
          )}
          {mode === "single" && <div style={{ maxWidth: 560, margin: "0 auto" }}>{currentPane}</div>}
          {mode === "wipe" && prev && (
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <div className="pane wipe">
                <span className="pane-label">v{prev.n} ← drag → v{v.n}</span>
                <img className="pane-img" src={v.src} alt={`Version ${v.n}`} crossOrigin={v.origin === "luma" ? "anonymous" : undefined} />
                <div className="top" style={{ width: `${wipe}%` }}>
                  <img src={prev.src} alt={`Version ${prev.n}`} />
                </div>
                <span className="wipe-handle" style={{ left: `${wipe}%` }} />
                <input className="wipe-range" type="range" min={0} max={100} value={wipe} onChange={(e) => setWipe(Number(e.target.value))} aria-label="Compare versions" data-testid="input-wipe" />
              </div>
            </div>
          )}
        </div>

        <div className="versions" aria-label="Version history">
          {concept.versions.map((ver) => (
            <button key={ver.id} className="vthumb" aria-pressed={ver.id === v.id} onClick={() => dispatch({ type: "setActiveVersion", conceptId: concept.id, versionId: ver.id })} data-testid={`button-version-${ver.n}`}>
              <img src={ver.src} alt="" />
              <span className="col" style={{ textAlign: "left" }}>
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>v{ver.n} {ver.origin === "luma" && <span style={{ color: "var(--accent)" }}>· Luma</span>}</span>
                <span className="faint" style={{ fontSize: 11.5 }}>{ver.author} · {ver.at}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 12, padding: "4px 14px 14px", margin: 0 }}>{v.note}</p>
      </section>

      <aside className="card panel" style={{ gap: 0 }}>
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={tab === "issues"} onClick={() => setTab("issues")} data-testid="tab-issues">
            <CircleAlert size={14} /> Issues {openIssuesFor(state, concept.id).length > 0 && <span className="chip chip-issue" style={{ height: 18 }}>{openIssuesFor(state, concept.id).length}</span>}
          </button>
          <button className="tab" role="tab" aria-selected={tab === "contract"} onClick={() => setTab("contract")} data-testid="tab-contract"><Lock size={14} /> Contract</button>
          <button className="tab" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")} data-testid="tab-history"><History size={14} /> History</button>
        </div>
        <div className="card-b col" style={{ gap: 12 }}>
          {tab === "issues" && (
            <>
              {draft && (
                <DraftIssue
                  onCancel={() => setDraft(null)}
                  onSave={(category, comment, rid) => {
                    dispatch({ type: "addIssue", issue: { conceptId: concept.id, versionId: v.id, x: draft.x, y: draft.y, category, comment, refId: rid } });
                    setDraft(null);
                  }}
                />
              )}
              {issues.length === 0 && !draft && (
                <div className="banner banner-ok"><CircleCheck size={16} style={{ color: "var(--ok)", flex: "none" }} /><span>No issues on this direction. Compare against Ref 01 at 2× before accepting.</span></div>
              )}
              {issues.map((iss, idx) => (
                <IssueCard
                  key={iss.id}
                  n={idx + 1}
                  issue={iss}
                  concept={concept}
                  active={activeIssue === iss.id}
                  canResolve={hasNewer(iss)}
                  currentN={v.n}
                  onFocus={() => setActiveIssue(iss.id)}
                  onFix={() => setComposer({ mode: "fix_detail", issueId: iss.id })}
                />
              ))}
              {composer && (
                <Composer concept={concept} version={v} mode={composer.mode} issue={issues.find((i) => i.id === composer.issueId)} onClose={() => setComposer(null)} />
              )}
              {!composer && state.liveJob?.conceptId === concept.id && <LiveJobCard concept={concept} />}

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }} className="col">
                <ConceptActions concept={concept} onBackground={() => setComposer({ mode: "change_background" })} />
              </div>
            </>
          )}
          {tab === "contract" && <ContractTab concept={concept} />}
          {tab === "history" && <HistoryTab conceptId={concept.id} />}
        </div>
      </aside>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function DraftIssue({ onSave, onCancel }: { onSave: (cat: string, comment: string, refId: string) => void; onCancel: () => void }) {
  const [cat, setCat] = useState(ISSUE_CATEGORIES[0]);
  const [comment, setComment] = useState("");
  const [rid, setRid] = useState("ref-02");
  return (
    <div className="issue open" style={{ borderColor: "var(--accent)" }}>
      <div className="row"><span className="pin draft" style={{ position: "static", margin: 0, width: 20, height: 20, fontSize: 10 }}>+</span><span className="h3">New pinned issue</span></div>
      <label className="col" style={{ gap: 4 }}><span className="faint" style={{ fontSize: 12 }}>Category</span>
        <select value={cat} onChange={(e) => setCat(e.target.value)} data-testid="select-issue-category">
          {ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label className="col" style={{ gap: 4 }}><span className="faint" style={{ fontSize: 12 }}>What is wrong, and what should it match?</span>
        <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Heel emblem is recolored — keep terracotta per Ref 01" data-testid="input-issue-comment" />
      </label>
      <label className="col" style={{ gap: 4 }}><span className="faint" style={{ fontSize: 12 }}>Attach source reference</span>
        <select value={rid} onChange={(e) => setRid(e.target.value)} data-testid="select-issue-ref">
          {REFERENCES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
      </label>
      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={!comment.trim()} onClick={() => onSave(cat, comment.trim(), rid)} data-testid="button-save-issue">Save issue</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function IssueCard({ n, issue, concept, active, canResolve, currentN, onFocus, onFix }: {
  n: number; issue: Issue; concept: Concept; active: boolean; canResolve: boolean; currentN: number; onFocus: () => void; onFix: () => void;
}) {
  const { state, dispatch } = useStore();
  const ref = REFERENCES.find((r) => r.id === issue.refId)!;
  const iv = concept.versions.find((x) => x.id === issue.versionId);
  const busy = state.liveJob?.conceptId === concept.id && ["submitting", "queued", "processing"].includes(state.liveJob.state);
  return (
    <div className={`issue ${issue.status === "open" ? "open" : ""}`} onMouseEnter={onFocus} style={active ? { boxShadow: "0 0 0 1px var(--issue) inset" } : undefined} data-testid={`card-issue-${issue.id}`}>
      <div className="row">
        <span className={`pin ${issue.status === "resolved" ? "resolved" : ""}`} style={{ position: "static", margin: 0, width: 20, height: 20, fontSize: 10, boxShadow: "none", border: 0 }}>{n}</span>
        <span className={`chip ${issue.status === "open" ? "chip-issue" : "chip-ok"}`}>{issue.status === "open" ? issue.category : "Resolved"}</span>
        <div className="spacer" />
        <span className="mono faint">on v{iv?.n}</span>
      </div>
      <div style={{ fontSize: 13 }}>{issue.comment}</div>
      <div className="issue-ref">
        <img src={ref.src} alt="" />
        <div style={{ fontSize: 12 }}><div style={{ fontWeight: 500 }}>{ref.label}</div><div className="faint">{ref.note}</div></div>
      </div>
      <div className="faint" style={{ fontSize: 11.5 }}>{issue.author} · {issue.at}{issue.status === "resolved" && issue.resolvedInVersion && ` · verified in v${concept.versions.find((x) => x.id === issue.resolvedInVersion)?.n}`}</div>
      {state.role === "ad" && (
        <div className="row" style={{ flexWrap: "wrap" }}>
          {issue.status === "open" ? (
            <>
              <button className="btn btn-primary btn-sm" onClick={onFix} disabled={busy} data-testid={`button-fix-${issue.id}`}><WandSparkles size={14} /> Fix this concept</button>
              <button className="btn btn-sm" disabled={!canResolve} onClick={() => dispatch({ type: "resolveIssue", id: issue.id })} title={canResolve ? "" : "Resolve after verifying a revised version"} data-testid={`button-resolve-${issue.id}`}>
                <Check size={14} /> {canResolve ? `Verified in v${currentN} — resolve` : "Resolve"}
              </button>
            </>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "reopenIssue", id: issue.id })} data-testid={`button-reopen-${issue.id}`}><RotateCcw size={13} /> Reopen</button>
          )}
        </div>
      )}
      {issue.status === "open" && !canResolve && <div className="faint" style={{ fontSize: 11.5 }}>Stays open until a revised version is checked against {ref.id === "ref-02" ? "Ref 02" : "Ref 01"}.</div>}
    </div>
  );
}

function Composer({ concept, version, mode, issue, onClose }: { concept: Concept; version: Version; mode: LiveMode; issue?: Issue; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const luma = useLumaStatus();
  const toast = useToast();
  const [bg, setBg] = useState("a quiet rooftop at sunrise with soft haze");
  const preserve = useMemo(() => {
    const locked = state.constraints.filter((c) => c.kind === "locked" && c.id !== "c-claim");
    return locked.filter((c) => !(mode === "fix_detail" && c.id === "c-panel")).map((c) => `${c.label.toLowerCase()} (${c.detail})`);
  }, [state.constraints, mode]);
  const prompt = buildEditPrompt(mode, { comment: issue?.comment, background: bg, preserve });
  const seededAvailable = mode === "fix_detail" && concept.seededFix && !concept.versions.some((x) => x.src === concept.seededFix!.src);

  const runLive = async () => {
    onClose();
    await startLive(dispatch, {
      conceptId: concept.id,
      mode,
      ...(version.origin === "luma" && version.generationId ? { sourceGenerationId: version.generationId } : { sourceAsset: assetNameFromSrc(version.src) }),
      comment: issue?.comment,
      background: mode === "change_background" ? bg : undefined,
      preserve,
    });
  };
  const runSeeded = () => {
    dispatch({
      type: "addVersion",
      conceptId: concept.id,
      version: { src: concept.seededFix!.src, origin: "seeded", note: concept.seededFix!.note, author: "Revision agent" },
      historyText: "Pre-generated revision added as v{n}",
    });
    toast("v2 added — compare it with Ref 02 before resolving");
    onClose();
  };

  return (
    <div className="issue" style={{ borderColor: "var(--border-strong)", background: "var(--surface)" }} data-testid="panel-composer">
      <div className="row">
        <WandSparkles size={15} />
        <span className="h3">{mode === "fix_detail" ? "Targeted revision" : "Change background only"}</span>
        <div className="spacer" />
        <button className="btn btn-ghost btn-sm icon-btn" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      <dl className="contract">
        <dt>Source</dt><dd>{concept.name} v{version.n}</dd>
        <dt>Change</dt>
        <dd>{mode === "fix_detail" ? "Side-panel construction only" : (
          <input type="text" value={bg} onChange={(e) => setBg(e.target.value)} aria-label="New background" data-testid="input-background" />
        )}</dd>
        <dt>Preserve</dt>
        <dd className="col" style={{ gap: 3 }}>
          {state.constraints.filter((c) => c.kind === "locked" && c.id !== "c-claim" && !(mode === "fix_detail" && c.id === "c-panel")).map((c) => (
            <span key={c.id} className="row" style={{ gap: 6 }}><Lock size={11} className="faint" />{c.label}</span>
          ))}
          {mode === "fix_detail" && <span className="row" style={{ gap: 6 }}><Lock size={11} className="faint" />Background, lighting, composition</span>}
        </dd>
        <dt>Anchors</dt><dd>{mode === "fix_detail" ? "Ref 02 detail, Ref 01 hero" : "Ref 01 hero, Ref 02 detail"}</dd>
      </dl>
      <details>
        <summary className="faint" style={{ fontSize: 12, cursor: "pointer" }}>Instruction sent to Luma (image_edit)</summary>
        <div className="prompt-box" style={{ marginTop: 6 }}>{prompt}</div>
      </details>
      <div className="banner banner-info" style={{ fontSize: 12 }}>
        <Lock size={14} style={{ flex: "none", marginTop: 1 }} />
        <span>“Locked” is an instruction and a review check — not a pixel guarantee. You verify the result before this issue can close.</span>
      </div>
      <div className="col" style={{ gap: 6 }}>
        <button className="btn btn-accent" onClick={runLive} data-testid="button-run-live">
          <Sparkles size={14} /> Revise live with Luma {luma.model}
        </button>
        {luma.checked && !luma.configured && (
          <span className="faint" style={{ fontSize: 11.5 }}>No server key detected — the live call will show a failed state. The pre-generated path keeps the demo moving.</span>
        )}
        {seededAvailable && (
          <button className="btn" onClick={runSeeded} data-testid="button-run-seeded"><ImageIcon size={14} /> Use pre-generated revision</button>
        )}
      </div>
    </div>
  );
}

function LiveJobCard({ concept }: { concept: Concept }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const job = state.liveJob!;
  const pending = ["submitting", "queued", "processing"].includes(job.state);
  useTick(pending);
  const secs = Math.round((Date.now() - job.startedAt) / 1000);
  const stepIdx = { submitting: 1, queued: 2, processing: 3, completed: 4, failed: 0 }[job.state];
  const failedAt = job.generationId ? 3 : 1;
  const seededAvailable = job.mode === "fix_detail" && concept.seededFix && !concept.versions.some((x) => x.src === concept.seededFix!.src);
  const label = {
    submitting: "Submitting to Luma…",
    queued: "Queued at Luma",
    processing: "Luma is generating",
    completed: "Completed — new version added",
    failed: "Live generation failed",
  }[job.state];

  return (
    <div className={`job ${pending ? "pending" : job.state}`} data-testid={`status-live-${job.state}`} aria-live="polite">
      <div className="row">
        {pending ? <LoaderCircle size={15} className="spin" style={{ color: "var(--accent)" }} /> : job.state === "completed" ? <CircleCheck size={15} style={{ color: "var(--ok)" }} /> : <CircleAlert size={15} style={{ color: "var(--issue)" }} />}
        <span className="h3">{label}</span>
        <div className="spacer" />
        {pending && <span className="mono faint">{secs}s</span>}
      </div>
      <div className="job-steps">
        {[1, 2, 3, 4].map((i) => <span key={i} className={job.state === "failed" ? (i <= failedAt ? "on" : "") : i <= stepIdx ? "on" : ""} />)}
      </div>
      <div className="row mono faint" style={{ justifyContent: "space-between" }}>
        <span>submit</span><span>queued</span><span>processing</span><span>completed</span>
      </div>
      {job.generationId && <div className="mono faint">generation_id {job.generationId.slice(0, 8)}…</div>}
      {pending && <div className="faint" style={{ fontSize: 12 }}>uni-1 typically takes 30–60 seconds. You can keep reviewing other directions.</div>}
      {job.state === "failed" && (
        <>
          <div style={{ fontSize: 12.5 }}>
            <span className="mono" style={{ color: "var(--issue)" }}>{job.failureCode}</span> — {job.failureReason}
          </div>
          <div className="row" style={{ flexWrap: "wrap" }}>
            {seededAvailable && (
              <button className="btn btn-sm btn-primary" onClick={() => {
                dispatch({ type: "addVersion", conceptId: concept.id, version: { src: concept.seededFix!.src, origin: "seeded", note: concept.seededFix!.note, author: "Revision agent" }, historyText: "Fallback: pre-generated revision added as v{n}" });
                dispatch({ type: "liveJob", job: undefined });
                toast("Pre-generated revision added");
              }} data-testid="button-fallback-seeded"><ImageIcon size={13} /> Use pre-generated revision</button>
            )}
            <button className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: "liveJob", job: undefined })} data-testid="button-dismiss-job">Dismiss</button>
          </div>
        </>
      )}
      {job.state === "completed" && (
        <div className="row">
          <span className="faint" style={{ fontSize: 12 }}>Output URL is presigned and expires in 1 hour.</span>
          <div className="spacer" />
          <button className="btn btn-sm btn-ghost" onClick={() => dispatch({ type: "liveJob", job: undefined })}>Dismiss</button>
        </div>
      )}
    </div>
  );
}

function ConceptActions({ concept, onBackground }: { concept: Concept; onBackground: () => void }) {
  const { state, dispatch } = useStore();
  const open = openIssuesFor(state, concept.id).length;
  const v = activeVersion(concept);
  if (state.role === "client") return null;
  return (
    <>
      {concept.status === "accepted" ? (
        <div className="row">
          <span className="chip chip-ok"><Check size={12} /> Accepted at v{v.n}</span>
          <div className="spacer" />
          <button className="btn btn-ghost btn-sm" onClick={() => dispatch({ type: "unacceptConcept", id: concept.id })} disabled={state.variantsBuilt}>Undo</button>
        </div>
      ) : (
        <button className="btn btn-primary" disabled={open > 0} onClick={() => dispatch({ type: "acceptConcept", id: concept.id })} data-testid={`button-accept-${concept.id}`}>
          <Check size={15} /> Accept direction at v{v.n}
        </button>
      )}
      {open > 0 && <span className="faint" style={{ fontSize: 12, marginTop: 6 }}>Resolve {open} open issue{open > 1 ? "s" : ""} before accepting.</span>}
      <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, alignSelf: "flex-start" }} onClick={onBackground} disabled={state.variantsBuilt} data-testid="button-change-bg">
        <Sparkles size={13} /> Change background only (live)
      </button>
    </>
  );
}

function ContractTab({ concept }: { concept: Concept }) {
  const { state } = useStore();
  return (
    <div className="col" style={{ gap: 12 }}>
      <div>
        <div className="eyebrow">Intended change</div>
        <div style={{ marginTop: 4 }}>{concept.change}</div>
      </div>
      <div>
        <div className="eyebrow">Must stay true</div>
        <div className="col" style={{ gap: 6, marginTop: 6 }}>
          {state.constraints.filter((c) => c.kind === "locked").map((c) => (
            <div key={c.id} className="row" style={{ alignItems: "flex-start", fontSize: 12.5 }}><Lock size={12} className="faint" style={{ marginTop: 3 }} /><span><b style={{ fontWeight: 500 }}>{c.label}</b> <span className="muted">— {c.detail}</span></span></div>
          ))}
        </div>
      </div>
      <div>
        <div className="eyebrow">May change</div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>{state.constraints.filter((c) => c.kind === "flexible").map((c) => c.label).join(" · ")}</div>
      </div>
    </div>
  );
}

export function HistoryTab({ conceptId }: { conceptId?: string }) {
  const { state } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const events = state.history.filter((e) => !conceptId || !e.conceptId || e.conceptId === conceptId).slice().reverse();
  return (
    <div className="timeline" ref={ref}>
      {events.map((e, i) => (
        <div className="tl" key={i}>
          <i className={e.kind} />
          <div>
            <div style={{ fontSize: 12.5 }}>{e.text}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>{e.actor} · {e.at}</div>
          </div>
        </div>
      ))}
      {events.length === 0 && <span className="faint">No activity yet.</span>}
      <span className="faint" style={{ fontSize: 11, marginTop: 8 }}>Signed in as {PEOPLE.ad.name}</span>
    </div>
  );
}
