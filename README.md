# Tark

An adaptive AI tutor for school and university subjects (web app).
**Tark** is from the Sanskrit *tarka* — reasoning, logic.

The model is the engine; the pedagogy is the product. See `CLAUDE.md` for the full design.

---

## What's in this folder

```
tark/
├── CLAUDE.md                                   project rules — Claude Code reads this
├── README.md                                   this file
├── .gitignore
├── .claude/skills/teaching-mode-author/
│   └── SKILL.md                                enforces pedagogy + correctness per mode
├── supabase/
│   └── schema.sql                              Phase 0 sessions table (run in SQL Editor)
├── backend/                                    Python + FastAPI
│   ├── .env.example                            copy to .env and add your keys
│   ├── requirements.txt
│   └── app/
│       ├── main.py                             FastAPI app: SSE /chat, /verify, /health
│       ├── config/   settings.py + models.py   (THE task→model map)
│       ├── router/   adapter interface + Gemini & NIM adapters + router
│       ├── modes/    teacher.py, socratic.py   (system-prompt constants)
│       ├── correctness/  engine.py             (SymPy seam, §7)
│       └── db/       supabase_client.py        (sessions store)
└── frontend/                                   React + Vite + TypeScript
    └── src/                                    chat UI, mode switcher, KaTeX
```

---

## Setup order

1. Get two free API keys:
   - Gemini → https://aistudio.google.com/apikey
   - NVIDIA NIM → https://build.nvidia.com
2. `cp backend/.env.example backend/.env` and paste your keys in.
3. Open this folder in **Claude Code**.
4. Paste the kickoff prompt below as your first message.

---

## Running locally (Phase 0)

You need **two terminals**. Backend on `:8000`, frontend on `:5173`.

### Backend (Python 3.12 — FastAPI)

First time only — create the venv and install deps:
```bash
cd backend
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Run the server (call the venv's Python directly — **no `Activate.ps1`**):
```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

> **Windows note:** don't use `.venv\Scripts\Activate.ps1` — the default PowerShell
> execution policy (`Restricted`) blocks it ("running scripts is disabled on this
> system"). Calling `.venv\Scripts\python.exe` directly sidesteps that entirely.
> (Alternatively, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.)

The server **fails fast** if `GEMINI_API_KEY` or `NVIDIA_NIM_API_KEY` is missing from
`backend/.env` — it tells you exactly what's missing. We never mock providers.

Quick checks (optional, second terminal):
```bash
curl http://127.0.0.1:8000/health
# SymPy correctness seam (§7):
curl -X POST http://127.0.0.1:8000/verify -H "Content-Type: application/json" \
  -d "{\"expression\":\"2*(x+3)\",\"claimed\":\"2*x+6\"}"
```

### Frontend (Node 18+ — Vite)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**, pick **Teacher** or **Socratic**, and start chatting.
Maths streams in and renders via KaTeX. The frontend calls the backend at
`http://127.0.0.1:8000` (IPv4 literal, to avoid a Windows localhost/IPv6 mismatch).

### Database (optional in Phase 0)

The app runs without Supabase (session recording just no-ops). To enable it, run
`supabase/schema.sql` in your project's SQL Editor and make sure `SUPABASE_URL` and
`SUPABASE_SERVICE_KEY` are set in `backend/.env`.

---

## Claude Code kickoff prompt

```
You are working on Tark, an adaptive AI tutor (web app).

Before writing any code:
1. Read CLAUDE.md at the repo root in full.
2. Read .claude/skills/teaching-mode-author/SKILL.md.
Then give me a short Phase 0 build plan as a todo list and WAIT for my go-ahead before coding.

Phase 0 goal: prove the core teaching loop. Build ONLY what Phase 0 needs. Do NOT build
image generation, TTS, video, full auth, or any teaching mode other than Teacher and Socratic.

Scaffold a monorepo:
- /backend  — Python + FastAPI (async), structured per CLAUDE.md section 5
  (app/router, app/modes, app/correctness, app/config, app/db)
- /frontend — React + Vite + TypeScript

Model router (CLAUDE.md section 6):
- One adapter interface; two adapters: Gemini and NVIDIA NIM (NIM is OpenAI-compatible).
- The task->model map lives ONLY in app/config/models.py, using FREE models
  (Gemini Flash for chat/teaching; an open NIM model for heavy reasoning).
- Read GEMINI_API_KEY and NVIDIA_NIM_API_KEY from /backend/.env. If either is missing,
  STOP and tell me to add it — do not mock the providers.
- Retry with exponential backoff on 429, and fail over to the other provider.

Teaching modes (use the teaching-mode-author skill):
- Author Teacher and Socratic modes as system-prompt constants in app/modes.
- Socratic must never give away the answer.

Correctness (CLAUDE.md section 7):
- Add a SymPy-backed correctness module: interface in place, called on any numeric/symbolic
  result so the LLM defers computation. Full enforcement is Phase 1, but wire the seam now.

API + streaming:
- A FastAPI endpoint that takes a message + selected mode and STREAMS the reply (SSE).

Frontend:
- A minimal chat UI: a Teacher/Socratic mode switcher, streaming display, and KaTeX
  rendering for any LaTeX maths. No visual polish yet — just clean and working.

Database:
- Keep it minimal in Phase 0: a Supabase client plus a simple sessions table is enough.
  Defer the full learner model and Row-Level Security to later phases (leave TODOs).

When finished, give me the exact commands to run the backend and frontend locally.

Obey all CLAUDE.md rules: section 7 correctness, section 9 pedagogy, section 11 media
(accurate figures are code-rendered, never image-generated), section 12 security
(never hardcode keys). Confirm the plan with me first.
```
