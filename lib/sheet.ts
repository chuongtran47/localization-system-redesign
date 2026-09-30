/**
 * A project's strings as a sheet: the rows an Excel or CSV export holds, and
 * how a filled-in sheet becomes a save. The file formats live in `csv.ts` and
 * `xlsx.ts`, which know nothing about keys.
 *
 * See docs/superpowers/specs/2026-09-30-sheet-import-export-design.md.
 */

import type { SheetRows } from "@/lib/api-types"
import type { BundleDiff, DiffCounts, DiffEntry, DiffKind } from "@/lib/bundle-diff"
import { CsvError, readCsv } from "@/lib/csv"
import {
  displayedValueOf,
  languageNames,
  languages,
  sameSource,
  SOURCE_LANGUAGE,
  statusLabel,
  type LanguageCode,
  type TranslationRow,
  type TranslationStatus,
} from "@/lib/locale-data"
import type { Project } from "@/lib/projects"
import { fieldsOf, templateKeyOf, type TemplateChannel, type TemplateEntry } from "@/lib/template-data"
import { checkTranslation } from "@/lib/validation"
import { readXlsx, XlsxError } from "@/lib/xlsx"
import { ZipError, type Bytes } from "@/lib/zip"

export class SheetFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SheetFileError"
  }
}

/** A sheet of a few thousand rows is well under 1 MB; the same cap as the zip reader's. */
export const MAX_SHEET_BYTES = 10 * 1024 * 1024

/** "Strings to translate": what still needs somebody. */
export const TODO_STATUSES: readonly TranslationStatus[] = ["missing", "outdated", "needs_fix"]

export type SheetRow = { key: string; english: string; translation: string }
export type ParsedSheet = { language: LanguageCode; rows: SheetRow[] }

/** The checks one key runs - the same source the store computes status from. */
export type CheckRules = { lengthBudget: number; maxLength?: number; format: "text" | "html" }

export type SheetPlan = {
  /** Written with `saveTranslations`. */
  values: Record<string, string>
  /** Saved as Keep English. */
  keepKeys: string[]
  /** The English each written key was translated from, for the server to check again. */
  sources: Record<string, string>
  skipped: { duplicate: number; unknown: number; empty: number; englishChanged: number }
}

export const isTemplateProject = (project: Project) => project.profile.kind !== "ui"

export const translationHeader = (code: LanguageCode) => `${languageNames[code]} (${code})`

const lineEnds = (text: string) => text.replaceAll("\r\n", "\n")

/* ------------------------------------------------------------------ writing */

export function sheetGridOf({
  project,
  language,
  rows,
  templates,
  scope,
}: {
  project: Project
  language: LanguageCode
  rows: TranslationRow[]
  templates?: TemplateEntry[]
  scope: SheetRows
}): string[][] {
  const wanted = (status: TranslationStatus) => scope === "all" || TODO_STATUSES.includes(status)

  if (isTemplateProject(project)) {
    const labels = new Map(fieldsOf(project.profile.kind as TemplateChannel).map((field) => [field.id, field.label]))
    const grid = [["Key", "Template", "Field", "English", translationHeader(language), "Status"]]
    for (const entry of templates ?? []) {
      for (const field of entry.fields) {
        if (wanted(field.status)) {
          grid.push([
            templateKeyOf(entry.template.id, field.field),
            entry.template.name,
            labels.get(field.field) ?? field.field,
            lineEnds(field.source),
            lineEnds(displayedValueOf(field)),
            statusLabel[field.status],
          ])
        }
      }
    }
    return grid
  }

  const grid = [["Key", "English", translationHeader(language), "Status"]]
  for (const row of rows) {
    if (wanted(row.status)) {
      grid.push([row.key, lineEnds(row.source), lineEnds(displayedValueOf(row)), statusLabel[row.status]])
    }
  }
  return grid
}

export const sheetWidthsOf = (project: Project) =>
  isTemplateProject(project) ? [40, 28, 14, 60, 60, 14] : [40, 60, 60, 14]

