# Role: view developer và view translator — Design

Ngày: 2026-09-29
Phạm vi: sub-project **A** trong đợt xử lý feedback của CS cho Localizer Redesign (điểm #7). Các sub-project tiếp theo, theo thứ tự đã chốt:

- **B** — Overview ở `/`, điều hướng theo group, bớt số liệu kiểu report (#4, #2, #5)
- **C** — ID ổn định cho string, search toàn cục (#3, #1)
- **D** — Import rõ ràng, vòng CSV cho translator (#6)

Xây trên `master` hiện tại (`12fb848`).

## 1. Mục tiêu

Translator/người ngoài chỉ thấy việc xem và dịch string; developer/nội bộ thấy thêm các chức năng quản trị (Add key, Delete, Import/Export JSON, Lock/Publish, version). Hai view tách bạch bằng **một bảng quyền** mà mọi màn hình đọc — không ẩn rời rạc từng nút, không làm mờ.

**Ngoài phạm vi:** đăng nhập và phân quyền thật, gán ngôn ngữ cho từng translator, CSV (sub-project D), thay đổi số liệu/bố cục (sub-project B).

## 2. Quyết định đã chốt

| # | Chủ đề | Quyết định |
|---|---|---|
| R1 | Đổi role trong mockup | Menu người dùng có sẵn ở topbar thêm mục "View as"; trình duyệt nhớ lựa chọn |
| R2 | Ngôn ngữ của translator | Cả 12 ngôn ngữ dịch như hiện tại; English chỉ xem |
| R3 | Cách tách | Bảng quyền trong `lib/` + provider; màn hình hỏi quyền (`can.manageKeys`), không hỏi tên role |
| R4 | Lưu role | Cookie `lingua-role`, để layout server đọc được và render đúng role ngay lần đầu |
| R5 | Mặc định | Không có cookie hoặc giá trị lạ → `developer` (giữ nguyên hành vi hiện nay) |
| R6 | Route chỉ cho developer | Hiện khối giải thích + nút chuyển view; không redirect âm thầm |

## 3. Kiến trúc

### 3.1 `lib/roles.ts` (thuần)

```ts
export type Role = "developer" | "translator"
export const ROLES: Role[] = ["developer", "translator"]
export const DEFAULT_ROLE: Role = "developer"
export const ROLE_COOKIE = "lingua-role"
export const roleLabel: Record<Role, string> // "Developer", "Translator"

export type Capabilities = {
  manageKeys: boolean      // Add key, Delete key, chọn nhiều dòng
  editSource: boolean      // sửa bản English
  exchangeBundles: boolean // Import/Export JSON
  release: boolean         // Lock, Publish, lọc version, tab "Added here", badge "New"
  manageApps: boolean      // New application
}

export function capabilitiesOf(role: Role): Capabilities
export function parseRole(value: string | null | undefined): Role
```

| Quyền | developer | translator |
|---|---|---|
| `manageKeys` | ✓ | – |
| `editSource` | ✓ | – |
| `exchangeBundles` | ✓ | – |
| `release` | ✓ | – |
| `manageApps` | ✓ | – |

Việc dịch (sửa bản dịch, Keep English, Still correct, Save/Discard, dịch template) không phải một quyền — cả hai role đều làm được.

### 3.2 Lưu và đọc role

- `app/(workspace)/layout.tsx` (server) đọc `cookies().get(ROLE_COOKIE)`, `parseRole`, truyền `initialRole` vào `WorkspaceShell` → `RoleProvider`. HTML đầu tiên đã đúng role. Cái giá: `/import` (và mọi route trong group) render động.
- `components/role-provider.tsx` (client): state `role` khởi tạo từ `initialRole`; `useRole()` → `{ role, can, setRole }`. Khi `initialRole` đổi (server render lại sau khi cookie đổi), state theo server.
- `setRole(next)`: đặt state ngay (giao diện đổi tức thì), ghi `document.cookie = "lingua-role=<next>; path=/; max-age=31536000; samesite=lax"`, rồi `router.refresh()`. Draft dịch được giữ; surface quản trị theo quy tắc ở §3.4.

### 3.3 Chặn route chỉ dành cho developer

`components/role-gate.tsx`: `RoleGate({ capability, feature, children })` — có quyền thì render `children`; không thì hiện khối (card viền đứt như `ProjectProfileCard`): tiêu đề "`<feature>` is part of the developer view" và nút outline "Switch to developer view" (`setRole("developer")`). `/import` bọc `ImportWizard` bằng `RoleGate capability="exchangeBundles" feature="Import"`.

### 3.4 Đổi role khi đang mở surface quản trị (bắt buộc)

Modal và tray được render ở cấp workspace, tách khỏi nút mở trên header, nên ẩn nút là chưa đủ: một modal đang mở vẫn thao tác và submit được. Quy tắc:

1. **Draft dịch giữ nguyên** khi đổi role (cả hai chiều).
2. **Surface thuộc quyền bị mất phải unmount ngay trong lần render đổi role**:

   | Surface | Quyền | Nơi giữ state mở |
   |---|---|---|
   | `AddKeyDialog` | `manageKeys` | `UiWorkspace` (`isAddOpen`) |
   | `DeleteKeysDialog` (nút xóa từng dòng và xóa hàng loạt) | `manageKeys` | `UiWorkspace` (`doomed`) |
   | Tray "N selected" và danh sách dòng đang chọn | `manageKeys` | `DraftProvider` (`selected`) |
   | `ExportDialog` (workspace UI và trang template) | `exchangeBundles` | `UiWorkspace`, `TemplateWorkspace` (`isExportOpen`) |
   | Import wizard | `exchangeBundles` | state cục bộ của `ImportWizard` |

   Render mỗi surface với điều kiện `can.<quyền> && <state mở>`, nên nó biến mất cùng lần render role mới.
3. **Không tự mở lại khi quyền quay lại.** State mở được xóa khi quyền mất, không chỉ bị che:
   - `UiWorkspace` và `TemplateWorkspace` nhớ role mà chúng render lần trước; khi role khác đi, chúng đặt lại `isAddOpen = false`, `doomed = []`, `isExportOpen = false` ngay trong lúc render (mẫu "điều chỉnh state khi prop đổi" của React, không dùng effect).
   - `setRole` sang role không có `manageKeys` xóa danh sách dòng đang chọn của mọi project (`clearAllSelected` mới trong `lib/drafts.ts`). `RoleProvider` nằm trong `DraftProvider` để làm được việc này.
   - Import wizard bị `RoleGate` unmount, nên file đã thả vào và bước đang làm mất theo; chuyển về Developer thấy wizard mới từ đầu.
4. **Request đã gửi thì không thu hồi được.** Nếu một lệnh xóa/tạo/export đã gửi đi trước lúc đổi role, nó vẫn hoàn tất và làm mới dữ liệu. Sau khi đổi role, không còn nút hay form nào gọi được action quản trị.

## 4. Thay đổi trên từng màn hình

### 4.1 Topbar — menu người dùng (đã có)

- Dòng phụ dưới tên: "Maintainer" → `Developer view` / `Translator view`.
- Trong menu, trên "Reset demo data": nhãn nhỏ "View as", rồi hai mục — Developer ("Keys, imports and releases"), Translator ("View and translate strings"); mục đang dùng có dấu check. Chọn → `setRole`, đóng menu.
- "Reset demo data" giữ nguyên, cho cả hai role (công cụ của bản demo).

### 4.2 Topbar — bộ chọn ngôn ngữ

Khi không có `editSource`: mục English ghi thêm "· view only". Phần số liệu trong bộ chọn giữ nguyên (sub-project B xem lại).

### 4.3 Sidebar

"Import files" chỉ khi `exchangeBundles`; "New application" chỉ khi `manageApps`; không còn mục nào thì ẩn cả footer. Số trên từng mục giữ nguyên (B).

### 4.4 Header của workspace và trang template (`WorkspaceHeader`)

`WorkspaceHeader` tự đọc `useRole()`:
- Export + Import JSON: `canExport && can.exchangeBundles`.
- Lock + Publish: `can.release`.
- `children` (Add key của workspace UI) chỉ được truyền khi `can.manageKeys`.

Translator: header còn breadcrumb, tên, badge loại, "Inferred", dòng phụ.

### 4.5 Danh sách string (workspace UI)

- **Quản lý key** (`manageKeys`): checkbox từng dòng và checkbox chọn tất cả ở header danh sách, nút xóa, thanh "N selected", `AddKeyDialog`, `DeleteKeysDialog`. Không có quyền → không render; cột checkbox để trống để các cột vẫn thẳng hàng. Đổi role khi các surface này đang mở: theo §3.4.
- **Release** (`release`): thanh version, tab "Added here", badge "New" trên dòng. Không có quyền → `filtersFor(filters, can)` (trong `lib/workspace-view.ts`) đổi `status: "new"` → `"all"` và `version` → All, nên link của developer mở ở view translator không ra danh sách trống.
- **Service chưa có string**: translator thấy "No strings to translate in `<project>` yet." (không có nút Add key); developer giữ nguyên.
- **English không có `editSource`**: `TranslationRow` nhận `readOnly` — hiện English dạng chữ (`whitespace-pre-wrap`), không ô nhập, không Keep English / Still correct / Paste, không kiểm tra validation; còn Copy và lịch sử. Thanh "N unsaved keys" không hiện trên màn chỉ-đọc; draft English của developer vẫn nằm trong `DraftProvider` và hiện lại khi chuyển về developer.

### 4.6 Trang template

Header theo §4.4. Dialog không đổi (English của template vốn chỉ xem với mọi role).

## 5. Lỗi và edge case

- Cookie rỗng / sửa tay / `admin` → `developer`.
- Đổi role khi còn draft dịch → draft giữ nguyên; chuyển về thì tray "N unsaved keys" hiện lại như cũ.
- Đổi role khi đang mở dialog/tray quản trị hoặc đang chọn dòng → surface unmount ngay, state mở và danh sách dòng đang chọn bị xóa; chuyển về Developer không tự mở lại (§3.4).
- Link chứa `?status=new`, `?version=` mở bằng view translator → All (§4.5). Link `/import` → khối ở §3.3.
- Mock backend không có xác thực: quyền chỉ được áp ở UI. Gọi thẳng API vẫn làm được mọi việc — ghi vào danh sách cho BA/product (§7).

## 6. Kiểm thử

**Vitest** — `tests/roles.test.ts`:
- `capabilitiesOf` của hai role (đủ 5 quyền, đúng bảng §3.1).
- `parseRole`: `"translator"` → translator; `"developer"`, `undefined`, `""`, `"admin"` → developer.
- `filtersFor`: không có `release` → `new` thành `all`, version thành All; có `release` → giữ nguyên.
- `tests/drafts.test.ts` — `clearAllSelected`: xóa dòng đang chọn của mọi project, giữ nguyên edit và keep của mọi slot.

**Gate:** `npm run typecheck`, `npm test`, `npm run build`.

**Server render:** `curl` trang `/web/school-portal` kèm `Cookie: lingua-role=translator` → HTML không chứa "Add key", "Import files", "Publish"; không kèm cookie → có.

**CDP** (script tạm như các sub-project trước, chờ hydrate trước khi thao tác):
- Chuyển sang Translator qua menu người dùng → dòng phụ "Translator view"; sidebar không có Import files / New application; header workspace không có Export, Import, Lock, Publish, Add key; không có checkbox và nút xóa; không có thanh version, tab "Added here".
- `?lang=en` → không có ô nhập, mục English trong bộ chọn ghi "view only".
- `?status=new&version=<một version>` → danh sách đầy đủ.
- `/import` → khối "Import is part of the developer view"; bấm nút → wizard hiện.
- Service rỗng → "No strings to translate in … yet."
- Dịch một string tiếng Việt → Save → toast; reload vẫn là Translator view.
- Trang `/messages/email` ở view translator: header không có Export/Import/Lock/Publish; dialog dịch vẫn Save được.
- Chuyển về Developer → mọi thứ trở lại.
- **Surface quản trị khi đổi role** (§3.4), mỗi surface một lượt ở view Developer, rồi chuyển sang Translator bằng menu người dùng (bấm bằng script khi modal đang mở):
  - `AddKeyDialog` đang mở, đã gõ tên key → biến mất; không còn nút "Add key" nào gọi được.
  - `DeleteKeysDialog` mở từ nút xóa của một dòng → biến mất; key vẫn còn.
  - `ExportDialog` ở workspace UI và ở `/messages/email` → biến mất.
  - Chọn 2 dòng → tray "2 selected" biến mất.
  - Import wizard đã thả một file → thay bằng khối "Import is part of the developer view".
  - Chuyển về Developer → không dialog nào tự mở lại, không dòng nào còn được chọn, wizard trống; draft dịch gõ trước đó vẫn còn trong tray "N unsaved keys".

**Hồi quy view developer:** chạy `steps-flows.txt` trước khi sửa và sau khi sửa, `diff` phải rỗng (bước Reset đi qua menu người dùng, nên không phải viết lại); chạy lại checklist template, kết quả không đổi.

## 7. Cần BA/product quyết định (danh sách chung cho đợt feedback CS)

1. Quyền thật phải kiểm ở server; role lấy từ tài khoản (SSO/IdP) — mockup chỉ giả lập bằng "View as".
2. Translator có được gán ngôn ngữ riêng không (hiện: thấy cả 12)?
3. Translator có được Export/Import gì không ngoài vòng CSV của sub-project D?
4. Có cần role thứ ba (reviewer / người duyệt bản dịch) không?

## 8. Giữ nguyên

Theme tokens; mọi behavior của view developer (bằng hiện nay); hợp đồng API và mock backend; dữ liệu seed.
