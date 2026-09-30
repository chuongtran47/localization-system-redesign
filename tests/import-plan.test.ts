import { describe, expect, it } from "vitest"

import {
  afterImport,
  blockerOf,
  duplicatedLanguages,
  importOrder,
  languageFromName,
  retiredKeys,
  type StagedFile,
} from "@/lib/import-plan"
import type { TranslationRow } from "@/lib/locale-data"

const file = (id: string, language: StagedFile["language"], keys: string[] = []): StagedFile => ({
  id,
  kind: "bundle",
  name: `${id}.json`,
  values: Object.fromEntries(keys.map((key) => [key, key])),
  language,
})

const registry = ["nav.home", "nav.users", "user.name"].map(
  (key): TranslationRow => ({
    key,
    group: key.split(".")[0],
    source: key,
    target: key,
    status: "translated",
    keptSource: false,
    origin: "import",
    created: { by: "T", at: "2026-01-01T00:00:00Z" },
  })
)

describe("languageFromName", () => {
  it.each([
    ["vi.json", "vi"],
    ["school.vi.json", "vi"],
    ["import.vi.json", "vi"],
    ["vi_VN.json", "vi"],
    ["zh-Hans.json", "zh-Hans"],
    ["ZH-HANS.json", "zh-Hans"],
    ["messages.json", null],
    ["import-vi.json", null],
  ])("%s → %s", (name, expected) => {
    expect(languageFromName(name)).toBe(expected)
  })
})

describe("duplicatedLanguages and importOrder", () => {
  it("flags a language claimed by more than one file", () => {
    expect(duplicatedLanguages([file("a", "vi"), file("b", "vi"), file("c", "ja"), file("d", null)])).toEqual(new Set(["vi"]))
  })

  it("puts English first and keeps the rest in order", () => {
    expect(importOrder([file("a", "vi"), file("b", "en"), file("c", "ja")]).map((f) => f.id)).toEqual(["b", "a", "c"])
  })
})

describe("retiredKeys", () => {
  it("retires nothing when merging or before the rows arrive", () => {
    expect(retiredKeys("merge", registry, [file("a", "vi", ["nav.home"])])).toEqual([])
    expect(retiredKeys("replace", undefined, [file("a", "vi", ["nav.home"])])).toEqual([])
  })

  it("retires the keys no file in the batch carries", () => {
    const files = [file("a", "vi", ["nav.home"]), file("b", "ja", ["user.name"])]
    expect(retiredKeys("replace", registry, files)).toEqual(["nav.users"])
  })
})

describe("blockerOf", () => {
  const ready = {
    hasTarget: true,
    fileCount: 2,
    mixed: false,
    unassigned: 0,
    duplicated: 0,
    isLoading: false,
    error: null,
    totalChanges: 3,
  }

  it("refuses a batch that mixes JSON files and sheets", () => {
    expect(blockerOf({ ...ready, mixed: true, unassigned: 1 })).toBe("Import JSON files and sheets separately.")
    expect(blockerOf({ ...ready, mixed: true, fileCount: 0 })).toBe("Add at least one file.")
  })

  it("is null when the batch can be imported", () => {
    expect(blockerOf(ready)).toBeNull()
  })

  it("names the first thing in the way, in order", () => {
    expect(blockerOf({ ...ready, hasTarget: false, fileCount: 0 })).toBe("Choose a project first.")
    expect(blockerOf({ ...ready, fileCount: 0 })).toBe("Add at least one file.")
    expect(blockerOf({ ...ready, unassigned: 1, duplicated: 1 })).toBe("1 file has no language yet.")
    expect(blockerOf({ ...ready, unassigned: 2 })).toBe("2 files have no language yet.")
    expect(blockerOf({ ...ready, duplicated: 1, error: "x" })).toBe(
      "Two files claim the same language - one would overwrite the other."
    )
    expect(blockerOf({ ...ready, error: "x", isLoading: true })).toBe("The project's current values could not be read.")
    expect(blockerOf({ ...ready, isLoading: true, totalChanges: 0 })).toBe("Reading what the project holds today…")
    expect(blockerOf({ ...ready, totalChanges: 0 })).toBe("These files change nothing.")
  })
})

describe("afterImport", () => {
  it("clears drafts and refreshes whenever at least one file landed", () => {
    expect(afterImport({ mode: "merge", succeeded: 2, failed: 0, retired: 0 })).toEqual({
      retire: false,
      clearDrafts: true,
      refresh: true,
    })
    expect(afterImport({ mode: "replace", succeeded: 1, failed: 0, retired: 0 })).toEqual({
      retire: false,
      clearDrafts: true,
      refresh: true,
    })
  })

  it("retires only on a replace where every file landed", () => {
    expect(afterImport({ mode: "replace", succeeded: 2, failed: 0, retired: 3 })).toEqual({
      retire: true,
      clearDrafts: true,
      refresh: true,
    })
    expect(afterImport({ mode: "replace", succeeded: 1, failed: 1, retired: 3 })).toEqual({
      retire: false,
      clearDrafts: true,
      refresh: true,
    })
  })

  it("does nothing when no file landed", () => {
    expect(afterImport({ mode: "replace", succeeded: 0, failed: 2, retired: 3 })).toEqual({
      retire: false,
      clearDrafts: false,
      refresh: false,
    })
  })
})
