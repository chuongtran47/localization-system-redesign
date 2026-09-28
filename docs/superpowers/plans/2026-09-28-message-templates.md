# Message templates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thẻ "coming soon" ở `/messages/email|sms|notification` bằng màn hình template đầy đủ — bảng, dialog dịch hai panel với rich text editor và preview theo kênh — behavior theo repo tham chiếu, UI theo style của repo này, và giảm helper text theo bảng §4.5 của spec.

**Architecture:** Dữ liệu và luật đã có (`GET /templates`, `lib/template-data.ts`, `lib/template-preview.ts`); plan thêm logic lọc/đếm thuần (`lib/template-view.ts`), hook `useTemplates`, năm component trong `components/templates/`, và tách `TranslationWorkspace` thành bộ chọn giữa `UiWorkspace` và `TemplateWorkspace`. Các phần giao diện dùng chung giữa hai màn hình (header, stat card, underline tabs, skeleton, class nút icon) được tách ra trước để không phải sao chép.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, Tailwind v4, shadcn base-nova (Dialog, Input, Textarea), sonner, vitest.

**Spec:** [docs/superpowers/specs/2026-09-28-message-templates-design.md](../specs/2026-09-28-message-templates-design.md)

**Repo tham chiếu:** `D:\example_projects\localizer` (`src/pages/templates_page.tsx`, `src/components/templates/*`, `src/hooks/use_templates.ts`). Mọi lệnh bash chạy từ gốc repo này, trên branch `feat/workspace-parity`.

## Global Constraints

- Tên file kebab-case; không thêm dependency.
- `lib/api.ts` là module duy nhất chạm backend; không component/hook nào gọi `fetch`.
- HTML chỉ vào `dangerouslySetInnerHTML` qua `safeHtml` (English trong field editor) hoặc `previewHtml` (preview) của `lib/template-preview.ts`.
- Màu dùng token: `primary`, `success`, `warning` (chữ luôn `text-warning-foreground dark:text-warning`), `info`, `destructive`, `muted`. Không dùng `amber-*`, `sky-*`, `emerald-*`, `rose-*`.
- Helper text theo spec §4.5: không được xuất hiện trên màn hình "Placeholders in this template", "A segment holds", "likely to be cut off", "(English:", "In the inbox", "Expanded", "English changed since this was translated", "not translated yet", "sample-data/templates.json", badge "Unsaved". `title`/`aria-label` của nút icon được giữ.
- Save của dialog: `saveTranslations(target, language, values, keepKeys)`; `values` khóa `templateKeyOf(id, field)`, `keepKeys: string[]` cùng dạng khóa; một field không ở cả hai.
- Dialog key `${templateId}:${language}`; edit là state cục bộ, không vào `DraftProvider`.
- Không dùng `overflow-hidden` trên container chứa `PopoverMenu`; `PopoverMenu` đặt trong khối block thì bọc `w-fit`.
- Commit message không có dòng `Co-Authored-By` hay attribution Claude/Anthropic.
- Gate: `npm run typecheck` và `npm test`; task cuối thêm `npm run build`. Sau build/tsc, khôi phục file tự sinh: `git checkout -- next-env.d.ts tsconfig.tsbuildinfo`.
- Kiểm tra UI dùng driver `cdp.mjs` trong `<scratchpad>` = `C:/Users/CHARLI~1/AppData/Local/Temp/claude/c--Users-Charlie-Tran-Downloads-localization-system-redesign/030cc817-93e9-4e56-9f6b-2b6f7b199a47/scratchpad`; `<ws>` = `.superpowers/sdd/2026-09-28-message-templates/`. Không dừng dev server của người dùng ở `:3000`.

## Sai khác có chủ đích so với spec

1. **Tách phần giao diện dùng chung trước (Task 2)** — `components/workspace-header.tsx` (header + Publish menu), `components/stat-card.tsx`, `components/underline-tabs.tsx`, `components/skeleton-rows.tsx`, thêm `iconButton`/`textButton` vào `components/button-styles.ts`. Spec chỉ nêu tách `StatCard`; phần còn lại là cùng lý do (hai màn hình cùng dùng) nên làm luôn để không sao chép header/tabs.
2. **`categoriesOf(entries, counted = entries)`** — nhận thêm tập để đếm, vì tab category phải liệt kê category có trong kênh nhưng đếm trên tập đã lọc owner/status/q (spec §3.3 nói hai ý này ở hai chỗ).
3. **`TemplateWorkspace` đọc bộ lọc bằng `parseTemplateFilters(useSearchParams())` và ghi bằng `setParam` của `useWorkspaceParams`** — không thêm hook mới cho việc ghi URL.
4. **Icon "Sent from" trong dialog theo project đã map** (`group === "mobile"` → `Smartphone`, còn lại `Globe`; owner không map được thì theo `owner.kind`). Spec nói "Globe cho web, Smartphone cho mobile/app"; seed có `app/parent` map sang Parent Portal là website, nên icon theo nhãn đang hiện.
5. **Nút CTA trong preview email khi trống** hiện "Not translated" nghiêng bằng màu chữ của nút primary, không dùng màu warning — chữ warning trên nền primary không đọc được.

## Review Focus

1. **Đóng dialog còn sửa bằng Esc / nút X / click nền** — luôn hỏi; từ chối thì dialog và edit còn nguyên. → Task 5 kiểm bằng CDP (`window.confirm` được thay trong trang).
2. **`?lang=` đổi khi dialog đang mở** (link chia sẻ, bước lịch sử) — dialog mount lại theo ngôn ngữ mới, edit cũ không bị lưu vào ngôn ngữ nào. → Task 5 kiểm bằng CDP (`history.replaceState`).
3. **HTML độc hại trong body** (`<img onerror>`, `<script>`) — preview hiện nó như chữ, không chạy. → Task 5 kiểm bằng CDP (`window.__pwned` không được đặt).
4. **Link chia sẻ với `?template=` / `?owner=` / `?category=` / `?status=` sai** — không mở dialog, rơi về All. → Task 1 test `parseTemplateFilters`/`resolveOwner`; Task 5 kiểm bằng CDP.
5. **Ngôn ngữ RTL trong preview** — preview đặt `dir="rtl"` khi xem ngôn ngữ RTL, trở về LTR khi bật English. → Task 5 kiểm bằng CDP.

---

### Task 1: `lib/template-view.ts` và test router `GET /templates`

**Files:**
- Create: `lib/template-view.ts`
- Test: `tests/template-view.test.ts`; Modify: `tests/router.test.ts` (thêm `describe("templates")`)

**Interfaces:**
- Consumes: `languages`, `LanguageCode` (`lib/locale-data.ts`); `DEFAULT_LANGUAGE` (`lib/workspace-view.ts`); `findProjectByTarget`, `Project` (`lib/projects.ts`); `ownerPath`, `templateCategories`, `TemplateCategory`, `TemplateEntry`, `TemplateOwner` (`lib/template-data.ts`).
- Produces: `TEMPLATE_ALL = "__all__"`, `type TemplateStatusFilter = "all" | "missing" | "outdated" | "needs_fix" | "translated"`, `type TemplateFilters = { language; category: TemplateCategory | typeof TEMPLATE_ALL; owner: string; status: TemplateStatusFilter; q: string; template: string | null }`, `parseTemplateFilters(params)`, `ownerKeyOf(owner)`, `ownerProject(owner): { label: string; project: Project | null }`, `resolveOwner(owner, entries, isLoading)`, `ownersOf(entries): { key; label }[]`, `categoriesOf(entries, counted?): { category; count }[]`, `matchesStatus(entry, status)`, `type TemplateNarrowing = Pick<TemplateFilters, "category" | "owner" | "status" | "q">`, `filterTemplates(entries, narrowing)`, `type TemplateTotals = { templates; fields; translated; missing; outdated; needsFix; percent }`, `summarise(entries)`.

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/template-view.test.ts`:

```ts
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

