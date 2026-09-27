/**
 * Derivations over `GET /api/coverage`. The counting happens on the server -
 * these are the sums and lookups the dashboard shows on top of it.
 */

import type {
  CoverageResponse,
  LanguageCoverage,
  StatusCounts,
  TargetCoverage,
  TargetLanguageCoverage,
} from "@/lib/api-types"
import type { LanguageCode } from "@/lib/locale-data"

export function coverageOf(
  coverage: CoverageResponse | null,
  code: LanguageCode
): LanguageCoverage | null {
  return coverage?.languages.find((entry) => entry.code === code) ?? null
}

export function percentOf(entry: LanguageCoverage, sourceKeyCount: number) {
  return sourceKeyCount
    ? Math.round((entry.translated / sourceKeyCount) * 100)
    : 0
}

/** Keys that still need somebody: missing, outdated or failing a check. */
export function outstandingOf(counts: StatusCounts) {
  return counts.missing + counts.outdated + counts.needsFix
}

/** Each open bucket summed over every language - the real size of the queue. */
export function statusTotalsOf(coverage: CoverageResponse): StatusCounts {
  return coverage.languages.reduce(
    (sum, entry) => ({
      missing: sum.missing + entry.missing,
      outdated: sum.outdated + entry.outdated,
      needsFix: sum.needsFix + entry.needsFix,
    }),
    { missing: 0, outdated: 0, needsFix: 0 }
  )
}

/** `web/school`'s open keys, or null while loading or for a target with no keys. */
export function targetCoverageOf(
  coverage: CoverageResponse | null,
  target: string
): TargetCoverage | null {
  return coverage?.targets.find((entry) => entry.target === target) ?? null
}

export type Tone = "bad" | "warn" | "good"

export const toneText: Record<Tone, string> = {
  bad: "text-destructive",
  warn: "text-amber-600 dark:text-amber-500",
  good: "text-emerald-600 dark:text-emerald-500",
}

/** Under half translated is behind, under nine in ten is under way. */
export function toneOf(percent: number): Tone {
  return percent < 50 ? "bad" : percent < 90 ? "warn" : "good"
}

/** One project's counts in one language, or null while loading or for a project with no keys. */
export function targetLanguageCoverage(
  coverage: CoverageResponse | null,
  target: string,
  language: LanguageCode
): TargetLanguageCoverage | null {
  return (
    targetCoverageOf(coverage, target)?.languages.find(
      (entry) => entry.code === language
    ) ?? null
  )
}
