# Directory Browser for Cowork Project Selection

## Problem

Browser `<input type="file" webkitdirectory>` does not expose the full filesystem path for security reasons. The `File.path` property is only available in Electron/Chrome with special flags. When a user browses and selects a folder, the frontend only gets the folder name (e.g., `test-project`) via `webkitRelativePath`, not the full path (e.g., `D:\Git\test-project`).

## Solution

Build a backend-driven directory tree browser. The backend has full access to the filesystem. The frontend navigates directories through backend APIs and selects the exact path.

---

## Architecture

### Section 1 — Backend APIs

New endpoints in `CoworkController`:

**`GET /api/cowork/drives`** — List available drive roots (platform-specific):
```json
["C:\\", "D:\\", "E:\\"]
```
- Windows: enumerate drive letters via `fs.readdir('/')` filtered by drive letters
- Linux/Mac: return `["/"]`

**`GET /api/cowork/browse?path=<encoded-path>`** — List subdirectories:
```json
{
  "path": "C:\\Users",
  "entries": [
    { "name": "Public", "isDirectory": true },
    { "name": "THANHDP", "isDirectory": true }
  ]
}
```
- Input: query param `path` (URL-encoded)
- Resolve with `path.resolve()` to prevent traversal
- Filter to directories only (no files)
- Sort alphabetically
- Returns error object if path doesn't exist or can't be read
- Does NOT check `isPathAllowed` — the user is selecting a new project path to ADD to allowed paths

New method in `CoworkService`:

```ts
async getDrives(): Promise<string[]>
async browseDirectory(dirPath: string): Promise<{ path: string; entries: Array<{ name: string; isDirectory: boolean }> }>
```

### Section 2 — DirectoryBrowser Component

New file: `frontend/src/components/DirectoryBrowser.vue`

**Props:**
- `modelValue: boolean` — show/hide modal

**Emits:**
- `update:modelValue` — for v-model
- `select(path: string)` — user selected a directory

**Template structure:**
- BaseModal shell (teleported to body)
- Header: current path display + close button
- Body: scrollable list of directory entries
  - ".." entry at top (go to parent) unless at drive root
  - Each entry: folder icon + name, click to navigate in
  - Loading spinner while fetching
  - Error message if path unreachable
- Footer: "Select this folder" button (emits select with current path)

**States:**
- Loading: fetching directory contents
- Error: path does not exist or permission denied
- Empty: directory has no subdirectories
- Normal: list of subdirectories

**API calls:**
- On mount: `GET /api/cowork/drives`
- On navigate: `GET /api/cowork/browse?path=<encoded-path>`

### Section 3 — FilesView Integration

Replace broken browser-based `webkitdirectory` flow with DirectoryBrowser modal:

- Remove `projectDirInput` hidden input, `browseProjectDir()`, `onProjectDirChange()`, `onWindowFocus()`
- Remove `browseMessage` ref (no longer needed)
- Add `showDirBrowser` ref
- Nút "Browse" mở DirectoryBrowser modal
- `onDirSelected(path)` handler:
  1. Set `projectPath.value = path`
  2. Call `toggleProject()` to connect automatically

**i18n keys to add:**
- `cowork.browse.title` — "Select Project Directory" / "Chọn thư mục dự án"
- `cowork.browse.parent` — ".. (parent)" / ".. (thư mục cha)"
- `cowork.browse.select` — "Select this folder" / "Chọn thư mục này"
- `cowork.browse.loading` — "Loading..." / "Đang tải..."
- `cowork.browse.error` — "Cannot access this directory" / "Không thể truy cập thư mục này"
- `cowork.browse.empty` — "No subdirectories" / "Không có thư mục con"

---

## File Changes Summary

### Backend
| File | Change |
|---|---|
| `backend/src/cowork/cowork.controller.ts` | Add `GET /drives`, `GET /browse` endpoints |
| `backend/src/cowork/cowork.service.ts` | Add `getDrives()`, `browseDirectory()` |
| `backend/src/cowork/cowork.service.spec.ts` | Tests for new methods |
| `backend/src/cowork/cowork.controller.spec.ts` | Tests for new endpoints |

### Frontend
| File | Change |
|---|---|
| `frontend/src/components/DirectoryBrowser.vue` | **New** — directory tree modal |
| `frontend/src/components/FilesView.vue` | Replace webkitdirectory browse with DirectoryBrowser modal |
| `frontend/src/locales/vi.json` | Add i18n keys |
| `frontend/src/locales/en.json` | Add i18n keys |

---

## Testing

**Backend:**
- `CoworkService.getDrives()` — returns array of drive strings
- `CoworkService.browseDirectory(path)` — returns entries with name/isDirectory
- `CoworkService.browseDirectory()` — handles non-existent path with error
- `CoworkService.browseDirectory()` — filters to directories only
- `CoworkController` — delegates correctly to service methods

**Frontend:**
- Manual: Open FilesView, click Browse, navigate directories, select folder, verify path appears in input and auto-connects
- Manual: Verify error state when accessing inaccessible directories
