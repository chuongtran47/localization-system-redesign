# Excel/CSV trong Import và Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Translator (và developer) tải về một sheet Excel/CSV của một project ở một ngôn ngữ từ dialog Export, điền bản dịch, rồi đưa lại vào wizard Import để xem trước và lưu — không tạo hay xóa key, không thêm dependency.

**Architecture:** Bốn module thuần trong `lib/` — `zip.ts` (đọc/ghi zip có giới hạn), `csv.ts`, `xlsx.ts` (định dạng), `sheet.ts` (nội dung sheet: dựng lưới, đọc file, luật kiểm theo field, lập kế hoạch lưu, diff) — dùng chung cho mock backend (route `POST /sheet` tạo file) và wizard (đọc file ở trình duyệt). Sheet được lưu bằng `PUT /translations` kèm `sources` (English lúc xem trước) để server bỏ qua key có English đã đổi. UI mở rộng dialog Export và wizard Import có sẵn, theo quyền `exchangeSheets` mới.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.7, Tailwind v4, Base UI (shadcn base-nova), vitest; `CompressionStream`/`DecompressionStream` của nền tảng.

**Spec:** [docs/superpowers/specs/2026-09-30-sheet-import-export-design.md](../specs/2026-09-30-sheet-import-export-design.md) — xây trên spec role [2026-09-29-roles-design.md](../specs/2026-09-29-roles-design.md).

Mọi lệnh bash chạy từ gốc repo, trên branch `feat/roles`.

## Global Constraints

- Không thêm dependency. Tên file kebab-case. `lib/api.ts` là module duy nhất gọi backend.
- Màn hình hỏi quyền (`can.exchangeBundles`, `can.exchangeSheets`, …), không so tên role.
- Cột sheet (spec §3.1): UI `Key · English · <Tên> (<mã>) · Status`; template `Key · Template · Field · English · <Tên> (<mã>) · Status`. Tên file mặc định `<project id>.<mã>.xlsx|.csv`.
- Ngôn ngữ của sheet **chỉ** lấy từ tiêu đề cột bản dịch (spec §3.3). English không bao giờ là ngôn ngữ của sheet.
- Sheet không tạo, không xóa key; luôn là merge; ghi bằng `saveTranslations(target, lang, values, keepKeys, sources)`.
- Copy chính xác (spec §5–§6): `Excel (.xlsx)`, `CSV`, `JSON bundle`, `Language`, `Rows`, `Strings to translate (N)`, `All strings (N)`, `File name`, `Download`, `Import language files` / `Import translations`, `Drop .json, .xlsx or .csv files here` / `Drop .xlsx or .csv files here`, `JSON bundles are imported in the developer view`, `Import JSON files and sheets separately.`, `Sheet · <N> rows`, `<n> not in <project> · <n> English changed since download · <n> empty · <n> duplicate`, `Keep English`, `<n> saved → <file>`, ` · <n> skipped - English changed since the preview`.
- Màu qua token; không `amber-*`, `sky-*`, `emerald-*`, `rose-*`.
- Commit message không có dòng `Co-Authored-By` hay attribution Claude/Anthropic.
- Gate mỗi task: `npm run typecheck` và `npm test`; Task 6 thêm `npm run build`. Sau build/tsc: `git checkout -- next-env.d.ts tsconfig.tsbuildinfo`.
- **Node:** symlink Node toàn cục của máy đang trỏ v16; mọi lệnh `npm`/`npx`/`node` của plan chạy sau `export PATH="/c/nvm/v24.13.0:$PATH"` (không đổi symlink).
- Kiểm tra UI: driver trong `<scratchpad>` = `C:/Users/CHARLI~1/AppData/Local/Temp/claude/c--Users-Charlie-Tran-Downloads-localization-system-redesign/030cc817-93e9-4e56-9f6b-2b6f7b199a47/scratchpad`; `<ws>` = `.superpowers/sdd/2026-09-30-sheet-import-export/`. Nút và menu được bấm bằng **chuột thật** qua `cdp-pointer.mjs` (Task 5 Step 1). Không dừng dev server ở `:3000`.

## Sai khác có chủ đích so với spec

1. **`/import` dùng client wrapper `ImportPageClient`** (`components/import/import-page-client.tsx`) — `app/(workspace)/import/page.tsx` là Server Component nên không đọc được `useRole()`; wrapper render `RoleGate capability="exchangeSheets"` và `ImportWizard key={role}` (bổ sung sau review spec).
2. **Giới hạn chống zip bomb trong `readZip`** (bổ sung sau review spec): file nén ≤ 10 MB, ≤ 1000 entry, tổng dữ liệu giải nén của một lần đọc ≤ 50 MB — đếm trên byte thực sự ra khỏi stream, không tin kích thước khai trong header; `readXlsx` chỉ giải nén `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, `xl/sharedStrings.xml` và sheet đầu tiên. Sheet (cả CSV) lớn hơn 10 MB bị từ chối trước khi đọc.
3. **CSV không phải UTF-8** (Excel "CSV (Comma delimited)" lưu theo code page của Windows) → lỗi `Save it as "CSV UTF-8" and try again` thay vì nhập chữ bị hỏng — thêm một dòng vào bảng lỗi §6.
4. **"Fixture Excel" dựng trong code test** (chuỗi XML theo đúng cấu trúc Excel lưu ra, zip bằng `createZip`) thay cho file nhị phân `tests/fixtures/excel-saved.xlsx` — đọc được khi review, không có file nhị phân trong repo.
5. **Thứ tự hàng template** theo `GET /templates` (sắp theo tên template, như bảng trên màn hình) rồi thứ tự field — spec §3.2 ghi "thứ tự trong registry", nhưng route trả theo tên.
6. **Lỗi theo tầng**: `ZipError` (có `reason: "format" | "limit"`), `XlsxError`, `CsvError` trong module định dạng; `readSheetFile` ở `lib/sheet.ts` đổi chúng thành `SheetFileError` với câu của spec §6.
7. **`sameSource(a, b)`** trong `lib/locale-data.ts` (so English bỏ khoảng trắng hai đầu, chuẩn hóa `\r\n`) dùng chung cho store và sheet.
8. **Dialog Export tách thành vỏ + `BundleExportForm` (JSON, code cũ chuyển nguyên) + `SheetExportForm` (file mới)**; form được key theo lượt mở dialog nên state tự đặt lại khi mở lại (thay cho đoạn reset thủ công cũ). Hành vi JSON không đổi.
9. **Chọn ngôn ngữ trong form sheet là `<select>` gốc** — repo không có Select primitive, và popover đặt trong dialog có `transform` gặp đúng loại lỗi chồng lớp vừa sửa ở topbar.
10. **Thứ tự áp quy tắc của `planSheet`**: trùng → không có key → trống → English đã đổi (spec §3.4 không nêu thứ tự; hàng đầu tiên của một key luôn thắng).
11. **`writeXlsx`** ghi `\r` thành `&#13;`, thêm `_x005F_` trước chuỗi dạng `_xHHHH_`, bỏ ký tự điều khiển XML 1.0 không cho phép — để giá trị về nguyên vẹn qua một vòng (trừ ký tự điều khiển, vốn không lưu được trong XML).

## Review Focus

1. **CSV lưu bằng "CSV (Comma delimited)" của Excel (không phải UTF-8)** — báo lỗi rõ, không bao giờ nhập chữ tiếng Việt bị thành `?`. → Task 3 test `readSheetFile` với bytes Windows-1252.
2. **Translator gõ `007`, `1/2` vào ô bản dịch trong Excel** — ô thân sheet có định dạng Text (`numFmtId 49`) nên Excel giữ nguyên như gõ. → Task 2 test XML của `writeXlsx`.
3. **Sheet của project/kênh khác thả vào project này** — mọi hàng là "not in <project>", Confirm bị chặn, không ghi gì. → Task 3 test `planSheet` + `diffSheet`.
4. **Sheet 5.000 hàng** — ghi và đọc lại trọn vẹn, trong giới hạn mặc định. → Task 2 test.
5. **Bản dịch chỉ khác giá trị đang lưu ở kiểu xuống dòng (`\r\n` từ Excel Windows)** — không tính là thay đổi. → Task 3 test `planSheet`.

---

### Task 1: `lib/zip.ts` — đọc/ghi zip có giới hạn

**Files:**
- Move: `mock/zip.ts` → `lib/zip.ts` (giữ writer, thêm reader)
- Create: `tests/zip.test.ts`, `tests/helpers/zip-builder.ts`
- Modify: `mock/router.ts` (import), `tests/helpers/zip.ts` (dùng reader của lib)

**Interfaces:**
- Produces: `type Bytes = Uint8Array<ArrayBuffer>`; `type ZipEntry = { name: string; data: string }`; `createZip(entries, now?): Promise<Bytes>`; `crc32(bytes: Bytes): number`; `class ZipError extends Error { reason: "format" | "limit" }`; `type ZipLimits = { maxArchiveBytes: number; maxEntries: number; maxTotalBytes: number }`; `DEFAULT_ZIP_LIMITS`; `readZip(bytes: Bytes, options?: { only?: (name: string) => boolean; limits?: ZipLimits }): Promise<Map<string, Bytes>>`; test helper `storedZip(entries: { name: string; data: string; dataDescriptor?: boolean }[]): Bytes`.

- [ ] **Step 0: Chụp baseline hồi quy (trước khi sửa bất cứ file nào)**

```bash
export PATH="/c/nvm/v24.13.0:$PATH"
mkdir -p .superpowers/sdd/2026-09-30-sheet-import-export
```

Run (từ `<scratchpad>`, mỗi lệnh một profile mới):
`node cdp.mjs "<scratchpad>/chrome-sheet-flows-before" "http://localhost:3000/web/school-portal" steps-flows.txt > "<ws>/flows-before.txt"`
`node cdp.mjs "<scratchpad>/chrome-sheet-tpl-before" "http://localhost:3000/messages/email?lang=vi" steps-templates.txt > "<ws>/templates-before.txt"`
`node cdp.mjs "<scratchpad>/chrome-sheet-import-before" "http://localhost:3000/import?target=web/school-portal" steps-import.txt > "<ws>/import-before.txt"`
Expected: mỗi file đủ dòng JSON, không dòng nào là lỗi (`no element`, `null` ở chỗ phải có giá trị).

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/helpers/zip-builder.ts`:

```ts
import { crc32, type Bytes } from "@/lib/zip"

/**
 * Stored (uncompressed) entries, optionally with their sizes in a data
 * descriptor instead of the local header - the way streaming writers, Excel
 * among them, lay a file out. `createZip` only writes deflated entries with
 * the sizes up front, so this is how the reader's other paths are exercised.
 */
export function storedZip(entries: { name: string; data: string; dataDescriptor?: boolean }[]): Bytes {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = encoder.encode(entry.data) as Bytes
    const crc = crc32(data)
    const deferred = entry.dataDescriptor === true
    const flags = 0x0800 | (deferred ? 0x0008 : 0)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, flags, true)
    local.setUint32(14, deferred ? 0 : crc, true)
    local.setUint32(18, deferred ? 0 : data.length, true)
    local.setUint32(22, deferred ? 0 : data.length, true)
    local.setUint16(26, name.length, true)
    parts.push(new Uint8Array(local.buffer), name, data)
    let size = 30 + name.length + data.length

    if (deferred) {
      const descriptor = new DataView(new ArrayBuffer(16))
      descriptor.setUint32(0, 0x08074b50, true)
      descriptor.setUint32(4, crc, true)
      descriptor.setUint32(8, data.length, true)
      descriptor.setUint32(12, data.length, true)
      parts.push(new Uint8Array(descriptor.buffer))
      size += 16
    }

    const record = new DataView(new ArrayBuffer(46))
    record.setUint32(0, 0x02014b50, true)
    record.setUint16(4, 20, true)
    record.setUint16(6, 20, true)
    record.setUint16(8, flags, true)
    record.setUint32(16, crc, true)
    record.setUint32(20, data.length, true)
    record.setUint32(24, data.length, true)
    record.setUint16(28, name.length, true)
    record.setUint32(42, offset, true)
    central.push(new Uint8Array(record.buffer), name)
    offset += size
  }

  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, central.reduce((sum, part) => sum + part.length, 0), true)
  end.setUint32(16, offset, true)

  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0))
  let at = 0
  for (const part of all) {
    out.set(part, at)
    at += part.length
  }
  return out
}
```

`tests/zip.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { createZip, DEFAULT_ZIP_LIMITS, readZip, ZipError, type Bytes } from "@/lib/zip"
import { storedZip } from "./helpers/zip-builder"

const text = (bytes: Bytes | undefined) => new TextDecoder().decode(bytes)

/** The central directory claims `size` bytes for the first entry - a lying header. */
function lieAboutSize(zip: Bytes, size: number): Bytes {
  const copy = new Uint8Array(zip) as Bytes
  const view = new DataView(copy.buffer)
  for (let at = copy.length - 4; at >= 0; at -= 1) {
    if (view.getUint32(at, true) === 0x02014b50) {
      view.setUint32(at + 24, size, true)
      break
    }
  }
  return copy
}

