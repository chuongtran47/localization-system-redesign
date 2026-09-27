# Nền tảng + Translation Workspace parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa repo này (Next.js 16) lên feature parity với workspace của `D:\example_projects\localizer` — routing, mock backend chạy trong trình duyệt, mô hình 4 trạng thái, row editor, draft theo slot, add/delete/export — mà vẫn giữ nguyên theme và visual style hiện tại.

**Architecture:** Logic domain (`lib/`) và mock backend (`mock/`) được port gần như nguyên văn từ repo tham chiếu (đổi tên file sang kebab-case, bỏ đuôi `.ts` trong import). `lib/api.ts` gọi mock router in-process; mock lưu vào `Map` trong memory và persist xuống IndexedDB. UI được viết lại bằng class/pattern của repo này, trên App Router với route group `app/(workspace)` để shell và các provider (draft, coverage) sống qua mọi lần điều hướng.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19, TypeScript 5.7, Tailwind CSS v4, shadcn/ui (`base-nova`, Base UI), lucide-react, next-themes, sonner, cmdk, @tanstack/react-virtual, vitest, fake-indexeddb.

**Spec:** [docs/superpowers/specs/2026-09-27-foundation-workspace-parity-design.md](../specs/2026-09-27-foundation-workspace-parity-design.md)

**Repo tham chiếu:** `D:\example_projects\localizer` (đường dẫn Git Bash: `/d/example_projects/localizer`). Mọi lệnh bash dưới đây chạy từ gốc repo này.

## Global Constraints

- Tên file mới: kebab-case (`locale-data.ts`, `translation-row.tsx`). Không dùng snake_case của repo tham chiếu.
- Không thêm thư viện `motion`. Animation chỉ dùng `tw-animate-css` (đã có): `animate-in`, `fade-in`, `slide-in-from-bottom-2`, `animate-pulse`.
- `lib/api.ts` là module duy nhất import từ `mock/`. Không component/hook nào gọi `fetch` hay import `mock/`.
- Luật domain (`statusOf`, `isValidKey`, `checkTranslation`, `statusIssues`) chỉ định nghĩa trong `lib/`; `mock/` import, không viết lại.
- `components/ui/` do shadcn CLI sinh (`npx shadcn@4.21.0 add …`). Không sửa tay, không đặt logic app trong đó. `components/ui/button.tsx` hiện có không được thay đổi.
- Theme tokens trong `app/globals.css` giữ nguyên; chỉ **thêm** `--info` / `--info-foreground`.
- UI mới dùng class của repo này: card `rounded-xl border border-border bg-card`, nhãn `text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`, pill `rounded-full`, nút hand-rolled `h-9 rounded-lg`.
- Route mặc định `DEFAULT_PROJECT_PATH = "/web/school-portal"`; ngôn ngữ mặc định `vi`.
- Lock, Publish (Test/Live), Bell, workspace switcher, "New application" giữ UI và vẫn inert.
- Draft (`edits`, `keeps`) theo khóa `{target}:{language}`; selection theo `{target}`; không persist.
- Mọi số đếm đọc `row.status` từ router (dữ liệu đã lưu), không tính draft.
- Commit message **không** có dòng `Co-Authored-By` hay bất kỳ attribution Claude/Anthropic nào (chỉ thị global của người dùng).
- Gate mỗi task (khi task nói "chạy gate"): `npm run typecheck` và `npm test` phải qua. Task cuối thêm `npm run build`. Lưu ý: `next.config.mjs` có `typescript.ignoreBuildErrors: true`, nên `next build` **không** type-check — `npm run typecheck` mới là gate kiểu.

## Sai khác có chủ đích so với spec (đã cân nhắc)

1. **`TargetCoverage.languages`** — `GET /coverage` của repo tham chiếu chỉ tổng theo ngôn ngữ (gộp mọi app) hoặc theo target (gộp mọi ngôn ngữ). Badge sidebar và language picker cần số theo target × ngôn ngữ, nên thêm trường `languages: TargetLanguageCoverage[]` vào mỗi `TargetCoverage` (additive, không đổi trường cũ).
2. **Nhóm Messages có dữ liệu thật** — seed template ghi 21 template vào `messages/email|sms|notification`. Workspace của 3 kênh này hiện `ProjectProfileCard` kèm câu "template editor is coming soon" và **không** có Add key (thêm key rời vào kênh template là sai mô hình); badge sidebar vẫn đếm thật.
3. **`AddKeyDialog` gọi `onCreated` ngay khi tạo xong** (như repo tham chiếu) — danh sách phía sau được reload và lọc theo key mới trong lúc dialog còn hiện fan-out; đóng dialog thì thấy đúng kết quả spec mô tả.
4. **Sample data hiện tại là 500 key / 46 group** (không phải 3.339 như tài liệu cũ của repo tham chiếu). Số trong test đo trực tiếp bằng cách chạy store của repo tham chiếu trên cùng dữ liệu (2026-09-27): `vi` 493 translated / 6 missing / 1 needs_fix; `km` 494 / 6; `ja` 496 / 3 / 1; `en` 500 translated. `visitation_scheduled.body` (vi) là `needs_fix` ở `messages/email`.
5. **Thêm script `typecheck`** và nâng `tsconfig` `target` từ `ES6` lên `ES2022` (regex `\p{L}` trong `validation.ts` cần ES2018+; Next dùng SWC nên target này chỉ ảnh hưởng type-check).
6. **Người dùng hiện tại** cho audit là `"Logan Le"` — trùng tên đang hiện ở topbar.
7. **Reset draft** không có hàm riêng: topbar gọi `update(() => emptyDrafts)`; test draft phủ phần cô lập/commit/prune, còn "Reset xóa mọi slot" đúng theo cấu trúc (thay cả state).

## Review Focus

1. **Gõ tiếp trong lúc Save đang chạy** — chữ gõ sau khi bấm Save phải còn trong tray, không bị Save xóa. → Task 4 (`commitSlot`) có test.
2. **Tải sample data lỗi ở lần mở đầu** — hiện lỗi kèm Retry, Retry thành công mà không cần reload trang. → Task 3 có test backend retry; Task 8 nối nút Retry vào `refresh()`.
3. **IndexedDB không dùng được** (cửa sổ riêng tư, bị chặn) — app vẫn chạy trong memory. → Task 3 có test.
4. **Key chứa `/`** (`school_admin/campus.invite.text`) qua tạo/xóa, và chuỗi `q` bất kỳ trên URL. → Task 2 test router; Task 4 test `parseFilters`.
5. **Link chia sẻ với `group`/`lang`/`status`/`version` không hợp lệ** — rơi về giá trị mặc định, không ra danh sách rỗng khó hiểu. → Task 4 có test `parseFilters` + `resolveGroup`.

---

### Task 1: Tooling + port domain lib

**Files:**
- Modify: `package.json` (scripts, devDependencies)
- Modify: `tsconfig.json` (`target`)
- Create: `vitest.config.ts`
- Create (port): `lib/locale-data.ts`, `lib/validation.ts`, `lib/template-preview.ts`, `lib/template-data.ts`, `lib/file-name.ts`, `lib/format-date.ts`, `lib/clipboard.ts`
- Create: `lib/current-user.ts`, `lib/release.ts`
- Test: `tests/domain.test.ts`, `tests/release.test.ts`

**Interfaces:**
- Consumes: không có.
- Produces:
  - `lib/locale-data.ts`: `LanguageCode`, `Language`, `SOURCE_LANGUAGE`, `languages`, `languageNames`, `LocaleBundle`, `KeyOrigin`, `TranslationStatus`, `statusLabel`, `AuditStamp`, `ValueAudit`, `IMPORT_AUTHOR`, `TranslationRow`, `groupKeyOf(key)`, `KEY_PATTERN`, `isValidKey(key)`, `statusOf(input)`, `displayedValueOf(row)`, `GroupOption`, `groupOptionsOf(rows)`.
  - `lib/validation.ts`: `RowIssue`, `placeholdersOf`, `effectiveLengthBudget`, `checkTranslation(source, target, { language, lengthBudget, maxLength?, format? })`, `statusIssues`, `smsInfo`.
  - `lib/file-name.ts`: `safeFileName`, `safeEntryName`, `FILE_NAME_TOKEN`, `applyNamePattern`.
  - `lib/format-date.ts`: `formatDate`, `formatDateTime`.
  - `lib/clipboard.ts`: `copyText(text): Promise<boolean>`.
  - `lib/current-user.ts`: `currentUser: { name: string }`.
  - `lib/release.ts`: `ALL_VERSIONS = "All"`, `versions: string[]`, `releaseOf(key): string | null`.

- [ ] **Step 1: Cài công cụ test và thêm script**

```bash
npm install -D vitest@^3.2.4 fake-indexeddb@^6.0.1
npm pkg set scripts.test="vitest run" scripts.typecheck="tsc --noEmit"
```

Sửa `tsconfig.json`: đổi `"target": "ES6"` thành `"target": "ES2022"`.

Tạo `vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
})
```

- [ ] **Step 2: Viết test domain (sẽ fail vì chưa có module)**

Tạo `tests/domain.test.ts`:

```ts
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
```

Tạo `tests/release.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { ALL_VERSIONS, releaseOf, versions } from "@/lib/release"

describe("releaseOf", () => {
  const keys = Array.from({ length: 2000 }, (_, index) => `group.key${index}`)

  it("is deterministic", () => {
    expect(keys.map(releaseOf)).toEqual(keys.map(releaseOf))
  })

  it("leaves roughly a third unassigned and uses every release", () => {
    const assigned = keys.map(releaseOf)
    const unassigned = assigned.filter((value) => value === null).length / keys.length
    expect(unassigned).toBeGreaterThan(0.2)
    expect(unassigned).toBeLessThan(0.4)
    expect(new Set(assigned.filter(Boolean))).toEqual(new Set(versions.filter((v) => v !== ALL_VERSIONS)))
  })
})
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "@/lib/locale-data"` (và `@/lib/release`).

- [ ] **Step 4: Port các module domain**

```bash
R=/d/example_projects/localizer/src
port() {
  sed -E \
    -e 's#from "(\.\.?/[^"]+)\.ts"#from "\1"#g' \
    -e 's#(locale|api|template|file|format)_(data|types|preview|name|store|date)#\1-\2#g' \
    "$1" > "$2"
}
port $R/lib/locale_data.ts      lib/locale-data.ts
port $R/lib/validation.ts       lib/validation.ts
port $R/lib/template_preview.ts lib/template-preview.ts
port $R/lib/template_data.ts    lib/template-data.ts
port $R/lib/file_name.ts        lib/file-name.ts
port $R/lib/format_date.ts      lib/format-date.ts
port $R/lib/clipboard.ts        lib/clipboard.ts
grep -n 'from "' lib/locale-data.ts lib/validation.ts lib/template-preview.ts lib/template-data.ts
```

Expected của lệnh `grep`: mọi import trỏ tới `./locale-data`, `./validation`, `./template-preview` hoặc `@/lib/locale-data` — không còn `.ts` cuối, không còn snake_case.

Tạo `lib/current-user.ts`:

```ts
export type CurrentUser = {
  name: string
}

export const currentUser: CurrentUser = {
  name: "Logan Le",
}
```

Tạo `lib/release.ts`:

```ts
export const ALL_VERSIONS = "All"

export const versions = [
  ALL_VERSIONS,
  "v7.1",
  "v7.2",
  "v8",
  "v9",
  "v8.5",
  "v9.1",
  "v10",
  "v11",
  "v11.1",
  "v12",
  "v12.1",
  "v12.2",
  "v12.3",
]

const releases = versions.slice(1)

/**
 * Release assignment is not in the sample bundles, so each key gets one by a
 * stable hash of its name: about 30% unassigned, the rest spread over the
 * releases. Replace with the backend's field once it exists.
 */
export function releaseOf(key: string): string | null {
  let hash = 0x811c9dc5
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  hash >>>= 0
  if (hash % 10 < 3) {
    return null
  }
  return releases[Math.floor(hash / 10) % releases.length]
}
```

