import {
  groupOptionsOf,
  languages,
  statusLabel,
  type GroupOption,
  type LanguageCode,
  type TranslationRow,
  type TranslationStatus,
} from "@/lib/locale-data"
import { ALL_VERSIONS, releaseOf, versions } from "@/lib/release"

export type StatusFilter = TranslationStatus | "all" | "new"

export const statusFilters: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "missing", label: statusLabel.missing },
  { id: "outdated", label: statusLabel.outdated },
  { id: "needs_fix", label: statusLabel.needs_fix },
  { id: "translated", label: statusLabel.translated },
  { id: "new", label: "Added here" },
]

export const ALL_GROUPS = "__all__"

export const DEFAULT_LANGUAGE: LanguageCode = "vi"

export type WorkspaceFilters = {
  language: LanguageCode
  group: string
  status: StatusFilter
  version: string
  q: string
}

type ParamReader = { get(name: string): string | null }

/** Invalid values fall back rather than leave the list empty for no visible reason. */
export function parseFilters(params: ParamReader): WorkspaceFilters {
  const lang = params.get("lang")
  const status = params.get("status")
  const version = params.get("version")

  return {
    language: languages.some((item) => item.code === lang) ? (lang as LanguageCode) : DEFAULT_LANGUAGE,
    status: statusFilters.some((item) => item.id === status) ? (status as StatusFilter) : "all",
    version: version && versions.includes(version) ? version : ALL_VERSIONS,
    group: params.get("group") || ALL_GROUPS,
    q: params.get("q") ?? "",
  }
}

/** A group this project does not have means all groups - once the rows are in. */
export function resolveGroup(group: string, rows: TranslationRow[], isLoading: boolean): string {
  if (isLoading || group === ALL_GROUPS || rows.some((row) => row.group === group)) {
    return group
  }
  return ALL_GROUPS
}

export type StatusTotals = {
  total: number
  translated: number
  missing: number
  outdated: number
  needsFix: number
  percent: number
}

export type WorkspaceView = {
  visible: TranslationRow[]
  statusCounts: Record<StatusFilter, number>
  totals: StatusTotals
  groupOptions: GroupOption[]
  hasManual: boolean
}

function totalsOf(rows: TranslationRow[]): StatusTotals {
  const totals = { total: rows.length, translated: 0, missing: 0, outdated: 0, needsFix: 0, percent: 0 }
  for (const row of rows) {
    if (row.status === "needs_fix") {
      totals.needsFix += 1
    } else {
      totals[row.status] += 1
    }
  }
  totals.percent = rows.length ? Math.round((totals.translated / rows.length) * 100) : 0
  return totals
}

const matchesStatus = (row: TranslationRow, status: StatusFilter) =>
  status === "all" ? true : status === "new" ? row.origin === "manual" : row.status === status

/**
 * Everything the workspace counts and shows, from saved rows only. Totals and
 * group options cover the whole language; status pills count after group and
 * version; the visible list applies every filter.
 */
export function viewOf(rows: TranslationRow[], filters: Omit<WorkspaceFilters, "language">): WorkspaceView {
  const scoped = rows.filter(
    (row) =>
      (filters.group === ALL_GROUPS || row.group === filters.group) &&
      (filters.version === ALL_VERSIONS || releaseOf(row.key) === filters.version)
  )

  const statusCounts: Record<StatusFilter, number> = {
    all: scoped.length,
    missing: 0,
    outdated: 0,
    needs_fix: 0,
    translated: 0,
    new: 0,
  }
  for (const row of scoped) {
    statusCounts[row.status] += 1
    if (row.origin === "manual") {
      statusCounts.new += 1
    }
  }

  const needle = filters.q.trim().toLowerCase()
  const visible = scoped.filter(
    (row) =>
      matchesStatus(row, filters.status) &&
      (!needle ||
        row.key.toLowerCase().includes(needle) ||
        row.source.toLowerCase().includes(needle) ||
        row.target.toLowerCase().includes(needle))
  )

  return {
    visible,
    statusCounts,
    totals: totalsOf(rows),
    groupOptions: groupOptionsOf(rows),
    hasManual: rows.some((row) => row.origin === "manual"),
  }
}
