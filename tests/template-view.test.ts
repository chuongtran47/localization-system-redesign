import { describe, expect, it } from "vitest"

import type { TemplateCategory, TemplateEntry, TemplateOwner } from "@/lib/template-data"
import {
  TEMPLATE_ALL,
  categoriesOf,
  filterTemplates,
  matchesStatus,
  ownerProject,
  ownersOf,
  parseTemplateFilters,
  resolveOwner,
  summarise,
  type TemplateNarrowing,
} from "@/lib/template-view"

const entry = (
  id: string,
  category: TemplateCategory,
  owner: TemplateOwner,
  counts: Partial<Pick<TemplateEntry, "total" | "translated" | "missing" | "outdated" | "needsFix">> = {},
  text = "Hello"
): TemplateEntry => ({
  template: {
    id,
    name: `${id} name`,
    channel: "email",
    category,
    target: "messages/email",
    owner,
    createdBy: "Anna",
    createdAt: "2026-02-11T03:20:00.000Z",
  },
  fields: [{ field: "subject", source: "Welcome", target: text, status: "translated", keptSource: false }],
  total: 2,
  translated: 2,
  missing: 0,
  outdated: 0,
  needsFix: 0,
  ...counts,
})

const school: TemplateOwner = { kind: "web", app: "school" }
const parent: TemplateOwner = { kind: "app", app: "parent" }
const curriculum: TemplateOwner = { kind: "web", app: "curriculum" }

const entries = [
  entry("invite_coach", "coach", school),
  entry("parent_welcome", "parent", parent, { translated: 1, missing: 1 }, "Xin chào phụ huynh"),
  entry("lesson_plan", "teacher", curriculum, { translated: 1, needsFix: 1 }),
  entry("reminder", "parent", parent, { translated: 1, outdated: 1 }),
]

const all: TemplateNarrowing = { category: TEMPLATE_ALL, owner: TEMPLATE_ALL, status: "all", q: "" }

describe("parseTemplateFilters", () => {
  it("falls back for values that are not valid", () => {
    expect(
      parseTemplateFilters(
        new URLSearchParams("lang=xx&category=alien&status=bogus&owner=web/school&q=Hi&template=invite_coach")
      )
    ).toEqual({
      language: "vi",
      category: TEMPLATE_ALL,
      status: "all",
      owner: "web/school",
      q: "Hi",
      template: "invite_coach",
    })
  })

  it("keeps valid values and leaves the unset ones at their defaults", () => {
    expect(parseTemplateFilters(new URLSearchParams("lang=ja&category=parent&status=needs_fix"))).toEqual({
      language: "ja",
      category: "parent",
      status: "needs_fix",
      owner: TEMPLATE_ALL,
      q: "",
      template: null,
    })
  })
})

describe("owners", () => {
  it("maps every seeded owner to a project, or to a plain label", () => {
    expect(ownerProject(school).project?.name).toBe("School Portal")
    expect(ownerProject(parent).project?.name).toBe("Parent Portal")
    expect(ownerProject({ kind: "app", app: "student" }).project?.name).toBe("Student App")
    expect(ownerProject({ kind: "web", app: "training" }).project?.name).toBe("Training Portal")
    expect(ownerProject({ kind: "app", app: "baby" }).project?.name).toBe("GS Baby App")
    expect(ownerProject(curriculum)).toEqual({ label: "Curriculum", project: null })
  })

  it("lists the owners present, sorted by label", () => {
    expect(ownersOf(entries)).toEqual([
      { key: "web/curriculum", label: "Curriculum" },
      { key: "app/parent", label: "Parent Portal" },
      { key: "web/school", label: "School Portal" },
    ])
  })

  it("falls back to all products for an owner this channel does not have, once loaded", () => {
    expect(resolveOwner("app/baby", entries, false)).toBe(TEMPLATE_ALL)
    expect(resolveOwner("app/parent", entries, false)).toBe("app/parent")
    expect(resolveOwner("app/baby", [], true)).toBe("app/baby")
  })
})

describe("categoriesOf", () => {
  it("lists present categories in the schema order", () => {
    expect(categoriesOf(entries)).toEqual([
      { category: "coach", count: 1 },
      { category: "teacher", count: 1 },
      { category: "parent", count: 2 },
    ])
  })

  it("counts on a narrowed set but still lists every present category", () => {
    const narrowed = filterTemplates(entries, { ...all, owner: "app/parent" })
    expect(categoriesOf(entries, narrowed)).toEqual([
      { category: "coach", count: 0 },
      { category: "teacher", count: 0 },
      { category: "parent", count: 2 },
    ])
  })
})

describe("matchesStatus and filterTemplates", () => {
  it("reads each status from the template's counts", () => {
    const [done, missing, broken, stale] = entries
    expect(matchesStatus(done, "translated")).toBe(true)
    expect(matchesStatus(missing, "missing")).toBe(true)
    expect(matchesStatus(stale, "missing")).toBe(true)
    expect(matchesStatus(stale, "outdated")).toBe(true)
    expect(matchesStatus(broken, "needs_fix")).toBe(true)
    expect(matchesStatus(broken, "translated")).toBe(false)
    expect(matchesStatus(broken, "all")).toBe(true)
  })

  it("narrows by category, owner, status and text - text includes field values", () => {
    const ids = (list: TemplateEntry[]) => list.map((e) => e.template.id)
    expect(ids(filterTemplates(entries, { ...all, category: "parent" }))).toEqual(["parent_welcome", "reminder"])
    expect(ids(filterTemplates(entries, { ...all, owner: "web/school" }))).toEqual(["invite_coach"])
    expect(ids(filterTemplates(entries, { ...all, status: "needs_fix" }))).toEqual(["lesson_plan"])
    expect(ids(filterTemplates(entries, { ...all, q: "PHỤ HUYNH" }))).toEqual(["parent_welcome"])
    expect(ids(filterTemplates(entries, { ...all, q: "anna" }))).toHaveLength(4)
  })
})

describe("summarise", () => {
  it("sums fields across templates", () => {
    expect(summarise(entries)).toEqual({
      templates: 4,
      fields: 8,
      translated: 5,
      missing: 1,
      outdated: 1,
      needsFix: 1,
      percent: 63,
    })
    expect(summarise([]).percent).toBe(0)
  })
})
