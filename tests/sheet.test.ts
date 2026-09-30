import { describe, expect, it } from "vitest"

import { changeCount } from "@/lib/bundle-diff"
import { writeCsv } from "@/lib/csv"
import type { TranslationRow } from "@/lib/locale-data"
import { findProject } from "@/lib/projects"
import {
  checkRulesOf,
  diffSheet,
  parseSheet,
  planSheet,
  readSheetFile,
  sheetGridOf,
  SheetFileError,
  skippedSummary,
  type ParsedSheet,
} from "@/lib/sheet"
import { fieldOf, type TemplateEntry } from "@/lib/template-data"
import type { Bytes } from "@/lib/zip"

const school = findProject("web", "school-portal")!
const email = findProject("messages", "email")!

const row = (key: string, extra: Partial<TranslationRow> = {}): TranslationRow => ({
  key,
  group: key.split(".")[0],
  source: `${key} English`,
  target: `${key} vi`,
  status: "translated",
  keptSource: false,
  origin: "import",
  created: { by: "T", at: "2026-01-01T00:00:00Z" },
  ...extra,
})

const bytesOf = (text: string) => new TextEncoder().encode(text) as Bytes

describe("sheetGridOf", () => {
  const rows = [
    row("nav.home"),
    row("nav.users", { status: "missing", target: "nav.users English" }),
    row("nav.admin", { status: "outdated" }),
    row("user.name", { status: "needs_fix", target: "Tên {x}" }),
  ]

  it("holds the strings to translate, a missing copy of the English as an empty cell", () => {
    expect(sheetGridOf({ project: school, language: "vi", rows, scope: "todo" })).toEqual([
      ["Key", "English", "Vietnamese (vi)", "Status"],
      ["nav.users", "nav.users English", "", "Missing"],
      ["nav.admin", "nav.admin English", "nav.admin vi", "Outdated"],
      ["user.name", "user.name English", "Tên {x}", "Needs fix"],
    ])
    expect(sheetGridOf({ project: school, language: "vi", rows, scope: "all" })).toHaveLength(5)
  })

  it("adds the template and field columns for a message channel", () => {
    const templates: TemplateEntry[] = [
      {
        template: {
          id: "invite_coach",
          name: "Coach invitation",
          channel: "email",
          category: "coach",
          target: "messages/email",
          owner: { kind: "web", app: "school" },
          createdBy: "T",
          createdAt: "2026-01-01T00:00:00Z",
        },
        fields: [
          { field: "subject", source: "Welcome", target: "Chào", status: "translated", keptSource: false },
          { field: "body", source: "<p>Hi</p>", target: "", status: "missing", keptSource: false },
        ],
        total: 2,
        translated: 1,
        missing: 1,
        outdated: 0,
        needsFix: 0,
      },
    ]
    expect(sheetGridOf({ project: email, language: "ja", rows: [], templates, scope: "todo" })).toEqual([
      ["Key", "Template", "Field", "English", "Japanese (ja)", "Status"],
      ["invite_coach.body", "Coach invitation", "Body", "<p>Hi</p>", "", "Missing"],
    ])
  })
})

describe("parseSheet", () => {
  it("finds the columns by their headers, in any order, next to columns of its own", () => {
    const sheet = parseSheet([
      ["Notes", "arabic (AR-sa)", "Status", "english", " Key "],
      ["mine", "مرحبا", "Missing", "Hello", "nav.hello"],
      ["", "", "", "", ""],
    ])
    expect(sheet).toEqual({ language: "ar-SA", rows: [{ key: "nav.hello", english: "Hello", translation: "مرحبا" }] })
  })

  it("names what is missing", () => {
    expect(() => parseSheet([["English", "Vietnamese (vi)"], ["a", "b"]])).toThrow("No Key column")
    expect(() => parseSheet([["Key", "Vietnamese (vi)"], ["a", "b"]])).toThrow("No English column")
    expect(() => parseSheet([["Key", "English", "Vietnamese"], ["a", "b", "c"]])).toThrow(
      'No translation column (a header like "Vietnamese (vi)")'
    )
    expect(() => parseSheet([["Key", "English", "Vietnamese (vi)", "Japanese (ja)"], ["a", "b", "c", "d"]])).toThrow(
      "More than one translation column"
    )
    expect(() => parseSheet([["Key", "English", "English (en)"], ["a", "b", "c"]])).toThrow(
      "Sheets carry translations; English is not imported from a sheet"
    )
    expect(() => parseSheet([["Key", "English", "Vietnamese (vi)"]])).toThrow("The sheet has no rows")
  })
})

describe("readSheetFile", () => {
  it("reads a CSV and refuses what it cannot read", async () => {
    const csv = writeCsv([["Key", "English", "Vietnamese (vi)"], ["nav.home", "Home", "Trang chủ"]])
    expect((await readSheetFile({ name: "school-portal.vi.csv", bytes: bytesOf(csv) })).rows).toEqual([
      { key: "nav.home", english: "Home", translation: "Trang chủ" },
    ])
    await expect(readSheetFile({ name: "old.xls", bytes: bytesOf("x") })).rejects.toThrow("Save it as .xlsx and try again")
    await expect(readSheetFile({ name: "a.xlsx", bytes: bytesOf("not a zip") })).rejects.toThrow(
      "That file is not a readable Excel workbook"
    )
    await expect(
      readSheetFile({ name: "big.csv", bytes: new Uint8Array(10 * 1024 * 1024 + 1) as Bytes })
    ).rejects.toThrow("That file is larger than 10 MB")
  })

  it("refuses a CSV that Excel saved in a Windows code page rather than UTF-8", async () => {
    // "Trang chủ" through Windows-1258 leaves bytes that are not valid UTF-8.
    const legacy = new Uint8Array([...bytesOf("Key,English,Vietnamese (vi)\r\nnav.home,Home,Trang ch"), 0xf9, 0x0d, 0x0a]) as Bytes
    await expect(readSheetFile({ name: "school-portal.vi.csv", bytes: legacy })).rejects.toThrow(
      'Save it as "CSV UTF-8" and try again'
    )
    await expect(readSheetFile({ name: "x.csv", bytes: legacy })).rejects.toBeInstanceOf(SheetFileError)
  })
})