const all = { category: TEMPLATE_ALL, owner: TEMPLATE_ALL, status: "all" as const, q: "" }

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
```

Trong `tests/router.test.ts`: thêm `TemplatesResponse,` vào `import type { … } from "@/lib/api-types"`, rồi thêm cuối file:

```ts
describe("templates", () => {
  async function templates(target: string, lang: string) {
    const { body } = await callJson<TemplatesResponse>(store, "GET", `/templates?target=${target}&lang=${lang}`)
    return body.templates
  }

  const sums = (list: TemplatesResponse["templates"]) =>
    list.reduce(
      (sum, t) => ({
        templates: sum.templates + 1,
        fields: sum.fields + t.total,
        translated: sum.translated + t.translated,
        needsFix: sum.needsFix + t.needsFix,
      }),
      { templates: 0, fields: 0, translated: 0, needsFix: 0 }
    )

  it("serves every channel of the seed", async () => {
    expect(sums(await templates("messages/email", "vi"))).toEqual({ templates: 10, fields: 40, translated: 39, needsFix: 1 })
    expect(sums(await templates("messages/sms", "vi"))).toEqual({ templates: 5, fields: 5, translated: 5, needsFix: 0 })
    expect(sums(await templates("messages/notification", "vi"))).toEqual({
      templates: 6,
      fields: 12,
      translated: 12,
      needsFix: 0,
    })
    expect(sums(await templates("messages/email", "en"))).toMatchObject({ fields: 40, translated: 40 })
  })

  it("clears a template's needs_fix once its body is repaired", async () => {
    const broken = (await templates("messages/email", "vi")).find((t) => t.template.id === "visitation_scheduled")
    expect(broken?.needsFix).toBe(1)
    const body = broken?.fields.find((field) => field.field === "body")?.target ?? ""

    await call(store, "PUT", "/translations/vi?target=messages/email", {
      values: { "visitation_scheduled.body": `${body}</p>` },
      by: "T",
    })

    const fixed = (await templates("messages/email", "vi")).find((t) => t.template.id === "visitation_scheduled")
    expect(fixed?.needsFix).toBe(0)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- tests/template-view.test.ts tests/router.test.ts`
Expected: `tests/template-view.test.ts` FAIL — `Failed to resolve import "@/lib/template-view"`. `describe("templates")` trong router PASS ngay (nó mô tả route đã port ở #1–2).

- [ ] **Step 3: Viết `lib/template-view.ts`**

```ts
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
```

- [ ] **Step 4: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS toàn bộ; `tsc` sạch. Nếu test "clears a template's needs_fix" fail vì body còn lỗi khác, in `fixed.fields` ra để xem issue rồi ghi ruling — không đổi quy tắc validation.

- [ ] **Step 5: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo 2>/dev/null
git add lib/template-view.ts tests/template-view.test.ts tests/router.test.ts
git commit -m "Add template filtering, counting and owner mapping rules"
```

---

### Task 2: Tách phần giao diện dùng chung; `TranslationWorkspace` thành bộ chọn

**Files:**
- Create: `components/stat-card.tsx`, `components/skeleton-rows.tsx`, `components/underline-tabs.tsx`, `components/workspace-header.tsx`
- Modify: `components/button-styles.ts` (thêm `iconButton`, `textButton`), `components/translation-row.tsx` (dùng chúng)
- Rewrite: `components/translation-workspace.tsx`

**Interfaces:**
- Consumes: `PopoverMenu`, `PopoverMenuItem`; `groupLabel`, `kindLabel`, `targetOf`, `Project`; mọi thứ workspace đang dùng.
- Produces:
  - `StatCard({ label, value, accent: "primary" | "success" | "warning" | "destructive", detail?, active, onClick, children? })`.
  - `SkeletonRows()`.
  - `UnderlineTabs<T extends string>({ items: { id: T; label: string; count: number }[], value: T, onChange(id: T) })`.
  - `WorkspaceHeader({ project, section: string, subtitle: ReactNode, badges?: ReactNode, canExport: boolean, onExport(), children? })` — breadcrumb `<group> / <section>`, tiêu đề, badge loại, "Inferred", `badges`, subtitle; nút Export + Import link (khi `canExport`), Lock, Publish, rồi `children`.
  - `iconButton`, `textButton` (string) trong `components/button-styles.ts`.
  - `TranslationWorkspace({ project })` chọn: `kind === "ui"` → `UiWorkspace`, còn lại → khối tạm (thẻ profile) cho tới Task 5.

Task này là refactor: behavior không đổi, nên "test fail trước" là bản ghi hồi quy chụp trước khi sửa, so với bản chụp sau khi sửa.

- [ ] **Step 1: Chụp baseline hồi quy (trước khi sửa file nào)**

Dev server `:3000` biên dịch cây làm việc hiện tại, nên chạy bước này trước mọi chỉnh sửa. `steps-flows.txt` là script flow workspace từ #1–2 (trong scratchpad); `<ws>` là thư mục sdd của plan này.

Run (từ scratchpad): `node cdp.mjs "<scratchpad>/chrome-t2-before" "http://localhost:3000/web/school-portal" steps-flows.txt > "<ws>/flows-before.txt"`
Expected: mỗi đoạn in một dòng JSON, không dòng nào là lỗi (`no element`, `null` ở chỗ phải có giá trị).

- [ ] **Step 2: Thêm class nút icon/chữ và cho `translation-row.tsx` dùng**

Cuối `components/button-styles.ts`:

```ts
export const iconButton =
  "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"

export const textButton =
  "rounded-md px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-accent/50"
```

Trong `components/translation-row.tsx`: xóa hai khai báo `const iconButton = …` và `const textButton = …`, thêm `import { iconButton, textButton } from "@/components/button-styles"`.

- [ ] **Step 3: Tạo bốn component dùng chung**

`components/stat-card.tsx`:

```tsx
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

/** A status summary that is also a filter, so the work queue is one click away. */
export function StatCard({
  label,
  value,
  accent,
  detail,
  active,
  onClick,
  children,
}: {
  label: string
  value: string
  accent: "primary" | "success" | "warning" | "destructive"
  detail?: string
  active: boolean
  onClick: () => void
  children?: ReactNode
}) {
  const dot = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  }[accent]
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        active && "border-primary/60 bg-accent/30"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn("size-2 rounded-full", dot)} />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      {children}
    </button>
  )
}
```

`components/skeleton-rows.tsx`:

```tsx
export function SkeletonRows() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
          <div className="size-4 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/4 animate-pulse rounded bg-muted" />
          <div className="h-8 flex-1 animate-pulse rounded-md bg-muted" />
        </div>
      ))}
    </div>
  )
}
```

`components/underline-tabs.tsx`:

```tsx
import { cn } from "@/lib/utils"

export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string; count: number }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] font-semibold tabular-nums",
                active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {item.count.toLocaleString()}
            </span>
            {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        )
      })}
    </div>
  )
}
```

`components/workspace-header.tsx`:

```tsx
"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ChevronDown, Download, FileUp, FlaskConical, Lock, Rocket, Upload } from "lucide-react"

import { outlineButton } from "@/components/button-styles"
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu"
import { groupLabel, kindLabel, targetOf, type Project } from "@/lib/projects"

export function WorkspaceHeader({
  project,
  section,
  subtitle,
  badges,
  canExport,
  onExport,
  children,
}: {
  project: Project
  section: string
  subtitle: ReactNode
  badges?: ReactNode
  canExport: boolean
  onExport: () => void
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{groupLabel[project.group]}</span>
          <span>/</span>
          <span className="text-foreground">{section}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{project.name}</h1>
          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {kindLabel[project.profile.kind]}
          </span>
          {!project.profile.measured && (
            <span
              className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              title="Profile inferred, not measured"
            >
              Inferred
            </span>
          )}
          {badges}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canExport && (
          <button type="button" onClick={onExport} className={outlineButton}>
            <Download className="size-4" />
            Export
          </button>
        )}
        {canExport && (
          <Link href={`/import?target=${targetOf(project)}`} className={outlineButton}>
            <FileUp className="size-4" />
            Import
          </Link>
        )}
        <button type="button" className={outlineButton}>
          <Lock className="size-4" />
          Lock
        </button>
        <PublishMenu />
        {children}
      </div>
    </div>
  )
}

function PublishMenu() {
  return (
    <PopoverMenu
      label="publish menu"
      trigger={(toggle) => (
        <button type="button" onClick={toggle} className={outlineButton}>
          <Upload className="size-4" />
          Publish
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      )}
    >
      {() => (
        <>
          <PopoverMenuItem icon={FlaskConical} label="Publish to Test" hint="Staging environment" />
          <PopoverMenuItem icon={Rocket} label="Publish to Live" hint="Production" />
        </>
      )}
    </PopoverMenu>
  )
}
```

- [ ] **Step 4: Viết lại `components/translation-workspace.tsx`**

Thay toàn bộ file (behavior của workspace UI giữ nguyên; chỉ đổi sang component dùng chung và tách bộ chọn):

```tsx
"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Plus, RotateCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { destructiveButton, outlineButton, primaryButton } from "@/components/button-styles"
import { useDrafts } from "@/components/draft-provider"
import { SkeletonRows } from "@/components/skeleton-rows"
import { StatCard } from "@/components/stat-card"
import { TranslationList } from "@/components/translation-list"
import { TranslationRow } from "@/components/translation-row"
import { AddKeyDialog } from "@/components/translations/add-key-dialog"
import { DeleteKeysDialog } from "@/components/translations/delete-keys-dialog"
import { ExportDialog } from "@/components/translations/export-dialog"
import { GroupFilter } from "@/components/translations/group-filter"
import { ProjectProfileCard } from "@/components/translations/project-profile-card"
import { UnderlineTabs } from "@/components/underline-tabs"
import { WorkspaceHeader } from "@/components/workspace-header"
import { useCoverage } from "@/hooks/use-coverage"
import { useTranslationRows } from "@/hooks/use-translation-rows"
import { useWorkspaceParams } from "@/hooks/use-workspace-params"
import { messageOf, saveTranslations } from "@/lib/api"
import type { DeleteScope } from "@/lib/api-types"
import {
  clearSelected,
  commitSlot,
  discardSlot,
  pendingCount,
  pruneDeleted,
  selectedOf,
  setEdit,
  setKeep,
  setSelected,
  slotKeyOf,
  slotOf,
} from "@/lib/drafts"
import { displayedValueOf, languages } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"
import { ALL_VERSIONS, versions } from "@/lib/release"
import { cn } from "@/lib/utils"
import { ALL_GROUPS, resolveGroup, statusFilters, viewOf, type StatusFilter } from "@/lib/workspace-view"

/** Loose UI strings and message templates are different screens over the same route. */
export function TranslationWorkspace({ project }: { project: Project }) {
  if (project.profile.kind !== "ui") {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <ProjectProfileCard
          project={project}
          title={`${project.name} templates`}
          message="The template editor for this channel is coming soon."
        />
      </div>
    )
  }
  return <UiWorkspace project={project} />
}

function UiWorkspace({ project }: { project: Project }) {
  const target = targetOf(project)

  const { filters, setParam, setParams } = useWorkspaceParams()
  const { language } = filters
  const { revision, refresh } = useCoverage()
  const { rows, isLoading, error } = useTranslationRows(target, language, revision)

  const group = resolveGroup(filters.group, rows, isLoading)
  const view = useMemo(
    () => viewOf(rows, { group, status: filters.status, version: filters.version, q: filters.q }),
    [rows, group, filters.status, filters.version, filters.q]
  )
  const rowsByKey = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows])

  const { drafts, update } = useDrafts()
  const slotKey = slotKeyOf(target, language)
  const slot = slotOf(drafts, slotKey)
  const selected = selectedOf(drafts, target)

  const [isSaving, setIsSaving] = useState(false)
  const [doomed, setDoomed] = useState<string[]>([])
  const [isAddOpen, setAddOpen] = useState(false)
  const [isExportOpen, setExportOpen] = useState(false)

  const languageInfo = languages.find((item) => item.code === language) ?? languages[0]
  const hasKeys = rows.length > 0
  const pending = pendingCount(slot)
  const selectedInView = view.visible.filter((row) => selected.has(row.key)).length
  const { totals, statusCounts } = view

  const handleChange = (key: string, value: string) => {
    const row = rowsByKey.get(key)
    if (row) {
      update((state) => setEdit(state, slotKey, key, value, displayedValueOf(row)))
    }
  }

  const handleKeep = (key: string) => update((state) => setKeep(state, slotKey, key))

  // An outdated value that still holds is confirmed by writing it back, which
  // refreshes its English snapshot on the server.
  const handleConfirm = (key: string) => {
    const row = rowsByKey.get(key)
    if (row) {
      update((state) => setEdit(state, slotKey, key, row.target, null))
    }
  }

  const handleSelect = (key: string, on: boolean) => update((state) => setSelected(state, target, [key], on))

  const handleSelectAll = (on: boolean) =>
    update((state) =>
      setSelected(
        state,
        target,
        view.visible.map((row) => row.key),
        on
      )
    )

  const handleSave = async () => {
    const saving = slot
    const savingKey = slotKey
    setIsSaving(true)
    try {
      const { saved, file } = await saveTranslations(target, language, saving.edits, [...saving.keeps])
      update((state) => commitSlot(state, savingKey, saving))
      refresh()
      toast.success(`Saved ${saved} ${saved === 1 ? "key" : "keys"}`, { description: `Written to ${file}` })
    } catch (cause: unknown) {
      toast.error("Could not save", { description: messageOf(cause) })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleted = (keys: string[], scope: DeleteScope) => {
    update((state) => pruneDeleted(state, target, keys, scope, language))
    refresh()
  }

  const handleCreated = (key: string) => {
    refresh()
    setParams({ q: key, status: null, group: null, version: null })
  }

  const statusTabs = statusFilters
    .filter((item) => item.id !== "new" || view.hasManual || filters.status === "new")
    .map((item) => ({ id: item.id, label: item.label, count: statusCounts[item.id] }))

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <WorkspaceHeader
        project={project}
        section="Translations"
        subtitle={
          <>
            Managing <span className="font-medium text-foreground">{languageInfo.name}</span> translations ·{" "}
            {rows.length.toLocaleString()} keys
          </>
        }
        canExport={hasKeys}
        onExport={() => setExportOpen(true)}
      >
        <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
          <Plus className="size-4" />
          Add key
        </button>
      </WorkspaceHeader>

      {/* Stat cards */}
      {(isLoading || hasKeys) && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Translation progress"
            value={isLoading ? "—" : `${totals.percent}%`}
            accent="primary"
            active={filters.status === "all"}
            onClick={() => setParam("status", null)}
          >
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${totals.percent}%` }} />
            </div>
          </StatCard>
          <StatCard
            label="Translated"
            value={isLoading ? "—" : totals.translated.toLocaleString()}
            accent="success"
            active={filters.status === "translated"}
            onClick={() => setParam("status", "translated")}
          />
          <StatCard
            label="Needs fix"
            value={isLoading ? "—" : totals.needsFix.toLocaleString()}
            accent="warning"
            active={filters.status === "needs_fix"}
            onClick={() => setParam("status", "needs_fix")}
          />
          <StatCard
            label="Missing"
            value={isLoading ? "—" : totals.missing.toLocaleString()}
            detail={isLoading ? undefined : `${totals.outdated.toLocaleString()} outdated`}
            accent="destructive"
            active={filters.status === "missing" || filters.status === "outdated"}
            onClick={() => setParam("status", "missing")}
          />
        </div>
      )}

      {hasKeys && (
        <>
          {/* Version pills */}
          <div className="mt-6 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Version</span>
            {versions.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setParam("version", v === ALL_VERSIONS ? null : v)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  filters.version === v
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Status tabs, group and count */}
          <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-border">
            <UnderlineTabs<StatusFilter>
              items={statusTabs}
              value={filters.status}
              onChange={(id) => setParam("status", id === "all" ? null : id)}
            />
            <div className="flex items-center gap-2 pb-2">
              <GroupFilter
                value={group}
                options={view.groupOptions}
                totalKeys={rows.length}
                onChange={(value) => setParam("group", value === ALL_GROUPS ? null : value)}
              />
              <span className="rounded-full border border-border bg-card px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
                {view.visible.length.toLocaleString()} keys
              </span>
            </div>
          </div>
        </>
      )}

      {/* Body */}
      <div className="mt-4 pb-10">
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>
              Could not load {project.name}: {error}
            </span>
            <button type="button" onClick={refresh} className={outlineButton}>
              <RotateCw className="size-4" />
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <SkeletonRows />
        ) : !hasKeys ? (
          <ProjectProfileCard
            project={project}
            title={`No keys in ${project.name} yet`}
            message="Add the first key below. It is created in this project only, and in every language at once."
            action={
              <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
                <Plus className="size-4" />
                Add key
              </button>
            }
          />
        ) : (
          <TranslationList
            rows={view.visible}
            languageName={languageInfo.name}
            allSelected={view.visible.length > 0 && selectedInView === view.visible.length}
            someSelected={selectedInView > 0 && selectedInView < view.visible.length}
            onSelectAll={handleSelectAll}
            renderRow={(row) => {
              const isKeepPending = slot.keeps.has(row.key)
              const value = slot.edits[row.key] ?? (isKeepPending ? row.source : displayedValueOf(row))
              return (
                <TranslationRow
                  row={row}
                  value={value}
                  isDirty={row.key in slot.edits || isKeepPending}
                  isKeepPending={isKeepPending}
                  isSelected={selected.has(row.key)}
                  language={language}
                  profile={project.profile}
                  rtl={languageInfo.rtl ?? false}
                  onChange={handleChange}
                  onKeep={handleKeep}
                  onConfirm={handleConfirm}
                  onSelect={handleSelect}
                  onDelete={(key) => setDoomed([key])}
                />
              )
            }}
          />
        )}
      </div>

      {/* Trays: a selection and unsaved edits can both be open, so they stack. */}
      {(selected.size > 0 || pending > 0) && (
        <div className="sticky bottom-4 z-10 -mt-6 space-y-2">
          {selected.size > 0 && (
            <Tray>
              <span className="text-sm">
                {selected.size.toLocaleString()} selected
                {selected.size !== selectedInView && (
                  <span className="text-muted-foreground"> ({selectedInView.toLocaleString()} in view)</span>
                )}
              </span>
              <div className="ml-auto flex gap-2">
                <button type="button" className={outlineButton} onClick={() => update((state) => clearSelected(state, target))}>
                  Clear
                </button>
                <button type="button" className={destructiveButton} onClick={() => setDoomed([...selected])}>
                  <Trash2 className="size-4" />
                  Delete
                </button>
              </div>
            </Tray>
          )}
          {pending > 0 && (
            <Tray>
              <span className="text-sm">
                {pending} unsaved {pending === 1 ? "key" : "keys"}{" "}
                <span className="text-muted-foreground">in {languageInfo.name}</span>
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  className={outlineButton}
                  disabled={isSaving}
                  onClick={() => update((state) => discardSlot(state, slotKey))}
                >
                  Discard
                </button>
                <button type="button" className={primaryButton} disabled={isSaving} onClick={handleSave}>
                  {isSaving ? "Saving…" : "Save all"}
                </button>
              </div>
            </Tray>
          )}
        </div>
      )}

      <AddKeyDialog open={isAddOpen} onOpenChange={setAddOpen} project={project} onCreated={handleCreated} />
      {hasKeys && (
        <ExportDialog open={isExportOpen} onOpenChange={setExportOpen} project={project} language={language} />
      )}
      <DeleteKeysDialog
        project={project}
        language={language}
        keys={doomed}
        onClose={() => setDoomed([])}
        onDeleted={handleDeleted}
      />
    </div>
  )
}

