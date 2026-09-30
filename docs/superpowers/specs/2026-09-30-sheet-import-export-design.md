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
- Bắt buộc có `Key`, `English` và **đúng một** cột bản dịch — tiêu đề kết thúc bằng `(<mã>)` với mã là một ngôn ngữ của app (so khớp mã không phân biệt hoa thường, trả về mã chuẩn, ví dụ `ar-sa` → `ar-SA`). Không có → lỗi file; nhiều hơn một → lỗi file.
- **Ngôn ngữ của sheet chỉ lấy từ tiêu đề cột bản dịch** — không đoán theo tên file, không có bước hỏi ngôn ngữ cho sheet (vòng khép kín S1: file do app tạo luôn có tiêu đề này). Dòng file của sheet trong wizard hiện ngôn ngữ dạng chỉ đọc. Mã là `en` → lỗi "Sheets carry translations; English is not imported from a sheet".
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

Ghi: UTF-8 có BOM, dấu phẩy, xuống dòng CRLF; ô chứa `"`, `,`, CR/LF hoặc khoảng trắng hai đầu được đặt trong `"…"` (`"` nhân đôi).

**Chống CSV injection, phân biệt được khi đọc lại:**
- Khi ghi: ô có ký tự đầu là một trong `=`, `+`, `-`, `@`, tab, CR **hoặc `'`** được thêm đúng một `'` ở đầu. Vì `'` cũng nằm trong danh sách, giá trị gốc `'=SUM(A1)` được ghi thành `''=SUM(A1)`, và `'Tis` thành `''Tis`.
- Khi đọc: ô bắt đầu bằng `'` được bỏ **đúng một** `'`, bất kể ký tự tiếp theo.
- Hệ quả: mọi giá trị do app ghi đều về nguyên vẹn sau một vòng tải về → upload (có test cho `=SUM(A1)`, `-5`, `@x`, `'=SUM(A1)`, `'Tis`, `''`). Giá trị bắt đầu bằng `'` mà ai đó **gõ tay vào file CSV bằng trình soạn văn bản** sẽ mất `'` đầu; gõ trong Excel thì không, vì Excel coi `'` đầu ô là dấu định dạng và không lưu nó vào nội dung.

Đọc: bỏ BOM; tự nhận dấu phân cách từ hàng tiêu đề (`,`, `;` hoặc tab — ký tự xuất hiện nhiều nhất ngoài ngoặc kép); RFC 4180 (ngoặc kép, `""`, xuống dòng trong ô); rồi bỏ `'` đầu ô như trên.

## 4. Kiến trúc

### 4.1 File

```
lib/zip.ts            chuyển từ mock/zip.ts (createZip) + thêm readZip — dùng chung cho mock và wizard
lib/csv.ts            writeCsv(rows) / readCsv(text) — thuần
lib/xlsx.ts           writeXlsx(rows, layout) / readXlsx(bytes) — thuần
lib/sheet.ts          nội dung sheet: sheetGridOf, parseSheet, checkRulesOf, planSheet, diffSheet — thuần
tests/csv.test.ts, tests/xlsx.test.ts, tests/sheet.test.ts, tests/fixtures/excel-saved.xlsx (dựng theo cấu trúc Excel lưu ra)
```

Sửa:
- `lib/api-types.ts`: `SheetExportRequest`, `SheetRows`, `SheetFormat`; `SaveTranslationsRequest.sources`, `SaveTranslationsResponse.stale` (§4.4).
- `mock/router.ts`: route `POST /sheet` (§4.4); `PUT /translations` kiểm `sources`; import `createZip` từ `lib/zip.ts`. `tests/helpers/zip.ts` dùng `readZip` của `lib/zip.ts`.
- `mock/store.ts`: `saveTranslations` nhận `sources`, bỏ qua key có English hiện tại khác snapshot, trả `stale` (§4.4).
- `lib/api.ts`: `exportSheet(input: SheetExportRequest)` → `{ blob, filename }` (như `exportBundle`); `saveTranslations(target, lang, values, keep = [], sources?)`.
- `lib/roles.ts`: thêm `exchangeSheets` (developer ✓, translator ✓).
- `components/workspace-header.tsx`: Export/Import hiện khi `canExport && (can.exchangeBundles || can.exchangeSheets)`.
- `components/app-sidebar.tsx`: "Import files" hiện khi `can.exchangeBundles || can.exchangeSheets`.
- **`components/translation-workspace.tsx` và `components/templates/template-workspace.tsx`**: điều kiện mount `ExportDialog` đổi từ `can.exchangeBundles` thành `can.exchangeBundles || can.exchangeSheets`; dialog nhận `key={role}` để state bên trong (định dạng đang chọn, ngôn ngữ, tên file) không sống qua lần đổi role — ví dụ `JSON bundle` đã chọn ở view Developer không còn khi mở lại ở view Translator. Việc đặt lại `isExportOpen` khi role đổi (đã có từ sub-project A, áp cho mọi lần đổi role) giữ nguyên, nên dialog đóng khi role đổi dù role mới còn hay mất quyền.
- `components/translations/export-dialog.tsx`: chọn định dạng (§5.1); mục `JSON bundle` chỉ khi `can.exchangeBundles`.
- `components/import/import-wizard.tsx` (+ `file-row.tsx`, `bundle-diff-view.tsx` cho nhãn Keep English): nhận sheet (§5.2).
- `lib/import-plan.ts`: `StagedFile` thêm `kind: "bundle" | "sheet"` và `sheet?: ParsedSheet`; blocker trộn loại.
- `app/(workspace)/import/page.tsx`: `RoleGate capability="exchangeSheets"`; `ImportWizard key={role}`.

