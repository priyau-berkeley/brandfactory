// Shared prompt builder so the art director sees the exact instruction the server sends to Luma.
export function buildEditPrompt(
  mode: "fix_detail" | "change_background",
  opts: { comment?: string; background?: string; preserve: string[] },
) {
  const preserve = opts.preserve.length ? opts.preserve.join("; ") : "the product exactly as shown";
  if (mode === "fix_detail") {
    return [
      "Correct one product detail on the sneaker in the source image.",
      `Reviewer note: ${opts.comment || "restore the product detail to match the reference"}.`,
      "Use the first reference image as the authoritative close-up of the side panel: a terracotta suede panel with exactly three oval cutouts in a row, each outlined with fine cream contrast stitching, bone-white knit visible through the cutouts.",
      "Use the second reference image as the approved product.",
      `Keep everything else unchanged: ${preserve}; the background, lighting, camera angle, and composition.`,
      "No text, no added logos.",
    ].join(" ");
  }
  return [
    `Replace only the background and setting with: ${opts.background || "a new setting consistent with the campaign"}.`,
    `Keep the sneaker identical to the reference images: ${preserve}.`,
    "Match lighting on the product to the new setting without changing its colors or construction. No text, no added logos.",
  ].join(" ");
}