- [ ] **Step 5: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: `tests/domain.test.ts` và `tests/release.test.ts` PASS; `tsc` không báo lỗi.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts lib tests
git commit -m "Port domain rules from the reference Localizer and add vitest"
```

---

### Task 2: Mock backend (store, router, zip) + sample data

**Files:**
- Create (port): `lib/api-types.ts`, `lib/coverage.ts`, `mock/file-store.ts`, `mock/zip.ts`, `mock/store.ts`, `mock/router.ts`
- Create: `public/sample-data/locale/*.json` (13 file), `public/sample-data/templates.json`
- Test: `tests/helpers/backend.ts`, `tests/helpers/zip.ts`, `tests/router.test.ts`

**Interfaces:**
- Consumes: mọi export của Task 1.
- Produces:
  - `lib/api-types.ts`: `KeyRecord`, `AuditLog`, `EntriesResponse`, `TemplatesResponse`, `CreateKeyRequest`, `CreateKeyResponse`, `DeleteScope = "language" | "all"`, `DeleteKeysRequest`, `DeleteKeysResponse { scope, deleted, files }`, `SaveTranslationsRequest`, `SaveTranslationsResponse { saved, file }`, `ImportMode`, `ImportRequest`, `ImportResponse`, `StatusCounts { missing, outdated, needsFix }`, `LanguageCoverage`, `TargetLanguageCoverage = StatusCounts & { code: LanguageCode; total: number; translated: number }`, `TargetCoverage = StatusCounts & { target: string; languages: TargetLanguageCoverage[] }`, `CoverageResponse`, `ExportFile`, `ExportRequest`, `ApiErrorBody`.
  - `lib/coverage.ts`: `outstandingOf(counts)`, `targetLanguageCoverage(coverage, target, language): TargetLanguageCoverage | null` (cộng các hàm port sẵn).
  - `mock/file-store.ts`: `FileStore { read, write, clear }`, `SeedSource { locale(code), templates() }`, `TemplateSeed`.
  - `mock/store.ts`: `createStore(files, seeds): Store`, `HttpError`, `Store`.
  - `mock/router.ts`: `handleRequest(store, request, path): Promise<Response>`.
  - `mock/zip.ts`: `createZip(entries)`, `Bytes`.
  - `tests/helpers/backend.ts`: `nodeSeeds`, `memoryFileStore()`, `createTestStore()`, `call(store, method, url, body?)`, `callJson<T>(...)`.
  - Target của seed: bundle School → `web/school-portal`; template → `messages/email|sms|notification`.

- [ ] **Step 1: Chép sample data**

```bash
mkdir -p public/sample-data/locale
cp /d/example_projects/localizer/sample-data/locale/*.json public/sample-data/locale/
sed 's#"target": "others/#"target": "messages/#' /d/example_projects/localizer/sample-data/templates.json > public/sample-data/templates.json
ls public/sample-data/locale | wc -l
grep -c '"target": "messages/' public/sample-data/templates.json
```

Expected: `13` và `21`.

- [ ] **Step 2: Viết helper test**

Tạo `tests/helpers/backend.ts`:

```ts
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import type { LocaleBundle } from "@/lib/locale-data"
import type { FileStore, SeedSource, TemplateSeed } from "@/mock/file-store"
import { handleRequest } from "@/mock/router"
import { createStore, type Store } from "@/mock/store"

const sampleDir = fileURLToPath(new URL("../../public/sample-data/", import.meta.url))

function readJson<T>(file: string): T | null {
  const path = `${sampleDir}${file}`
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : null
}

export const nodeSeeds: SeedSource = {
  locale: async (code) => readJson<LocaleBundle>(`locale/${code}.json`),
  templates: async () => readJson<TemplateSeed[]>("templates.json"),
}

export function memoryFileStore(): FileStore {
  const files = new Map<string, string>()
  return {
    read: (path) => files.get(path) ?? null,
    write: (path, text) => {
      files.set(path, text)
    },
    clear: () => files.clear(),
  }
}

export function createTestStore(): Store {
  return createStore(memoryFileStore(), nodeSeeds)
}

export function call(store: Store, method: string, url: string, body?: unknown) {
  const request = new Request(`http://test${url}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return handleRequest(store, request, new URL(request.url).pathname)
}

export async function callJson<T>(store: Store, method: string, url: string, body?: unknown) {
  const response = await call(store, method, url, body)
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : undefined) as T }
}
```

Tạo `tests/helpers/zip.ts` (đọc lại archive và kiểm CRC):

```ts
const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Every entry's name and text; throws if a CRC in a local header is wrong. */
export async function readZip(bytes: Uint8Array): Promise<Record<string, string>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  const out: Record<string, string> = {}
  let offset = 0

  while (view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true)
    const crc = view.getUint32(offset + 14, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLength))
    const start = offset + 30 + nameLength + extraLength
    const stored = bytes.subarray(start, start + compressedSize)
    const content = method === 8 ? await inflateRaw(stored) : stored
    if (crc32(content) !== crc) {
      throw new Error(`CRC mismatch in ${name}`)
    }
    out[name] = decoder.decode(content)
    offset = start + compressedSize
  }

  return out
}
```

- [ ] **Step 3: Viết test router (sẽ fail)**

Tạo `tests/router.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest"

import type {
  ApiErrorBody,
  CoverageResponse,
  CreateKeyResponse,
  DeleteKeysResponse,
  EntriesResponse,
} from "@/lib/api-types"
import type { TranslationRow } from "@/lib/locale-data"
import type { Store } from "@/mock/store"
import { call, callJson, createTestStore } from "./helpers/backend"
import { readZip } from "./helpers/zip"

const SCHOOL = "web/school-portal"
const CANCEL = "user.form.actions.cancel"
const COPY = "product.producttype.grapeseed"

let store: Store

beforeEach(() => {
  store = createTestStore()
})

async function entries(target: string, lang: string) {
  const { body } = await callJson<EntriesResponse>(store, "GET", `/entries?target=${target}&lang=${lang}`)
  return body.entries
}

async function rowOf(target: string, lang: string, key: string) {
  return (await entries(target, lang)).find((row) => row.key === key)
}

function countsOf(rows: TranslationRow[]) {
  const counts: Record<string, number> = {}
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1
  }
  return counts
}

describe("seed", () => {
  it("matches the reference implementation's counts for School Portal", async () => {
    expect(countsOf(await entries(SCHOOL, "en"))).toEqual({ translated: 500 })
    expect(countsOf(await entries(SCHOOL, "vi"))).toEqual({ translated: 493, missing: 6, needs_fix: 1 })
    expect(countsOf(await entries(SCHOOL, "km"))).toEqual({ translated: 494, missing: 6 })
    expect(countsOf(await entries(SCHOOL, "ja"))).toEqual({ translated: 496, missing: 3, needs_fix: 1 })
  })

  it("flags the deliberately broken rows", async () => {
    expect((await rowOf(SCHOOL, "vi", "school_teacher.message.cannotdeleteschoolteacher"))?.status).toBe("needs_fix")
    expect((await rowOf("messages/email", "vi", "visitation_scheduled.body"))?.status).toBe("needs_fix")
  })

  it("answers an empty list for a project nobody has added keys to", async () => {
    expect(await entries("mobile/student-app", "vi")).toEqual([])
  })
})

describe("keys", () => {
  it("creates a key in all 13 languages of one project only", async () => {
    const created = await callJson<CreateKeyResponse>(store, "POST", "/keys", {
      key: "home.greeting.title",
      source: "Hello",
      target: "mobile/student-app",
      createdBy: "Tester",
    })
    expect(created.status).toBe(201)
    expect(created.body.languages).toHaveLength(13)
    expect((await rowOf("mobile/student-app", "vi", "home.greeting.title"))?.status).toBe("missing")
    expect(await rowOf(SCHOOL, "vi", "home.greeting.title")).toBeUndefined()
  })

  it("refuses a duplicate in the same project and a malformed key", async () => {
    const input = { key: "home.greeting.title", source: "Hello", target: SCHOOL }
    expect((await call(store, "POST", "/keys", input)).status).toBe(201)
    expect((await call(store, "POST", "/keys", input)).status).toBe(409)
    expect((await call(store, "POST", "/keys", { ...input, key: "nogroup" })).status).toBe(400)
  })

  it("handles a key containing a slash through create and delete", async () => {
    const key = "school_admin/campus.invite.text"
    expect((await call(store, "POST", "/keys", { key, source: "Invite", target: SCHOOL })).status).toBe(201)
    const deleted = await callJson<DeleteKeysResponse>(store, "POST", "/keys/delete", {
      target: SCHOOL,
      keys: [key],
      scope: "all",
    })
    expect(deleted.body.deleted).toBe(1)
    expect(await rowOf(SCHOOL, "en", key)).toBeUndefined()
  })

  it("clears one language with scope language and keeps the key", async () => {
    const deleted = await callJson<DeleteKeysResponse>(store, "POST", "/keys/delete", {
      target: SCHOOL,
      keys: [CANCEL],
      scope: "language",
      language: "vi",
    })
    expect(deleted.body.deleted).toBe(1)
    expect((await rowOf(SCHOOL, "vi", CANCEL))?.status).toBe("missing")
    expect((await rowOf(SCHOOL, "en", CANCEL))?.target).toBe("Cancel")
  })

  it("removes the key everywhere with scope all", async () => {
    await call(store, "POST", "/keys/delete", { target: SCHOOL, keys: [CANCEL], scope: "all" })
    expect(await rowOf(SCHOOL, "en", CANCEL)).toBeUndefined()
    expect(await rowOf(SCHOOL, "vi", CANCEL)).toBeUndefined()
  })
})

describe("saving", () => {
  it("makes a translation outdated when its English changes, and confirming clears it", async () => {
    await call(store, "PUT", `/translations/en?target=${SCHOOL}`, { values: { [CANCEL]: "Cancel now" }, by: "T" })
    expect((await rowOf(SCHOOL, "vi", CANCEL))?.status).toBe("outdated")
    await call(store, "PUT", `/translations/vi?target=${SCHOOL}`, { values: { [CANCEL]: "Hủy" }, by: "T" })
    expect((await rowOf(SCHOOL, "vi", CANCEL))?.status).toBe("translated")
  })

  it("refuses keep for English and for a key that is also edited", async () => {
    const english = await callJson<ApiErrorBody>(store, "PUT", `/translations/en?target=${SCHOOL}`, {
      values: {},
      keep: [CANCEL],
    })
    expect(english.status).toBe(400)
    expect(english.body.error).toBe("English cannot be kept as English.")

    const both = await call(store, "PUT", `/translations/vi?target=${SCHOOL}`, {
      values: { [COPY]: "GrapeSEED" },
      keep: [COPY],
    })
    expect(both.status).toBe(400)
  })

  it("keeps a copy on purpose, and a later ordinary write takes the keep back", async () => {
    expect((await call(store, "PUT", `/translations/vi?target=${SCHOOL}`, { values: {}, keep: [COPY] })).status).toBe(200)
    let row = await rowOf(SCHOOL, "vi", COPY)
    expect(row).toMatchObject({ status: "translated", keptSource: true })

    await call(store, "PUT", `/translations/vi?target=${SCHOOL}`, { values: { [COPY]: "GrapeSEED" } })
    row = await rowOf(SCHOOL, "vi", COPY)
    expect(row).toMatchObject({ status: "missing", keptSource: false })
  })
})

