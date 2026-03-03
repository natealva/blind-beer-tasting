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

/**
 * Get a score from a rating for a given criterion id.
 * Tries criteria_scores jsonb first, then falls back to direct taste/crushability columns.
 * Use this for every score read so both new and legacy data work.
 */
export function getScore(rating: Record<string, unknown> | null, criterionId: string): number | null {
  if (!rating) return null;
  if (rating.criteria_scores != null && typeof rating.criteria_scores === "object" && (rating.criteria_scores as Record<string, unknown>)[criterionId] != null) {
    return Number((rating.criteria_scores as Record<string, unknown>)[criterionId]);
  }
  if (criterionId === "taste" && rating.taste != null) return Number(rating.taste);
  if (criterionId === "crushability" && rating.crushability != null) return Number(rating.crushability);
  return null;
}

/** Alias for getScore for backward compatibility. */
export function getCriterionScore(rating: Record<string, unknown> | null, criterionId: string): number | null {
  return getScore(rating, criterionId);
}

/** Calculate overall score as average of all criteria */
export function getOverallScore(rating: Record<string, unknown> | null, criteria: Criterion[]): number {
  if (!rating) return 0;
  const scores = criteria.map((c) => getCriterionScore(rating, c.id)).filter((s): s is number => s != null);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
