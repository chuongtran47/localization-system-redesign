# Nền tảng + Translation Workspace parity — Design

Ngày: 2026-09-27
Phạm vi: sub-project #1 (nền tảng) và #2 (translation workspace) trong lộ trình đạt feature parity với `D:\example_projects\localizer` (gọi tắt: **repo tham chiếu**).

## 1. Bối cảnh và mục tiêu

Repo này và repo tham chiếu đều là mockup redesign cho trang Localizer trên PROD. Repo này có theme, visual style và design direction cần giữ; repo tham chiếu có đầy đủ tính năng hơn nhiều.

**Mục tiêu:** repo này giữ nguyên chất lượng và phong cách redesign hiện có, nhưng đạt feature parity với repo tham chiếu.

**Nguyên tắc khi port:**

- Behavior/functionality theo repo tham chiếu; UI/UX và implementation style theo repo này.
- Không copy UI/theme của repo tham chiếu. JSX viết lại bằng class/pattern hiện có (`rounded-xl border bg-card`, nhãn `text-[11px] uppercase tracking-wider`, pill `rounded-full`, `StatCard`, menu popover tự dựng…).
- Logic domain không dính UI (`lib/`, `mock/`) được port gần như nguyên văn.
- Tái sử dụng component/pattern hiện có; không tạo abstraction thừa.
- Không làm mất feature hiện có nếu không cần thiết.

**Lộ trình tổng** (mỗi sub-project có vòng spec → plan → implement riêng):

1. Nền tảng — **spec này**
2. Translation workspace — **spec này**
3. Dashboard
4. Import wizard
5. Message templates (Email / SMS / Notification)

**Ngoài phạm vi spec này:** dashboard, import wizard, templates, auth, publish/lock thật.

## 2. Quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| D1 | Chia việc | 5 sub-project; spec này gộp #1 + #2 |
| D2 | Danh sách target | Giữ 23 project + 4 nhóm hiện tại (Web/Mobile/Content/Services). **School Portal** mang sample data `web/school` của repo tham chiếu. Các project khác mở empty state theo profile. Thêm nhóm **Messages** (Email/SMS/Notification) — ở spec này chỉ là item điều hướng hiển thị empty state; màn hình template thuộc #5 |
| D3 | Section tabs | Thay bằng **Group filter** (combobox tìm kiếm được; group = segment đầu của key) |
| D4 | Version pills | Giữ, filter chạy thật trên release gán giả lập bằng hash tất định của key |
| D5 | Lock, Publish, Bell, workspace switcher, "New application" | Giữ UI, tiếp tục inert (không có behavior tham chiếu) |
| D6 | Ô search ⌘K ở topbar | Nối vào filter `q` của workspace |
| D7 | Tầng data | Mock backend **chỉ chạy trong trình duyệt** trên IndexedDB; `lib/api.ts` gọi router in-process. Không có Next Route Handler, không có file store |
| D8 | Ngôn ngữ | 13 ngôn ngữ của repo tham chiếu (en, zh-Hans, ms, ja, ko, ru, vi, mn, es, ar-SA, th, my, km); giữ cách trình bày cờ + số + % của picker hiện tại. Mặc định `vi` |
| D9 | Animation | Không thêm thư viện `motion`; chỉ dùng `tw-animate-css` đã có |
| D10 | UI primitives | Thêm component shadcn cùng style `base-nova` |
| D11 | Test | Thêm vitest cho domain thuần |
| D12 | Quy ước file | Giữ kebab-case của repo này, không theo snake_case của repo tham chiếu |

## 3. Kiến trúc

### 3.1 Luồng dữ liệu

```
Page (server)  →  Workspace (client)  →  hook  →  lib/api.ts
                                                     │  in-process, không fetch
                                                     ▼
                                              mock/router.ts  (Request → Response)
                                                     ▼
                                              mock/store.ts   (FileStore)
                                                     ▼
                                        mock/browser-backend.ts (IndexedDB)
                                                     │  lần đầu: seed
                                                     ▼
                                        fetch /sample-data/locale/*.json
```

**Ranh giới:**

- `lib/api.ts` là module duy nhất biết có backend. Không component/hook nào gọi `fetch` hoặc import từ `mock/`.
- Luật domain (`statusOf`, `isValidKey`, `checkTranslation`, `statusIssues`) định nghĩa ở `lib/`, được `mock/` import; không viết lại ở phía kia.
- `components/ui/` do shadcn sinh; không đặt logic app trong đó.
- IndexedDB chỉ được chạm tới sau khi mount trên client (bên trong `api.ts` → `browser-backend.ts`); không có truy cập trong SSR.
- Mọi route mang key đều scope theo một target (mỗi project là một key namespace riêng).

