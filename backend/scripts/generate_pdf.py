import os
import fitz

def generate_pdf():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    out_path = os.path.join(root_dir, "TARK_SYSTEM_DOCUMENTATION.pdf")

    # Clean A4 dimensions in points (595 x 842)
    doc = fitz.open()

    # Brand Colors (RGB 0-1)
    PRIMARY = (0.31, 0.27, 0.90)       # #4f46e5 Indigo
    TEXT_DARK = (0.10, 0.12, 0.16)     # Dark slate
    TEXT_MUTED = (0.40, 0.45, 0.52)    # Cool gray
    BG_CARD = (0.95, 0.96, 0.98)       # Light gray-blue
    BORDER = (0.82, 0.85, 0.90)        # Border gray
    WHITE = (1.0, 1.0, 1.0)

    # -------------------------------------------------------------
    # PAGE 1: Executive Summary & Multi-Agent Architecture
    # -------------------------------------------------------------
    doc.new_page(width=595, height=842)
    p1 = doc[0]

    # Header Banner
    p1.draw_rect(fitz.Rect(0, 0, 595, 75), color=PRIMARY, fill=PRIMARY)
    p1.insert_text(fitz.Point(40, 38), "TARK (तर्क) — System & Feature Documentation", fontsize=18, fontname="helv", color=WHITE)
    p1.insert_text(fitz.Point(40, 58), "Executive Summary & Multi-Agent Intelligence Layer", fontsize=10, fontname="helv", color=(0.85, 0.88, 1.0))

    # Mission Statement Box
    p1.draw_rect(fitz.Rect(40, 95, 555, 160), color=PRIMARY, fill=BG_CARD, width=1)
    p1.insert_text(fitz.Point(55, 116), "Core Architectural Thesis & Vision", fontsize=12, fontname="helv", color=PRIMARY)
    p1.insert_textbox(
        fitz.Rect(55, 122, 540, 155),
        "\"The language model is the engine; the pedagogy and correctness are the product.\"\n"
        "Tark (from Sanskrit tarka: logic/reasoning) is an adaptive, curriculum-grounded multi-agent AI tutoring system.",
        fontsize=9.2, fontname="helv", color=TEXT_DARK
    )

    # Section 1: Multi-Agent Architecture
    p1.insert_text(fitz.Point(40, 182), "1. Multi-Agent Orchestration & Intelligence", fontsize=13.5, fontname="helv", color=PRIMARY)
    
    agents = [
        ("🧭 Planner Agent", "Classifies student intents (explain, simpler, example, quiz, doubt). Detects question difficulty (easy vs hard) to escalate to heavy reasoning models. Filters out greetings instantly to avoid unnecessary LLM & RAG costs."),
        ("📚 Retriever Agent (RAG)", "Curriculum grounding across 930+ textbook chunks using local FastEmbed (BAAI/bge-small-en-v1.5, 384-dim). Includes Smart Query Expansion into academic terminology when initial student query confidence is < 0.65."),
        ("📐 Solver Agent (SymPy)", "Enforces mathematical correctness (§7). LLMs never compute unaided; pre-computation pass computes symbolic/numerical equations using SymPy, and post-verification checks arithmetic."),
        ("📊 Diagram Agent", "Zero hallucinated image models (§11). Renders 100% code-generated figures: Matplotlib function curves (PNG), Mermaid process/biological cycles, and sanitized structural SVGs (e.g. anatomy, circuits)."),
        ("🔍 Checker & Cross-Check", "Secondary model verification (Llama 3.3 70B via Groq) compares answers against textbook excerpts to prevent drift, with second-model cross-checks on AI-generated notes."),
        ("🔄 Improver Agent (RSI)", "Recursive Self-Improvement: Student 👎 feedback triggers a self-critique model to extract actionable teaching directives, consolidating them per topic and user for future turns."),
        ("🧠 Learner Model", "Tracks per-student topic strength and struggle counts. Injects pedagogical scaffolding when weak topics are encountered."),
    ]

    y = 198
    for title, desc in agents:
        p1.draw_rect(fitz.Rect(40, y, 555, y + 68), color=BORDER, fill=BG_CARD, width=0.8)
        p1.insert_text(fitz.Point(52, y + 17), title, fontsize=10.5, fontname="helv", color=PRIMARY)
        p1.insert_textbox(fitz.Rect(52, y + 23, 545, y + 64), desc, fontsize=8.6, fontname="helv", color=TEXT_DARK)
        y += 74

    # Footer Page 1
    p1.draw_line(fitz.Point(40, 795), fitz.Point(555, 795), color=BORDER, width=0.8)
    p1.insert_text(fitz.Point(40, 812), "Tark AI Tutor Architecture • Confidential & Proprietary", fontsize=8.5, fontname="helv", color=TEXT_MUTED)
    p1.insert_text(fitz.Point(495, 812), "Page 1 of 2", fontsize=8.5, fontname="helv", color=TEXT_MUTED)

    # -------------------------------------------------------------
    # PAGE 2: Model Router, Teaching Modes & UI Capabilities
    # -------------------------------------------------------------
    doc.new_page(width=595, height=842)
    p2 = doc[1]

    # Header Banner
    p2.draw_rect(fitz.Rect(0, 0, 595, 75), color=PRIMARY, fill=PRIMARY)
    p2.insert_text(fitz.Point(40, 38), "TARK (तर्क) — System & Feature Documentation", fontsize=18, fontname="helv", color=WHITE)
    p2.insert_text(fitz.Point(40, 58), "Model Router, Teaching Modes & UI Capabilities", fontsize=10, fontname="helv", color=(0.85, 0.88, 1.0))

    # Section 2: Model Router
    p2.insert_text(fitz.Point(40, 98), "2. Resilient Model Router & Free-Tier Providers", fontsize=13.5, fontname="helv", color=PRIMARY)
    p2.insert_textbox(
        fitz.Rect(40, 106, 555, 126),
        "Single source of truth in backend/app/config/models.py. Features exponential backoff on 429 rate limits and multi-provider failover.",
        fontsize=8.8, fontname="helv", color=TEXT_MUTED
    )

    models_data = [
        ("Acharya (Default)", "Google Gemini / Router", "Tark native tutor with board grounding + RAG", "Grounded"),
        ("Gemini Flash 2.5", "Google AI Studio", "Fast lecture delivery & multimodal vision", "Standard"),
        ("Llama 3.3 70B", "Groq", "High-speed reasoning & verification checker", "Standard"),
        ("DeepSeek V3.2", "SambaNova", "Heavy multi-step reasoning and mathematical proofs", "Standard"),
        ("Mistral Large", "Mistral AI", "Strong linguistic reasoning and instruction following", "Standard"),
        ("GPT-OSS 120B", "Cerebras", "Ultra-low latency open architecture", "Standard"),
        ("DeepSeek R1", "OpenRouter", "Frontier reasoning model (Admin tier)", "Admin Tier"),
    ]

    # Table Header
    p2.draw_rect(fitz.Rect(40, 132, 555, 150), color=PRIMARY, fill=PRIMARY)
    p2.insert_text(fitz.Point(48, 145), "Model Name", fontsize=9, fontname="helv", color=WHITE)
    p2.insert_text(fitz.Point(170, 145), "Provider", fontsize=9, fontname="helv", color=WHITE)
    p2.insert_text(fitz.Point(280, 145), "Capability / Role", fontsize=9, fontname="helv", color=WHITE)
    p2.insert_text(fitz.Point(485, 145), "Tier / Type", fontsize=9, fontname="helv", color=WHITE)

    my = 150
    for i, (name, prov, role, tier) in enumerate(models_data):
        row_bg = WHITE if i % 2 == 0 else BG_CARD
        p2.draw_rect(fitz.Rect(40, my, 555, my + 22), color=BORDER, fill=row_bg, width=0.5)
        p2.insert_text(fitz.Point(48, my + 15), name, fontsize=8.2, fontname="helv", color=TEXT_DARK)
        p2.insert_text(fitz.Point(170, my + 15), prov, fontsize=8.2, fontname="helv", color=TEXT_MUTED)
        p2.insert_text(fitz.Point(280, my + 15), role, fontsize=7.8, fontname="helv", color=TEXT_DARK)
        p2.insert_text(fitz.Point(485, my + 15), tier, fontsize=7.8, fontname="helv", color=PRIMARY)
        my += 22

    # Section 3: Teaching Modes
    p2.insert_text(fitz.Point(40, 325), "3. Pedagogical Teaching Modes", fontsize=13.5, fontname="helv", color=PRIMARY)
    
    p2.draw_rect(fitz.Rect(40, 340, 555, 400), color=BORDER, fill=BG_CARD, width=0.8)
    p2.insert_text(fitz.Point(52, 358), "👩‍🏫 Teacher / Lecture Mode", fontsize=10.5, fontname="helv", color=PRIMARY)
    p2.insert_textbox(fitz.Rect(52, 364, 545, 396), "Structured 4-stage instructional design: Contextual introduction → Core concept breakdown → Step-by-step worked example → Formative comprehension check before advancing.", fontsize=8.6, fontname="helv", color=TEXT_DARK)

    p2.draw_rect(fitz.Rect(40, 410, 555, 470), color=BORDER, fill=BG_CARD, width=0.8)
    p2.insert_text(fitz.Point(52, 428), "🏛️ Socratic Tutor Mode", fontsize=10.5, fontname="helv", color=PRIMARY)
    p2.insert_textbox(fitz.Rect(52, 434, 545, 466), "Strict guardrail against answer-dumping: Guides the learner through progressive diagnostic questions, provides tiered hints on repeated struggle, and enables derivation of the answer.", fontsize=8.6, fontname="helv", color=TEXT_DARK)

    # Section 4: Frontend UI Features
    p2.insert_text(fitz.Point(40, 492), "4. Frontend & User Experience Capabilities", fontsize=13.5, fontname="helv", color=PRIMARY)
    
    ui_features = [
        "• Real-time SSE Token Streaming with seamless KaTeX mathematical LaTeX rendering.",
        "• Multimodal Vision: Drag-and-drop or upload photos of handwritten sums and textbook pages.",
        "• Audio Read-Aloud (TTS): High quality Gemini 2.5 Flash TTS synthesis with Web Speech API fallback.",
        "• Comprehensive Session Management: Sidebar chat list, auto-generated titles, and deletion.",
        "• Guest Quota Management: 20 free guest interactions before prompting user authentication.",
        "• Mastery & Progress Modal: Real-time student mastery map of topics, revisions, and struggle scores.",
        "• User Authentication: 6-digit email OTPs via Brevo, password hashing with salt, and school search.",
        "• Appearance Engine: Built-in Light, Dark, and System theme support with full CSS tokenization."
    ]
    
    uy = 512
    for feat in ui_features:
        p2.insert_text(fitz.Point(45, uy), feat, fontsize=8.6, fontname="helv", color=TEXT_DARK)
        uy += 21

    # Footer Page 2
    p2.draw_line(fitz.Point(40, 795), fitz.Point(555, 795), color=BORDER, width=0.8)
    p2.insert_text(fitz.Point(40, 812), "Tark AI Tutor Architecture • Confidential & Proprietary", fontsize=8.5, fontname="helv", color=TEXT_MUTED)
    p2.insert_text(fitz.Point(495, 812), "Page 2 of 2", fontsize=8.5, fontname="helv", color=TEXT_MUTED)

    import base64
    b64 = base64.b64encode(doc.tobytes()).decode('utf-8')
    print("PDF_B64_START")
    print(b64)
    print("PDF_B64_END")
    doc.close()

if __name__ == "__main__":
    generate_pdf()
