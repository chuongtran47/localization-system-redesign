# Import wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm trang `/import` cho phép nhập một đợt file ngôn ngữ JSON vào một project, xem diff kiểu pull request trước khi ghi, với merge/replace và retire key — behavior theo repo tham chiếu, UI theo style của repo này.

**Architecture:** Logic đọc file và tính diff (`lib/bundle-diff.ts`) port nguyên từ repo tham chiếu; logic nhóm/đánh số của diff view (`lib/diff-groups.ts`) và các quy tắc của wizard (`lib/import-plan.ts`) tách thành hàm thuần có test. Trang `app/(workspace)/import/page.tsx` nằm trong route group sẵn có nên dùng chung shell, `DraftProvider`, `CoverageProvider`. Không có route API mới — dùng `importBundle`, `deleteKeys`, `fetchEntries` đã có trong `lib/api.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, Tailwind v4, shadcn base-nova (Checkbox, Label), @tanstack/react-virtual, sonner, vitest.

**Spec:** [docs/superpowers/specs/2026-09-28-import-wizard-design.md](../specs/2026-09-28-import-wizard-design.md) (nền: [2026-09-27-foundation-workspace-parity-design.md](../specs/2026-09-27-foundation-workspace-parity-design.md))

**Repo tham chiếu:** `D:\example_projects\localizer` (Git Bash: `/d/example_projects/localizer`). Mọi lệnh bash chạy từ gốc repo này, trên branch `feat/workspace-parity`.

## Global Constraints

- Tên file kebab-case. Không thêm dependency mới (mọi thứ cần đã có: `@tanstack/react-virtual`, `sonner`, shadcn `checkbox`/`label`).
- `lib/api.ts` là module duy nhất chạm backend; không component/hook nào gọi `fetch`.
- Luật domain chỉ ở `lib/`; `components/ui/` không sửa tay.
- Không đổi theme tokens. Màu dùng token: `primary`, `success`, `warning` (chữ `text-warning-foreground dark:text-warning`), `destructive`, `info`, `muted`.
- Class UI của repo: card `rounded-xl border border-border bg-card`, nhãn `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`, pill `rounded-full`, nút hand-rolled `h-9 rounded-lg`.
- Không dùng `overflow-hidden` trên container chứa `PopoverMenu` (panel là `absolute`, sẽ bị cắt).
- Chế độ mặc định `merge`. Retire chỉ khi `replace`, có key cần retire, và mọi file ghi thành công. Khi ≥ 1 file thành công: luôn `clearTarget` draft của project rồi `coverage.refresh()`.
- Commit message không có dòng `Co-Authored-By` hay attribution Claude/Anthropic.
- Gate mỗi task: `npm run typecheck` và `npm test`. Task cuối thêm `npm run build`. (`next build` không type-check vì `ignoreBuildErrors: true`.)

## Sai khác có chủ đích so với spec

1. **Tên fixture là `tests/fixtures/import.vi.json`, không phải `import-vi.json`.** `languageFromName` (spec §3.3) tách theo `.` và `_`, không tách `-`, nên `import-vi.json` không tự nhận Vietnamese — mâu thuẫn với bước kiểm tra UI (§6) nói fixture tự nhận ngôn ngữ. `import.vi.json` thỏa cả hai. Test `languageFromName` ghi rõ `import-vi.json → null`.
2. **Thêm `pendingInTarget(state, target)` vào `lib/drafts.ts`** — bước 4 cần đếm draft của project để cảnh báo (spec §4.2); spec chỉ nêu `clearTarget`.
3. **Kết quả import tự xóa khi đợt thay đổi** — thêm/gỡ file, đổi ngôn ngữ của file, bật/tắt replace, đổi project đều xóa `outcome` để Confirm dùng lại được. Repo tham chiếu chỉ xóa khi thêm file hoặc đổi app; người dùng đổi ngôn ngữ sau khi import sẽ kỳ vọng import lại được.
4. **`BundleDiffView` được key theo `file.id:language`** — bộ lọc và trạng thái thu gọn reset khi xem file khác (bản tham chiếu giữ nguyên qua các file).
5. **Tách class nút sang `components/button-styles.ts`** — wizard và workspace cùng dùng `outlineButton`/`primaryButton`/`destructiveButton`; trước đây chúng là hằng cục bộ trong `translation-workspace.tsx`.
6. **`useTargetBundles` nhận thêm `revision`** (từ `useCoverage`) — Retry khi tải lỗi và làm mới sau import đều qua `refresh()`, không cần API riêng.

## Review Focus

1. **Đổi project khi đã nạp file** — diff phải đọc lại theo project mới, không dùng rows của project cũ. → Task 6 kiểm bằng CDP.
2. **Sửa đợt sau khi đã có kết quả** (đổi ngôn ngữ, gỡ file, bật replace) — kết quả biến mất và Confirm dùng lại được. → Task 6 kiểm bằng CDP.
3. **Import vào project chưa có key** — mọi key hợp lệ là New và import thành công. → Task 1 có test router.
4. **Cùng một ngôn ngữ hai lần** (thả cùng file hai lần) — cả hai bị đánh dấu, Confirm khóa. → Task 3 test `duplicatedLanguages`/`blockerOf`; Task 6 kiểm bằng CDP.
5. **Ghi thành công một phần** — không retire, nhưng vẫn xóa draft và refresh. → Task 3 test `afterImport`.

---

### Task 1: Port `bundle-diff`, fixture, test router cho `PUT /import`

**Files:**
- Create (port): `lib/bundle-diff.ts`
- Create: `tests/fixtures/import.vi.json`
- Test: `tests/bundle-diff.test.ts`; Modify: `tests/router.test.ts` (thêm `describe("import")`)

**Interfaces:**
- Consumes: `groupKeyOf`, `isValidKey`, `SOURCE_LANGUAGE`, `LanguageCode`, `LocaleBundle`, `TranslationRow` (`lib/locale-data.ts`); `checkTranslation`, `RowIssue` (`lib/validation.ts`); `ImportMode` (`lib/api-types.ts`).
- Produces (`lib/bundle-diff.ts`): `class BundleFileError`, `type DiffKind = "new" | "added" | "changed" | "removed" | "unchanged"`, `type DiffEntry = { key, group, kind, before, after, source, issues: RowIssue[] }`, `type DiffCounts = Record<DiffKind, number>`, `type BundleDiff = { entries, counts, invalid: string[], errors: number }`, `CHANGED_KINDS: DiffKind[]`, `parseBundleFile(text): LocaleBundle`, `diffBundle(rows, incoming, { mode, language, lengthBudget, maxLength? }): BundleDiff`, `changeCount(counts): number`.

- [ ] **Step 1: Tạo fixture**

`tests/fixtures/import.vi.json`:

```json
{
  "user": { "form": { "actions": { "cancel": "Hủy bỏ" } } },
  "home.brand.fresh": "Mới",
  "bad key.x": "x"
}
```

- [ ] **Step 2: Viết test (sẽ fail)**

`tests/bundle-diff.test.ts`:

```ts
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
```

Trong `tests/router.test.ts`:
- Thêm vào đầu file: `import { readFileSync } from "node:fs"` và `import { parseBundleFile } from "@/lib/bundle-diff"`.
- Thêm `ImportResponse,` vào danh sách `import type { … } from "@/lib/api-types"`.
- Thêm cuối file:

```ts
describe("import", () => {
  const fixture = parseBundleFile(readFileSync(new URL("./fixtures/import.vi.json", import.meta.url), "utf8"))

  it("merges a file, registers a new key and skips an invalid name", async () => {
    const { status, body } = await callJson<ImportResponse>(store, "PUT", `/import/vi?target=${SCHOOL}`, {
      values: fixture,
      mode: "merge",
      by: "T",
    })
    expect(status).toBe(200)
    expect(body).toMatchObject({ created: 1, added: 0, changed: 1, removed: 0, unchanged: 499, invalid: ["bad key.x"] })
    expect((await rowOf(SCHOOL, "vi", "home.brand.fresh"))?.target).toBe("Mới")
    expect((await rowOf(SCHOOL, "en", "home.brand.fresh"))?.status).toBe("missing")
  })

  it("replace clears every key the file leaves out", async () => {
    const { body } = await callJson<ImportResponse>(store, "PUT", `/import/vi?target=${SCHOOL}`, {
      values: { [CANCEL]: "Hủy bỏ" },
      mode: "replace",
    })
    expect(body).toMatchObject({ created: 0, changed: 1, removed: 499, unchanged: 0 })
  })

  it("fills a project that had no keys", async () => {
    const { status, body } = await callJson<ImportResponse>(store, "PUT", "/import/vi?target=mobile/student-app", {
      values: fixture,
      mode: "merge",
    })
    expect(status).toBe(200)
    expect(body).toMatchObject({ created: 2, invalid: ["bad key.x"] })
    expect((await entries("mobile/student-app", "vi")).map((r) => r.key).sort()).toEqual([
      "home.brand.fresh",
      "user.form.actions.cancel",
    ])
  })

  it("answers 404 when neither the project nor the file has a usable key", async () => {
    const response = await call(store, "PUT", "/import/vi?target=mobile/student-app", {
      values: { "bad key.x": "x" },
      mode: "merge",
    })
    expect(response.status).toBe(404)
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npm test -- tests/bundle-diff.test.ts tests/router.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/bundle-diff"` ở cả hai file (router.test.ts giờ import nó).

- [ ] **Step 4: Port `bundle-diff`**

```bash
sed -E \
  -e 's#from "(\.\.?/[^"]+)\.ts"#from "\1"#g' \
  -e 's#(locale|api|template|file|format)_(data|types|preview|name|store|date)#\1-\2#g' \
  /d/example_projects/localizer/src/lib/bundle_diff.ts > lib/bundle-diff.ts
grep -n 'from "' lib/bundle-diff.ts
```

Expected: ba import trỏ tới `@/lib/api-types`, `@/lib/locale-data`, `@/lib/validation`.

- [ ] **Step 5: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS toàn bộ (gồm 4 test `describe("import")` của router — chúng mô tả route đã port ở #1–2, nên pass ngay khi import được `parseBundleFile`); `tsc` sạch.

- [ ] **Step 6: Commit**

```bash
git add lib/bundle-diff.ts tests/fixtures/import.vi.json tests/bundle-diff.test.ts tests/router.test.ts
git commit -m "Port the bundle diff and cover the import route with a small fixture"
```

---

### Task 2: `lib/diff-groups.ts` — nhóm, đánh số, header ghim

**Files:**
- Create: `lib/diff-groups.ts`
- Test: `tests/diff-groups.test.ts`

**Interfaces:**
- Consumes: `CHANGED_KINDS`, `DiffEntry`, `DiffKind` (Task 1).
- Produces: `type DiffFilter = DiffKind | "changes"`, `type LineNumbers = { before: number | null; after: number | null }`, `type GroupDiff = { name; entries: DiffEntry[]; additions; deletions; errors }`, `type DiffRow = { type: "header"; group: GroupDiff } | { type: "hunk"; entry: DiffEntry }`, `numberEntries(entries): Map<string, LineNumbers>`, `groupsOf(entries, filter): GroupDiff[]`, `flattenGroups(groups, collapsed: ReadonlySet<string>): DiffRow[]`, `pinnedHeader(rows, items: { index: number; start: number }[], offset: number): GroupDiff | null`.

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/diff-groups.test.ts`:

```ts
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
    expect(pinnedHeader(rows, [{ index: 0, start: 0 }], 0)).toBeNull()
    expect(pinnedHeader(rows, [{ index: 1, start: 41 }], 50)?.name).toBe("nav")
    expect(pinnedHeader(rows, [{ index: 3, start: 300 }], 300)).toBeNull()
    expect(pinnedHeader(rows, [{ index: 4, start: 341 }], 350)?.name).toBe("user")
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- tests/diff-groups.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/diff-groups"`.

- [ ] **Step 3: Viết `lib/diff-groups.ts`**

```ts
import { CHANGED_KINDS, type DiffEntry, type DiffKind } from "@/lib/bundle-diff"

/** `changes` is every kind that would be written - the view worth reading. */
export type DiffFilter = DiffKind | "changes"

/** Where a key sits in its group, counted the way `git` counts lines. */
export type LineNumbers = {
  before: number | null
  after: number | null
}

/** One group, read as the file it stands in for. */
export type GroupDiff = {
  name: string
  entries: DiffEntry[]
  additions: number
  deletions: number
  errors: number
}

/** A row of the virtualized list: a group's header, or one key inside it. */
export type DiffRow = { type: "header"; group: GroupDiff } | { type: "hunk"; entry: DiffEntry }

/** A side with no text has no number, so an addition has an empty left gutter. */
export function numberEntries(entries: DiffEntry[]): Map<string, LineNumbers> {
  const counters = new Map<string, { before: number; after: number }>()
  const numbers = new Map<string, LineNumbers>()

  for (const entry of entries) {
    let counter = counters.get(entry.group)
    if (!counter) {
      counter = { before: 0, after: 0 }
      counters.set(entry.group, counter)
    }
    if (entry.before !== "") {
      counter.before += 1
    }
    if (entry.after !== "") {
      counter.after += 1
    }
    numbers.set(entry.key, {
      before: entry.before === "" ? null : counter.before,
      after: entry.after === "" ? null : counter.after,
    })
  }

  return numbers
}

/** A changed key costs one addition and one deletion, an unchanged key neither. */
export function groupsOf(entries: DiffEntry[], filter: DiffFilter): GroupDiff[] {
  const byGroup = new Map<string, GroupDiff>()

  for (const entry of entries) {
    const keep = filter === "changes" ? CHANGED_KINDS.includes(entry.kind) : entry.kind === filter
    if (!keep) {
      continue
    }

    let group = byGroup.get(entry.group)
    if (!group) {
      group = { name: entry.group, entries: [], additions: 0, deletions: 0, errors: 0 }
      byGroup.set(entry.group, group)
    }

    group.entries.push(entry)

    if (entry.kind !== "unchanged") {
      if (entry.before !== "") {
        group.deletions += 1
      }
      if (entry.after !== "") {
        group.additions += 1
      }
    }

    if (entry.issues.some((issue) => issue.level === "error")) {
      group.errors += 1
    }
  }

  return [...byGroup.values()]
}

export function flattenGroups(groups: GroupDiff[], collapsed: ReadonlySet<string>): DiffRow[] {
  const rows: DiffRow[] = []
  for (const group of groups) {
    rows.push({ type: "header", group })
    if (collapsed.has(group.name)) {
      continue
    }
    for (const entry of group.entries) {
      rows.push({ type: "hunk", entry })
    }
  }
  return rows
}

/**
 * The nearest header at or above the top edge, once it has scrolled under it.
 * Walks back from the first rendered row, because a group taller than the pane
 * has its header far outside the rendered window.
 */
export function pinnedHeader(
  rows: DiffRow[],
  items: { index: number; start: number }[],
  offset: number
): GroupDiff | null {
  const first = items[0]
  if (!first || offset <= 0) {
    return null
  }

  let index = Math.min(first.index, rows.length - 1)
  while (index >= 0 && rows[index]?.type !== "header") {
    index -= 1
  }

  const row = index >= 0 ? rows[index] : undefined
  if (!row || row.type !== "header") {
    return null
  }

  if (index === first.index && first.start >= offset) {
    return null
  }

  return row.group
}
```

- [ ] **Step 4: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS; `tsc` sạch.

- [ ] **Step 5: Commit**

```bash
git add lib/diff-groups.ts tests/diff-groups.test.ts
git commit -m "Add the diff grouping, line numbering and pinned-header rules"
```

---

### Task 3: `lib/import-plan.ts`, `clearTarget`/`pendingInTarget`, `findProjectByTarget`

**Files:**
- Create: `lib/import-plan.ts`
- Modify: `lib/drafts.ts`, `lib/projects.ts`
- Test: `tests/import-plan.test.ts`; Modify: `tests/drafts.test.ts`, `tests/projects.test.ts`

**Interfaces:**
- Consumes: `ImportMode` (`lib/api-types.ts`); `languages`, `SOURCE_LANGUAGE`, `LanguageCode`, `LocaleBundle`, `TranslationRow` (`lib/locale-data.ts`); `DraftState`, `pendingCount`, `slotOf` (`lib/drafts.ts`); `findProject` (`lib/projects.ts`).
- Produces:
  - `lib/import-plan.ts`: `type StagedFile = { id: string; name: string; values: LocaleBundle; language: LanguageCode | null }`, `languageFromName(name): LanguageCode | null`, `duplicatedLanguages(files): Set<LanguageCode>`, `retiredKeys(mode, registry: TranslationRow[] | undefined, files): string[]`, `importOrder(files): StagedFile[]`, `type BlockerState = { hasTarget: boolean; fileCount: number; unassigned: number; duplicated: number; isLoading: boolean; error: string | null; totalChanges: number }`, `blockerOf(state): string | null`, `afterImport({ mode, succeeded, failed, retired }): { retire: boolean; clearDrafts: boolean; refresh: boolean }`.
  - `lib/drafts.ts`: `clearTarget(state, target): DraftState`, `pendingInTarget(state, target): number`.
  - `lib/projects.ts`: `findProjectByTarget(target): Project | null`.

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/import-plan.test.ts`:

```ts
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
    unassigned: 0,
    duplicated: 0,
    isLoading: false,
    error: null,
    totalChanges: 3,
  }

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
```

Trong `tests/drafts.test.ts`, thêm `clearTarget,` và `pendingInTarget,` vào import từ `@/lib/drafts`, rồi thêm cuối file:

```ts
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
```

Trong `tests/projects.test.ts`, thêm `findProjectByTarget,` vào import, rồi thêm trong `describe("projects")`:

```ts
  it("finds a project by its target", () => {
    expect(findProjectByTarget("web/school-portal")?.name).toBe("School Portal")
    expect(findProjectByTarget("web/nope")).toBeNull()
    expect(findProjectByTarget("")).toBeNull()
  })
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- tests/import-plan.test.ts tests/drafts.test.ts tests/projects.test.ts`
Expected: FAIL — `@/lib/import-plan` không resolve; `clearTarget`, `pendingInTarget`, `findProjectByTarget` là `undefined` (lỗi "is not a function").

- [ ] **Step 3: Viết `lib/import-plan.ts`**

```ts
import type { ImportMode } from "@/lib/api-types"
import {
  languages,
  SOURCE_LANGUAGE,
  type LanguageCode,
  type LocaleBundle,
  type TranslationRow,
} from "@/lib/locale-data"

/** A file that parsed, waiting for a language and a reviewer. */
export type StagedFile = {
  id: string
  name: string
  values: LocaleBundle
  /** Null until somebody says which language it is - never guessed silently. */
  language: LanguageCode | null
}

/**
 * A file named after a language is usually meant for it; a name that does not
 * name one is left unassigned rather than guessed at. `.` and `_` split, `-`
 * does not: `zh-Hans` is a code, `vi_VN` a code and a region.
 */
export function languageFromName(name: string): LanguageCode | null {
  const base = name.replace(/\.json$/i, "")
  const candidates = new Set([base, ...base.split(/[._]/)].map((part) => part.trim().toLowerCase()))
  return languages.find((item) => candidates.has(item.code.toLowerCase()))?.code ?? null
}

/** Two files aimed at one language would write the same file twice. */
export function duplicatedLanguages(files: StagedFile[]): Set<LanguageCode> {
  const seen = new Map<LanguageCode, number>()
  for (const file of files) {
    if (file.language) {
      seen.set(file.language, (seen.get(file.language) ?? 0) + 1)
    }
  }
  return new Set([...seen].filter(([, times]) => times > 1).map(([code]) => code))
}

/**
 * The keys a replace retires: the ones no file in the batch carries. Across
 * the batch, not per file - one language file cannot say which keys a project
 * has, a whole delivery can. Any language's rows will do for the registry.
 */
export function retiredKeys(mode: ImportMode, registry: TranslationRow[] | undefined, files: StagedFile[]): string[] {
  if (mode !== "replace" || !registry) {
    return []
  }
  const carried = new Set(files.flatMap((file) => Object.keys(file.values)))
  return registry.map((row) => row.key).filter((key) => !carried.has(key))
}

/** English first: the translations are stamped against the English they were written for. */
export function importOrder(files: StagedFile[]): StagedFile[] {
  return [...files].sort(
    (a, b) => Number(b.language === SOURCE_LANGUAGE) - Number(a.language === SOURCE_LANGUAGE)
  )
}

export type BlockerState = {
  hasTarget: boolean
  fileCount: number
  unassigned: number
  duplicated: number
  isLoading: boolean
  error: string | null
  totalChanges: number
}

/** The one sentence saying why Confirm is off, or null when it is on. */
export function blockerOf(state: BlockerState): string | null {
  if (!state.hasTarget) {
    return "Choose a project first."
  }
  if (state.fileCount === 0) {
    return "Add at least one file."
  }
  if (state.unassigned > 0) {
    return `${state.unassigned} ${state.unassigned === 1 ? "file has" : "files have"} no language yet.`
  }
  if (state.duplicated > 0) {
    return "Two files claim the same language - one would overwrite the other."
  }
  if (state.error) {
    return "The project's current values could not be read."
  }
  if (state.isLoading) {
    return "Reading what the project holds today…"
  }
  if (state.totalChanges === 0) {
    return "These files change nothing."
  }
  return null
}

/**
 * What follows a batch. Data changed as soon as one file landed, so drafts and
 * the coverage refresh follow that; retiring is an extra step for a replace
 * where every file landed.
 */
export function afterImport({
  mode,
  succeeded,
  failed,
  retired,
}: {
  mode: ImportMode
  succeeded: number
  failed: number
  retired: number
}): { retire: boolean; clearDrafts: boolean; refresh: boolean } {
  const landed = succeeded > 0
  return {
    retire: mode === "replace" && retired > 0 && failed === 0 && landed,
    clearDrafts: landed,
    refresh: landed,
  }
}
```

- [ ] **Step 4: Thêm vào `lib/drafts.ts` và `lib/projects.ts`**

Cuối `lib/drafts.ts`:

```ts
/** Unsaved edits and keeps across every language of one project. */
export function pendingInTarget(state: DraftState, target: string): number {
  const prefix = `${target}:`
  return Object.keys(state.slots)
    .filter((slotKey) => slotKey.startsWith(prefix))
    .reduce((sum, slotKey) => sum + pendingCount(slotOf(state, slotKey)), 0)
}

/** Drops every draft and the selection of one project - after an import rewrote it. */
export function clearTarget(state: DraftState, target: string): DraftState {
  const prefix = `${target}:`
  const slots = Object.fromEntries(Object.entries(state.slots).filter(([slotKey]) => !slotKey.startsWith(prefix)))
  const selected = { ...state.selected }
  delete selected[target]
  return { slots, selected }
}
```

Trong `lib/projects.ts`, ngay sau `findProjectByPath`:

```ts
/** `web/school-portal` → School Portal. */
export function findProjectByTarget(target: string): Project | null {
  const [group, id] = target.split("/")
  return group && id ? findProject(group, id) : null
}
```

- [ ] **Step 5: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS; `tsc` sạch.

- [ ] **Step 6: Commit**

```bash
git add lib/import-plan.ts lib/drafts.ts lib/projects.ts tests/import-plan.test.ts tests/drafts.test.ts tests/projects.test.ts
git commit -m "Add the import wizard's rules, project-wide draft clearing and target lookup"
```

---

### Task 4: Mảnh UI dùng chung — class nút, cờ ngôn ngữ, hook bundles, pickers, file row, kết quả

**Files:**
- Create: `components/button-styles.ts`, `lib/language-flags.ts`, `hooks/use-target-bundles.ts`, `components/import/project-picker.tsx`, `components/import/language-picker.tsx`, `components/import/file-row.tsx`, `components/import/import-results.tsx`
- Modify: `components/translation-workspace.tsx` (dùng `button-styles`), `components/app-topbar.tsx` (dùng `language-flags`)

**Interfaces:**
- Consumes: `PopoverMenu` (`components/popover-menu.tsx`); `fetchEntries`, `messageOf` (`lib/api.ts`); `ImportResponse` (`lib/api-types.ts`); `changeCount`, `BundleDiff` (Task 1); `StagedFile` (Task 3); `projects`, `projectGroups`, `groupLabel`, `targetOf`, `projectPath`, `Project` (`lib/projects.ts`); `languages`, `LanguageCode`, `TranslationRow` (`lib/locale-data.ts`).
- Produces:
  - `components/button-styles.ts`: `outlineButton`, `primaryButton`, `destructiveButton` (string).
  - `lib/language-flags.ts`: `languageFlags: Record<LanguageCode, string>`.
  - `useTargetBundles(target: string | null, codes: LanguageCode[], revision: number): { rows: ReadonlyMap<LanguageCode, TranslationRow[]>; isLoading: boolean; error: string | null }`.
  - `ProjectPicker({ value: Project | null, onChange(project) })`, `LanguagePicker({ value: LanguageCode | null, invalid: boolean, onChange(code) })`.
  - `FileRow({ file, diff?, isSelected, isDuplicate, onSelect, onAssign(code), onRemove })`.
  - `type ImportResult = { id; name; language: LanguageCode; response: ImportResponse | null; error: string | null }`, `type ImportOutcome = { files: ImportResult[]; retired: number; retireError: string | null }`, `ImportResults({ outcome, project })`.

- [ ] **Step 1: Tách class nút**

Tạo `components/button-styles.ts`:

```ts
export const outlineButton =
  "flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-accent/40 disabled:pointer-events-none disabled:opacity-50"

export const primaryButton =
  "flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"

export const destructiveButton =
  "flex h-9 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"
```

Trong `components/translation-workspace.tsx`: xóa ba khai báo `const outlineButton = …`, `const primaryButton = …`, `const destructiveButton = …`, và thêm `import { destructiveButton, outlineButton, primaryButton } from "@/components/button-styles"` vào nhóm import `@/components/…`.

- [ ] **Step 2: Tách cờ ngôn ngữ**

Tạo `lib/language-flags.ts`:

```ts
import type { LanguageCode } from "@/lib/locale-data"

export const languageFlags: Record<LanguageCode, string> = {
  en: "🇺🇸",
  "zh-Hans": "🇨🇳",
  ms: "🇲🇾",
  ja: "🇯🇵",
  ko: "🇰🇷",
  ru: "🇷🇺",
  vi: "🇻🇳",
  mn: "🇲🇳",
  es: "🇪🇸",
  "ar-SA": "🇸🇦",
  th: "🇹🇭",
  my: "🇲🇲",
  km: "🇰🇭",
}
```

Trong `components/app-topbar.tsx`: xóa khối `const flags: Record<LanguageCode, string> = { … }`, thêm `import { languageFlags } from "@/lib/language-flags"`, và thay hai chỗ `flags[` bằng `languageFlags[`.

- [ ] **Step 3: Viết `hooks/use-target-bundles.ts`**

```ts
"use client"

import { useEffect, useState } from "react"

import { fetchEntries, messageOf } from "@/lib/api"
import type { LanguageCode, TranslationRow } from "@/lib/locale-data"

type Held = { key: string; rows: Map<LanguageCode, TranslationRow[]> }

const EMPTY: ReadonlyMap<LanguageCode, TranslationRow[]> = new Map()

/**
 * One project's keys in several languages at once - what an import needs to
 * diff each file against its own language. Languages already held are not
 * fetched again; a new project or a new `revision` starts over.
 */
export function useTargetBundles(target: string | null, codes: LanguageCode[], revision: number) {
  const key = target ? `${target}@${revision}` : ""
  const [held, setHeld] = useState<Held>(() => ({ key, rows: new Map() }))
  const [error, setError] = useState<{ key: string; message: string } | null>(null)

  // Reset during render: what was read about another project, or before a
  // refresh, is not an answer about this one.
  if (held.key !== key) {
    setHeld({ key, rows: new Map() })
  }

  const wanted = codes.join(",")

  useEffect(() => {
    if (!target || held.key !== key) {
      return
    }
    const missing = codes.filter((code) => !held.rows.has(code))
    if (missing.length === 0) {
      return
    }

    let cancelled = false
    Promise.all(missing.map((code) => fetchEntries(target, code).then((response) => [code, response.entries] as const)))
      .then((loaded) => {
        if (cancelled) {
          return
        }
        setHeld((current) => {
          if (current.key !== key) {
            return current
          }
          const rows = new Map(current.rows)
          for (const [code, entries] of loaded) {
            rows.set(code, entries)
          }
          return { key, rows }
        })
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError({ key, message: messageOf(cause) })
        }
      })

    return () => {
      cancelled = true
    }
    // `wanted` stands in for `codes`, which the caller rebuilds on every render.
  }, [target, key, wanted, held]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = held.key === key ? held.rows : EMPTY
  const currentError = error?.key === key ? error.message : null

  return {
    rows,
    isLoading: target !== null && currentError === null && codes.some((code) => !rows.has(code)),
    error: currentError,
  }
}
```

- [ ] **Step 4: Viết hai picker**

`components/import/project-picker.tsx`:

```tsx
"use client"

import { Check, ChevronDown } from "lucide-react"

import { PopoverMenu } from "@/components/popover-menu"
import { groupLabel, projectGroups, projects, targetOf, type Project } from "@/lib/projects"
import { cn } from "@/lib/utils"

export function ProjectPicker({ value, onChange }: { value: Project | null; onChange: (project: Project) => void }) {
  return (
    <PopoverMenu
      label="project menu"
      widthClass="w-72"
      trigger={(toggle) => (
        <button
          type="button"
          onClick={toggle}
          className="flex h-9 w-72 items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm transition-colors hover:bg-accent/40"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? `${groupLabel[value.group]} · ${value.name}` : "Choose a project…"}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-96 overflow-y-auto">
          {projectGroups.map((group) => (
            <div key={group.id} className="py-1">
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              {projects
                .filter((project) => project.group === group.id)
                .map((project) => (
                  <button
                    key={targetOf(project)}
                    type="button"
                    onClick={() => {
                      onChange(project)
                      close()
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent/50"
                  >
                    <span className="flex-1 truncate">{project.name}</span>
                    {project === value && <Check className="size-4 text-primary" />}
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </PopoverMenu>
  )
}
```

`components/import/language-picker.tsx`:

```tsx
"use client"

import { Check, ChevronDown } from "lucide-react"

import { PopoverMenu } from "@/components/popover-menu"
import { languageFlags } from "@/lib/language-flags"
import { languages, type LanguageCode } from "@/lib/locale-data"
import { cn } from "@/lib/utils"

export function LanguagePicker({
  value,
  invalid,
  onChange,
}: {
  value: LanguageCode | null
  invalid: boolean
  onChange: (code: LanguageCode) => void
}) {
  const current = languages.find((item) => item.code === value)

  return (
    <PopoverMenu
      label="language menu"
      widthClass="w-56"
      trigger={(toggle) => (
        <button
          type="button"
          onClick={toggle}
          aria-invalid={invalid || undefined}
          className={cn(
            "flex h-8 w-48 items-center justify-between gap-2 rounded-lg border bg-card px-2.5 text-sm transition-colors hover:bg-accent/40",
            invalid ? "border-destructive" : "border-input"
          )}
        >
          <span className={cn("flex min-w-0 items-center gap-2 truncate", !current && "text-muted-foreground")}>
            {current ? (
              <>
                <span className="text-base leading-none">{languageFlags[current.code]}</span>
                {current.name}
              </>
            ) : (
              "Choose a language…"
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      )}
    >
      {(close) => (
        <div className="max-h-80 overflow-y-auto">
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => {
                onChange(item.code)
                close()
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent/50"
            >
              <span className="text-base leading-none">{languageFlags[item.code]}</span>
              <span className="flex-1">{item.name}</span>
              {item.code === value && <Check className="size-4 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </PopoverMenu>
  )
}
```

- [ ] **Step 5: Viết `file-row.tsx` và `import-results.tsx`**

`components/import/file-row.tsx`:

```tsx
"use client"

import { AlertTriangle, FileJson, X } from "lucide-react"

import { LanguagePicker } from "@/components/import/language-picker"
import { changeCount, type BundleDiff } from "@/lib/bundle-diff"
import type { StagedFile } from "@/lib/import-plan"
import type { LanguageCode } from "@/lib/locale-data"
import { cn } from "@/lib/utils"

/** One staged file: what it is, which language it claims, what it would cost. */
export function FileRow({
  file,
  diff,
  isSelected,
  isDuplicate,
  onSelect,
  onAssign,
  onRemove,
}: {
  file: StagedFile
  diff: BundleDiff | undefined
  isSelected: boolean
  isDuplicate: boolean
  onSelect: () => void
  onAssign: (language: LanguageCode) => void
  onRemove: () => void
}) {
  const changes = diff ? changeCount(diff.counts) : null

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 px-3 py-2 first:rounded-t-xl last:rounded-b-xl",
        isSelected && "bg-accent/40"
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <FileJson className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate font-mono text-xs">{file.name}</span>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          {Object.keys(file.values).length.toLocaleString()} keys
        </span>
        {changes !== null && (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
              changes > 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {changes.toLocaleString()} {changes === 1 ? "change" : "changes"}
          </span>
        )}
        {diff && diff.errors > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="size-3.5" />
            {diff.errors}
          </span>
        )}
      </button>

      <LanguagePicker value={file.language} invalid={isDuplicate} onChange={onAssign} />

      <button
        type="button"
        aria-label={`Remove ${file.name}`}
        onClick={onRemove}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
```

`components/import/import-results.tsx`:

```tsx
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { primaryButton } from "@/components/button-styles"
import type { ImportResponse } from "@/lib/api-types"
import type { LanguageCode } from "@/lib/locale-data"
import { projectPath, type Project } from "@/lib/projects"

export type ImportResult = {
  id: string
  name: string
  language: LanguageCode
  response: ImportResponse | null
  error: string | null
}

export type ImportOutcome = {
  files: ImportResult[]
  /** Keys no file carried, dropped from the project - 0 unless replacing. */
  retired: number
  retireError: string | null
}

export function ImportResults({ outcome, project }: { outcome: ImportOutcome; project: Project }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="divide-y divide-border rounded-xl border border-border">
        {outcome.files.map((result) => (
          <div key={result.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{result.name}</span>
            {result.response ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {result.response.created} created · {result.response.added} added · {result.response.changed} changed ·{" "}
                {result.response.removed} cleared → <span className="font-mono">{result.response.file}</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                {result.error}
              </span>
            )}
          </div>
        ))}
      </div>

      {outcome.retireError ? (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          The files were written, but the keys they left out could not be retired: {outcome.retireError}
        </p>
      ) : (
        outcome.retired > 0 && (
          <p className="text-sm text-muted-foreground">
            {outcome.retired} {outcome.retired === 1 ? "key" : "keys"} no file carried{" "}
            {outcome.retired === 1 ? "was" : "were"} removed from {project.name} and every one of its language files.
          </p>
        )
      )}

      <div>
        <Link href={projectPath(project)} className={`${primaryButton} w-fit`}>
          Open {project.name}
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Chạy gate**

Run: `npm run typecheck && npm test`
Expected: sạch / PASS. Workspace và topbar vẫn render như cũ (chỉ đổi nguồn import của hằng).

- [ ] **Step 7: Commit**

```bash
git add components/button-styles.ts lib/language-flags.ts hooks/use-target-bundles.ts components/import components/translation-workspace.tsx components/app-topbar.tsx
git commit -m "Add the import wizard's building blocks and share button and flag constants"
```

---

### Task 5: `BundleDiffView`

**Files:**
- Create: `components/import/bundle-diff-view.tsx`

**Interfaces:**
- Consumes: `changeCount`, `BundleDiff`, `DiffEntry`, `DiffKind` (Task 1); `flattenGroups`, `groupsOf`, `numberEntries`, `pinnedHeader`, `DiffFilter`, `GroupDiff`, `LineNumbers` (Task 2).
- Produces: `BundleDiffView({ diff: BundleDiff; languageName: string; isRtl?: boolean })`.

- [ ] **Step 1: Viết component**

```tsx
"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"

import { changeCount, type BundleDiff, type DiffEntry, type DiffKind } from "@/lib/bundle-diff"
import {
  flattenGroups,
  groupsOf,
  numberEntries,
  pinnedHeader,
  type DiffFilter,
  type GroupDiff,
  type LineNumbers,
} from "@/lib/diff-groups"
import { cn } from "@/lib/utils"

const filters: { id: DiffFilter; label: string }[] = [
  { id: "changes", label: "Changes" },
  { id: "new", label: "New" },
  { id: "added", label: "Added" },
  { id: "changed", label: "Changed" },
  { id: "removed", label: "Removed" },
  { id: "unchanged", label: "Unchanged" },
]

const kindLabel: Record<DiffKind, string> = {
  new: "New key",
  added: "Added",
  changed: "Changed",
  removed: "Removed",
  unchanged: "Unchanged",
}

const kindTone: Record<DiffKind, string> = {
  new: "border-primary/30 bg-primary/10 text-primary",
  added: "border-success/20 bg-success/12 text-success",
  changed: "border-warning/30 bg-warning/15 text-warning-foreground dark:text-warning",
  removed: "border-destructive/20 bg-destructive/10 text-destructive",
  unchanged: "border-border text-muted-foreground",
}

/**
 * What the import would do, laid out the way a pull request lays out its files:
 * a key group is the file, each key a hunk, `-` today and `+` after.
 */
export function BundleDiffView({
  diff,
  languageName,
  isRtl = false,
}: {
  diff: BundleDiff
  languageName: string
  isRtl?: boolean
}) {
  const [filter, setFilter] = useState<DiffFilter>("changes")
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set<string>())

  const totals = useMemo(() => ({ ...diff.counts, changes: changeCount(diff.counts) }), [diff.counts])
  const numbers = useMemo(() => numberEntries(diff.entries), [diff.entries])
  const groups = useMemo(() => groupsOf(diff.entries, filter), [diff.entries, filter])
  const stat = useMemo(
    () =>
      groups.reduce(
        (sum, group) => ({
          additions: sum.additions + group.additions,
          deletions: sum.deletions + group.deletions,
          keys: sum.keys + group.entries.length,
        }),
        { additions: 0, deletions: 0, keys: 0 }
      ),
    [groups]
  )
  const rows = useMemo(() => flattenGroups(groups, collapsed), [groups, collapsed])

  const toggle = (name: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(name)) {
        next.add(name)
      }
      return next
    })

  const allCollapsed = groups.length > 0 && collapsed.size >= groups.length
  const toggleAll = () => setCollapsed(allCollapsed ? new Set<string>() : new Set(groups.map((group) => group.name)))

  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    // Keyed by row, so a measured hunk keeps its height when a group above collapses.
    getItemKey: useCallback(
      (index: number) => {
        const row = rows[index]
        return row.type === "header" ? `@${row.group.name}` : row.entry.key
      },
      [rows]
    ),
    estimateSize: useCallback((index: number) => (rows[index]?.type === "header" ? 41 : 104), [rows]),
    overscan: 6,
  })

  const items = virtualizer.getVirtualItems()
  const pinned = pinnedHeader(rows, items, virtualizer.scrollOffset ?? 0)

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={totals[item.id] === 0}
            onClick={() => setFilter(item.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
              filter === item.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            )}
          >
            {item.label}
            <span className="tabular-nums opacity-80">{totals[item.id].toLocaleString()}</span>
          </button>
        ))}
        {diff.errors > 0 && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3.5 shrink-0" />
            {diff.errors} would fail a check
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <span className="text-xs font-medium tabular-nums">
            {count(groups.length, "group")}
            <span className="text-muted-foreground"> · {count(stat.keys, "key")}</span>
          </span>
          <DiffStat additions={stat.additions} deletions={stat.deletions} />
          {groups.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="ml-auto rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {allCollapsed ? "Expand all" : "Collapse all"}
            </button>
          )}
        </div>

        <div className="relative">
          {/* Drawn over the list rather than `sticky`: the virtualizer's rows are
              absolutely positioned, which sticky cannot see past. */}
          {pinned && (
            <div className="absolute inset-x-0 top-0 z-10 shadow-sm">
              <GroupHeader group={pinned} isCollapsed={collapsed.has(pinned.name)} onToggle={() => toggle(pinned.name)} />
            </div>
          )}

          <div ref={scrollRef} className="h-[min(46vh,24rem)] overflow-auto overscroll-contain">
            {rows.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{emptyMessage(filter, languageName)}</p>
            ) : (
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {items.map((item) => {
                  const row = rows[item.index]
                  return (
                    <div
                      key={item.key}
                      ref={virtualizer.measureElement}
                      data-index={item.index}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${item.start}px)` }}
                    >
                      {row.type === "header" ? (
                        <GroupHeader
                          group={row.group}
                          isCollapsed={collapsed.has(row.group.name)}
                          onToggle={() => toggle(row.group.name)}
                        />
                      ) : (
                        <Hunk entry={row.entry} numbers={numbers.get(row.entry.key)} isRtl={isRtl} />
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupHeader({
  group,
  isCollapsed,
  onToggle,
}: {
  group: GroupDiff
  isCollapsed: boolean
  onToggle: () => void
}) {
  const Chevron = isCollapsed ? ChevronRight : ChevronDown
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      className="flex w-full items-center gap-2 border-b border-border bg-muted/60 px-3 py-2 text-left backdrop-blur-sm transition-colors hover:bg-muted"
    >
      <Chevron className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium">{group.name}</span>
      {group.errors > 0 && <AlertTriangle className="size-3.5 shrink-0 text-destructive" />}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count(group.entries.length, "key")}</span>
      <DiffStat additions={group.additions} deletions={group.deletions} />
    </button>
  )
}

function Hunk({ entry, numbers, isRtl }: { entry: DiffEntry; numbers: LineNumbers | undefined; isRtl: boolean }) {
  const before = numbers?.before ?? null
  const after = numbers?.after ?? null

  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 bg-accent/50 px-3 py-1 text-muted-foreground">
        <span className="shrink-0 font-mono text-[11px]">@@ {entry.key} @@</span>
        <span className="min-w-0 flex-1 truncate text-xs italic">{entry.source}</span>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", kindTone[entry.kind])}>
          {kindLabel[entry.kind]}
        </span>
      </div>

      {entry.kind === "unchanged" ? (
        <Line sign=" " before={before} after={after} text={entry.after} isRtl={isRtl} />
      ) : (
        <>
          {entry.before !== "" && <Line sign="-" before={before} after={null} text={entry.before} isRtl={isRtl} />}
          {entry.after !== "" && <Line sign="+" before={null} after={after} text={entry.after} isRtl={isRtl} />}
        </>
      )}

      {entry.issues.map((issue) => (
        <p
          key={issue.id}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 text-xs",
            issue.level === "error" ? "text-destructive" : "text-muted-foreground"
          )}
        >
          <AlertTriangle className="size-3.5 shrink-0" />
          {issue.message}
        </p>
      ))}
    </div>
  )
}

function Line({
  sign,
  before,
  after,
  text,
  isRtl,
}: {
  sign: "-" | "+" | " "
  before: number | null
  after: number | null
  text: string
  isRtl: boolean
}) {
  const tone = sign === "-" ? "removed" : sign === "+" ? "added" : "none"
  return (
    <div
      className={cn(
        "flex text-sm",
        tone === "removed" && "bg-destructive/10 text-destructive",
        tone === "added" && "bg-success/12 text-success",
        tone === "none" && "text-muted-foreground"
      )}
    >
      <Gutter value={before} />
      <Gutter value={after} />
      <span aria-hidden className="w-4 shrink-0 select-none py-1 pl-2 font-mono">
        {sign.trim()}
      </span>
      <span dir={isRtl ? "rtl" : undefined} className="min-w-0 flex-1 whitespace-pre-wrap break-words py-1 pr-3">
        {text}
      </span>
    </div>
  )
}

function Gutter({ value }: { value: number | null }) {
  return (
    <span
      aria-hidden
      className="w-9 shrink-0 select-none border-r border-border px-2 py-1 text-right font-mono text-[11px] tabular-nums text-muted-foreground"
    >
      {value ?? ""}
    </span>
  )
}

const BLOCKS = 5

function DiffStat({ additions, deletions }: { additions: number; deletions: number }) {
  const total = additions + deletions
  const green = total === 0 ? 0 : blocksOf(additions, total)
  const red = total === 0 ? 0 : Math.min(BLOCKS - green, blocksOf(deletions, total))
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
      <span className="text-success">+{additions}</span>
      <span className="text-destructive">−{deletions}</span>
      <span className="flex gap-px">
        {Array.from({ length: BLOCKS }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-2 rounded-[1px]",
              index < green ? "bg-success" : index < green + red ? "bg-destructive" : "bg-muted-foreground/25"
            )}
          />
        ))}
      </span>
    </span>
  )
}

/** A side that changed anything is owed a square, however small its share. */
function blocksOf(part: number, total: number) {
  return part === 0 ? 0 : Math.max(1, Math.round((part / total) * BLOCKS))
}

function count(value: number, noun: string) {
  return `${value.toLocaleString()} ${noun}${value === 1 ? "" : "s"}`
}

function emptyMessage(filter: DiffFilter, languageName: string) {
  if (filter === "changes") {
    return `This file changes nothing in ${languageName}.`
  }
  if (filter === "new") {
    return "Every key in this file is already in the project."
  }
  return `No ${kindLabel[filter].toLowerCase()} keys.`
}
```

- [ ] **Step 2: Chạy gate**

Run: `npm run typecheck && npm test`
Expected: sạch / PASS.

- [ ] **Step 3: Commit**

```bash
git add components/import/bundle-diff-view.tsx
git commit -m "Add the pull-request style diff view for imports"
```

---

### Task 6: Trang wizard, route, mục sidebar, nút Import của workspace

**Files:**
- Create: `components/import/import-wizard.tsx`, `app/(workspace)/import/page.tsx`
- Modify: `components/app-sidebar.tsx`, `components/translation-workspace.tsx`

**Interfaces:**
- Consumes: mọi thứ của Task 1–5; `useCoverage` (`hooks/use-coverage.tsx`); `useDrafts` (`components/draft-provider.tsx`); `importBundle`, `deleteKeys`, `messageOf` (`lib/api.ts`); shadcn `Checkbox`, `Label`.
- Produces: route `/import` (query `target`), `ImportWizard()`.

- [ ] **Step 1: Viết `components/import/import-wizard.tsx`**

```tsx
"use client"

import { useMemo, useRef, useState, type DragEvent, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, ArrowLeft, FileUp, RotateCw, Upload } from "lucide-react"
import { toast } from "sonner"

import { outlineButton, primaryButton } from "@/components/button-styles"
import { useDrafts } from "@/components/draft-provider"
import { BundleDiffView } from "@/components/import/bundle-diff-view"
import { FileRow } from "@/components/import/file-row"
import { ImportResults, type ImportOutcome, type ImportResult } from "@/components/import/import-results"
import { ProjectPicker } from "@/components/import/project-picker"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useCoverage } from "@/hooks/use-coverage"
import { useTargetBundles } from "@/hooks/use-target-bundles"
import { deleteKeys, importBundle, messageOf } from "@/lib/api"
import type { ImportMode } from "@/lib/api-types"
import { BundleFileError, changeCount, diffBundle, parseBundleFile, type BundleDiff } from "@/lib/bundle-diff"
import { clearTarget, pendingInTarget } from "@/lib/drafts"
import {
  afterImport,
  blockerOf,
  duplicatedLanguages,
  importOrder,
  languageFromName,
  retiredKeys,
  type StagedFile,
} from "@/lib/import-plan"
import { languages, type LanguageCode } from "@/lib/locale-data"
import { findProjectByTarget, projectPath, targetOf, type Project } from "@/lib/projects"
import { cn } from "@/lib/utils"

/**
 * Route `/import?target=` - one delivery of language files into one project.
 * All four steps stay on one page so the reviewer reading the diff can still
 * see which project they picked. Nothing is written until Confirm.
 */
export function ImportWizard() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const project = findProjectByTarget(params.get("target") ?? "")
  const target = project ? targetOf(project) : null

  const [files, setFiles] = useState<StagedFile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<ImportMode>("merge")
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { revision, refresh } = useCoverage()
  const { drafts, update } = useDrafts()

  const codes = useMemo(
    () => [...new Set(files.map((file) => file.language).filter((code): code is LanguageCode => code !== null))],
    [files]
  )
  const bundles = useTargetBundles(target, codes, revision)

  const diffs = useMemo(() => {
    const out = new Map<string, BundleDiff>()
    if (!project) {
      return out
    }
    for (const file of files) {
      const rows = file.language ? bundles.rows.get(file.language) : undefined
      if (!file.language || !rows) {
        continue
      }
      out.set(
        file.id,
        diffBundle(rows, file.values, {
          mode,
          language: file.language,
          lengthBudget: project.profile.lengthBudget,
          maxLength: project.profile.maxLength,
        })
      )
    }
    return out
  }, [files, bundles.rows, mode, project])

  const totalChanges = [...diffs.values()].reduce((sum, diff) => sum + changeCount(diff.counts), 0)
  const duplicated = useMemo(() => duplicatedLanguages(files), [files])
  const retired = useMemo(() => retiredKeys(mode, [...bundles.rows.values()][0], files), [mode, bundles.rows, files])
  const unassigned = files.filter((file) => file.language === null).length
  const selected = files.find((file) => file.id === selectedId) ?? files[0] ?? null
  const draftCount = target ? pendingInTarget(drafts, target) : 0

  const blocker = blockerOf({
    hasTarget: target !== null,
    fileCount: files.length,
    unassigned,
    duplicated: duplicated.size,
    isLoading: bundles.isLoading,
    error: bundles.error,
    totalChanges,
  })

  // Any change to the batch makes the last result stale and Confirm usable again.
  const editFiles = (change: (current: StagedFile[]) => StagedFile[]) => {
    setFiles(change)
    setOutcome(null)
  }

  const setTarget = (next: Project) => {
    const search = new URLSearchParams(params.toString())
    search.set("target", targetOf(next))
    router.replace(`${pathname}?${search}`, { scroll: false })
    setOutcome(null)
  }

  const readFiles = async (list: FileList | File[]) => {
    const added: StagedFile[] = []
    const failed: string[] = []

    for (const file of Array.from(list)) {
      try {
        added.push({
          id: crypto.randomUUID(),
          name: file.name,
          values: parseBundleFile(await file.text()),
          language: languageFromName(file.name),
        })
      } catch (cause: unknown) {
        failed.push(`${file.name} - ${cause instanceof BundleFileError ? cause.message : messageOf(cause)}`)
      }
    }

    if (added.length > 0) {
      editFiles((current) => [...current, ...added])
      setSelectedId((current) => current ?? added[0].id)
    }
    if (failed.length > 0) {
      toast.error(`${failed.length} ${failed.length === 1 ? "file" : "files"} could not be read`, {
        description: failed.join("\n"),
      })
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    if (event.dataTransfer.files.length > 0) {
      void readFiles(event.dataTransfer.files)
    }
  }

  // One file at a time, English first, so a failure is the last line rather
  // than one of twelve interleaved ones.
  const handleImport = async () => {
    if (blocker || !project || !target) {
      return
    }

    setIsImporting(true)
    const done: ImportResult[] = []

    for (const file of importOrder(files)) {
      if (!file.language) {
        continue
      }
      try {
        const response = await importBundle(target, file.language, file.values, mode)
        done.push({ id: file.id, name: file.name, language: file.language, response, error: null })
      } catch (cause: unknown) {
        done.push({ id: file.id, name: file.name, language: file.language, response: null, error: messageOf(cause) })
      }
    }

    const failed = done.filter((result) => result.error).length
    const steps = afterImport({ mode, succeeded: done.length - failed, failed, retired: retired.length })

    let retiredCount = 0
    let retireError: string | null = null
    if (steps.retire) {
      try {
        retiredCount = (await deleteKeys({ target, keys: retired, scope: "all" })).deleted
      } catch (cause: unknown) {
        retireError = messageOf(cause)
      }
    }
    if (steps.clearDrafts) {
      update((state) => clearTarget(state, target))
    }
    if (steps.refresh) {
      refresh()
    }

    setOutcome({ files: done, retired: retiredCount, retireError })
    setIsImporting(false)

    if (failed > 0) {
      toast.error(`${failed} of ${done.length} could not be written - see the results below`)
    } else if (retireError) {
      toast.error("Imported, but the keys left out could not be retired", { description: retireError })
    } else {
      toast.success(
        `Imported ${done.length} ${done.length === 1 ? "file" : "files"} into ${project.name}`,
        retiredCount > 0
          ? {
              description: `${retiredCount} ${retiredCount === 1 ? "key" : "keys"} no file carried were removed from the project.`,
            }
          : undefined
      )
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Tools</span>
            <span>/</span>
            <span className="text-foreground">Import</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Import language files</h1>
          <p className="mt-1 text-sm text-muted-foreground">Nothing is written until you confirm.</p>
        </div>
        {project && (
          <Link href={projectPath(project)} className={outlineButton}>
            <ArrowLeft className="size-4" />
            Back to {project.name}
          </Link>
        )}
      </div>

      <div className="mt-6 flex max-w-4xl flex-col gap-4 pb-10">
        <Step index={1} title="Which project">
          <ProjectPicker value={project} onChange={setTarget} />
        </Step>

        <Step index={2} title="The files" disabled={!project}>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files && event.target.files.length > 0) {
                void readFiles(event.target.files)
              }
              event.target.value = ""
            }}
          />
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border border-dashed border-border text-center transition-colors",
              files.length > 0 ? "px-6 py-5" : "px-6 py-10",
              isDragging && "border-primary bg-accent/40"
            )}
          >
            <Upload className="size-6 text-muted-foreground" />
            <p className="text-sm">
              Drop <code className="font-mono text-xs">.json</code> files here
            </p>
            {files.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Flat or nested - <code className="font-mono">{`{ "nav.home": "…" }`}</code> and{" "}
                <code className="font-mono">{`{ "nav": { "home": "…" } }`}</code> both read the same.
              </p>
            )}
            <button type="button" onClick={() => fileRef.current?.click()} className={outlineButton}>
              Choose files
            </button>
          </div>

          {files.length > 0 && (
            <div className="mt-3 divide-y divide-border rounded-xl border border-border">
              {files.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  diff={diffs.get(file.id)}
                  isSelected={selected?.id === file.id}
                  isDuplicate={file.language !== null && duplicated.has(file.language)}
                  onSelect={() => setSelectedId(file.id)}
                  onAssign={(language) =>
                    editFiles((current) => current.map((item) => (item.id === file.id ? { ...item, language } : item)))
                  }
                  onRemove={() => editFiles((current) => current.filter((item) => item.id !== file.id))}
                />
              ))}
            </div>
          )}
        </Step>

        <Step index={3} title="What it would change" disabled={files.length === 0}>
          {bundles.error ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <span>
                Could not read what {project?.name} holds today: {bundles.error}
              </span>
              <button type="button" onClick={refresh} className={outlineButton}>
                <RotateCw className="size-4" />
                Retry
              </button>
            </div>
          ) : bundles.isLoading ? (
            <div className="space-y-2">
              <div className="h-8 animate-pulse rounded-lg bg-muted" />
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            </div>
          ) : (
            selected && <DiffForFile file={selected} diff={diffs.get(selected.id)} />
          )}

          <Label className="mt-4 flex items-start gap-2 font-normal">
            <Checkbox
              checked={mode === "replace"}
              onCheckedChange={(checked) => {
                setMode(checked === true ? "replace" : "merge")
                setOutcome(null)
              }}
            />
            <span className="text-sm">Clear the keys these files leave out</span>
          </Label>

          {retired.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                {retired.length.toLocaleString()} {retired.length === 1 ? "key is" : "keys are"} in none of these files
                and will be deleted from {project?.name} entirely - the {retired.length === 1 ? "key" : "keys"} and{" "}
                {retired.length === 1 ? "its" : "their"} text in every language, not only the{" "}
                {codes.length === 1 ? "one" : codes.length} you are importing.{" "}
                <code className="font-mono">{retired.slice(0, 3).join(", ")}</code>
                {retired.length > 3 && ` and ${(retired.length - 3).toLocaleString()} more`}.
              </span>
            </div>
          )}
        </Step>

        <Step index={4} title="Confirm" disabled={files.length === 0}>
          {outcome && project ? (
            <ImportResults outcome={outcome} project={project} />
          ) : (
            <div className="flex flex-col gap-3">
              {draftCount > 0 && project && (
                <p className="flex items-center gap-1.5 text-sm text-warning-foreground dark:text-warning">
                  <AlertTriangle className="size-4 shrink-0" />
                  {draftCount} unsaved {draftCount === 1 ? "edit" : "edits"} in {project.name} will be discarded after
                  the import.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={blocker !== null || isImporting}
                  onClick={() => void handleImport()}
                  className={primaryButton}
                >
                  <FileUp className="size-4" />
                  {isImporting
                    ? "Importing…"
                    : `Import ${files.length} ${files.length === 1 ? "file" : "files"} · ${totalChanges.toLocaleString()} ${
                        totalChanges === 1 ? "change" : "changes"
                      }`}
                </button>
                {blocker && <span className="text-sm text-muted-foreground">{blocker}</span>}
              </div>
            </div>
          )}
        </Step>
      </div>
    </div>
  )
}

function Step({
  index,
  title,
  disabled = false,
  children,
}: {
  index: number
  title: string
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-disabled={disabled}
      className={cn(
        "rounded-xl border border-border bg-card p-5 transition-opacity",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
          {index}
        </span>
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function DiffForFile({ file, diff }: { file: StagedFile; diff: BundleDiff | undefined }) {
  const language = languages.find((item) => item.code === file.language)

  if (!language) {
    return (
      <p className="text-sm text-muted-foreground">
        Say which language <code className="font-mono text-xs">{file.name}</code> is, and its diff appears here.
      </p>
    )
  }
  if (!diff) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        <code className="font-mono text-foreground">{file.name}</code> → {language.name}
      </p>
      <BundleDiffView
        key={`${file.id}:${language.code}`}
        diff={diff}
        languageName={language.name}
        isRtl={language.rtl ?? false}
      />
      {diff.invalid.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {diff.invalid.length} {diff.invalid.length === 1 ? "key is" : "keys are"} named in a way this project cannot
          store and will be skipped - <code className="font-mono">{diff.invalid.slice(0, 3).join(", ")}</code>
          {diff.invalid.length > 3 && ` and ${diff.invalid.length - 3} more`}. A key is dot-separated segments -
          group.section.name.
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Route**

`app/(workspace)/import/page.tsx`:

```tsx
import { Suspense } from "react"

import { ImportWizard } from "@/components/import/import-wizard"

export default function ImportPage() {
  return (
    <Suspense>
      <ImportWizard />
    </Suspense>
  )
}
```

- [ ] **Step 3: Mục "Import files" ở sidebar**

Trong `components/app-sidebar.tsx`:

1. Thêm `FileUp` vào import từ `lucide-react`.
2. Thay `const active = findProjectByPath(usePathname())` bằng:

```tsx
  const pathname = usePathname()
  const active = findProjectByPath(pathname)
```

3. Thay khối footer:

```tsx
      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-sidebar-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
```

bằng:

```tsx
      {/* Footer */}
      <div className="space-y-2 border-t border-sidebar-border p-3">
        <Link
          href={lang ? `/import?lang=${encodeURIComponent(lang)}` : "/import"}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors",
            pathname === "/import"
              ? "border-transparent bg-sidebar-accent text-sidebar-accent-foreground"
              : "border-sidebar-border text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          )}
        >
          <FileUp className="size-3.5" />
          Import files
        </Link>
        <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-sidebar-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
```

(nút "New application" và phần còn lại của footer giữ nguyên.)

- [ ] **Step 4: Nút Import của workspace thành link**

Trong `components/translation-workspace.tsx`:

1. Thêm `import Link from "next/link"` vào đầu file.
2. Xóa dòng `import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"`.
3. Thay:

```tsx
          <Tooltip>
            <TooltipTrigger render={<span tabIndex={0} className="rounded-lg" />}>
              <button type="button" disabled className={outlineButton}>
                <FileUp className="size-4" />
                Import
              </button>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
```

bằng:

```tsx
          {hasKeys && (
            <Link href={`/import?target=${target}`} className={outlineButton}>
              <FileUp className="size-4" />
              Import
            </Link>
          )}
```

- [ ] **Step 5: Chạy gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: `tsc` sạch; mọi test PASS; build hoàn tất và liệt kê thêm route `○ /import` (hoặc `ƒ /import`) bên cạnh `/` và `/[group]/[project]`. Sau build, khôi phục các file tự sinh: `git checkout -- next-env.d.ts tsconfig.tsbuildinfo`.

- [ ] **Step 6: Kiểm tra UI bằng Chrome headless**

Dùng driver CDP tạm ở scratchpad (`cdp.mjs`, đã dùng ở #1–2: mở Chrome headless với `--user-data-dir` mới, chạy từng đoạn JS phân cách bằng `---`, in kết quả JSON và lỗi console). Nếu không còn file đó, tạo lại theo mô tả vừa nêu; helper có sẵn trong mỗi đoạn: `sleep`, `text()`, `until(fn, ms)`, `byText(selector, text)`, `click(el)`, `type(el, value)`. Dev server của người dùng chạy ở `http://localhost:3000` — không dừng nó.

Tạo `steps-import.txt` trong scratchpad (đoạn `drop` tạo `File` ngay trong trang và gửi sự kiện `drop` với `DataTransfer`):

```text
await until(() => /Which project/.test(text()), 20000)
return { picked: text().includes("Web · School Portal"), steps: [...document.querySelectorAll("section[aria-disabled]")].map((s) => s.getAttribute("aria-disabled")) }
---
const json = JSON.stringify({ user: { form: { actions: { cancel: "Hủy bỏ" } } }, "home.brand.fresh": "Mới", "bad key.x": "x" })
const drop = (name) => { const dt = new DataTransfer(); dt.items.add(new File([json], name, { type: "application/json" })); document.querySelector("main .border-dashed").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })) }
drop("import.vi.json")
await until(() => /Changed\s*1/.test(text()) && /New\s*1/.test(text()), 20000)
return { changes: text().match(/\d+ changes?/)?.[0], invalid: /1 key is named in a way/.test(text()), button: text().match(/Import 1 file · \d+ changes?/)?.[0] }
---
const json = JSON.stringify({ "nav.home": "x" })
const dt = new DataTransfer(); dt.items.add(new File([json], "mystery.json", { type: "application/json" })); document.querySelector("main .border-dashed").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }))
await until(() => /no language yet/.test(text()), 10000)
return { blocker: text().match(/\d+ files? (has|have) no language yet\./)?.[0] }
---
click([...document.querySelectorAll('button[aria-label^="Remove mystery.json"]')][0]); await sleep(300)
const json = JSON.stringify({ "nav.home": "y" })
const dt = new DataTransfer(); dt.items.add(new File([json], "again.vi.json", { type: "application/json" })); document.querySelector("main .border-dashed").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }))
await until(() => /claim the same language/.test(text()), 10000)
const flagged = document.querySelectorAll('button[aria-invalid="true"]').length
click([...document.querySelectorAll('button[aria-label^="Remove again.vi.json"]')][0]); await sleep(300)
return { flagged, cleared: !/claim the same language/.test(text()) }
---
click(document.querySelector('[role="checkbox"]')); await sleep(500)
const warning = text().match(/[\d,]+ keys are in none of these files/)?.[0]
click(document.querySelector('[role="checkbox"]')); await sleep(300)
return { warning, gone: !/in none of these files/.test(text()) }
---
click([...document.querySelectorAll("main button")].find((b) => b.textContent.includes("Web · School Portal"))); await sleep(300)
click(byText("main button", "Student App")); await until(() => /New\s*2/.test(text()), 20000)
const onStudent = { url: location.search, changed: /Changed\s*1/.test(text()) }
click([...document.querySelectorAll("main button")].find((b) => b.textContent.includes("Mobile · Student App"))); await sleep(300)
click(byText("main button", "School Portal")); await until(() => /Changed\s*1/.test(text()), 20000)
return { onStudent, back: location.search }
---
click([...document.querySelectorAll("button")].find((b) => /^Import 1 file/.test(b.textContent.trim())))
const result = await until(() => text().match(/1 created · 0 added · 1 changed · 0 cleared/)?.[0], 20000)
await sleep(800)
const badge = [...document.querySelectorAll("aside a")].find((a) => a.textContent.includes("School Portal"))?.textContent
return { result, toast: text().match(/Imported 1 file into School Portal/)?.[0], badge, openLink: !!byText("a", "Open School Portal") }
---
click([...document.querySelectorAll('[aria-label^="Remove import.vi.json"]')][0]); await sleep(300)
return { resultsCleared: !/1 created ·/.test(text()) }
---
location.href = "/web/school-portal?q=home.brand.fresh"; await sleep(2000)
---
await until(() => document.querySelector('[aria-label="Translation for home.brand.fresh"]'), 20000)
const importLink = [...document.querySelectorAll("main a")].find((a) => a.textContent.trim() === "Import")?.getAttribute("href")
return { imported: document.querySelector('[aria-label="Translation for home.brand.fresh"]').value, importLink }
---
click(byText("aside a", "Import files")); await until(() => /Which project/.test(text()), 20000)
return { highlighted: byText("aside a", "Import files").className.includes("bg-sidebar-accent"), picker: text().includes("Choose a project…") }
```

Run (từ thư mục scratchpad): `node cdp.mjs "<scratchpad>/chrome-import-1" "http://localhost:3000/import?target=web/school-portal" steps-import.txt`

Expected (mỗi dòng JSON theo thứ tự):
1. `picked: true`; bước 1 mở, bước 2 mở (`"false"`), bước 3–4 khóa (`"true"`).
2. `changes: "2 changes"`, `invalid: true`, `button: "Import 1 file · 2 changes"`.
3. `blocker: "1 file has no language yet."`.
4. `flagged: 2`, `cleared: true`.
5. `warning: "499 keys are in none of these files"`, `gone: true`.
6. Đổi project giữa chừng (Review Focus #1): `onStudent.url` chứa `student-app`, `onStudent.changed: false` (Student App chưa có key nên cả hai key hợp lệ là New 2, không còn Changed); `back` chứa `school-portal` và diff lại là Changed 1.
7. `result` khớp, `toast` khớp, `badge` chứa School Portal (số đổi theo dữ liệu), `openLink: true`.
8. `resultsCleared: true`.
9. (điều hướng)
10. `imported: "Mới"`, `importLink: "/import?target=web/school-portal"`.
11. `highlighted: true`, `picker: true`.

Sau đó reset dữ liệu demo để không để lại key `home.brand.fresh`: chạy thêm một đoạn trên cùng profile, hoặc bấm user menu → "Reset demo data" khi xem tay.

- [ ] **Step 7: Commit**

```bash
git add components/import/import-wizard.tsx "app/(workspace)/import/page.tsx" components/app-sidebar.tsx components/translation-workspace.tsx
git commit -m "Add the import wizard page and link it from the sidebar and the workspace"
```
