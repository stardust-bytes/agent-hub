# memory/ — Agent Context

Persistent memory system with 4 memory types (USER/FEEDBACK/PROJECT/REFERENCE), background auto-extraction on agent idle, and prompt injection. Implements SHA256 dedup with 24h window.

## Status: IMPLEMENTED (2026-06-11)

## Responsibility

- `MemoryController` — REST endpoints under `/api/memories` + `GET /api/memories/context`
- `MemoryService` — CRUD with dedup logic, context query for prompt injection
- `MemoryGateway` — Socket.io `/memories` namespace emitting `memory:created/updated/deleted`
- `MemoryExtractionService` — Listens to `agent.idle` event, extracts memories from recent chat via keyword patterns with quality filters (min length, negation/question/greeting exclusion, preceding-context check), deduplicates before insert

## Files

```
memory/
├── memory.module.ts
├── memory.controller.ts
├── memory.controller.spec.ts
├── memory.service.ts
├── memory.service.spec.ts
├── memory.gateway.ts
├── memory.gateway.spec.ts
├── memory-extraction.service.ts
├── memory-extraction.service.spec.ts
├── memory.constants.ts
└── dto/
    ├── create-memory.dto.ts
    ├── update-memory.dto.ts
    └── search-memory.dto.ts
```

## API Endpoints

Base path: `/api/memories`

| Method | Path | Handler | Description |
|---|---|---|---|
| `GET` | `/api/memories` | `findAll(dto)` | List with optional type/search/sessionId filters |
| `GET` | `/api/memories/context` | `getContext()` | Get memories for prompt injection (grouped by type, limited per MEMORY_PROMPT_LIMITS) |
| `POST` | `/api/memories` | `create(dto)` | Create memory (with dedup check) |
| `PATCH` | `/api/memories/:id` | `update(id, dto)` | Update memory |
| `DELETE` | `/api/memories/:id` | `remove(id)` | Delete memory |

## Service Methods

```ts
findAll(dto?: SearchMemoryDto): Promise<Memory[]>
create(dto: CreateMemoryDto): Promise<Memory>        // checks dedup first
update(id: string, dto: UpdateMemoryDto): Promise<Memory>
remove(id: string): Promise<Memory>
findOne(id: string): Promise<Memory>                  // throws NotFoundException
getContextMemories(): Promise<string>                  // formatted markdown for prompt injection
```

## Memory Types

```
USER      — user role, preferences, background
FEEDBACK  — validated approaches, corrections, lessons learned
PROJECT   — deadlines, releases, ongoing work context
REFERENCE — external tool pointers (Linear, Jira, Slack, docs)
```

## DTOs

**`CreateMemoryDto`:**
```ts
type: 'USER' | 'FEEDBACK' | 'PROJECT' | 'REFERENCE'  // required
title: string                                           // required
content: string                                         // required
metadata?: string                                       // optional JSON string
```

**`UpdateMemoryDto`** — `PartialType(CreateMemoryDto)`, every field optional.

**`SearchMemoryDto`:**
```ts
type?: string           // filter by type
search?: string         // full-text search on title + content
sessionId?: string      // filter by session
```

## Memory Extraction

Triggered by `agent.idle` event (emitted when agent loop completes a turn).

Extraction flow:
1. Fetch last 10 messages from session
2. Filter user + assistant messages
3. Run targeted regex patterns to classify memories into 4 types
4. Apply quality filters: min length (20 chars), exclude questions, greetings, negated statements (via preceding-sentence context check), and overly broad keywords (e.g. standalone "remember", "never", "always", "project" without qualifiers are no longer extracted)
5. Check dedup (same type + title prefix within 24h)
6. Insert new memories via MemoryService.create()

### Extraction Quality Improvements (2026-06-23)

- **Narrowed patterns**: FEEDBACK removed standalone `don't`, `never`, `always`, `remember`. PROJECT requires qualifiers (`deadline for`, `release date`, `sprint goal`, etc.) instead of bare `project`/`version`/`release`.
- **Exclusion filters**: `isValidMemory()` rejects text <20 chars, questions (ending with `?`), greetings (`hi`, `thanks`, `okay`), and negated statements (checks preceding sentence for `don't`, `doesn't`, etc.).
- **Dynamic titles**: USER uses the extracted detail as title (e.g. `User: a software developer`); FEEDBACK uses `Lesson`, `Preference`, `Important`, `Best practice`, `Tip` based on matched keyword.
- **Preceding context**: `getPrecedingContext()` extracts the sentence before each match to detect negation patterns that appear before the keyword.

## Integration

- `agent-loop.service.ts` emits `agent.idle` via `EventEmitter2` before `[DONE]` SSE
- `context-builder.service.ts` calls `memoryService.getContextMemories()` and appends to system prompt
- `MemoryModule` is imported by `AgentModule` for dependency injection

## Dependencies

- PrismaService (Memory + Session models)
- MemoryGateway (Socket.io events)
- EventEmitterModule (@nestjs/event-emitter)

## Testing

```bash
npx jest src/memory          # 4 suites, 27 tests
npx jest src/agent           # agent integration test (60 tests)
```
