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
- `components/role-provider.tsx` (client): state `role` khởi tạo từ `initialRole`; `useRole()` → `{ role, can, setRole }`.
- `setRole(next)`: đặt state ngay (giao diện đổi tức thì), ghi `document.cookie = "lingua-role=<next>; path=/; max-age=31536000; samesite=lax"`, rồi `router.refresh()`. State phía client (draft, lựa chọn dòng, dialog) không bị xóa.

### 3.3 Chặn route chỉ dành cho developer

`components/role-gate.tsx`: `RoleGate({ capability, feature, children })` — có quyền thì render `children`; không thì hiện khối (card viền đứt như `ProjectProfileCard`): tiêu đề "`<feature>` is part of the developer view" và nút outline "Switch to developer view" (`setRole("developer")`). `/import` bọc `ImportWizard` bằng `RoleGate capability="exchangeBundles" feature="Import"`.

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

- **Quản lý key** (`manageKeys`): checkbox từng dòng và checkbox chọn tất cả ở header danh sách, nút xóa, thanh "N selected", `AddKeyDialog`, `DeleteKeysDialog`. Không có quyền → không render; cột checkbox để trống để các cột vẫn thẳng hàng.
- **Release** (`release`): thanh version, tab "Added here", badge "New" trên dòng. Không có quyền → `filtersFor(filters, can)` (trong `lib/workspace-view.ts`) đổi `status: "new"` → `"all"` và `version` → All, nên link của developer mở ở view translator không ra danh sách trống.
- **Service chưa có string**: translator thấy "No strings to translate in `<project>` yet." (không có nút Add key); developer giữ nguyên.
- **English không có `editSource`**: `TranslationRow` nhận `readOnly` — hiện English dạng chữ (`whitespace-pre-wrap`), không ô nhập, không Keep English / Still correct / Paste, không kiểm tra validation; còn Copy và lịch sử. Thanh "N unsaved keys" không hiện trên màn chỉ-đọc; draft English của developer vẫn nằm trong `DraftProvider` và hiện lại khi chuyển về developer.

### 4.6 Trang template

Header theo §4.4. Dialog không đổi (English của template vốn chỉ xem với mọi role).

## 5. Lỗi và edge case

- Cookie rỗng / sửa tay / `admin` → `developer`.
- Đổi role khi còn draft hoặc lựa chọn dòng → giữ nguyên, chỉ ẩn phần role mới không có quyền; chuyển về thì hiện lại đúng như cũ.
- Link chứa `?status=new`, `?version=` mở bằng view translator → All (§4.5). Link `/import` → khối ở §3.3.
- Mock backend không có xác thực: quyền chỉ được áp ở UI. Gọi thẳng API vẫn làm được mọi việc — ghi vào danh sách cho BA/product (§7).

## 6. Kiểm thử

**Vitest** — `tests/roles.test.ts`:
- `capabilitiesOf` của hai role (đủ 5 quyền, đúng bảng §3.1).
- `parseRole`: `"translator"` → translator; `"developer"`, `undefined`, `""`, `"admin"` → developer.
- `filtersFor`: không có `release` → `new` thành `all`, version thành All; có `release` → giữ nguyên.

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

**Hồi quy view developer:** chạy `steps-flows.txt` trước khi sửa và sau khi sửa, `diff` phải rỗng (bước Reset đi qua menu người dùng, nên không phải viết lại); chạy lại checklist template, kết quả không đổi.

## 7. Cần BA/product quyết định (danh sách chung cho đợt feedback CS)

1. Quyền thật phải kiểm ở server; role lấy từ tài khoản (SSO/IdP) — mockup chỉ giả lập bằng "View as".
2. Translator có được gán ngôn ngữ riêng không (hiện: thấy cả 12)?
3. Translator có được Export/Import gì không ngoài vòng CSV của sub-project D?
4. Có cần role thứ ba (reviewer / người duyệt bản dịch) không?

## 8. Giữ nguyên

Theme tokens; mọi behavior của view developer (bằng hiện nay); hợp đồng API và mock backend; dữ liệu seed.
