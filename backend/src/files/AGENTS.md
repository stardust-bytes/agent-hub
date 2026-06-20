# files/ — Agent Context

File download module. Serves agent-created files (`AgentFile` records) via a download URL.

## Files

```
files/
├── files.module.ts
└── files.controller.ts
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/files/agent/:id/download | Download an agent-created file by `AgentFile` id |

## Dependencies

- PrismaService (AgentFile queries)
