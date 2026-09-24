"use client";

import { useMemo, useState } from "react";
import { Check, CircleAlert, CircleCheck, Columns2, Copy, Download, FileJson, MessageSquareWarning, PackageCheck, ScanLine, Sparkles, Type, X, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { CAMPAIGN, PEOPLE, PLACEMENTS, REFERENCES, type Asset } from "@/lib/seed";
import { useToast } from "./Shell";

export default function Board() {
  const { state, dispatch } = useStore();
  const [safe, setSafe] = useState(false);
  const [claim, setClaim] = useState(false);
  const [compare, setCompare] = useState<Asset | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const isClient = state.role === "client";

  if (!state.variantsBuilt) {
    return (
      <div className="page">
        <div className="banner banner-info"><CircleAlert size={16} /> The approval board opens once all three directions are accepted and the six placements are built.</div>
      </div>
    );
  }

  const openIssues = state.issues.filter((i) => i.status === "open");
  const changes = state.assets.filter((a) => a.status === "changes_requested");
  const approved = state.assets.filter((a) => a.status === "approved");
  const signed = state.assets.filter((a) => a.clientSignedOff);
  const allApproved = approved.length === 6;
  const blockers: string[] = [];
  if (openIssues.length) blockers.push(`${openIssues.length} open issue${openIssues.length > 1 ? "s" : ""} in concept review`);
  if (changes.length) blockers.push(`${changes.length} asset${changes.length > 1 ? "s" : ""} with changes requested`);

  const evidence = [
    { q: "Right six?", pass: state.assets.length === 6, a: `${state.assets.length}/6 slots filled · 3 directions × 1:1, 4:5` },
    { q: "Product faithful?", pass: openIssues.length === 0, a: openIssues.length ? `${openIssues.length} product issue open` : "Every product issue verified against a reference" },
    { q: "Campaign coherent?", pass: changes.length === 0, a: changes.length ? `${changes.length} asset flagged for changes` : "Same claim, colorway, emblem across all six" },
    { q: "Handoff defensible?", pass: allApproved, a: allApproved ? `Approved by ${PEOPLE.ad.name}${signed.length === 6 ? ` · signed off by ${PEOPLE.client.name}` : ""}` : `${approved.length}/6 approved · lineage recorded` },
  ];

  const rows = state.concepts.map((c) => ({ concept: c, square: state.assets.find((a) => a.id === `${c.id}-square`)!, portrait: state.assets.find((a) => a.id === `${c.id}-portrait`)! }));

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 16, alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">Step 3 · Approval board{isClient && " · client view"}</div>
          <h1 className="h1" style={{ marginTop: 4 }}>{isClient ? "Sign off the set Northbound has approved" : "Judge the six as a family, then approve what ships"}</h1>
          <p className="muted" style={{ margin: "6px 0 0", maxWidth: 760 }}>
            {isClient
              ? `${PEOPLE.ad.name} has approved ${approved.length} of 6. Each asset shows where it came from and what was checked.`
              : "Every asset carries its lineage to an accepted direction. Approval is per asset; the set can’t ship while anything is unresolved."}
          </p>
        </div>
        <div className="spacer" />
        <div className="row">
          <button className={`btn btn-sm ${safe ? "btn-accent" : ""}`} aria-pressed={safe} onClick={() => setSafe((s) => !s)} data-testid="button-safe-zone"><ScanLine size={14} /> Copy-safe zones</button>
          <button className={`btn btn-sm ${claim ? "btn-accent" : ""}`} aria-pressed={claim} onClick={() => setClaim((s) => !s)} data-testid="button-claim"><Type size={14} /> Preview claim</button>
        </div>
      </div>

      {!isClient && (
        <div className="evidence">
          {evidence.map((e) => (
            <div key={e.q} className={`ev ${e.pass ? "pass" : "fail"}`} data-testid={`status-evidence-${e.q.split(" ")[0].toLowerCase()}`}>
              <div className="row" style={{ gap: 6 }}>
                {e.pass ? <CircleCheck size={14} style={{ color: "var(--ok)" }} /> : <CircleAlert size={14} style={{ color: "var(--warn)" }} />}
                <span className="h3">{e.q}</span>
              </div>
              <span className="faint" style={{ fontSize: 12 }}>{e.a}</span>
            </div>
          ))}
        </div>
      )}

      <div className="board">
        <div />
        <div className="eyebrow">{PLACEMENTS.square.label} · {PLACEMENTS.square.ratio} · {PLACEMENTS.square.dims}</div>
        <div className="eyebrow">{PLACEMENTS.portrait.label} · {PLACEMENTS.portrait.ratio} · {PLACEMENTS.portrait.dims}</div>
        {rows.map(({ concept, square, portrait }) => {
          const v = concept.versions.find((x) => x.id === concept.activeVersionId)!;
          return (
            <FragmentRow key={concept.id}>
              <div className="board-rowlabel col" style={{ gap: 6 }}>
                <span className="h2">{concept.name}</span>
                <span className="faint" style={{ fontSize: 12 }}>{concept.territory}</span>
                <span className="chip" style={{ alignSelf: "flex-start" }}>Accepted at v{v.n}{v.origin === "luma" && " · Luma"}</span>
                {state.issues.some((i) => i.conceptId === concept.id && i.status === "resolved") && <span className="faint" style={{ fontSize: 11.5 }}>Product issue fixed and verified against Ref 02</span>}
              </div>
              {[square, portrait].map((a) => (
                <AssetCard key={a.id} asset={a} conceptName={concept.name} fromLuma={v.origin === "luma" && a.placement === "square"} safe={safe} claim={claim} onCompare={() => setCompare(a)} />
              ))}
            </FragmentRow>
          );
        })}
      </div>

      <div className="cta-bar">
        <div className="progress" aria-hidden><i style={{ width: `${((isClient ? signed.length : approved.length) / 6) * 100}%` }} /></div>
        <span className="muted" style={{ fontSize: 13 }} data-testid="text-board-status">
          {blockers.length
            ? `Blocked: ${blockers.join(" · ")}.`
            : isClient
              ? `${signed.length}/6 signed off.`
              : allApproved
                ? "All six approved. Export records lineage, approvers, and zero open issues."
                : `${approved.length}/6 approved.`}
        </span>
        <div className="spacer" />
        {isClient ? (
          <button className="btn btn-primary" disabled={!allApproved || signed.length === 6} onClick={() => dispatch({ type: "clientSignOffAll" })} data-testid="button-signoff-all">
            <Check size={15} /> {signed.length === 6 ? "Set signed off" : allApproved ? "Sign off all six" : "Waiting on agency approval"}
          </button>
        ) : (
          <button className="btn" disabled={blockers.length > 0 || allApproved} onClick={() => dispatch({ type: "approveAll" })} title={blockers.join("; ")} data-testid="button-approve-all">
            <Check size={15} /> Approve remaining
          </button>
        )}
        <button className="btn btn-primary btn-lg" disabled={!allApproved} onClick={() => setExportOpen(true)} data-testid="button-export">
          <PackageCheck size={16} /> Export handoff
        </button>
      </div>

      {compare && <CompareModal asset={compare} onClose={() => setCompare(null)} />}
      {exportOpen && <ExportModal onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function FragmentRow({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AssetCard({ asset, conceptName, fromLuma, safe, claim, onCompare }: { asset: Asset; conceptName: string; fromLuma: boolean; safe: boolean; claim: boolean; onCompare: () => void }) {
  const { state, dispatch } = useStore();
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const isClient = state.role === "client";
  const p = PLACEMENTS[asset.placement];
  const cls = asset.status === "approved" ? "approved" : asset.status === "changes_requested" ? "changes" : "";

  return (
    <article className={`asset ${cls}`} data-testid={`card-asset-${asset.id}`}>
      <div className={`asset-media ${asset.placement}`}>
        <img src={asset.src} alt={`${conceptName} ${p.label}`} crossOrigin={fromLuma ? "anonymous" : undefined} />
        {safe && (
          asset.placement === "portrait"
            ? <div className="safe-zone" style={{ top: "4%", height: "26%" }}><span>Copy-safe · top third</span></div>
            : <div className="safe-zone" style={{ bottom: "5%", height: "22%" }}><span>Optional overlay</span></div>
        )}
        {claim && (
          <div className="claim-overlay" style={asset.placement === "portrait" ? { top: "13%" } : { bottom: "9%" }}>{CAMPAIGN.claim}</div>
        )}
        <span className="pane-label" style={{ top: 10, left: 10 }}>{p.ratio}</span>
      </div>
      <div className="asset-body">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="h3">{p.label}</span>
          {asset.status === "approved" ? (
            <span className="chip chip-ok"><Check size={12} /> {isClient && asset.clientSignedOff ? "Signed off" : "Approved"}</span>
          ) : asset.status === "changes_requested" ? (
            <span className="chip chip-issue"><span className="dot" /> Changes requested</span>
          ) : (
            <span className="chip">In review</span>
          )}
        </div>
        <div className="mono faint" style={{ fontSize: 11.5 }}>
          from {conceptName} v{asset.parentVersion}{fromLuma && <> · <Sparkles size={10} /> Luma</>} · {p.dims}
        </div>
        <div className="checks">
          <span className="chip chip-ok" style={{ height: 20, fontSize: 11 }}><Lock size={10} /> Product vs Ref 01</span>
          <span className="chip chip-ok" style={{ height: 20, fontSize: 11 }}><Lock size={10} /> Emblem</span>
          <span className="chip chip-ok" style={{ height: 20, fontSize: 11 }}><Lock size={10} /> Claim wording</span>
        </div>
        {asset.note && <div className="banner banner-issue" style={{ fontSize: 12 }}><MessageSquareWarning size={14} style={{ flex: "none" }} /> {asset.note}</div>}
        {asking && (
          <div className="col" style={{ gap: 6 }}>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs to change on this placement?" data-testid={`input-changes-${asset.id}`} />
            <div className="row">
              <button className="btn btn-sm btn-primary" disabled={!note.trim()} onClick={() => { dispatch({ type: "requestChanges", id: asset.id, note: note.trim() }); setAsking(false); setNote(""); }} data-testid={`button-submit-changes-${asset.id}`}>Send</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setAsking(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
      <div className="asset-actions">
        <button className="btn btn-sm btn-ghost" onClick={onCompare} data-testid={`button-compare-${asset.id}`}><Columns2 size={13} /> vs hero</button>
        <div className="spacer" />
        {!asking && (isClient ? (
          <>
            {asset.status === "approved" && !asset.clientSignedOff && (
              <button className="btn btn-sm btn-primary" onClick={() => dispatch({ type: "clientSignOff", id: asset.id })} data-testid={`button-signoff-${asset.id}`}><Check size={13} /> Sign off</button>
            )}
            {!asset.clientSignedOff && <button className="btn btn-sm" onClick={() => setAsking(true)} data-testid={`button-request-${asset.id}`}>Request changes</button>}
            {asset.clientSignedOff && <span className="chip chip-ok"><Check size={12} /> {PEOPLE.client.name}</span>}
          </>
        ) : (
          <>
            {asset.status !== "approved" && <button className="btn btn-sm" onClick={() => setAsking(true)} data-testid={`button-request-${asset.id}`}>Request changes</button>}
            {asset.status !== "approved" ? (
              <button className="btn btn-sm btn-primary" onClick={() => dispatch({ type: "approveAsset", id: asset.id })} data-testid={`button-approve-${asset.id}`}><Check size={13} /> Approve</button>
            ) : (
              <span className="faint" style={{ fontSize: 11.5 }}>{asset.approvedAt}</span>
            )}
          </>
        ))}
      </div>
    </article>
  );
}

function CompareModal({ asset, onClose }: { asset: Asset; onClose: () => void }) {
  const ref = REFERENCES[0];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Compare with approved hero">
        <div className="modal-h"><Columns2 size={16} /><span className="h2">Compare with approved hero</span><div className="spacer" /><button className="btn btn-ghost btn-sm icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button></div>
        <div className="modal-b compare" style={{ alignItems: "center" }}>
          <div className="pane"><span className="pane-label"><Lock size={11} /> {ref.label}</span><img src={ref.src} alt={ref.label} style={{ width: "100%" }} /></div>
          <div className="pane"><span className="pane-label">{PLACEMENTS[asset.placement].label} · {PLACEMENTS[asset.placement].ratio}</span><img src={asset.src} alt="Asset" style={{ width: "100%" }} /></div>
        </div>
        <p className="faint" style={{ padding: "0 18px 18px", margin: 0, fontSize: 12.5 }}>Check side-panel cutouts, colorway, and heel emblem. Locked rules are review checks — the reviewer is the final authority.</p>
      </div>
    </div>
  );
}

function ExportModal({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [view, setView] = useState<"table" | "json">("table");
  const signedAll = state.assets.every((a) => a.clientSignedOff);
  const label = state.needsFinishing ? "Approved for finishing" : signedAll ? "Client-approved final" : "Agency-approved · awaiting client sign-off";

  const manifest = useMemo(() => {
    const items = state.assets.map((a) => {
      const c = state.concepts.find((x) => x.id === a.conceptId)!;
      const v = c.versions.find((x) => x.n === a.parentVersion)!;
      const p = PLACEMENTS[a.placement];
      return {
        filename: `${CAMPAIGN.code}_${a.conceptId}_${p.ratio.replace(":", "x")}_v${a.parentVersion}.jpg`,
        placement: `${p.label} ${p.ratio}`,
        dimensions: p.dims.replace(/ /g, ""),
        concept: c.name,
        version: `v${a.parentVersion}`,
        origin: v.origin === "luma" && a.placement === "square" ? `luma:${v.generationId}` : "pre-generated",
        references: ["ref-01", ...(state.issues.some((i) => i.conceptId === c.id) ? ["ref-02"] : [])],
        approved_by: PEOPLE.ad.name,
        approved_at: a.approvedAt,
        client_signoff: a.clientSignedOff ? PEOPLE.client.name : null,
        open_issues: state.issues.filter((i) => i.conceptId === c.id && i.status === "open").length,
      };
    });
    return {
      campaign: CAMPAIGN.name,
      code: CAMPAIGN.code,
      status: label,
      claim: CAMPAIGN.claim,
      locked_rules: state.constraints.filter((c) => c.kind === "locked").map((c) => c.label),
      resolved_issues: state.issues.filter((i) => i.status === "resolved").map((i) => ({ category: i.category, verified_in: state.concepts.find((c) => c.id === i.conceptId)?.versions.find((v) => v.id === i.resolvedInVersion)?.n })),
      assets: items,
    };
  }, [state, label]);
  const json = JSON.stringify(manifest, null, 2);

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${CAMPAIGN.code}_manifest.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Export manifest" data-testid="modal-export">
        <div className="modal-h">
          <PackageCheck size={16} /><span className="h2">Export manifest</span>
          <span className={`chip ${state.needsFinishing ? "chip-warn" : signedAll ? "chip-ok" : "chip-accent"}`} data-testid="text-export-label">{label}</span>
          <div className="spacer" />
          <button className="btn btn-ghost btn-sm icon-btn" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="modal-b col" style={{ gap: 14 }}>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <label className="row" style={{ gap: 8, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={state.needsFinishing} onChange={(e) => dispatch({ type: "setFinishing", value: e.target.checked })} data-testid="checkbox-finishing" />
              Hand off to retouching before final (typeset claim, color QC)
            </label>
            <div className="spacer" />
            <div className="seg">
              <button aria-pressed={view === "table"} onClick={() => setView("table")}>Table</button>
              <button aria-pressed={view === "json"} onClick={() => setView("json")}><FileJson size={13} /> JSON</button>
            </div>
          </div>
          {view === "table" ? (
            <table className="manifest-table">
              <thead><tr><th>File</th><th>Placement</th><th>Size</th><th>Lineage</th><th>Origin</th><th>Approvals</th><th>Open</th></tr></thead>
              <tbody>
                {manifest.assets.map((m) => (
                  <tr key={m.filename}>
                    <td className="mono">{m.filename}</td>
                    <td>{m.placement}</td>
                    <td className="mono">{m.dimensions}</td>
                    <td>{m.concept} {m.version}</td>
                    <td className="mono faint">{m.origin.startsWith("luma") ? `${m.origin.slice(0, 13)}…` : m.origin}</td>
                    <td>{m.approved_by}{m.client_signoff && <><br /><span className="faint">{m.client_signoff}</span></>}</td>
                    <td className="mono" style={{ color: m.open_issues ? "var(--issue)" : "var(--ok)" }}>{m.open_issues}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <pre className="prompt-box" style={{ maxHeight: 360, overflow: "auto", margin: 0 }} data-testid="text-manifest-json">{json}</pre>
          )}
          <div className="banner banner-info" style={{ fontSize: 12 }}>
            <CircleCheck size={14} style={{ flex: "none", marginTop: 1 }} />
            <span>{manifest.resolved_issues.length} product issue{manifest.resolved_issues.length === 1 ? "" : "s"} resolved and verified against a reference · 0 open. Luma output URLs are presigned for 1 hour, so production exports should copy files to agency storage.</span>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => { navigator.clipboard?.writeText(json).then(() => toast("Manifest copied"), () => toast("Copy not available here — use Download")); }} data-testid="button-copy-manifest"><Copy size={14} /> Copy JSON</button>
            <button className="btn btn-primary" onClick={download} data-testid="button-download-manifest"><Download size={14} /> Download manifest</button>
          </div>
        </div>
      </div>
    </div>
  );
}
