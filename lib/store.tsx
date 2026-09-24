"use client";

import { createContext, useContext, useReducer, type ReactNode, type Dispatch } from "react";
import {
  type Asset,
  type Concept,
  type Constraint,
  type HistoryEvent,
  type Issue,
  type Role,
  type Screen,
  type Version,
  PEOPLE,
  PORTRAIT_SRC,
  initialConcepts,
  initialConstraints,
  initialHistory,
  initialIssues,
} from "./seed";

export type LiveMode = "fix_detail" | "change_background";

export interface LiveJob {
  conceptId: string;
  mode: LiveMode;
  state: "submitting" | "queued" | "processing" | "completed" | "failed";
  generationId?: string;
  startedAt: number;
  prompt?: string;
  failureCode?: string;
  failureReason?: string;
  outputUrl?: string;
  model?: string;
}

export interface State {
  screen: Screen;
  role: Role;
  theme: "dark" | "light";
  constraints: Constraint[];
  setupConfirmed: boolean;
  conceptsReady: boolean;
  concepts: Concept[];
  selectedConceptId: string;
  issues: Issue[];
  assets: Asset[];
  variantsBuilt: boolean;
  history: HistoryEvent[];
  liveJob?: LiveJob;
  needsFinishing: boolean;
}

export const now = () =>
  new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function initialState(): State {
  return {
    screen: "setup",
    role: "ad",
    theme: "dark",
    constraints: initialConstraints(),
    setupConfirmed: false,
    conceptsReady: false,
    concepts: initialConcepts(),
    selectedConceptId: "city",
    issues: [],
    assets: [],
    variantsBuilt: false,
    history: initialHistory(),
    needsFinishing: true,
  };
}

type Action =
  | { type: "nav"; screen: Screen }
  | { type: "role"; role: Role }
  | { type: "theme" }
  | { type: "reset" }
  | { type: "confirmConstraint"; id: string; value: boolean }
  | { type: "confirmAllLocked" }
  | { type: "toggleKind"; id: string }
  | { type: "exploreDirections" }
  | { type: "conceptsReady" }
  | { type: "selectConcept"; id: string }
  | { type: "setActiveVersion"; conceptId: string; versionId: string }
  | { type: "addIssue"; issue: Omit<Issue, "id" | "at" | "author" | "status"> }
  | { type: "resolveIssue"; id: string }
  | { type: "reopenIssue"; id: string }
  | { type: "addVersion"; conceptId: string; version: Omit<Version, "id" | "n" | "at">; historyText: string }
  | { type: "acceptConcept"; id: string }
  | { type: "unacceptConcept"; id: string }
  | { type: "buildVariants" }
  | { type: "approveAsset"; id: string }
  | { type: "requestChanges"; id: string; note: string }
  | { type: "approveAll" }
  | { type: "clientSignOff"; id: string }
  | { type: "clientSignOffAll" }
  | { type: "setFinishing"; value: boolean }
  | { type: "liveJob"; job: LiveJob | undefined }
  | { type: "liveJobPatch"; patch: Partial<LiveJob> }
  | { type: "log"; event: Omit<HistoryEvent, "at"> };

function log(s: State, e: Omit<HistoryEvent, "at">): HistoryEvent[] {
  return [...s.history, { ...e, at: now() }];
}