function Tray({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg shadow-black/5 backdrop-blur animate-in fade-in slide-in-from-bottom-2">
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Chạy gate**

Run: `npm run typecheck && npm test`
Expected: sạch / PASS.

- [ ] **Step 6: Hồi quy workspace bằng CDP**

Chạy lại cùng script với profile mới, rồi so với baseline:

Run (từ scratchpad): `node cdp.mjs "<scratchpad>/chrome-t2-after" "http://localhost:3000/web/school-portal" steps-flows.txt > "<ws>/flows-after.txt" && diff "<ws>/flows-before.txt" "<ws>/flows-after.txt"`
Expected: `diff` không in gì, hoặc chỉ khác ở chuỗi thời gian (toast, "Updated …"). Khác ở bất kỳ chỗ nào khác là hồi quy — sửa code, không sửa script.

- [ ] **Step 7: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo 2>/dev/null
git add components/button-styles.ts components/translation-row.tsx components/stat-card.tsx components/skeleton-rows.tsx components/underline-tabs.tsx components/workspace-header.tsx components/translation-workspace.tsx
git commit -m "Share the workspace header, stat card, tabs and skeleton; split the UI workspace out"
```

---

### Task 3: `useTemplates`, rich text editor, preview

**Files:**
- Create: `hooks/use-templates.ts`, `components/templates/rich-text-editor.tsx`, `components/templates/template-preview.tsx`

**Interfaces:**
- Consumes: `fetchTemplates`, `messageOf` (`lib/api.ts`); `TemplateEntry`, `TemplateChannel`, `TemplateFieldId` (`lib/template-data.ts`); `cleanHtml`, `previewHtml`, `previewText`, `sampleValues` (`lib/template-preview.ts`); `smsInfo` (`lib/validation.ts`).
- Produces:
  - `useTemplates(target: string, language: LanguageCode, revision: number): { templates: TemplateEntry[]; isLoading: boolean; error: string | null }`.
  - `RichTextEditor({ value, rtl?, ariaLabel, onChange(value) })`.
  - `TemplatePreview({ channel, values: Partial<Record<TemplateFieldId, string>>, appName, rtl? })`.

- [ ] **Step 1: `hooks/use-templates.ts`**

```ts
"use client"

import { useEffect, useState } from "react"

import { fetchTemplates, messageOf } from "@/lib/api"
import type { LanguageCode } from "@/lib/locale-data"
import type { TemplateEntry } from "@/lib/template-data"

type Result = { token: string; templates: TemplateEntry[] } | { token: string; error: string }

const EMPTY: TemplateEntry[] = []

/** One channel's templates in one language. A refresh keeps the old list until the new one lands. */
export function useTemplates(target: string, language: LanguageCode, revision: number) {
  const token = `${target}:${language}`
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let cancelled = false
    const current = `${target}:${language}`

    fetchTemplates(target, language)
      .then((response) => {
        if (!cancelled) {
          setResult({ token: current, templates: response.templates })
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({ token: current, error: messageOf(cause) })
        }
      })

    return () => {
      cancelled = true
    }
  }, [target, language, revision])

  const mine = result && result.token === token ? result : null

  return {
    templates: mine && "templates" in mine ? mine.templates : EMPTY,
    isLoading: mine === null,
    error: mine && "error" in mine ? mine.error : null,
  }
}
```

- [ ] **Step 2: `components/templates/rich-text-editor.tsx`**

```tsx
"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { Bold, Heading, Italic, Link2, Link2Off, List, ListOrdered, Underline } from "lucide-react"

