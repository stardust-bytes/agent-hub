# Logo Integration (SidebarNav + Favicon) — Design Spec

## Overview

Replace the text-only header in SidebarNav with the actual logo image (`logo.png`), and add it as a favicon. The logo is a 1254x1254 PNG at project root.

## 1. Asset Placement

Copy `logo.png` from project root to `frontend/public/logo.png`. Vite serves files from `public/` at the root path `/`, so the logo will be accessible at `/logo.png`.

## 2. SidebarNav Logo

Current (SidebarNav.vue:3-5):
```html
<div class="flex items-center justify-center gap-2 px-3 py-1 mb-1">
  <span class="text-sm text-cyber-accent font-bold font-mono truncate">171305-wp</span>
</div>
```

Replace with logo image (24x24) + text:
```html
<div class="flex items-center justify-center gap-2 px-3 py-1 mb-1">
  <img src="/logo.png" class="w-6 h-6 shrink-0" alt="logo" />
  <span class="text-sm text-cyber-accent font-bold font-mono truncate">171305-wp</span>
</div>
```

- `w-6 h-6` = 24x24px (as chosen)
- `shrink-0` prevents compression in flex layout
- Text retained beside logo for context

## 3. Favicon

Add to `frontend/index.html` `<head>`:
```html
<link rel="icon" type="image/png" href="/logo.png">
```

## 4. Files Changed

| File | Change |
|------|--------|
| `frontend/public/logo.png` | Copy from root `logo.png` |
| `frontend/src/components/SidebarNav.vue` | Replace text-only header with `<img>` + text |
| `frontend/index.html` | Add favicon `<link>` tag |
