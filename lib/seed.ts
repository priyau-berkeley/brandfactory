// Seeded, fictional campaign data. All brand names, people, and assets are invented for this prototype.

export type Screen = "setup" | "review" | "board";
export type Role = "ad" | "client";
export type Placement = "square" | "portrait";

export interface Constraint {
  id: string;
  label: string;
  detail: string;
  kind: "locked" | "flexible";
  source: string;
  confirmed: boolean;
}

export interface Version {
  id: string;
  n: number;
  src: string;
  origin: "seeded" | "luma";
  generationId?: string;
  note: string;
  author: string;
  at: string;
}

export interface Issue {
  id: string;
  conceptId: string;
  versionId: string;
  x: number; // percent
  y: number; // percent
  category: string;
  comment: string;
  refId: string;
  status: "open" | "resolved";
  author: string;
  at: string;
  resolvedInVersion?: string;
}

export interface Concept {
  id: string;
  name: string;
  territory: string;
  change: string;
  status: "proposed" | "accepted";
  versions: Version[];
  activeVersionId: string;
  // seeded fix available for the demo path when live generation is unavailable
  seededFix?: { src: string; note: string };
}

export interface Asset {
  id: string;
  conceptId: string;
  placement: Placement;
  src: string;
  parentVersion: number;
  status: "in_review" | "approved" | "changes_requested";
  note?: string;
  approvedAt?: string;
  clientSignedOff: boolean;
}

export interface HistoryEvent {
  at: string;
  actor: string;
  text: string;
  conceptId?: string;
  kind: "system" | "review" | "issue" | "version" | "approval" | "live";
}

export interface Reference {
  id: string;
  label: string;
  src: string;
  note: string;
}

export const PEOPLE = {
  ad: { name: "Maya Okafor", role: "Art director · Northbound Studio" },
  designer: { name: "Leo Park", role: "Designer · Northbound Studio" },
  client: { name: "Daniel Reyes", role: "Brand lead · Aster Athletics" },
};

export const CAMPAIGN = {
  name: "Aster One — Launch Flight",
  client: "Aster Athletics",
  agency: "Northbound Studio",
  product: "Aster One running sneaker",
  due: "Oct 14, 2026",
  claim: "Built for the long way round.",
  brief:
    "Launch the Aster One across paid social with three distinct creative territories. Every asset must show the approved product faithfully; settings, light, and framing can move.",
  code: "ASTR-ONE-LAUNCH",
};

export const REFERENCES: Reference[] = [
  { id: "ref-01", label: "Ref 01 · Approved hero", src: "seed/hero.jpg", note: "Client-approved Sep 18 · source of truth" },
  { id: "ref-02", label: "Ref 02 · Side-panel detail", src: "seed/ref-sidepanel.jpg", note: "Three oval cutouts, cream contrast stitching" },
];

export const SWATCHES = [
  { name: "Bone knit", hex: "#E7E1D6" },
  { name: "Terracotta suede", hex: "#B5532A" },
  { name: "Honey gum", hex: "#C99A4E" },
  { name: "Charcoal lace", hex: "#3A3937" },
];

export const PLACEMENTS: Record<Placement, { label: string; ratio: string; dims: string; w: number; h: number }> = {
  square: { label: "Feed square", ratio: "1:1", dims: "1080 × 1080", w: 1080, h: 1080 },
  portrait: { label: "Feed portrait", ratio: "4:5", dims: "1080 × 1350", w: 1080, h: 1350 },
};

export const PORTRAIT_SRC: Record<string, string> = {
  studio: "seed/studio-portrait.jpg",
  city: "seed/city-portrait.jpg",
  outdoor: "seed/outdoor-portrait.jpg",
};

