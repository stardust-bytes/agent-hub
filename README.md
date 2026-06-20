<h1 align="center">Agent Hub</h1>

<p align="center">
  <strong>Local-first AI Agent Workspace — mã nguồn mở, chạy trên máy bạn.</strong>
  <br />
  Trò chuyện với AI · Quản lý tài liệu · Tự động hóa tác vụ
  <br />
  Dùng Ollama local hoặc kết nối OpenAI/DeepSeek — tùy bạn chọn.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-Vue_3-4FC08D?logo=vue.js" alt="Vue 3" />
  <img src="https://img.shields.io/badge/Backend-NestJS-E0234E?logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/Database-SQLite-003B57?logo=sqlite" alt="SQLite" />
  <img src="https://img.shields.io/badge/AI-Ollama-000000?logo=ollama" alt="Ollama" />
  <img src="https://img.shields.io/badge/License-MIT-yellow" alt="MIT" />
</p>

---

## Tính năng

- **AI Agent** — Chat với AI qua SSE streaming, hỗ trợ Ollama, OpenAI, DeepSeek
- **Quản lý tệp tin** — Xem trước PDF, DOCX, XLSX, mã nguồn ngay trong trình duyệt
- **Scheduled Tasks** — Lập lịch chạy AI tự động (cron)
- **Kết nối Google** — Gmail, Calendar, Drive, Sheets qua OAuth
- **Tools Registry** — Bật/tắt chi tiết từng công cụ AI
- **RAG** — Index tài liệu và mã nguồn với LanceDB
- **Memory** — Trí nhớ dài hạn, tự động trích xuất từ hội thoại
- **Permissions** — Phân quyền chi tiết, YOLO mode
- **MCP Servers** — Hỗ trợ giao thức mở rộng

## Cài đặt

### Yêu cầu

- **Docker Desktop** — [download](https://www.docker.com/products/docker-desktop/)
- **Ollama** (không bắt buộc) — [ollama.ai](https://ollama.ai)

### Docker (khuyến nghị)

```bash
docker compose up --build
```

Mở **http://localhost:17135**. Lần chạy đầu tự động tạo `workspace_data/` với SQLite, LanceDB.

### Phát triển

```bash
# Backend
cd backend
npm install && npm run setup && npm run start:dev

# Frontend (terminal riêng)
cd frontend
npm install && npm run dev
```

### Windows

```powershell
.\run.ps1
```

---

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | Vue 3 + TS + TailwindCSS + Vite |
| Backend | NestJS 10 + TypeScript |
| Database | SQLite via Prisma |
| Vector DB | LanceDB |
| AI | Ollama / OpenAI / DeepSeek |
| Container | Docker Compose + Nginx |

---

## Cấu trúc

```
├── frontend/              Vue 3 SPA
├── backend/               NestJS API (modules, prisma)
├── workspace_data/        SQLite + LanceDB + uploads (gitignored)
├── docker-compose.yml     One-command deploy
├── run.ps1                Windows runner
└── docs/                  Specs & plans
```

---

## License

MIT
