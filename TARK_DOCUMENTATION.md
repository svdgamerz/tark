# TARK (तर्क) — System & Feature Documentation
**Adaptive, Curriculum-Grounded AI Teaching Engine**

---

## 1. Executive Summary & Vision

**Tark** (from Sanskrit *tarka*, meaning *reasoning* and *logic*) is an adaptive AI tutor engineered for school and university education.

### Core Philosophy:
> *"The language model is the engine; the pedagogy and correctness are the product."*

Unlike generic chat wrappers, Tark is a multi-agent teaching platform designed to instruct with genuine pedagogical rigor, strict mathematical correctness, board-specific curriculum grounding (RAG), dynamic code-rendered visual diagrams, adaptive student learner models, and recursive self-improvement loops.

---

## 2. Multi-Agent Orchestration & Intelligence Layer

```
                          ┌─────────────────────────────┐
                          │   Student Question / Input  │
                          └──────────────┬──────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │        Planner Agent        │
                          │ (Intent, Level, Ambiguity)  │
                          └──────────────┬──────────────┘
                                         │
               ┌─────────────────────────┼─────────────────────────┐
               ▼                         ▼                         ▼
   ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
   │    Retriever Agent    │ │     Solver Agent      │ │     Diagram Agent     │
   │  (Curriculum RAG +    │ │  (SymPy Verification  │ │ (Matplotlib / Mermaid │
   │   Query Expansion)    │ │   & Pre-computation)  │ │   / Sanitized SVG)    │
   └───────────┬───────────┘ └───────────┬───────────┘ └───────────┬───────────┘
               │                         │                         │
               └─────────────────────────┼─────────────────────────┘
                                         │
                                         ▼
                          ┌─────────────────────────────┐
                          │   Teacher Execution Model   │
                          │   (Socratic / Lecture Mode) │
                          └──────────────┬──────────────┘
                                         │
               ┌─────────────────────────┴─────────────────────────┐
               ▼                                                   ▼
   ┌───────────────────────┐                           ┌───────────────────────┐
   │     Checker Agent     │                           │    Improver Agent     │
   │ (Textbook Drift Check │                           │ (RSI Feedback Loop on │
   │   & Fact-Checking)    │                           │    Student 👎 Rate)   │
   └───────────────────────┘                           └───────────────────────┘
```

1. **🧭 Planner Agent (`app/agents/planner.py`)**:
   - Classifies student input into intents: `explain`, `simpler`, `example`, `quiz`, `doubt`.
   - Detects question difficulty (`easy` vs `hard`) to escalate to deep reasoning models (e.g., DeepSeek / Llama 70B).
   - Fast-path rule classifier filters out greetings/chitchat instantly without wasting LLM or RAG calls.

2. **📚 Retriever Agent & Curriculum Grounding (`app/rag/retrieve.py`)**:
   - Grounds answers in official board textbooks (Maharashtra SSC Balbharati Class 10 Science, CBSE, NCERT).
   - Local ONNX-based dense vector search (`fastembed` with `bge-small-en-v1.5`, 384 dimensions) across 930+ chunks.
   - **Smart Query Expansion**: If initial student query confidence is low ($\text{score} < 0.65$), an LLM rewrites the query into academic textbook terminology and executes multi-query retrieval.
   - Yields deterministic, verifiable source citations (e.g., *Balbharati Class 10 Science, Part 1, p.14*).

3. **📐 Solver Agent & SymPy Correctness Engine (`app/correctness/`)**:
   - **Non-Negotiable Rule (§7)**: The LLM is never allowed to compute final numbers or algebraic steps unaided.
   - Pre-computation pass extracts numerical/symbolic equations and verifies them with SymPy before the teacher formulates the explanation.
   - Post-generation arithmetic verification detects hallucinations and appends corrections if arithmetic errors occur.

4. **📊 Diagram Agent & Visual Generation (`app/diagrams/render.py`)**:
   - **No Hallucinated Image Generation**: Image generation models frequently misspell labels and draw wrong physics/maths graphs. Tark uses **100% code-rendered diagrams**:
     1. **Mathematical Function Graphs**: SymPy generates curve points, rendered to high-res PNG via Matplotlib with customized palettes and annotations.
     2. **Flowcharts & Process Cycles**: Mermaid.js syntax for biological cycles, chemical pathways, and logic flows.
     3. **Structural Schematics**: Sanitized SVG renderer for anatomical/biological diagrams (e.g., heart chambers, cell organelles, circuits) with strict XSS sanitization.

5. **🔍 Checker & Cross-Check Agent (`app/main.py`)**:
   - Compares tutor explanations against grounded textbook source passages using an independent model (Llama 3.3 70B on Groq) to ensure zero contradiction.
   - Second-model cross-checks for AI-generated notes.

