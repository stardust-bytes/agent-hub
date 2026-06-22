# skills/ — Agent Context

Skill management module. Skills are workflow instructions stored as `.md` files in a configurable directory (default: `./workspace_data/skills/`). Each skill has YAML frontmatter with `name` and `description` fields. The module provides CRUD operations and integration with the agent loop via `/skill <name> <task>` command.

## Responsibility

- `SkillsService` — CRUD for skill files: list, get by name, create, update, delete. No default skills are pre-seeded; the skills directory starts empty.
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

- SettingsService (skill directory path from `skills.path` setting)
- AgentService (`/skill` command integration)
