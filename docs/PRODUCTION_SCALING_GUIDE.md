# Tark — Production Scaling & Concurrency Guide

> **Document Status:** Architectural Reference & Pre-Launch Production Guide  
> **Target Audience:** Engineering & DevOps  
> **Last Updated:** September 2026

---

## 1. Executive Summary & Capacity Audit

Tark utilizes an asynchronous, non-blocking FastAPI backend combined with an automatic multi-provider fallback mesh. All configured free provider quotas aggregate into a unified capacity pool.

### Aggregated Provider Quota Breakdown

| Provider | Model | Rate Limit (RPM) | Daily Quota (RPD) | Monthly Capacity | Cost |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Google Gemini** | Gemini 2.5 Flash | 15 RPM | 1,500 req/day | ~45,000 req/mo | Free |
| **Groq** | Llama 3.3 70B | 30 RPM | 14,400 req/day | ~430,000 req/mo | Free |
| **Cerebras** | GPT-OSS 120B / Llama 70B | 30 RPM | 14,400 req/day | ~430,000 req/mo | Free |
| **SambaNova** | DeepSeek V3.2 / Llama 70B | 20 RPM | ~10,000 req/day | ~300,000 req/mo | Free |
| **NVIDIA NIM** | Llama 3.3 70B | 40 RPM | ~5,000 req/day | ~150,000 req/mo | Free |
| **Mistral** | Mistral Large | ~10 RPM | ~1,000 req/day | ~30,000 req/mo | Free |
| **Tavily Web Search** | 2 Pooled Keys | — | ~65 searches/day | 2,000 searches/mo | Free |
| **SymPy (Local CPU)** | Symbolic Math Verifier | **Infinite** | **Infinite** | **Infinite** | Free (CPU) |
| **Total Aggregated Pool** | — | **~145 RPM** | **~46,000 req/day** | **~1.38M req/mo** | **$0.00** |

### Concurrent & Daily User Limits
* **Average Student Usage:** 10 to 15 questions per study session.
* **Daily Active Users (DAU):** **~3,000 to 4,500 students per day** across all free tiers combined.
* **Simultaneous Concurrent Chatters:** **~100 to 150 active students chatting in the exact same second** without experiencing rate limiting.

---

## 2. Server Architecture & Concurrency Optimizations

### 2.1 Multi-Worker Process Model
In local development, Uvicorn runs as a single process. When deploying to production, run with multiple worker processes to utilize all CPU cores and prevent the Python GIL from stalling during CPU-heavy tasks:
```bash
# Production command: 1 worker per CPU core (or 2-4 workers for containerized Cloud Run)
uvicorn app.main:app --workers 4 --host 0.0.0.0 --port 8000
```

### 2.2 Threadpool Offloading
FastAPI's main event loop must remain free for I/O and SSE streaming. All CPU-heavy or blocking tasks must continue using `run_in_threadpool`:
* **SymPy Math Execution**: Keep evaluations inside `run_in_threadpool(check_arithmetic, answer)`.
* **Local FastEmbed Embeddings**: Keep vector searches inside `run_in_threadpool(retrieve, query)`.
* **SQLite / Local Stores**: Offload `school_store`, `learner_store`, and `improve_store` calls.

### 2.3 SSE Streaming Reverse Proxy Settings
When deploying behind Nginx, Cloudflare, or AWS ALB, disable proxy response buffering so SSE tokens stream with zero latency:
```nginx
# Nginx Configuration
location /chat {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;
}
```

---

## 3. Security, Rate Limiting & Abuse Prevention

### 3.1 IP-Based Rate Limiting (`slowapi`)
To prevent a single malicious user or bot from exhausting provider quotas:
1. Install `slowapi` (`pip install slowapi`).
2. Add rate limits to `/chat` and `/verify`:
   - `/chat`: **20 requests / minute per IP** (or per authenticated user token).
   - `/verify`: **30 requests / minute per IP**.
   - `/auth/send-code`: **3 requests / 10 minutes per email** (protects Brevo email credits).

### 3.2 SymPy Sandboxing & Timeout Guards
* Complex polynomial expansion or high-degree integrals can trigger high CPU usage.
* Maintain a strict timeout (e.g., `0.5s` max) on any symbolic execution so runaway expressions never block a worker.

---

## 4. Web Search Quota Management (Tavily Multi-Key)

Tark has 2 pooled Tavily API keys totaling 2,000 free searches/month. The quota guard in `app/search/tavily.py` enforces:
1. **Safety Cap:** Automatically caps each key at 900 queries/month (leaving a 100-query safety buffer).
2. **24-Hour Semantic Cache:** Repeated questions are served from memory (0 API calls).
3. **Smart Gating:** Bypasses web search for:
   - Pure math / arithmetic (`25 * 34`, `(x+1)^2`).
   - Small talk / greetings (`"hello"`, `"thank you"`).
   - Questions already covered in the local textbook/curriculum database.
4. **Automatic Key Rotation:** Seamlessly fails over from Key 1 to Key 2 when limit is reached.

---

## 5. Database & Local Storage Scaling

1. **SQLite WAL Mode (Write-Ahead Logging)**:
   For local vector DBs (`tark_rag.db`, `tark_schools.db`), ensure SQLite uses WAL mode to allow simultaneous reads while writes occur:
   ```sql
   PRAGMA journal_mode=WAL;
   ```
2. **Supabase Connection Pooling**:
   When traffic scales to thousands of concurrent users, use Supabase's transaction pooler (PgBouncer port `6543`) instead of direct session connections.

---

## 6. Recommended Deployment Architecture (Zero / Low-Cost)

```
┌────────────────────────────────────────────────────────┐
│             Cloudflare DNS & DDoS Shield               │
└─────────────────────────┬──────────────────────────────┘
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
┌───────────────────────┐   ┌───────────────────────────┐
│   Frontend (React)    │   │     Backend (FastAPI)     │
│  Vercel / Cloudflare  │   │     Google Cloud Run      │
│  Global Edge CDN      │   │  Auto-scales 0 ──► 100+   │
│  Unlimited Bandwidth  │   │  2 Million Free Req/Month │
└───────────────────────┘   └─────────────┬─────────────┘
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
┌───────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐
│ Multi-Provider Mesh   │   │     Supabase Postgres     │   │   Tavily Search Pool      │
│ Gemini, Groq, NIM,    │   │  Auth, Learner Models,    │   │   2,000 Searches/Month    │
│ SambaNova, Cerebras   │   │  Spaced Repetition Store  │   │   24h Cached Fallback     │
└───────────────────────┘   └───────────────────────────┘   └───────────────────────────┘
```

---

## 7. Pre-Launch Feature Checklist

Before making Tark public, complete these feature milestones:

- [ ] **Full User Authentication**: Brevo OTP verification + Supabase Row-Level Security (RLS).
- [ ] **Learner Progress Dashboard**: Interactive mastery radar chart and spaced-repetition revision queue.
- [ ] **Voice / Text-to-Speech**: Full read-aloud support via Gemini TTS / Web Speech API.
- [ ] **Expanded Textbook Ingestion**: Ingest CBSE/NCERT Class 9–12 Math, Physics, Chemistry, Biology.
- [ ] **Mobile PWA Support**: Manifest and responsive mobile touch gestures for students.
- [ ] **Per-IP Rate Limiting Middleware**: `slowapi` setup on all endpoints.
