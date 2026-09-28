import { languages, type LanguageCode } from "@/lib/locale-data"
import { findProjectByTarget, type Project } from "@/lib/projects"
import {
  ownerPath,
  templateCategories,
  type TemplateCategory,
  type TemplateEntry,
  type TemplateOwner,
} from "@/lib/template-data"
import { DEFAULT_LANGUAGE } from "@/lib/workspace-view"

export const TEMPLATE_ALL = "__all__"

export type TemplateStatusFilter = "all" | "missing" | "outdated" | "needs_fix" | "translated"

const statuses: TemplateStatusFilter[] = ["all", "missing", "outdated", "needs_fix", "translated"]

export type TemplateFilters = {
  language: LanguageCode
  category: TemplateCategory | typeof TEMPLATE_ALL
  owner: string
  status: TemplateStatusFilter
  q: string
  template: string | null
}

type ParamReader = { get(name: string): string | null }

/** Invalid values fall back rather than leave the table empty for no visible reason. */
export function parseTemplateFilters(params: ParamReader): TemplateFilters {
  const lang = params.get("lang")
  const category = params.get("category")
  const status = params.get("status")

  return {
    language: languages.some((item) => item.code === lang) ? (lang as LanguageCode) : DEFAULT_LANGUAGE,
    category: templateCategories.includes(category as TemplateCategory) ? (category as TemplateCategory) : TEMPLATE_ALL,
    owner: params.get("owner") || TEMPLATE_ALL,
    status: statuses.includes(status as TemplateStatusFilter) ? (status as TemplateStatusFilter) : "all",
    q: params.get("q") ?? "",
    template: params.get("template") || null,
  }
}

export const ownerKeyOf = (owner: TemplateOwner) => ownerPath(owner)

/** The seed's owners were named after the reference app's menu; these are this app's projects. */
const ownerTargets: Record<string, string> = {
  "web/school": "web/school-portal",
  "app/parent": "web/parent-portal",
  "app/student": "mobile/student-app",
  "web/training": "web/training-portal",
  "app/baby": "mobile/gs-baby-app",
}

export function ownerProject(owner: TemplateOwner): { label: string; project: Project | null } {
  const target = ownerTargets[ownerKeyOf(owner)]
  const project = target ? findProjectByTarget(target) : null
  if (project) {
    return { label: project.name, project }
  }
  return { label: owner.app.charAt(0).toUpperCase() + owner.app.slice(1), project: null }
}

/** An owner this channel does not send from means all products - once the templates are in. */
export function resolveOwner(owner: string, entries: TemplateEntry[], isLoading: boolean): string {
  if (isLoading || owner === TEMPLATE_ALL || entries.some((entry) => ownerKeyOf(entry.template.owner) === owner)) {
    return owner
  }
  return TEMPLATE_ALL
}

export function ownersOf(entries: TemplateEntry[]): { key: string; label: string }[] {
  const seen = new Map<string, string>()
  for (const entry of entries) {
    seen.set(ownerKeyOf(entry.template.owner), ownerProject(entry.template.owner).label)
  }
  return [...seen].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label))
}

/** Categories present in `entries`, in schema order, counted on `counted`. */
export function categoriesOf(
  entries: TemplateEntry[],
  counted: TemplateEntry[] = entries
): { category: TemplateCategory; count: number }[] {
  const present = new Set(entries.map((entry) => entry.template.category))
  return templateCategories
    .filter((category) => present.has(category))
    .map((category) => ({ category, count: counted.filter((entry) => entry.template.category === category).length }))
}

export function matchesStatus(entry: TemplateEntry, status: TemplateStatusFilter): boolean {
  switch (status) {
    case "missing":
      return entry.missing > 0 || entry.outdated > 0
    case "outdated":
      return entry.outdated > 0
    case "needs_fix":
      return entry.needsFix > 0
    case "translated":
      return entry.translated === entry.total
    default:
      return true
  }
}

export type TemplateNarrowing = Pick<TemplateFilters, "category" | "owner" | "status" | "q">

export function filterTemplates(entries: TemplateEntry[], { category, owner, status, q }: TemplateNarrowing) {
  const needle = q.trim().toLowerCase()
  return entries.filter(
    (entry) =>
      (category === TEMPLATE_ALL || entry.template.category === category) &&
      (owner === TEMPLATE_ALL || ownerKeyOf(entry.template.owner) === owner) &&
      matchesStatus(entry, status) &&
      (!needle ||
        [
          entry.template.name,
          entry.template.id,
          entry.template.createdBy,
          ...entry.fields.flatMap((field) => [field.source, field.target]),
        ].some((text) => text.toLowerCase().includes(needle)))
  )
}

export type TemplateTotals = {
  templates: number
  fields: number
  translated: number
  missing: number
  outdated: number
  needsFix: number
  percent: number
}

export function summarise(entries: TemplateEntry[]): TemplateTotals {
  const totals = { templates: entries.length, fields: 0, translated: 0, missing: 0, outdated: 0, needsFix: 0, percent: 0 }
  for (const entry of entries) {
    totals.fields += entry.total
    totals.translated += entry.translated
    totals.missing += entry.missing
    totals.outdated += entry.outdated
    totals.needsFix += entry.needsFix
  }
  totals.percent = totals.fields ? Math.round((totals.translated / totals.fields) * 100) : 0
  return totals
}
