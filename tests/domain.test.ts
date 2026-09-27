import { describe, expect, it } from "vitest"

import {
  displayedValueOf,
  groupOptionsOf,
  isValidKey,
  statusOf,
  type TranslationRow,
} from "@/lib/locale-data"
import { checkTranslation } from "@/lib/validation"

const LONG = "The teacher {name} is associated with a class. Please remove them first."

describe("isValidKey", () => {
  it("accepts the shapes the real data uses", () => {
    expect(isValidKey("common.link.repOnline")).toBe(true)
    expect(isValidKey("school_admin/campus_admin.inviteadmin.text")).toBe(true)
    expect(isValidKey("invitation-registernew.policy.accept")).toBe(true)
  })

  it("rejects keys without a group, with empty segments or spaces", () => {
    expect(isValidKey("nav")).toBe(false)
    expect(isValidKey(".nav.home")).toBe(false)
    expect(isValidKey("nav..home")).toBe(false)
    expect(isValidKey("nav home.title")).toBe(false)
  })
})

describe("statusOf", () => {
  it("is missing when the value is absent, empty or a plain copy of the English", () => {
    expect(statusOf({ source: "Save", target: undefined, language: "vi" })).toBe("missing")
    expect(statusOf({ source: "Save", target: "", language: "vi" })).toBe("missing")
    expect(statusOf({ source: "Save", target: "Save", language: "vi" })).toBe("missing")
    expect(statusOf({ source: "", target: "Lưu", language: "vi" })).toBe("missing")
  })

  it("treats English as translated whenever it has text", () => {
    expect(statusOf({ source: "Save", target: "Save", language: "en" })).toBe("translated")
  })

  it("honours a deliberate keep", () => {
    expect(
      statusOf({
        source: "GrapeSEED",
        target: "GrapeSEED",
        language: "vi",
        audit: { by: "a", at: "b", sourceAt: "GrapeSEED", keepSource: true },
      })
    ).toBe("translated")
  })

  it("is outdated when the English changed after the value was written", () => {
    expect(
      statusOf({
        source: "Cancel now",
        target: "Hủy",
        language: "vi",
        audit: { by: "a", at: "b", sourceAt: "Cancel" },
      })
    ).toBe("outdated")
  })

  it("is needs_fix for a failed portable check, but never for length alone", () => {
    const placeholder = checkTranslation(LONG, "Giáo viên {class} có lớp. Vui lòng xóa trước khi tiếp tục nhé.", {
      language: "vi",
      lengthBudget: Number.POSITIVE_INFINITY,
    })
    expect(statusOf({ source: LONG, target: "x", language: "vi", issues: placeholder })).toBe("needs_fix")
    expect(
      statusOf({
        source: LONG,
        target: "x",
        language: "vi",
        issues: [{ id: "length", level: "warning", message: "long" }],
      })
    ).toBe("translated")
  })
})

describe("checkTranslation", () => {
  it("skips short sources", () => {
    expect(checkTranslation("Save", "{x}", { language: "vi", lengthBudget: 1.5 })).toEqual([])
  })

  it("flags placeholder drift as an error", () => {
    const issues = checkTranslation(LONG, "Giáo viên {class} có lớp. Vui lòng xóa trước khi tiếp tục nhé.", {
      language: "vi",
      lengthBudget: 1.5,
    })
    expect(issues[0]).toMatchObject({ id: "placeholder", level: "error" })
  })

  it("flags unbalanced HTML in a mail body", () => {
    const source = "<p>Your visitation is scheduled for {date}. Please be ready on time.</p>"
    const issues = checkTranslation(source, "<p>Buổi thăm lớp được lên lịch vào {date}. Hãy sẵn sàng đúng giờ.", {
      language: "vi",
      lengthBudget: 2,
      format: "html",
    })
    expect(issues.some((issue) => issue.id === "html")).toBe(true)
  })
})

const row = (key: string, status: TranslationRow["status"], source = key): TranslationRow => ({
  key,
  group: key.split(".")[0],
  source,
  target: status === "missing" ? source : `${key}!`,
  status,
  keptSource: false,
  origin: "import",
  created: { by: "T", at: "2026-01-01T00:00:00Z" },
})

describe("displayedValueOf and groupOptionsOf", () => {
  it("shows an empty field for a missing copy of the English", () => {
    expect(displayedValueOf(row("nav.home", "missing"))).toBe("")
    expect(displayedValueOf(row("nav.home", "translated"))).toBe("nav.home!")
  })

  it("counts missing, outdated and needs_fix as outstanding", () => {
    const options = groupOptionsOf([
      row("nav.a", "missing"),
      row("nav.b", "outdated"),
      row("nav.c", "needs_fix"),
      row("nav.d", "translated"),
      row("user.a", "translated"),
    ])
    expect(options).toEqual([
      { group: "nav", total: 4, outstanding: 3 },
      { group: "user", total: 1, outstanding: 0 },
    ])
  })
})