describe("readZip", () => {
  it("reads back what createZip wrote", async () => {
    const zip = await createZip([
      { name: "a.txt", data: "Xin chào" },
      { name: "dir/b.xml", data: "<x/>" },
    ])
    const entries = await readZip(zip)
    expect([...entries.keys()]).toEqual(["a.txt", "dir/b.xml"])
    expect(text(entries.get("a.txt"))).toBe("Xin chào")
  })

  it("reads stored entries and entries whose sizes live in a data descriptor", async () => {
    const entries = await readZip(
      storedZip([
        { name: "plain.txt", data: "plain" },
        { name: "streamed.txt", data: "streamed", dataDescriptor: true },
      ])
    )
    expect(text(entries.get("plain.txt"))).toBe("plain")
    expect(text(entries.get("streamed.txt"))).toBe("streamed")
  })

  it("inflates only the entries asked for", async () => {
    const zip = await createZip([
      { name: "small.xml", data: "<a/>" },
      { name: "huge.xml", data: "x".repeat(200_000) },
    ])
    const entries = await readZip(zip, {
      only: (name) => name === "small.xml",
      limits: { ...DEFAULT_ZIP_LIMITS, maxTotalBytes: 1000 },
    })
    expect([...entries.keys()]).toEqual(["small.xml"])
  })

  it("stops an archive that expands past the limit, whatever its headers claim", async () => {
    const zip = await createZip([{ name: "bomb.txt", data: "0".repeat(1_000_000) }])
    const limits = { ...DEFAULT_ZIP_LIMITS, maxTotalBytes: 100_000 }
    await expect(readZip(zip, { limits })).rejects.toThrow(ZipError)
    await expect(readZip(lieAboutSize(zip, 10), { limits })).rejects.toThrow(/expands/)
  })

  it("refuses too many entries and too large an archive", async () => {
    const zip = await createZip(Array.from({ length: 5 }, (_, index) => ({ name: `${index}.txt`, data: "x" })))
    await expect(readZip(zip, { limits: { ...DEFAULT_ZIP_LIMITS, maxEntries: 3 } })).rejects.toThrow(/entries/)
    await expect(readZip(zip, { limits: { ...DEFAULT_ZIP_LIMITS, maxArchiveBytes: 100 } })).rejects.toThrow(/larger/)
  })

  it("refuses bytes that are not a zip, and a damaged entry", async () => {
    await expect(readZip(new TextEncoder().encode("not a zip at all") as Bytes)).rejects.toThrow(/Not a zip/)
    const zip = await createZip([{ name: "a.txt", data: "hello hello hello hello" }])
    const damaged = new Uint8Array(zip) as Bytes
    damaged[40] ^= 0xff
    await expect(readZip(damaged)).rejects.toThrow(ZipError)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/zip.test.ts`
Expected: FAIL — `Cannot find module '@/lib/zip'`.

- [ ] **Step 3: Chuyển writer sang `lib/zip.ts` và thêm reader**

```bash
git mv mock/zip.ts lib/zip.ts
```

Trong `lib/zip.ts`:
1. Thay khối chú thích đầu file (từ `/**` đầu tiên tới `*/` trước `/** Bytes backed by…`) bằng:

```ts
/**
 * A minimal ZIP reader and writer - enough for locale archives and Excel
 * workbooks.
 *
 * Neither Node nor the browser ships an archive format, and a dependency for
 * a few hundred lines of header layout is a poor trade. The writer emits
 * deflated entries, a central directory and an end-of-central-directory
 * record: the subset of PKZIP every unzip tool reads. The reader works from
 * the central directory - a streaming writer (Excel is one) may put 0 in every
 * local header's sizes - and stops at the limits below, so a small file that
 * inflates to gigabytes cannot hang the tab.
 *
 * Nothing here is Node-specific: `CompressionStream`, `DecompressionStream`
 * and `Uint8Array` are the same in both runtimes, which is what lets the mock
 * run on the dev server, in the tab and in vitest. No zip64, no encryption.
 */
```

2. Đổi `function crc32(bytes: Bytes): number {` thành `export function crc32(bytes: Bytes): number {`.
3. Thêm cuối file:

```ts
/* ------------------------------------------------------------------ reading */

export class ZipError extends Error {
  /** `limit`: a well-formed archive, but past what an import reads. */
  reason: "format" | "limit"

  constructor(message: string, reason: "format" | "limit" = "format") {
    super(message)
    this.name = "ZipError"
    this.reason = reason
  }
}

export type ZipLimits = {
  /** The archive itself, in bytes. */
  maxArchiveBytes: number
  /** Entries in the central directory. */
  maxEntries: number
  /** Bytes inflated by one read, every entry together. */
  maxTotalBytes: number
}

/**
 * A sheet of a few thousand rows is a few hundred KB zipped and a few MB
 * unzipped. These leave room for ten times that and stop far short of what
 * would hang a tab.
 */
export const DEFAULT_ZIP_LIMITS: ZipLimits = {
  maxArchiveBytes: 10 * 1024 * 1024,
  maxEntries: 1000,
  maxTotalBytes: 50 * 1024 * 1024,
}

type DirectoryEntry = {
  name: string
  flags: number
  method: number
  crc: number
  compressedSize: number
  size: number
  localOffset: number
}

const STORED = 0
const ENCRYPTED = 0x0001
/** A 32-bit field at its maximum means the real value is in a zip64 record. */
const ZIP64 = 0xffffffff

const damaged = (name: string) => new ZipError(`The archive is damaged near ${name}`)
const expands = () => new ZipError("The archive expands to more than an import reads", "limit")

function directoryOf(bytes: Bytes, limits: ZipLimits): DirectoryEntry[] {
  if (bytes.length > limits.maxArchiveBytes) {
    throw new ZipError(`The archive is larger than ${limits.maxArchiveBytes} bytes`, "limit")
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  // The end record is the last 22 bytes, unless a comment of up to 64 KB follows it.
  let end = -1
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at -= 1) {
    if (view.getUint32(at, true) === END_OF_CENTRAL) {
      end = at
      break
    }
  }
  if (end < 0) {
    throw new ZipError("Not a zip archive")
  }

  const count = view.getUint16(end + 10, true)
  const size = view.getUint32(end + 12, true)
  const start = view.getUint32(end + 16, true)
  if (count > limits.maxEntries) {
    throw new ZipError(`The archive holds more than ${limits.maxEntries} entries`, "limit")
  }
  if (start === ZIP64 || start + size > end) {
    throw new ZipError("The archive's directory is damaged")
  }

  const decoder = new TextDecoder()
  const entries: DirectoryEntry[] = []
  let at = start
  for (let index = 0; index < count; index += 1) {
    if (at + 46 > end || view.getUint32(at, true) !== CENTRAL_HEADER) {
      throw new ZipError("The archive's directory is damaged")
    }
    const nameLength = view.getUint16(at + 28, true)
    const entry: DirectoryEntry = {
      flags: view.getUint16(at + 8, true),
      method: view.getUint16(at + 10, true),
      crc: view.getUint32(at + 16, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      localOffset: view.getUint32(at + 42, true),
      name: decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength)),
    }
    if (entry.compressedSize === ZIP64 || entry.size === ZIP64 || entry.localOffset === ZIP64) {
      throw new ZipError("Zip64 archives are not supported")
    }
    entries.push(entry)
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true)
  }
  return entries
}

/** Counts what the stream yields - the sizes in the headers are only what the file claims. */
async function inflateRaw(bytes: Bytes, budget: { left: number }): Promise<Bytes> {
  const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader()
  const chunks: Bytes[] = []
  let total = 0
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>
    try {
      chunk = await reader.read()
    } catch {
      throw new ZipError("An entry in the archive cannot be inflated")
    }
    if (chunk.done) {
      break
    }
    total += chunk.value.length
    if (total > budget.left) {
      await reader.cancel().catch(() => undefined)
      throw expands()
    }
    chunks.push(chunk.value as Bytes)
  }
  budget.left -= total
  return concat(chunks)
}

async function contentOf(bytes: Bytes, entry: DirectoryEntry, budget: { left: number }): Promise<Bytes> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const at = entry.localOffset
  if (entry.flags & ENCRYPTED) {
    throw new ZipError("The archive is encrypted")
  }
  if (at + 30 > bytes.length || view.getUint32(at, true) !== LOCAL_HEADER) {
    throw damaged(entry.name)
  }
  if (entry.size > budget.left) {
    throw expands()
  }
  const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true)
  const stored = bytes.subarray(start, start + entry.compressedSize)
  if (stored.length !== entry.compressedSize) {
    throw damaged(entry.name)
  }

  let content: Bytes
  if (entry.method === STORED) {
    if (stored.length > budget.left) {
      throw expands()
    }
    budget.left -= stored.length
    content = stored
  } else if (entry.method === DEFLATE) {
    content = await inflateRaw(stored, budget)
  } else {
    throw new ZipError(`${entry.name} uses a compression this reader does not know`)
  }
  if (content.length !== entry.size || crc32(content) !== entry.crc) {
    throw damaged(entry.name)
  }
  return content
}

/**
 * The entries of an archive by name - every file, or those `only` accepts.
 * Entries it skips are never inflated, so a workbook's images and printer
 * settings cost nothing.
 */
export async function readZip(
  bytes: Bytes,
  { only, limits = DEFAULT_ZIP_LIMITS }: { only?: (name: string) => boolean; limits?: ZipLimits } = {}
): Promise<Map<string, Bytes>> {
  const budget = { left: limits.maxTotalBytes }
  const out = new Map<string, Bytes>()
  for (const entry of directoryOf(bytes, limits)) {
    if (entry.name.endsWith("/") || (only && !only(entry.name))) {
      continue
    }
    out.set(entry.name, await contentOf(bytes, entry, budget))
  }
  return out
}
```

- [ ] **Step 4: Nối lại router và helper test**

`mock/router.ts`: đổi `import { createZip, type Bytes } from "./zip"` thành `import { createZip, type Bytes } from "../lib/zip"`.

`tests/helpers/zip.ts` — thay toàn bộ:

```ts
import { readZip as readEntries, type Bytes } from "@/lib/zip"

/** Every entry's name and text - how the router tests read an export back. */
export async function readZip(bytes: Uint8Array): Promise<Record<string, string>> {
  const decoder = new TextDecoder()
  const entries = await readEntries(new Uint8Array(bytes) as Bytes)
  return Object.fromEntries([...entries].map(([name, data]) => [name, decoder.decode(data)]))
}
```

- [ ] **Step 5: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS toàn bộ (113 cũ + 6 mới = 119); `tsc` sạch.

- [ ] **Step 6: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo 2>/dev/null
git add lib/zip.ts mock/router.ts tests/zip.test.ts tests/helpers/zip-builder.ts tests/helpers/zip.ts
git commit -m "Move the zip writer into lib and add a bounded reader"
```

---

### Task 2: `lib/csv.ts` và `lib/xlsx.ts`

**Files:**
- Create: `lib/csv.ts`, `lib/xlsx.ts`, `tests/csv.test.ts`, `tests/xlsx.test.ts`

**Interfaces:**
- Consumes: `createZip`, `readZip`, `DEFAULT_ZIP_LIMITS`, `type Bytes`, `type ZipLimits` (Task 1).
- Produces: `class CsvError`; `writeCsv(rows: string[][]): string`; `readCsv(text: string): string[][]`; `class XlsxError`; `type XlsxLayout = { sheetName: string; widths: number[] }`; `writeXlsx(rows: string[][], layout: XlsxLayout): Promise<Bytes>`; `readXlsx(bytes: Bytes, limits?: ZipLimits): Promise<string[][]>`; `columnName(index: number): string`.

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { CsvError, readCsv, writeCsv } from "@/lib/csv"

const values = [
  "Xin chào",
  "مرحبا",
  'say "hi"',
  "a,b",
  "line one\nline two",
  "  spaced  ",
  "=SUM(A1)",
  "-5",
  "+1",
  "@x",
  "\t=x",
  "'=SUM(A1)",
  "'Tis",
  "''",
  "plain",
  "",
]

describe("csv", () => {
  it("reads back every value it wrote", () => {
    const rows = [["Key", "Value"], ...values.map((value, index) => [`k.${index}`, value])]
    expect(readCsv(writeCsv(rows))).toEqual(rows)
  })

  it("writes a BOM, CRLF line ends, and keeps a formula from running in Excel", () => {
    expect(writeCsv([["=SUM(A1)", "ok"]])).toBe("\uFEFF'=SUM(A1),ok\r\n")
  })

  it("reads the semicolon and tab files Excel writes in other locales", () => {
    expect(readCsv("Key;English\r\nnav.home;Home")).toEqual([
      ["Key", "English"],
      ["nav.home", "Home"],
    ])
    expect(readCsv("Key\tEnglish\nnav.home\tHome\n")).toEqual([
      ["Key", "English"],
      ["nav.home", "Home"],
    ])
  })

  it("reports a quote that is never closed", () => {
    expect(() => readCsv('Key,English\n"open,x')).toThrow(CsvError)
  })
})
```

`tests/xlsx.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { columnName, readXlsx, writeXlsx, XlsxError } from "@/lib/xlsx"
import { createZip, readZip, ZipError, type Bytes } from "@/lib/zip"

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const decode = (bytes: Bytes | undefined) => new TextDecoder().decode(bytes)

const tricky = [
  "Xin chào",
  "مرحبا",
  "a & b < c > d",
  '"quoted"',
  "it's",
  "line one\nline two",
  "cr\r\nlf",
  "_x000D_ literal",
  "=SUM(A1)",
  "007",
  "<p>Hi <strong>{name}</strong></p>",
  "😀",
  "  spaced  ",
]

describe("writeXlsx and readXlsx", () => {
  it("names columns past Z", () => {
    expect([0, 25, 26, 27, 701, 702].map(columnName)).toEqual(["A", "Z", "AA", "AB", "ZZ", "AAA"])
  })

  it("reads back what it wrote, empty cells included", async () => {
    const rows = [
      ["Key", "English", "Vietnamese (vi)", "Status"],
      ...tricky.map((value, index) => [`k.${index}`, value, index % 2 ? "" : value, "Missing"]),
    ]
    const bytes = await writeXlsx(rows, { sheetName: "School Portal · vi", widths: [40, 60, 60, 14] })
    expect(await readXlsx(bytes)).toEqual(rows)
  })

  it("stores body cells as text, so Excel keeps what a translator types", async () => {
    const parts = await readZip(await writeXlsx([["Key"], ["007"]], { sheetName: "S", widths: [10] }))
    expect(decode(parts.get("xl/styles.xml"))).toContain('numFmtId="49"')
    expect(decode(parts.get("xl/worksheets/sheet1.xml"))).toContain('<c r="A2" s="2" t="inlineStr">')
  })

  it("writes and reads a sheet of 5,000 rows within the default limits", async () => {
    const rows = [["Key", "English"], ...Array.from({ length: 5000 }, (_, index) => [`key.${index}`, `English ${index}`])]
    const grid = await readXlsx(await writeXlsx(rows, { sheetName: "Big", widths: [40, 60] }))
    expect(grid).toHaveLength(5001)
    expect(grid[5000]).toEqual(["key.4999", "English 4999"])
  })

  it("reads a workbook laid out the way Excel saves one", async () => {
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${MAIN}" xmlns:r="${REL}"><bookViews><workbookView/></bookViews><sheets><sheet name="Strings" sheetId="3" r:id="rId7"/><sheet name="Other" sheetId="1" r:id="rId1"/></sheets></workbook>`
    const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId7" Type="${REL}/worksheet" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="rId9" Type="${REL}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
    const shared = `<sst xmlns="${MAIN}" count="6" uniqueCount="6"><si><t>Key</t></si><si><t>English</t></si><si><t>Vietnamese (vi)</t></si><si><r><rPr><b/></rPr><t>Trang</t></r><r><t xml:space="preserve"> chủ</t></r><rPh sb="0" eb="1"><t>ト</t></rPh></si><si><t>line_x000D_
break &amp; more</t></si><si><t/></si></sst>`
    const sheet2 = `<worksheet xmlns="${MAIN}"><sheetData><row r="1" spans="1:3"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>nav.home</t></is></c><c r="B2" t="str"><f>"Ho"&amp;"me"</f><v>Home</v></c><c r="C2" t="s"><v>3</v></c></row><row r="4"><c r="A4" t="inlineStr"><is><t>nav.count</t></is></c><c r="C4"><v>42</v></c></row><row><c t="inlineStr"><is><t>nav.flag</t></is></c><c t="b"><v>1</v></c><c t="e"><v>#N/A</v></c></row><row r="6"><c r="A6" t="inlineStr"><is><t>nav.break</t></is></c><c r="B6" s="3"/><c r="C6" t="s"><v>4</v></c></row></sheetData></worksheet>`
    const sheet1 = `<worksheet xmlns="${MAIN}"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>wrong sheet</t></is></c></row></sheetData></worksheet>`

    const zip = await createZip([
      { name: "[Content_Types].xml", data: "<Types/>" },
      { name: "xl/workbook.xml", data: workbook },
      { name: "xl/_rels/workbook.xml.rels", data: rels },
      { name: "xl/sharedStrings.xml", data: shared },
      { name: "xl/worksheets/sheet1.xml", data: sheet1 },
      { name: "xl/worksheets/sheet2.xml", data: sheet2 },
      { name: "xl/media/image1.png", data: "not read" },
    ])

    expect(await readXlsx(zip)).toEqual([
      ["Key", "English", "Vietnamese (vi)"],
      ["nav.home", "Home", "Trang chủ"],
      [],
      ["nav.count", "", "42"],
      ["nav.flag", "TRUE", ""],
      ["nav.break", "", "line\r\nbreak & more"],
    ])
  })

  it("says what is wrong with a file that is not a workbook", async () => {
    await expect(readXlsx(new TextEncoder().encode("plain text") as Bytes)).rejects.toThrow(ZipError)
    await expect(readXlsx(await createZip([{ name: "readme.txt", data: "hi" }]))).rejects.toThrow(XlsxError)
    const noSheets = await createZip([
      { name: "xl/workbook.xml", data: `<workbook xmlns="${MAIN}"><sheets/></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: "<Relationships/>" },
    ])
    await expect(readXlsx(noSheets)).rejects.toThrow(/no sheets/)
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/csv.test.ts tests/xlsx.test.ts`
Expected: FAIL — `Cannot find module '@/lib/csv'` và `Cannot find module '@/lib/xlsx'`.

- [ ] **Step 3: Viết `lib/csv.ts`**

```ts
/**
 * CSV the way Excel reads and writes it: UTF-8 with a byte-order mark, comma
 * separated, CRLF line ends. Knows nothing about keys - see `sheet.ts`.
 */

export class CsvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CsvError"
  }
}

/**
 * Excel runs a cell that starts like a formula. One leading `'` is added to
 * such a cell - and to a cell that already starts with `'`, so reading strips
 * exactly one `'` and every written value comes back as it was.
 */
const NEEDS_GUARD = /^[=+\-@\t\r']/

function writeCell(value: string): string {
  const text = NEEDS_GUARD.test(value) ? `'${value}` : value
  return /[",\r\n]|^\s|\s$/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function writeCsv(rows: string[][]): string {
  return `\uFEFF${rows.map((row) => row.map(writeCell).join(",")).join("\r\n")}\r\n`
}

/** The separator the header line uses most, outside quotes - Excel writes `;` in much of Europe. */
function delimiterOf(text: string): string {
  const counts = new Map([
    [",", 0],
    [";", 0],
    ["\t", 0],
  ])
  let quoted = false
  for (const char of text) {
    if (char === '"') {
      quoted = !quoted
    } else if (!quoted && (char === "\n" || char === "\r")) {
      break
    } else if (!quoted && counts.has(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1)
    }
  }
  let best = ","
  for (const [char, count] of counts) {
    if (count > (counts.get(best) ?? 0)) {
      best = char
    }
  }
  return best
}

const unguard = (cell: string) => (cell.startsWith("'") ? cell.slice(1) : cell)

/** RFC 4180, forgiving about a missing final line end. */
export function readCsv(text: string): string[][] {
  const body = text.startsWith("\uFEFF") ? text.slice(1) : text
  const delimiter = delimiterOf(body)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  let startedQuoted = false
  let line = 1
  let quoteLine = 0

  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (quoted) {
      if (char === '"') {
        if (body[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        if (char === "\n") {
          line += 1
        }
        cell += char
      }
      continue
    }
    if (char === '"' && cell === "" && !startedQuoted) {
      quoted = true
      startedQuoted = true
      quoteLine = line
      continue
    }
    if (char === delimiter) {
      row.push(unguard(cell))
      cell = ""
      startedQuoted = false
      continue
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && body[index + 1] === "\n") {
        index += 1
      }
      row.push(unguard(cell))
      rows.push(row)
      row = []
      cell = ""
      startedQuoted = false
      line += 1
      continue
    }
    cell += char
  }

  if (quoted) {
    throw new CsvError(`The quote opened on line ${quoteLine} is never closed`)
  }
  if (cell !== "" || row.length > 0 || startedQuoted) {
    row.push(unguard(cell))
    rows.push(row)
  }
  return rows
}
```

- [ ] **Step 4: Viết `lib/xlsx.ts`**

```ts
/**
 * The smallest Excel workbook that Excel, LibreOffice and Google Sheets open,
 * and a reader for the ones they save. One sheet, text cells only.
 *
 * Reading goes through `readZip` with its limits, and inflates only the four
 * parts a grid needs. The XML is read with a small scanner for the handful of
 * elements involved rather than `DOMParser`, so the same code runs in vitest.
 */

import { createZip, DEFAULT_ZIP_LIMITS, readZip, type Bytes, type ZipLimits } from "@/lib/zip"

export class XlsxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "XlsxError"
  }
}

export type XlsxLayout = {
  sheetName: string
  /** Per column, in Excel's character units. */
  widths: number[]
}

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const PACKAGE_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const HEADER_STYLE = 1
const BODY_STYLE = 2

/* ------------------------------------------------------------------ writing */

/** Characters XML 1.0 cannot carry at all. */
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g

function escapeText(value: string): string {
  return (
    value
      .replace(INVALID_XML, "")
      // A literal `_x000D_` would read back as a carriage return, in Excel too.
      .replace(/_x([0-9A-Fa-f]{4})_/g, "_x005F_x$1_")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      // A parser turns a bare CR into LF; the character reference survives.
      .replaceAll("\r", "&#13;")
  )
}

const escapeAttr = (value: string) => escapeText(value).replaceAll('"', "&quot;")

export function columnName(index: number): string {
  let name = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  }
  return name
}

/** Excel's sheet-name rules: at most 31 characters, none of `[]:*?/\`. */
const sheetNameOf = (name: string) => name.replace(/[[\]:*?/\\]/g, "").trim().slice(0, 31) || "Sheet1"

// Style 1 is the bold header; style 2 is every body cell - text format ("@",
// id 49) so a typed 007 stays 007, wrapped and top-aligned for long English.
const STYLES = `${DECLARATION}<styleSheet xmlns="${MAIN}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

const CONTENT_TYPES = `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`

export async function writeXlsx(rows: string[][], layout: XlsxLayout): Promise<Bytes> {
  const cols = layout.widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("")
  const sheetData = rows
    .map((row, r) => {
      const style = r === 0 ? HEADER_STYLE : BODY_STYLE
      const cells = row
        .map((value, c) => {
          const ref = `${columnName(c)}${r + 1}`
          return value === ""
            ? `<c r="${ref}" s="${style}"/>`
            : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeText(value)}</t></is></c>`
        })
        .join("")
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join("")

  const sheet = `${DECLARATION}<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${sheetData}</sheetData></worksheet>`

  return createZip([
    { name: "[Content_Types].xml", data: CONTENT_TYPES },
    {
      name: "_rels/.rels",
      data: `${DECLARATION}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `${DECLARATION}<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets><sheet name="${escapeAttr(sheetNameOf(layout.sheetName))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `${DECLARATION}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${REL}/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", data: STYLES },
    { name: "xl/worksheets/sheet1.xml", data: sheet },
  ])
}

/* ------------------------------------------------------------------ reading */

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }

/** XML text to characters: line ends, entities, then OOXML's `_xHHHH_` escapes. */
function decodeXml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos));/g, (_, dec, hex, name) =>
      dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : NAMED[name]
    )
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function attr(attrs: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs)
  return match ? decodeXml(match[1] ?? match[2]) : undefined
}