describe("export", () => {
  it("builds a readable zip and drops missing keys when asked", async () => {
    const response = await call(store, "POST", "/export", {
      target: SCHOOL,
      files: [
        { language: "vi", name: "vi.json" },
        { language: "en", name: "en-US.json" },
      ],
      name: "school",
      includeUntranslated: false,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get("content-disposition")).toContain('filename="school.zip"')

    const files = await readZip(new Uint8Array(await response.arrayBuffer()))
    expect(Object.keys(files).sort()).toEqual(["en-US.json", "vi.json"])
    const vi = JSON.parse(files["vi.json"]) as Record<string, string>
    expect(Object.keys(vi)).toHaveLength(494)
    expect(vi).not.toHaveProperty(COPY)
    expect(Object.keys(JSON.parse(files["en-US.json"]))).toHaveLength(500)
  })

  it("refuses two files with the same name and a project with no keys", async () => {
    const same = await call(store, "POST", "/export", {
      target: SCHOOL,
      files: [
        { language: "vi", name: "a.json" },
        { language: "ja", name: "A.json" },
      ],
      name: "x",
      includeUntranslated: true,
    })
    expect(same.status).toBe(400)

    const empty = await call(store, "POST", "/export", {
      target: "mobile/student-app",
      files: [{ language: "vi", name: "vi.json" }],
      name: "x",
      includeUntranslated: true,
    })
    expect(empty.status).toBe(404)
  })
})

describe("coverage and reset", () => {
  it("reports counts per project and language", async () => {
    const { body } = await callJson<CoverageResponse>(store, "GET", "/coverage")
    const school = body.targets.find((entry) => entry.target === SCHOOL)
    expect(school?.languages.find((entry) => entry.code === "vi")).toEqual({
      code: "vi",
      total: 500,
      translated: 493,
      missing: 6,
      outdated: 0,
      needsFix: 1,
    })
    expect(school?.languages.find((entry) => entry.code === "en")).toMatchObject({ total: 500, translated: 500 })
    expect(body.targets.map((entry) => entry.target)).toContain("messages/email")
  })

  it("returns to the seed on reset", async () => {
    await call(store, "POST", "/keys", { key: "home.greeting.title", source: "Hello", target: SCHOOL })
    expect((await call(store, "POST", "/reset")).status).toBe(204)
    expect(await entries(SCHOOL, "en")).toHaveLength(500)
  })
})
```

- [ ] **Step 4: Chạy test, xác nhận fail**

Run: `npm test -- tests/router.test.ts`
Expected: FAIL — `Failed to resolve import "@/mock/router"`.

- [ ] **Step 5: Port mock và api-types**

```bash
R=/d/example_projects/localizer/src
port() {
  sed -E \
    -e 's#from "(\.\.?/[^"]+)\.ts"#from "\1"#g' \
    -e 's#(locale|api|template|file|format)_(data|types|preview|name|store|date)#\1-\2#g' \
    "$1" > "$2"
}
mkdir -p mock
port $R/lib/api_types.ts   lib/api-types.ts
port $R/lib/coverage.ts    lib/coverage.ts
port $R/mock/file_store.ts mock/file-store.ts
port $R/mock/zip.ts        mock/zip.ts
port $R/mock/store.ts      mock/store.ts
port $R/mock/router.ts     mock/router.ts
sed -i 's#const SEED_TARGET = "web/school";#const SEED_TARGET = "web/school-portal";#' mock/store.ts
grep -n 'SEED_TARGET = ' mock/store.ts
```

Expected: `const SEED_TARGET = "web/school-portal";`.

- [ ] **Step 6: Thêm coverage theo target × ngôn ngữ**

Trong `lib/api-types.ts`, thay:

```ts
/** One target's open keys, summed over every language but English. */
export type TargetCoverage = StatusCounts & {
  target: string
}
```

bằng:

```ts
/** One target's counts in one language - the sidebar badge and the language picker. */
export type TargetLanguageCoverage = StatusCounts & {
  code: LanguageCode
  total: number
  translated: number
}

/** One target's open keys, summed over every language but English, plus each language on its own. */
export type TargetCoverage = StatusCounts & {
  target: string
  languages: TargetLanguageCoverage[]
}
```

Trong `mock/store.ts`, thêm `TargetLanguageCoverage,` vào danh sách `import type { … } from "../lib/api-types";` ở đầu file, rồi thay khối:

```ts
      const targets: TargetCoverage[] = [...byTargetCounts.entries()].map(
        ([target, targetCounts]) => ({ target, ...targetCounts }),
      );
```

bằng:

```ts
      const languagesOfTarget = new Map<string, TargetLanguageCoverage[]>();
      for (const [target, targetRecords] of byTarget) {
        const source = bundle(target, SOURCE_LANGUAGE);
        const fields = fieldsOfTarget.get(target) ?? new Map();
        languagesOfTarget.set(
          target,
          languages.map((language) => {
            const values = bundle(target, language.code);
            const log = auditLog(target, language.code);
            const entry: TargetLanguageCoverage = {
              code: language.code,
              total: targetRecords.length,
              translated: 0,
              ...zero(),
            };
            for (const record of targetRecords) {
              const { status } = statusFor(
                fields,
                record.key,
                source[record.key] ?? "",
                values[record.key],
                language.code,
                log[record.key],
              );
              if (status === "translated") {
                entry.translated += 1;
              } else {
                entry[bucketOf[status]] += 1;
              }
            }
            return entry;
          }),
        );
      }

      const targets: TargetCoverage[] = [...byTargetCounts.entries()].map(
        ([target, targetCounts]) => ({
          target,
          ...targetCounts,
          languages: languagesOfTarget.get(target) ?? [],
        }),
      );
```

Cuối `lib/coverage.ts`, thêm (và thêm `TargetLanguageCoverage` vào `import type` từ `@/lib/api-types` ở đầu file):

```ts
/** One project's counts in one language, or null while loading or for a project with no keys. */
export function targetLanguageCoverage(
  coverage: CoverageResponse | null,
  target: string,
  language: LanguageCode
): TargetLanguageCoverage | null {
  return (
    targetCoverageOf(coverage, target)?.languages.find(
      (entry) => entry.code === language
    ) ?? null
  )
}
```

- [ ] **Step 7: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: toàn bộ test PASS (domain, release, router); `tsc` sạch.

- [ ] **Step 8: Commit**

```bash
git add lib mock public/sample-data tests
git commit -m "Port the mock backend, seed School Portal and message channels"
```

---

### Task 3: Browser backend (IndexedDB) + API client

**Files:**
- Create: `mock/browser-backend.ts`
- Create (viết lại từ bản tham chiếu): `lib/api.ts`
- Test: `tests/browser-backend.test.ts`

**Interfaces:**
- Consumes: `createStore`, `handleRequest`, `FileStore`, `SeedSource` (Task 2); `currentUser` (Task 1).
- Produces:
  - `mock/browser-backend.ts`: `type LocalFetch = (path: string, init?: RequestInit) => Promise<Response>`, `createBrowserBackend({ seeds, indexedDB? }): LocalFetch`, `publicSeeds: SeedSource`, `localFetch: LocalFetch` (singleton trên `publicSeeds` + `globalThis.indexedDB`).
  - `lib/api.ts`: `ApiError`, `messageOf(cause)`, `fetchEntries(target, lang)`, `fetchTemplates(target, lang)`, `createKey(input)`, `deleteKeys(input)`, `saveTranslations(target, lang, values, keep?)`, `importBundle(...)`, `fetchCoverage()`, `exportBundle(input) → { blob, filename }`, `download(blob, filename)`, `resetData()`.

- [ ] **Step 1: Viết test (sẽ fail)**

Tạo `tests/browser-backend.test.ts`:

```ts
import { IDBFactory } from "fake-indexeddb"
import { describe, expect, it } from "vitest"

import type { EntriesResponse } from "@/lib/api-types"
import type { SeedSource } from "@/mock/file-store"
import { createBrowserBackend, type LocalFetch } from "@/mock/browser-backend"
import { nodeSeeds } from "./helpers/backend"

const SCHOOL = "web/school-portal"

const failingSeeds: SeedSource = {
  locale: () => Promise.reject(new Error("seed should not run")),
  templates: () => Promise.reject(new Error("seed should not run")),
}

async function send(backend: LocalFetch, method: string, path: string, body?: unknown) {
  const response = await backend(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

async function englishKeys(backend: LocalFetch) {
  const { body } = await send(backend, "GET", `/entries?target=${SCHOOL}&lang=en`)
  return (body as EntriesResponse).entries.map((row) => row.key)
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

describe("browser backend", () => {
  it("keeps writes across a reload, and reset returns to the seed", async () => {
    const idb = new IDBFactory()
    const first = createBrowserBackend({ seeds: nodeSeeds, indexedDB: idb })
    const created = await send(first, "POST", "/keys", { key: "home.greeting.title", source: "Hello", target: SCHOOL })
    expect(created.status).toBe(201)
    await settle()

    const reloaded = createBrowserBackend({ seeds: failingSeeds, indexedDB: idb })
    expect(await englishKeys(reloaded)).toContain("home.greeting.title")

    const resetter = createBrowserBackend({ seeds: nodeSeeds, indexedDB: idb })
    expect((await send(resetter, "POST", "/reset")).status).toBe(204)
    await settle()

    const afterReset = createBrowserBackend({ seeds: failingSeeds, indexedDB: idb })
    const keys = await englishKeys(afterReset)
    expect(keys).toHaveLength(500)
    expect(keys).not.toContain("home.greeting.title")
  })

  it("still works in memory when IndexedDB is unavailable", async () => {
    const blocked = {
      open: () => {
        throw new Error("blocked")
      },
    } as unknown as IDBFactory
    const backend = createBrowserBackend({ seeds: nodeSeeds, indexedDB: blocked })
    expect(await englishKeys(backend)).toHaveLength(500)
  })

  it("recovers when the seed download fails the first time", async () => {
    let attempts = 0
    const flaky: SeedSource = {
      locale: (code) => {
        attempts += 1
        return attempts === 1 ? Promise.reject(new Error("offline")) : nodeSeeds.locale(code)
      },
      templates: () => nodeSeeds.templates(),
    }
    const backend = createBrowserBackend({ seeds: flaky, indexedDB: new IDBFactory() })

    const failed = await send(backend, "GET", `/entries?target=${SCHOOL}&lang=en`)
    expect(failed.status).toBe(500)
    expect(failed.body.error).toContain("offline")

    expect(await englishKeys(backend)).toHaveLength(500)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- tests/browser-backend.test.ts`
Expected: FAIL — `Failed to resolve import "@/mock/browser-backend"`.

- [ ] **Step 3: Viết `mock/browser-backend.ts`**

```ts
/**
 * The mock backend, running in the tab: the router and store from this folder
 * over a map of documents that is persisted to IndexedDB behind the caller's
 * back. `FileStore` is synchronous and IndexedDB is not, so the map is the
 * store and the database is a copy of it. A write that fails to persist still
 * succeeds for the session; only the next reload loses it.
 */

import type { LocaleBundle } from "../lib/locale-data"
import type { FileStore, SeedSource, TemplateSeed } from "./file-store"
import { handleRequest } from "./router"
import { createStore } from "./store"

const DB_NAME = "localizer-mock"
const DB_VERSION = 1
const STORE_NAME = "files"

export type LocalFetch = (path: string, init?: RequestInit) => Promise<Response>

export type BrowserBackendOptions = {
  seeds: SeedSource
  /** Null runs in memory only. Defaults to the browser's own. */
  indexedDB?: IDBFactory | null
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url)
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Could not load the sample data at ${url}`)
  }
  return (await response.json()) as T
}

export const publicSeeds: SeedSource = {
  locale: (code) => fetchJson<LocaleBundle>(`/sample-data/locale/${code}.json`),
  templates: () => fetchJson<TemplateSeed[]>("/sample-data/templates.json"),
}

function openDatabase(factory: IDBFactory | null): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (!factory) {
      resolve(null)
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = factory.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function readAll(db: IDBDatabase): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    const files = new Map<string, string>()
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).openCursor()

    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) {
        resolve(files)
        return
      }
      files.set(String(cursor.key), cursor.value as string)
      cursor.continue()
    }
    request.onerror = () => resolve(files)
  })
}

function browserFileStore(db: IDBDatabase | null, files: Map<string, string>): FileStore {
  const persist = (apply: (store: IDBObjectStore) => void) => {
    if (!db) {
      return
    }
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite")
      transaction.onerror = () => {
        console.warn("[mock] could not persist to IndexedDB", transaction.error)
      }
      apply(transaction.objectStore(STORE_NAME))
    } catch (cause) {
      console.warn("[mock] could not persist to IndexedDB", cause)
    }
  }

  return {
    read: (path) => files.get(path) ?? null,
    write: (path, text) => {
      files.set(path, text)
      persist((store) => store.put(text, path))
    },
    clear: () => {
      files.clear()
      persist((store) => store.clear())
    },
  }
}

/** A fresh backend. Tests make one per simulated page load. */
export function createBrowserBackend({
  seeds,
  indexedDB: factory = globalThis.indexedDB ?? null,
}: BrowserBackendOptions): LocalFetch {
  let handler: Promise<(request: Request, path: string) => Promise<Response>> | undefined

  const start = async () => {
    const db = await openDatabase(factory)
    const store = createStore(browserFileStore(db, db ? await readAll(db) : new Map()), seeds)
    return (request: Request, path: string) => handleRequest(store, request, path)
  }

  return async (path, init) => {
    handler ??= start()
    const handle = await handler
    const url = new URL(path, "http://localhost")
    return handle(new Request(url, init), url.pathname)
  }
}

let shared: LocalFetch | undefined

/** The page's one backend, started on the first request. */
export const localFetch: LocalFetch = (path, init) => {
  shared ??= createBrowserBackend({ seeds: publicSeeds })
  return shared(path, init)
}
```

- [ ] **Step 4: Viết `lib/api.ts`**

```ts
/**
 * The only module in the app that knows a backend exists. Today that is the
 * mock in `mock/`, running in the tab; pointing the app at a real service
 * means changing `send` below and nothing else.
 */

import type {
  ApiErrorBody,
  CoverageResponse,
  CreateKeyRequest,
  CreateKeyResponse,
  DeleteKeysRequest,
  DeleteKeysResponse,
  EntriesResponse,
  ExportRequest,
  ImportMode,
  ImportRequest,
  ImportResponse,
  SaveTranslationsRequest,
  SaveTranslationsResponse,
  TemplatesResponse,
} from "@/lib/api-types"
import { currentUser } from "@/lib/current-user"
import type { LanguageCode } from "@/lib/locale-data"

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export function messageOf(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.message
  }
  return String(cause)
}

async function send(path: string, init?: RequestInit): Promise<Response> {
  const request: RequestInit = {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  }

  let response: Response
  try {
    const { localFetch } = await import("@/mock/browser-backend")
    response = await localFetch(path, request)
  } catch (cause) {
    throw new ApiError(0, `The demo backend could not answer - ${messageOf(cause)}`)
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null
    throw new ApiError(response.status, body?.error ?? `${response.status} ${response.statusText}`)
  }

  return response
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init)
  if (response.status === 204) {
    return undefined as T
  }
  return (await response.json()) as T
}

const query = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (value) {
      search.set(name, value)
    }
  }
  return search.toString()
}

export function fetchEntries(target: string, lang: LanguageCode) {
  return request<EntriesResponse>(`/entries?${query({ target, lang })}`)
}

export function fetchTemplates(target: string, lang: LanguageCode) {
  return request<TemplatesResponse>(`/templates?${query({ target, lang })}`)
}

export function createKey(input: CreateKeyRequest) {
  return request<CreateKeyResponse>("/keys", {
    method: "POST",
    body: JSON.stringify({ createdBy: currentUser.name, ...input } satisfies CreateKeyRequest),
  })
}

export function deleteKeys(input: DeleteKeysRequest) {
  return request<DeleteKeysResponse>("/keys/delete", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function saveTranslations(
  target: string,
  lang: LanguageCode,
  values: Record<string, string>,
  keep: string[] = []
) {
  return request<SaveTranslationsResponse>(`/translations/${lang}?${query({ target })}`, {
    method: "PUT",
    body: JSON.stringify({ values, keep, by: currentUser.name } satisfies SaveTranslationsRequest),
  })
}

export function importBundle(
  target: string,
  lang: LanguageCode,
  values: Record<string, string>,
  mode: ImportMode
) {
  return request<ImportResponse>(`/import/${lang}?${query({ target })}`, {
    method: "PUT",
    body: JSON.stringify({ values, mode, by: currentUser.name } satisfies ImportRequest),
  })
}

export function fetchCoverage() {
  return request<CoverageResponse>("/coverage")
}

export async function exportBundle(input: ExportRequest) {
  const response = await send("/export", { method: "POST", body: JSON.stringify(input) })
  const disposition = response.headers.get("content-disposition") ?? ""
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  const plain = /filename="([^"]+)"/.exec(disposition)

  return {
    blob: await response.blob(),
    filename: encoded ? decodeURIComponent(encoded[1]) : (plain?.[1] ?? "translations.zip"),
  }
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function resetData() {
  return request<void>("/reset", { method: "POST" })
}
```

- [ ] **Step 5: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS toàn bộ, gồm 3 test của `tests/browser-backend.test.ts`. Nếu test reload fail vì transaction chưa commit, tăng `settle` lên 100ms — **không** đổi logic persist.

- [ ] **Step 6: Commit**

```bash
git add mock/browser-backend.ts lib/api.ts tests/browser-backend.test.ts
git commit -m "Run the mock backend in the browser over IndexedDB behind lib/api"
```

---

### Task 4: Project registry, workspace view rules, draft store (logic thuần)

**Files:**
- Create: `lib/projects.ts`, `lib/workspace-view.ts`, `lib/drafts.ts`
- Test: `tests/projects.test.ts`, `tests/workspace-view.test.ts`, `tests/drafts.test.ts`

**Interfaces:**
- Consumes: `languages`, `LanguageCode`, `TranslationRow`, `TranslationStatus`, `statusLabel`, `groupOptionsOf`, `GroupOption` (Task 1); `ALL_VERSIONS`, `versions`, `releaseOf` (Task 1); `DeleteScope` (Task 2).
- Produces:
  - `lib/projects.ts`: `ProjectGroup = "web" | "mobile" | "content" | "services" | "messages"`, `ContentKind = "ui" | "email" | "sms" | "notification"`, `ProjectProfile { kind, audience, tone, note, lengthBudget, maxLength?, measured }`, `Project { id, name, group, profile }`, `projectGroups: { id, label }[]`, `groupLabel: Record<ProjectGroup, string>`, `kindLabel: Record<ContentKind, string>`, `projects: Project[]`, `targetOf(project)`, `projectPath(project)`, `findProject(group, id)`, `findProjectByPath(pathname)`, `DEFAULT_PROJECT_PATH`.
  - `lib/workspace-view.ts`: `StatusFilter`, `statusFilters`, `ALL_GROUPS`, `DEFAULT_LANGUAGE`, `WorkspaceFilters { language, group, status, version, q }`, `parseFilters(params)`, `resolveGroup(group, rows, isLoading)`, `StatusTotals`, `WorkspaceView { visible, statusCounts, totals, groupOptions, hasManual }`, `viewOf(rows, filters)`.
  - `lib/drafts.ts`: `Slot { edits, keeps }`, `DraftState { slots, selected }`, `emptyDrafts`, `slotKeyOf(target, language)`, `slotOf`, `selectedOf`, `pendingCount`, `setEdit(state, slotKey, key, value, displayed | null)`, `setKeep`, `discardSlot`, `commitSlot(state, slotKey, saved)`, `setSelected(state, target, keys, on)`, `clearSelected`, `pruneDeleted(state, target, keys, scope, language)`.

- [ ] **Step 1: Viết test (sẽ fail)**

Tạo `tests/projects.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { DEFAULT_PROJECT_PATH, findProjectByPath, projectPath, projects } from "@/lib/projects"

describe("projects", () => {
  it("has 23 applications and 3 message channels with unique paths", () => {
    expect(projects.filter((p) => p.group !== "messages")).toHaveLength(23)
    expect(projects.filter((p) => p.group === "messages").map((p) => p.id)).toEqual(["email", "sms", "notification"])
    expect(new Set(projects.map(projectPath)).size).toBe(projects.length)
  })

  it("opens on School Portal, the project with measured data", () => {
    const project = findProjectByPath(DEFAULT_PROJECT_PATH)
    expect(project?.name).toBe("School Portal")
    expect(project?.profile.measured).toBe(true)
  })

  it("finds nothing for an unknown path", () => {
    expect(findProjectByPath("/web/nope")).toBeNull()
    expect(findProjectByPath("/")).toBeNull()
  })
})
```

Tạo `tests/workspace-view.test.ts`:

```ts
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
```

Tạo `tests/drafts.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  commitSlot,
  discardSlot,
  emptyDrafts,
  pendingCount,
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npm test -- tests/projects.test.ts tests/workspace-view.test.ts tests/drafts.test.ts`
Expected: FAIL — không resolve được `@/lib/projects`, `@/lib/workspace-view`, `@/lib/drafts`.

- [ ] **Step 3: Viết `lib/projects.ts`**

```ts
export type ProjectGroup = "web" | "mobile" | "content" | "services" | "messages"

export type ContentKind = "ui" | "email" | "sms" | "notification"

export type ProjectProfile = {
  kind: ContentKind
  /** Who reads the strings in the shipped product. */
  audience: string
  /** Register the copy has to keep. */
  tone: string
  note: string
  /** Ratio over the English length past which a row warns. */
  lengthBudget: number
  /** Hard ceiling on a value, where one is known. */
  maxLength?: number
  /** False while the profile is inferred rather than measured. */
  measured: boolean
}

export type Project = {
  id: string
  name: string
  group: ProjectGroup
  profile: ProjectProfile
}

export const projectGroups: { id: ProjectGroup; label: string }[] = [
  { id: "web", label: "Web" },
  { id: "mobile", label: "Mobile" },
  { id: "content", label: "Content" },
  { id: "services", label: "Services" },
  { id: "messages", label: "Messages" },
]

export const groupLabel = Object.fromEntries(
  projectGroups.map((group) => [group.id, group.label])
) as Record<ProjectGroup, string>

export const kindLabel: Record<ContentKind, string> = {
  ui: "UI strings",
  email: "Email templates",
  sms: "SMS templates",
  notification: "Notification templates",
}

const NOT_IMPORTED = "No source bundle imported yet."

const inferred: Record<Exclude<ProjectGroup, "messages">, ProjectProfile> = {
  web: {
    kind: "ui",
    audience: "Teachers, school staff and administrators on the web portals",
    tone: "Administrative and clear. Keep product terms consistent with School Portal.",
    note: NOT_IMPORTED,
    lengthBudget: 1.5,
    measured: false,
  },
  mobile: {
    kind: "ui",
    audience: "Students, parents and teachers on a phone",
    tone: "Plain and short. A phone-width label has nowhere to overflow.",
    note: NOT_IMPORTED,
    lengthBudget: 1.3,
    measured: false,
  },
  content: {
    kind: "ui",
    audience: "Learners and teachers reading curriculum content",
    tone: "Instructional. Match the curriculum vocabulary.",
    note: NOT_IMPORTED,
    lengthBudget: 1.5,
    measured: false,
  },
  services: {
    kind: "ui",
    audience: "Staff and devices integrating with GrapeSEED services",
    tone: "Precise and technical. Error text is read under pressure.",
    note: NOT_IMPORTED,
    lengthBudget: 1.5,
    measured: false,
  },
}

const app = (id: string, name: string, group: Exclude<ProjectGroup, "messages">): Project => ({
  id,
  name,
  group,
  profile: inferred[group],
})

export const projects: Project[] = [
  app("content-portal", "Content Portal", "content"),
  app("common-ui", "Common UI", "web"),
  app("parent-portal", "Parent Portal", "web"),
  app("student-app", "Student App", "mobile"),
  app("account-portal", "Account Portal", "web"),
  app("leaf-assets", "GrapeLEAF Common Assets", "content"),
  app("gs-content", "GrapeSEED Content", "content"),
  app("admin-service", "Admin Service", "services"),
  {
    id: "school-portal",
    name: "School Portal",
    group: "web",
    profile: {
      kind: "ui",
      audience: "School and campus administrators, regional coaches, staff",
      tone: "Administrative. Domain terms stay consistent - unit plan, visitation, campus, license.",
      note: "500 keys across 46 groups, imported from the sample bundle.",
      lengthBudget: 1.5,
      measured: true,
    },
  },
  app("report-portal", "Report Portal", "web"),
  app("student-site", "Student Site", "web"),
  app("training-portal", "Training Portal", "web"),
  app("docs-mockup", "Documentation UI", "content"),
  app("virtual-tsi", "Virtual TSI", "services"),
  app("portal-site", "Portal Site", "web"),
  app("global-web", "Global Website 2.0", "web"),
  app("gs-connect", "GS Connect", "mobile"),
  app("gs-baby-app", "GS Baby App", "mobile"),
  app("nexus-mobile", "Nexus Mobile App", "mobile"),
  app("grapeseed-mobile", "GrapeSEED Mobile App", "mobile"),
  app("littleseed-mobile", "LittleSEED Mobile App", "mobile"),
  app("nexus-receiver", "Window Nexus Receiver", "services"),
  app("app-common-ui", "App Common UI", "mobile"),
  {
    id: "email",
    name: "Email",
    group: "messages",
    profile: {
      kind: "email",
      audience: "Coaches, teachers, parents, students and administrators - one template per audience",
      tone: "Set by the template's category. An invite to a coach and an invite to a parent are different copy.",
      note: "Ten templates, six fields each. Keep every tag, every link and every {placeholder} the English has.",
      lengthBudget: 2,
      maxLength: 4000,
      measured: false,
    },
  },
  {
    id: "sms",
    name: "SMS",
    group: "messages",
    profile: {
      kind: "sms",
      audience: "The same people, on a phone",
      tone: "Terse. Every character costs - say it in one segment if you can.",
      note: "Five templates of one field. Nine of the twelve languages bill at 70 characters, not 160.",
      lengthBudget: 1.1,
      measured: false,
    },
  },
  {
    id: "notification",
    name: "Notification",
    group: "messages",
    profile: {
      kind: "notification",
      audience: "Existing users, on a lock screen",
      tone: "Factual and short. The reader is scanning, not reading.",
      note: "Six templates of a title and a body. The OS truncates the title around 65 characters.",
      lengthBudget: 1.4,
      measured: false,
    },
  },
]

/** `web/school-portal` - the mock's key namespace, and the route without its slash. */
export const targetOf = (project: Project) => `${project.group}/${project.id}`

export const projectPath = (project: Project) => `/${targetOf(project)}`

export function findProject(group: string, id: string): Project | null {
  return projects.find((project) => project.group === group && project.id === id) ?? null
}

export function findProjectByPath(pathname: string): Project | null {
  const [, group, id] = pathname.split("/")
  return group && id ? findProject(group, id) : null
}

export const DEFAULT_PROJECT_PATH = "/web/school-portal"
```

- [ ] **Step 4: Viết `lib/workspace-view.ts`**

```ts
import {
  groupOptionsOf,
  languages,
  statusLabel,
  type GroupOption,
  type LanguageCode,
  type TranslationRow,
  type TranslationStatus,
} from "@/lib/locale-data"
import { ALL_VERSIONS, releaseOf, versions } from "@/lib/release"

export type StatusFilter = TranslationStatus | "all" | "new"

export const statusFilters: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "missing", label: statusLabel.missing },
  { id: "outdated", label: statusLabel.outdated },
  { id: "needs_fix", label: statusLabel.needs_fix },
  { id: "translated", label: statusLabel.translated },
  { id: "new", label: "Added here" },
]

export const ALL_GROUPS = "__all__"

export const DEFAULT_LANGUAGE: LanguageCode = "vi"

export type WorkspaceFilters = {
  language: LanguageCode
  group: string
  status: StatusFilter
  version: string
  q: string
}

type ParamReader = { get(name: string): string | null }

/** Invalid values fall back rather than leave the list empty for no visible reason. */
export function parseFilters(params: ParamReader): WorkspaceFilters {
  const lang = params.get("lang")
  const status = params.get("status")
  const version = params.get("version")

  return {
    language: languages.some((item) => item.code === lang) ? (lang as LanguageCode) : DEFAULT_LANGUAGE,
    status: statusFilters.some((item) => item.id === status) ? (status as StatusFilter) : "all",
    version: version && versions.includes(version) ? version : ALL_VERSIONS,
    group: params.get("group") || ALL_GROUPS,
    q: params.get("q") ?? "",
  }
}

/** A group this project does not have means all groups - once the rows are in. */
export function resolveGroup(group: string, rows: TranslationRow[], isLoading: boolean): string {
  if (isLoading || group === ALL_GROUPS || rows.some((row) => row.group === group)) {
    return group
  }
  return ALL_GROUPS
}

export type StatusTotals = {
  total: number
  translated: number
  missing: number
  outdated: number
  needsFix: number
  percent: number
}

export type WorkspaceView = {
  visible: TranslationRow[]
  statusCounts: Record<StatusFilter, number>
  totals: StatusTotals
  groupOptions: GroupOption[]
  hasManual: boolean
}

function totalsOf(rows: TranslationRow[]): StatusTotals {
  const totals = { total: rows.length, translated: 0, missing: 0, outdated: 0, needsFix: 0, percent: 0 }
  for (const row of rows) {
    if (row.status === "needs_fix") {
      totals.needsFix += 1
    } else {
      totals[row.status] += 1
    }
  }
  totals.percent = rows.length ? Math.round((totals.translated / rows.length) * 100) : 0
  return totals
}

const matchesStatus = (row: TranslationRow, status: StatusFilter) =>
  status === "all" ? true : status === "new" ? row.origin === "manual" : row.status === status

/**
 * Everything the workspace counts and shows, from saved rows only. Totals and
 * group options cover the whole language; status pills count after group and
 * version; the visible list applies every filter.
 */
export function viewOf(rows: TranslationRow[], filters: Omit<WorkspaceFilters, "language">): WorkspaceView {
  const scoped = rows.filter(
    (row) =>
      (filters.group === ALL_GROUPS || row.group === filters.group) &&
      (filters.version === ALL_VERSIONS || releaseOf(row.key) === filters.version)
  )

  const statusCounts: Record<StatusFilter, number> = {
    all: scoped.length,
    missing: 0,
    outdated: 0,
    needs_fix: 0,
    translated: 0,
    new: 0,
  }
  for (const row of scoped) {
    statusCounts[row.status] += 1
    if (row.origin === "manual") {
      statusCounts.new += 1
    }
  }

  const needle = filters.q.trim().toLowerCase()
  const visible = scoped.filter(
    (row) =>
      matchesStatus(row, filters.status) &&
      (!needle ||
        row.key.toLowerCase().includes(needle) ||
        row.source.toLowerCase().includes(needle) ||
        row.target.toLowerCase().includes(needle))
  )

  return {
    visible,
    statusCounts,
    totals: totalsOf(rows),
    groupOptions: groupOptionsOf(rows),
    hasManual: rows.some((row) => row.origin === "manual"),
  }
}
```

- [ ] **Step 5: Viết `lib/drafts.ts`**

```ts
import type { DeleteScope } from "@/lib/api-types"

/** Unsaved work for one project in one language. */
export type Slot = {
  edits: Readonly<Record<string, string>>
  keeps: ReadonlySet<string>
}

/**
 * Every project's drafts at once. Keyed by `{target}:{language}` because key
 * names repeat across projects, and a draft that follows the user to another
 * project would be saved into it.
 */
export type DraftState = {
  slots: Readonly<Record<string, Slot>>
  selected: Readonly<Record<string, ReadonlySet<string>>>
}

const EMPTY_SLOT: Slot = { edits: {}, keeps: new Set() }
const EMPTY_SELECTION: ReadonlySet<string> = new Set()

export const emptyDrafts: DraftState = { slots: {}, selected: {} }

export const slotKeyOf = (target: string, language: string) => `${target}:${language}`

export const slotOf = (state: DraftState, slotKey: string): Slot => state.slots[slotKey] ?? EMPTY_SLOT

export const selectedOf = (state: DraftState, target: string): ReadonlySet<string> =>
  state.selected[target] ?? EMPTY_SELECTION

export const pendingCount = (slot: Slot) => Object.keys(slot.edits).length + slot.keeps.size

function without(record: Readonly<Record<string, string>>, keys: Iterable<string>) {
  const next = { ...record }
  for (const key of keys) {
    delete next[key]
  }
  return next
}

function setWithout(set: ReadonlySet<string>, keys: Iterable<string>) {
  const next = new Set(set)
  for (const key of keys) {
    next.delete(key)
  }
  return next
}

function withSlot(state: DraftState, slotKey: string, slot: Slot): DraftState {
  const slots = { ...state.slots }
  if (pendingCount(slot) === 0) {
    delete slots[slotKey]
  } else {
    slots[slotKey] = slot
  }
  return { ...state, slots }
}

/** `displayed` null means always record the value - how Confirm writes an unchanged one back. */
export function setEdit(
  state: DraftState,
  slotKey: string,
  key: string,
  value: string,
  displayed: string | null
): DraftState {
  const slot = slotOf(state, slotKey)
  const edits = value === displayed ? without(slot.edits, [key]) : { ...slot.edits, [key]: value }
  return withSlot(state, slotKey, { edits, keeps: setWithout(slot.keeps, [key]) })
}

export function setKeep(state: DraftState, slotKey: string, key: string): DraftState {
  const slot = slotOf(state, slotKey)
  return withSlot(state, slotKey, { edits: without(slot.edits, [key]), keeps: new Set(slot.keeps).add(key) })
}

export const discardSlot = (state: DraftState, slotKey: string) => withSlot(state, slotKey, EMPTY_SLOT)

/** Clears what `saved` sent, and nothing typed since. */
export function commitSlot(state: DraftState, slotKey: string, saved: Slot): DraftState {
  const slot = slotOf(state, slotKey)
  const edits = Object.fromEntries(
    Object.entries(slot.edits).filter(([key, value]) => saved.edits[key] !== value)
  )
  return withSlot(state, slotKey, { edits, keeps: setWithout(slot.keeps, saved.keeps) })
}

export function setSelected(state: DraftState, target: string, keys: readonly string[], on: boolean): DraftState {
  const next = new Set(selectedOf(state, target))
  for (const key of keys) {
    if (on) {
      next.add(key)
    } else {
      next.delete(key)
    }
  }
  return { ...state, selected: { ...state.selected, [target]: next } }
}

export const clearSelected = (state: DraftState, target: string) =>
  setSelected(state, target, [...selectedOf(state, target)], false)

export function pruneDeleted(
  state: DraftState,
  target: string,
  keys: readonly string[],
  scope: DeleteScope,
  language: string
): DraftState {
  let next = setSelected(state, target, keys, false)
  const prefix = `${target}:`
  for (const slotKey of Object.keys(state.slots)) {
    const reached = scope === "all" ? slotKey.startsWith(prefix) : slotKey === slotKeyOf(target, language)
    if (reached) {
      const slot = slotOf(next, slotKey)
      next = withSlot(next, slotKey, { edits: without(slot.edits, keys), keeps: setWithout(slot.keeps, keys) })
    }
  }
  return next
}
```

- [ ] **Step 6: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS toàn bộ.

- [ ] **Step 7: Commit**

```bash
git add lib/projects.ts lib/workspace-view.ts lib/drafts.ts tests
git commit -m "Add project registry, workspace count rules and per-slot draft store"
```

---

### Task 5: UI primitives, theming, app shell và routing

**Files:**
- Create (shadcn CLI): `components/ui/{dialog,checkbox,input,textarea,label,popover,command,tooltip,sonner}.tsx` (+ phụ thuộc CLI tự thêm, vd. `input-group.tsx`)
- Modify: `app/globals.css` (token `info`), `app/layout.tsx`, `app/page.tsx`
- Create: `app/(workspace)/layout.tsx`, `app/(workspace)/[group]/[project]/page.tsx`
- Create: `components/theme-toggle.tsx`, `components/popover-menu.tsx`, `components/draft-provider.tsx`, `components/workspace-shell.tsx`
- Create: `hooks/use-coverage.tsx`, `hooks/use-translation-rows.ts`, `hooks/use-workspace-params.ts`
- Rewrite: `components/app-sidebar.tsx`, `components/app-topbar.tsx`
- Modify (tạm, sẽ viết lại ở Task 7): `components/translation-workspace.tsx`

**Interfaces:**
- Consumes: `fetchCoverage`, `fetchEntries`, `resetData`, `messageOf` (Task 3); `projects`, `projectGroups`, `findProject`, `findProjectByPath`, `projectPath`, `targetOf`, `groupLabel`, `DEFAULT_PROJECT_PATH`, `Project` (Task 4); `parseFilters`, `WorkspaceFilters` (Task 4); `emptyDrafts`, `DraftState` (Task 4); `outstandingOf`, `targetLanguageCoverage` (Task 2).
- Produces:
  - `useCoverage(): { coverage: CoverageResponse | null; error: string | null; revision: number; refresh: () => void }` và `CoverageProvider`.
  - `useTranslationRows(target: string | null, language: LanguageCode, revision: number): { rows: TranslationRow[]; isLoading: boolean; error: string | null }`.
  - `useWorkspaceParams(): { filters: WorkspaceFilters; setParam(name, value | null): void; setParams(patch: Record<string, string | null>): void }`.
  - `useDrafts(): { drafts: DraftState; update: (fn: (state: DraftState) => DraftState) => void }` và `DraftProvider`.
  - `PopoverMenu({ label, widthClass?, trigger: (toggle) => ReactNode, children: (close) => ReactNode })`, `PopoverMenuItem({ icon, label, hint, onClick? })`.
  - `ThemeToggle()`.
  - Route `/{group}/{project}` render `TranslationWorkspace({ project: Project })`.

- [ ] **Step 1: Sinh UI primitives bằng shadcn**

```bash
npx shadcn@4.21.0 add dialog checkbox input textarea label popover command tooltip sonner --yes
git diff --quiet -- components/ui/button.tsx || git checkout -- components/ui/button.tsx
git status --short components/ui package.json
grep -n '"next-themes"\|"sonner"\|"cmdk"' package.json
```

Expected: các file mới trong `components/ui/`, `button.tsx` không đổi, và `package.json` có `next-themes`, `sonner`, `cmdk`. Nếu CLI không tự thêm dependency nào trong ba cái đó, chạy `npm install next-themes sonner cmdk`. Nếu file sinh ra có `import * as React from "react"` không dùng làm `tsc` báo lỗi, chỉ xóa đúng dòng đó.

- [ ] **Step 2: Thêm token `info`**

Trong `app/globals.css`:

- Trong khối `@theme inline`, ngay sau `--color-warning-foreground: var(--warning-foreground);` thêm:

```css
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
```

- Trong `:root`, ngay sau `--warning-foreground: oklch(0.27 0.05 70);` thêm:

```css
  --info: oklch(0.6 0.13 235);
  --info-foreground: oklch(0.99 0 0);
```

- Trong `.dark` **và** trong `:root:not(.light)` của khối `@media (prefers-color-scheme: dark)`, ngay sau `--warning-foreground: oklch(0.22 0.04 70);` thêm:

```css
    --info: oklch(0.72 0.12 235);
    --info-foreground: oklch(0.16 0.03 235);
```

- [ ] **Step 3: Provider ở root layout, `/` redirect**

Sửa `app/layout.tsx`: thêm import

```tsx
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
```

và thay phần `return (...)` của `RootLayout` bằng:

```tsx
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
```

Viết lại `app/page.tsx`:

```tsx
import { redirect } from "next/navigation"

import { DEFAULT_PROJECT_PATH } from "@/lib/projects"

export default function Page() {
  redirect(DEFAULT_PROJECT_PATH)
}
```

- [ ] **Step 4: Hooks và providers**

Tạo `hooks/use-coverage.tsx`:

```tsx
"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"

import { fetchCoverage, messageOf } from "@/lib/api"
import type { CoverageResponse } from "@/lib/api-types"

type CoverageState = {
  coverage: CoverageResponse | null
  error: string | null
  /** Bumped by `refresh`; data hooks refetch when it moves. */
  revision: number
  refresh: () => void
}

const CoverageContext = createContext<CoverageState | null>(null)

export function CoverageProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0)
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchCoverage()
      .then((response) => {
        if (!cancelled) {
          setCoverage(response)
          setError(null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(messageOf(cause))
        }
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  return (
    <CoverageContext.Provider value={{ coverage, error, revision, refresh }}>{children}</CoverageContext.Provider>
  )
}

export function useCoverage(): CoverageState {
  const state = useContext(CoverageContext)
  if (!state) {
    throw new Error("useCoverage must be used inside CoverageProvider")
  }
  return state
}
```

Tạo `hooks/use-translation-rows.ts`:

```ts
"use client"

import { useEffect, useState } from "react"

import { fetchEntries, messageOf } from "@/lib/api"
import type { LanguageCode, TranslationRow } from "@/lib/locale-data"

type Result = { token: string; rows: TranslationRow[] } | { token: string; error: string }

const EMPTY: TranslationRow[] = []

/**
 * One project's keys in one language. A null target skips the request. Old
 * rows stay on screen while a refresh is in flight; a response for a target or
 * language the screen has moved away from is ignored.
 */
export function useTranslationRows(target: string | null, language: LanguageCode, revision: number) {
  const token = target ? `${target}:${language}` : null
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    if (!target) {
      return
    }
    let cancelled = false
    const current = `${target}:${language}`

    fetchEntries(target, language)
      .then((response) => {
        if (!cancelled) {
          setResult({ token: current, rows: response.entries })
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
    rows: mine && "rows" in mine ? mine.rows : EMPTY,
    isLoading: token !== null && mine === null,
    error: mine && "error" in mine ? mine.error : null,
  }
}
```

Tạo `hooks/use-workspace-params.ts`:

```ts
"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { parseFilters } from "@/lib/workspace-view"

/** The workspace filters live in the query string, so a view can be shared. */
export function useWorkspaceParams() {
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const setParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [name, value] of Object.entries(patch)) {
      if (value === null) {
        next.delete(name)
      } else {
        next.set(name, value)
      }
    }
    const search = next.toString()
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
  }

  return {
    filters: parseFilters(params),
    setParam: (name: string, value: string | null) => setParams({ [name]: value }),
    setParams,
  }
}
```

Tạo `components/draft-provider.tsx`:

```tsx
"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

import { emptyDrafts, type DraftState } from "@/lib/drafts"

type DraftContextValue = {
  drafts: DraftState
  update: (fn: (state: DraftState) => DraftState) => void
}

const DraftContext = createContext<DraftContextValue | null>(null)

export function DraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<DraftState>(emptyDrafts)
  return <DraftContext.Provider value={{ drafts, update: setDrafts }}>{children}</DraftContext.Provider>
}

export function useDrafts(): DraftContextValue {
  const value = useContext(DraftContext)
  if (!value) {
    throw new Error("useDrafts must be used inside DraftProvider")
  }
  return value
}
```

- [ ] **Step 5: Popover menu dùng chung và theme toggle**

Tạo `components/popover-menu.tsx` (tách từ pattern menu tự dựng đang lặp ở topbar và Publish menu):

```tsx
"use client"

import { useState, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function PopoverMenu({
  label,
  widthClass = "w-52",
  trigger,
  children,
}: {
  label: string
  widthClass?: string
  trigger: (toggle: () => void) => ReactNode
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="relative">
      {trigger(() => setOpen((value) => !value))}
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-label={`Close ${label}`} onClick={close} />
          <div
            className={cn(
              "absolute right-0 z-20 mt-2 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg shadow-black/5",
              widthClass
            )}
          >
            {children(close)}
          </div>
        </>
      )}
    </div>
  )
}

export function PopoverMenuItem({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: LucideIcon
  label: string
  hint: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/50"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  )
}
```

Tạo `components/theme-toggle.tsx`:

```tsx
"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex size-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
    >
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </button>
  )
}
```

- [ ] **Step 6: Viết lại sidebar**

Thay toàn bộ `components/app-sidebar.tsx`:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ChevronsUpDown, Languages, Plus, Search } from "lucide-react"

import { useCoverage } from "@/hooks/use-coverage"
import { useWorkspaceParams } from "@/hooks/use-workspace-params"
import { outstandingOf, targetLanguageCoverage } from "@/lib/coverage"
import { findProjectByPath, projectGroups, projectPath, projects, targetOf, type Project } from "@/lib/projects"
import { cn } from "@/lib/utils"

export function AppSidebar() {
  const [query, setQuery] = useState("")
  const active = findProjectByPath(usePathname())
  const lang = useSearchParams().get("lang")
  const { filters } = useWorkspaceParams()
  const { coverage } = useCoverage()

  const filtered = projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))

  const pendingOf = (project: Project) => {
    const entry = targetLanguageCoverage(coverage, targetOf(project), filters.language)
    return entry ? outstandingOf(entry) : 0
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Languages className="size-4.5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight">Lingua</p>
          <p className="text-[11px] text-muted-foreground">Localization Cloud</p>
        </div>
      </div>

      {/* Workspace switcher */}
      <div className="px-3 pt-3">
        <button className="flex w-full items-center gap-2.5 rounded-lg border border-sidebar-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent/40">
          <div className="flex size-7 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">
            GS
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">GrapeSEED Inc.</p>
            <p className="truncate text-[11px] text-muted-foreground">Enterprise plan</p>
          </div>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter applications"
            className="h-8 w-full rounded-lg border border-input bg-card pl-8 pr-2.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </div>
      </div>

      {/* Project list */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {projectGroups.map((group) => {
          const items = filtered.filter((p) => p.group === group.id)
          if (items.length === 0) return null
          return (
            <div key={group.id} className="mb-3">
              <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {items.map((p) => (
                  <SidebarItem
                    key={p.id}
                    project={p}
                    href={lang ? `${projectPath(p)}?lang=${encodeURIComponent(lang)}` : projectPath(p)}
                    active={p === active}
                    pending={pendingOf(p)}
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3">
        <button className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-sidebar-border px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
          <Plus className="size-3.5" />
          New application
        </button>
      </div>
    </aside>
  )
}

function SidebarItem({
  project,
  href,
  active,
  pending,
}: {
  project: Project
  href: string
  active: boolean
  pending: number
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors",
          active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-foreground hover:bg-accent/40"
        )}
      >
        <span className={cn("size-1.5 shrink-0 rounded-full", active ? "bg-primary" : "bg-muted-foreground/30")} />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        {pending > 0 && (
          <span
            className={cn(
              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            {pending.toLocaleString()}
          </span>
        )}
      </Link>
    </li>
  )
}
```

- [ ] **Step 7: Viết lại topbar**

Thay toàn bộ `components/app-topbar.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Bell, Check, ChevronDown, RotateCcw, Search } from "lucide-react"
import { toast } from "sonner"

import { useDrafts } from "@/components/draft-provider"
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { useCoverage } from "@/hooks/use-coverage"
import { useWorkspaceParams } from "@/hooks/use-workspace-params"
import { messageOf, resetData } from "@/lib/api"
import { targetLanguageCoverage } from "@/lib/coverage"
import { emptyDrafts } from "@/lib/drafts"
import { languages, type LanguageCode } from "@/lib/locale-data"
import { findProjectByPath, targetOf } from "@/lib/projects"

const flags: Record<LanguageCode, string> = {
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

export function AppTopbar() {
  const { filters, setParam } = useWorkspaceParams()
  const project = findProjectByPath(usePathname())
  const { coverage, refresh } = useCoverage()
  const { update } = useDrafts()
  const searchRef = useRef<HTMLInputElement>(null)

  // Typed text is local while the field has focus, so a slow URL update never
  // eats a keystroke; an outside change to `q` (the add-key dialog) shows up
  // once the field is not being typed in.
  const [search, setSearch] = useState(filters.q)
  const [isSearchFocused, setSearchFocused] = useState(false)
  if (!isSearchFocused && search !== filters.q) {
    setSearch(filters.q)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const current = languages.find((item) => item.code === filters.language) ?? languages[0]
  const countsOf = (code: LanguageCode) =>
    project ? targetLanguageCoverage(coverage, targetOf(project), code) : null
  const currentCounts = countsOf(current.code)

  const handleReset = async () => {
    try {
      await resetData()
      update(() => emptyDrafts)
      refresh()
      toast.success("Demo data reset", { description: "Every project is back to the sample data." })
    } catch (cause: unknown) {
      toast.error("Could not reset", { description: messageOf(cause) })
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-card/60 px-6 backdrop-blur">
      {/* Global search */}
      <div className="relative max-w-xl flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchRef}
          value={search}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          onChange={(event) => {
            setSearch(event.target.value)
            setParam("q", event.target.value || null)
          }}
          placeholder="Search keys, source text, or translations…"
          className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-16 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:flex">
          ⌘K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Language selector */}
        <PopoverMenu
          label="language menu"
          widthClass="w-64"
          trigger={(toggle) => (
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <span className="text-base leading-none">{flags[current.code]}</span>
              <span>{current.name}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {currentCounts ? `${currentCounts.translated}/${currentCounts.total}` : "—"}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          )}
        >
          {(close) => (
            <div className="max-h-96 overflow-y-auto">
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Target language
              </p>
              {languages.map((lang) => {
                const counts = countsOf(lang.code)
                const pct = counts && counts.total ? Math.round((counts.translated / counts.total) * 100) : null
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setParam("lang", lang.code)
                      close()
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/50"
                  >
                    <span className="text-base leading-none">{flags[lang.code]}</span>
                    <span className="flex-1">{lang.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">{pct === null ? "—" : `${pct}%`}</span>
                    {lang.code === current.code && <Check className="size-4 text-primary" />}
                  </button>
                )
              })}
            </div>
          )}
        </PopoverMenu>

        <ThemeToggle />

        <button className="relative flex size-9 items-center justify-center rounded-lg border border-input bg-background text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
        </button>

        {/* User */}
        <PopoverMenu
          label="user menu"
          widthClass="w-60"
          trigger={(toggle) => (
            <button
              type="button"
              onClick={toggle}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-accent/40"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                LL
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-medium">Logan Le</span>
                <span className="block text-[11px] text-muted-foreground">Maintainer</span>
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          )}
        >
          {(close) => (
            <PopoverMenuItem
              icon={RotateCcw}
              label="Reset demo data"
              hint="Re-seed every project from the sample data"
              onClick={() => {
                close()
                void handleReset()
              }}
            />
          )}
        </PopoverMenu>
      </div>
    </header>
  )
}
```

- [ ] **Step 8: Shell, route group và page**

Tạo `components/workspace-shell.tsx`:

```tsx
"use client"

import { Suspense, type ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { DraftProvider } from "@/components/draft-provider"
import { CoverageProvider } from "@/hooks/use-coverage"

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <CoverageProvider>
      <DraftProvider>
        <div className="flex h-screen overflow-hidden bg-background text-foreground">
          <Suspense fallback={<aside className="w-72 shrink-0 border-r border-sidebar-border bg-sidebar" />}>
            <AppSidebar />
          </Suspense>
          <div className="flex min-w-0 flex-1 flex-col">
            <Suspense fallback={<header className="h-16 shrink-0 border-b border-border bg-card/60" />}>
              <AppTopbar />
            </Suspense>
            <main className="relative min-h-0 flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>
      </DraftProvider>
    </CoverageProvider>
  )
}
```

Tạo `app/(workspace)/layout.tsx`:

```tsx
import type { ReactNode } from "react"

import { WorkspaceShell } from "@/components/workspace-shell"

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>
}
```

Tạo `app/(workspace)/[group]/[project]/page.tsx`:

```tsx
import { Suspense } from "react"
import { redirect } from "next/navigation"

import { TranslationWorkspace } from "@/components/translation-workspace"
import { DEFAULT_PROJECT_PATH, findProject } from "@/lib/projects"

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ group: string; project: string }>
}) {
  const { group, project: id } = await params
  const project = findProject(group, id)
  if (!project) {
    redirect(DEFAULT_PROJECT_PATH)
  }

  return (
    <Suspense>
      <TranslationWorkspace project={project} />
    </Suspense>
  )
}
```

- [ ] **Step 9: Tạm gỡ shell cũ khỏi `translation-workspace.tsx`**

Workspace cũ tự render sidebar/topbar; giờ shell đã làm việc đó. Chỉ sửa đủ để nó chạy trong shell mới (Task 7 sẽ viết lại toàn bộ):

1. Trong khối import từ `@/lib/data`, bỏ dòng `  projects,`. Xóa hai dòng `import { AppSidebar } from "@/components/app-sidebar"` và `import { AppTopbar } from "@/components/app-topbar"`. Thêm `import { groupLabel, type Project } from "@/lib/projects"`.
2. Thay:

```tsx
export function TranslationWorkspace() {
  const [activeProject, setActiveProject] = useState(projects[0].id)
  const [version, setVersion] = useState("All")
  const [section, setSection] = useState("home")
  const [language, setLanguage] = useState<Language>(languages[0])

  const project = projects.find((p) => p.id === activeProject)!
```

bằng:

```tsx
export function TranslationWorkspace({ project }: { project: Project }) {
  const [version, setVersion] = useState("All")
  const [section, setSection] = useState("home")
  const language: Language = languages[0]
```

3. Thay:

```tsx
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <AppSidebar activeId={activeProject} onSelect={setActiveProject} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppTopbar language={language} onLanguageChange={setLanguage} />

        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-6 py-6">
```

bằng:

```tsx
  return (
          <div className="mx-auto max-w-[1400px] px-6 py-6">
```

4. Thay:

```tsx
          </div>
        </main>
      </div>
    </div>
  )
}

function StatCard({
```

bằng:

```tsx
          </div>
  )
}

function StatCard({
```

5. Thay `<span>{project.group}</span>` bằng `<span>{groupLabel[project.group]}</span>`.

- [ ] **Step 10: Chạy gate và kiểm tra bằng trình duyệt**

Run: `npm run typecheck && npm test`
Expected: sạch / PASS.

Run: `npm run dev` rồi mở `http://localhost:3000/`.
Expected:
- `/` chuyển sang `/web/school-portal`; sidebar tô sáng School Portal; badge School Portal hiện số outstanding thật (vi: `7`).
- Bấm project khác → URL đổi, sidebar tô sáng đúng; nhóm Messages có Email/SMS/Notification.
- `/web/nope` chuyển về `/web/school-portal`.
- Language picker liệt kê 13 ngôn ngữ; chọn `Japanese` → URL có `?lang=ja`, pill hiện `496/500`, badge School Portal thành `4`.
- Nút theme đổi sáng/tối; user menu → "Reset demo data" hiện toast.
- Nội dung chính vẫn là bảng mock cũ (sẽ thay ở Task 7).

- [ ] **Step 11: Commit**

```bash
git add app components hooks package.json package-lock.json
git commit -m "Move the shell onto App Router routes with coverage, drafts and theming"
```

---

### Task 6: Dialog Add key / Delete keys / Export

**Files:**
- Create: `components/translations/add-key-dialog.tsx`, `components/translations/delete-keys-dialog.tsx`, `components/translations/export-dialog.tsx`

**Interfaces:**
- Consumes: `createKey`, `deleteKeys`, `exportBundle`, `download`, `messageOf` (Task 3); `DeleteScope`, `ExportFile` (Task 2); `groupKeyOf`, `isValidKey`, `languages`, `SOURCE_LANGUAGE`, `LanguageCode` (Task 1); `placeholdersOf` (Task 1); `applyNamePattern`, `FILE_NAME_TOKEN`, `safeEntryName`, `safeFileName` (Task 1); `Project`, `projectPath`, `targetOf` (Task 4); shadcn `Dialog*`, `Input`, `Textarea`, `Label`, `Checkbox`, `Button`.
- Produces:
  - `AddKeyDialog({ open, onOpenChange, project, onCreated(key: string) })`
  - `DeleteKeysDialog({ project, language, keys, onClose(), onDeleted(keys: string[], scope: DeleteScope) })` — mở khi `keys.length > 0`.
  - `ExportDialog({ open, onOpenChange, project, language })`

- [ ] **Step 1: Viết `components/translations/add-key-dialog.tsx`**

```tsx
"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { ArrowUpRight, Braces, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createKey, messageOf } from "@/lib/api"
import { groupKeyOf, isValidKey, languages, SOURCE_LANGUAGE } from "@/lib/locale-data"
import { projectPath, targetOf, type Project } from "@/lib/projects"
import { placeholdersOf } from "@/lib/validation"

type Created = { key: string; source: string; count: number }

/**
 * A key belongs to one project and reaches every language of it at once:
 * English gets the text, the other twelve an empty value.
 */
export function AddKeyDialog({
  open,
  onOpenChange,
  project,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onCreated: (key: string) => void
}) {
  const [key, setKey] = useState("")
  const [text, setText] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)

  const trimmedKey = key.trim()
  const group = trimmedKey ? groupKeyOf(trimmedKey) : ""
  const placeholders = placeholdersOf(text)
  const formatError =
    trimmedKey && !isValidKey(trimmedKey) ? "Use dot-separated segments - group.section.name." : null
  const keyError = serverError ?? formatError ?? (submitted && !trimmedKey ? "Key is required." : null)
  const textError = submitted && !text.trim() ? "English text is required." : null

  const reset = () => {
    setKey("")
    setText("")
    setSubmitted(false)
    setServerError(null)
    setCreated(null)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      reset()
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)
    setServerError(null)
    const source = text.trim()
    if (!trimmedKey || !source || formatError) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await createKey({ key: trimmedKey, source, target: targetOf(project) })
      setCreated({ key: response.key.key, source, count: response.languages.length })
      onCreated(response.key.key)
    } catch (cause: unknown) {
      setServerError(messageOf(cause))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Key added to {project.name}</DialogTitle>
              <DialogDescription>
                <code className="font-mono text-xs text-foreground">{created.key}</code> was written to{" "}
                {created.count} language files, and is missing in {created.count - 1} of them until someone
                translates it.
              </DialogDescription>
            </DialogHeader>

            <ul className="max-h-72 divide-y divide-border overflow-auto rounded-xl border border-border">
              {languages.map((language) => (
                <li key={language.code} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="w-32 shrink-0 truncate">{language.name}</span>
                  {language.code === SOURCE_LANGUAGE ? (
                    <>
                      <span className="min-w-0 flex-1 truncate">{created.source}</span>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                        Source
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate italic text-muted-foreground">No translation</span>
                      <Link
                        href={`${projectPath(project)}?lang=${language.code}&q=${encodeURIComponent(created.key)}`}
                        onClick={() => handleOpenChange(false)}
                        className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent/50"
                      >
                        Translate
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <DialogFooter showCloseButton>
              <Button variant="outline" onClick={reset}>
                <Plus data-icon="inline-start" />
                Add another
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="contents">
            <DialogHeader>
              <DialogTitle>Add a key to {project.name}</DialogTitle>
              <DialogDescription>
                The key is created in this project only, in every language at once.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-key">Key</Label>
              <Input
                id="add-key"
                value={key}
                onChange={(event) => {
                  setKey(event.target.value)
                  setServerError(null)
                }}
                placeholder="campus.form.actions.archive"
                className="font-mono"
                aria-invalid={Boolean(keyError)}
                autoFocus
              />
              {keyError ? (
                <p className="text-xs text-destructive">{keyError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {group ? (
                    <>
                      Group <code className="font-mono">{group}</code>
                    </>
                  ) : (
                    "The first dot-segment becomes the group this list filters by."
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-key-text">English text</Label>
              <Textarea
                id="add-key-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Archive campus"
                className="min-h-20 resize-y"
                aria-invalid={Boolean(textError)}
              />
              {textError ? (
                <p className="text-xs text-destructive">{textError}</p>
              ) : placeholders.length > 0 ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Braces className="size-3.5" />
                  Placeholders {placeholders.join(" ")} - every translation must keep them.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Use {"{name}"} for values filled in at runtime.</p>
              )}
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding…" : "Add key"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Viết `components/translations/delete-keys-dialog.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { deleteKeys, messageOf } from "@/lib/api"
import type { DeleteScope } from "@/lib/api-types"
import { languages, SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"

const PREVIEW = 6

/**
 * The one confirmation for every delete in the workspace. It asks how far the
 * delete goes: clearing this language (the key stays, reads as missing here)
 * or retiring the key from every language of the project.
 */
export function DeleteKeysDialog({
  project,
  language,
  keys,
  onClose,
  onDeleted,
}: {
  project: Project
  language: LanguageCode
  keys: string[]
  onClose: () => void
  onDeleted: (keys: string[], scope: DeleteScope) => void
}) {
  const [everywhere, setEverywhere] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const count = keys.length
  const noun = count === 1 ? "key" : "keys"
  const languageName = languages.find((item) => item.code === language)?.name ?? language

  const close = () => {
    setEverywhere(false)
    onClose()
  }

  const handleDelete = async () => {
    const scope: DeleteScope = everywhere ? "all" : "language"
    setIsDeleting(true)
    try {
      const result = await deleteKeys({ target: targetOf(project), keys, scope, language })
      onDeleted(keys, scope)
      close()
      toast.success(`Deleted ${result.deleted} ${result.deleted === 1 ? "key" : "keys"}`, {
        description:
          scope === "all"
            ? `Removed from ${project.name} and its ${result.files.length} language files.`
            : `Cleared in ${languageName}. Every other language kept its translation.`,
      })
    } catch (cause: unknown) {
      toast.error("Could not delete", { description: messageOf(cause) })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog
      open={count > 0}
      onOpenChange={(next) => {
        if (!next && !isDeleting) {
          close()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Delete {count.toLocaleString()} {noun}
          </DialogTitle>
          <DialogDescription>From {project.name}. No other project is touched.</DialogDescription>
        </DialogHeader>

        <ul className="max-h-40 overflow-auto rounded-xl border border-border bg-muted/40 p-2.5">
          {keys.slice(0, PREVIEW).map((key) => (
            <li key={key} className="truncate font-mono text-xs">
              {key}
            </li>
          ))}
          {count > PREVIEW && (
            <li className="pt-1 text-xs text-muted-foreground">and {(count - PREVIEW).toLocaleString()} more</li>
          )}
        </ul>

        <Label className="flex items-start gap-2 font-normal">
          <Checkbox
            className="mt-0.5"
            checked={everywhere}
            onCheckedChange={(checked) => setEverywhere(checked === true)}
          />
          <span className="text-sm">
            Delete in the other {languages.length - 1} languages too
            <span className="text-muted-foreground">
              {" "}
              -{" "}
              {everywhere
                ? `the ${noun} and every translation leave ${project.name} for good.`
                : `leave this off and only ${languageName} is cleared: the ${noun} stay registered and read as missing here.`}
            </span>
          </span>
        </Label>

        {!everywhere && language === SOURCE_LANGUAGE && (
          <p className="text-xs text-destructive">
            {languageName} is the source language. Clearing it leaves the {noun} with no English to translate from.
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
            <Trash2 data-icon="inline-start" />
            {isDeleting ? "Deleting…" : everywhere ? "Delete everywhere" : `Delete in ${languageName}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Viết `components/translations/export-dialog.tsx`**

```tsx
"use client"

import { useMemo, useState, type FormEvent } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { download, exportBundle, messageOf } from "@/lib/api"
import type { ExportFile } from "@/lib/api-types"
import { applyNamePattern, FILE_NAME_TOKEN, safeEntryName, safeFileName } from "@/lib/file-name"
import { languages, SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"

const DEFAULT_PATTERN = `${FILE_NAME_TOKEN}.json`

/**
 * One project as a zip of locale files, each named by whoever exports it. The
 * export is always the whole project, never the current filters.
 */
export function ExportDialog({
  open,
  onOpenChange,
  project,
  language,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  language: LanguageCode
}) {
  const defaultArchive = `${project.id}-translations`
  const defaults = () => new Set<LanguageCode>([SOURCE_LANGUAGE, language])

  const [selected, setSelected] = useState<Set<LanguageCode>>(defaults)
  const [pattern, setPattern] = useState(DEFAULT_PATTERN)
  const [renamed, setRenamed] = useState<Partial<Record<LanguageCode, string>>>({})
  const [archive, setArchive] = useState(defaultArchive)
  const [includeUntranslated, setIncludeUntranslated] = useState(true)
  const [isExporting, setIsExporting] = useState(false)

  const nameOf = (code: LanguageCode) => renamed[code] ?? applyNamePattern(pattern, code)

  const files: ExportFile[] = useMemo(
    () =>
      languages
        .filter((item) => selected.has(item.code))
        .map((item) => ({
          language: item.code,
          name: safeEntryName(renamed[item.code] ?? applyNamePattern(pattern, item.code), `${item.code}.json`),
        })),
    [selected, renamed, pattern]
  )

  const duplicate = useMemo(() => {
    const seen = new Set<string>()
    for (const file of files) {
      const name = file.name.toLowerCase()
      if (seen.has(name)) {
        return file.name
      }
      seen.add(name)
    }
    return null
  }, [files])

  const archiveName = safeFileName(archive, defaultArchive)

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setSelected(defaults())
      setPattern(DEFAULT_PATTERN)
      setRenamed({})
      setArchive(defaultArchive)
      setIncludeUntranslated(true)
    }
  }

  const toggle = (code: LanguageCode, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(code)
      } else {
        next.delete(code)
      }
      return next
    })

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (files.length === 0 || duplicate) {
      return
    }
    setIsExporting(true)
    try {
      const { blob, filename } = await exportBundle({
        target: targetOf(project),
        files,
        name: archiveName,
        includeUntranslated,
      })
      download(blob, filename)
      handleOpenChange(false)
      toast.success(`Exported ${filename}`, {
        description: `${files.length} ${files.length === 1 ? "file" : "files"} from ${project.name}.`,
      })
    } catch (cause: unknown) {
      toast.error("Could not export", { description: messageOf(cause) })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="contents">
          <DialogHeader>
            <DialogTitle>Export {project.name}</DialogTitle>
            <DialogDescription>Every key in the project, whatever the filters show.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-pattern">File names</Label>
            <Input
              id="export-pattern"
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              placeholder={DEFAULT_PATTERN}
              className="font-mono"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Label>Languages</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {selected.size} of {languages.length}
              </span>
              <div className="ml-auto flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set(languages.map((item) => item.code)))}
                >
                  All
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  None
                </Button>
              </div>
            </div>

            <ul className="max-h-64 divide-y divide-border overflow-auto rounded-xl border border-border">
              {languages.map((item) => {
                const isOn = selected.has(item.code)
                return (
                  <li key={item.code} className="flex items-center gap-3 px-3 py-1.5">
                    <Label className="flex w-44 shrink-0 items-center gap-2 font-normal">
                      <Checkbox checked={isOn} onCheckedChange={(checked) => toggle(item.code, checked === true)} />
                      <span className="truncate text-sm">{item.name}</span>
                    </Label>
                    <Input
                      value={nameOf(item.code)}
                      onChange={(event) => setRenamed((current) => ({ ...current, [item.code]: event.target.value }))}
                      disabled={!isOn}
                      aria-label={`File name for ${item.name}`}
                      className="h-7 font-mono text-xs"
                    />
                  </li>
                )
              })}
            </ul>

            {duplicate && (
              <p className="text-xs text-destructive">
                Two languages are both called <code className="font-mono">{duplicate}</code>. One would overwrite the
                other in the archive.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-archive">Archive name</Label>
            <div className="flex items-center gap-2">
              <Input
                id="export-archive"
                value={archive}
                onChange={(event) => setArchive(event.target.value)}
                placeholder={defaultArchive}
                className="font-mono"
              />
              <span className="font-mono text-sm text-muted-foreground">.zip</span>
            </div>
            {archiveName !== archive.replace(/\.zip$/i, "") && (
              <p className="text-xs text-muted-foreground">
                Saved as <code className="font-mono">{archiveName}.zip</code>
              </p>
            )}
          </div>

          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={includeUntranslated}
              onCheckedChange={(checked) => setIncludeUntranslated(checked === true)}
            />
            <span className="text-sm">Include untranslated keys</span>
          </Label>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button type="submit" disabled={isExporting || files.length === 0 || Boolean(duplicate)}>
              <Download data-icon="inline-start" />
              {isExporting ? "Exporting…" : "Export"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Chạy gate**

Run: `npm run typecheck && npm test`
Expected: sạch / PASS. Nếu `tsc` báo `DialogFooter` không có `showCloseButton` hoặc `Checkbox` không có `indeterminate`, mở file shadcn tương ứng trong `components/ui/` để đọc đúng prop — **không** sửa file đó.

- [ ] **Step 5: Commit**

```bash
git add components/translations
git commit -m "Add the add-key, delete-keys and export dialogs"
```

---

### Task 7: Translation workspace

**Files:**
- Modify: `components/status-badge.tsx`
- Create: `components/translation-row.tsx`, `components/translation-list.tsx`, `components/translations/group-filter.tsx`, `components/translations/project-profile-card.tsx`
- Rewrite: `components/translation-workspace.tsx`
- Delete: `components/translation-table.tsx`

**Interfaces:**
- Consumes: tất cả của Task 1–6.
- Produces:
  - `StatusBadge({ status: TranslationStatus })`, `StatusDot({ status })`.
  - `ROW_GRID` (class chung của header và row), `TranslationRow(props)`.
  - `TranslationList({ rows, languageName, allSelected, someSelected, onSelectAll, renderRow })`.
  - `GroupFilter({ value, options, totalKeys, onChange })`.
  - `ProjectProfileCard({ project, title, message, action? })`.
  - `TranslationWorkspace({ project })`.

- [ ] **Step 1: Cài virtualizer**

```bash
npm install @tanstack/react-virtual@^3.14.13
```

- [ ] **Step 2: Mở rộng `components/status-badge.tsx` lên 4 trạng thái**

Thay toàn bộ file:

```tsx
import { AlertTriangle, CheckCircle2, CircleDashed, History } from "lucide-react"

import { statusLabel, type TranslationStatus } from "@/lib/locale-data"
import { cn } from "@/lib/utils"

const config: Record<TranslationStatus, { icon: typeof CheckCircle2; className: string; dot: string }> = {
  translated: {
    icon: CheckCircle2,
    className: "bg-success/12 text-success border-success/20",
    dot: "bg-success",
  },
  missing: {
    icon: CircleDashed,
    className: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  outdated: {
    icon: History,
    className: "bg-info/12 text-info border-info/25",
    dot: "bg-info",
  },
  needs_fix: {
    icon: AlertTriangle,
    className: "bg-warning/15 text-warning-foreground border-warning/30",
    dot: "bg-warning",
  },
}

export function StatusBadge({ status }: { status: TranslationStatus }) {
  const c = config[status]
  const Icon = c.icon
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        c.className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {statusLabel[status]}
    </span>
  )
}

export function StatusDot({ status }: { status: TranslationStatus }) {
  return <span className={cn("size-2 rounded-full", config[status].dot)} aria-hidden="true" />
}
```

- [ ] **Step 3: Viết `components/translation-row.tsx`**

```tsx
"use client"

import { AlertTriangle, ClipboardPaste, Copy, History, Info, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { StatusBadge } from "@/components/status-badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { copyText } from "@/lib/clipboard"
import { formatDateTime } from "@/lib/format-date"
import { SOURCE_LANGUAGE, type LanguageCode, type TranslationRow as Row } from "@/lib/locale-data"
import type { ProjectProfile } from "@/lib/projects"
import { cn } from "@/lib/utils"
import { checkTranslation } from "@/lib/validation"

/** Above this, the English is a sentence and gets a growing textarea. */
const SHORT_SOURCE = 60

/** Shared by the list header and every row so the columns line up. */
export const ROW_GRID =
  "grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1.4fr)_8.5rem_7.5rem] gap-4"

const iconButton =
  "flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"

const textButton =
  "rounded-md px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-accent/50"

export type TranslationRowProps = {
  row: Row
  value: string
  isDirty: boolean
  isKeepPending: boolean
  isSelected: boolean
  language: LanguageCode
  profile: ProjectProfile
  rtl: boolean
  onChange: (key: string, value: string) => void
  onKeep: (key: string) => void
  onConfirm: (key: string) => void
  onSelect: (key: string, selected: boolean) => void
  onDelete: (key: string) => void
}

export function TranslationRow({
  row,
  value,
  isDirty,
  isKeepPending,
  isSelected,
  language,
  profile,
  rtl,
  onChange,
  onKeep,
  onConfirm,
  onSelect,
  onDelete,
}: TranslationRowProps) {
  const issues = checkTranslation(row.source, value, {
    language,
    lengthBudget: profile.lengthBudget,
    maxLength: profile.maxLength,
  })
  const hasError = issues.some((issue) => issue.level === "error")
  const hasWarning = !hasError && issues.length > 0
  const isKept = isKeepPending || (row.keptSource && value === row.source)
  // A kept value that went outdated is kept again rather than confirmed:
  // confirming would save the old English as if it were a translation.
  const isStaleKeep = row.status === "outdated" && row.keptSource
  const canKeep =
    (row.status === "missing" || isStaleKeep) &&
    !isKeepPending &&
    row.source !== "" &&
    language !== SOURCE_LANGUAGE
  const showOutdated = row.status === "outdated" && !isDirty

  const handleCopy = async () => {
    if (await copyText(row.source)) {
      toast.success("English copied to the clipboard")
    } else {
      toast.error("Could not copy", { description: "The browser blocked clipboard access for this page." })
    }
  }

  const field = {
    value,
    dir: rtl ? ("rtl" as const) : undefined,
    placeholder: row.source || "Add translation…",
    "aria-label": `Translation for ${row.key}`,
    onChange: (event: { target: { value: string } }) => onChange(row.key, event.target.value),
  }

  return (
    <div
      className={cn(
        ROW_GRID,
        "group items-start border-b border-l-2 border-border border-l-transparent px-4 py-2.5 transition-colors",
        !isDirty && !isSelected && "hover:bg-accent/30",
        isSelected && "bg-destructive/5",
        hasWarning && "border-l-warning",
        isDirty && "border-l-primary bg-accent/30",
        hasError && "border-l-destructive"
      )}
    >
      <div className="flex h-8 items-center justify-center">
        <Checkbox
          checked={isSelected}
          aria-label={`Select ${row.key}`}
          onCheckedChange={(checked) => onSelect(row.key, checked === true)}
        />
      </div>

      <div className="min-w-0 pt-1">
        <div className="flex items-center gap-1.5">
          <code className="block truncate font-mono text-[13px] text-foreground">{row.key}</code>
          {row.origin === "manual" && (
            <span className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">
              New
            </span>
          )}
        </div>
        <span className="block text-xs text-muted-foreground">
          {row.source || <em>No English yet</em>}
        </span>
      </div>

      <div className="min-w-0 space-y-1.5">
        {row.source.length <= SHORT_SOURCE ? (
          <Input {...field} className="h-8" />
        ) : (
          <Textarea {...field} className="min-h-16 resize-y" />
        )}

        {(canKeep || showOutdated) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {showOutdated && (
              <span className="flex items-center gap-1.5 text-info">
                <History className="size-3.5 shrink-0" />
                English changed since this was translated.
              </span>
            )}
            {showOutdated && !isStaleKeep && (
              <button type="button" className={textButton} onClick={() => onConfirm(row.key)}>
                Still correct
              </button>
            )}
            {canKeep && (
              <button type="button" className={textButton} onClick={() => onKeep(row.key)}>
                Keep English
              </button>
            )}
          </div>
        )}

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

      <div className="flex flex-col items-start gap-1 pt-1">
        <StatusBadge status={row.status} />
        {isKept && <span className="text-[11px] text-muted-foreground">Kept as English</span>}
      </div>

      <div className="flex items-center justify-end gap-0.5 pt-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <button type="button" className={iconButton} aria-label={`Copy the English for ${row.key}`} onClick={handleCopy}>
          <Copy className="size-3.5" />
        </button>
        <button
          type="button"
          className={iconButton}
          aria-label={`Paste the English into ${row.key}`}
          onClick={() => onChange(row.key, row.source)}
        >
          <ClipboardPaste className="size-3.5" />
        </button>
        <Tooltip>
          <TooltipTrigger render={<button type="button" className={iconButton} aria-label="View history" />}>
            <History className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent className="grid gap-0.5 tabular-nums">
            <span>
              Created by {row.created.by} · {formatDateTime(row.created.at)}
            </span>
            <span>
              {row.updated
                ? `Updated by ${row.updated.by} · ${formatDateTime(row.updated.at)}`
                : "Not translated yet"}
            </span>
          </TooltipContent>
        </Tooltip>
        <button
          type="button"
          className={cn(iconButton, "hover:bg-destructive/10 hover:text-destructive")}
          aria-label={`Delete ${row.key}`}
          onClick={() => onDelete(row.key)}
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Viết `components/translation-list.tsx`**

```tsx
"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

import { ROW_GRID } from "@/components/translation-row"
import { Checkbox } from "@/components/ui/checkbox"
import type { TranslationRow } from "@/lib/locale-data"
import { cn } from "@/lib/utils"

/**
 * The key list, virtualized against the page's own scroller (`<main>`), so the
 * page still scrolls as one piece the way the rest of the workspace does.
 */
export function TranslationList({
  rows,
  languageName,
  allSelected,
  someSelected,
  onSelectAll,
  renderRow,
}: {
  rows: TranslationRow[]
  languageName: string
  allSelected: boolean
  someSelected: boolean
  onSelectAll: (selected: boolean) => void
  renderRow: (row: TranslationRow) => ReactNode
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    setScrollElement(listRef.current?.closest("main") ?? null)
  }, [])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 72,
    overscan: 8,
    scrollMargin: listRef.current?.offsetTop ?? 0,
    getItemKey: (index) => rows[index].key,
  })

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-20 text-center">
        <p className="text-sm font-medium">No strings found</p>
        <p className="mt-1 text-sm text-muted-foreground">Try a different status, group, version, or search term.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div
        className={cn(
          ROW_GRID,
          "items-center border-b border-l-2 border-border border-l-transparent bg-muted/40 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
        )}
      >
        <span className="flex justify-center">
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            aria-label={`Select all ${rows.length} keys in view`}
            onCheckedChange={(checked) => onSelectAll(checked === true)}
          />
        </span>
        <span>Key</span>
        <span>{languageName}</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>

      <div ref={listRef} className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            ref={virtualizer.measureElement}
            data-index={item.index}
            className="absolute left-0 top-0 w-full"
            style={{ transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)` }}
          >
            {renderRow(rows[item.index])}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Viết `components/translations/group-filter.tsx`**

```tsx
"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { GroupOption } from "@/lib/locale-data"
import { cn } from "@/lib/utils"
import { ALL_GROUPS } from "@/lib/workspace-view"

/** Dozens of groups is too many for tabs - a searchable combobox instead. */
export function GroupFilter({
  value,
  options,
  totalKeys,
  onChange,
}: {
  value: string
  options: GroupOption[]
  totalKeys: number
  onChange: (group: string) => void
}) {
  const [open, setOpen] = useState(false)

  const select = (group: string) => {
    onChange(group)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-8 w-56 items-center justify-between gap-2 rounded-lg border border-input bg-card px-2.5 text-sm transition-colors hover:bg-accent/40"
          />
        }
      >
        <span className={cn("truncate", value !== ALL_GROUPS && "font-mono text-[13px]")}>
          {value === ALL_GROUPS ? "All groups" : value}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Command>
          <CommandInput placeholder="Filter group key…" />
          <CommandList>
            <CommandEmpty>No group found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all groups" onSelect={() => select(ALL_GROUPS)}>
                <Check className={cn("size-4", value === ALL_GROUPS ? "opacity-100" : "opacity-0")} />
                <span>All groups</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{totalKeys}</span>
              </CommandItem>
              {options.map((option) => (
                <CommandItem key={option.group} value={option.group} onSelect={() => select(option.group)}>
                  <Check className={cn("size-4", value === option.group ? "opacity-100" : "opacity-0")} />
                  <span className="truncate font-mono text-xs">{option.group}</span>
                  <span className="ml-auto flex items-center gap-1.5 text-xs tabular-nums">
                    {option.outstanding > 0 && (
                      <span className="rounded-full bg-warning/15 px-1.5 font-semibold text-warning-foreground">
                        {option.outstanding}
                      </span>
                    )}
                    <span className="text-muted-foreground">{option.total}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 6: Viết `components/translations/project-profile-card.tsx`**

```tsx
import type { ReactNode } from "react"
import { BellRing, KeyRound, Mail, MessageSquare, Type } from "lucide-react"

import { kindLabel, type ContentKind, type Project } from "@/lib/projects"
import { effectiveLengthBudget } from "@/lib/validation"

const kindIcon: Record<ContentKind, typeof Type> = {
  ui: Type,
  email: Mail,
  sms: MessageSquare,
  notification: BellRing,
}

/** What a project is for, so whoever adds its first key knows the register to write in. */
export function ProjectProfileCard({
  project,
  title,
  message,
  action,
}: {
  project: Project
  title: string
  message: string
  action?: ReactNode
}) {
  const { profile } = project
  const KindIcon = kindIcon[profile.kind]

  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <KeyRound className="size-4" />
          </div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile.note} {message}
        </p>

        <dl className="mt-5 grid gap-3 text-sm">
          <Field label="Content kind">
            <span className="flex items-center gap-1.5">
              <KindIcon className="size-3.5" />
              {kindLabel[profile.kind]}
            </span>
          </Field>
          <Field label="Audience">{profile.audience}</Field>
          <Field label="Tone">{profile.tone}</Field>
          <Field label="Length budget">
            Warn past {effectiveLengthBudget(profile.lengthBudget)}× the English length
            {profile.maxLength ? `, hard limit ${profile.maxLength.toLocaleString()} characters` : ""}
          </Field>
          <Field label="Profile">{profile.measured ? "Measured" : "Inferred"}</Field>
        </dl>

        {action && <div className="mt-6 flex">{action}</div>}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
```

- [ ] **Step 7: Viết lại `components/translation-workspace.tsx`**

Thay toàn bộ file:

```tsx
"use client"

import { useMemo, useState, type ReactNode } from "react"
import {
  ChevronDown,
  Download,
  FileUp,
  FlaskConical,
  Lock,
  Plus,
  Rocket,
  RotateCw,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"

import { useDrafts } from "@/components/draft-provider"
import { PopoverMenu, PopoverMenuItem } from "@/components/popover-menu"
import { TranslationList } from "@/components/translation-list"
import { TranslationRow } from "@/components/translation-row"
import { AddKeyDialog } from "@/components/translations/add-key-dialog"
import { DeleteKeysDialog } from "@/components/translations/delete-keys-dialog"
import { ExportDialog } from "@/components/translations/export-dialog"
import { GroupFilter } from "@/components/translations/group-filter"
import { ProjectProfileCard } from "@/components/translations/project-profile-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
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
import { groupLabel, kindLabel, targetOf, type Project } from "@/lib/projects"
import { ALL_VERSIONS, versions } from "@/lib/release"
import { cn } from "@/lib/utils"
import { ALL_GROUPS, resolveGroup, statusFilters, viewOf } from "@/lib/workspace-view"

const outlineButton =
  "flex h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors hover:bg-accent/40 disabled:pointer-events-none disabled:opacity-50"
const primaryButton =
  "flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
const destructiveButton =
  "flex h-9 items-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20"

export function TranslationWorkspace({ project }: { project: Project }) {
  const target = targetOf(project)
  const isTemplateChannel = project.profile.kind !== "ui"

  const { filters, setParam, setParams } = useWorkspaceParams()
  const { language } = filters
  const { revision, refresh } = useCoverage()
  const { rows, isLoading, error } = useTranslationRows(isTemplateChannel ? null : target, language, revision)

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
    setParams({ q: key, status: null, group: null })
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{groupLabel[project.group]}</span>
            <span>/</span>
            <span className="text-foreground">Translations</span>
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
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Managing <span className="font-medium text-foreground">{languageInfo.name}</span> translations ·{" "}
            {rows.length.toLocaleString()} keys
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasKeys && (
            <button type="button" onClick={() => setExportOpen(true)} className={outlineButton}>
              <Download className="size-4" />
              Export
            </button>
          )}
          <Tooltip>
            <TooltipTrigger render={<span tabIndex={0} className="rounded-lg" />}>
              <button type="button" disabled className={outlineButton}>
                <FileUp className="size-4" />
                Import
              </button>
            </TooltipTrigger>
            <TooltipContent>Coming soon</TooltipContent>
          </Tooltip>
          <button type="button" className={outlineButton}>
            <Lock className="size-4" />
            Lock
          </button>
          <PublishMenu />
          {!isTemplateChannel && (
            <button type="button" onClick={() => setAddOpen(true)} className={primaryButton}>
              <Plus className="size-4" />
              Add key
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      {!isTemplateChannel && (isLoading || hasKeys) && (
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

      {!isTemplateChannel && hasKeys && (
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
            <div className="flex flex-wrap items-center gap-1">
              {statusFilters
                .filter((item) => item.id !== "new" || view.hasManual || filters.status === "new")
                .map((item) => {
                  const active = filters.status === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setParam("status", item.id === "all" ? null : item.id)}
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
                        {statusCounts[item.id].toLocaleString()}
                      </span>
                      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
                    </button>
                  )
                })}
            </div>
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
        {isTemplateChannel ? (
          <ProjectProfileCard
            project={project}
            title={`${project.name} templates`}
            message="The template editor for this channel is coming soon. Its texts already count toward the numbers in the sidebar."
          />
        ) : error ? (
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

function StatCard({
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

function Tray({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg shadow-black/5 backdrop-blur animate-in fade-in slide-in-from-bottom-2">
      {children}
    </div>
  )
}

function SkeletonRows() {
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

- [ ] **Step 8: Xóa bảng cũ**

```bash
git rm components/translation-table.tsx
```

- [ ] **Step 9: Chạy gate**

Run: `npm run typecheck && npm test`
Expected: sạch / PASS.

- [ ] **Step 10: Kiểm tra bằng trình duyệt**

Run: `npm run dev`, mở `http://localhost:3000/web/school-portal`.
Expected:
- Stat cards: `99%` · Translated `493` · Needs fix `1` · Missing `6` (phụ đề `0 outdated`). Bấm Missing → URL `?status=missing`, danh sách còn 6 dòng, tab Missing active.
- GroupFilter liệt kê 46 group kèm outstanding/total; chọn một group → tab đếm lại theo group đó, stat cards không đổi.
- Version pill `v12` → URL `?version=v12`, danh sách chỉ còn key thuộc v12.
- Gõ vào ô ⌘K → danh sách lọc, tab count không đổi; Ctrl+K focus ô search.
- Sửa một ô → viền trái primary, tray "1 unsaved key in Vietnamese"; Discard → hết tray. Sửa lại → Save all → toast "Saved 1 key — Written to server-data/translations/web/school-portal/vi.json".
- Tìm `product.producttype.grapeseed` (missing) → "Keep English" → Save all → dòng thành Translated, có "Kept as English".
- Chọn `en`, sửa `user.form.actions.cancel` thành `Cancel now` → Save; chọn `vi` → dòng đó Outdated kèm "Still correct"; bấm → Save → Translated.
- Hover một dòng: Copy (toast), Paste (điền English), History (tooltip created/updated), Delete (mở dialog).
- Chọn 2 dòng → tray "2 selected" → Delete → dialog; để trống checkbox → "Delete in Vietnamese" → 2 dòng thành Missing. Lặp lại với checkbox bật → key biến mất khỏi mọi ngôn ngữ.
- Add key `home.greeting.title` / `Hello` → màn fan-out 13 ngôn ngữ; list phía sau lọc `q=home.greeting.title`; tab "Added here" xuất hiện.
- Export → tick `vi`, `km`, tắt "Include untranslated", tên `school` → tải `school.zip`; giải nén được; số key trong `vi.json` bằng tổng tab Translated + Outdated + Needs fix của Vietnamese đang hiện trên màn hình (ngay sau Reset demo data: 494), và không chứa key nào đang Missing.
- Chọn `Arabic` → ô nhập chữ phải-sang-trái.
- Mở `/mobile/student-app` → card profile + Add key; `/messages/email` → card template, không có Add key.
- Sửa ở School Portal (vi) rồi sang Student App → không có tray; quay lại → tray còn.
- User menu → Reset demo data → số về seed, tray biến mất.
- Chuyển theme sáng/tối → mọi màu dùng token, badge Outdated màu `info`.

- [ ] **Step 11: Commit**

```bash
git add components package.json package-lock.json
git commit -m "Rebuild the translation workspace on the real data layer"
```

---

### Task 8: Dọn dẹp và xác minh toàn bộ

**Files:**
- Delete: `lib/data.ts`

**Interfaces:**
- Consumes: toàn bộ.
- Produces: repo build được, không còn tham chiếu `@/lib/data`.

- [ ] **Step 1: Xác nhận không còn ai dùng `lib/data.ts`, rồi xóa**

```bash
grep -rn '@/lib/data"' app components hooks lib mock tests || echo "no importers"
git rm lib/data.ts
```

Expected: `no importers` trước khi xóa.

- [ ] **Step 2: Chạy toàn bộ gate**

Run: `npm run typecheck && npm test && npm run build`
Expected: `tsc` sạch; mọi test PASS; `next build` hoàn tất, liệt kê route `/` và `/[group]/[project]`.

- [ ] **Step 3: Chạy bản build và click qua lần cuối**

Run: `npm run start`, mở `http://localhost:3000/`.
Expected: lặp lại danh sách kiểm tra ở Task 7 Step 10 trên bản production; thêm: đóng tab, mở lại → thay đổi đã Save vẫn còn (IndexedDB); tray chưa Save thì không còn.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Remove the static mock data now that every screen reads the backend"
```