### 4.2 Hợp đồng `lib/sheet.ts`

```ts
type SheetRow = { key: string; english: string; translation: string }
type ParsedSheet = { language: LanguageCode; rows: SheetRow[] }   // ngôn ngữ luôn có (§3.3)

/** Luật kiểm của một key — như store dùng khi tính trạng thái. */
type CheckRules = { lengthBudget: number; maxLength?: number; format: "text" | "html" }
checkRulesOf(project: Project, key: string): CheckRules

type SheetPlan = {
  values: Record<string, string>     // ghi bằng saveTranslations
  keepKeys: string[]                 // Keep English
  /** English trong file của từng key sẽ ghi — gửi kèm để server kiểm lại lúc Confirm (§4.4). */
  sources: Record<string, string>
  skipped: { empty: number; unknown: number; englishChanged: number; duplicate: number }
}

sheetGridOf(input: { project: Project; language: LanguageCode; rows: TranslationRow[]; templates?: TemplateEntry[]; scope: SheetRows }): string[][]
parseSheet(grid: string[][]): ParsedSheet                                   // ném SheetFileError với câu nêu rõ lý do
planSheet(sheet: ParsedSheet, rows: TranslationRow[]): SheetPlan
diffSheet(rows: TranslationRow[], plan: SheetPlan, options: { language: LanguageCode; rulesOf: (key: string) => CheckRules }): BundleDiff
```

- **`checkRulesOf`**: project UI strings → `{ lengthBudget, maxLength }` của profile, `format: "text"`. Kênh template (`profile.kind` là `email`/`sms`/`notification`) → field lấy từ đoạn cuối của key (`invite_coach.body` → `body`) qua `fieldOf(kind, fieldId)`: `format` và `maxLength` của field, `lengthBudget` của profile. Key không khớp field nào của kênh → luật của profile. Đây là cùng nguồn luật mà store dùng (`TemplateField` theo từng field), nên bước xem trước bắt được lỗi thẻ HTML, link, placeholder và độ dài giống như trong dialog dịch.
- **`planSheet`** áp bảng §3.4 và chỉ trả những key thực sự đổi — so với **giá trị hiển thị** (`displayedValueOf(row)`), không so với `row.target` thô:
  - bản dịch khác giá trị hiển thị → `values`;
  - bản dịch bằng English và key chưa ở trạng thái Keep còn hiệu lực (`missing`, hoặc `outdated` mà `keptSource`, hoặc đang có bản dịch khác) → `keepKeys`;
  - bản dịch bằng English và key đã được Keep, English không đổi → không làm gì.
- **`diffSheet`** trả cùng kiểu `BundleDiff` mà view xem thay đổi đang dùng, nhưng tính từ plan:
  - `before` = giá trị hiển thị (`""` với key `missing` kể cả khi bundle giữ bản sao English), `after` = bản dịch (với Keep English là English). Nhờ vậy Keep English trên key `missing` ra `added`, không phải `unchanged`, và blocker "không có thay đổi" không bắn nhầm.
  - Entry Keep English có thêm `keep: true` (trường tùy chọn mới của `DiffEntry`); view hiện nhãn `Keep English` cạnh giá trị. `counts` giữ nguyên các loại hiện có (`added`/`changed`); không có `new` và `removed`.
  - `issues` chạy `checkTranslation(source, after, { language, ...rulesOf(key) })` cho entry `added`/`changed` (trừ Keep English), nên body email được kiểm như `format: "html"` với `maxLength` 4000.
- `diffBundle` của JSON giữ nguyên (ngoài phạm vi; ghi ở §8 rằng preview JSON cho template chưa dùng luật theo field).

