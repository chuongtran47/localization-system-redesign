# Excel/CSV trong Import và Export — Design

Ngày: 2026-09-30
Phạm vi: sub-project **D** trong đợt xử lý feedback của CS (điểm #6: làm rõ luồng Import; translator cần Excel/CSV), làm sớm theo yêu cầu "Translator View nên có feature import support cả file excel". Xây trên branch `feat/roles` (sub-project A, chưa merge) vì cần view Translator.

## 1. Mục tiêu

Translator tải về một file Excel (hoặc CSV) chứa string của một project ở một ngôn ngữ, điền bản dịch trong Excel, rồi upload lại để xem trước thay đổi và áp dụng — dùng chính dialog **Export** và wizard **Import** đang có, không thêm nút hay trang mới. Developer vẫn có JSON như hiện nay, cộng thêm Excel/CSV.

**Ngoài phạm vi:** nhiều ngôn ngữ hoặc nhiều project trong một file; file `.xls` đời cũ; ghép cột tự do cho bảng tính tự làm; cột ID ổn định (sub-project C sẽ thêm).

## 2. Quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| S1 | Luồng | Vòng khép kín: file do app tạo → điền → upload → xem trước → áp dụng |
| S2 | Định dạng | `.xlsx` (mặc định) và `.csv`, cùng một bộ cột; upload nhận cả hai |
| S3 | Một file chứa | Một project × một ngôn ngữ |
| S4 | Chỗ đặt | Mở rộng dialog Export và wizard Import hiện có, cho cả hai view |
| S5 | Template | Có — mỗi field một dòng, thêm cột Template và Field |
| S6 | Cách làm | Tự viết đọc/ghi `.xlsx`/`.csv` trong `lib/` (không thêm dependency); sheet ghi bằng `saveTranslations`, không bao giờ tạo hay xóa key |
| S7 | Quyền | Thêm `exchangeSheets` (cả hai role); `exchangeBundles` (chỉ developer) giờ chỉ gắn với JSON |

## 3. Định dạng sheet

### 3.1 Cột

| Loại project | Cột, theo thứ tự |
|---|---|
| UI strings | `Key` · `English` · `<Tên ngôn ngữ> (<mã>)` · `Status` |
| Template (email, SMS, notification) | `Key` · `Template` · `Field` · `English` · `<Tên ngôn ngữ> (<mã>)` · `Status` |

Ví dụ cột bản dịch: `Vietnamese (vi)`, `Arabic (ar-SA)`. `Status` là nhãn trạng thái hiện tại (`Missing`, `Outdated`, `Needs fix`, `Translated`); `Template` là tên template, `Field` là nhãn field (`Subject`, `Body`…). Ba cột này chỉ để đọc — import bỏ qua chúng.

Tên file mặc định: `<project id>.<mã>.xlsx` (hoặc `.csv`), ví dụ `school-portal.vi.xlsx`, `email.ja.csv`.

### 3.2 Hàng

- "Strings to translate": các key có trạng thái `missing`, `outdated` hoặc `needs_fix` ở ngôn ngữ đó. "All strings": mọi key.
- Thứ tự: theo thứ tự `GET /entries` trả về (cũng là thứ tự danh sách của workspace); template theo thứ tự template trong registry rồi thứ tự field của kênh.
- Ô bản dịch chứa giá trị đang lưu; key `missing` là ô trống (bản sao của English không được ghi vào, giống `displayedValueOf`).

### 3.3 Đọc lại

- Hàng 1 là tiêu đề. Cột được tìm **theo tiêu đề** (không phân biệt hoa thường, bỏ khoảng trắng hai đầu), không theo vị trí — translator có thể đổi thứ tự hoặc thêm cột riêng.
- Bắt buộc có `Key`, `English` và một cột bản dịch — tiêu đề kết thúc bằng `(<mã>)` với mã là một ngôn ngữ của app. Có nhiều hơn một cột như vậy → lỗi file.
- Ngôn ngữ của sheet: lấy từ cột bản dịch; nếu mã đó là `en` → lỗi "Sheets carry translations; English is not imported from a sheet".
- Hàng trống hoàn toàn bị bỏ qua.

### 3.4 Quy tắc cho từng hàng (khi so với dữ liệu hiện tại của project)

| Trường hợp | Kết quả | Đếm vào |
|---|---|---|
| Ô bản dịch trống | Bỏ qua — không xóa bản dịch đang có | `empty` |
| `Key` không có trong project | Bỏ qua — sheet không tạo key | `unknown` |
| `English` trong file khác English hiện tại của key | Bỏ qua — bản dịch được viết cho câu English cũ | `englishChanged` |
| `Key` đã gặp ở hàng trước | Bỏ qua — hàng đầu tiên thắng | `duplicate` |
| Bản dịch giống hệt English hiện tại | Keep English (vào `keepKeys`) | — |
| Còn lại | Ghi bản dịch (vào `values`) | — |

So sánh English bỏ khoảng trắng hai đầu và chuẩn hóa xuống dòng (`\r\n` → `\n`). Giá trị bản dịch giữ nguyên, chỉ chuẩn hóa `\r\n` → `\n`.

### 3.5 `.xlsx`

Ghi:
- Workbook một sheet tên `<project name> · <mã>` (cắt còn 31 ký tự, bỏ ký tự Excel cấm `[]:*?/\`).
- Ô là chuỗi inline (`t="inlineStr"`) — không có công thức, không có shared strings.
- `styles.xml` tối thiểu: tiêu đề in đậm; ô dữ liệu `wrapText`, căn trên.
- Hàng 1 cố định khi cuộn (`pane ySplit=1`); độ rộng cột: Key 40, Template 28, Field 14, English 60, bản dịch 60, Status 14.
- Zip bằng `createZip` hiện có (deflate qua `CompressionStream`).

Đọc:
- Zip: đọc central directory, giải nén bằng `DecompressionStream("deflate-raw")` (entry lưu thẳng cũng nhận).
- Sheet đầu tiên theo `xl/workbook.xml` + `xl/_rels/workbook.xml.rels`.
- Kiểu ô: `s` (shared string, nối mọi `<t>` của rich text), `inlineStr`, `str` (kết quả công thức), `n` (số — giữ chuỗi `<v>` như Excel lưu), `b` (`TRUE`/`FALSE`); ô công thức lấy giá trị đã tính trong `<v>`; `e` (lỗi) → chuỗi rỗng.
- Vị trí ô theo thuộc tính `r` (`C5`) — ô bị bỏ qua giữa hàng vẫn đúng cột.
- Giải mã thực thể XML (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`, `&#…;`, `&#x…;`); giữ `\n` trong ô.
- Bộ đọc XML là một bộ quét nhỏ viết tay cho tập thẻ trên (không dùng `DOMParser`), nên chạy được cả trong vitest.

### 3.6 `.csv`

Ghi: UTF-8 có BOM, dấu phẩy, xuống dòng CRLF; ô chứa `"`, `,`, CR/LF hoặc khoảng trắng hai đầu được đặt trong `"…"` (`"` nhân đôi). **Chống CSV injection:** ô bắt đầu bằng `=`, `+`, `-`, `@` được thêm `'` ở đầu.

Đọc: bỏ BOM; tự nhận dấu phân cách từ hàng tiêu đề (`,`, `;` hoặc tab — ký tự xuất hiện nhiều nhất ngoài ngoặc kép); RFC 4180 (ngoặc kép, `""`, xuống dòng trong ô); ô bắt đầu bằng `'` theo sau là `=`, `+`, `-`, `@` được bỏ `'`. Một vòng tải về → upload không làm đổi giá trị nào.

## 4. Kiến trúc

### 4.1 File

```
lib/zip.ts            chuyển từ mock/zip.ts (createZip) + thêm readZip — dùng chung cho mock và wizard
lib/csv.ts            writeCsv(rows) / readCsv(text) — thuần
lib/xlsx.ts           writeXlsx(rows, layout) / readXlsx(bytes) — thuần
lib/sheet.ts          nội dung sheet: sheetGridOf(...), parseSheet(grid, fileName), planSheet(sheet, rows)
tests/csv.test.ts, tests/xlsx.test.ts, tests/sheet.test.ts, tests/fixtures/excel-saved.xlsx (dựng theo cấu trúc Excel lưu ra)
```

Sửa:
- `mock/router.ts`: route `POST /sheet` → file `.xlsx`/`.csv`; import `createZip` từ `lib/zip.ts`. `tests/helpers/zip.ts` dùng `readZip` của `lib/zip.ts`.
- `lib/api.ts`: `exportSheet({ target, language, rows: "todo" | "all", format: "xlsx" | "csv", name })` → `{ blob, filename }` (như `exportBundle`).
- `lib/roles.ts`: thêm `exchangeSheets` (developer ✓, translator ✓).
- `components/workspace-header.tsx`: Export/Import hiện khi `canExport && (can.exchangeBundles || can.exchangeSheets)`.
- `components/app-sidebar.tsx`: "Import files" hiện khi `can.exchangeBundles || can.exchangeSheets`.
- `components/translations/export-dialog.tsx`: chọn định dạng (§5.1).
- `components/import/import-wizard.tsx` (+ `file-row.tsx`): nhận sheet (§5.2).
- `lib/import-plan.ts`: `StagedFile` thêm `kind: "bundle" | "sheet"` và `sheet?: ParsedSheet`; blocker trộn loại; `languageFromName` bỏ đuôi `.xlsx`/`.csv` như `.json`.
- `app/(workspace)/import/page.tsx`: `RoleGate capability="exchangeSheets"`; `ImportWizard key={role}`.

### 4.2 Hợp đồng `lib/sheet.ts`

```ts
type SheetScope = "todo" | "all"
type SheetRow = { key: string; english: string; translation: string }
type ParsedSheet = { language: LanguageCode | null; rows: SheetRow[] }
type SheetPlan = {
  values: Record<string, string>    // ghi bằng saveTranslations
  keepKeys: string[]                // Keep English
  skipped: { empty: number; unknown: number; englishChanged: number; duplicate: number }
}

sheetGridOf(input: { project: Project; language: LanguageCode; rows: TranslationRow[]; templates?: TemplateEntry[]; scope: SheetScope }): string[][]
parseSheet(grid: string[][], fileName: string): ParsedSheet            // ném SheetFileError với câu nêu rõ lý do
planSheet(sheet: ParsedSheet, rows: TranslationRow[]): SheetPlan
```

`parseSheet` lấy ngôn ngữ từ tiêu đề cột bản dịch, rơi về `languageFromName(fileName)`, rồi `null` (wizard hỏi, như file JSON). `planSheet` áp bảng §3.4 và chỉ trả những key thực sự đổi (giá trị khác giá trị đang lưu, hoặc Keep English cho key đang `missing`/Keep đã cũ).

### 4.3 Luồng Import cho sheet

1. Thả file → `.xlsx` qua `readXlsx`, `.csv` qua `readCsv` → `parseSheet` → `StagedFile { kind: "sheet", sheet, language }`.
2. Bước xem trước: `planSheet(file.sheet, rows)` → `diffBundle(rows, { ...values, ...keepAsEnglish }, { mode: "merge", … })` — dùng lại view xem thay đổi; dòng tóm tắt ghi `skipped`.
3. Confirm: với mỗi sheet, `saveTranslations(target, language, values, keepKeys)`; sau đó giữ nguyên quy tắc hiện có (`afterImport`: refresh coverage, xóa draft của project đã ghi).

## 5. Giao diện

### 5.1 Dialog Export

- Trên cùng: nhóm nút chọn định dạng `Excel (.xlsx)` · `CSV` · `JSON bundle` (mục cuối chỉ khi `can.exchangeBundles`). Mặc định: `JSON bundle` nếu có `exchangeBundles` (developer — giữ hành vi hiện nay), còn lại `Excel (.xlsx)`.
- Excel/CSV: select **Language** (một ngôn ngữ, không có English, mặc định ngôn ngữ đang xem; nếu đang xem English thì ngôn ngữ đầu tiên không phải English); radio **Rows**: `Strings to translate (N)` (mặc định) / `All strings (N)` — N đếm từ dữ liệu của ngôn ngữ đã chọn; **File name** điền sẵn §3.1; nút `Download`.
- JSON bundle: giữ nguyên giao diện hiện tại.
- Toast: `Exported <file>` (mô tả: `<N> strings · <Language>`).
- Dùng chung cho trang UI strings và trang template.

### 5.2 Wizard Import

| | Developer | Translator |
|---|---|---|
| Tiêu đề | `Import language files` (như cũ) | `Import translations` |
| Nhận file | `.json`, `.xlsx`, `.csv` | `.xlsx`, `.csv` |
| Dòng chữ vùng thả | `Drop .json, .xlsx or .csv files here` | `Drop .xlsx or .csv files here` |
| Chế độ replace | Có — chỉ khi lô toàn JSON | Không |

- Thả `.json` ở view Translator → toast lỗi `JSON bundles are imported in the developer view`.
- Lô trộn JSON và sheet → blocker `Import JSON files and sheets separately`.
- Dòng file: thêm nhãn loại — `Sheet · <N> rows` cho sheet.
- Bước xem trước với sheet: một dòng số liệu dưới tên file, chỉ hiện các mục > 0: `<n> not in <project> · <n> English changed since download · <n> empty · <n> duplicate`. Không có đoạn giải thích (mức helper text A).
- Confirm và kết quả dùng lại thành phần hiện có; dòng kết quả của sheet: `<n> saved → <file đã ghi>`.
- Đổi role khi wizard đang mở: `key={role}` → wizard mới, trống (tuân §3.4 của spec role — file JSON đã thả không sang được view Translator).

## 6. Lỗi và edge case

| Tình huống | Hiện |
|---|---|
| `.xls` | `<file> - Save it as .xlsx and try again` |
| Không phải zip / hỏng / có mật khẩu | `<file> - That file is not a readable Excel workbook` |
| Thiếu cột | `<file> - No Key column` / `No English column` / `No translation column (a header like "Vietnamese (vi)")` |
| Nhiều cột bản dịch | `<file> - More than one translation column` |
| Không có hàng dữ liệu | `<file> - The sheet has no rows` |
| Cột bản dịch là English | `<file> - Sheets carry translations; English is not imported from a sheet` |
| Hai sheet cùng ngôn ngữ | Blocker sẵn có (trùng ngôn ngữ) |
| Không còn thay đổi nào sau khi áp quy tắc | Blocker sẵn có (không có thay đổi) |
| HTML hỏng, thiếu placeholder | Vẫn import; bước xem trước đánh dấu lỗi như trong app |

Lỗi đọc file hiện như lỗi file JSON hiện nay (toast, mỗi file một dòng). File sheet lớn (vài nghìn hàng) vẫn trong khả năng của bộ đọc; không có giới hạn riêng.

## 7. Kiểm thử

**Vitest:**
- `csv`: ghi → đọc giữ nguyên giá trị (tiếng Việt, Ả Rập, `"`, `,`, xuống dòng, khoảng trắng hai đầu, `=SUM(A1)`, `-5`, `@x`); đọc file dùng `;` và tab; BOM.
- `xlsx`: ghi → đọc giữ nguyên các giá trị trên và HTML; fixture `excel-saved.xlsx` (shared strings, rich text nhiều `<r>`, ô số, ô `str` có công thức, ô bị bỏ giữa hàng, thực thể XML, sheet đầu tiên không tên `sheet1.xml`); bytes không phải zip → `SheetFileError`.
- `sheet`: `sheetGridOf` cho UI strings và template, cả `todo` và `all`; `parseSheet` tìm cột theo tiêu đề (đảo thứ tự, thêm cột), ngôn ngữ từ tiêu đề → tên file → `null`, các lỗi ở §6; `planSheet` đủ các dòng của bảng §3.4.
- `router`: `POST /sheet` trả `.xlsx` đọc lại được và `.csv`, đúng số hàng `todo`/`all` trên seed (School Portal vi: `todo` = 7; `messages/email` vi: `todo` = 1).
- `roles`: `exchangeSheets` của hai role.

**Gate:** `npm run typecheck`, `npm test`, `npm run build`.

**CDP** — menu và nút được bấm bằng **chuột thật** (`Input.dispatchMouseEvent`), không phải `element.click()`:
- Translator mở Export → chọn `Excel (.xlsx)` → Download; script bắt blob (thay `URL.createObjectURL`), đọc lại bằng `readXlsx` trong trang và kiểm tiêu đề cột + số hàng.
- Translator tải CSV, sửa một ô bản dịch, thả vào `/import` → xem trước 1 thay đổi và dòng số liệu đúng → Confirm → string đó hiện bản dịch mới trong workspace.
- Translator thả `.json` → toast từ chối; Developer import JSON vẫn như cũ; Developer thả JSON + CSV cùng lúc → blocker trộn loại.
- Đổi role khi wizard có file → wizard trống.
- Trang template: Export Excel có cột Template và Field.

**Hồi quy:** script flow của view Developer và checklist template — chụp trước khi sửa, so sau khi sửa, phải giống hệt.

## 8. Cần BA/product quyết định (bổ sung danh sách chung)

5. Có cần định dạng nhiều ngôn ngữ trong một file cho nhóm dịch làm nhiều ngôn ngữ cùng lúc không?
6. Khi sub-project C có ID ổn định, cột ID có thay `Key` làm khóa ghép khi import không?
7. Hàng "English changed since download" hiện bị bỏ qua — có cần cho phép "import anyway" không?

## 9. Giữ nguyên

Behavior của Import/Export JSON cho developer; hợp đồng API hiện có (chỉ thêm `POST /sheet`); dữ liệu seed; theme tokens.
