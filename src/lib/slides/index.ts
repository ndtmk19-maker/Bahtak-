// واجهة نظام العروض: نص (مسودة أو مولَّد) ← تحليل بنيوي مشترك ← شرائح ← تخطيط ← PPTX
import { analyzeResearchText } from "../parser";
import { DEFAULT_DECK_OPTIONS, planDeck } from "./planner";
import type { CoverMeta, DeckOptions, SlideDeck } from "./types";

export function buildDeckFromText(
  raw: string,
  meta: CoverMeta,
  opts: DeckOptions = DEFAULT_DECK_OPTIONS,
): SlideDeck {
  return planDeck(analyzeResearchText(raw), meta, opts);
}

export * from "./types";
export { DEFAULT_DECK_OPTIONS } from "./planner";
export { layoutDeck, type LaidSlide, type Prim, type TPara } from "./layout";
export { SLIDE_THEMES, DEFAULT_THEME_ID, getTheme, suggestTheme, type SlideTheme } from "./themes";
export { SLIDE_W, SLIDE_H } from "./metrics";
