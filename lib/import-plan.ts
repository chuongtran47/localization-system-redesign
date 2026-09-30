import type { ImportMode } from "@/lib/api-types"
import {
  languages,
  SOURCE_LANGUAGE,
  type LanguageCode,
  type LocaleBundle,
  type TranslationRow,
} from "@/lib/locale-data"
import type { ParsedSheet } from "@/lib/sheet"

/** A file that parsed, waiting for a language and a reviewer. */
export type StagedFile = {
  id: string
  /** A JSON bundle, or an Excel/CSV sheet - see `lib/sheet.ts`. A batch holds one kind. */
  kind: "bundle" | "sheet"
  name: string
  values: LocaleBundle
  /** Null until somebody says which language it is - never guessed silently. */
  language: LanguageCode | null
  /** The parsed sheet; its language is already `language`. Absent for a bundle. */
  sheet?: ParsedSheet
}

/**
 * A file named after a language is usually meant for it; a name that does not
 * name one is left unassigned rather than guessed at. `.` and `_` split, `-`
 * does not: `zh-Hans` is a code, `vi_VN` a code and a region.
 */
export function languageFromName(name: string): LanguageCode | null {
  const base = name.replace(/\.json$/i, "")
  const candidates = new Set([base, ...base.split(/[._]/)].map((part) => part.trim().toLowerCase()))
  return languages.find((item) => candidates.has(item.code.toLowerCase()))?.code ?? null
}

/** Two files aimed at one language would write the same file twice. */
export function duplicatedLanguages(files: StagedFile[]): Set<LanguageCode> {
  const seen = new Map<LanguageCode, number>()
  for (const file of files) {
    if (file.language) {
      seen.set(file.language, (seen.get(file.language) ?? 0) + 1)
    }
  }
  return new Set([...seen].filter(([, times]) => times > 1).map(([code]) => code))
}

/**
 * The keys a replace retires: the ones no file in the batch carries. Across
 * the batch, not per file - one language file cannot say which keys a project
 * has, a whole delivery can. Any language's rows will do for the registry.
 */
export function retiredKeys(mode: ImportMode, registry: TranslationRow[] | undefined, files: StagedFile[]): string[] {
  if (mode !== "replace" || !registry) {
    return []
  }
  const carried = new Set(files.flatMap((file) => Object.keys(file.values)))
  return registry.map((row) => row.key).filter((key) => !carried.has(key))
}

/** English first: the translations are stamped against the English they were written for. */
export function importOrder(files: StagedFile[]): StagedFile[] {
  return [...files].sort(
    (a, b) => Number(b.language === SOURCE_LANGUAGE) - Number(a.language === SOURCE_LANGUAGE)
  )
}

export type BlockerState = {
  hasTarget: boolean
  fileCount: number
  mixed: boolean
  unassigned: number
  duplicated: number
  isLoading: boolean
  error: string | null
  totalChanges: number
}

/** The one sentence saying why Confirm is off, or null when it is on. */
export function blockerOf(state: BlockerState): string | null {
  if (!state.hasTarget) {
    return "Choose a project first."
  }
  if (state.fileCount === 0) {
    return "Add at least one file."
  }
  if (state.mixed) {
    return "Import JSON files and sheets separately."
  }
  if (state.unassigned > 0) {
    return `${state.unassigned} ${state.unassigned === 1 ? "file has" : "files have"} no language yet.`
  }
  if (state.duplicated > 0) {
    return "Two files claim the same language - one would overwrite the other."
  }
  if (state.error) {
    return "The project's current values could not be read."
  }
  if (state.isLoading) {
    return "Reading what the project holds today…"
  }
  if (state.totalChanges === 0) {
    return "These files change nothing."
  }
  return null
}

/**
 * What follows a batch. Data changed as soon as one file landed, so drafts and
 * the coverage refresh follow that; retiring is an extra step for a replace
 * where every file landed.
 */
export function afterImport({
  mode,
  succeeded,
  failed,
  retired,
}: {
  mode: ImportMode
  succeeded: number
  failed: number
  retired: number
}): { retire: boolean; clearDrafts: boolean; refresh: boolean } {
  const landed = succeeded > 0
  return {
    retire: mode === "replace" && retired > 0 && failed === 0 && landed,
    clearDrafts: landed,
    refresh: landed,
  }
}
