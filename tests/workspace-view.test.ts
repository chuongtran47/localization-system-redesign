import { describe, expect, it } from "vitest"

import type { TranslationRow } from "@/lib/locale-data"
import { ALL_VERSIONS, releaseOf } from "@/lib/release"
import { ALL_GROUPS, parseFilters, resolveGroup, viewOf } from "@/lib/workspace-view"

const row = (key: string, status: TranslationRow["status"], extra: Partial<TranslationRow> = {}): TranslationRow => ({
  key,
  group: key.split(".")[0],
  source: `${key} source`,
  target: status === "missing" ? "" : `${key} target`,
  status,
  keptSource: false,
  origin: "import",
  created: { by: "T", at: "2026-01-01T00:00:00Z" },
  ...extra,
})

const rows = [
  row("nav.home", "translated"),
  row("nav.users", "missing"),
  row("nav.admin", "outdated"),
  row("user.name", "needs_fix"),
  row("user.email", "translated", { origin: "manual" }),
]

const filters = { group: ALL_GROUPS, status: "all" as const, version: ALL_VERSIONS, q: "" }

describe("parseFilters", () => {
  it("falls back for values that are not valid", () => {
    expect(parseFilters(new URLSearchParams("lang=xx&status=bogus&version=v99&group=nav&q=hi"))).toEqual({
      language: "vi",
      status: "all",
      version: ALL_VERSIONS,
      group: "nav",
      q: "hi",
    })
  })

  it("keeps valid values, including a q with slashes and spaces", () => {
    const params = new URLSearchParams()
    params.set("lang", "ar-SA")
    params.set("status", "needs_fix")
    params.set("version", "v12")
    params.set("q", "school_admin/campus invite")
    expect(parseFilters(params)).toEqual({
      language: "ar-SA",
      status: "needs_fix",
      version: "v12",
      group: ALL_GROUPS,
      q: "school_admin/campus invite",
    })
  })
})

describe("resolveGroup", () => {
  it("falls back to all groups for a group this project does not have", () => {
    expect(resolveGroup("billing", rows, false)).toBe(ALL_GROUPS)
    expect(resolveGroup("nav", rows, false)).toBe("nav")
  })

  it("leaves the group alone while rows are loading", () => {
    expect(resolveGroup("billing", [], true)).toBe("billing")
  })
})

describe("viewOf", () => {
  it("counts totals on every row, whatever the filters", () => {
    const view = viewOf(rows, { ...filters, group: "nav", q: "home" })
    expect(view.totals).toEqual({ total: 5, translated: 2, missing: 1, outdated: 1, needsFix: 1, percent: 40 })
  })

  it("counts status pills after group and version but before status and search", () => {
    const view = viewOf(rows, { ...filters, group: "nav", status: "missing", q: "zzz" })
    expect(view.statusCounts).toEqual({ all: 3, missing: 1, outdated: 1, needs_fix: 0, translated: 1, new: 0 })
    expect(view.visible).toEqual([])
  })

  it("narrows visible rows by status, search and the manual-origin filter", () => {
    expect(viewOf(rows, { ...filters, status: "missing" }).visible.map((r) => r.key)).toEqual(["nav.users"])
    expect(viewOf(rows, { ...filters, q: "EMAIL" }).visible.map((r) => r.key)).toEqual(["user.email"])
    expect(viewOf(rows, { ...filters, status: "new" }).visible.map((r) => r.key)).toEqual(["user.email"])
    expect(viewOf(rows, filters).hasManual).toBe(true)
  })

  it("filters by release version", () => {
    const version = rows.map((r) => releaseOf(r.key)).find((value) => value !== null)
    if (!version) {
      throw new Error("fixture needs at least one assigned key")
    }
    const visible = viewOf(rows, { ...filters, version }).visible
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.every((r) => releaseOf(r.key) === version)).toBe(true)
  })

  it("reports outstanding per group as missing + outdated + needs_fix", () => {
    expect(viewOf(rows, filters).groupOptions).toEqual([
      { group: "nav", total: 3, outstanding: 2 },
      { group: "user", total: 2, outstanding: 1 },
    ])
  })
})
