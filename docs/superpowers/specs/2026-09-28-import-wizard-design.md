# Import wizard — Design

Ngày: 2026-09-28
Phạm vi: sub-project #4 trong lộ trình feature parity với `D:\example_projects\localizer` (gọi tắt: **repo tham chiếu**). Xây trên nền của sub-project #1–2 (`docs/superpowers/specs/2026-09-27-foundation-workspace-parity-design.md`), cùng branch `feat/workspace-parity`.

## 1. Mục tiêu

Người dùng nhập một đợt file ngôn ngữ (`.json`) vào một project: xem trước chính xác từng file sẽ thay đổi gì, rồi mới ghi. Behavior theo repo tham chiếu (`src/pages/import_page.tsx`, `src/lib/bundle_diff.ts`, `src/components/translations/bundle_diff_view.tsx`, `src/hooks/use_target_bundles.ts`); UI/UX và implementation style theo repo này. Nguyên tắc port giữ như spec #1–2 §1.

**Ngoài phạm vi:** dashboard (#3), màn hình template (#5), import file không phải JSON (`.arb`, `.po`…), hoàn tác một lần import.

## 2. Quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| I1 | Vị trí | Trang riêng `/import?target=<group>/<project>` trong route group `(workspace)`. Sidebar có mục "Import files"; nút Import của workspace dẫn tới trang với project chọn sẵn |
| I2 | Diff view | Port đủ behavior (group thu gọn được, header ghim, hunk `−/+`, số dòng, diffstat, bộ lọc, virtualized, validation), dựng lại bằng style của repo này |
| I3 | Chế độ | `merge` mặc định; `replace` qua checkbox "Clear the keys these files leave out" |
| I4 | Retire | Chỉ khi `replace`, sau khi **mọi** file ghi thành công: key không file nào trong đợt mang theo bị xóa khỏi project (`POST /keys/delete`, `scope: "all"`) |
| I5 | Draft | Import thành công xóa toàn bộ draft và selection của project đó; bước 4 cảnh báo trước nếu project đang có draft |
| I6 | Project cho phép | Cả 26 project, gồm 3 kênh Messages (như repo tham chiếu cho phép mọi target) |

## 3. Kiến trúc

### 3.1 Luồng dữ liệu

```
File (drop/chọn) → File.text() → parseBundleFile → StagedFile { id, name, values, language|null }
                                                        │ ngôn ngữ của các file
                                                        ▼
                                  useTargetBundles(target, codes) → fetchEntries(target, code) mỗi ngôn ngữ còn thiếu
                                                        │ rows theo ngôn ngữ
                                                        ▼
                                  diffBundle(rows, values, { mode, language, lengthBudget, maxLength }) → BundleDiff
                                                        │ Confirm
                                                        ▼
            importBundle(target, lang, values, mode) lần lượt, English trước (importOrder)
                                                        │ nếu replace và không file nào lỗi
                                                        ▼
            deleteKeys({ target, keys: retiredKeys(...), scope: "all" })  →  xóa draft của project  →  refresh()
```

Không có route API mới: `PUT /import/:lang`, `POST /keys/delete`, `GET /entries` đã có từ #1–2. `lib/api.ts` vẫn là module duy nhất chạm backend.

### 3.2 File

```
app/(workspace)/import/page.tsx        server component: <Suspense><ImportWizard /></Suspense>
lib/bundle-diff.ts                     port: BundleFileError, DiffKind, DiffEntry, DiffCounts, BundleDiff,
                                       CHANGED_KINDS, parseBundleFile, diffBundle, changeCount
lib/diff-groups.ts                     tách từ bundle_diff_view (thuần): DiffFilter, GroupDiff, DiffRow, LineNumbers,
                                       groupsOf, numberEntries, flattenGroups, pinnedHeader
lib/import-plan.ts                     tách từ import_page (thuần): languageFromName, duplicatedLanguages,
                                       retiredKeys, importOrder, blockerOf
hooks/use-target-bundles.ts            port: rows của một project ở nhiều ngôn ngữ, cache theo target
components/import/import-wizard.tsx    trang 4 bước, state của đợt import
components/import/project-picker.tsx   popover chọn project (dựng trên PopoverMenu)
components/import/language-picker.tsx  popover chọn ngôn ngữ cho một file (dựng trên PopoverMenu)
components/import/file-row.tsx         một file đã nạp
components/import/bundle-diff-view.tsx diff kiểu pull request
components/import/import-results.tsx   kết quả sau khi ghi
tests/bundle-diff.test.ts, tests/diff-groups.test.ts, tests/import-plan.test.ts
tests/router.test.ts                   thêm describe("import")
```

Sửa:
- `components/translation-workspace.tsx` — nút Import thành `Link`.
- `components/app-sidebar.tsx` — mục "Import files".
- `lib/projects.ts` — thêm `findProjectByTarget(target): Project | null` (ngược của `targetOf`).
- `lib/drafts.ts` — thêm `clearTarget(state, target): DraftState`, xóa mọi slot `{target}:*` và selection của target (dùng cho I5); có test trong `tests/drafts.test.ts`.

Cờ ngôn ngữ đang nằm trong `app-topbar.tsx`; chuyển `flags` sang `lib/language-flags.ts` để topbar và language picker của import cùng dùng.

### 3.3 Hợp đồng các hàm thuần

- `languageFromName(name): LanguageCode | null` — bỏ `.json`, tách theo `.` và `_` (không tách `-`), so khớp không phân biệt hoa thường với 13 mã. Không khớp → `null`, không đoán.
- `duplicatedLanguages(files): Set<LanguageCode>` — ngôn ngữ được hơn một file nhận.
- `retiredKeys(mode, registryRows, files): string[]` — `[]` khi `merge` hoặc chưa có rows; ngược lại là key của registry không nằm trong bất kỳ file nào.
- `importOrder(files): StagedFile[]` — file English lên đầu, còn lại giữ thứ tự.
- `blockerOf(state): string | null` — câu giải thích vì sao Confirm khóa, theo thứ tự: chưa chọn project → chưa có file → file chưa có ngôn ngữ → trùng ngôn ngữ → tải lỗi → đang tải → không có thay đổi. `null` khi được phép.
- `groupsOf(entries, filter)`, `numberEntries(entries)`, `flattenGroups(groups, collapsed)`, `pinnedHeader(rows, items, offset)` — đúng như bản tham chiếu (§4.3).

## 4. Giao diện

Khung trang giống workspace: `mx-auto max-w-[1400px] px-6 py-6`.

### 4.1 Header

Breadcrumb `Tools / Import`, tiêu đề "Import language files", mô tả một dòng ("Nothing is written until you confirm."). Bên phải: nút outline "Back to <project>" khi đã chọn project (link về `/<target>`).

### 4.2 Bốn bước

Mỗi bước là card `rounded-xl border border-border bg-card p-5`; tiêu đề có số trong vòng tròn `size-6 rounded-full bg-muted text-xs`. Bước chưa mở: `opacity-40 pointer-events-none`, `aria-disabled`. Cả bốn bước luôn hiện trên cùng một trang.

1. **Which project** — nút mở popover (pattern `PopoverMenu`), liệt kê project theo nhóm như sidebar. Chọn → ghi `?target=` bằng `router.replace`. `target` không khớp project nào → coi như chưa chọn. Đổi project: giữ file, xóa kết quả import.
2. **The files** — mở khi đã chọn project.
   - Vùng thả: viền dashed `rounded-xl`, icon `Upload`, "Drop .json files here", ghi chú flat/nested khi chưa có file, nút outline "Choose files" (input ẩn, `accept="application/json,.json"`, `multiple`, reset value sau mỗi lần chọn). Khi kéo qua: `border-primary bg-accent/40`.
   - Danh sách: card chia dòng; mỗi dòng: `FileJson`, tên file mono (bấm để chọn file xem diff; dòng đang chọn `bg-accent/40`), pill "N keys", pill "N changes" (primary khi > 0, muted khi 0; chỉ hiện khi đã có diff), số lỗi destructive kèm `AlertTriangle`, language picker (cờ + tên; placeholder "Choose a language…"; viền destructive khi trùng), nút ✕ gỡ file.
   - File đọc lỗi: toast lỗi "N files could not be read", mô tả liệt kê `tên - lý do`.
3. **What it would change** — mở khi có ít nhất một file.
   - Tải bundle lỗi: dòng destructive + nút Retry (tải lại các ngôn ngữ đang cần). Đang tải: skeleton.
   - File đang chọn chưa có ngôn ngữ: "Say which language <file> is, and its diff appears here."
   - Có diff: dòng `<file> → <Language>`, rồi diff view (§4.3), rồi dòng báo key có tên không hợp lệ sẽ bị bỏ qua (số lượng + 3 key mẫu).
   - Checkbox "Clear the keys these files leave out" (shadcn `Checkbox`, `Label`). Khi bật và `retiredKeys` không rỗng: khối cảnh báo `rounded-xl border border-destructive/30 bg-destructive/5 text-destructive` nói N key sẽ bị xóa khỏi project ở mọi ngôn ngữ, kèm 3 key mẫu.
4. **Confirm** — mở khi có ít nhất một file.
   - Nút primary `Import N files · M changes` (disabled khi `blockerOf` khác null hoặc đang import; nhãn "Importing…" khi đang chạy), bên cạnh là câu của `blockerOf` bằng `text-muted-foreground`.
   - Project có draft chưa lưu: dòng warning "N unsaved edits in <project> will be discarded after the import."
   - Sau khi chạy: thay bằng kết quả (§4.4).

### 4.3 Diff view

- **Thanh lọc**: pill (style version pills) Changes / New / Added / Changed / Removed / Unchanged kèm số đếm; mặc định Changes; pill có số 0 disabled. Bên phải: "N would fail a check" (destructive) khi `errors > 0`.
- **Card diff** `rounded-xl border border-border bg-card overflow-hidden`:
  - Thanh tổng `bg-muted/40`: `N groups · N keys`, diffstat, nút ghost "Collapse all" / "Expand all".
  - Vùng cuộn riêng `h-[min(46vh,24rem)] overflow-auto overscroll-contain`, virtualized (`@tanstack/react-virtual`, key theo row: `@<group>` cho header, key cho hunk; ước lượng 41 / 104 px).
  - Header ghim: vẽ tuyệt đối ở mép trên (không dùng `sticky`), chọn bằng `pinnedHeader`.
- **Group header** (nút toàn dòng, `aria-expanded`): chevron, tên mono, `AlertTriangle` khi có lỗi, "N keys", diffstat.
- **Diffstat**: `+n` (success) `−n` (destructive) và 5 ô `size-2`; ô xanh/đỏ/xám theo tỷ lệ, bên nào khác 0 có ít nhất một ô.
- **Hunk**: dải `bg-accent/50`: `@@ key @@` mono, English nghiêng (truncate), badge loại. Unchanged: một dòng ` `. Còn lại: dòng `−` (khi before khác rỗng) nền `bg-destructive/10 text-destructive`, dòng `+` (khi after khác rỗng) nền `bg-success/12 text-success`; hai cột số dòng `w-9 font-mono text-[11px]`; text `whitespace-pre-wrap`, `dir="rtl"` cho `ar-SA`. Issue bên dưới (error destructive, warning muted).
- **Màu badge loại** (token của repo): New `border-primary/30 bg-primary/10 text-primary`; Added `border-success/20 bg-success/12 text-success`; Changed `border-warning/30 bg-warning/15 text-warning-foreground dark:text-warning`; Removed `border-destructive/20 bg-destructive/10 text-destructive`; Unchanged không màu.
- **Rỗng**: Changes → "This file changes nothing in <Language>."; New → "Every key in this file is already in the project."; loại khác → "No <loại> keys."

### 4.4 Kết quả

Card chia dòng, mỗi file một dòng: tên mono; lỗi → `AlertTriangle` + thông điệp destructive; thành công → `N new · N added · N changed · N cleared → <file>` muted. Dưới card: lỗi retire (destructive) hoặc "N keys no file carried were removed from <project> and every one of its language files." Nút primary "Open <project>" (link `/<target>`). Toast: thành công "Imported N files into <project>" (kèm mô tả retire nếu có); có file lỗi "X of N could not be written - see the results below"; retire lỗi "Imported, but the keys left out could not be retired".

### 4.5 Sidebar và workspace

- Sidebar: mục "Import files" (icon `FileUp`) ngay trên "New application", cùng style nút footer nhưng viền liền; là `Link` tới `/import` (giữ `?lang=` như các link khác); tô sáng `bg-sidebar-accent` khi `pathname === "/import"`.
- Workspace: nút Import (outline, `FileUp`) thành `Link` tới `/import?target=<target>`; bỏ tooltip "Coming soon". Chỉ hiện khi project có key (như Export), vì import vào project rỗng vẫn làm được từ sidebar.
- Topbar trên `/import`: không có project nên language picker hiện "—" (hành vi hiện tại, không đổi).

## 5. Lỗi và edge case

- **File không phải JSON / không phải object / không có key / giá trị là list** → `BundleFileError`, gom vào một toast; file khác vẫn được nạp.
- **File lồng nhau** → làm phẳng thành key có dấu chấm; số/boolean thành chuỗi; `null` thành `""`.
- **Tên file không nói ngôn ngữ** → để trống, Confirm khóa cho tới khi chọn.
- **Hai file cùng ngôn ngữ** → viền đỏ ở cả hai, Confirm khóa.
- **Project chưa có key** → rows rỗng; mọi key hợp lệ trong file là New; import vẫn chạy (route trả 404 chỉ khi cả registry lẫn file đều không có key hợp lệ).
- **Key tên không hợp lệ** → bỏ qua, nêu tên trong diff và trong kết quả.
- **Một file ghi lỗi** → vẫn ghi các file còn lại; không retire; kết quả và toast nêu rõ.
- **Retire lỗi** → file đã ghi giữ nguyên; kết quả nêu lỗi retire.
- **Đổi project khi đã có file** → giữ file, tải lại bundle của project mới, xóa kết quả cũ.
- **Draft** → xóa theo I5 chỉ khi ít nhất một file ghi thành công.

## 6. Kiểm thử

**Vitest** (logic không có UI):

- `bundle-diff`:
  - `parseBundleFile`: flat; nested → dotted; số/boolean/null; JSON hỏng, mảng gốc, object rỗng, giá trị là list → `BundleFileError` với thông điệp đúng.
  - `diffBundle` trên rows tổng hợp: merge giữ key vắng mặt (unchanged); replace làm rỗng (removed); before rỗng → added; khác nhau → changed; key lạ hợp lệ → new (source = value khi file là `en`, rỗng khi không); key lạ không hợp lệ → `invalid`; `errors` đếm entry có issue level error; `changeCount`.
- `diff-groups`: `groupsOf` lọc theo filter và tính additions/deletions như `git` (changed = +1 −1, unchanged = 0); `numberEntries` không đánh số phía rỗng; `flattenGroups` bỏ hunk của group thu gọn; `pinnedHeader` trả null khi chưa cuộn và khi header của chính group còn trên màn hình.
- `import-plan`: `languageFromName` (`vi.json`, `school.vi.json`, `vi_VN.json`, `zh-Hans.json`, `ZH-HANS.json`, `messages.json` → null); `duplicatedLanguages`; `retiredKeys` (merge → []; replace → key không file nào mang, tính trên cả đợt); `importOrder` (en lên đầu); `blockerOf` theo đúng thứ tự ưu tiên.
- `router` — `PUT /import/:lang` trên `web/school-portal`:
  - merge `{ "user.form.actions.cancel": "Hủy bỏ", "home.brand.fresh": "Mới", "bad key.x": "x" }` → `changed 1, created 1, unchanged 499, invalid ["bad key.x"]`; `home.brand.fresh` có mặt ở `en` với trạng thái missing.
  - replace `{ "user.form.actions.cancel": "Hủy bỏ" }` → `changed 1, removed 499`.
  - project rỗng và file chỉ có key không hợp lệ → 404.

**Gate:** `npm run typecheck`, `npm test`, `npm run build`.

**Kiểm tra UI** (script CDP tạm, như #1–2): mở `/import?target=web/school-portal`; nạp `vi.json` (tự nhận Vietnamese) có một thay đổi và một key mới → diff hiện Changed 1 / New 1; nạp thêm file không đoán được ngôn ngữ → Confirm khóa với câu đúng; chọn ngôn ngữ trùng → viền đỏ; bật Replace → khối cảnh báo retire; Import → kết quả đúng số, toast, sidebar/coverage cập nhật; draft của project bị xóa; nút Import ở workspace dẫn vào trang với project chọn sẵn; mục sidebar "Import files" tô sáng trên `/import`.

## 7. Giữ nguyên

Theme tokens, font, spacing; mọi behavior của workspace ngoài nút Import; hợp đồng API và mock backend (không đổi route).