### 3.2 Cấu trúc thư mục

```
app/
  layout.tsx                              + ThemeProvider (next-themes, attribute="class"), Toaster
  page.tsx                                "/" → redirect tới project đầu tiên (Dashboard ở #3)
  [group]/[project]/page.tsx              workspace của một project
  [group]/layout.tsx                      shell: AppSidebar + AppTopbar + <main>
lib/
  projects.ts        23 project + nhóm Messages; profile từng project (thay nav_items + target_profiles)
  locale-data.ts     port: languages, SOURCE_LANGUAGE, statusOf, statusLabel, groupKeyOf,
                     isValidKey, displayedValueOf, groupOptionsOf, kiểu TranslationRow…
  validation.ts      port: checkTranslation, statusIssues
  release.ts         releaseOf(key): version giả lập bằng hash tất định
  api-types.ts       port: hợp đồng request/response
  api.ts             port: client, gọi thẳng mock router
  clipboard.ts, file-name.ts, format-date.ts   port
  data.ts            xóa sau khi mọi nơi chuyển sang các module trên
mock/
  router.ts, store.ts, file-store.ts, browser-backend.ts, zip.ts   port
public/sample-data/
  locale/<code>.json (13 file), templates.json
hooks/
  use-translation-rows.ts
  use-coverage.ts        badge sidebar + số translated/total của language picker
components/
  app-sidebar.tsx, app-topbar.tsx        giữ giao diện; điều hướng qua Link/usePathname
  status-badge.tsx                       mở rộng lên 4 trạng thái
  theme-toggle.tsx                       mới
  translation-workspace.tsx              viết lại logic, giữ layout
  translation-row.tsx                    thay translation-table.tsx
  translations/
    add-key-dialog.tsx, delete-keys-dialog.tsx, export-dialog.tsx,
    group-filter.tsx, project-profile-card.tsx
  ui/                                    shadcn generated
```

### 3.3 Route và URL

- `/{group}/{project}`, ví dụ `/web/school-portal`. Slug group: `web | mobile | content | services | messages`; id project giữ như `lib/data.ts` hiện tại. Nhóm Messages dùng id `email`, `sms`, `notification`.
- Query string mang filter để link có thể chia sẻ/bookmark: `?lang=vi&group=nav&status=missing&q=…&version=v12`. Ghi bằng `router.replace` để lọc không làm đầy lịch sử back.
- Target path của mock (`target`) = `"{group}/{project}"`. Seed gắn bundle School vào `web/school-portal`.
- URL chứa project không tồn tại → redirect về project đầu tiên.

### 3.4 Profile của project

Mỗi project có: `kind` (`ui` | `email` | `sms` | `notification`), `audience`, `tone`, `note`, `lengthBudget`, `maxLength?`, `measured`. School Portal lấy profile `web/school` của repo tham chiếu (`measured: true`). 22 project còn lại và 3 kênh Messages có profile suy luận (`measured: false`), `lengthBudget` 1.5 cho Web/Content/Services và 1.3 cho Mobile.

### 3.5 Phụ thuộc mới

`next-themes`, `sonner`, `@tanstack/react-virtual`, `cmdk` (qua shadcn `command`); dev: `vitest`. Component shadcn: `dialog`, `select`, `checkbox`, `input`, `textarea`, `label`, `popover`, `command`, `tooltip`, `sonner`, `skeleton`.

## 4. Workspace

Layout giữ trình tự hiện tại từ trên xuống.

### 4.1 Page header

- Giữ breadcrumb `Group / Translations`, tiêu đề project, dòng "Managing *X* translations · *N* keys".
- Thêm badge loại nội dung và badge "Inferred" khi `measured: false`.
- Nút bên phải, giữ thứ tự và style:
  - **Export** → `ExportDialog` (ẩn khi project chưa có key).
  - **Import** (mới, outline) → disabled, tooltip "Coming soon" cho tới #4.
  - **Lock**, **Publish ▾** → inert như hiện tại.
  - **Add key** → `AddKeyDialog`.

### 4.2 Stat cards

Dùng lại `StatCard`, bổ sung khả năng click (`<button aria-pressed>`; card active có `border-primary/60 bg-accent/30`):

| Card | Giá trị | Click lọc |
|---|---|---|
| Translation progress | `%` + thanh tiến độ | `all` |
| Translated | count | `translated` |
| Needs fix | count | `needs_fix` |
| Missing | count, phụ đề "N outdated" | `missing` |

Card "Pending review" hiện tại bị thay bằng "Needs fix" — mô hình trạng thái của repo tham chiếu không có pending.

### 4.3 Version pills