import { iconButton } from "@/components/button-styles"
import { cleanHtml } from "@/lib/template-preview"
import { cn } from "@/lib/utils"

/**
 * A mail body edited as formatting rather than as angle brackets. Built on
 * `contenteditable` and `execCommand`; the value leaves through `cleanHtml`,
 * so what is stored never depends on which browser typed it.
 */
export function RichTextEditor({
  value,
  rtl,
  ariaLabel,
  onChange,
}: {
  value: string
  rtl?: boolean
  ariaLabel: string
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // The last value this editor produced. The DOM is rewritten only when the
  // value changed elsewhere (a paste of the English, another template), or the
  // caret would jump to the start on every keystroke.
  const emitted = useRef<string | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || value === emitted.current) {
      return
    }
    element.innerHTML = value
    emitted.current = value
  }, [value])

  useEffect(() => {
    document.execCommand("defaultParagraphSeparator", false, "p")
  }, [])

  const emit = () => {
    const element = ref.current
    if (!element) {
      return
    }
    const next = cleanHtml(element.innerHTML)
    emitted.current = next
    onChange(next)
  }

  const run = (command: string, argument?: string) => {
    ref.current?.focus()
    document.execCommand(command, false, argument)
    emit()
  }

  const heading = () => {
    const current = document.queryCommandValue("formatBlock").toLowerCase()
    run("formatBlock", current === "h1" ? "<p>" : "<h1>")
  }

  const link = () => {
    const url = window.prompt("Link address")
    if (url) {
      run("createLink", url)
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-input bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1 py-1">
        <Tool label="Bold" onClick={() => run("bold")}>
          <Bold className="size-3.5" />
        </Tool>
        <Tool label="Italic" onClick={() => run("italic")}>
          <Italic className="size-3.5" />
        </Tool>
        <Tool label="Underline" onClick={() => run("underline")}>
          <Underline className="size-3.5" />
        </Tool>
        <span className="mx-1 h-4 w-px bg-border" />
        <Tool label="Heading" onClick={heading}>
          <Heading className="size-3.5" />
        </Tool>
        <Tool label="Bulleted list" onClick={() => run("insertUnorderedList")}>
          <List className="size-3.5" />
        </Tool>
        <Tool label="Numbered list" onClick={() => run("insertOrderedList")}>
          <ListOrdered className="size-3.5" />
        </Tool>
        <span className="mx-1 h-4 w-px bg-border" />
        <Tool label="Add link" onClick={link}>
          <Link2 className="size-3.5" />
        </Tool>
        <Tool label="Remove link" onClick={() => run("unlink")}>
          <Link2Off className="size-3.5" />
        </Tool>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        dir={rtl ? "rtl" : undefined}
        onInput={emit}
        onBlur={emit}
        onPaste={(event) => {
          event.preventDefault()
          document.execCommand("insertText", false, event.clipboardData.getData("text/plain"))
          emit()
        }}
        className={cn(
          "min-h-52 overflow-auto px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
          "[&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_h1]:mb-3 [&_h1]:text-base [&_h1]:font-semibold",
          "[&_p]:mb-3 [&_p:last-child]:mb-0",
          "[&_strong]:font-semibold [&_em]:italic",
          "[&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5",
          "empty:before:text-muted-foreground empty:before:content-['Add_translation…']"
        )}
      />
    </div>
  )
}

