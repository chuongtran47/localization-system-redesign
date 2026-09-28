import { describe, expect, it } from "vitest"

import {
  clearTarget,
  commitSlot,
  discardSlot,
  emptyDrafts,
  pendingCount,
  pendingInTarget,
  pruneDeleted,
  selectedOf,
  setEdit,
  setKeep,
  setSelected,
  slotKeyOf,
  slotOf,
} from "@/lib/drafts"

const SCHOOL = "web/school-portal"
const STUDENT = "mobile/student-app"
const schoolVi = slotKeyOf(SCHOOL, "vi")
const schoolJa = slotKeyOf(SCHOOL, "ja")
const studentVi = slotKeyOf(STUDENT, "vi")

describe("draft slots", () => {
  it("never leaks an edit into another project or language", () => {
    const state = setEdit(emptyDrafts, schoolVi, "nav.home", "Trang chủ", "")
    expect(slotOf(state, schoolVi).edits).toEqual({ "nav.home": "Trang chủ" })
    expect(slotOf(state, studentVi).edits).toEqual({})
    expect(slotOf(state, schoolJa).edits).toEqual({})
  })

  it("drops an edit typed back to the displayed value", () => {
    let state = setEdit(emptyDrafts, schoolVi, "nav.home", "x", "")
    state = setEdit(state, schoolVi, "nav.home", "", "")
    expect(pendingCount(slotOf(state, schoolVi))).toBe(0)
  })

  it("keeps an edit when there is no displayed value to compare with (confirm)", () => {
    const state = setEdit(emptyDrafts, schoolVi, "nav.home", "Hủy", null)
    expect(slotOf(state, schoolVi).edits).toEqual({ "nav.home": "Hủy" })
  })

  it("makes keep and edit exclusive on one key", () => {
    let state = setEdit(emptyDrafts, schoolVi, "a.b", "x", "")
    state = setKeep(state, schoolVi, "a.b")
    expect(slotOf(state, schoolVi).edits).toEqual({})
    expect([...slotOf(state, schoolVi).keeps]).toEqual(["a.b"])
    state = setEdit(state, schoolVi, "a.b", "y", "")
    expect(slotOf(state, schoolVi).keeps.size).toBe(0)
  })

  it("commits only what was saved, keeping anything typed during the save", () => {
    let state = setEdit(emptyDrafts, schoolVi, "a.one", "1", "")
    state = setKeep(state, schoolVi, "a.kept")
    const saved = slotOf(state, schoolVi)

    state = setEdit(state, schoolVi, "a.one", "12", "")
    state = setEdit(state, schoolVi, "a.two", "x", "")
    state = setEdit(state, schoolJa, "a.one", "ja", "")

    state = commitSlot(state, schoolVi, saved)
    expect(slotOf(state, schoolVi).edits).toEqual({ "a.one": "12", "a.two": "x" })
    expect(slotOf(state, schoolVi).keeps.size).toBe(0)
    expect(slotOf(state, schoolJa).edits).toEqual({ "a.one": "ja" })
  })

  it("discards one slot only", () => {
    let state = setEdit(emptyDrafts, schoolVi, "a.one", "1", "")
    state = setEdit(state, schoolJa, "a.one", "2", "")
    state = discardSlot(state, schoolVi)
    expect(pendingCount(slotOf(state, schoolVi))).toBe(0)
    expect(pendingCount(slotOf(state, schoolJa))).toBe(1)
  })
})

describe("selection", () => {
  it("belongs to one project and survives a language change", () => {
    const state = setSelected(emptyDrafts, SCHOOL, ["a.one", "a.two"], true)
    expect([...selectedOf(state, SCHOOL)]).toEqual(["a.one", "a.two"])
    expect(selectedOf(state, STUDENT).size).toBe(0)
    expect([...selectedOf(setSelected(state, SCHOOL, ["a.one"], false), SCHOOL)]).toEqual(["a.two"])
  })
})

describe("pruneDeleted", () => {
  const seeded = () => {
    let state = setEdit(emptyDrafts, schoolVi, "a.one", "vi", "")
    state = setEdit(state, schoolJa, "a.one", "ja", "")
    state = setEdit(state, studentVi, "a.one", "student", "")
    return setSelected(state, SCHOOL, ["a.one"], true)
  }

  it("scope all clears the key from every language of the project", () => {
    const state = pruneDeleted(seeded(), SCHOOL, ["a.one"], "all", "vi")
    expect(slotOf(state, schoolVi).edits).toEqual({})
    expect(slotOf(state, schoolJa).edits).toEqual({})
    expect(slotOf(state, studentVi).edits).toEqual({ "a.one": "student" })
    expect(selectedOf(state, SCHOOL).size).toBe(0)
  })

  it("scope language clears it from that language only", () => {
    const state = pruneDeleted(seeded(), SCHOOL, ["a.one"], "language", "vi")
    expect(slotOf(state, schoolVi).edits).toEqual({})
    expect(slotOf(state, schoolJa).edits).toEqual({ "a.one": "ja" })
  })
})

describe("clearTarget and pendingInTarget", () => {
  const seeded = () => {
    let state = setEdit(emptyDrafts, schoolVi, "a.one", "vi", "")
    state = setKeep(state, schoolJa, "a.kept")
    state = setEdit(state, studentVi, "a.one", "student", "")
    state = setSelected(state, SCHOOL, ["a.one"], true)
    return setSelected(state, STUDENT, ["a.one"], true)
  }

  it("counts every unsaved edit and keep in a project", () => {
    expect(pendingInTarget(seeded(), SCHOOL)).toBe(2)
    expect(pendingInTarget(seeded(), STUDENT)).toBe(1)
  })

  it("clears one project's slots and selection and leaves the others", () => {
    const state = clearTarget(seeded(), SCHOOL)
    expect(pendingInTarget(state, SCHOOL)).toBe(0)
    expect(selectedOf(state, SCHOOL).size).toBe(0)
    expect(slotOf(state, studentVi).edits).toEqual({ "a.one": "student" })
    expect([...selectedOf(state, STUDENT)]).toEqual(["a.one"])
  })
})