/** Every `<t>` of a string item or inline string, without the phonetic guides of `<rPh>`. */
function textOf(xml: string): string {
  return [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*?(?:\/>|>([\s\S]*?)<\/t>)/g)]
    .map((match) => decodeXml(match[1] ?? ""))
    .join("")
}

function sharedStringsOf(xml: string): string[] {
  return [...xml.matchAll(/<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g)].map((match) => textOf(match[1] ?? ""))
}

function columnIndex(ref: string): number {
  const letters = /^[A-Za-z]+/.exec(ref)?.[0].toUpperCase() ?? "A"
  return [...letters].reduce((sum, char) => sum * 26 + (char.charCodeAt(0) - 64), 0) - 1
}

function cellValue(type: string | undefined, inner: string, shared: string[]): string {
  const raw = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1]
  const value = raw === undefined ? "" : decodeXml(raw)
  switch (type) {
    case "s":
      return shared[Number(value)] ?? ""
    case "inlineStr":
      return textOf(/<is\b[^>]*>([\s\S]*?)<\/is>/.exec(inner)?.[1] ?? "")
    case "b":
      return value === "1" ? "TRUE" : "FALSE"
    case "e":
      return ""
    default:
      return value
  }
}

function gridOf(xml: string, shared: string[]): string[][] {
  const rows: string[][] = []
  let nextRow = 0
  for (const row of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const r = attr(row[1], "r")
    const rowIndex = r ? Number(r) - 1 : nextRow
    nextRow = rowIndex + 1
    const cells: string[] = []
    let nextColumn = 0
    for (const cell of (row[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cell[1], "r")
      const column = ref ? columnIndex(ref) : nextColumn
      nextColumn = column + 1
      cells[column] = cellValue(attr(cell[1], "t"), cell[2] ?? "", shared)
    }
    rows[rowIndex] = Array.from(cells, (value) => value ?? "")
  }
  return Array.from(rows, (row) => row ?? [])
}

const partPath = (target: string | undefined) =>
  !target ? null : target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`

/** The first sheet as a grid of strings. Row 1 is `grid[0]`; a missing row is `[]`. */
export async function readXlsx(bytes: Bytes, limits: ZipLimits = DEFAULT_ZIP_LIMITS): Promise<string[][]> {
  const read = async (wanted: (string | null)[]) => {
    const entries = await readZip(bytes, { limits, only: (name) => wanted.includes(name) })
    return (name: string | null) => {
      const data = name ? entries.get(name) : undefined
      return data ? new TextDecoder().decode(data) : null
    }
  }

  const meta = await read(["xl/workbook.xml", "xl/_rels/workbook.xml.rels"])
  const workbook = meta("xl/workbook.xml")
  const rels = meta("xl/_rels/workbook.xml.rels")
  if (!workbook || !rels) {
    throw new XlsxError("This is not an Excel workbook")
  }

  const sheetTag = /<sheet\b([^>]*)\/?>/.exec(workbook)
  const id = sheetTag ? /(?:^|\s)[A-Za-z_][\w.-]*:id\s*=\s*"([^"]*)"/.exec(sheetTag[1])?.[1] : undefined
  if (!id) {
    throw new XlsxError("The workbook has no sheets")
  }

  const relations = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((match) => ({
    id: attr(match[1], "Id"),
    type: attr(match[1], "Type") ?? "",
    target: attr(match[1], "Target"),
  }))
  const sheetPath = partPath(relations.find((relation) => relation.id === id)?.target)
  const sharedPath = partPath(relations.find((relation) => relation.type.endsWith("/sharedStrings"))?.target)

  const parts = await read([sheetPath, sharedPath])
  const sheet = parts(sheetPath)
  if (!sheet) {
    throw new XlsxError("The workbook's first sheet is missing")
  }
  return gridOf(sheet, sharedStringsOf(parts(sharedPath) ?? ""))
}
```

- [ ] **Step 5: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS (119 + 4 csv + 6 xlsx = 129); `tsc` sạch.

- [ ] **Step 6: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo 2>/dev/null
git add lib/csv.ts lib/xlsx.ts tests/csv.test.ts tests/xlsx.test.ts
git commit -m "Read and write CSV and Excel sheets without a dependency"
```

---

### Task 3: `lib/sheet.ts` — dựng sheet, đọc file, luật kiểm, kế hoạch lưu, diff

**Files:**
- Create: `lib/sheet.ts`, `tests/sheet.test.ts`
- Modify: `lib/locale-data.ts` (thêm `sameSource`), `lib/bundle-diff.ts` (thêm `keep?: true` vào `DiffEntry`), `lib/api-types.ts` (thêm `SheetRows`, `SheetFormat`)

**Interfaces:**
- Consumes: `readCsv`, `CsvError`, `readXlsx`, `XlsxError` (Task 2); `ZipError`, `type Bytes` (Task 1); `checkTranslation` (`lib/validation.ts`); `fieldsOf`, `templateKeyOf`, `TemplateEntry`, `TemplateChannel` (`lib/template-data.ts`); `displayedValueOf`, `statusLabel`, `languageNames`, `languages`, `SOURCE_LANGUAGE` (`lib/locale-data.ts`); `BundleDiff`, `DiffCounts`, `DiffEntry`, `DiffKind` (`lib/bundle-diff.ts`).
- Produces: `sameSource(a: string, b: string): boolean` (`lib/locale-data.ts`); `type SheetRows = "todo" | "all"`, `type SheetFormat = "xlsx" | "csv"` (`lib/api-types.ts`); từ `lib/sheet.ts`: `class SheetFileError`, `MAX_SHEET_BYTES`, `TODO_STATUSES`, `type SheetRow`, `type ParsedSheet`, `type CheckRules`, `type SheetPlan`, `isTemplateProject(project)`, `translationHeader(code)`, `sheetGridOf(input)`, `sheetWidthsOf(project)`, `parseSheet(grid)`, `isSheetFileName(name)`, `readSheetFile({ name, bytes })`, `checkRulesOf(project, key)`, `planSheet(sheet, rows)`, `diffSheet(rows, plan, options)`, `skippedSummary(skipped, projectName)`.

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/sheet.test.ts`:

```ts
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
    const rows = [row("invite_coach.body", { source: "<p>Hello {name}</p>", target: "", status: "missing" })]
    const plan = planSheet(
      { language: "vi", rows: [{ key: "invite_coach.body", english: "<p>Hello {name}</p>", translation: "<p>Xin chào {name}" }] },
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/sheet.test.ts`
Expected: FAIL — `Cannot find module '@/lib/sheet'`.

- [ ] **Step 3: Thêm `sameSource`, `DiffEntry.keep`, `SheetRows`/`SheetFormat`**

`lib/locale-data.ts` — thêm ngay sau hàm `displayedValueOf`:

```ts
/** English compared the way a sheet round trip needs: line ends and surrounding space do not count. */
export function sameSource(a: string, b: string): boolean {
  const clean = (text: string) => text.replaceAll("\r\n", "\n").trim()
  return clean(a) === clean(b)
}
```

`lib/bundle-diff.ts` — trong `export type DiffEntry = {`, thêm sau dòng `issues: RowIssue[];`:

```ts
  /** A sheet asked to keep the English: shown as such, saved as Keep English. */
  keep?: true;
```

`lib/api-types.ts` — thêm cuối file:

```ts
/** `POST /api/sheet` - which strings a sheet holds. `todo`: missing, outdated or failing a check. */
export type SheetRows = "todo" | "all"

export type SheetFormat = "xlsx" | "csv"
```

- [ ] **Step 4: Viết `lib/sheet.ts`**

```ts
/**
 * A project's strings as a sheet: the rows an Excel or CSV export holds, and
 * how a filled-in sheet becomes a save. The file formats live in `csv.ts` and
 * `xlsx.ts`, which know nothing about keys.
 *
 * See docs/superpowers/specs/2026-09-30-sheet-import-export-design.md.
 */

import type { SheetRows } from "@/lib/api-types"
import type { BundleDiff, DiffCounts, DiffEntry, DiffKind } from "@/lib/bundle-diff"
import { CsvError, readCsv } from "@/lib/csv"
import {
  displayedValueOf,
  languageNames,
  languages,
  sameSource,
  SOURCE_LANGUAGE,
  statusLabel,
  type LanguageCode,
  type TranslationRow,
  type TranslationStatus,
} from "@/lib/locale-data"
import type { Project } from "@/lib/projects"
import { fieldsOf, templateKeyOf, type TemplateChannel, type TemplateEntry } from "@/lib/template-data"
import { checkTranslation } from "@/lib/validation"
import { readXlsx, XlsxError } from "@/lib/xlsx"
import { ZipError, type Bytes } from "@/lib/zip"

export class SheetFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SheetFileError"
  }
}

/** A sheet of a few thousand rows is well under 1 MB; the same cap as the zip reader's. */
export const MAX_SHEET_BYTES = 10 * 1024 * 1024

/** "Strings to translate": what still needs somebody. */
export const TODO_STATUSES: readonly TranslationStatus[] = ["missing", "outdated", "needs_fix"]

export type SheetRow = { key: string; english: string; translation: string }
export type ParsedSheet = { language: LanguageCode; rows: SheetRow[] }

/** The checks one key runs - the same source the store computes status from. */
export type CheckRules = { lengthBudget: number; maxLength?: number; format: "text" | "html" }

export type SheetPlan = {
  /** Written with `saveTranslations`. */
  values: Record<string, string>
  /** Saved as Keep English. */
  keepKeys: string[]
  /** The English each written key was translated from, for the server to check again. */
  sources: Record<string, string>
  skipped: { duplicate: number; unknown: number; empty: number; englishChanged: number }
}

export const isTemplateProject = (project: Project) => project.profile.kind !== "ui"

export const translationHeader = (code: LanguageCode) => `${languageNames[code]} (${code})`

const lineEnds = (text: string) => text.replaceAll("\r\n", "\n")

/* ------------------------------------------------------------------ writing */

export function sheetGridOf({
  project,
  language,
  rows,
  templates,
  scope,
}: {
  project: Project
  language: LanguageCode
  rows: TranslationRow[]
  templates?: TemplateEntry[]
  scope: SheetRows
}): string[][] {
  const wanted = (status: TranslationStatus) => scope === "all" || TODO_STATUSES.includes(status)

  if (isTemplateProject(project)) {
    const labels = new Map(fieldsOf(project.profile.kind as TemplateChannel).map((field) => [field.id, field.label]))
    const grid = [["Key", "Template", "Field", "English", translationHeader(language), "Status"]]
    for (const entry of templates ?? []) {
      for (const field of entry.fields) {
        if (wanted(field.status)) {
          grid.push([
            templateKeyOf(entry.template.id, field.field),
            entry.template.name,
            labels.get(field.field) ?? field.field,
            lineEnds(field.source),
            lineEnds(displayedValueOf(field)),
            statusLabel[field.status],
          ])
        }
      }
    }
    return grid
  }

  const grid = [["Key", "English", translationHeader(language), "Status"]]
  for (const row of rows) {
    if (wanted(row.status)) {
      grid.push([row.key, lineEnds(row.source), lineEnds(displayedValueOf(row)), statusLabel[row.status]])
    }
  }
  return grid
}

export const sheetWidthsOf = (project: Project) =>
  isTemplateProject(project) ? [40, 28, 14, 60, 60, 14] : [40, 60, 60, 14]

/* ------------------------------------------------------------------ reading */

function codeOf(header: string): LanguageCode | null {
  const match = /\(([A-Za-z-]+)\)\s*$/.exec(header.trim())
  if (!match) {
    return null
  }
  return languages.find((item) => item.code.toLowerCase() === match[1].toLowerCase())?.code ?? null
}

/** Columns by header, case and surrounding space ignored; the language only from the translation column. */
export function parseSheet(grid: string[][]): ParsedSheet {
  const [header = [], ...body] = grid
  const names = header.map((cell) => cell.trim().toLowerCase())
  const keyAt = names.indexOf("key")
  if (keyAt < 0) {
    throw new SheetFileError("No Key column")
  }
  const englishAt = names.indexOf("english")
  if (englishAt < 0) {
    throw new SheetFileError("No English column")
  }
  const translations = header
    .map((cell, index) => ({ index, code: codeOf(cell) }))
    .filter((item): item is { index: number; code: LanguageCode } => item.code !== null)
  if (translations.length === 0) {
    throw new SheetFileError('No translation column (a header like "Vietnamese (vi)")')
  }
  if (translations.length > 1) {
    throw new SheetFileError("More than one translation column")
  }
  const [{ index: translationAt, code: language }] = translations
  if (language === SOURCE_LANGUAGE) {
    throw new SheetFileError("Sheets carry translations; English is not imported from a sheet")
  }

  const rows = body
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map((cells) => ({
      key: (cells[keyAt] ?? "").trim(),
      english: cells[englishAt] ?? "",
      translation: lineEnds(cells[translationAt] ?? ""),
    }))
  if (rows.length === 0) {
    throw new SheetFileError("The sheet has no rows")
  }
  return { language, rows }
}

export const isSheetFileName = (name: string) => /\.(xlsx|csv|xls)$/i.test(name)

/** A dropped file to a sheet, with the reason in the words the wizard shows. */
export async function readSheetFile({ name, bytes }: { name: string; bytes: Bytes }): Promise<ParsedSheet> {
  const lower = name.toLowerCase()
  if (lower.endsWith(".xls")) {
    throw new SheetFileError("Save it as .xlsx and try again")
  }
  if (bytes.length > MAX_SHEET_BYTES) {
    throw new SheetFileError("That file is larger than 10 MB")
  }

  if (lower.endsWith(".csv")) {
    let text: string
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    } catch {
      throw new SheetFileError('Save it as "CSV UTF-8" and try again')
    }
    try {
      return parseSheet(readCsv(text))
    } catch (cause: unknown) {
      throw cause instanceof CsvError ? new SheetFileError(cause.message) : cause
    }
  }

  let grid: string[][]
  try {
    grid = await readXlsx(bytes)
  } catch (cause: unknown) {
    if (cause instanceof ZipError && cause.reason === "limit") {
      throw new SheetFileError("That workbook is too large to import")
    }
    if (cause instanceof ZipError || cause instanceof XlsxError) {
      throw new SheetFileError("That file is not a readable Excel workbook")
    }
    throw cause
  }
  return parseSheet(grid)
}

/* ------------------------------------------------------------------ planning */

export function checkRulesOf(project: Project, key: string): CheckRules {
  const base: CheckRules = {
    lengthBudget: project.profile.lengthBudget,
    maxLength: project.profile.maxLength,
    format: "text",
  }
  if (!isTemplateProject(project)) {
    return base
  }
  const fieldId = key.slice(key.lastIndexOf(".") + 1)
  const field = fieldsOf(project.profile.kind as TemplateChannel).find((item) => item.id === fieldId)
  return field ? { lengthBudget: project.profile.lengthBudget, maxLength: field.maxLength, format: field.format } : base
}

/**
 * Spec §3.4, compared with what the screen shows (`displayedValueOf`), not the
 * raw bundle value: a missing copy of the English reads as empty there too.
 * Order: a repeated key, a key the project lacks, an empty cell, an English
 * that moved on - the first row of a key always wins.
 */
export function planSheet(sheet: ParsedSheet, rows: TranslationRow[]): SheetPlan {
  const byKey = new Map(rows.map((row) => [row.key, row]))
  const seen = new Set<string>()
  const plan: SheetPlan = {
    values: {},
    keepKeys: [],
    sources: {},
    skipped: { duplicate: 0, unknown: 0, empty: 0, englishChanged: 0 },
  }

  for (const item of sheet.rows) {
    if (seen.has(item.key)) {
      plan.skipped.duplicate += 1
      continue
    }
    seen.add(item.key)
    const row = byKey.get(item.key)
    if (!row) {
      plan.skipped.unknown += 1
      continue
    }
    if (item.translation.trim() === "") {
      plan.skipped.empty += 1
      continue
    }
    if (!sameSource(item.english, row.source)) {
      plan.skipped.englishChanged += 1
      continue
    }
    if (sameSource(item.translation, row.source)) {
      const alreadyKept = row.keptSource && row.status !== "outdated" && sameSource(row.target, row.source)
      if (!alreadyKept) {
        plan.keepKeys.push(row.key)
        plan.sources[row.key] = row.source
      }
      continue
    }
    if (item.translation !== lineEnds(displayedValueOf(row))) {
      plan.values[row.key] = item.translation
      plan.sources[row.key] = row.source
    }
  }
  return plan
}

/** The preview of a plan, in the shape the diff view already renders. */
export function diffSheet(
  rows: TranslationRow[],
  plan: SheetPlan,
  { language, rulesOf }: { language: LanguageCode; rulesOf: (key: string) => CheckRules }
): BundleDiff {
  const counts: DiffCounts = { new: 0, added: 0, changed: 0, removed: 0, unchanged: 0 }
  const keeps = new Set(plan.keepKeys)
  const entries: DiffEntry[] = []
  let errors = 0

  for (const row of rows) {
    const before = displayedValueOf(row)
    const isKeep = keeps.has(row.key)
    const after = isKeep ? row.source : Object.hasOwn(plan.values, row.key) ? plan.values[row.key] : before
    const kind: DiffKind = !isKeep && after === before ? "unchanged" : before === "" ? "added" : "changed"
    counts[kind] += 1

    const issues =
      kind !== "unchanged" && !isKeep ? checkTranslation(row.source, after, { language, ...rulesOf(row.key) }) : []
    if (issues.some((issue) => issue.level === "error")) {
      errors += 1
    }
    entries.push({
      key: row.key,
      group: row.group,
      kind,
      before,
      after,
      source: row.source,
      issues,
      ...(isKeep ? { keep: true as const } : {}),
    })
  }
  return { entries, counts, invalid: [], errors }
}

export function skippedSummary(skipped: SheetPlan["skipped"], projectName: string): string | null {
  const parts = [
    skipped.unknown > 0 && `${skipped.unknown} not in ${projectName}`,
    skipped.englishChanged > 0 && `${skipped.englishChanged} English changed since download`,
    skipped.empty > 0 && `${skipped.empty} empty`,
    skipped.duplicate > 0 && `${skipped.duplicate} duplicate`,
  ].filter((part): part is string => Boolean(part))
  return parts.length > 0 ? parts.join(" · ") : null
}
```

- [ ] **Step 5: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS (129 + 12 = 141); `tsc` sạch. Nếu test "saves what changed…" lệch, đối chiếu từng key với bảng spec §3.4 trước khi đổi code — không đổi test cho khớp code.

- [ ] **Step 6: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo 2>/dev/null
git add lib/sheet.ts lib/locale-data.ts lib/bundle-diff.ts lib/api-types.ts tests/sheet.test.ts
git commit -m "Turn project strings into sheets and filled-in sheets into a checked save"
```

---

### Task 4: Hợp đồng HTTP — `POST /sheet`, `sources`/`stale`, quyền `exchangeSheets`

**Files:**
- Modify: `lib/api-types.ts`, `mock/store.ts`, `mock/router.ts`, `lib/api.ts`, `lib/roles.ts`, `tests/router.test.ts`, `tests/roles.test.ts`

**Interfaces:**
- Consumes: `sheetGridOf`, `sheetWidthsOf`, `isTemplateProject` (Task 3); `writeCsv` (Task 2); `writeXlsx` (Task 2); `sameSource` (Task 3); `readXlsx`, `readCsv` (test).
- Produces: `type SheetExportRequest = { target: string; language: LanguageCode; rows: SheetRows; format: SheetFormat; name: string }`; `SaveTranslationsRequest.sources?: Record<string, string>`; `SaveTranslationsResponse.stale: string[]`; `exportSheet(input: SheetExportRequest): Promise<{ blob: Blob; filename: string }>`; `saveTranslations(target, lang, values, keep = [], sources?)`; `Capabilities.exchangeSheets` (developer ✓, translator ✓).

- [ ] **Step 1: Viết test (sẽ fail)**

`tests/roles.test.ts`: trong `describe("capabilitiesOf")`, thêm `exchangeSheets: true,` vào **cả hai** object mong đợi (sau `manageApps: …`) và đổi tên test của translator thành `"gives the translator sheets only - translating is not a capability"`.

`tests/router.test.ts`: thêm `SaveTranslationsResponse,` vào `import type { … } from "@/lib/api-types"`; thêm các import:

```ts
import { readCsv } from "@/lib/csv"
import { readXlsx } from "@/lib/xlsx"
import type { Bytes } from "@/lib/zip"
```

và thêm cuối file:

```ts
describe("sheets", () => {
  const base = { target: SCHOOL, language: "vi", rows: "todo", format: "xlsx", name: "school-portal.vi" }

  async function sheet(input: Record<string, unknown>) {
    const response = await call(store, "POST", "/sheet", input)
    return { response, bytes: new Uint8Array(await response.arrayBuffer()) as Bytes }
  }

  it("exports the strings to translate, or all of them", async () => {
    const todo = await sheet(base)
    expect(todo.response.headers.get("content-type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    expect(todo.response.headers.get("content-disposition")).toContain('filename="school-portal.vi.xlsx"')
    const grid = await readXlsx(todo.bytes)
    expect(grid[0]).toEqual(["Key", "English", "Vietnamese (vi)", "Status"])
    expect(grid).toHaveLength(1 + 7)

    const all = await sheet({ ...base, rows: "all", format: "csv" })
    expect(all.response.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(readCsv(new TextDecoder().decode(all.bytes))).toHaveLength(1 + 500)
  })

  it("exports a template channel with its template and field columns", async () => {
    const target = { ...base, target: "messages/email", format: "csv", name: "email.vi" }
    const all = readCsv(new TextDecoder().decode((await sheet({ ...target, rows: "all" })).bytes))
    expect(all[0]).toEqual(["Key", "Template", "Field", "English", "Vietnamese (vi)", "Status"])
    expect(all).toHaveLength(1 + 40)
    const todo = readCsv(new TextDecoder().decode((await sheet(target)).bytes))
    expect(todo.slice(1).map((row) => row[0])).toEqual(["visitation_scheduled.body"])
  })

  it("rejects what it cannot export", async () => {
    expect((await callJson<ApiErrorBody>(store, "POST", "/sheet", { ...base, target: "web/nope" })).status).toBe(404)
    const cases: [Record<string, string>, string][] = [
      [{ language: "xx" }, 'Unknown language "xx"'],
      [{ language: "en" }, "Sheets carry translations; pick a language other than English"],
      [{ rows: "some" }, 'Expected "rows" to be "todo" or "all"'],
      [{ format: "xls" }, 'Expected "format" to be "xlsx" or "csv"'],
    ]
    for (const [patch, message] of cases) {
      const { status, body } = await callJson<ApiErrorBody>(store, "POST", "/sheet", { ...base, ...patch })
      expect(status).toBe(400)
      expect(body.error).toBe(message)
    }
  })
})

describe("saving with the English it was translated from", () => {
  it("skips a key whose English changed since, and saves the rest", async () => {
    const cancelBefore = (await rowOf(SCHOOL, "vi", CANCEL))!.source
    const copySource = (await rowOf(SCHOOL, "vi", COPY))!.source
    await call(store, "PUT", `/translations/en?target=${SCHOOL}`, { values: { [CANCEL]: "Cancel it" }, by: "T" })

    const { body } = await callJson<SaveTranslationsResponse>(store, "PUT", `/translations/vi?target=${SCHOOL}`, {
      values: { [CANCEL]: "Hủy nhé", [COPY]: "GrapeSEED VN" },
      sources: { [CANCEL]: cancelBefore, [COPY]: copySource },
      by: "T",
    })

    expect(body.stale).toEqual([CANCEL])
    expect(body.saved).toBe(1)
    expect((await rowOf(SCHOOL, "vi", CANCEL))?.target).not.toBe("Hủy nhé")
    expect((await rowOf(SCHOOL, "vi", COPY))?.target).toBe("GrapeSEED VN")
  })

  it("keeps the old behaviour without sources, and rejects sources that are not text", async () => {
    const { body } = await callJson<SaveTranslationsResponse>(store, "PUT", `/translations/vi?target=${SCHOOL}`, {
      values: { [CANCEL]: "Hủy" },
      by: "T",
    })
    expect(body.stale).toEqual([])

    const bad = await callJson<ApiErrorBody>(store, "PUT", `/translations/vi?target=${SCHOOL}`, {
      values: {},
      sources: { [CANCEL]: 3 },
    })
    expect(bad.status).toBe(400)
    expect(bad.body.error).toBe('Expected "sources" to be an object of key: English text')
  })
})
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `npx vitest run tests/router.test.ts tests/roles.test.ts`
Expected: FAIL — `describe("sheets")` nhận 404 `No route for POST /sheet`; `stale` là `undefined`; `roles` thiếu `exchangeSheets`.

- [ ] **Step 3: `lib/api-types.ts`**

- Trong `SaveTranslationsRequest`, thêm sau `keep?: string[]` (và chú thích của nó):

```ts
  /**
   * The English each value was translated from. A key whose English has
   * changed since is neither written nor kept, and comes back in `stale`.
   */
  sources?: Record<string, string>
```

- Trong `SaveTranslationsResponse`, thêm sau `file: string`:

```ts
  /** Keys skipped because their English changed since `sources` - always present, empty without it. */
  stale: string[]
```

- Thêm cuối file (sau `SheetFormat`):

```ts
export type SheetExportRequest = {
  target: string
  /** Any language but English. */
  language: LanguageCode
  rows: SheetRows
  format: SheetFormat
  /** File name without the extension; the server sanitises it. */
  name: string
}
```

- [ ] **Step 4: `mock/store.ts` — `saveTranslations` nhận `sources`**

Thêm `sameSource,` vào khối import từ `"../lib/locale-data"`. Thay toàn bộ method `saveTranslations(` … `},` (tới trước chú thích `/** Replaces one app's language file…`) bằng:

```ts
    saveTranslations(
      target: string,
      code: string,
      values: Record<string, string>,
      keep: string[],
      by: string,
      sources?: Record<string, string>,
    ): SaveTranslationsResponse {
      const language = languageOf(code);
      const isSource = language === SOURCE_LANGUAGE;
      const source = bundle(target, SOURCE_LANGUAGE);
      const at = new Date().toISOString();

      for (const key of keep) {
        if (key in values) {
          throw new HttpError(400, `"${key}" is both edited and kept as English.`);
        }
        if (isSource) {
          throw new HttpError(400, "English cannot be kept as English.");
        }
        if (!source[key]) {
          throw new HttpError(400, `"${key}" has no English to keep.`);
        }
      }

      // A value written for an English that has since changed would read as
      // up to date. The caller says which English it translated; a key whose
      // English moved on is left alone and reported back.
      const stale = sources
        ? [...Object.keys(values), ...keep].filter(
            (key) => key in sources && !sameSource(sources[key], source[key] ?? ""),
          )
        : [];
      const skip = new Set(stale);
      const keys = Object.keys(values).filter((key) => !skip.has(key));
      const kept = keep.filter((key) => !skip.has(key));

      writeBundle(target, language, {
        ...bundle(target, language),
        ...Object.fromEntries(keys.map((key) => [key, values[key]])),
        ...Object.fromEntries(kept.map((key) => [key, source[key]])),
      });

      const log = { ...auditLog(target, language) };
      for (const key of keys) {
        // Emptying a value puts the row back to untranslated, so its stamp
        // goes with it rather than reading as a translation somebody made.
        if (values[key] === "") {
          delete log[key];
        } else {
          log[key] = isSource ? { by, at } : stampOf(by, at, source[key] ?? "");
        }
      }
      for (const key of kept) {
        log[key] = { ...stampOf(by, at, source[key]), keepSource: true };
      }
      writeAuditLog(target, language, log);

      return {
        saved: keys.length + kept.length,
        file: relativeBundlePath(target, language),
        stale,
      };
    },
```

- [ ] **Step 5: `mock/router.ts` — `POST /sheet`, `sources`, `attachment()`**

1. Import: thêm `SheetExportRequest,` vào khối `import type { … } from "../lib/api-types"`, và thêm sau `import { safeFileName } from "../lib/file-name"`:

```ts
import { writeCsv } from "../lib/csv"
import { languages, SOURCE_LANGUAGE } from "../lib/locale-data"
import { findProjectByTarget, targetOf } from "../lib/projects"
import { isTemplateProject, sheetGridOf, sheetWidthsOf } from "../lib/sheet"
import { writeXlsx } from "../lib/xlsx"
```

2. Danh sách route trong chú thích đầu file: thêm sau dòng `POST   /export …`:

```
 *   POST   /sheet                    one app in one language as .xlsx or .csv
```

3. Route translations: sau khối kiểm `keep` (`throw new HttpError(400, \`Expected "keep" to be a list of keys\`)` và `}` của nó), thêm:

```ts
    if (
      input.sources !== undefined &&
      (typeof input.sources !== "object" ||
        input.sources === null ||
        Array.isArray(input.sources) ||
        Object.values(input.sources).some((value) => typeof value !== "string"))
    ) {
      throw new HttpError(400, `Expected "sources" to be an object of key: English text`)
    }
```

   và trong lời gọi `store.saveTranslations(…)`, thêm đối số thứ sáu `input.sources` sau `author(input.by)`.

4. Ngay trước khối `if (method === "GET" && path === "/coverage") {`, thêm:

```ts
  if (method === "POST" && path === "/sheet") {
    const input = await body<SheetExportRequest>(request)
    const project = findProjectByTarget(input.target ?? "")
    if (!project) {
      throw new HttpError(404, `Unknown project "${input.target}"`)
    }
    if (!languages.some((item) => item.code === input.language)) {
      throw new HttpError(400, `Unknown language "${input.language}"`)
    }
    if (input.language === SOURCE_LANGUAGE) {
      throw new HttpError(400, "Sheets carry translations; pick a language other than English")
    }
    if (input.rows !== "todo" && input.rows !== "all") {
      throw new HttpError(400, `Expected "rows" to be "todo" or "all"`)
    }
    if (input.format !== "xlsx" && input.format !== "csv") {
      throw new HttpError(400, `Expected "format" to be "xlsx" or "csv"`)
    }

    const target = targetOf(project)
    const grid = sheetGridOf({
      project,
      language: input.language,
      rows: store.entries(target, input.language).entries,
      templates: isTemplateProject(project) ? store.templates(target, input.language).templates : undefined,
      scope: input.rows,
    })
    const name = safeFileName(input.name ?? "", `${project.id}.${input.language}`)

    if (input.format === "csv") {
      return attachment(`${name}.csv`, "text/csv; charset=utf-8", new TextEncoder().encode(writeCsv(grid)) as Bytes)
    }
    return attachment(
      `${name}.xlsx`,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      await writeXlsx(grid, { sheetName: `${project.name} · ${input.language}`, widths: sheetWidthsOf(project) })
    )
  }
```

5. Thay hàm `function zip(filename: string, data: Bytes): Response {` … `}` bằng:

```ts
function zip(filename: string, data: Bytes): Response {
  return attachment(filename, "application/zip", data)
}

function attachment(filename: string, contentType: string, data: Bytes): Response {
  return new Response(data, {
    status: 200,
    headers: {
      "content-type": contentType,
      // The browser reads the download name from here, so the name typed into
      // the export dialog survives the round trip.
      //
      // Two forms, per RFC 6266: header values are latin1, and Node throws on
      // anything outside it, so a Vietnamese name can only travel
      // percent-encoded in `filename*`. `filename` carries an ASCII fallback
      // for clients that do not read the starred form.
      "content-disposition": [
        "attachment",
        `filename="${filename.replaceAll(/[^ -~]/g, "_")}"`,
        `filename*=UTF-8''${encodeURIComponent(filename)}`,
      ].join("; "),
    },
  })
}
```
- [ ] **Step 6: `lib/api.ts` và `lib/roles.ts`**

`lib/api.ts`:
- Thêm `SheetExportRequest,` vào khối import type.
- Thay `saveTranslations` bằng:

```ts
export function saveTranslations(
  target: string,
  lang: LanguageCode,
  values: Record<string, string>,
  keep: string[] = [],
  sources?: Record<string, string>
) {
  return request<SaveTranslationsResponse>(`/translations/${lang}?${query({ target })}`, {
    method: "PUT",
    body: JSON.stringify({ values, keep, sources, by: currentUser.name } satisfies SaveTranslationsRequest),
  })
}
```

- Thay `exportBundle` bằng (tách phần đọc tên file ra dùng chung):

```ts
function filenameOf(response: Response, fallback: string) {
  const disposition = response.headers.get("content-disposition") ?? ""
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
  const plain = /filename="([^"]+)"/.exec(disposition)
  return encoded ? decodeURIComponent(encoded[1]) : (plain?.[1] ?? fallback)
}

export async function exportBundle(input: ExportRequest) {
  const response = await send("/export", { method: "POST", body: JSON.stringify(input) })
  return { blob: await response.blob(), filename: filenameOf(response, "translations.zip") }
}

export async function exportSheet(input: SheetExportRequest) {
  const response = await send("/sheet", { method: "POST", body: JSON.stringify(input) })
  return { blob: await response.blob(), filename: filenameOf(response, `${input.name}.${input.format}`) }
}
```

`lib/roles.ts`:
- Trong `type Capabilities`, thêm sau `exchangeBundles: boolean`:

```ts
  /** Download and upload Excel/CSV sheets of translations. */
  exchangeSheets: boolean
```

- Trong `capabilities`, thêm `exchangeSheets: true,` vào cả `developer` và `translator` (sau `exchangeBundles: …`).

- [ ] **Step 7: Chạy gate**

Run: `npm test && npm run typecheck`
Expected: PASS (141 + 5 = 146); `tsc` sạch. `tsc` sẽ chỉ ra mọi chỗ khác đọc `SaveTranslationsResponse` hoặc tạo `Capabilities` — sửa theo kiểu mới, không nới kiểu.

- [ ] **Step 8: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo 2>/dev/null
git add lib/api-types.ts mock/store.ts mock/router.ts lib/api.ts lib/roles.ts tests/router.test.ts tests/roles.test.ts
git commit -m "Serve sheets, check the English a save was translated from, and let both views exchange sheets"
```

---

### Task 5: Export — dialog chọn định dạng, form sheet, quyền hiển thị

**Files:**
- Create: `components/translations/sheet-export-form.tsx`, `<scratchpad>/cdp-pointer.mjs`, `<scratchpad>/steps-sheet-export.txt`
- Modify: `components/translations/export-dialog.tsx`, `components/button-styles.ts`, `components/workspace-header.tsx`, `components/app-sidebar.tsx`, `components/translation-workspace.tsx`, `components/templates/template-workspace.tsx`

**Interfaces:**
- Consumes: `exportSheet`, `download`, `messageOf` (Task 4); `SheetFormat`, `SheetRows` (Task 3); `TODO_STATUSES` (Task 3); `useRole()`; `useCoverage()`; `useTranslationRows(target, language, revision)`.
- Produces: `SheetExportForm({ project, language, format, onDone })`; `ExportDialog` (props không đổi) với lựa chọn định dạng; `pillButton`, `pillIdle`, `pillActive` trong `components/button-styles.ts`.

- [ ] **Step 1: Driver chuột thật `cdp-pointer.mjs`**

`<scratchpad>/cdp-pointer.mjs`:

```js
// Steps driver with a real pointer. Steps (JS snippets separated by `---` lines) run in the page with
// the helpers below. `realClick(el)` first checks that `el` is what a pointer at its centre would hit
// (throws "covered by ..." otherwise), then presses the mouse there through Input.dispatchMouseEvent,
// so stacking and hit testing apply as they do for a person.
import { spawn } from "node:child_process"
import { readFileSync } from "node:fs"
import { setTimeout as sleep } from "node:timers/promises"

const [, , profile, url, stepsFile] = process.argv
const port = 9300 + Math.floor(Math.random() * 500)
const chrome = spawn("C:/Program Files/Google/Chrome/Application/chrome.exe", [
  "--headless=new", "--disable-gpu", "--no-first-run", `--user-data-dir=${profile}`,
  `--remote-debugging-port=${port}`, "--window-size=1400,1000", "about:blank",
], { stdio: "ignore" })

let ws
try {
  let target
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(200)
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page") } catch {}
  }
  ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener("open", r, { once: true }))
  let id = 0
  const pending = new Map()
  const errors = []
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
  ws.addEventListener("message", async (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) errors.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300)}`)
    if (msg.method === "Runtime.exceptionThrown") errors.push(`exception: ${msg.params.exceptionDetails.exception?.description?.slice(0, 300)}`)
    if (msg.method === "Runtime.bindingCalled" && msg.params.name === "__pointer") {
      const { id: clickId, x, y } = JSON.parse(msg.params.payload)
      for (const type of ["mouseMoved", "mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 })
      await send("Runtime.evaluate", { expression: `window.__pointerDone = ${JSON.stringify(clickId)}` })
    }
  })
  const evaluate = async (expression) => {
    const res = await send("Runtime.evaluate", { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true })
    return res.result?.result?.value ?? res.result?.exceptionDetails?.exception?.description
  }
  await send("Runtime.enable")
  await send("Page.enable")
  await send("Runtime.addBinding", { name: "__pointer" })
  await send("Page.navigate", { url })
  const steps = readFileSync(stepsFile, "utf8").split(/^---$/m).map((s) => s.trim()).filter(Boolean)
  const helpers = `
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const text = () => document.body.innerText;
    const until = async (fn, ms = 15000) => { const end = Date.now() + ms; while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(100) } return null };
    const byText = (sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === t || e.textContent.trim().startsWith(t));
    const click = (el) => { if (!el) throw new Error("no element"); el.click() };
    const field = (key) => document.querySelector('[aria-label="Translation for ' + key + '"]');
    const realClick = async (el) => {
      if (!el) throw new Error("no element");
      el.scrollIntoView({ block: "center" }); await sleep(80);
      const r = el.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2;
      const top = document.elementFromPoint(x, y);
      if (!top || !(top === el || el.contains(top))) throw new Error("covered by " + (top ? top.tagName + "." + String(top.className).slice(0, 50) : "nothing"));
      const id = String(Math.random()); window.__pointer(JSON.stringify({ id, x, y }));
      if (!(await until(() => window.__pointerDone === id, 5000))) throw new Error("pointer did not answer");
      await sleep(150);
    };
    const captureDownloads = () => {
      window.__downloads = [];
      if (!window.__captured) {
        window.__captured = true;
        const create = URL.createObjectURL.bind(URL);
        URL.createObjectURL = (blob) => { window.__downloads.push(blob); return create(blob) };
        HTMLAnchorElement.prototype.click = function () { if (this.download) window.__downloadName = this.download };
      }
    };
    const dropFiles = (files) => { const dt = new DataTransfer(); for (const f of files) dt.items.add(f); document.querySelector("main .border-dashed").dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true })) };
    const viewAs = async (name) => { await realClick([...document.querySelectorAll("header button")].find((b) => b.innerText.includes("Logan Le"))); await realClick([...document.querySelectorAll("header button")].find((b) => b.textContent.startsWith(name) && b.hasAttribute("aria-pressed"))); await sleep(1200) };
    const dialog = () => document.querySelector('[role="dialog"]');
    const pressed = (group) => [...dialog().querySelectorAll('[aria-label="' + group + '"] button')].map((b) => b.textContent.trim() + (b.getAttribute("aria-pressed") === "true" ? "*" : ""));
  `
  for (const step of steps) console.log(JSON.stringify(await evaluate(helpers + step)))
  if (errors.length) console.log("CONSOLE:\n" + errors.join("\n"))
} finally { ws?.close(); chrome.kill() }
```

