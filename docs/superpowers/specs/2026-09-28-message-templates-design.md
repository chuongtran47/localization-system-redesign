# Message templates — Design

Ngày: 2026-09-28
Phạm vi: sub-project #5 trong lộ trình feature parity với `D:\example_projects\localizer` (gọi tắt: **repo tham chiếu**) — ba kênh `/messages/email`, `/messages/sms`, `/messages/notification`. Xây trên #1–2 (`2026-09-27-foundation-workspace-parity-design.md`) và #4 (`2026-09-28-import-wizard-design.md`), cùng branch `feat/workspace-parity`.

## 1. Mục tiêu

Người dùng mở một kênh message, thấy danh sách template, mở một template để dịch từng field bên cạnh bản xem trước message như người nhận thấy, rồi lưu. Behavior theo repo tham chiếu (`src/pages/templates_page.tsx`, `src/components/templates/*`, `src/hooks/use_templates.ts`); UI theo style của repo này.

**Yêu cầu riêng của người dùng: hạn chế helper text.** Repo tham chiếu giải thích quá nhiều trên màn hình; bản này chỉ giữ chữ là dữ liệu, trạng thái, hoặc dẫn tới hành động (§4.5).

**Ngoài phạm vi:** tạo/xóa template trong UI (template đến từ API/seed), sửa English của template, dashboard (#3).

## 2. Quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| T1 | Helper text | Mức A: bỏ phần giải thích, giữ dữ liệu/trạng thái/hành động — danh sách cụ thể ở §4.5 |
| T2 | Cách dịch | Dialog hai panel (field bên trái, preview bên phải), như repo tham chiếu |
| T3 | English | Chỉ xem: không có ô dịch, không Save, ẩn tiến độ; header có pill "View only" |
| T4 | Sent from | Owner trong seed map sang project của repo này (§3.4); owner không có project tương ứng hiện chữ thường, không link |
| T5 | Bố cục trang | Giống workspace: header, stat cards đếm theo field (bấm để lọc), category dạng underline tabs, popover product, bảng |
| T6 | Đóng dialog khi còn sửa | Hỏi `window.confirm("Discard N unsaved fields?")`; repo tham chiếu bỏ edit không hỏi |
| T7 | Draft | Edit của dialog là state cục bộ (dialog key theo `${id}:${language}`), không vào `DraftProvider` |

## 3. Kiến trúc

### 3.1 Luồng dữ liệu

```
[group]/[project]/page.tsx ─ TranslationWorkspace ─(kind !== "ui")→ TemplateWorkspace
TemplateWorkspace ─ useTemplates(target, language, revision) ─ fetchTemplates → GET /templates?target=&lang=
      │ URL: ?lang= &category= &owner= &status= &q= &template=
      ▼
TemplateTable ── bấm dòng ──→ ?template=<id>
      ▼
TemplateDialog (key = `${id}:${language}`)
      ├─ TemplateFieldEditor × N
      ├─ TemplatePreview
      └─ Save → saveTranslations(target, language, values, keepKeys) → refresh()
```

**Hợp đồng Save** (khớp `saveTranslations(target, lang, values: Record<string, string>, keep: string[])` trong `lib/api.ts`): dialog gom mọi field đã sửa thành `values`, khóa là `templateKeyOf(templateId, fieldId)` (`"<templateId>.<fieldId>"`, vd. `"invite_coach.subject"`), giá trị là text đang gõ; các field bấm Keep English thành mảng `keepKeys: string[]` cùng dạng khóa. Một field không bao giờ nằm ở cả hai (router trả 400 nếu có).

Không có route API mới; `lib/api.ts` vẫn là module duy nhất chạm backend. `lib/template-data.ts`, `lib/template-preview.ts` (whitelist HTML: `safeHtml`, `previewHtml`, `previewText`, `cleanHtml`, `sampleValues`, `placeholderList`) và route `/templates` đã có từ #1–2.

### 3.2 File

```
lib/template-view.ts                         thuần — §3.3
hooks/use-templates.ts                       port use_templates, thêm tham số revision (như use-translation-rows)
components/templates/template-workspace.tsx  trang kênh
components/templates/template-table.tsx
components/templates/template-dialog.tsx
components/templates/template-field-editor.tsx
components/templates/template-preview.tsx
components/templates/rich-text-editor.tsx    port (contenteditable + execCommand; cleanHtml khi xuất)
tests/template-view.test.ts
tests/router.test.ts                         thêm describe("templates")
```

Sửa:
- `components/translation-workspace.tsx` — `TranslationWorkspace` chỉ còn chọn component theo `project.profile.kind`: `ui` → `UiWorkspace` (phần thân hiện tại, đổi tên, cùng file), còn lại → `TemplateWorkspace`. Tách như vậy để hook của mỗi màn hình chỉ chạy ở màn hình của nó (không gọi hook có điều kiện). Mọi nhánh `isTemplateChannel` trong phần thân UI bị bỏ.
- `ProjectProfileCard` vẫn dùng cho project UI chưa có key; bỏ lời gọi dành cho kênh template.

Stat card: `StatCard` hiện là hàm cục bộ trong `translation-workspace.tsx`; tách ra `components/stat-card.tsx` để trang template dùng lại.

### 3.3 Hợp đồng `lib/template-view.ts`

- `TEMPLATE_ALL = "__all__"`.
- `type TemplateStatusFilter = "all" | "missing" | "needs_fix" | "translated" | "outdated"`.
- `type TemplateFilters = { language: LanguageCode; category: TemplateCategory | typeof TEMPLATE_ALL; owner: string; status: TemplateStatusFilter; q: string; template: string | null }`.
- `parseTemplateFilters(params): TemplateFilters` — `lang` không hợp lệ → `vi`; `category` không thuộc `templateCategories` → ALL; `status` không hợp lệ → `all`; `owner` giữ nguyên chuỗi (kiểm sau khi tải, xem `resolveOwner`); `template` = chuỗi hoặc `null`.
- `resolveOwner(owner, entries, isLoading): string` — owner không có trong `entries` (khi đã tải) → ALL.
- `ownerKeyOf(owner: TemplateOwner): string` = `ownerPath(owner)` (`web/school`).
- `ownerProject(owner): { label: string; project: Project | null }` — bảng map §3.4; không map được → `label` là tên viết hoa chữ đầu của `owner.app`, `project: null`.
- `ownersOf(entries): { key: string; label: string }[]` — các owner có mặt, sắp theo `label`.
- `categoriesOf(entries): { category: TemplateCategory; count: number }[]` — theo thứ tự `templateCategories`, chỉ category có mặt.
- `matchesStatus(entry, status)` — `missing`: `entry.missing > 0 || entry.outdated > 0`; `outdated`: `entry.outdated > 0`; `needs_fix`: `entry.needsFix > 0`; `translated`: `entry.translated === entry.total`; `all`: luôn đúng.
- `filterTemplates(entries, { category, owner, status, q })` — áp category → owner → status → q (khớp không phân biệt hoa thường với `name`, `id`, `createdBy`, `source` và `target` của mọi field).
- `summarise(entries): { templates; fields; translated; missing; outdated; needsFix; percent }` — `percent = round(translated / fields * 100)`, 0 khi `fields === 0`.

Stat cards đếm trên **toàn bộ** template của kênh ở ngôn ngữ đang chọn (không theo bộ lọc), đúng như quy tắc đếm của workspace (spec #1–2 §4.4.1). Tab category đếm sau owner + status + q, trước category. Pill "N templates" đếm sau mọi bộ lọc.

### 3.4 Map owner → project

| Owner trong seed | Project |
|---|---|
| `web/school` | `web/school-portal` (School Portal) |
| `app/parent` | `web/parent-portal` (Parent Portal) |
| `app/student` | `mobile/student-app` (Student App) |
| `web/training` | `web/training-portal` (Training Portal) |
| `app/baby` | `mobile/gs-baby-app` (GS Baby App) |
| `web/curriculum` | không có — nhãn "Curriculum", không link |

## 4. Giao diện

### 4.1 Trang kênh

Khung như workspace (`mx-auto max-w-[1400px] px-6 py-6`).

- **Header**: breadcrumb `Messages / Templates`; tiêu đề tên kênh; badge `kindLabel` ("Email templates"); badge "Inferred" như workspace; khi English: pill "View only". Dòng phụ `Managing <Language> translations · N templates`. Nút bên phải (cùng thứ tự và style workspace): Export (mở `ExportDialog`), Import (link `/import?target=`), Lock, Publish (inert). Không có Add key.
- **Stat cards** (ẩn khi English): Progress `%` + thanh · Translated (số field) · Needs fix · Missing (phụ đề `N outdated`). Bấm → `?status=`: Progress → all, Translated → translated, Needs fix → needs_fix, Missing → missing. Card active như workspace.
- **Bộ lọc** (một hàng, style underline tabs của workspace): tabs "All" + từng category có mặt, kèm số; bên phải: popover product ("All products" + các owner có mặt, dựng trên `PopoverMenu`, có wrapper `w-fit`) và pill "N templates". Tìm kiếm dùng ô ⌘K của topbar (`?q=`).
- **Bảng** — card `rounded-xl border border-border bg-card`, header `bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`. Cột:
  1. Template — tên (`font-medium`) và id (`font-mono text-xs text-muted-foreground`).
  2. Recipient — pill `rounded-full bg-muted`.
  3. Sent from — `Link` tới project (không lan sự kiện click của dòng) hoặc chữ thường.
  4. Created — `createdBy` và `formatDate(createdAt)`.
  5. Updated — `updated.by` và `formatDate(updated.at)`, hoặc `—`.
  6. Segments (chỉ SMS) — `<target>/<source>`, màu warning khi bản dịch tốn nhiều segment hơn English; `—` khi chưa dịch.
  7. Translation (ẩn khi English) — thanh `h-1.5` + `translated/total`, pill info `N outdated` và pill warning `N to fix` khi > 0.
  Dòng: `cursor-pointer hover:bg-accent/30`; viền trái warning khi `missing + outdated + needsFix > 0` (không khi English); viền trái primary + `bg-accent/40` khi đang mở.
- **Trạng thái**: đang tải → skeleton 6 dòng; lỗi → khối destructive + Retry (`refresh`); kênh rỗng → "No templates in this channel yet."; lọc ra 0 → "No templates match these filters."
- `?template=<id>` không khớp template nào → không mở dialog.

### 4.2 Dialog

`DialogContent` cỡ `w-[min(84rem,calc(100vw-2rem))] h-[min(50rem,calc(100dvh-2rem))]`, lưới 3 hàng (header / thân / footer), `p-0`.

- **Header** (`border-b px-5 py-3`): tên template (`DialogTitle`), pill recipient, sent from (icon `Globe` cho web, `Smartphone` cho mobile/app + nhãn).
- **Thân**: hai cột ở `lg`, một cột ở màn nhỏ.
  - **Trái** (`overflow-auto border-r`): mỗi field một `TemplateFieldEditor` (§4.3).
  - **Phải** (`bg-muted/20 overflow-auto`): thanh dính trên cùng `Preview` + pill toggle `[<Language> | English]` (ẩn nút English khi đang ở English); rồi `TemplatePreview` (§4.4).
- **Footer** (`border-t bg-muted/40 px-5 py-3`): trái — `N unsaved fields` khi có sửa, ngược lại `translated/total fields translated` (ẩn khi English); phải — nút outline Discard (khi có sửa) hoặc Close, nút primary Save (disabled khi không có sửa hoặc đang lưu; ẩn khi English).
- **Đóng** (Close, Esc, click nền, nút X): còn sửa → `window.confirm("Discard N unsaved fields?")`; từ chối thì giữ dialog mở.
- **Save**: `saveTranslations(target, language, values, keepKeys)` theo hợp đồng ở §3.1 (field đã sửa → `values`, field Keep English → `keepKeys`); thành công → xóa edit cục bộ, `refresh()` (bảng, stat cards, sidebar), toast "Saved N fields of <template>" (mô tả: file đã ghi). Lỗi → toast lỗi, giữ edit.

### 4.3 Field editor

Mỗi field là `section` `border-b border-l-2 border-l-transparent px-5 py-4`; đang sửa → `border-l-primary bg-accent/30`; có lỗi → `border-l-destructive`.

- **Dòng đầu**: nhãn field (`text-sm font-medium`); `StatusBadge` (ẩn khi English); "Kept as English" (`text-[11px] text-muted-foreground`) khi đang giữ English. Bên phải: nút chữ "Keep English" (khi missing hoặc outdated-kept, không phải English, English không rỗng), nút `HTML` bật/tắt (chỉ field `rich`), icon Copy (English ra clipboard), icon Paste (English vào ô; ẩn khi English).
- **English**: khối `rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground`; field `html` khi chưa bật HTML → render `safeHtml(source)`; còn lại → text `whitespace-pre-wrap` (mono khi đang xem HTML).
- **Ô dịch** (ẩn khi English): `line` → `Input`; `paragraph` → `Textarea`; `rich` → `RichTextEditor`, hoặc `Textarea` mono khi bật HTML. `dir="rtl"` cho `ar-SA`.
- **Dưới ô dịch**:
  - outdated và chưa sửa → dòng info "English changed" + nút chữ "Still correct" (không hiện nút khi là outdated-kept).
  - bộ đếm: SMS → `GSM-7 · 45 chars · 1 segment` (mono, warning khi còn ≤ 10 đơn vị trong segment); field có `budget` hoặc `maxLength` → `45/60` (mono, warning khi vượt).
  - lỗi validation (`checkTranslation` với `format` và `maxLength` của field; `lengthBudget` của profile): error destructive, warning muted.

### 4.4 Preview

Nội dung preview là giá trị đang gõ (hoặc English khi bật toggle English), placeholder điền bằng `sampleValues`.

- **Email**: khối dòng subject (`rounded-xl border bg-card`, icon `Mail`, subject đậm, truncate); khung mail (`rounded-xl border`) gồm thanh người gửi ("GrapeSEED Support", "to <email mẫu>"), body `previewHtml(body)` với kiểu chữ cho p/h1/ul/ol/a/strong, nút CTA màu primary, footer `text-xs text-muted-foreground`.
- **SMS**: khung điện thoại (`rounded-[1.75rem] border-4 border-foreground/15`) có tên app và một bong bóng tin; dưới là 3 ô `Encoding`, `Chars`, `Segments` (ô Segments warning khi > 1).
- **Notification**: khung màn hình khóa (giờ `9:41`, thẻ thông báo: icon app, tên app, "now", title `line-clamp-1`, body `line-clamp-2`); dưới là thẻ mở rộng (title + body đầy đủ).
- Field trống → `Not translated` (nghiêng, `text-warning-foreground dark:text-warning`).
- `dir="rtl"` khi preview ngôn ngữ RTL.

### 4.5 Helper text — giữ và bỏ

| Repo tham chiếu | Bản này |
|---|---|
| Empty state nhắc `sample-data/templates.json`, "creating one in the UI is not built yet" | Bỏ; chỉ "No templates in this channel yet." |
| Mục "Placeholders in this template" | Bỏ |
| Đoạn "A segment holds 160 characters in GSM-7, and 153 once the message splits…" | Bỏ (giữ 3 ô số) |
| Bộ đếm "(English: N)" và "- likely to be cut off" | Bỏ; chỉ `45/60`, đổi màu khi vượt |
| Badge "Unsaved" trên từng field | Bỏ (viền trái đã cho biết) |
| Nhãn "In the inbox", "Expanded" | Bỏ |
| "English changed since this was translated." | Rút gọn: "English changed" + "Still correct" |
| "Subject not translated yet" | Rút gọn: "Not translated" |
| Prompt thêm link "Link address - a URL, or a placeholder such as {link}" | Rút gọn: "Link address" |
| Status badge, lỗi validation, bộ đếm số, ô thống kê SMS, tổng field ở footer | Giữ |

Tooltip `title` của nút icon và `aria-label` vẫn giữ (không hiện trên màn hình, cần cho khả năng tiếp cận).

### 4.6 Rich text editor

Port behavior của repo tham chiếu: `contenteditable`, `document.execCommand`, `defaultParagraphSeparator = p`, dán chỉ lấy chữ thuần, giá trị xuất qua `cleanHtml`, chỉ ghi lại DOM khi giá trị đổi từ bên ngoài. Thanh công cụ `border-b bg-muted/40`, nút ghost `size-7` (giữ selection bằng `onMouseDown preventDefault`): Bold · Italic · Underline | Heading (bật/tắt h1) · Bulleted list · Numbered list | Link (`window.prompt("Link address")`) · Remove link. Vùng soạn `min-h-52 px-3 py-2 text-sm`, placeholder rỗng "Add translation…".

## 5. Lỗi và edge case

- **Tải lỗi** → khối lỗi + Retry; **Save lỗi** → toast lỗi, dialog giữ nguyên edit.
- **Đổi ngôn ngữ khi dialog mở** (qua language picker ở topbar) → dialog được key theo `${id}:${language}`, nên nó mount lại với ngôn ngữ mới và edit của ngôn ngữ cũ bị bỏ, không hỏi (topbar không biết dialog đang có edit). Đây là chủ ý: edit viết cho ngôn ngữ này không bao giờ được lưu vào ngôn ngữ khác.
- **Đổi kênh** → trang remount (segment khác), dialog đóng.
- **Keep English** và edit loại trừ nhau trên một field; router từ chối keep cho English (đã có test ở #1–2).
- **HTML hỏng** trong body (vd. thiếu `</p>`) → validation error trên field; preview vẫn render qua whitelist, không vỡ trang.
- **Nội dung độc hại** trong bundle (`<script>`, thuộc tính `on*`) → preview escape qua `previewHtml`, English qua `safeHtml`; không có HTML nào khác đi vào `dangerouslySetInnerHTML`.
- **`?template=` sai** → không mở dialog; **`?owner=` sai** → All products sau khi tải; **`?category=`/`?status=` sai** → All.

## 6. Kiểm thử

**Vitest**:
- `template-view` (entry tổng hợp): `parseTemplateFilters` fallback; `resolveOwner`; `ownerProject` cho cả 6 owner của seed (5 map được, `web/curriculum` → nhãn "Curriculum", `project: null`); `ownersOf` sắp theo nhãn; `categoriesOf` giữ thứ tự `templateCategories`; `matchesStatus` cho 5 giá trị; `filterTemplates` theo category/owner/status/q (q khớp cả text của field); `summarise` và `percent`.
- `router` — `GET /templates` trên seed:
  - `messages/email` `vi`: 10 template, 40 field, 39 translated, 1 needs_fix — `visitation_scheduled`.
  - `messages/sms` `vi`: 5 template, 5 field, 5 translated. `messages/notification` `vi`: 6 template, 12 field, 12 translated.
  - `messages/email` `en`: 40/40 translated.
  - Sửa body của `visitation_scheduled` ở `vi` (lấy `target` hiện tại, nối thêm `</p>`) qua `PUT /translations/vi?target=messages/email` → template đó `needsFix` về 0.

**Gate:** `npm run typecheck`, `npm test`, `npm run build`.

**Kiểm tra UI** (script CDP tạm như #1–2 và #4, chờ hydrate trước khi thao tác):
- `/messages/email?lang=vi`: stat cards 98% · 39 · 1 · 0; tabs category có số; bảng 10 dòng; `visitation_scheduled` có viền warning và pill "1 to fix".
- Bấm Needs fix → còn 1 dòng. Chọn product → lọc đúng. Gõ ⌘K → lọc theo text.
- Mở `visitation_scheduled` → body có lỗi `html`; sửa ở chế độ HTML thêm `</p>` → Save → toast, pill "to fix" biến mất, stat Needs fix 0.
- Sửa một field rồi đóng → hộp confirm; hủy thì dialog còn mở.
- Toggle preview English/Vietnamese đổi nội dung preview.
- `?lang=en` → pill "View only", không stat cards, dialog không có ô dịch/Save.
- `/messages/sms`: cột Segments; dialog có bộ đếm SMS và 3 ô thống kê.
- `/messages/notification`: preview màn hình khóa + thẻ mở rộng.
- Không còn các helper text đã bỏ ở §4.5 (kiểm bằng tìm chuỗi trong DOM).

## 7. Giữ nguyên

Theme tokens; mọi behavior của workspace UI và Import; hợp đồng API và mock backend.
