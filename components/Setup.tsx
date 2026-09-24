"use client";

import { Check, Lock, Unlock, ArrowRight, ShieldCheck, FileText } from "lucide-react";
import { useStore } from "@/lib/store";
import { CAMPAIGN, PEOPLE, PLACEMENTS, REFERENCES, SWATCHES } from "@/lib/seed";

export default function Setup() {
  const { state, dispatch } = useStore();
  const locked = state.constraints.filter((c) => c.kind === "locked");
  const flexible = state.constraints.filter((c) => c.kind === "flexible");
  const confirmed = locked.filter((c) => c.confirmed).length;
  const ready = confirmed === locked.length;

  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 18, alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">Step 1 · Campaign setup</div>
          <h1 className="h1" style={{ marginTop: 4 }}>Confirm what must stay true before anything is generated</h1>
          <p className="muted" style={{ margin: "6px 0 0", maxWidth: 720 }}>{CAMPAIGN.brief}</p>
        </div>
      </div>

      <div className="setup-grid">
        {/* Left: source of truth */}
        <section>
          <div className="hero-frame">
            <img src="seed/hero.jpg" alt="Approved hero: Aster One sneaker, bone knit with terracotta side panel" />
            <span className="hero-tag"><ShieldCheck size={13} /> Source of truth · Approved hero · client sign-off Sep 18</span>
          </div>
          <div className="ref-strip">
            {REFERENCES.map((r) => (
              <figure className="ref-card" key={r.id} style={{ margin: 0 }}>
                <img src={r.src} alt={r.label} />
                <figcaption className="meta">
                  <div style={{ fontWeight: 500 }}>{r.label}</div>
                  <div className="faint">{r.note}</div>
                </figcaption>
              </figure>
            ))}
            <figure className="ref-card" style={{ margin: 0 }}>
              <div className="swatches">
                {SWATCHES.map((s) => (
                  <div key={s.name} className="swatch" style={{ background: s.hex, color: s.hex === "#E7E1D6" || s.hex === "#C99A4E" ? "#1a1917" : "#f5f3ee" }}>
                    {s.name}
                  </div>
                ))}
              </div>
              <figcaption className="meta">
                <div style={{ fontWeight: 500 }}>Brand kit v4 · Colorway</div>
                <div className="faint">Sampled from Ref 01</div>
              </figcaption>
            </figure>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-b row" style={{ alignItems: "flex-start", gap: 12 }}>
              <FileText size={16} className="faint" style={{ marginTop: 2 }} />
              <div>
                <div className="eyebrow">Approved claim · legal-cleared</div>
                <div style={{ fontSize: 17, fontWeight: 600, marginTop: 4, letterSpacing: "-0.01em" }}>{CAMPAIGN.claim}</div>
                <div className="faint" style={{ fontSize: 12, marginTop: 2 }}>Wording is locked. Placement on the asset is flexible.</div>
              </div>
            </div>
          </div>
        </section>

        {/* Right: production contract */}
        <section className="col" style={{ gap: 12 }}>
          <div className="card">
            <div className="card-h">
              <Lock size={15} />
              <h2 className="h2">Locked</h2>
              <span className="faint" style={{ fontSize: 12.5 }}>Every output is checked against these</span>
              <div className="spacer" />
              <span className={`chip ${ready ? "chip-ok" : "chip-warn"}`} data-testid="text-locked-count">{confirmed}/{locked.length} confirmed</span>
            </div>
            <div className="card-b rules">
              {locked.map((c) => (
                <div className="rule" key={c.id}>
                  <button
                    className="check"
                    role="checkbox"
                    aria-checked={c.confirmed}
                    aria-label={`Confirm ${c.label}`}
                    onClick={() => dispatch({ type: "confirmConstraint", id: c.id, value: !c.confirmed })}
                    data-testid={`checkbox-rule-${c.id}`}
                  >
                    {c.confirmed && <Check size={12} strokeWidth={3} />}
                  </button>
                  <div>
                    <div className="rule-label">{c.label}</div>
                    <div className="rule-detail">{c.detail}</div>
                    <div className="rule-src">from {c.source}{!c.confirmed && <span className="chip chip-warn" style={{ height: 18, fontSize: 10.5 }}>Needs your check</span>}</div>
                  </div>
                  <button className="kind-toggle" onClick={() => dispatch({ type: "toggleKind", id: c.id })} data-testid={`button-kind-${c.id}`} title="Move to flexible">
                    <Unlock size={12} /> Make flexible
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h">
              <Unlock size={15} />
              <h2 className="h2">Flexible</h2>
              <span className="faint" style={{ fontSize: 12.5 }}>Where directions may explore</span>
            </div>
            <div className="card-b rules">
              {flexible.map((c) => (
                <div className="rule" key={c.id} style={{ gridTemplateColumns: "1fr auto" }}>
                  <div>
                    <div className="rule-label">{c.label}</div>
                    <div className="rule-detail">{c.detail}</div>
                  </div>
                  <button className="kind-toggle" onClick={() => dispatch({ type: "toggleKind", id: c.id })} data-testid={`button-kind-${c.id}`}>
                    <Lock size={12} /> Lock
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h2 className="h2">Deliverables</h2><span className="faint" style={{ fontSize: 12.5 }}>Six named slots</span></div>
            <div className="card-b" style={{ paddingTop: 6 }}>
              <table className="matrix">
                <thead>
                  <tr><th>Direction</th><th>{PLACEMENTS.square.label} · {PLACEMENTS.square.ratio}</th><th>{PLACEMENTS.portrait.label} · {PLACEMENTS.portrait.ratio}</th></tr>
                </thead>
                <tbody>
                  {state.concepts.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td className="mono muted">{PLACEMENTS.square.dims}</td>
                      <td className="mono muted">{PLACEMENTS.portrait.dims}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 12, gap: 16, fontSize: 12.5 }}>
                <span><span className="faint">Creative approval</span> · {PEOPLE.ad.name}</span>
                <span><span className="faint">Final sign-off</span> · {PEOPLE.client.name}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="cta-bar">
        <div className="progress" aria-hidden><i style={{ width: `${(confirmed / locked.length) * 100}%` }} /></div>
        <span className="muted" style={{ fontSize: 13 }}>
          {ready ? "Contract ready. Directions will be generated one concept at a time — not six finals." : `Confirm ${locked.length - confirmed} more locked rule${locked.length - confirmed > 1 ? "s" : ""} so nothing is generated against a misread constraint.`}
        </span>
        <div className="spacer" />
        {!ready && (
          <button className="btn" onClick={() => dispatch({ type: "confirmAllLocked" })} data-testid="button-confirm-all">
            Confirm all locked
          </button>
        )}
        {state.setupConfirmed ? (
          <button className="btn btn-primary btn-lg" onClick={() => dispatch({ type: "nav", screen: "review" })} data-testid="button-go-review">
            Go to concept review <ArrowRight size={16} />
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" disabled={!ready} onClick={() => dispatch({ type: "exploreDirections" })} data-testid="button-explore">
            Explore 3 directions <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
