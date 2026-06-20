# agent-profiles/ — Agent Context

Agent profiles management module. Full CRUD for the `AgentProfile` entity — named, reusable agent configurations (system prompt, allowed tools, default model) that can be selected for a chat/dispatch session.

## Responsibility

- `AgentProfilesController` — REST endpoints under `/api/agent-profiles`.
- `AgentProfilesService` — business logic; all DB access via injected `PrismaService`. Blocks deletion of builtin profiles.

## Files

```
agent-profiles/
├── agent-profiles.module.ts
├── agent-profiles.controller.ts
├── agent-profiles.controller.spec.ts
├── agent-profiles.service.ts
├── agent-profiles.service.spec.ts
└── dto/
    ├── create-agent-profile.dto.ts
    └── update-agent-profile.dto.ts
```

## API Endpoints

Base path: `/api/agent-profiles`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/agent-profiles` | List all profiles, ordered by `name ASC` |
| `POST` | `/api/agent-profiles` | Create a profile |
| `PATCH` | `/api/agent-profiles/:id` | Update a profile |
| `DELETE` | `/api/agent-profiles/:id` | Delete a profile (throws `BadRequestException` if builtin) |

## DTOs

**`CreateAgentProfileDto`**: `slug` (required, string), `name` (required, string), `description?`, `systemPrompt` (required, string), `allowedTools?`, `modelId?` (Int), `enabled?` (boolean).

**`UpdateAgentProfileDto`**: `PartialType(CreateAgentProfileDto)` — all optional.

## Dependencies

- PrismaService (AgentProfile CRUD)

## Consumers

- `AgentModule` imports `AgentProfilesModule` to resolve profiles for dispatch.

## Testing

```bash
npx jest src/agent-profiles     # 2 suites
```

Tests mock `PrismaService` (service spec) and `AgentProfilesService` (controller spec). The controller's `remove`/`update` use `ParseIntPipe`, which only runs over HTTP — unit tests call the controller methods directly with a numeric id.
