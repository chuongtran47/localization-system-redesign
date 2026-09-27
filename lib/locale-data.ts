/**
 * The localization domain model - types and the pure rules over them.
 *
 * This module has no I/O and no browser API in it, on purpose: the mock
 * backend in `src/mock/` imports it directly, so status, key format and group
 * extraction are defined once and the two sides cannot drift. Data itself
 * arrives over HTTP - see `lib/api.ts` for the client and `src/mock/router.ts`
 * for the stand-in backend that answers it.
 */

import type { RowIssue } from "./validation"

export type LanguageCode =
  | "en"
  | "zh-Hans"
  | "ms"
  | "ja"
  | "ko"
  | "ru"
  | "vi"
  | "mn"
  | "es"
  | "ar-SA"
  | "th"
  | "my"
  | "km"

export type Language = {
  code: LanguageCode
  name: string
  rtl?: boolean
}

export const SOURCE_LANGUAGE: LanguageCode = "en"

/**
 * Static for now. The legacy backend served this from `Admin/Languages`; when
 * the real one does too, this becomes a fetch and the rest of the module is
 * unaffected.
 */
export const languages: Language[] = [
  { code: "en", name: "English" },
  { code: "zh-Hans", name: "Chinese (Simplified)" },
  { code: "ms", name: "Malay" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ru", name: "Russian" },
  { code: "vi", name: "Vietnamese" },
  { code: "mn", name: "Mongolian" },
  { code: "es", name: "Spanish" },
  { code: "ar-SA", name: "Arabic", rtl: true },
  { code: "th", name: "Thai" },
  { code: "my", name: "Burmese" },
  { code: "km", name: "Khmer" },
]

/** `{ vi: "Vietnamese", … }` - what a select shows for its value. */
export const languageNames: Record<string, string> = Object.fromEntries(
  languages.map((item) => [item.code, item.name])
)

/** One language file: `{ "group.sub.key": "value", … }`. */
export type LocaleBundle = Record<string, string>

/** `import` - came from the bundle import. `manual` - added in the UI. */
export type KeyOrigin = "import" | "manual"

/**
 * One row, one bucket, first match wins, so the four counts add up to the key
 * total:
 *
 *   `missing`    - nothing usable: the English is empty, or the value is
 *                  absent, empty, or a verbatim copy of the English that nobody
 *                  kept on purpose. A copy counts because bundles are exported
 *                  with English as the fallback (legacy UC-T11).
 *   `outdated`   - the English changed after this value was written.
 *   `needs_fix`  - a portable check flagged it - see `statusIssues`.
 *   `translated` - anything else.
 *
 * English itself is only ever `missing` or `translated`.
 */
export type TranslationStatus =
  | "missing"
  | "outdated"
  | "needs_fix"
  | "translated"

/** What a status is called on screen - badges, chips, counts. */
export const statusLabel: Record<TranslationStatus, string> = {
  missing: "Missing",
  outdated: "Outdated",
  needs_fix: "Needs fix",
  translated: "Translated",
}

/**
 * Who did something, and when - `{ by: "Irene Do", at: "2026-03-02T07:11:00Z" }`.
 *
 * `at` is an ISO 8601 instant; the screen decides how to read it out.
 */
export type AuditStamp = {
  by: string
  at: string
}

/**
 * One value's audit record. `sourceAt` is the English as it read when the
 * value was written, which is what makes `outdated` computable without
 * rewriting twelve files when the English changes. `keepSource` marks a value
 * a translator chose to leave identical to the English.
 */
export type ValueAudit = AuditStamp & {
  sourceAt?: string
  keepSource?: true
}

/** The author recorded for text that arrived with a bundle import. */
export const IMPORT_AUTHOR = "Bundle import"

export type TranslationRow = {
  key: string
  /** First dot-segment of the key. */
  group: string
  source: string
  target: string
  status: TranslationStatus
  /** The value is English on purpose - see `ValueAudit.keepSource`. */
  keptSource: boolean
  origin: KeyOrigin
  /** Who put the key in the registry, and when - the same in every language. */
  created: AuditStamp
  /**
   * Who last wrote *this language's* value, and when. Absent while the value
   * is empty, because nobody has written one yet.
   *
   * Values that came in with the import predate the trail, so they are stamped
   * with the import rather than left blank: "nobody has touched it" and "we
   * have no record" are different answers to a reviewer.
   */
  updated?: AuditStamp
}

export function groupKeyOf(key: string) {
  const dot = key.indexOf(".")
  return dot === -1 ? key : key.slice(0, dot)
}

/**
 * `school_admin/campus_admin.inviteadmin.text`,
 * `invitation-registernew.policy.accept` and `common.link.repOnline` are all
 * real keys in the export, so `/`, `-` and camelCase are allowed - 434 of the
 * 3,339 seeded keys carry a capital, and rejecting them would have meant the
 * app refusing to create or import a name 13% of its own data already uses.
 *
 * A leading dot, an empty segment and a space are still out, and at least one
 * dot is required because the first segment is the group.
 */
export const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_/-]*(\.[A-Za-z0-9_/-]+)+$/

export function isValidKey(key: string) {
  return KEY_PATTERN.test(key)
}

export type StatusInput = {
  source: string
  target: string | undefined
  language: LanguageCode
  audit?: ValueAudit
  /** From `statusIssues`, computed by the caller. */
  issues?: readonly RowIssue[]
}

/** The single definition of status - see `TranslationStatus`. */
export function statusOf({
  source,
  target,
  language,
  audit,
  issues = [],
}: StatusInput): TranslationStatus {
  if (target === undefined || target === "") {
    return "missing"
  }
  if (language === SOURCE_LANGUAGE) {
    return "translated"
  }
  if (source === "") {
    return "missing"
  }
  if (target === source && !audit?.keepSource) {
    return "missing"
  }
  if (audit?.sourceAt !== undefined && audit.sourceAt !== source) {
    return "outdated"
  }
  // A kept value is the English on purpose, so the one check that can still
  // fire on it - "this may still be English" - is the thing it was kept for.
  if (target === source) {
    return "translated"
  }
  // The length ratio is layout advice from a screen profile, not a fact about
  // the value, so it never moves a row into `needs_fix`.
  if (issues.some((issue) => issue.id !== "length")) {
    return "needs_fix"
  }
  return "translated"
}

/**
 * What an editor shows for a value: empty for a missing copy of the English,
 * so an empty field always means "not translated". Display only - the bundle
 * still holds the copy.
 */
export function displayedValueOf(row: {
  status: TranslationStatus
  source: string
  target: string
}): string {
  return row.status === "missing" && row.target === row.source ? "" : row.target
}

export type GroupOption = {
  group: string
  total: number
  outstanding: number
}

export function groupOptionsOf(rows: TranslationRow[]): GroupOption[] {
  const byGroup = new Map<string, GroupOption>()

  for (const row of rows) {
    let option = byGroup.get(row.group)
    if (!option) {
      option = { group: row.group, total: 0, outstanding: 0 }
      byGroup.set(row.group, option)
    }
    option.total += 1
    if (row.status !== "translated") {
      option.outstanding += 1
    }
  }

  return [...byGroup.values()].sort((a, b) => a.group.localeCompare(b.group))
}
