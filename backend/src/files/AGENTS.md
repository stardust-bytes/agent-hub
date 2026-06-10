# files/ — Agent Context

File download module. Serves agent-created files via download URL.

## Files

`
files/
+-- files.module.ts
+-- files.controller.ts
`

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/files/agent/:id/download | Download agent-created file by ID |

## Dependencies

- PrismaService (AgentFile queries)