- [ ] **Step 2: Viết script kiểm tra Export và chạy (sẽ fail)**

`<scratchpad>/steps-sheet-export.txt`:

```text
await until(() => document.querySelector('[aria-label^="Translation for "]') && Object.keys(document.querySelector("header button") ?? {}).some((k) => k.startsWith("__react")), 30000); await sleep(500)
captureDownloads()
await viewAs("Translator")
await realClick([...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Export"))
await until(() => dialog(), 10000); await sleep(300)
const formats = pressed("Format"); const rows = pressed("Rows"); const name = dialog().querySelector("#sheet-name").value
await realClick([...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === "Download"))
await until(() => window.__downloads.length === 1, 10000)
const blob = window.__downloads[0]
const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer())
const toast = await until(() => text().match(/Exported [^\n]*/)?.[0], 5000)
return { formats, rows, name, file: window.__downloadName, type: blob.type, zip: head[0] === 0x50 && head[1] === 0x4b, toast, closed: !dialog() }
---
captureDownloads()
await realClick([...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Export"))
await until(() => dialog(), 10000); await sleep(300)
await realClick([...dialog().querySelectorAll('[aria-label="Format"] button')].find((b) => b.textContent.trim() === "CSV"))
await realClick([...dialog().querySelectorAll('[aria-label="Rows"] button')].find((b) => b.textContent.startsWith("All strings")))
await realClick([...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === "Download"))
await until(() => window.__downloads.length === 1, 10000)
const csv = await window.__downloads[0].text()
const lines = csv.split("\r\n").filter(Boolean)
return { file: window.__downloadName, bom: csv.charCodeAt(0) === 0xfeff, header: lines[0].replace("\uFEFF", ""), lines: lines.length }
---
location.href = "/messages/email?lang=vi"; await sleep(500)
---
await until(() => document.querySelectorAll("main tbody tr").length > 0 && Object.keys(document.querySelector("main tbody tr") ?? {}).some((k) => k.startsWith("__react")), 30000); await sleep(500)
captureDownloads()
await realClick([...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Export"))
await until(() => dialog(), 10000); await sleep(300)
await realClick([...dialog().querySelectorAll('[aria-label="Format"] button')].find((b) => b.textContent.trim() === "CSV"))
await realClick([...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === "Download"))
await until(() => window.__downloads.length === 1, 10000)
const csv = await window.__downloads[0].text()
return { file: window.__downloadName, lines: csv.split("\r\n").filter(Boolean).map((l) => l.replace("\uFEFF", "").slice(0, 60)) }
---
await viewAs("Developer")
await realClick([...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Export"))
await until(() => dialog(), 10000); await sleep(300)
const devFormats = pressed("Format")
// The modal keeps the pointer from the topbar, so the view changes by script - the way another tab would leave it.
click([...document.querySelectorAll("header button")].find((b) => b.innerText.includes("Logan Le"))); await sleep(300); click(byText("header button", "Translator")); await sleep(1500)
const closed = !dialog()
await realClick([...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Export"))
await until(() => dialog(), 10000); await sleep(300)
return { devFormats, closed, translatorFormats: pressed("Format") }
```