export function initialConstraints(): Constraint[] {
  return [
    { id: "c-silhouette", label: "Product silhouette", detail: "Low-profile runner, rounded toe, pull-free heel collar", kind: "locked", source: "Ref 01 · approved hero", confirmed: true },
    { id: "c-panel", label: "Side-panel construction", detail: "Three stitched oval cutouts in the terracotta panel", kind: "locked", source: "Ref 02 · detail", confirmed: false },
    { id: "c-color", label: "Colorway", detail: "Bone knit, terracotta suede, honey gum sole, charcoal laces", kind: "locked", source: "Ref 01 · approved hero", confirmed: false },
    { id: "c-emblem", label: "Heel-tab emblem", detail: "Eight-point star, embossed, never recolored", kind: "locked", source: "Brand kit v4", confirmed: true },
    { id: "c-claim", label: "Approved claim wording", detail: `“${CAMPAIGN.claim}”`, kind: "locked", source: "Brief · legal-cleared", confirmed: false },
    { id: "c-bg", label: "Background & setting", detail: "Any of the three approved territories", kind: "flexible", source: "Brief", confirmed: true },
    { id: "c-light", label: "Lighting", detail: "Warm or dusk light; no cold clinical white", kind: "flexible", source: "Brand kit v4", confirmed: true },
    { id: "c-crop", label: "Crop & framing", detail: "Reframe per placement; product never cropped", kind: "flexible", source: "Placement specs", confirmed: true },
    { id: "c-props", label: "Supporting props", detail: "Plinths, curbs, natural surfaces; no competing footwear", kind: "flexible", source: "Brief", confirmed: true },
    { id: "c-copy", label: "Copy placement", detail: "Top third on portrait; overlay optional on square", kind: "flexible", source: "Placement specs", confirmed: true },
  ];
}

export function initialConcepts(): Concept[] {
  return [
    {
      id: "studio",
      name: "Studio launch",
      territory: "Sculptural clay plinth, hard shaft of sunlight",
      change: "New setting: clay-toned studio set with a graphic light shaft",
      status: "proposed",
      activeVersionId: "studio-v1",
      versions: [
        { id: "studio-v1", n: 1, src: "seed/studio-square.jpg", origin: "seeded", note: "First concept from brief + Ref 01", author: "Concept agent", at: "4:12 PM" },
      ],
    },
    {
      id: "city",
      name: "City commute",
      territory: "Wet curb at blue hour, warm city bokeh",
      change: "New setting: wet city curb at blue hour",
      status: "proposed",
      activeVersionId: "city-v1",
      versions: [
        { id: "city-v1", n: 1, src: "seed/city-square-v1.jpg", origin: "seeded", note: "First concept from brief + Ref 01", author: "Concept agent", at: "4:12 PM" },
      ],
      seededFix: { src: "seed/city-square-v2.jpg", note: "Side panel re-anchored to Ref 02 (pre-generated)" },
    },
    {
      id: "outdoor",
      name: "Weekend outdoors",
      territory: "Granite, golden grass, coastal trail",
      change: "New setting: coastal granite at golden hour",
      status: "proposed",
      activeVersionId: "outdoor-v1",
      versions: [
        { id: "outdoor-v1", n: 1, src: "seed/outdoor-square.jpg", origin: "seeded", note: "First concept from brief + Ref 01", author: "Concept agent", at: "4:12 PM" },
      ],
    },
  ];
}

export function initialIssues(): Issue[] {
  return [
    {
      id: "iss-1",
      conceptId: "city",
      versionId: "city-v1",
      x: 58,
      y: 50,
      category: "Product detail incorrect",
      comment:
        "The side panel has become one solid piece. Preserve the three oval cutouts and cream stitching from Ref 02.",
      refId: "ref-02",
      status: "open",
      author: PEOPLE.designer.name,
      at: "",
    },
  ];
}

export function initialHistory(): HistoryEvent[] {
  return [
    { at: "3:58 PM", actor: PEOPLE.ad.name, text: "Uploaded approved hero (Ref 01) and side-panel detail (Ref 02)", kind: "system" },
    { at: "4:02 PM", actor: "System", text: "Drafted production contract: 5 locked rules, 5 flexible", kind: "system" },
  ];
}

export const ISSUE_CATEGORIES = [
  "Product detail incorrect",
  "Logo / emblem drift",
  "Colorway drift",
  "Composition",
  "Copy-safe area",
];
