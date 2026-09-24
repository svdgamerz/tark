# Tark — AI Roadmap & "Real AI Project" Build List

> **Thesis (from CLAUDE.md):** the frontier APIs (Gemini / NVIDIA NIM) are the *engine*;
> Tark's own AI — curriculum grounding, adaptivity, correctness, evaluation — is the
> *product*. This list is what makes Tark demonstrably a real AI project, not an API wrapper.

---

## 0. Core idea — board-specific, curriculum-grounded tutor  ⭐ (your idea)

> **Progress (2026-06-25):** RAG core **built and proven on REAL content**. Both Maharashtra
> Class 10 Science books (Part 1 + Part 2) are ingested — **934 chunks** in
> `backend/tark_rag.db` — and retrieval returns the right chapter + page with citations
> (gravitation p.14, refraction p.83, heredity Part 2 p.11). Embeddings are now **local**
> (`fastembed`, BAAI/bge-small-en-v1.5, 384-dim) — no API rate limits for indexing or queries
> (Gemini's free embedding tier caps at 100/min, which we hit). Calibration: relevant hits
> score 0.77+, an off-syllabus question scored 0.55 → set the **fall-back threshold ≈ 0.65**.
>
> **RAG is now wired into `/chat` (2026-06-25):** board-selected questions get a grounded
> answer + a deterministic "📖 Source: Balbharati, Class 10 Science, Part 1, p.X" line;
> off-syllabus questions fall back to Gemini/NIM with no citation. The UI has a syllabus
> selector (`backend/app/rag/retrieve.py`, `main.py`, `frontend` selector). Threshold = 0.65.
>
> **Next:** disclaimer in the UI; evaluation set (accuracy/grounding metrics); add Class 9 +
> Maths; request Balbharati permission; consider a backup chat provider (Groq) in the router.

The realistic, high-impact way to "train Tark on official board PDFs":

- [ ] **Use RAG, not from-scratch training.** Ingest official board material → retrieve the
      relevant pages at query time → answer grounded in them. (Training teaches *style*;
      RAG injects *knowledge* and stays updatable when syllabi change.)
- [ ] **Data pipeline:** collect official PDFs per board (ICSE, CBSE/NCERT, IGCSE, SSC/state)
      → parse text → chunk → embed → store in a vector DB.
- [ ] **Board / grade / subject selector** in the UI → scope retrieval to the right syllabus.
- [ ] **Grounded answers with citations** (source page/section) — builds trust, proves grounding.
- [ ] **Confidence + fallback (your fallback idea):** if retrieval finds nothing relevant
      (Tark's own knowledge "doesn't know"), fall back to Gemini/NIM via the **existing model
      router**. A confidence threshold decides when to fall back.
- [ ] Decide pilot scope: 1 board, 1–2 grades, 1–2 subjects (see Open Questions).
- [ ] Copyright check on source PDFs (see Open Questions).

## 1. Build your own models — proof you understand how models work

- [ ] `notebooks/01_train_mini_gpt.ipynb` — train a tiny GPT (nanoGPT) **from scratch** on a
      small corpus; show the loss curve + sample text. (Pure "I understand transformers.")
- [ ] `notebooks/02_lora_finetune.ipynb` — **LoRA/QLoRA fine-tune** an open model
      (Llama / Mistral / Qwen / Phi) on tutoring-style Q&A; show before/after outputs.
- [ ] Host the fine-tuned model and add it to the router as a **"Tark-tuned"** option.

## 2. Adaptive intelligence — pedagogy is the product

- [ ] **Learner model** — Bayesian Knowledge Tracing (or a small NN) to estimate per-topic
      mastery for each student.
- [ ] **Misconception detector** — a classifier that maps a wrong answer to the *underlying*
      misconception (not just "wrong").
- [ ] **Spaced repetition** scheduler for revision.
- [ ] **Difficulty estimation** → adaptive question selection (quiz gets harder/easier).

## 3. Reliability & trust

- [ ] Wire the **SymPy correctness** layer fully — verify every numeric/symbolic result (§7).
- [ ] **Hallucination mitigation:** RAG grounding + citations + honest "I'm not sure."
- [ ] **Safety guardrails** (we serve minors): age-appropriate language, refuse inappropriate
      content, **strip PII** before sending to free-tier APIs (§12).
- [ ] **Confidence calibration** — decide *when* the local/RAG answer is trustworthy vs. when
      to fall back to the big models.

## 4. Evaluation — what actually separates real AI work from a demo

- [ ] Build a **benchmark from past papers** per board/subject (questions + correct answers).
- [ ] Track metrics: answer accuracy, retrieval hit-rate, **Socratic answer-leak rate**,
      misconception-detection F1, hallucination rate.
- [ ] A/B test prompts & models; catch regressions.

## 5. Demonstration artifacts — for the demo / report / viva

- [ ] **Architecture diagram** separating "engine (API)" from "our AI" (RAG, router, learner
      model, correctness, fine-tuned model).
- [ ] The training notebooks from §1 as evidence of understanding.
- [ ] A short **metrics report** (numbers, not just a chat demo).
- [ ] A written **design rationale** (why route tasks to different models, how you fight
      hallucination, the learner-model math).
- [ ] An **honest scope statement** (what's frontier-API vs what's ours).

---

## Concept checklist (the AI/ML ideas this project demonstrates)

- [ ] Transformers / attention (mini-GPT)        - [ ] Tokenization & embeddings
- [ ] Fine-tuning (LoRA/QLoRA)                    - [ ] Retrieval-Augmented Generation (RAG)
- [ ] Vector databases & semantic search         - [ ] Prompt engineering / system design
- [ ] Model routing & fallback                   - [ ] Confidence / calibration
- [ ] Hallucination mitigation & grounding       - [ ] Bayesian Knowledge Tracing (learner model)
- [ ] Classification (misconception detector)    - [ ] Spaced-repetition algorithms
- [ ] Evaluation & benchmarking                  - [ ] Safety / guardrails for minors
- [ ] Multimodal (photo of a problem) — later    - [ ] Data pipelines (PDF → chunks → index)

---

## Decisions (locked 2026-06-25)

- **Board:** SSC / State board (confirm *which state* — see below).
- **Intent:** Real public product → copyright + safety/privacy matter.
- **Build track:** **RAG over board PDFs first**, with confidence-fallback to Gemini/NIM.
  LoRA fine-tune, from-scratch mini-GPT, and the learner model are deferred.

## Still need from you (to start the RAG slice)

1. **Which state's SSC board?** e.g. Maharashtra State Board (Balbharati), Gujarat, etc. —
   each state has different books/sites.
2. **Pilot grade + subject** — recommended: **Class 10, one subject** (Math or Science).
3. **Source** — the official site / PDF link for that grade+subject.

## ⚠️ Copyright — because this is a PUBLIC product

State-board textbooks are usually © the board, so we can't just ingest and redistribute them.
For a public product we must do ONE of:
- use material the board publishes under open/free terms (check the site's terms), **or**
- get permission, **or**
- limit RAG to content we're clearly allowed to use (syllabus/topic outlines, govt open
  content, your own written notes).

NCERT is openly licensed — a safe corpus to keep as a fallback if a state board's terms are
unclear. **We must confirm the chosen board's license before ingesting full textbooks.**

## First milestone (smallest end-to-end slice)

One state SSC board + one grade + one subject → RAG pipeline (PDF → parse → chunk → embed →
vector DB → grounded answer **with citations**) + confidence-fallback to Gemini/NIM. Prove the
architecture on that one slice, then scale to more subjects/grades/boards.

## Recommended RAG stack (Tark backend, Python)

- **PDF parse:** PyMuPDF (`fitz`) or `pdfplumber`
- **Embeddings:** Gemini `text-embedding-004` (we already have the key) **or** local
  `sentence-transformers/all-MiniLM-L6-v2` (free, offline, no per-query cost — good for scale)
- **Vector store:** start local (Chroma / FAISS) for dev; for the public product use
  **pgvector on Supabase** (we already have Supabase) so it's persistent and scalable
- **Flow:** retrieve top-k chunks → build a grounded prompt with citations → generate →
  if the top similarity score is below a threshold, **fall back** to Gemini/NIM via the router