Run (từ `<scratchpad>`): `node cdp-pointer.mjs "<scratchpad>/chrome-sheet-export-red" "http://localhost:3000/web/school-portal?lang=vi" steps-sheet-export.txt`
Expected: bước 1 trả về lỗi (chưa có nút `Export` ở view Translator, hoặc `no element` cho nhóm `Format`) — RED.

- [ ] **Step 3: `components/button-styles.ts` — kiểu nút chọn**

Thêm cuối file:

```ts
/** A choice among a few - format, rows, version. Pair with `pillIdle` or `pillActive`. */
export const pillButton = "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"

export const pillIdle = "border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground"

export const pillActive = "border-primary bg-primary text-primary-foreground"
```

- [ ] **Step 4: `components/translations/sheet-export-form.tsx`**

```tsx
"use client"

import { useState, type FormEvent } from "react"
import { Download } from "lucide-react"
import { toast } from "sonner"

import { pillActive, pillButton, pillIdle } from "@/components/button-styles"
import { Button } from "@/components/ui/button"
import { DialogClose, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCoverage } from "@/hooks/use-coverage"
import { useTranslationRows } from "@/hooks/use-translation-rows"
import { download, exportSheet, messageOf } from "@/lib/api"
import type { SheetFormat, SheetRows } from "@/lib/api-types"
import { languages, SOURCE_LANGUAGE, type LanguageCode } from "@/lib/locale-data"
import { targetOf, type Project } from "@/lib/projects"
import { TODO_STATUSES } from "@/lib/sheet"
import { cn } from "@/lib/utils"

const choices = languages.filter((item) => item.code !== SOURCE_LANGUAGE)

/** One language of one project as a sheet to fill in and import back. */
export function SheetExportForm({
  project,
  language: viewing,
  format,
  onDone,
}: {
  project: Project
  language: LanguageCode
  format: SheetFormat
  onDone: () => void
}) {
  const [language, setLanguage] = useState<LanguageCode>(viewing === SOURCE_LANGUAGE ? choices[0].code : viewing)
  const [scope, setScope] = useState<SheetRows>("todo")
  const [typedName, setTypedName] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const { revision } = useCoverage()
  const { rows, isLoading } = useTranslationRows(targetOf(project), language, revision)

  const todo = rows.filter((row) => TODO_STATUSES.includes(row.status)).length
  const count = scope === "todo" ? todo : rows.length
  const name = typedName ?? `${project.id}.${language}`
  const languageName = choices.find((item) => item.code === language)?.name ?? language
  const shown = (n: number) => (isLoading ? "…" : n.toLocaleString())

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsExporting(true)
    try {
      const { blob, filename } = await exportSheet({
        target: targetOf(project),
        language,
        rows: scope,
        format,
        name: name.replace(/\.(xlsx|csv)$/i, ""),
      })
      download(blob, filename)
      onDone()
      toast.success(`Exported ${filename}`, {
        description: `${count.toLocaleString()} ${count === 1 ? "string" : "strings"} · ${languageName}`,
      })
    } catch (cause: unknown) {
      toast.error("Could not export", { description: messageOf(cause) })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="contents">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sheet-language">Language</Label>
        <select
          id="sheet-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as LanguageCode)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          {choices.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Rows</Label>
        <div role="group" aria-label="Rows" className="flex flex-wrap gap-1.5">
          <button
            type="button"
            aria-pressed={scope === "todo"}
            onClick={() => setScope("todo")}
            className={cn(pillButton, scope === "todo" ? pillActive : pillIdle)}
          >
            Strings to translate ({shown(todo)})
          </button>
          <button
            type="button"
            aria-pressed={scope === "all"}
            onClick={() => setScope("all")}
            className={cn(pillButton, scope === "all" ? pillActive : pillIdle)}
          >
            All strings ({shown(rows.length)})
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sheet-name">File name</Label>
        <div className="flex items-center gap-2">
          <Input
            id="sheet-name"
            value={name}
            onChange={(event) => setTypedName(event.target.value)}
            className="font-mono"
          />
          <span className="font-mono text-sm text-muted-foreground">.{format}</span>
        </div>
      </div>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" disabled={isExporting || isLoading || count === 0}>
          <Download data-icon="inline-start" />
          {isExporting ? "Exporting…" : "Download"}
        </Button>
      </DialogFooter>
    </form>
  )
}
```