6. **🔄 Improver Agent & Recursive Self-Improvement (RSI) (`app/improve/store.py`)**:
   - When a student clicks 👎 on a response, the system executes a self-critique prompt to derive an actionable teaching directive.
   - Merges and consolidates directives per user and per subject/board to ensure future answers on that topic adapt continuously.

7. **🧠 Learner Model & Adaptive Mastery (`app/learner/store.py`)**:
   - Tracks per-topic strength, struggle counts, and frequency.
   - Automatically injects teacher guidance for topics where the student has struggled previously (prompting extra patience, step-by-step scaffolding, and comprehension checks).

---

## 3. Resilient Model Router & Providers

- **Single Source of Truth**: Defined strictly in `backend/app/config/models.py`.
- **Supported Models**:
  - `Acharya`: Tark's primary grounded tutor model (Curriculum RAG + Multi-agent).
  - `Gemini Flash 2.5`: Multimodal vision & fast lecture delivery.
  - `Llama 3.3 70B`: High-speed reasoning & verification checker via Groq.
  - `DeepSeek V3.2`: Deep multi-step reasoning and mathematical proofs via SambaNova.
  - `Mistral Large`: Strong linguistic reasoning and instruction following.
  - `GPT-OSS 120B`: Ultra-low latency open architecture via Cerebras.
  - `DeepSeek R1`: Frontier reasoning model (Admin tier).
- **Failover & Backoff**: Handles rate limits (`429`) with automatic exponential backoff (1s, 2s, 4s, 8s) and dynamic provider switching so sessions never drop.

---

## 4. Teaching Modes

- **Teacher / Lecture Mode (`teacher.py`)**: Structured instruction: Introduction → Conceptual breakdown → Worked examples → Formative understanding check.
- **Socratic Mode (`socratic.py`)**: Strict no-answer-dumping guardrails: guides through progressive questions, provides tiered hints upon repeated struggle, and empowers the student to derive the solution themselves.

---

## 5. Frontend & UI Capabilities

- **Real-time SSE Streaming**: Live token streaming with real-time KaTeX mathematical rendering.
- **Multimodal Image Upload**: Attach photos of homework or diagrams for Gemini Vision processing.
- **Audio Read-Aloud (TTS)**: Built-in voice playback powered by Gemini 2.5 Flash TTS with automatic fallback to Web Speech API.
- **Sidebar & History Management**: Auto-generated conversation titles, full history switching, and session deletion.
- **Guest Quota & Gating**: 20 free guest interactions before prompting account registration.
- **Student Progress Modal**: Visual mastery map of mastered chapters, weak spots, and revision topics.
- **User Authentication**: 6-digit email OTPs via Brevo, password hashing with salt, and school-to-board search.
- **Theme Switcher**: System default, Light, and Dark themes.

---

## 6. API Reference Summary

| Endpoint | Method | Function |
| :--- | :--- | :--- |
| `/health` | `GET` | Server liveness and database connectivity status |
| `/curriculum` | `GET` | Available boards, grades, and subjects indexed in RAG |
| `/schools` | `GET` | Type-ahead autocomplete for schools and affiliated boards |
| `/models` | `GET` | Registry of models, tiers, and permissions |
| `/chat` | `POST` | Multi-agent SSE streaming chat execution |
| `/learner` | `GET` | Student topic mastery and struggle analytics |
| `/feedback` | `POST` | Negative feedback self-critique trigger (RSI) |
| `/tts` | `POST` | High-fidelity natural voice audio synthesis |
| `/verify` | `POST` | Direct SymPy equation verification seam |
| `/auth/*` | `POST/GET` | Signup, 6-digit email OTP verification, login, profile, and password reset |
| `/chats/*` | `POST/GET/DELETE` | Multi-turn conversation persistence and retrieval |

---

## 7. Production Architecture & Capacity

For complete load calculations, multi-worker setup, rate-limiting guards, and cloud deployment guides, see [docs/PRODUCTION_SCALING_GUIDE.md](file:///c:/Users/shishir/OneDrive/Documents/tark/docs/PRODUCTION_SCALING_GUIDE.md).

- **Total Pooled Capacity:** ~1.38 Million requests/month (~46,000 requests/day, ~145 RPM).
- **Daily Active User (DAU) Limit:** ~3,000 to 4,500 active students per day across all free tiers combined.
- **Concurrent Chat Limit:** ~100–150 students typing in the same second without hitting rate limits.
- **Failover Chain:** Gemini 2.5 Flash → OpenAI GPT-4o Mini → Groq Llama 3.3 70B → SambaNova DeepSeek V3.2 → NVIDIA NIM Llama 70B → Mistral Large.
- **Web Search Failover:** Dual Tavily pooled keys (2,000 requests/month) with 24-hour cache and arithmetic bypass.

