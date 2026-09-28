import { describe, expect, it } from "vitest"

import type { DiffEntry, DiffKind } from "@/lib/bundle-diff"
import { flattenGroups, groupsOf, numberEntries, pinnedHeader } from "@/lib/diff-groups"

const entry = (key: string, kind: DiffKind, before: string, after: string, failing = false): DiffEntry => ({
  key,
  group: key.split(".")[0],
  kind,
  before,
  after,
  source: key,
  issues: failing ? [{ id: "placeholder", level: "error", message: "x" }] : [],
})

const entries = [
  entry("nav.a", "changed", "A", "A2"),
  entry("nav.b", "unchanged", "B", "B"),
  entry("nav.c", "added", "", "C", true),
  entry("user.a", "removed", "U", ""),
  entry("user.b", "new", "", "N"),
]

describe("groupsOf", () => {
  it("keeps the changes by default and counts them the way git does", () => {
    const groups = groupsOf(entries, "changes")
    expect(groups.map((g) => [g.name, g.entries.length, g.additions, g.deletions, g.errors])).toEqual([
      ["nav", 2, 2, 1, 1],
      ["user", 2, 1, 1, 0],
    ])
  })

  it("narrows to one kind", () => {
    expect(groupsOf(entries, "unchanged").map((g) => g.entries.map((e) => e.key))).toEqual([["nav.b"]])
    expect(groupsOf(entries, "unchanged")[0]).toMatchObject({ additions: 0, deletions: 0 })
  })
})

describe("numberEntries", () => {
  it("numbers each side per group and leaves an empty side unnumbered", () => {
    expect(Object.fromEntries(numberEntries(entries))).toEqual({
      "nav.a": { before: 1, after: 1 },
      "nav.b": { before: 2, after: 2 },
      "nav.c": { before: null, after: 3 },
      "user.a": { before: 1, after: null },
      "user.b": { before: null, after: 1 },
    })
  })
})

describe("flattenGroups and pinnedHeader", () => {
  const groups = groupsOf(entries, "changes")

  it("drops the hunks of a collapsed group but keeps its header", () => {
    expect(flattenGroups(groups, new Set(["nav"])).map((r) => r.type)).toEqual(["header", "header", "hunk", "hunk"])
  })

  it("pins the header of the group under the top edge, only once it has scrolled away", () => {
    const rows = flattenGroups(groups, new Set())
    expect(pinnedHeader(rows, [{ index: 0, start: 0, end: 41 }], 0)).toBeNull()
    expect(pinnedHeader(rows, [{ index: 1, start: 41, end: 145 }], 50)?.name).toBe("nav")
    expect(pinnedHeader(rows, [{ index: 3, start: 300, end: 341 }], 300)).toBeNull()
    expect(pinnedHeader(rows, [{ index: 4, start: 341, end: 445 }], 350)?.name).toBe("user")
  })

  it("reads the group at the top edge, not the first overscan row above it", () => {
    const rows = flattenGroups(groups, new Set())
    // Every row rendered, the way the virtualizer's overscan hands them over:
    // headers 41px, hunks 104px.
    const items = [
      { index: 0, start: 0, end: 41 },
      { index: 1, start: 41, end: 145 },
      { index: 2, start: 145, end: 249 },
      { index: 3, start: 249, end: 290 },
      { index: 4, start: 290, end: 394 },
      { index: 5, start: 394, end: 498 },
    ]
    expect(pinnedHeader(rows, items, 300)?.name).toBe("user")
    expect(pinnedHeader(rows, items, 260)?.name).toBe("user")
    expect(pinnedHeader(rows, items, 150)?.name).toBe("nav")
  })
})