- [ ] **Step 5: `components/translations/export-dialog.tsx` — vỏ + định dạng + `BundleExportForm`**

Tái cấu trúc (hành vi JSON không đổi):
1. Đổi tên hàm hiện có `ExportDialog` thành `BundleExportForm`, đổi chữ ký thành `function BundleExportForm({ project, language, onDone }: { project: Project; language: LanguageCode; onDone: () => void })` và bỏ `export`.
2. Trong `BundleExportForm`: xóa hàm `handleOpenChange` (form được mount lại mỗi lần mở dialog, nên state tự về mặc định); trong `handleSubmit`, thay `handleOpenChange(false)` bằng `onDone()`.
3. Trong `return` của `BundleExportForm`: bỏ `<Dialog …>`, `<DialogContent …>` và khối `<DialogHeader>…</DialogHeader>` bao ngoài — chỉ giữ `<form onSubmit={handleSubmit} className="contents">` … `</form>` (các trường và `DialogFooter` bên trong giữ nguyên).
4. Thêm import: `import { useRole } from "@/components/role-provider"`, `import { SheetExportForm } from "@/components/translations/sheet-export-form"`, `import { pillActive, pillButton, pillIdle } from "@/components/button-styles"`, `import type { SheetFormat } from "@/lib/api-types"`, `import { cn } from "@/lib/utils"`.
5. Thêm (trên `BundleExportForm`):