Giữ component hiện tại. Danh sách version lấy từ `release.ts`. `All` = không lọc. Ghi vào `?version=`. Thanh tiến độ và số đếm tính trên toàn ngôn ngữ (không theo version), giống repo tham chiếu tính không theo group/search.

### 4.4 Filter bar

Thay chỗ section tabs, cùng style gạch chân:

- **GroupFilter**: combobox (shadcn `popover` + `command`), mỗi group hiện `outstanding / total`; sentinel "All groups".
- **Status pills**: All / Missing / Outdated / Needs fix / Translated / Added here (chỉ hiện khi có key `origin: manual`), kèm số đếm.
- Badge "N keys" = số dòng sau khi lọc.
- Search dùng ô ⌘K của topbar (ghi `?q=`); phím ⌘K/Ctrl+K focus ô đó.

Thứ tự áp filter: group → status → version → text (khớp key, English, bản dịch; không phân biệt hoa thường).

### 4.5 Bảng và row editor

- Khung giữ nguyên: `rounded-xl border bg-card`, header `bg-muted/40 text-[11px] uppercase tracking-wider`.
- Virtualized bằng `@tanstack/react-virtual`; header là grid cùng cột với row, nằm trên vùng cuộn.
- Cột: checkbox chọn tất cả (theo danh sách đang lọc, có trạng thái indeterminate) · Key + English · bản dịch (tiêu đề = tên ngôn ngữ) · Status + audit · Actions.

**Row editor** (một component, port behavior của `translation_row.tsx`):

- Ô sửa luôn hiện: `input` khi English ≤ 60 ký tự, `textarea` tự giãn khi dài hơn. Placeholder là English khi dòng missing do copy English (`displayedValueOf`). `dir="rtl"` cho `ar-SA`. Không còn chế độ click-để-sửa và lưu từng dòng: sửa dồn vào tray rồi Save all.
- Trạng thái trực quan: viền trái primary khi dirty; destructive khi có issue `error`; warning khi có issue `warning`; nền `bg-destructive/5` khi đang được chọn.
- Dưới ô sửa: danh sách issue từ `checkTranslation(source, value, { language, lengthBudget, maxLength })`.
- Actions (hiện khi hover/focus như hiện tại):
  - **Copy** — English ra clipboard (`copyText`), toast thành công/thất bại.
  - **Paste** — English vào ô.
  - **Keep English** — khi `missing` (hoặc outdated mà đang kept), không phải ngôn ngữ nguồn, English không rỗng.
  - **Confirm** — khi `outdated` và không kept: ghi lại giá trị hiện tại để làm mới snapshot English.
  - **History** — tooltip: Created by/at, Updated by/at (`formatDateTime`).
  - **Delete** — mở `DeleteKeysDialog` cho riêng key này.
- Badge **New** khi `origin: manual`.

**Quy tắc dirty** (port nguyên): sửa về đúng giá trị đang hiển thị → không dirty. Keep và edit loại trừ nhau trên cùng key.

### 4.6 Hai tray ở đáy

Xếp chồng, tray chọn nằm trên tray chưa lưu; xuất hiện bằng `animate-in slide-in-from-bottom` của `tw-animate-css`. Style giống thanh hiện tại: `border-t bg-card`, nút theo style trong repo.

- **Chọn nhiều:** "N selected (M in view)" · Clear · Delete. Selection reset khi đổi project, giữ khi đổi ngôn ngữ.
- **Chưa lưu:** "N unsaved keys" · Discard · Save all. Save gọi `saveTranslations(target, lang, edits, keeps)`; thành công → xóa edits/keeps, reload, toast "Saved N keys — Written to <file>".

### 4.7 Dialog

Dựng trên shadcn `dialog`, bề mặt theo card hiện tại (`rounded-xl`, header chữ `font-semibold tracking-tight`, mô tả `text-muted-foreground`).

- **AddKeyDialog:** trường key + English. Kiểm `isValidKey` ngay khi gõ; 409 từ server → lỗi "đã tồn tại" dưới trường key. Thành công → màn fan-out: 13 ngôn ngữ, English mang source, 12 ngôn ngữ còn lại là link vào workspace ở ngôn ngữ đó với `q=<key>`. Nút "Add another" giữ dialog mở. Đóng → reload và đặt `q=<key>`, xóa `status`/`group`.
- **DeleteKeysDialog:** hỏi scope — "Chỉ *<ngôn ngữ>*" (`language`) hoặc "Toàn bộ *<project>*" (`all`), liệt kê key (rút gọn khi nhiều). Thành công → bỏ edits/keeps/selection của các key đó, reload, toast kèm số key và file đã ghi.
- **ExportDialog:** pattern tên file (mặc định `{lang}.json`); mỗi ngôn ngữ một checkbox + tên file sửa được (tên gõ tay giữ nguyên khi đổi pattern); All/None; English và ngôn ngữ đang làm được tick sẵn; tên archive (mặc định `<project>-translations`, hậu tố `.zip` cố định); "Include untranslated keys" (mặc định bật). Chặn tên trùng (không phân biệt hoa thường) ở cả dialog và router; hiện tên đã chuẩn hóa khi khác tên đã gõ. Export luôn là toàn bộ project, không theo filter. Kết quả tải về `.zip`.