function Tool({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // The selection has to survive the click, and focusing a button clears it.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={iconButton}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 3: `components/templates/template-preview.tsx`**

```tsx
import { ChevronLeft, Mail, MoreVertical, Reply, Star } from "lucide-react"

import type { TemplateChannel, TemplateFieldId } from "@/lib/template-data"
import { previewHtml, previewText, sampleValues } from "@/lib/template-preview"
import { cn } from "@/lib/utils"
import { smsInfo } from "@/lib/validation"

type Values = Partial<Record<TemplateFieldId, string>>

/** The message as its reader gets it. Placeholders are filled with sample values. */
export function TemplatePreview({
  channel,
  values,
  appName,
  rtl,
}: {
  channel: TemplateChannel
  values: Values
  appName: string
  rtl?: boolean
}) {
  return (
    <div dir={rtl ? "rtl" : undefined} data-preview className="flex flex-col gap-3">
      {channel === "email" && <EmailPreview values={values} />}
      {channel === "sms" && <SmsPreview values={values} appName={appName} rtl={rtl} />}
      {channel === "notification" && <NotificationPreview values={values} appName={appName} />}
    </div>
  )
}

function NotTranslated() {
  return <span className="italic text-warning-foreground dark:text-warning">Not translated</span>
}

function EmailPreview({ values }: { values: Values }) {
  const subject = values.subject ?? ""
  const body = values.body ?? ""
  const cta = values.cta ?? ""
  const footer = values.footer ?? ""

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-start gap-2">
          <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="min-w-0 truncate text-sm font-semibold">{subject ? previewText(subject) : <NotTranslated />}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <ChevronLeft className="size-4 text-muted-foreground" />
          <div className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
            GS
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate font-medium">GrapeSEED Support</p>
            <p className="truncate text-muted-foreground">to {sampleValues["{email}"]}</p>
          </div>
          <Star className="size-3.5 text-muted-foreground" />
          <Reply className="size-3.5 text-muted-foreground" />
          <MoreVertical className="size-3.5 text-muted-foreground" />
        </div>

        <div className="bg-background px-5 py-5">
          {body ? (
            <div
              className="text-sm leading-relaxed [&>:first-child]:mt-0 [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:border-l [&_blockquote]:pl-3 [&_em]:italic [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:font-medium [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_small]:text-xs [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5"
              // `previewHtml` escapes the value and rebuilds only whitelisted tags.
              dangerouslySetInnerHTML={{ __html: previewHtml(body) }}
            />
          ) : (
            <p className="text-sm">
              <NotTranslated />
            </p>
          )}

          <div className="mt-5">
            <span className="inline-flex max-w-full items-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <span className={cn("truncate", !cta && "italic")}>{cta ? previewText(cta) : "Not translated"}</span>
            </span>
          </div>

          <p className="mt-5 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            {footer ? previewText(footer) : <NotTranslated />}
          </p>
        </div>
      </div>
    </>
  )
}

function SmsPreview({ values, appName, rtl }: { values: Values; appName: string; rtl?: boolean }) {
  const message = previewText(values.message ?? "")
  const info = smsInfo(message)

  return (
    <>
      <div className="mx-auto w-full max-w-xs rounded-[1.75rem] border-4 border-foreground/15 bg-muted/30 p-3">
        <p className="mb-3 text-center text-xs font-medium text-muted-foreground">{appName}</p>
        {message ? (
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-border bg-background px-3 py-2 text-sm wrap-break-word shadow-sm">
            {message}
          </div>
        ) : (
          <p className="text-center text-xs">
            <NotTranslated />
          </p>
        )}
      </div>

      <dl dir={rtl ? "ltr" : undefined} className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Encoding" value={info.encoding} />
        <Stat label="Chars" value={String(info.units)} />
        <Stat label="Segments" value={String(info.segments)} warn={info.segments > 1} />
      </dl>
    </>
  )
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono text-sm tabular-nums", warn && "text-warning-foreground dark:text-warning")}>{value}</dd>
    </div>
  )
}

function NotificationPreview({ values, appName }: { values: Values; appName: string }) {
  const title = previewText(values.title ?? "")
  const body = previewText(values.body ?? "")

  return (
    <>
      <div className="mx-auto w-full max-w-xs rounded-[1.75rem] border-4 border-foreground/15 bg-linear-to-b from-primary/20 via-muted to-muted/40 p-3">
        <p className="mb-4 mt-2 text-center text-4xl font-light tabular-nums text-muted-foreground">9:41</p>
        <div className="rounded-2xl border border-border bg-background/90 p-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex size-5 items-center justify-center rounded bg-primary text-[9px] font-bold text-primary-foreground">
              GS
            </div>
            <span className="flex-1 truncate text-[10px] font-medium uppercase text-muted-foreground">{appName}</span>
            <span className="text-[10px] text-muted-foreground">now</span>
          </div>
          <p className="mt-1.5 line-clamp-1 text-sm font-semibold">{title || <NotTranslated />}</p>
          <p className="line-clamp-2 text-sm text-muted-foreground">{body || <NotTranslated />}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-3">
        <p className="text-sm font-semibold">{title || <NotTranslated />}</p>
        <p className="text-sm text-muted-foreground">{body || <NotTranslated />}</p>
      </div>
    </>
  )
}
```

- [ ] **Step 4: Chạy gate**

Run: `npm run typecheck && npm test`
Expected: sạch / PASS. (Ba file này chưa được trang nào import; chúng được dựng thật ở Task 5 Step 5.)

- [ ] **Step 5: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo 2>/dev/null
git add hooks/use-templates.ts components/templates/rich-text-editor.tsx components/templates/template-preview.tsx
git commit -m "Add the templates hook, the mail-body editor and the per-channel preview"
```

---

### Task 4: Field editor và dialog

**Files:**
- Create: `components/templates/template-field-editor.tsx`, `components/templates/template-dialog.tsx`

**Interfaces:**
- Consumes: `RichTextEditor`, `TemplatePreview` (Task 3); `ownerProject` (Task 1); `iconButton`, `textButton`, `outlineButton`, `primaryButton` (Task 2); `StatusBadge`; shadcn `Dialog`, `DialogContent`, `DialogTitle`, `DialogDescription`, `Input`, `Textarea`; `saveTranslations`, `messageOf`; `copyText`; `checkTranslation`, `smsInfo`; `safeHtml`; `fieldOf`, `templateKeyOf`, `categoryLabel`; `displayedValueOf`, `languages`, `SOURCE_LANGUAGE`; `targetOf`.
- Produces:
  - `TemplateFieldEditor({ channel, field, value, current, isDirty, isKeepPending, language, profile, rtl?, readOnly?, onChange(field, value), onKeep(field), onConfirm(field) })`.
  - `TemplateDialog({ entry, project, language, onClose(), onSaved() })`.

- [ ] **Step 1: `components/templates/template-field-editor.tsx`**

```tsx
"use client"

import { useState } from "react"
import { AlertTriangle, ClipboardPaste, Code2, Copy, History, Info } from "lucide-react"
import { toast } from "sonner"

import { iconButton, textButton } from "@/components/button-styles"
import { StatusBadge } from "@/components/status-badge"
import { RichTextEditor } from "@/components/templates/rich-text-editor"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { copyText } from "@/lib/clipboard"
import { SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import type { ProjectProfile } from "@/lib/projects"
import type { TemplateChannel, TemplateField, TemplateFieldValue } from "@/lib/template-data"
import { safeHtml } from "@/lib/template-preview"
import { cn } from "@/lib/utils"
import { checkTranslation, smsInfo } from "@/lib/validation"

/** One field of a template: the English above, the translation below, the checks under that. */
export function TemplateFieldEditor({
  channel,
  field,
  value,
  current,
  isDirty,
  isKeepPending,
  language,
  profile,
  rtl,
  readOnly = false,
  onChange,
  onKeep,
  onConfirm,
}: {
  channel: TemplateChannel
  field: TemplateField
  value: TemplateFieldValue
  /** The live value - the saved one until someone types. */
  current: string
  isDirty: boolean
  isKeepPending: boolean
  language: LanguageCode
  profile: ProjectProfile
  rtl?: boolean
  readOnly?: boolean
  onChange: (field: TemplateField["id"], value: string) => void
  onKeep: (field: TemplateField["id"]) => void
  onConfirm: (field: TemplateField["id"]) => void
}) {
  const [showSource, setShowSource] = useState(false)

  const issues = readOnly
    ? []
    : checkTranslation(value.source, current, {
        language,
        lengthBudget: profile.lengthBudget,
        maxLength: field.maxLength,
        format: field.format,
      })
  const hasError = issues.some((issue) => issue.level === "error")
  const isKept = isKeepPending || (value.keptSource && current === value.source)
  // A kept value that went outdated is kept again rather than confirmed.
  const isStaleKeep = value.status === "outdated" && value.keptSource
  const canKeep =
    !readOnly &&
    (value.status === "missing" || isStaleKeep) &&
    !isKeepPending &&
    value.source !== "" &&
    language !== SOURCE_LANGUAGE
  const showOutdated = !readOnly && value.status === "outdated" && !isDirty

  const handleCopy = async () => {
    if (await copyText(value.source)) {
      toast.success(`${field.label} copied to the clipboard`)
    } else {
      toast.error("Could not copy", { description: "The browser blocked clipboard access for this page." })
    }
  }

  const shared = {
    value: current,
    dir: rtl ? ("rtl" as const) : undefined,
    placeholder: field.format === "html" ? "Add translation…" : value.source,
    "aria-label": `${field.label} translation`,
    onChange: (event: { target: { value: string } }) => onChange(field.id, event.target.value),
  }

  return (
    <section
      className={cn(
        "border-b border-l-2 border-border border-l-transparent px-5 py-4",
        isDirty && "border-l-primary bg-accent/30",
        hasError && "border-l-destructive"
      )}
    >
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{field.label}</h3>
        {!readOnly && <StatusBadge status={value.status} />}
        {!readOnly && isKept && <span className="text-[11px] text-muted-foreground">Kept as English</span>}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {canKeep && (
            <button type="button" className={textButton} onClick={() => onKeep(field.id)}>
              Keep English
            </button>
          )}
          {field.control === "rich" && (
            <button
              type="button"
              aria-pressed={showSource}
              onClick={() => setShowSource((on) => !on)}
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                showSource ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Code2 className="size-3.5" />
              HTML
            </button>
          )}
          <button
            type="button"
            className={iconButton}
            aria-label={`Copy the English ${field.label.toLowerCase()}`}
            title="Copy"
            onClick={handleCopy}
          >
            <Copy className="size-3.5" />
          </button>
          {!readOnly && (
            <button
              type="button"
              className={iconButton}
              aria-label={`Paste the English into the ${field.label.toLowerCase()}`}
              title="Paste"
              onClick={() => onChange(field.id, value.source)}
            >
              <ClipboardPaste className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {field.format === "html" && !showSource ? (
        <div
          className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground [&_a]:underline [&_li]:mb-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4"
          // Whitelisted and rebuilt by `safeHtml` - see `lib/template-preview.ts`.
          dangerouslySetInnerHTML={{ __html: safeHtml(value.source) }}
        />
      ) : (
        <p
          className={cn(
            "mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground",
            field.format === "html" && "font-mono"
          )}
        >
          {value.source}
        </p>
      )}

      {!readOnly && (
        <div className="mt-2">
          {field.control === "line" && <Input {...shared} />}
          {field.control === "paragraph" && <Textarea {...shared} className="min-h-20 resize-y" />}
          {field.control === "rich" &&
            (showSource ? (
              <Textarea {...shared} className="min-h-52 resize-y font-mono text-xs" />
            ) : (
              <RichTextEditor
                value={current}
                rtl={rtl}
                ariaLabel={`${field.label} translation`}
                onChange={(next) => onChange(field.id, next)}
              />
            ))}
        </div>
      )}

      <div className="mt-1.5 flex flex-col gap-1">
        {showOutdated && (
          <div className="flex items-center gap-2 text-xs text-info">
            <History className="size-3.5 shrink-0" />
            English changed
            {!isStaleKeep && (
              <button type="button" className={textButton} onClick={() => onConfirm(field.id)}>
                Still correct
              </button>
            )}
          </div>
        )}
        <Meter channel={channel} field={field} current={readOnly ? value.source : current} />
        {issues.map((issue) => (
          <p
            key={issue.id}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              issue.level === "error" ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {issue.level === "error" ? (
              <AlertTriangle className="size-3.5 shrink-0" />
            ) : (
              <Info className="size-3.5 shrink-0" />
            )}
            {issue.message}
          </p>
        ))}
      </div>
    </section>
  )
}

function Meter({ channel, field, current }: { channel: TemplateChannel; field: TemplateField; current: string }) {
  if (channel === "sms") {
    const info = smsInfo(current)
    return (
      <p
        className={cn(
          "font-mono text-xs tabular-nums",
          info.remaining <= 10 ? "text-warning-foreground dark:text-warning" : "text-muted-foreground"
        )}
      >
        {info.encoding} · {info.units} chars · {info.segments} {info.segments === 1 ? "segment" : "segments"}
      </p>
    )
  }

  const limit = field.budget ?? field.maxLength
  if (!limit) {
    return null
  }
  const over = current.length > limit
  return (
    <p
      className={cn(
        "font-mono text-xs tabular-nums",
        over ? "text-warning-foreground dark:text-warning" : "text-muted-foreground"
      )}
    >
      {current.length.toLocaleString()}/{limit.toLocaleString()}
    </p>
  )
}
```

- [ ] **Step 2: `components/templates/template-dialog.tsx`**

```tsx
"use client"

import { useState, type ReactNode } from "react"
import { Globe, Smartphone } from "lucide-react"
import { toast } from "sonner"

import { outlineButton, primaryButton } from "@/components/button-styles"
import { TemplateFieldEditor } from "@/components/templates/template-field-editor"
import { TemplatePreview } from "@/components/templates/template-preview"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { messageOf, saveTranslations } from "@/lib/api"
import { displayedValueOf, languages, SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"
import { categoryLabel, fieldOf, templateKeyOf, type TemplateEntry, type TemplateFieldId } from "@/lib/template-data"
import { ownerProject } from "@/lib/template-view"
import { cn } from "@/lib/utils"

type PreviewMode = "target" | "source"

/** Translating one template: the fields on the left, the message as its reader gets it on the right. */
export function TemplateDialog({
  entry,
  project,
  language,
  onClose,
  onSaved,
}: {
  entry: TemplateEntry
  project: Project
  language: LanguageCode
  onClose: () => void
  onSaved: () => void
}) {
  const { template, fields } = entry
  const [edits, setEdits] = useState<Partial<Record<TemplateFieldId, string>>>({})
  const [keeps, setKeeps] = useState<ReadonlySet<TemplateFieldId>>(new Set())
  const [mode, setMode] = useState<PreviewMode>("target")
  const [isSaving, setIsSaving] = useState(false)

  const languageInfo = languages.find((item) => item.code === language) ?? languages[0]
  const isSource = language === SOURCE_LANGUAGE
  const previewMode: PreviewMode = isSource ? "target" : mode
  const owner = ownerProject(template.owner)
  // The icon follows the project the label names - `app/parent` sends from Parent Portal, a website.
  const isMobile = owner.project ? owner.project.group === "mobile" : template.owner.kind === "app"
  const OwnerIcon = isMobile ? Smartphone : Globe

  const fieldValueOf = (field: TemplateFieldId) => fields.find((item) => item.field === field)

  const valueOf = (field: TemplateFieldId) => {
    const edited = edits[field]
    if (edited !== undefined) {
      return edited
    }
    const value = fieldValueOf(field)
    if (!value) {
      return ""
    }
    return keeps.has(field) ? value.source : displayedValueOf(value)
  }

  const dirtyFields = Object.keys(edits) as TemplateFieldId[]
  const pending = dirtyFields.length + keeps.size

  const handleChange = (field: TemplateFieldId, next: string) => {
    const value = fieldValueOf(field)
    setKeeps((current) => {
      if (!current.has(field)) {
        return current
      }
      const copy = new Set(current)
      copy.delete(field)
      return copy
    })
    setEdits((current) => {
      const copy = { ...current }
      if (value && next === displayedValueOf(value)) {
        delete copy[field]
      } else {
        copy[field] = next
      }
      return copy
    })
  }

  const handleKeep = (field: TemplateFieldId) => {
    setEdits((current) => {
      const copy = { ...current }
      delete copy[field]
      return copy
    })
    setKeeps((current) => new Set(current).add(field))
  }

  // An outdated value that still holds is confirmed by writing it back.
  const handleConfirm = (field: TemplateFieldId) => {
    const value = fieldValueOf(field)
    if (value) {
      setEdits((current) => ({ ...current, [field]: value.target }))
    }
  }

  const handleDiscard = () => {
    setEdits({})
    setKeeps(new Set())
  }

  const requestClose = () => {
    if (pending > 0 && !window.confirm(`Discard ${pending} unsaved ${pending === 1 ? "field" : "fields"}?`)) {
      return
    }
    onClose()
  }

  const handleSave = async () => {
    const values: Record<string, string> = {}
    for (const field of dirtyFields) {
      values[templateKeyOf(template.id, field)] = edits[field] ?? ""
    }
    const keepKeys = [...keeps].map((field) => templateKeyOf(template.id, field))

    setIsSaving(true)
    try {
      const { saved, file } = await saveTranslations(targetOf(project), language, values, keepKeys)
      setEdits({})
      setKeeps(new Set())
      onSaved()
      toast.success(`Saved ${saved} ${saved === 1 ? "field" : "fields"} of ${template.name}`, {
        description: `Written to ${file}`,
      })
    } catch (cause: unknown) {
      toast.error("Could not save", { description: messageOf(cause) })
    } finally {
      setIsSaving(false)
    }
  }

  const previewValues: Partial<Record<TemplateFieldId, string>> = {}
  for (const field of fields) {
    previewValues[field.field] = previewMode === "source" ? field.source : valueOf(field.field)
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          requestClose()
        }
      }}
    >
      <DialogContent className="grid h-[min(50rem,calc(100dvh-2rem))] w-[min(84rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0 sm:max-w-none">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border px-5 py-3 pr-12">
          <DialogTitle className="text-base font-semibold tracking-tight">{template.name}</DialogTitle>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {categoryLabel[template.category]}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <OwnerIcon className="size-3.5" />
            {owner.label}
          </span>
          <DialogDescription className="sr-only">{template.id}</DialogDescription>
        </header>

        <div className="grid min-h-0 grid-cols-1 lg:grid-cols-2">
          <div className="min-h-0 overflow-auto border-border lg:border-r">
            {fields.map((field) => (
              <TemplateFieldEditor
                key={field.field}
                channel={template.channel}
                field={fieldOf(template.channel, field.field)}
                value={field}
                current={valueOf(field.field)}
                isDirty={field.field in edits || keeps.has(field.field)}
                isKeepPending={keeps.has(field.field)}
                language={language}
                profile={project.profile}
                rtl={languageInfo.rtl ?? false}
                readOnly={isSource}
                onChange={handleChange}
                onKeep={handleKeep}
                onConfirm={handleConfirm}
              />
            ))}
          </div>

          <div className="min-h-0 overflow-auto bg-muted/20">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-card/80 px-5 py-2 backdrop-blur">
              <h3 className="text-sm font-medium">Preview</h3>
              <div className="ml-auto flex gap-1">
                <ModeButton isActive={previewMode === "target"} onClick={() => setMode("target")}>
                  {languageInfo.name}
                </ModeButton>
                {!isSource && (
                  <ModeButton isActive={previewMode === "source"} onClick={() => setMode("source")}>
                    English
                  </ModeButton>
                )}
              </div>
            </div>
            <div className="p-5">
              <TemplatePreview
                channel={template.channel}
                values={previewValues}
                appName={owner.label}
                rtl={previewMode === "target" && (languageInfo.rtl ?? false)}
              />
            </div>
          </div>
        </div>

        <footer className="flex items-center gap-3 border-t border-border bg-muted/40 px-5 py-3">
          {!isSource && (
            <span className="text-sm text-muted-foreground">
              {pending > 0
                ? `${pending} unsaved ${pending === 1 ? "field" : "fields"}`
                : `${entry.translated}/${entry.total} fields translated`}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className={outlineButton}
              disabled={isSaving}
              onClick={pending > 0 ? handleDiscard : onClose}
            >
              {pending > 0 ? "Discard" : "Close"}
            </button>
            {!isSource && (
              <button
                type="button"
                className={primaryButton}
                disabled={isSaving || pending === 0}
                onClick={handleSave}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            )}
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  )
}

function ModeButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
        isActive
          ? "pointer-events-none border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 3: Chạy gate**

Run: `npm run typecheck && npm test`
Expected: sạch / PASS.

- [ ] **Step 4: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo 2>/dev/null
git add components/templates/template-field-editor.tsx components/templates/template-dialog.tsx
git commit -m "Add the template field editor and the two-panel translate dialog"
```

---

### Task 5: Bảng, trang kênh, nối vào route; kiểm tra toàn bộ

**Files:**
- Create: `components/templates/template-table.tsx`, `components/templates/template-workspace.tsx`
- Modify: `components/translation-workspace.tsx` (bộ chọn dùng `TemplateWorkspace`)

**Interfaces:**
- Consumes: mọi thứ của Task 1–4; `ExportDialog`; `PopoverMenu`; `useCoverage`, `useWorkspaceParams`; `outstandingOf` (`lib/coverage.ts`); `formatDate`; `projectPath`.
- Produces: `TemplateTable({ channel, entries, openId?, showProgress, onOpen(id) })`, `TemplateWorkspace({ project })`.

- [ ] **Step 1: `components/templates/template-table.tsx`**

```tsx
"use client"

import Link from "next/link"
import { AlertTriangle, History } from "lucide-react"

import { outstandingOf } from "@/lib/coverage"
import { formatDate } from "@/lib/format-date"
import { projectPath } from "@/lib/projects"
import { categoryLabel, type TemplateChannel, type TemplateEntry } from "@/lib/template-data"
import { ownerProject } from "@/lib/template-view"
import { cn } from "@/lib/utils"
import { smsInfo } from "@/lib/validation"

const head = "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
const cell = "px-4 py-3 align-top"

/** One row per message, opened for translation by clicking it. */
export function TemplateTable({
  channel,
  entries,
  openId,
  showProgress,
  onOpen,
}: {
  channel: TemplateChannel
  entries: TemplateEntry[]
  openId?: string
  showProgress: boolean
  onOpen: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/40">
          <tr>
            <th className={head}>Template</th>
            <th className={cn(head, "w-32")}>Recipient</th>
            <th className={cn(head, "w-48")}>Sent from</th>
            <th className={cn(head, "w-40")}>Created</th>
            <th className={cn(head, "w-40")}>Updated</th>
            {channel === "sms" && <th className={cn(head, "w-28 text-right")}>Segments</th>}
            {showProgress && <th className={cn(head, "w-64")}>Translation</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => {
            const { template } = entry
            const isOpen = template.id === openId
            const needsWork = showProgress && outstandingOf(entry) > 0
            const owner = ownerProject(template.owner)

            return (
              <tr
                key={template.id}
                onClick={() => onOpen(template.id)}
                className={cn("cursor-pointer transition-colors hover:bg-accent/30", isOpen && "bg-accent/40")}
              >
                <td
                  className={cn(
                    cell,
                    isOpen
                      ? "shadow-[inset_2px_0_0_var(--color-primary)]"
                      : needsWork && "shadow-[inset_2px_0_0_var(--color-warning)]"
                  )}
                >
                  <div className="font-medium">{template.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{template.id}</div>
                </td>
                <td className={cell}>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {categoryLabel[template.category]}
                  </span>
                </td>
                <td className={cell}>
                  {owner.project ? (
                    <Link
                      href={projectPath(owner.project)}
                      onClick={(event) => event.stopPropagation()}
                      className="hover:underline"
                    >
                      {owner.label}
                    </Link>
                  ) : (
                    <span>{owner.label}</span>
                  )}
                </td>
                <td className={cell}>
                  <Stamp by={template.createdBy} at={template.createdAt} />
                </td>
                <td className={cell}>
                  {entry.updated ? (
                    <Stamp by={entry.updated.by} at={entry.updated.at} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                {channel === "sms" && (
                  <td className={cn(cell, "text-right")}>
                    <Segments entry={entry} />
                  </td>
                )}
                {showProgress && (
                  <td className={cell}>
                    <Progress entry={entry} />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Stamp({ by, at }: { by: string; at: string }) {
  return (
    <div className="grid gap-0.5">
      <span>{by}</span>
      <span className="text-xs text-muted-foreground">{formatDate(at)}</span>
    </div>
  )
}

function Segments({ entry }: { entry: TemplateEntry }) {
  const message = entry.fields.find((field) => field.field === "message")
  if (!message?.target) {
    return <span className="text-muted-foreground">—</span>
  }
  const target = smsInfo(message.target)
  const source = smsInfo(message.source)
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        target.segments > source.segments ? "text-warning-foreground dark:text-warning" : "text-muted-foreground"
      )}
    >
      {target.segments}/{source.segments}
    </span>
  )
}

function Progress({ entry }: { entry: TemplateEntry }) {
  const percent = entry.total ? Math.round((entry.translated / entry.total) * 100) : 0
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs font-medium tabular-nums">
        {entry.translated}/{entry.total}
      </span>
      {entry.outdated > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-info/12 px-1.5 py-0.5 text-[11px] font-semibold text-info">
          <History className="size-3" />
          {entry.outdated} outdated
        </span>
      )}
      {entry.needsFix > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold text-warning-foreground dark:text-warning">
          <AlertTriangle className="size-3" />
          {entry.needsFix} to fix
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `components/templates/template-workspace.tsx`**

```tsx
"use client"

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, ChevronDown, RotateCw } from "lucide-react"

import { outlineButton } from "@/components/button-styles"
import { PopoverMenu } from "@/components/popover-menu"
import { SkeletonRows } from "@/components/skeleton-rows"
import { StatCard } from "@/components/stat-card"
import { TemplateDialog } from "@/components/templates/template-dialog"
import { TemplateTable } from "@/components/templates/template-table"
import { ExportDialog } from "@/components/translations/export-dialog"
import { UnderlineTabs } from "@/components/underline-tabs"
import { WorkspaceHeader } from "@/components/workspace-header"
import { useCoverage } from "@/hooks/use-coverage"
import { useTemplates } from "@/hooks/use-templates"
import { useWorkspaceParams } from "@/hooks/use-workspace-params"
import { languages, SOURCE_LANGUAGE } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"
import { categoryLabel, type TemplateCategory, type TemplateChannel } from "@/lib/template-data"
import {
  TEMPLATE_ALL,
  categoriesOf,
  filterTemplates,
  ownersOf,
  parseTemplateFilters,
  resolveOwner,
  summarise,
} from "@/lib/template-view"

/** Route `/messages/:channel` - the channel's templates, and the dialog that translates one. */
export function TemplateWorkspace({ project }: { project: Project }) {
  const target = targetOf(project)
  const channel = project.profile.kind as TemplateChannel
  const filters = parseTemplateFilters(useSearchParams())
  const { setParam } = useWorkspaceParams()
  const { language } = filters
  const { revision, refresh } = useCoverage()
  const { templates, isLoading, error } = useTemplates(target, language, revision)
  const [isExportOpen, setExportOpen] = useState(false)

  const owner = resolveOwner(filters.owner, templates, isLoading)
  const beforeCategory = useMemo(
    () => filterTemplates(templates, { category: TEMPLATE_ALL, owner, status: filters.status, q: filters.q }),
    [templates, owner, filters.status, filters.q]
  )
  const visible = useMemo(
    () => filterTemplates(beforeCategory, { category: filters.category, owner: TEMPLATE_ALL, status: "all", q: "" }),
    [beforeCategory, filters.category]
  )
  const categories = useMemo(() => categoriesOf(templates, beforeCategory), [templates, beforeCategory])
  const owners = useMemo(() => ownersOf(templates), [templates])
  const totals = useMemo(() => summarise(templates), [templates])

  const languageInfo = languages.find((item) => item.code === language) ?? languages[0]
  const isSource = language === SOURCE_LANGUAGE
  const hasTemplates = templates.length > 0
  const open = filters.template ? templates.find((entry) => entry.template.id === filters.template) : undefined

  const tabs = [
    { id: TEMPLATE_ALL as TemplateCategory | typeof TEMPLATE_ALL, label: "All", count: beforeCategory.length },
    ...categories.map((item) => ({ id: item.category, label: categoryLabel[item.category], count: item.count })),
  ]

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      <WorkspaceHeader
        project={project}
        section="Templates"
        badges={
          isSource ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
              View only
            </span>
          ) : null
        }
        subtitle={
          <>
            Managing <span className="font-medium text-foreground">{languageInfo.name}</span> translations ·{" "}
            {templates.length} {templates.length === 1 ? "template" : "templates"}
          </>
        }
        canExport={hasTemplates}
        onExport={() => setExportOpen(true)}
      />

      {!isSource && (isLoading || hasTemplates) && (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Translation progress"
            value={isLoading ? "—" : `${totals.percent}%`}
            accent="primary"
            active={filters.status === "all"}
            onClick={() => setParam("status", null)}
          >
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${totals.percent}%` }} />
            </div>
          </StatCard>
          <StatCard
            label="Translated"
            value={isLoading ? "—" : totals.translated.toLocaleString()}
            accent="success"
            active={filters.status === "translated"}
            onClick={() => setParam("status", "translated")}
          />
          <StatCard
            label="Needs fix"
            value={isLoading ? "—" : totals.needsFix.toLocaleString()}
            accent="warning"
            active={filters.status === "needs_fix"}
            onClick={() => setParam("status", "needs_fix")}
          />
          <StatCard
            label="Missing"
            value={isLoading ? "—" : totals.missing.toLocaleString()}
            detail={isLoading ? undefined : `${totals.outdated.toLocaleString()} outdated`}
            accent="destructive"
            active={filters.status === "missing" || filters.status === "outdated"}
            onClick={() => setParam("status", "missing")}
          />
        </div>
      )}

      {hasTemplates && (
        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-b border-border">
          <UnderlineTabs
            items={tabs}
            value={filters.category}
            onChange={(id) => setParam("category", id === TEMPLATE_ALL ? null : id)}
          />
          <div className="flex items-center gap-2 pb-2">
            <ProductFilter
              value={owner}
              owners={owners}
              onChange={(key) => setParam("owner", key === TEMPLATE_ALL ? null : key)}
            />
            <span className="rounded-full border border-border bg-card px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">
              {visible.length} {visible.length === 1 ? "template" : "templates"}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 pb-10">
        {error ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>
              Could not load {project.name}: {error}
            </span>
            <button type="button" onClick={refresh} className={outlineButton}>
              <RotateCw className="size-4" />
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <SkeletonRows />
        ) : !hasTemplates ? (
          <p className="rounded-xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
            No templates in this channel yet.
          </p>
        ) : visible.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card py-16 text-center text-sm text-muted-foreground">
            No templates match these filters.
          </p>
        ) : (
          <TemplateTable
            channel={channel}
            entries={visible}
            openId={open?.template.id}
            showProgress={!isSource}
            onOpen={(id) => setParam("template", id)}
          />
        )}
      </div>

      {open && (
        <TemplateDialog
          key={`${open.template.id}:${language}`}
          entry={open}
          project={project}
          language={language}
          onClose={() => setParam("template", null)}
          onSaved={refresh}
        />
      )}
      {hasTemplates && (
        <ExportDialog open={isExportOpen} onOpenChange={setExportOpen} project={project} language={language} />
      )}
    </div>
  )
}

function ProductFilter({
  value,
  owners,
  onChange,
}: {
  value: string
  owners: { key: string; label: string }[]
  onChange: (key: string) => void
}) {
  const current = owners.find((item) => item.key === value)
  const options = [{ key: TEMPLATE_ALL, label: "All products" }, ...owners]

  return (
    <div className="w-fit">
      <PopoverMenu
        label="product menu"
        widthClass="w-60"
        trigger={(toggle) => (
          <button
            type="button"
            onClick={toggle}
            className="flex h-8 w-52 items-center justify-between gap-2 rounded-lg border border-input bg-card px-2.5 text-sm transition-colors hover:bg-accent/40"
          >
            <span className="truncate">{current?.label ?? "All products"}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}
      >
        {(close) => (
          <div className="max-h-80 overflow-y-auto">
            {options.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  onChange(item.key)
                  close()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent/50"
              >
                <span className="flex-1 truncate">{item.label}</span>
                {item.key === value && <Check className="size-4 text-primary" />}
              </button>
            ))}
          </div>
        )}
      </PopoverMenu>
    </div>
  )
}
```

- [ ] **Step 3: Nối `TemplateWorkspace` vào bộ chọn**

Trong `components/translation-workspace.tsx`:

1. Thêm `import { TemplateWorkspace } from "@/components/templates/template-workspace"`.
2. Thay:

```tsx
export function TranslationWorkspace({ project }: { project: Project }) {
  if (project.profile.kind !== "ui") {
    return (
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <ProjectProfileCard
          project={project}
          title={`${project.name} templates`}
          message="The template editor for this channel is coming soon."
        />
      </div>
    )
  }
  return <UiWorkspace project={project} />
}
```

bằng:

```tsx
export function TranslationWorkspace({ project }: { project: Project }) {
  return project.profile.kind === "ui" ? <UiWorkspace project={project} /> : <TemplateWorkspace project={project} />
}
```

(`ProjectProfileCard` vẫn được `UiWorkspace` dùng cho project chưa có key, nên import của nó giữ nguyên.)

- [ ] **Step 4: Chạy gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: `tsc` sạch; mọi test PASS; build hoàn tất (route `/[group]/[project]`, `/import`, `/`). Sau đó: `git checkout -- next-env.d.ts tsconfig.tsbuildinfo`.

- [ ] **Step 5: Kiểm tra UI bằng Chrome headless**

Dùng driver `cdp.mjs` ở scratchpad (Chrome headless, profile mới mỗi lần chạy, các đoạn JS phân cách bằng `---`, helper `sleep`, `text()`, `until`, `byText`, `click`, `type`, `field`). Dev server của người dùng chạy ở `:3000` — không dừng nó. Mỗi đoạn đầu trang chờ hydrate trước khi thao tác.

Tạo `steps-templates.txt`:

```text
await until(() => document.querySelectorAll("main tbody tr").length > 0 && Object.keys(document.querySelector("main tbody tr") ?? {}).some((k) => k.startsWith("__react")), 30000); await sleep(500)
const rows = [...document.querySelectorAll("main tbody tr")]
return { stats: [...document.querySelectorAll("main button[aria-pressed]")].map((b) => b.innerText.replace(/\n/g, " ")), tabs: [...document.querySelectorAll("main .border-b button")].map((b) => b.innerText.replace(/\n/g, "")).slice(0, 6), rows: rows.length, visit: rows.find((r) => r.innerText.includes("visitation_scheduled"))?.innerText.includes("1 to fix") }
---
click([...document.querySelectorAll("main button[aria-pressed]")].find((b) => b.innerText.startsWith("Needs fix"))); await sleep(600)
const needsFix = document.querySelectorAll("main tbody tr").length
click([...document.querySelectorAll("main button[aria-pressed]")].find((b) => b.innerText.startsWith("Translation progress"))); await sleep(600)
click([...document.querySelectorAll("main button")].find((b) => b.textContent.includes("All products"))); await sleep(300)
click(byText("main button", "Parent Portal")); await sleep(600)
const parent = document.querySelectorAll("main tbody tr").length
click([...document.querySelectorAll("main button")].find((b) => b.textContent.includes("Parent Portal"))); await sleep(300)
click(byText("main button", "All products")); await sleep(600)
const input = document.querySelector("header input"); input.focus(); type(input, "visitation_scheduled"); await sleep(800)
const searched = document.querySelectorAll("main tbody tr").length
type(input, ""); input.blur(); await sleep(800)
return { needsFix, parent, searched, back: document.querySelectorAll("main tbody tr").length }
---
click([...document.querySelectorAll("main tbody tr")].find((r) => r.innerText.includes("visitation_scheduled"))); await until(() => document.querySelector('[role="dialog"]'), 10000); await sleep(500)
const dialog = () => document.querySelector('[role="dialog"]')
const htmlError = /closes|never closed|has no opening tag/.test(dialog().innerText)
const bodySection = [...dialog().querySelectorAll("section")].find((s) => s.querySelector("h3")?.textContent === "Body")
click([...bodySection.querySelectorAll("button")].find((b) => b.textContent.includes("HTML"))); await sleep(300)
const area = bodySection.querySelector("textarea"); type(area, area.value + "</p>"); await sleep(300)
const helperWhileEditing = ["Unsaved", "Placeholders in this template", "(English:", "likely to be cut off", "In the inbox"].filter((s) => dialog().innerText.includes(s))
click([...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === "Save"))
const toast = await until(() => text().match(/Saved 1 field of [^\n]*/)?.[0], 15000)
await sleep(1000)
return { htmlError, helperWhileEditing, toast, fixedInDialog: !/never closed/.test(dialog().innerText), stillOpen: !!dialog() }
---
const d = () => document.querySelector('[role="dialog"]')
const subject = d().querySelector('[aria-label="Subject translation"]'); type(subject, subject.value + " !"); await sleep(300)
window.confirm = () => false
d().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(500)
const keptOpen = !!d() && d().innerText.includes("1 unsaved field")
window.confirm = () => true
d().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await sleep(800)
return { keptOpen, closed: !d(), url: location.search, needsFixNow: [...document.querySelectorAll("main button[aria-pressed]")].find((b) => b.innerText.startsWith("Needs fix"))?.innerText.replace(/\n/g, " ") }
---
click([...document.querySelectorAll("main tbody tr")].find((r) => r.innerText.includes("invite_coach"))); await until(() => document.querySelector('[role="dialog"]'), 10000); await sleep(500)
const d = () => document.querySelector('[role="dialog"]')
const preview = () => d().querySelector("[data-preview]").innerText
const vi = preview()
click([...d().querySelectorAll("button")].find((b) => b.textContent.trim() === "English")); await sleep(300)
const en = preview()
click([...d().querySelectorAll("button")].find((b) => b.textContent.trim() === "Vietnamese")); await sleep(300)
const bodySection = [...d().querySelectorAll("section")].find((s) => s.querySelector("h3")?.textContent === "Body")
click([...bodySection.querySelectorAll("button")].find((b) => b.textContent.includes("HTML"))); await sleep(300)
type(bodySection.querySelector("textarea"), '<p><img src=x onerror="window.__pwned=1">Hi</p><script>window.__pwned=2</script>'); await sleep(800)
const escaped = preview().includes("<img") || preview().includes("<script")
return { previewChanges: vi !== en, pwned: window.__pwned ?? null, escaped }
---
click([...document.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent.trim() === "Discard")); await sleep(300)
const subject = document.querySelector('[aria-label="Subject translation"]'); type(subject, "Typed in Vietnamese"); await sleep(300)
// The modal blocks the topbar, so change the language the way a link or a history step does. Next syncs
// `useSearchParams` with `history.replaceState`.
history.replaceState(null, "", location.pathname + "?lang=ja&template=invite_coach"); await sleep(1500)
const ja = document.querySelector('[aria-label="Subject translation"]')?.value
return { url: location.search, jaSubjectIsNotTyped: ja !== undefined && ja !== "Typed in Vietnamese", unsaved: /unsaved field/.test(document.querySelector('[role="dialog"]')?.innerText ?? "") }
---
location.href = "/messages/email?lang=en&template=invite_coach"; await sleep(2500)
---
await until(() => document.querySelector('[role="dialog"]'), 20000); await sleep(500)
const d = document.querySelector('[role="dialog"]')
return { viewOnly: text().includes("View only"), statCards: document.querySelectorAll("main button[aria-pressed]").length, inputs: d.querySelectorAll('[aria-label$=" translation"]').length, save: [...d.querySelectorAll("button")].some((b) => b.textContent.trim() === "Save") }
---
location.href = "/messages/sms?lang=vi&template=sms_otp"; await sleep(2500)
---
await until(() => document.querySelector('[role="dialog"]'), 20000); await sleep(500)
const d = document.querySelector('[role="dialog"]')
return { segmentsColumn: [...document.querySelectorAll("main th")].some((th) => th.textContent === "Segments"), meter: /(GSM-7|UCS-2) · \d+ chars · \d+ segments?/.test(d.innerText), stats: ["Encoding", "Chars", "Segments"].every((s) => d.querySelector("[data-preview]").innerText.toUpperCase().includes(s.toUpperCase())), helper: /A segment holds/.test(d.innerText) }
---
location.href = "/messages/sms?lang=ar-SA&template=sms_otp"; await sleep(2500)
---
await until(() => document.querySelector('[role="dialog"] [data-preview]'), 20000); await sleep(500)
const d = document.querySelector('[role="dialog"]')
const rtl = d.querySelector("[data-preview]").getAttribute("dir")
click([...d.querySelectorAll("button")].find((b) => b.textContent.trim() === "English")); await sleep(300)
return { rtl, afterEnglish: d.querySelector("[data-preview]").getAttribute("dir") }
---
location.href = "/messages/notification?lang=vi&template=push_story_ready"; await sleep(2500)
---
await until(() => document.querySelector('[role="dialog"] [data-preview]'), 20000); await sleep(500)
const p = document.querySelector('[role="dialog"] [data-preview]').innerText
return { lockScreen: p.includes("9:41"), expandedLabel: /Expanded/.test(p) }
---
location.href = "/messages/email?lang=vi&template=nope&owner=nope&category=alien&status=bogus"; await sleep(2500)
---
await until(() => document.querySelectorAll("main tbody tr").length > 0, 20000); await sleep(500)
const helpers = ["Placeholders in this template", "A segment holds", "likely to be cut off", "(English:", "In the inbox", "Expanded", "English changed since this was translated", "not translated yet", "sample-data/templates.json"].filter((s) => document.body.innerText.includes(s))
return { dialog: !!document.querySelector('[role="dialog"]'), product: text().includes("All products"), rows: document.querySelectorAll("main tbody tr").length, helpers }
```

Run (từ scratchpad): `node cdp.mjs "<scratchpad>/chrome-templates-1" "http://localhost:3000/messages/email?lang=vi" steps-templates.txt`

Expected (mỗi dòng JSON theo thứ tự; dòng `undefined` là bước điều hướng):
1. `stats`: `["Translation progress 98%", "Translated 39", "Needs fix 1", "Missing 0 0 outdated"]`; `tabs`: `["All10", "Coach2", "Teacher3", "Parent2", "Student1", "Admin2"]`; `rows: 10`; `visit: true`.
2. `needsFix: 1`, `parent: 2`, `searched: 1`, `back: 10`.
3. `htmlError: true`, `helperWhileEditing: []`, `toast` bắt đầu "Saved 1 field of", `fixedInDialog: true`, `stillOpen: true`.
4. `keptOpen: true`, `closed: true`, `url` không còn `template=`, `needsFixNow` là `Needs fix 0`.
5. `previewChanges: true`, `pwned: null`, `escaped: true`.
6. `url` chứa `lang=ja`, `jaSubjectIsNotTyped: true`, `unsaved: false`.
7. (điều hướng)
8. `viewOnly: true`, `statCards: 0`, `inputs: 0`, `save: false`.
9. (điều hướng)
10. `segmentsColumn: true`, `meter: true`, `stats: true`, `helper: false`.
11. (điều hướng)
12. `rtl: "rtl"`, `afterEnglish: null`.
13. (điều hướng)
14. `lockScreen: true`, `expandedLabel: false`.
15. (điều hướng)
16. `dialog: false`, `product: true`, `rows: 10`, `helpers: []`.

Bước 3 sửa dữ liệu trong profile headless riêng của lần chạy này, không đụng dữ liệu trong trình duyệt của người dùng.

- [ ] **Step 6: Commit**

```bash
git add components/templates/template-table.tsx components/templates/template-workspace.tsx components/translation-workspace.tsx
git commit -m "Add the message template screens for email, SMS and notification"
```
