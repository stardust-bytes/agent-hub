# agent/ — Agent Context

AI agent integration module. Currently a **stub** returning hardcoded responses. Phase 2 replaces the internals with real Ollama SSE streaming — the controller contract (endpoint path, request/response shape) stays the same.

## Responsibility

- `AgentController` — exposes `POST /api/agent/chat`.
- `AgentService` — contains `mockReply()` stub now; will contain Ollama client logic in Phase 2.

## Files

```
agent/
├── agent.module.ts
├── agent.controller.ts
├── agent.controller.spec.ts
├── agent.service.ts
└── agent.service.spec.ts
```

## API

**`POST /api/agent/chat`**

Request body:
```json
{ "message": "string" }
```

Response:
```json
{ "reply": "string", "timestamp": "ISO string" }
```

`ChatDto` (inline in `agent.controller.ts`) uses `@IsString()` from `class-validator`. The global `ValidationPipe` enforces it.

## Current Implementation

```ts
// agent.service.ts
mockReply(message: string): string {
  return `[stub] Received: ${message}. Ollama integration coming in Phase 2.`
}
```

This is intentionally minimal — do not add business logic here until Phase 2.

## Phase 2 Plan (Ollama Integration)

Phase 2 will change `AgentService` to:
1. Send requests to `http://host.docker.internal:11434/api/chat` (Ollama on host).
2. Read a streaming response (Ollama uses NDJSON stream).
3. Forward via SSE (`text/event-stream`) to the frontend ChatPanel.

The `AgentController` endpoint URL and request body shape **will not change**. Only the response mechanism changes (from JSON to SSE stream).

**Do not** change the controller signature, route, or DTO until Phase 2 design is complete.

## Ollama Connection (Phase 2 context)

Docker Compose config includes:
```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

This allows the NestJS container to reach Ollama running natively on the host (with GPU) at `http://host.docker.internal:11434`.

Environment variable to add in Phase 2:
```
OLLAMA_URL=http://host.docker.internal:11434
```

## Testing Pattern

```bash
npx jest src/agent
```

`AgentService` is stateless and pure — tests call `mockReply()` directly without database mocking.

`AgentController` tests use `TestingModule` with a mock `AgentService`.