describe("checkRulesOf", () => {
  it("uses the project's rules for UI strings and each field's own for a template", () => {
    expect(checkRulesOf(school, "nav.home")).toEqual({ lengthBudget: 1.5, maxLength: undefined, format: "text" })
    expect(checkRulesOf(email, "invite_coach.body")).toEqual({ lengthBudget: 2, maxLength: 4000, format: "html" })
    expect(checkRulesOf(email, "invite_coach.subject")).toEqual({
      lengthBudget: 2,
      maxLength: fieldOf("email", "subject").maxLength,
      format: "text",
    })
    expect(checkRulesOf(email, "invite_coach.nonsense")).toEqual({ lengthBudget: 2, maxLength: 4000, format: "text" })
  })
})

describe("planSheet", () => {
  const rows = [
    row("a.translated", { source: "Save", target: "Lưu" }),
    row("a.missing", { source: "Close", target: "Close", status: "missing" }),
    row("a.kept", { source: "OK", target: "OK", keptSource: true }),
    row("a.stalekept", { source: "Next", target: "Nxt", status: "outdated", keptSource: true }),
    row("a.crlf", { source: "Two lines", target: "Hai\r\ndòng" }),
    row("a.changed", { source: "Cancel", target: "Hủy" }),
    row("a.moved", { source: "New English", target: "Cũ" }),
  ]
  const sheet: ParsedSheet = {
    language: "vi",
    rows: [
      { key: "a.changed", english: "Cancel", translation: "Hủy bỏ" },
      { key: "a.changed", english: "Cancel", translation: "second wins? no" },
      { key: "a.unknown", english: "x", translation: "y" },
      { key: "a.translated", english: "Save", translation: "" },
      { key: "a.moved", english: "Old English", translation: "Mới" },
      { key: "a.missing", english: "Close", translation: "Close" },
      { key: "a.kept", english: "OK", translation: "OK" },
      { key: "a.stalekept", english: "Next", translation: "Next" },
      { key: "a.crlf", english: "Two lines", translation: "Hai\ndòng" },
    ],
  }

  it("saves what changed, keeps what equals the English, and counts what it skipped", () => {
    expect(planSheet(sheet, rows)).toEqual({
      values: { "a.changed": "Hủy bỏ" },
      keepKeys: ["a.missing", "a.stalekept"],
      sources: { "a.changed": "Cancel", "a.missing": "Close", "a.stalekept": "Next" },
      skipped: { duplicate: 1, unknown: 1, empty: 1, englishChanged: 1 },
    })
  })

  it("writes nothing for a sheet from another project", () => {
    const other: ParsedSheet = { language: "vi", rows: [{ key: "invite_coach.subject", english: "Hi", translation: "Chào" }] }
    const plan = planSheet(other, rows)
    expect(plan.skipped.unknown).toBe(1)
    expect(changeCount(diffSheet(rows, plan, { language: "vi", rulesOf: () => checkRulesOf(school, "x") }).counts)).toBe(0)
  })
})

describe("diffSheet", () => {
  it("shows Keep English on a missing copy as added, not unchanged", () => {
    const rows = [row("a.missing", { source: "Close", target: "Close", status: "missing" })]
    const plan = planSheet({ language: "vi", rows: [{ key: "a.missing", english: "Close", translation: "Close" }] }, rows)
    const diff = diffSheet(rows, plan, { language: "vi", rulesOf: (key) => checkRulesOf(school, key) })
    expect(diff.entries[0]).toMatchObject({ kind: "added", before: "", after: "Close", keep: true, issues: [] })
    expect(changeCount(diff.counts)).toBe(1)
  })

  it("checks an email body with the body's own rules", () => {
    // Longer than the 50 characters below which the app runs no checks at all.
    const english = "<p>Hello {name}, your visit to the campus is confirmed for tomorrow.</p>"
    const rows = [row("invite_coach.body", { source: english, target: "", status: "missing" })]
    const plan = planSheet(
      {
        language: "vi",
        rows: [{ key: "invite_coach.body", english, translation: "<p>Xin chào {name}, lịch thăm trường của bạn đã được xác nhận." }],
      },
      rows
    )
    const diff = diffSheet(rows, plan, { language: "vi", rulesOf: (key) => checkRulesOf(email, key) })
    expect(diff.entries[0].issues.map((issue) => issue.id)).toContain("html")
    expect(diff.errors).toBe(1)
  })
})

describe("skippedSummary", () => {
  it("lists only what happened", () => {
    expect(skippedSummary({ unknown: 3, englishChanged: 2, empty: 40, duplicate: 0 }, "School Portal")).toBe(
      "3 not in School Portal · 2 English changed since download · 40 empty"
    )
    expect(skippedSummary({ unknown: 0, englishChanged: 0, empty: 0, duplicate: 0 }, "School Portal")).toBeNull()
  })
})
