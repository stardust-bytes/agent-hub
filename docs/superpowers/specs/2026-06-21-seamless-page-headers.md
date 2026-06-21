# Seamless Page Headers & Layout Redesign

## Problem

Current page headers are inconsistent and visually unpolished:
- Each view has a `h-[3rem]` bar with `border-b border-border` that visually separates header from content, breaking the sense of seamlessness
- Icon usage is inconsistent — some views have icons, some don't; icons are flat gray with no container
- Padding is messy — legacy `xl:pl-3 pl-10` from the old sidebar era pollutes templates
- Content container width (`mx-auto max-w-5xl px-6 py-6`) doesn't match header width
- CoworkView is completely different from other views (standalone ProjectBar component)
- Settings has a tab strip that was left over from the old design

## Design Direction

**Seamless layout**: Header and content share the same container width with no dividing border. The header flows naturally into the content area.

## Visual Structure

### A. List view (ScheduleTasks, Notes, AgentOutput, Providers, Agents, Tools, Usage, Memory, Permission, Files, Connectors)

```
┌──────────────────────────────────────────────┐
│  [🔷] Title              [badge]    [+ New]  │  ← header area, no border
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  (content cards/table/list)              │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### B. Detail view (ScheduleTaskDetail)

```
┌──────────────────────────────────────────────┐
│  tasks / Daily Report                        │  ← breadcrumb (mono, muted)
│  [🔷] Daily Report    [12 runs]   [Run Now] │  ← header area, no border
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  (detail content)                        │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### C. CoworkView

```
┌──────────────────────────────────────────────┐
│  [📁] ~/projects / my-app         [● 2] [☰]│  ← unified ProjectBar (no border)
│                                                │
│  ┌──────────────┬────────────────┬──────────┐ │
│  │  FileTree    │  Chat messages │ Artifacts │ │
│  │              │                │           │ │
│  └──────────────┴────────────────┴──────────┘ │
└──────────────────────────────────────────────┘
```

### D. Settings

```
┌──────────────────────────────────────────────┐
│  [⚙️] Settings                               │  ← header (no border)
│                                                │
│  Providers | Agents | Tools | Usage | ...    │  ← tab bar (mono, active underline)
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  (active tab content)                    │ │
│  └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

## Design Tokens for Header

| Token | Value | Usage |
|---|---|---|
| Container | `mx-auto max-w-5xl` + `px-6` | Shared by header & content |
| Header padding top | `pt-5` | Space above title row |
| Header padding bottom | `pb-4` | Space before content |
| Icon box | `w-7 h-7 bg-primary/10 text-primary rounded-lg` | Container for section icon |
| Icon size | `w-4 h-4` | Icon inside the box |
| Title (list) | `text-base font-semibold text-foreground` | Standard page title |
| Title (detail) | `text-lg font-bold text-foreground tracking-tight` | Detail page title |
| Breadcrumb | `font-mono text-xs text-muted-foreground` | Navigation path above title |
| Breadcrumb separator | `text-input` | `/` between segments |
| Breadcrumb current | `text-foreground` | Last segment |
| Badge | `text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5` | Status/count info |
| Action ghost | Primary ghost recipe | Secondary actions |
| Action primary | Primary button recipe | Primary CTA |
| Tab bar | `inline-flex gap-0 border-b border-border` | Settings tabs container |
| Tab item | `font-mono text-sm px-3 py-1.5 text-muted-foreground` | Inactive tab |
| Tab active | `text-primary border-b-2 border-primary` | Active tab indicator |
| ProjectBar icon box | Same as header icon box | CoworkView consistency |

## Affected Views & Their Pattern

| View | Type | Header content | Actions |
|---|---|---|---|
| CoworkView | Special | ProjectBar (icon + path + status badge) | Sub-agent count, project menu |
| ScheduleTasksView | List | icon + "Scheduled Tasks" + active count badge | "+ New" ghost |
| ScheduleTaskDetailView | Detail | breadcrumb + title + run count | "Edit" secondary, "Run Now" primary |
| NotesView | List | icon + "Notes" + note count badge | "+ New" ghost |
| ConnectorsView | List | icon + "Connectors" | "+ Connect" ghost (green) |
| AgentOutputView | List | icon + "Agent Output" + file count | "Refresh" ghost |
| SettingsView | Settings | icon + "Settings" | Tab bar below |
| ProvidersView | Settings | Tab content (no standalone header) | Tab bar handles navigation |
| AgentsView | Settings | Tab content | Tab bar handles navigation |
| ToolsView | Settings | Tab content | Tab bar handles navigation |
| UsageView | Settings | Tab content | Tab bar handles navigation |
| MemoryView | Settings | Tab content | Tab bar handles navigation |
| PermissionView | Settings | Tab content | Tab bar handles navigation |
| FilesView | List | icon + "Files" | None |

## CoworkView ProjectBar Restyle

Current CoworkView has a standalone `<ProjectBar>` at top with `h-[3rem] bg-surface border-b`. Redesign to seamless pattern:

- Remove `h-[3rem]` constraint (let content define height)
- Remove `border-b` 
- Add icon box (folder icon in primary/10)
- Path segments styled: first part `font-medium text-foreground`, rest `text-muted-foreground`
- Connection dot on left of path
- Sub-agent badge with blue dot + count
- Project menu button (☰) on far right
- No `xl:pl-3 pl-10` padding

## Impact

- No functional changes — visual only
- All existing i18n keys remain unchanged
- No new dependencies
- ~15 Vue components modified