const conceptName = (s: State, id: string) => s.concepts.find((c) => c.id === id)?.name ?? id;

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "nav":
      return { ...s, screen: a.screen };
    case "role":
      return { ...s, role: a.role, screen: a.role === "client" ? "board" : s.screen };
    case "theme":
      return { ...s, theme: s.theme === "dark" ? "light" : "dark" };
    case "reset":
      return { ...initialState(), theme: s.theme };
    case "confirmConstraint":
      return {
        ...s,
        constraints: s.constraints.map((c) => (c.id === a.id ? { ...c, confirmed: a.value } : c)),
      };
    case "confirmAllLocked":
      return {
        ...s,
        constraints: s.constraints.map((c) => ({ ...c, confirmed: true })),
        history: log(s, { actor: PEOPLE.ad.name, text: "Confirmed all locked rules", kind: "review" }),
      };
    case "toggleKind": {
      const c = s.constraints.find((x) => x.id === a.id)!;
      const kind = c.kind === "locked" ? "flexible" : "locked";
      return {
        ...s,
        constraints: s.constraints.map((x) => (x.id === a.id ? { ...x, kind, confirmed: kind === "flexible" } : x)),
        history: log(s, { actor: PEOPLE.ad.name, text: `Moved “${c.label}” to ${kind}`, kind: "review" }),
      };
    }
    case "exploreDirections":
      return {
        ...s,
        setupConfirmed: true,
        screen: "review",
        history: log(s, { actor: PEOPLE.ad.name, text: "Approved production contract · requested 3 directions", kind: "review" }),
      };
    case "conceptsReady": {
      const t = now();
      return {
        ...s,
        conceptsReady: true,
        issues: initialIssues().map((i) => ({ ...i, at: t })),
        history: [
          ...s.history,
          { at: t, actor: "Concept agent", text: "Generated 1 concept per direction (3 total)", kind: "version" },
          { at: t, actor: PEOPLE.designer.name, text: "Pinned “Product detail incorrect” on City commute v1", kind: "issue", conceptId: "city" },
        ],
      };
    }
    case "selectConcept":
      return { ...s, selectedConceptId: a.id };
    case "setActiveVersion":
      return {
        ...s,
        concepts: s.concepts.map((c) => (c.id === a.conceptId ? { ...c, activeVersionId: a.versionId } : c)),
      };
    case "addIssue": {
      const issue: Issue = {
        ...a.issue,
        id: `iss-${Date.now()}`,
        at: now(),
        author: PEOPLE.ad.name,
        status: "open",
      };
      const v = s.concepts.find((c) => c.id === a.issue.conceptId)?.versions.find((x) => x.id === a.issue.versionId);
      return {
        ...s,
        issues: [...s.issues, issue],
        concepts: s.concepts.map((c) => (c.id === a.issue.conceptId ? { ...c, status: "proposed" } : c)),
        history: log(s, {
          actor: PEOPLE.ad.name,
          text: `Pinned “${issue.category}” on ${conceptName(s, issue.conceptId)} v${v?.n ?? "?"}`,
          kind: "issue",
          conceptId: issue.conceptId,
        }),
      };
    }
    case "resolveIssue": {
      const iss = s.issues.find((i) => i.id === a.id)!;
      const c = s.concepts.find((x) => x.id === iss.conceptId)!;
      const active = c.versions.find((v) => v.id === c.activeVersionId)!;
      return {
        ...s,
        issues: s.issues.map((i) => (i.id === a.id ? { ...i, status: "resolved", resolvedInVersion: active.id } : i)),
        history: log(s, {
          actor: PEOPLE.ad.name,
          text: `Verified v${active.n} against ${iss.refId === "ref-02" ? "Ref 02" : "Ref 01"} · resolved “${iss.category}”`,
          kind: "issue",
          conceptId: iss.conceptId,
        }),
      };
    }
    case "reopenIssue":
      return { ...s, issues: s.issues.map((i) => (i.id === a.id ? { ...i, status: "open", resolvedInVersion: undefined } : i)) };
    case "addVersion": {
      const c = s.concepts.find((x) => x.id === a.conceptId)!;
      const n = c.versions.length + 1;
      const version: Version = { ...a.version, id: `${c.id}-v${n}-${Date.now()}`, n, at: now() };
      return {
        ...s,
        concepts: s.concepts.map((x) =>
          x.id === a.conceptId
            ? { ...x, versions: [...x.versions, version], activeVersionId: version.id, status: "proposed" }
            : x,
        ),
        history: log(s, { actor: version.author, text: a.historyText.replace("{n}", String(n)), kind: "version", conceptId: c.id }),
      };
    }
    case "acceptConcept": {
      const c = s.concepts.find((x) => x.id === a.id)!;
      const v = c.versions.find((x) => x.id === c.activeVersionId)!;
      return {
        ...s,
        concepts: s.concepts.map((x) => (x.id === a.id ? { ...x, status: "accepted" } : x)),
        history: log(s, { actor: PEOPLE.ad.name, text: `Accepted ${c.name} direction at v${v.n}`, kind: "approval", conceptId: c.id }),
      };
    }
    case "unacceptConcept":
      return { ...s, concepts: s.concepts.map((x) => (x.id === a.id ? { ...x, status: "proposed" } : x)) };
    case "buildVariants": {
      const assets: Asset[] = [];
      for (const c of s.concepts) {
        const v = c.versions.find((x) => x.id === c.activeVersionId)!;
        assets.push({ id: `${c.id}-square`, conceptId: c.id, placement: "square", src: v.src, parentVersion: v.n, status: "in_review", clientSignedOff: false });
        assets.push({ id: `${c.id}-portrait`, conceptId: c.id, placement: "portrait", src: PORTRAIT_SRC[c.id], parentVersion: v.n, status: "in_review", clientSignedOff: false });
      }
      return {
        ...s,
        assets,
        variantsBuilt: true,
        screen: "board",
        history: log(s, { actor: "Variant agent", text: "Filled 6 placement slots from 3 accepted directions", kind: "version" }),
      };
    }
    case "approveAsset": {
      const as = s.assets.find((x) => x.id === a.id)!;
      return {
        ...s,
        assets: s.assets.map((x) => (x.id === a.id ? { ...x, status: "approved", note: undefined, approvedAt: now() } : x)),
        history: log(s, { actor: PEOPLE.ad.name, text: `Approved ${conceptName(s, as.conceptId)} · ${as.placement}`, kind: "approval", conceptId: as.conceptId }),
      };
    }
    case "requestChanges": {
      const as = s.assets.find((x) => x.id === a.id)!;
      return {
        ...s,
        assets: s.assets.map((x) => (x.id === a.id ? { ...x, status: "changes_requested", note: a.note, clientSignedOff: false } : x)),
        history: log(s, { actor: s.role === "client" ? PEOPLE.client.name : PEOPLE.ad.name, text: `Requested changes on ${conceptName(s, as.conceptId)} · ${as.placement}: “${a.note}”`, kind: "issue", conceptId: as.conceptId }),
      };
    }
    case "approveAll":
      return {
        ...s,
        assets: s.assets.map((x) => (x.status === "in_review" ? { ...x, status: "approved", approvedAt: now() } : x)),
        history: log(s, { actor: PEOPLE.ad.name, text: "Approved all remaining assets as a set", kind: "approval" }),
      };
    case "clientSignOff": {
      const as = s.assets.find((x) => x.id === a.id)!;
      return {
        ...s,
        assets: s.assets.map((x) => (x.id === a.id ? { ...x, clientSignedOff: true } : x)),
        history: log(s, { actor: PEOPLE.client.name, text: `Signed off ${conceptName(s, as.conceptId)} · ${as.placement}`, kind: "approval" }),
      };
    }
    case "clientSignOffAll":
      return {
        ...s,
        assets: s.assets.map((x) => (x.status === "approved" ? { ...x, clientSignedOff: true } : x)),
        history: log(s, { actor: PEOPLE.client.name, text: "Signed off the full set", kind: "approval" }),
      };
    case "setFinishing":
      return { ...s, needsFinishing: a.value };
    case "liveJob":
      return { ...s, liveJob: a.job };
    case "liveJobPatch":
      return s.liveJob ? { ...s, liveJob: { ...s.liveJob, ...a.patch } } : s;
    case "log":
      return { ...s, history: log(s, a.event) };
  }
}

const Ctx = createContext<{ state: State; dispatch: Dispatch<Action> } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}

// Derived helpers
export const openIssuesFor = (s: State, conceptId: string) =>
  s.issues.filter((i) => i.conceptId === conceptId && i.status === "open");

export const activeVersion = (c: Concept) => c.versions.find((v) => v.id === c.activeVersionId)!;