/* ------------------------------------------------------------------ reading */

function codeOf(header: string): LanguageCode | null {
  const match = /\(([A-Za-z-]+)\)\s*$/.exec(header.trim())
  if (!match) {
    return null
  }
  return languages.find((item) => item.code.toLowerCase() === match[1].toLowerCase())?.code ?? null
}

/** Columns by header, case and surrounding space ignored; the language only from the translation column. */
export function parseSheet(grid: string[][]): ParsedSheet {
  const [header = [], ...body] = grid
  const names = header.map((cell) => cell.trim().toLowerCase())
  const keyAt = names.indexOf("key")
  if (keyAt < 0) {
    throw new SheetFileError("No Key column")
  }
  const englishAt = names.indexOf("english")
  if (englishAt < 0) {
    throw new SheetFileError("No English column")
  }
  const translations = header
    .map((cell, index) => ({ index, code: codeOf(cell) }))
    .filter((item): item is { index: number; code: LanguageCode } => item.code !== null)
  if (translations.length === 0) {
    throw new SheetFileError('No translation column (a header like "Vietnamese (vi)")')
  }
  if (translations.length > 1) {
    throw new SheetFileError("More than one translation column")
  }
  const [{ index: translationAt, code: language }] = translations
  if (language === SOURCE_LANGUAGE) {
    throw new SheetFileError("Sheets carry translations; English is not imported from a sheet")
  }

  const rows = body
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map((cells) => ({
      key: (cells[keyAt] ?? "").trim(),
      english: cells[englishAt] ?? "",
      translation: lineEnds(cells[translationAt] ?? ""),
    }))
  if (rows.length === 0) {
    throw new SheetFileError("The sheet has no rows")
  }
  return { language, rows }
}

export const isSheetFileName = (name: string) => /\.(xlsx|csv|xls)$/i.test(name)

/** A dropped file to a sheet, with the reason in the words the wizard shows. */
export async function readSheetFile({ name, bytes }: { name: string; bytes: Bytes }): Promise<ParsedSheet> {
  const lower = name.toLowerCase()
  if (lower.endsWith(".xls")) {
    throw new SheetFileError("Save it as .xlsx and try again")
  }
  if (bytes.length > MAX_SHEET_BYTES) {
    throw new SheetFileError("That file is larger than 10 MB")
  }

  if (lower.endsWith(".csv")) {
    let text: string
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
      throw new SheetFileError('Save it as "CSV UTF-8" and try again')
    }
    let sheet: ParsedSheet
    try {
      sheet = parseSheet(readCsv(text))
    } catch (cause: unknown) {
      throw cause instanceof CsvError ? new SheetFileError(cause.message) : cause
    }
    // Excel's "CSV (Comma delimited)" drops the BOM and writes "?" for every
    // character its code page lacks - which leaves valid, all-ASCII UTF-8. The
    // app's own files and Excel's "CSV UTF-8" keep the BOM; a UTF-8 file from
    // elsewhere carries its non-ASCII text. A "?" the English does not have,
    // in a file with neither, is the code page talking.
    const asciiOnly = !/[^\x00-\x7F]/.test(text)
    if (
      !text.startsWith("\uFEFF") &&
      asciiOnly &&
      sheet.rows.some((row) => row.translation.includes("?") && !row.english.includes("?"))
    ) {
      throw new SheetFileError('Save it as "CSV UTF-8" and try again')
    }
    return sheet
  }

  let grid: string[][]
  try {
    grid = await readXlsx(bytes)
  } catch (cause: unknown) {
    if (cause instanceof ZipError && cause.reason === "limit") {
      throw new SheetFileError("That workbook is too large to import")
    }
    if (cause instanceof ZipError || cause instanceof XlsxError) {
      throw new SheetFileError("That file is not a readable Excel workbook")
    }
    throw cause
  }
  return parseSheet(grid)
}

/* ------------------------------------------------------------------ planning */