```tsx
type ExportFormat = SheetFormat | "json"

const formatLabel: Record<ExportFormat, string> = { xlsx: "Excel (.xlsx)", csv: "CSV", json: "JSON bundle" }

/**
 * One project out of the app: a JSON bundle of every language for developers,
 * or one language as a sheet to translate. The export is never the current
 * filters.
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
  const { can } = useRole()
  const formats: ExportFormat[] = can.exchangeBundles ? ["xlsx", "csv", "json"] : ["xlsx", "csv"]
  const initial: ExportFormat = can.exchangeBundles ? "json" : "xlsx"
  const [format, setFormat] = useState<ExportFormat>(initial)
  // Each opening starts over: the forms are keyed by it, and the format returns to the default.
  const [session, setSession] = useState(0)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSession((value) => value + 1)
      setFormat(initial)
    }
  }
  const done = () => onOpenChange(false)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export {project.name}</DialogTitle>
          <DialogDescription>
            {format === "json"
              ? "Every key in the project, whatever the filters show."
              : "One language, to translate and import back."}
          </DialogDescription>
        </DialogHeader>

        <div role="group" aria-label="Format" className="flex flex-wrap gap-1.5">
          {formats.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={format === item}
              onClick={() => setFormat(item)}
              className={cn(pillButton, format === item ? pillActive : pillIdle)}
            >
              {formatLabel[item]}
            </button>
          ))}
        </div>

        {format === "json" ? (
          <BundleExportForm key={session} project={project} language={language} onDone={done} />
        ) : (
          <SheetExportForm key={`${session}:${format}`} project={project} language={language} format={format} onDone={done} />
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 6: Quyền hiển thị — header, sidebar, hai workspace**

`components/workspace-header.tsx`: đổi cả hai điều kiện `{canExport && can.exchangeBundles && (` thành `{canExport && (can.exchangeBundles || can.exchangeSheets) && (`.

`components/app-sidebar.tsx`: đổi `{(can.exchangeBundles || can.manageApps) && (` thành `{(can.exchangeBundles || can.exchangeSheets || can.manageApps) && (`, và `{can.exchangeBundles && (` (trước `<Link` của Import files) thành `{(can.exchangeBundles || can.exchangeSheets) && (`.

`components/translation-workspace.tsx`: thay

```tsx
      {hasKeys && can.exchangeBundles && (
        <ExportDialog open={isExportOpen} onOpenChange={setExportOpen} project={project} language={language} />
      )}
```

bằng

```tsx
      {hasKeys && (can.exchangeBundles || can.exchangeSheets) && (
        <ExportDialog
          key={role}
          open={isExportOpen}
          onOpenChange={setExportOpen}
          project={project}
          language={language}
        />
      )}
```

`components/templates/template-workspace.tsx`: thay `{hasTemplates && can.exchangeBundles && (` bằng `{hasTemplates && (can.exchangeBundles || can.exchangeSheets) && (`, và thêm `key={role}` vào `<ExportDialog` bên trong.

- [ ] **Step 7: Gate và kiểm tra Export (GREEN)**

Run: `npm run typecheck && npm test`
Expected: sạch / PASS (146).

Run (từ `<scratchpad>`): `node cdp-pointer.mjs "<scratchpad>/chrome-sheet-export-green" "http://localhost:3000/web/school-portal?lang=vi" steps-sheet-export.txt`
Expected:
1. `formats: ["Excel (.xlsx)*", "CSV"]`, `rows: ["Strings to translate (7)", "All strings (500)"]`, `name: "school-portal.vi"`, `file: "school-portal.vi.xlsx"`, `type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"`, `zip: true`, `toast: "Exported school-portal.vi.xlsx"`, `closed: true`.
2. `file: "school-portal.vi.csv"`, `bom: true`, `header: "Key,English,Vietnamese (vi),Status"`, `lines: 501`.
3. `undefined`
4. `file: "email.vi.csv"`, `lines` có 2 dòng: `"Key,Template,Field,English,Vietnamese (vi),Status"` và một dòng bắt đầu `"visitation_scheduled.body,Visitation scheduled,Body,"`.
5. `devFormats: ["Excel (.xlsx)", "CSV", "JSON bundle*"]`, `closed: true`, `translatorFormats: ["Excel (.xlsx)*", "CSV"]`.

Không dòng nào là `covered by …` (lỗi chồng lớp) hay `no element`.

- [ ] **Step 8: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo 2>/dev/null
git add components/translations/export-dialog.tsx components/translations/sheet-export-form.tsx components/button-styles.ts components/workspace-header.tsx components/app-sidebar.tsx components/translation-workspace.tsx components/templates/template-workspace.tsx
git commit -m "Export one language as an Excel or CSV sheet, from either view"
```

---

### Task 6: Import — sheet trong wizard, client wrapper, kiểm tra toàn bộ

**Files:**
- Create: `components/import/import-page-client.tsx`, `<scratchpad>/steps-sheet-import.txt`
- Modify: `app/(workspace)/import/page.tsx`, `components/import/import-wizard.tsx`, `components/import/file-row.tsx`, `components/import/import-results.tsx`, `components/import/bundle-diff-view.tsx`, `lib/import-plan.ts`, `tests/import-plan.test.ts`

**Interfaces:**
- Consumes: `readSheetFile`, `isSheetFileName`, `SheetFileError`, `planSheet`, `diffSheet`, `checkRulesOf`, `skippedSummary`, `type ParsedSheet`, `type SheetPlan` (Task 3); `saveTranslations(…, sources)` (Task 4); `useRole()`; `RoleGate`.
- Produces: `StagedFile` thêm `kind: "bundle" | "sheet"` và `sheet?: ParsedSheet`; `BlockerState.mixed: boolean`; `ImportResult.sheet: { saved: number; stale: number; file: string } | null`; `ImportPageClient()`.

- [ ] **Step 1: Test `import-plan` (sẽ fail)**

`tests/import-plan.test.ts`:
- Trong helper `file`, thêm `kind: "bundle",` sau `id,`.
- Trong object `ready` của `describe("blockerOf")`, thêm `mixed: false,` sau `fileCount: 2,`.
- Thêm trong `describe("blockerOf")`:

```ts
  it("refuses a batch that mixes JSON files and sheets", () => {
    expect(blockerOf({ ...ready, mixed: true, unassigned: 1 })).toBe("Import JSON files and sheets separately.")
    expect(blockerOf({ ...ready, mixed: true, fileCount: 0 })).toBe("Add at least one file.")
  })
```

Run: `npx vitest run tests/import-plan.test.ts`
Expected: FAIL — lỗi kiểu/`mixed` chưa có; test mới nhận `"1 file has no language yet."`.

- [ ] **Step 2: `lib/import-plan.ts`**

- Thêm `import type { ParsedSheet } from "@/lib/sheet"`.
- Trong `StagedFile`, thêm sau `id: string`:

```ts
  /** A JSON bundle, or an Excel/CSV sheet - see `lib/sheet.ts`. A batch holds one kind. */
  kind: "bundle" | "sheet"
```

   và sau `language: …`:

```ts
  /** The parsed sheet; its language is already `language`. Absent for a bundle. */
  sheet?: ParsedSheet
```

- Trong `BlockerState`, thêm `mixed: boolean` sau `fileCount: number`.
- Trong `blockerOf`, ngay sau khối `if (state.fileCount === 0) { … }`:

```ts
  if (state.mixed) {
    return "Import JSON files and sheets separately."
  }
```

Run: `npx vitest run tests/import-plan.test.ts`
Expected: PASS.

- [ ] **Step 3: `components/import/import-results.tsx`**

- Trong `ImportResult`, thêm sau `response: ImportResponse | null`:

```ts
  /** What a sheet's save did - `stale`: keys whose English changed after the preview. */
  sheet: { saved: number; stale: number; file: string } | null
```

- Thay khối `{result.response ? ( … ) : ( … )}` bằng:

```tsx
            {result.response ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {result.response.created} created · {result.response.added} added · {result.response.changed} changed ·{" "}
                {result.response.removed} cleared → <span className="font-mono">{result.response.file}</span>
              </span>
            ) : result.sheet ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {result.sheet.saved} saved → <span className="font-mono">{result.sheet.file}</span>
                {result.sheet.stale > 0 && ` · ${result.sheet.stale} skipped - English changed since the preview`}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertTriangle className="size-3.5 shrink-0" />
                {result.error}
              </span>
            )}
```

- [ ] **Step 4: `components/import/bundle-diff-view.tsx` — nhãn Keep English**

Trong `Hunk`, ngay sau `<span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium", kindTone[entry.kind])}>{kindLabel[entry.kind]}</span>` (khối nhãn loại), thêm:

```tsx
        {entry.keep && (
          <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            Keep English
          </span>
        )}
```

- [ ] **Step 5: `components/import/file-row.tsx` — dòng file của sheet**

- Đổi import lucide thành `import { AlertTriangle, FileJson, FileSpreadsheet, X } from "lucide-react"`; thêm `import { languageFlags } from "@/lib/language-flags"` và đổi `import type { LanguageCode } from "@/lib/locale-data"` thành `import { languages, type LanguageCode } from "@/lib/locale-data"`.
- Thay `<FileJson className="size-4 shrink-0 text-muted-foreground" />` bằng:

```tsx
        {file.kind === "sheet" ? (
          <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <FileJson className="size-4 shrink-0 text-muted-foreground" />
        )}
```

- Thay nội dung nhãn số key `{Object.keys(file.values).length.toLocaleString()} keys` bằng:

```tsx
          {file.kind === "sheet"
            ? `Sheet · ${(file.sheet?.rows.length ?? 0).toLocaleString()} rows`
            : `${Object.keys(file.values).length.toLocaleString()} keys`}
```

- Thay `<LanguagePicker value={file.language} invalid={isDuplicate} onChange={onAssign} />` bằng:

```tsx
      {file.kind === "sheet" ? (
        // A sheet names its language in its own header - nothing to pick.
        <span
          aria-invalid={isDuplicate || undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-input px-2.5 py-1 text-xs",
            isDuplicate && "border-destructive text-destructive"
          )}
        >
          <span className="leading-none">{file.language ? languageFlags[file.language] : ""}</span>
          {languages.find((item) => item.code === file.language)?.name}
        </span>
      ) : (
        <LanguagePicker value={file.language} invalid={isDuplicate} onChange={onAssign} />
      )}
```

- [ ] **Step 6: `components/import/import-wizard.tsx` — nhận sheet**

1. Import: thêm `import { useRole } from "@/components/role-provider"`; đổi `import { deleteKeys, importBundle, messageOf } from "@/lib/api"` thành `import { deleteKeys, importBundle, messageOf, saveTranslations } from "@/lib/api"`; thêm

```ts
import {
  checkRulesOf,
  diffSheet,
  isSheetFileName,
  planSheet,
  readSheetFile,
  SheetFileError,
  skippedSummary,
  type SheetPlan,
} from "@/lib/sheet"
import type { Bytes } from "@/lib/zip"
```

2. Sau `const { drafts, update } = useDrafts()`:

```ts
  const { can } = useRole()
```

3. Thay khối `const diffs = useMemo(() => { … }, [files, bundles.rows, mode, project])` bằng:

```ts
  const hasSheets = files.some((file) => file.kind === "sheet")
  const hasBundles = files.some((file) => file.kind === "bundle")
  // A sheet only ever fills in translations, and a view without bundles never replaces.
  const effectiveMode: ImportMode = hasSheets || !can.exchangeBundles ? "merge" : mode

  const plans = useMemo(() => {
    const out = new Map<string, SheetPlan>()
    for (const file of files) {
      const rows = file.language ? bundles.rows.get(file.language) : undefined
      if (file.kind === "sheet" && file.sheet && rows) {
        out.set(file.id, planSheet(file.sheet, rows))
      }
    }
    return out
  }, [files, bundles.rows])

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
      const plan = plans.get(file.id)
      out.set(
        file.id,
        file.kind === "sheet" && plan
          ? diffSheet(rows, plan, { language: file.language, rulesOf: (key) => checkRulesOf(project, key) })
          : diffBundle(rows, file.values, {
              mode: effectiveMode,
              language: file.language,
              lengthBudget: project.profile.lengthBudget,
              maxLength: project.profile.maxLength,
            })
      )
    }
    return out
  }, [files, bundles.rows, effectiveMode, project, plans])
```

4. Đổi `retiredKeys(mode, …)` thành `retiredKeys(effectiveMode, …)` (và mảng phụ thuộc `[mode, …]` thành `[effectiveMode, …]`).
5. Trong `blockerOf({ … })`, thêm `mixed: hasSheets && hasBundles,` sau `fileCount: files.length,`.
6. Thay thân vòng lặp trong `readFiles` (khối `try { added.push({ … }) } catch …`) bằng:

```ts
      try {
        if (isSheetFileName(file.name)) {
          const sheet = await readSheetFile({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) as Bytes })
          added.push({
            id: `file-${(fileSeq.current += 1)}`,
            kind: "sheet",
            name: file.name,
            values: {},
            sheet,
            language: sheet.language,
          })
        } else if (!can.exchangeBundles) {
          failed.push(`${file.name} - JSON bundles are imported in the developer view`)
        } else {
          added.push({
            id: `file-${(fileSeq.current += 1)}`,
            kind: "bundle",
            name: file.name,
            values: parseBundleFile(await file.text()),
            language: languageFromName(file.name),
          })
        }
      } catch (cause: unknown) {
        failed.push(
          `${file.name} - ${cause instanceof BundleFileError || cause instanceof SheetFileError ? cause.message : messageOf(cause)}`
        )
      }
```

7. Trong `handleImport`, thay khối `try { const response = await importBundle(…) … } catch (cause: unknown) { done.push({ … }) }` bằng:

```ts
      try {
        const rows = bundles.rows.get(file.language)
        if (file.kind === "sheet" && file.sheet && rows) {
          // Planned again from the latest values; the server still checks each English (`sources`).
          const plan = planSheet(file.sheet, rows)
          const saved = await saveTranslations(target, file.language, plan.values, plan.keepKeys, plan.sources)
          done.push({
            id: file.id,
            name: file.name,
            language: file.language,
            response: null,
            sheet: { saved: saved.saved, stale: saved.stale.length, file: saved.file },
            error: null,
          })
        } else {
          const response = await importBundle(target, file.language, file.values, effectiveMode)
          done.push({ id: file.id, name: file.name, language: file.language, response, sheet: null, error: null })
        }
      } catch (cause: unknown) {
        done.push({
          id: file.id,
          name: file.name,
          language: file.language,
          response: null,
          sheet: null,
          error: messageOf(cause),
        })
      }
```

   và đổi `afterImport({ mode, …` thành `afterImport({ mode: effectiveMode, …`.
8. Tiêu đề: thay `<h1 className="mt-1 text-2xl font-semibold tracking-tight">Import language files</h1>` bằng

```tsx
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {can.exchangeBundles ? "Import language files" : "Import translations"}
          </h1>
```

9. `accept` của input file: thay `accept="application/json,.json"` bằng

```tsx
            accept={
              can.exchangeBundles
                ? "application/json,.json,.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                : ".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }
```

10. Vùng thả: thay

```tsx
            <p className="text-sm">
              Drop <code className="font-mono text-xs">.json</code> files here
            </p>
            {files.length === 0 && (
```

   bằng

```tsx
            <p className="text-sm">
              {can.exchangeBundles ? "Drop .json, .xlsx or .csv files here" : "Drop .xlsx or .csv files here"}
            </p>
            {files.length === 0 && can.exchangeBundles && (
```

11. Checkbox replace: bọc khối `<Label className="mt-4 flex items-start gap-2 font-normal"> … </Label>` trong `{can.exchangeBundles && !hasSheets && ( … )}`.
12. `DiffForFile`: đổi lời gọi thành `selected && <DiffForFile file={selected} diff={diffs.get(selected.id)} plan={plans.get(selected.id)} projectName={project?.name ?? ""} />`; trong hàm `DiffForFile`, đổi chữ ký thành `function DiffForFile({ file, diff, plan, projectName }: { file: StagedFile; diff: BundleDiff | undefined; plan: SheetPlan | undefined; projectName: string })`, và ngay sau đoạn `<p className="text-xs text-muted-foreground"><code …>{file.name}</code> → {language.name}</p>`, thêm:

```tsx
      {plan && skippedSummary(plan.skipped, projectName) && (
        <p className="text-xs tabular-nums text-muted-foreground">{skippedSummary(plan.skipped, projectName)}</p>
      )}
```

- [ ] **Step 7: Client wrapper cho `/import`**

`components/import/import-page-client.tsx`:

```tsx
"use client"

import { ImportWizard } from "@/components/import/import-wizard"
import { RoleGate } from "@/components/role-gate"
import { useRole } from "@/components/role-provider"

/**
 * The page is a Server Component, so the view is read here. The wizard is keyed
 * by it: changing views drops a staged batch - a JSON file must not carry over
 * into a view that cannot import one.
 */
export function ImportPageClient() {
  const { role } = useRole()
  return (
    <RoleGate capability="exchangeSheets" feature="Import">
      <ImportWizard key={role} />
    </RoleGate>
  )
}
```

`app/(workspace)/import/page.tsx` — thay toàn bộ:

```tsx
import { Suspense } from "react"

import { ImportPageClient } from "@/components/import/import-page-client"

export default function ImportPage() {
  return (
    <Suspense>
      <ImportPageClient />
    </Suspense>
  )
}
```

- [ ] **Step 8: Gate đầy đủ**

Run: `npm run typecheck && npm test && npm run build`
Expected: `tsc` sạch; PASS (146 + 1 = 147); build hoàn tất. Sau đó `git checkout -- next-env.d.ts tsconfig.tsbuildinfo`. Chờ dev server biên dịch lại (tải `http://localhost:3000/import` một lần) trước bước CDP — ngay sau `next build`, lần tải đầu có thể gặp `ChunkLoadError` thoáng qua.

- [ ] **Step 9: Kiểm tra Import bằng chuột thật**

`<scratchpad>/steps-sheet-import.txt`:

```text
await until(() => document.querySelector('[aria-label^="Translation for "]') && Object.keys(document.querySelector("header button") ?? {}).some((k) => k.startsWith("__react")), 30000); await sleep(500)
captureDownloads()
await viewAs("Translator")
await realClick([...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Export")); await until(() => dialog(), 10000); await sleep(300)
await realClick([...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === "Download"))
await until(() => window.__downloads.length === 1, 10000)
const bytes = new Uint8Array(await window.__downloads[0].arrayBuffer()); let bin = ""; for (const b of bytes) bin += String.fromCharCode(b)
sessionStorage.setItem("xlsx", btoa(bin))
captureDownloads()
await realClick([...document.querySelectorAll("main button")].find((b) => b.textContent.trim() === "Export")); await until(() => dialog(), 10000); await sleep(300)
await realClick([...dialog().querySelectorAll('[aria-label="Format"] button')].find((b) => b.textContent.trim() === "CSV"))
await realClick([...dialog().querySelectorAll("button")].find((b) => b.textContent.trim() === "Download"))
await until(() => window.__downloads.length === 1, 10000)
const lines = (await window.__downloads[0].text()).replace("\uFEFF", "").split("\r\n").filter(Boolean)
const line = lines.find((l) => l.endsWith(",,Missing"))
sessionStorage.setItem("sheet-key", line.split(",")[0])
sessionStorage.setItem("edited-csv", "\uFEFF" + lines[0] + "\r\n" + line.replace(/,,Missing$/, ",Bản dịch từ CSV,Missing") + "\r\n")
return { key: sessionStorage.getItem("sheet-key"), csvLines: lines.length, xlsxBytes: bytes.length > 0 }
---
location.href = "/import?target=web/school-portal"; await sleep(500)
---
await until(() => Object.keys(document.querySelector("main .border-dashed") ?? {}).some((k) => k.startsWith("__reactProps")), 30000); await sleep(300)
const bin = atob(sessionStorage.getItem("xlsx")); const xlsx = Uint8Array.from(bin, (c) => c.charCodeAt(0))
dropFiles([new File([xlsx], "school-portal.vi.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })])
await until(() => /Sheet · \d+ rows/.test(text()) && /change nothing|\d+ changes?/.test(text()), 15000); await sleep(800)
return { title: document.querySelector("main h1").textContent, drop: text().match(/Drop [^\n]*here/)?.[0], replace: /Clear the keys these files leave out/.test(text()), row: text().match(/Sheet · \d+ rows/)?.[0], summary: text().match(/\d+ empty[^\n]*/)?.[0], blocker: /These files change nothing/.test(text()) }
---
await realClick(document.querySelector('button[aria-label^="Remove school-portal.vi.xlsx"]')); await sleep(300)
dropFiles([new File([sessionStorage.getItem("edited-csv")], "school-portal.vi.csv", { type: "text/csv" })])
await until(() => /1 change\b/.test(text()), 15000); await sleep(500)
const button = [...document.querySelectorAll("main button")].find((b) => /^Import 1 file/.test(b.textContent.trim()))
const label = button.textContent.trim()
await realClick(button)
const result = await until(() => text().match(/1 saved → [^\n]*/)?.[0], 15000)
return { label, result }
---
dropFiles([new File([JSON.stringify({ "nav.home": "x" })], "school-portal.vi.json", { type: "application/json" })])
const toast = await until(() => text().match(/JSON bundles are imported in the developer view/)?.[0], 10000)
return { toast }
---
location.href = "/web/school-portal?lang=vi&q=" + encodeURIComponent(sessionStorage.getItem("sheet-key")); await sleep(500)
---
const f = await until(() => field(sessionStorage.getItem("sheet-key")), 30000); await sleep(500)
return { value: f.value }
---
location.href = "/import?target=web/school-portal"; await sleep(500)
---
await until(() => Object.keys(document.querySelector("main .border-dashed") ?? {}).some((k) => k.startsWith("__reactProps")), 30000); await sleep(300)
await viewAs("Developer")
await until(() => /Import language files/.test(text()) && Object.keys(document.querySelector("main .border-dashed") ?? {}).some((k) => k.startsWith("__reactProps")), 10000); await sleep(300)
dropFiles([new File([JSON.stringify({ "nav.home": "Trang chủ" })], "import.vi.json", { type: "application/json" }), new File([sessionStorage.getItem("edited-csv")], "school-portal.vi.csv", { type: "text/csv" })])
const blocker = await until(() => text().match(/Import JSON files and sheets separately\./)?.[0], 15000)
await viewAs("Translator")
return { blocker, title: document.querySelector("main h1")?.textContent, files: document.querySelectorAll('button[aria-label^="Remove "]').length }
```

Run (từ `<scratchpad>`): `node cdp-pointer.mjs "<scratchpad>/chrome-sheet-import" "http://localhost:3000/web/school-portal?lang=vi" steps-sheet-import.txt`
Expected:
1. `key` là một key không rỗng, `csvLines: 8`, `xlsxBytes: true`.
2. `undefined`
3. `title: "Import translations"`, `drop: "Drop .xlsx or .csv files here"`, `replace: false`, `row: "Sheet · 7 rows"`, `summary: "6 empty"`, `blocker: true`.
4. `label: "Import 1 file · 1 change"`, `result: "1 saved → server-data/translations/web/school-portal/vi.json"`.
5. `toast: "JSON bundles are imported in the developer view"`.
6. `undefined`
7. `value: "Bản dịch từ CSV"`.
8. `undefined`
9. `blocker: "Import JSON files and sheets separately."`, `title: "Import translations"`, `files: 0`.

Chạy lại `steps-sheet-export.txt` (Task 5) với profile mới — kết quả như Task 5 Step 7.

- [ ] **Step 10: Hồi quy view Developer**

Run (từ `<scratchpad>`, mỗi lệnh một profile mới):
`node cdp.mjs "<scratchpad>/chrome-sheet-flows-after" "http://localhost:3000/web/school-portal" steps-flows.txt > "<ws>/flows-after.txt"`
`node cdp.mjs "<scratchpad>/chrome-sheet-tpl-after" "http://localhost:3000/messages/email?lang=vi" steps-templates.txt > "<ws>/templates-after.txt"`
`node cdp.mjs "<scratchpad>/chrome-sheet-import-after" "http://localhost:3000/import?target=web/school-portal" steps-import.txt > "<ws>/import-after.txt"`
rồi `diff` từng cặp, bỏ phần `CONSOLE:` (`diff <(sed '/^CONSOLE:/,$d' before) <(sed '/^CONSOLE:/,$d' after)`).
Expected: `flows` và `templates` giống hệt. `import` giống hệt, trừ đúng những dòng in lại chữ đã đổi có chủ đích (vùng thả `Drop .json, .xlsx or .csv files here`) — mỗi khác biệt như vậy ghi một ruling nêu dòng nào và vì sao; khác biệt nào khác là hồi quy — sửa code, không sửa script.

- [ ] **Step 11: Commit**

```bash
git checkout -- next-env.d.ts tsconfig.tsbuildinfo 2>/dev/null
git add components/import/import-page-client.tsx "app/(workspace)/import/page.tsx" components/import/import-wizard.tsx components/import/file-row.tsx components/import/import-results.tsx components/import/bundle-diff-view.tsx lib/import-plan.ts tests/import-plan.test.ts
git commit -m "Import filled-in Excel and CSV sheets through the existing wizard"
```
