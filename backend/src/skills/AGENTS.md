# skills/ — Agent Context

Skill management module. Skills are workflow instructions stored as `.md` files in a configurable directory (default: `./workspace_data/skills/`). Each skill has YAML frontmatter with `name` and `description` fields. The module provides CRUD operations and integration with the agent loop via `/skill <name> <task>` command.

## Responsibility

- `SkillsService` — CRUD for skill files: list, get by name, create, update, delete. Auto-seeds 4 default skills on first access (brainstorming, systematic-debugging, dispatching-parallel-agents, executing-plans).
- `SkillsController` — REST endpoints under `/api/skills`.

## Files

```
skills/
├── skills.module.ts
├── skills.controller.ts
├── skills.service.ts
└── dto/
    └── create-skill.dto.ts
```

## API Endpoints

Base path: `/api/skills`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/skills` | List all skills |
| `GET` | `/api/skills/:name` | Get a skill by name |
| `POST` | `/api/skills` | Create a new skill |
| `PATCH` | `/api/skills/:name` | Update a skill (rename via `name` field in body) |
| `DELETE` | `/api/skills/:name` | Delete a skill |

## Default Skills

| Name | Description |
|---|---|
| `brainstorming` | Design before implementation — explore intent, requirements, get user approval |
| `systematic-debugging` | Root cause analysis before fixes — 4-phase debugging workflow |
| `dispatching-parallel-agents` | Parallel sub-agent dispatch for independent tasks |
| `executing-plans` | Step-by-step implementation plan execution |

## Dependencies

- SettingsService (skill directory path from `skills.path` setting)
- AgentService (`/skill` command integration)