### 4.3 Luồng Import cho sheet

1. Thả file → `.xlsx` qua `readXlsx`, `.csv` qua `readCsv` → `parseSheet` → `StagedFile { kind: "sheet", sheet, language: sheet.language }`.
2. Bước xem trước: `planSheet(file.sheet, rows)` rồi `diffSheet(rows, plan, { language, rulesOf: (key) => checkRulesOf(project, key) })`; dòng tóm tắt ghi `skipped`.
3. Confirm: với mỗi sheet, lập lại plan từ `rows` mới nhất mà wizard đang giữ, rồi `saveTranslations(target, language, plan.values, plan.keepKeys, plan.sources)`. Server bỏ qua key có English đã đổi so với `sources` (§4.4) — chặn được trường hợp English đổi **sau** khi xem trước. Kết quả của file ghi `<n> saved` và, nếu có, `<n> skipped - English changed since the preview`.
4. Sau đó giữ nguyên quy tắc hiện có (`afterImport`: refresh coverage, xóa draft của project đã ghi).

### 4.4 HTTP contract

**`POST /sheet`** — tải sheet.

```ts
type SheetRows = "todo" | "all"
type SheetFormat = "xlsx" | "csv"
type SheetExportRequest = {
  target: string          // "web/school-portal", "messages/email"
  language: LanguageCode  // không được là "en"
  rows: SheetRows
  format: SheetFormat
  /** Tên file không kèm đuôi; server làm sạch như tên zip của Export JSON. */
  name: string
}
```

- Kiểm tra: `target` không phải project → 404 `Unknown project "<target>"`; còn lại 400 với `ApiErrorBody`: `language` không phải mã của app → `Unknown language "<code>"`; `language` là `en` → `Sheets carry translations; pick a language other than English`; `rows` ngoài `todo`/`all` → `Expected "rows" to be "todo" or "all"`; `format` ngoài `xlsx`/`csv` → `Expected "format" to be "xlsx" or "csv"`.
- Hàng: project UI strings lấy từ `store.entries(target, language)`; kênh template lấy từ `store.templates(target, language)` (tên template, nhãn field, English, giá trị) — cả hai rồi qua `sheetGridOf`.
- Tên file: `safeFileName(name, "<project id>.<mã>")` + `.xlsx`/`.csv`.
- Phản hồi 200: body là bytes của file; `content-type` là `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` hoặc `text/csv; charset=utf-8`; `content-disposition` theo đúng dạng hai tên (`filename` ASCII + `filename*` UTF-8) mà hàm `zip()` hiện dùng — tách thành hàm `attachment(filename, contentType, data)` dùng chung.

**`PUT /translations/:lang?target=`** — thêm trường tùy chọn, không đổi hành vi khi thiếu:

```ts
type SaveTranslationsRequest = {
  values: Record<string, string>
  keep?: string[]
  /**
   * English mà từng giá trị được dịch từ đó. Key có English hiện tại khác
   * snapshot bị bỏ qua (không ghi, không keep) và trả về trong `stale`.
   */
  sources?: Record<string, string>
  by?: string
}
type SaveTranslationsResponse = { saved: number; file: string; stale: string[] }
```

- `sources` phải là object chuỗi → sai kiểu thì 400 `Expected "sources" to be an object of key: English text`.
- So sánh English như §3.4 (bỏ khoảng trắng hai đầu, chuẩn hóa xuống dòng).
- `stale` luôn có mặt (mảng rỗng khi không truyền `sources`); workspace và dialog template bỏ qua nó.

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
- Dòng file: thêm nhãn loại — `Sheet · <N> rows` cho sheet; ngôn ngữ của sheet hiện dạng chỉ đọc (lấy từ tiêu đề cột, §3.3), không có bộ chọn ngôn ngữ như file JSON.
- Bước xem trước với sheet: một dòng số liệu dưới tên file, chỉ hiện các mục > 0: `<n> not in <project> · <n> English changed since download · <n> empty · <n> duplicate`. Không có đoạn giải thích (mức helper text A). Entry Keep English hiện nhãn `Keep English` cạnh giá trị.
- Confirm và kết quả dùng lại thành phần hiện có; dòng kết quả của sheet: `<n> saved → <file đã ghi>`, thêm ` · <n> skipped - English changed since the preview` khi server trả `stale` khác rỗng.
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
| Không còn thay đổi nào sau khi áp quy tắc | Blocker sẵn có (không có thay đổi) — Keep English trên key `missing` được tính là thay đổi (§4.2) |
| English đổi giữa lúc xem trước và Confirm | Server bỏ qua key đó (`sources`/`stale`, §4.4); dòng kết quả ghi số key bị bỏ qua |
| HTML hỏng, thiếu placeholder, vượt độ dài | Vẫn import; bước xem trước đánh dấu lỗi bằng đúng luật của từng field (`checkRulesOf`, §4.2) |