export function checkRulesOf(project: Project, key: string): CheckRules {
  const base: CheckRules = {
    lengthBudget: project.profile.lengthBudget,
    maxLength: project.profile.maxLength,
    format: "text",
  }
  if (!isTemplateProject(project)) {
    return base
  }
  const fieldId = key.slice(key.lastIndexOf(".") + 1)
  const field = fieldsOf(project.profile.kind as TemplateChannel).find((item) => item.id === fieldId)
  return field ? { lengthBudget: project.profile.lengthBudget, maxLength: field.maxLength, format: field.format } : base
}

/**
 * Spec §3.4, compared with what the screen shows (`displayedValueOf`), not the
 * raw bundle value: a missing copy of the English reads as empty there too.
 * Order: a repeated key, a key the project lacks, an empty cell, an English
 * that moved on - the first row of a key always wins.
 */
export function planSheet(sheet: ParsedSheet, rows: TranslationRow[]): SheetPlan {
  const byKey = new Map(rows.map((row) => [row.key, row]))
  const seen = new Set<string>()
  const plan: SheetPlan = {
    values: {},
    keepKeys: [],
    sources: {},
    skipped: { duplicate: 0, unknown: 0, empty: 0, englishChanged: 0 },
  }

  for (const item of sheet.rows) {
    if (seen.has(item.key)) {
      plan.skipped.duplicate += 1
      continue
    }
    seen.add(item.key)
    const row = byKey.get(item.key)
    if (!row) {
      plan.skipped.unknown += 1
      continue
    }
    if (item.translation.trim() === "") {
      plan.skipped.empty += 1
      continue
    }
    if (!sameSource(item.english, row.source)) {
      plan.skipped.englishChanged += 1
      continue
    }
    if (sameSource(item.translation, row.source)) {
      const alreadyKept = row.keptSource && row.status !== "outdated" && sameSource(row.target, row.source)
      if (!alreadyKept) {
        plan.keepKeys.push(row.key)
        plan.sources[row.key] = row.source
      }
      continue
    }
    if (item.translation !== lineEnds(displayedValueOf(row))) {
      plan.values[row.key] = item.translation
      plan.sources[row.key] = row.source
    }
  }
  return plan
}

/** The preview of a plan, in the shape the diff view already renders. */
export function diffSheet(
  rows: TranslationRow[],
  plan: SheetPlan,
  { language, rulesOf }: { language: LanguageCode; rulesOf: (key: string) => CheckRules }
): BundleDiff {
  const counts: DiffCounts = { new: 0, added: 0, changed: 0, removed: 0, unchanged: 0 }
  const keeps = new Set(plan.keepKeys)
  const entries: DiffEntry[] = []
  let errors = 0

  for (const row of rows) {
    const before = displayedValueOf(row)
    const isKeep = keeps.has(row.key)
    const after = isKeep ? row.source : Object.hasOwn(plan.values, row.key) ? plan.values[row.key] : before
    const kind: DiffKind = !isKeep && after === before ? "unchanged" : before === "" ? "added" : "changed"
    counts[kind] += 1

    const issues =
      kind !== "unchanged" && !isKeep ? checkTranslation(row.source, after, { language, ...rulesOf(row.key) }) : []
    if (issues.some((issue) => issue.level === "error")) {
      errors += 1
    }
    entries.push({
      key: row.key,
      group: row.group,
      kind,
      before,
      after,
      source: row.source,
      issues,
      ...(isKeep ? { keep: true as const } : {}),
    })
  }
  return { entries, counts, invalid: [], errors }
}

export function skippedSummary(skipped: SheetPlan["skipped"], projectName: string): string | null {
  const parts = [
    skipped.unknown > 0 && `${skipped.unknown} not in ${projectName}`,
    skipped.englishChanged > 0 && `${skipped.englishChanged} English changed since download`,
    skipped.empty > 0 && `${skipped.empty} empty`,
    skipped.duplicate > 0 && `${skipped.duplicate} duplicate`,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(" · ") : null
}
