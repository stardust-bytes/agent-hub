# agent-output/ — Agent Context

Agent output file management module. Lists and serves files created by AI agents in agent mode.

## Files

```
agent-output/
├── agent-output.module.ts
├── agent-output.controller.ts
└── agent-output.controller.spec.ts
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/agent-output | List files in agent-output/ directory |
| GET | /api/agent-output/:filename/download | Download file by filename |
| DELETE | /api/agent-output/:filename | Delete a file by filename |

## How it works

- Reads files from `{workspaceRoot}/agent-output/` directory (filesystem, not DB)
- Works with any file type saved by agent tools (Word, Excel, text, etc.)
- Executors like write_word, write_excel, and write_file create files here + AgentFile DB record for download links
