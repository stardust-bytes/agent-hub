# Roadmap: AI Agent Workspace

> Self-hosted AI workspace — Chat/Agent modes, system tools, MCP integration, autonomy.

---

## Phase 1: UI Mode + Routing (NOW)

**Mục tiêu:** Phân tách Chat mode (LLM thuần) và Agent mode (ReAct loop + tools) trên cùng giao diện.

| Thành phần | Mô tả |
|---|---|
| Toggle Chat/Agent | Pill button dưới khung input, bên cạnh ModelSelector |
| Chat mode | Gọi LLM stream trực tiếp, không tool definitions, response text thuần |
| Agent mode | Giữ nguyên ReAct loop hiện tại (tool calling, search_knowledge, task CRUD) |
| ArtifactsPanel | Hiển thị tool call steps + results khi ở agent mode |
| Header indicator | Phân biệt trạng thái Chat vs Agent trên header bar |

**Backend:** `ChatDto.mode`, `AgentService` branch theo mode, `ContextBuilder` trả tools rỗng cho chat mode.

**UI:**
```
┌─────────────────────────────┐
│ $ █ type something...       │
├─────────────────────────────┤
│ [ Chat | Agent ]  llama3.2 ▾│
└─────────────────────────────┘
```

---

## Phase 2: Tool Registry + System Tools (NEXT)

**Mục tiêu:** Mở rộng tool definitions thành registry động, thêm system tools (shell, file, web).

| Tính năng | Mô tả |
|---|---|
| Tool registry | Đăng ký tool definitions động, không hardcode trong ContextBuilder |
| Shell tool | Execute lệnh shell trong sandbox |
| File tool | Đọc/ghi file trên hệ thống |
| Web search tool | Tìm kiếm web (SearXNG / DuckDuckGo) |
| Tool approval UI | Confirm dialog trước khi execute dangerous actions |
| Timeout + retry | Configurable timeout và retry policy cho mỗi tool |

---

## Phase 3: MCP Protocol (FUTURE)

**Mục tiêu:** Chuẩn hóa tool discovery/execution qua MCP (Model Context Protocol).

| Tính năng | Mô tả |
|---|---|
| MCP server | Chạy MCP server cho file system, shell, browser |
| Dynamic discovery | Agent tự động discover available tools qua MCP |
| Multi-agent routing | Router agent phân phối task cho các agent chuyên biệt |
| Browser automation | Playwright MCP cho web navigation, screenshot |

---

## Phase 4: Agent Autonomy + Memory (LATER)

**Mục tiêu:** Agent tự lập kế hoạch, ghi nhớ ngữ cảnh dài hạn.

| Tính năng | Mô tả |
|---|---|
| Planning | Agent tự đề xuất kế hoạch đa bước trước khi hành động |
| Persistent memory | ChromaDB vector store cho memory dài hạn |
| Skills system | Agent học kỹ năng mới qua skill definitions |
| Task decomposition | Chia task lớn thành subtask, theo dõi progress |

---

## Legend

| Tag | Ý nghĩa |
|---|---|
| NOW | Đang triển khai |
| NEXT | Kế hoạch tiếp theo |
| FUTURE | Tương lai gần |
| LATER | Dài hạn |
