# Lazy Session Creation

## Overview

Change session creation from eager (on ChatPanel mount) to lazy (on first user message).

## Motivation

Currently a new session is created every time the chat view mounts (e.g., clicking the chat nav icon). This creates empty sessions that clutter the session list. Sessions should only be created when the user actually sends a message.

## Design

### Changes

**File: `frontend/src/components/ChatPanel.vue`**

1. Change `currentSessionId` initial value from `null` to `null` (already `null`, just remove the session creation call from `onMounted`).

2. Remove the `POST /api/sessions` call from `onMounted` (lines 181-187).

3. Add session creation to `submit()` — before sending the chat message, if `currentSessionId` is null, create a new session first.

### Data Flow

```
Before (onMounted):
  POST /api/sessions → currentSessionId = session.id

After (submit):
  if currentSessionId == null:
    POST /api/sessions → currentSessionId = session.id
  POST /api/agent/chat (with currentSessionId)
```

### Files Changed

| File | Change |
|---|---|
| `frontend/src/components/ChatPanel.vue` | Remove session creation from `onMounted`, add to `submit()` |