### 4.8 Sidebar và topbar

- **Sidebar:** giữ giao diện. Item là `Link`, active theo `usePathname`. Thêm nhóm Messages. Badge `pending`: số thật lấy từ `GET /coverage` (port nguyên; tổng theo từng target) — missing + outdated + needs_fix của ngôn ngữ đang chọn; project không có key → không hiện badge. Coverage được tải lại sau mỗi Save/Delete/AddKey/Reset. Ô filter giữ nguyên. "New application" inert.
- **Topbar:** giữ giao diện. Language picker ghi `?lang=`, hiện translated/total thật và % mỗi ngôn ngữ. Ô search ghi `?q=`. Thêm `ThemeToggle` cạnh chuông. User menu (hiện inert) có mục "Reset demo data" → `POST /reset`, reload, toast.

### 4.9 Status badge

Mở rộng `StatusBadge`/`StatusDot` lên 4 trạng thái, giữ cấu trúc hiện tại:

| Trạng thái | Nhãn | Màu |
|---|---|---|
| translated | Translated | `success` |
| missing | Missing | `destructive` |
| outdated | Outdated | `info` (token mới) |
| needs_fix | Needs fix | `warning` |

Thêm token `--info` / `--info-foreground` (light, dark, và khối `prefers-color-scheme`) theo công thức oklch hiện có; ngoài ra `globals.css` không đổi.

## 5. Loading, lỗi, edge case

- **Đang tải:** skeleton rows (`bg-muted animate-pulse`) trong khung bảng; stat card hiện `—`.
- **Tải lỗi:** dòng `text-destructive` kèm nút Retry (`reload`).
- **Save/Delete/AddKey/Export lỗi:** toast lỗi với `messageOf(cause)`; dialog giữ mở.
- **Seed lỗi** (fetch sample-data thất bại): lỗi rõ ràng ở vị trí bảng, có Retry.
- **Project chưa có key:** `ProjectProfileCard` (audience, tone, note) + Add key, theo style empty state dashed hiện tại. Nhóm Messages ở spec này cũng rơi vào trạng thái này.
- **Project không tồn tại:** redirect về project đầu tiên.
- **SSR:** page là server component chỉ đọc `params`; workspace là `"use client"`, mọi truy cập dữ liệu chạy sau mount.
- **Trình duyệt cũ:** export dùng `CompressionStream("deflate-raw")`; nếu không hỗ trợ → toast lỗi, các màn khác vẫn chạy.

## 6. Kiểm thử và xác minh

**Vitest** (chỉ domain thuần), chạy trên sample data thật:

- `statusOf`: số đếm theo trạng thái của `web/school` ở `vi` và `km` khớp đúng với con số repo tham chiếu trả về trên cùng sample data (lấy bằng cách chạy code tham chiếu một lần, ghi cứng vào test); `visitation_scheduled` ở `vi` là `needs_fix`.
- `isValidKey`: chấp nhận camelCase, `/`, `-`; từ chối key không có dấu chấm.
- `checkTranslation`: placeholder drift, HTML không cân bằng.
- `zip`: archive đọc lại được (header và CRC hợp lệ).
- Router: tạo key → 13 file; trùng → 409; xóa scope `language` vs `all`; export `includeUntranslated: false` loại key missing.

**Gate:**

- `npm run build` (Next build + type-check) phải qua.
- `npm test` (vitest) phải qua.
- Lint: repo khai báo `eslint` nhưng chưa cài và chưa có config — không dùng làm gate.
- Chạy `next dev` và click qua trong trình duyệt: đổi project, lọc group/status/version/search, sửa → Save all, Discard, Keep English, Confirm outdated, Copy/Paste, xóa một dòng và xóa hàng loạt ở cả hai scope, Add key + fan-out link, Export zip rồi giải nén thử, đổi ngôn ngữ (gồm `ar-SA` RTL), theme sáng/tối, Reset demo data.

## 7. Giữ nguyên

- Theme tokens (trừ bổ sung `info`), font Geist, spacing, kích thước sidebar (`w-72`) và topbar (`h-16`).
- Version pills, Lock, Publish menu, Bell, workspace switcher, user menu, "New application".
- Metadata trong `app/layout.tsx` (tên "Lingua").
