import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { BundleFileError, changeCount, diffBundle, parseBundleFile, type BundleDiff } from "@/lib/bundle-diff"
import type { TranslationRow } from "@/lib/locale-data"

const fixture = readFileSync(new URL("./fixtures/import.vi.json", import.meta.url), "utf8")

const row = (key: string, source: string, target: string): TranslationRow => ({
  key,
  group: key.split(".")[0],
  source,
  target,
  status: target ? "translated" : "missing",
  keptSource: false,
  origin: "import",
  created: { by: "T", at: "2026-01-01T00:00:00Z" },
})

const rows = [row("nav.home", "Home", "Trang chủ"), row("nav.users", "Users", "Người dùng"), row("nav.empty", "Empty", "")]
const vi = { language: "vi" as const, lengthBudget: 1.5 }
const kinds = (diff: BundleDiff) => Object.fromEntries(diff.entries.map((entry) => [entry.key, entry.kind]))

describe("parseBundleFile", () => {
  it("flattens nested objects onto dotted keys and keeps flat ones", () => {
    expect(parseBundleFile(fixture)).toEqual({
      "user.form.actions.cancel": "Hủy bỏ",
      "home.brand.fresh": "Mới",
      "bad key.x": "x",
    })
  })

  it("reads numbers, booleans and null as text", () => {
    expect(parseBundleFile('{"a.n": 3, "a.b": true, "a.z": null}')).toEqual({ "a.n": "3", "a.b": "true", "a.z": "" })
  })

  it.each([
    ["{not json", /not valid JSON/],
    ["[1, 2]", /JSON object of key: text pairs/],
    ["{}", /holds no keys/],
    ['{"a.list": [1]}', /"a\.list" holds a list/],
  ])("rejects %s", (text, message) => {
    expect(() => parseBundleFile(text)).toThrow(BundleFileError)
    expect(() => parseBundleFile(text)).toThrow(message)
  })
})

describe("diffBundle", () => {
  it("merge leaves keys the file omits alone", () => {
    const diff = diffBundle(rows, { "nav.home": "Nhà", "nav.empty": "Rỗng" }, { ...vi, mode: "merge" })
    expect(kinds(diff)).toEqual({ "nav.home": "changed", "nav.users": "unchanged", "nav.empty": "added" })
    expect(diff.counts).toEqual({ new: 0, added: 1, changed: 1, removed: 0, unchanged: 1 })
    expect(changeCount(diff.counts)).toBe(2)
  })

  it("replace empties keys the file omits", () => {
    const diff = diffBundle(rows, { "nav.home": "Trang chủ" }, { ...vi, mode: "replace" })
    expect(kinds(diff)).toEqual({ "nav.home": "unchanged", "nav.users": "removed", "nav.empty": "unchanged" })
    expect(diff.entries.find((entry) => entry.key === "nav.users")).toMatchObject({ before: "Người dùng", after: "" })
  })

  it("registers unknown valid keys as new and skips invalid names", () => {
    const diff = diffBundle(rows, { "home.brand.fresh": "Mới", "bad key.x": "x" }, { ...vi, mode: "merge" })
    expect(diff.entries.find((entry) => entry.key === "home.brand.fresh")).toMatchObject({
      kind: "new",
      group: "home",
      before: "",
      after: "Mới",
      source: "",
    })
    expect(diff.invalid).toEqual(["bad key.x"])
    expect(diff.counts.new).toBe(1)

    const english = diffBundle(rows, { "home.brand.fresh": "Fresh" }, { mode: "merge", language: "en", lengthBudget: 1.5 })
    expect(english.entries.find((entry) => entry.key === "home.brand.fresh")?.source).toBe("Fresh")
  })

  it("counts entries whose new value fails a check", () => {
    const long = row(
      "msg.teacher",
      "The teacher {name} is associated with a class. Please remove them first.",
      "Giáo viên {name} có lớp."
    )
    const diff = diffBundle(
      [long],
      { "msg.teacher": "Giáo viên {class} có lớp. Vui lòng xóa trước khi tiếp tục nhé." },
      { ...vi, mode: "merge" }
    )
    expect(diff.errors).toBe(1)
    expect(diff.entries[0].issues[0]).toMatchObject({ id: "placeholder", level: "error" })
  })
})