Lỗi đọc file hiện như lỗi file JSON hiện nay (toast, mỗi file một dòng). File sheet lớn (vài nghìn hàng) vẫn trong khả năng của bộ đọc; không có giới hạn riêng.

## 7. Kiểm thử

**Vitest:**
- `csv`: ghi → đọc giữ nguyên giá trị (tiếng Việt, Ả Rập, `"`, `,`, xuống dòng, khoảng trắng hai đầu, `=SUM(A1)`, `-5`, `@x`, `<tab>=x`, `'=SUM(A1)`, `'Tis`, `''`); đọc file dùng `;` và tab; BOM.
- `xlsx`: ghi → đọc giữ nguyên các giá trị trên và HTML; fixture `excel-saved.xlsx` (shared strings, rich text nhiều `<r>`, ô số, ô `str` có công thức, ô bị bỏ giữa hàng, thực thể XML, sheet đầu tiên không tên `sheet1.xml`); bytes không phải zip → `SheetFileError`.
- `sheet`: `sheetGridOf` cho UI strings và template, cả `todo` và `all`; `parseSheet` tìm cột theo tiêu đề (đảo thứ tự, thêm cột, mã ngôn ngữ khác hoa thường), các lỗi ở §6; `checkRulesOf` cho project UI và cho `invite_coach.body` (html, 4000), `invite_coach.subject`, key không khớp field; `planSheet` đủ các dòng của bảng §3.4, so theo giá trị hiển thị; `diffSheet`: Keep English trên key `missing` mà bundle giữ bản sao English → `added` với `keep: true` (không phải `unchanged`), body email thiếu `</p>` → issue `html`.
- `router`: `POST /sheet` trả `.xlsx` đọc lại được và `.csv`, đúng số hàng `todo`/`all` trên seed (School Portal vi: `todo` = 7; `messages/email` vi: `todo` = 1), header `content-type`/`content-disposition`; các lỗi 400/404 ở §4.4. `PUT /translations` với `sources`: key có English đã đổi → không ghi và có trong `stale`; key khớp → ghi; không truyền `sources` → hành vi cũ, `stale: []`.
- `roles`: `exchangeSheets` của hai role.

**Gate:** `npm run typecheck`, `npm test`, `npm run build`.

**CDP** — menu và nút được bấm bằng **chuột thật** (`Input.dispatchMouseEvent`), không phải `element.click()`:
- Translator mở Export → chọn `Excel (.xlsx)` → Download; script bắt blob (thay `URL.createObjectURL`), đọc lại bằng `readXlsx` trong trang và kiểm tiêu đề cột + số hàng.
- Translator tải CSV, sửa một ô bản dịch, thả vào `/import` → xem trước 1 thay đổi và dòng số liệu đúng → Confirm → string đó hiện bản dịch mới trong workspace.
- Translator thả `.json` → toast từ chối; Developer import JSON vẫn như cũ; Developer thả JSON + CSV cùng lúc → blocker trộn loại.
- Đổi role khi wizard có file → wizard trống. Developer mở Export, chọn `JSON bundle`, đổi sang Translator → dialog đóng; mở lại → định dạng là `Excel (.xlsx)`, không có mục JSON.
- Trang template: Export Excel có cột Template và Field.

**Hồi quy:** script flow của view Developer và checklist template — chụp trước khi sửa, so sau khi sửa, phải giống hệt.

## 8. Cần BA/product quyết định (bổ sung danh sách chung)

5. Có cần định dạng nhiều ngôn ngữ trong một file cho nhóm dịch làm nhiều ngôn ngữ cùng lúc không?
6. Khi sub-project C có ID ổn định, cột ID có thay `Key` làm khóa ghép khi import không?
7. Hàng "English changed since download" hiện bị bỏ qua — có cần cho phép "import anyway" không?
8. Preview của Import **JSON** cho kênh template vẫn kiểm theo luật cấp project (không theo field) như hiện nay — có cần chuyển sang `checkRulesOf` như sheet không? (Trạng thái sau khi ghi vẫn đúng vì server tính theo field.)

## 9. Giữ nguyên

Behavior của Import/Export JSON cho developer; hợp đồng API hiện có (thêm `POST /sheet`; `PUT /translations` chỉ thêm trường tùy chọn `sources` và trường phản hồi `stale`); dữ liệu seed; theme tokens.
