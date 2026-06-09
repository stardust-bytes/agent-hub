# Agent Harness — Roadmap

## Overview

Xây dựng 5 component của Agent Harness (tương tự Claude Code Harness) cho Local-First AI Agent Workspace.

## Priority Order

| # | Component | Phụ thuộc | Ước lượng | Giá trị |
|---|---|---|---|---|
| 1 | **Agent Loop** (State Machine) | None | Medium | Cải thiện chất lượng agent ngay lập tức |
| 2 | **Permissions System** | None (độc lập) | Small | Safety critical |
| 3 | **Context Management** | Agent Loop (#1) | Medium | Xử lý hội thoại dài |
| 4 | **MCP Protocol** | Permissions (#2) có thể làm trước | Large | Extensibility, tool ecosystem |
| 5 | **Multi-Agent Swarm** | Agent Loop (#1) + MCP (#4) | Large | Parallel task processing |

## Component Details

### 1. Agent Loop (State Machine) — Current

**Trạng thái:** Đang thiết kế
**Mục tiêu:** Thay thế ReAct loop cơ bản bằng State Machine với Planning, Evaluating, Self-correction.

### 2. Permissions System — Next

**Mục tiêu:** Thêm granular permission control cho tool execution, config file-based rules.

### 3. Context Management

**Mục tiêu:** Context compaction (summarize old messages), long-term memory (vector DB), sliding window.

### 4. MCP Protocol

**Mục tiêu:** Dynamic tool registration via MCP, tool discovery, standardized tool interface.

### 5. Multi-Agent Swarm

**Mục tiêu:** Agent orchestrator, subagent spawning, task decomposition, message bus.

## Notes

- Mỗi component có spec riêng, implement theo cycle riêng
- Component #1 và #2 có thể làm song song (không phụ thuộc)
- Component #3 cần #1 hoạt động ổn định
- Component #5 cần cả #1 và #4
