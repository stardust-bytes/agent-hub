# Project Management — Design Spec

## Goal

Add saved project management to Cowork mode, similar to Claude Code. Users can save project directories, switch between them easily, and chat without needing a project selected.

## Changes

### Backend — CoworkService

**Storage:**
- Active project path: `Setting` key `cowork_project_path` (unchanged)
- Saved projects list: `Setting` key `cowork.projects` — JSON array `[{ id, name, path, createdAt }]`

**New API:**

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cowork/projects` | List saved projects |
| `POST` | `/api/cowork/projects` | Save project `{ name, path }` |
| `DELETE` | `/api/cowork/projects/:id` | Delete saved project |

Existing `/api/cowork/project` (POST/GET/DELETE) unchanged.

### Frontend — CoworkView.vue

**Layout change:**
- Header bar **always visible**, even without a project
- Chat area **always visible** (no more "connect first" screen)
- FileTree + ArtifactsPanel only when project is connected

**Header bar:**
```
[● Working in: My Project ▼]  [Browse] [Save] [Disconnect]
```

**Project dropdown:**
```
┌────────────────────────────┐
│ 📁 Select folder...        │ → DirectoryBrowser, connect without saving
├────────────────────────────┤
│ 📁 My Project          ✕  │ → click: connect | ✕: delete
│ 📁 Website Redesign    ✕  │
├────────────────────────────┤
│ + Save current as...       │ → modal: name → save to projects
└────────────────────────────┘
```

**New component:** `ProjectDropdown.vue` — dropdown with project list, delete buttons, "Select folder" option, "Save current" option.

### i18n keys

| Key | vi | en |
|---|---|---|
| `cowork.project.select` | "Chọn project..." | "Select project..." |
| `cowork.project.saveAs` | "Lưu project..." | "Save project as..." |
| `cowork.project.delete` | "Xoá" | "Delete" |
| `cowork.project.save` | "Lưu" | "Save" |
| `cowork.project.name` | "Tên project" | "Project name" |
| `cowork.noProject` | "Chưa chọn project" | "No project selected" |
