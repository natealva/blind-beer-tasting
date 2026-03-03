import type { Criterion } from "@/lib/types";

export const DEFAULT_CRITERIA: Criterion[] = [
  { id: "taste", label: "Taste", emoji: "👅" },
  { id: "crushability", label: "Crushability", emoji: "🍺" },
];

/** Get criteria from session, falling back to defaults */
export function getCriteria(session: { criteria?: unknown } | null): Criterion[] {
  if (session?.criteria && Array.isArray(session.criteria) && session.criteria.length > 0) {
    return session.criteria as Criterion[];
  }
  return DEFAULT_CRITERIA;
}

/** Get a score from a rating for a given criterion id. Handles criteria_scores jsonb and legacy taste/crushability columns. */
export function getCriterionScore(rating: Record<string, unknown> | null, criterionId: string): number | null {
  if (!rating) return null;
  const scores = rating.criteria_scores as Record<string, number> | undefined;
  if (scores && scores[criterionId] != null) return scores[criterionId];
  if (criterionId === "taste") return (rating.taste as number | null) ?? null;
  if (criterionId === "crushability") return (rating.crushability as number | null) ?? null;
  return null;
}

/** Calculate overall score as average of all criteria */
export function getOverallScore(rating: Record<string, unknown> | null, criteria: Criterion[]): number {
  if (!rating) return 0;
  const scores = criteria.map((c) => getCriterionScore(rating, c.id)).filter((s): s is number => s != null);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
