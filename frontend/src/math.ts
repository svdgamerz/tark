// Enhanced LaTeX and Math Parser for KaTeX.
// Supports:
// - Display math: $$...$$, \[...\], \begin{equation/align/matrix}...
// - Inline math: $...$, \(...\)
// - \boxed{...} and clean equation formatting with safety fallbacks.
import katex from 'katex'

export interface Segment {
  type: 'text' | 'math'
  value: string
  display: boolean
}

// Regex matching display math ($$...$$, \[...\], \begin{env}...\end{env}) and inline math ($...$, \(...\))
const MATH_RE =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\begin\{(matrix|pmatrix|bmatrix|vmatrix|Vmatrix|align|aligned|gather|gathered|equation|equation\*)\}([\s\S]+?)\\end\{\1\}|\\\(([\s\S]+?)\\\)|\$([^$\n]+?)\$/g

export function parseSegments(input: string): Segment[] {
  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  MATH_RE.lastIndex = 0
  while ((match = MATH_RE.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: input.slice(lastIndex, match.index),
        display: false,
      })
    }

    // Display math: $$...$$
    if (match[1] !== undefined) {
      segments.push({ type: 'math', value: match[1].trim(), display: true })
    }
    // Display math: \[...\]
    else if (match[2] !== undefined) {
      segments.push({ type: 'math', value: match[2].trim(), display: true })
    }
    // Environment: \begin{env}...\end{env}
    else if (match[3] !== undefined && match[4] !== undefined) {
      segments.push({
        type: 'math',
        value: `\\begin{${match[3]}}${match[4]}\\end{${match[3]}}`,
        display: true,
      })
    }
    // Inline math: \(...\)
    else if (match[5] !== undefined) {
      segments.push({ type: 'math', value: match[5].trim(), display: false })
    }
    // Inline math: $...$
    else if (match[6] !== undefined) {
      segments.push({ type: 'math', value: match[6].trim(), display: false })
    }

    lastIndex = MATH_RE.lastIndex
  }

  if (lastIndex < input.length) {
    segments.push({ type: 'text', value: input.slice(lastIndex), display: false })
  }
  return segments
}

const DIAGRAM_HEAD =
  /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|mindmap|gantt|pie|journey)\b/i

// Pull out ```mermaid ...``` blocks so they render as interactive figures
export function extractDiagramCode(text: string): {
  clean: string
  mermaid: string | null
} {
  let mermaid: string | null = null
  const clean = text.replace(
    /```[ \t]*([a-zA-Z]*)[ \t]*\r?\n([\s\S]*?)```/g,
    (whole, lang: string, body: string) => {
      const b = body.trim()
      if (/^mermaid$/i.test(lang) || DIAGRAM_HEAD.test(b)) {
        if (!mermaid) mermaid = b.replace(/^mermaid\s*\r?\n/i, '')
        return ''
      }
      return whole // keep non-diagram code blocks
    },
  )
  return { clean: clean.replace(/\n{3,}/g, '\n\n').trim(), mermaid }
}

export function stripDiagramForDisplay(text: string): string {
  const t = extractDiagramCode(text).clean
  return t
    .replace(/```[ \t]*mermaid[ \t]*\r?\n[\s\S]*$/i, '')
    .replace(/```[ \t]*\r?\n(graph|flowchart|sequenceDiagram)\b[\s\S]*$/i, '')
    .trim()
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE ?? 'http://127.0.0.1:8000'

// Format markdown text with clean step headers, lists, tables, and images
export function renderMarkdown(text: string): string {
  // First extract images so their URLs aren't mangled by html escaping
  const images: { id: string; html: string }[] = []

  function resolveSrc(raw: string): string {
    const clean = raw.trim().replace(/^<|>$/g, '')
    if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:')) {
      return clean
    }
    const path = clean.startsWith('/') ? clean : `/${clean}`
    return `${API_BASE}${path}`
  }

  // 1. Markdown images: ![alt](url)
  let s = text.replace(/!\[([^\]]*?)\]\(([^)]+?)\)/g, (_all, alt, src) => {
    const placeholder = `__IMG_PLACEHOLDER_${images.length}__`
    const safeAlt = escapeHtml(alt || 'Textbook Page')
    const fullSrc = resolveSrc(src)
    images.push({
      id: placeholder,
      html: `<div class="md-image-card"><img src="${fullSrc}" alt="${safeAlt}" class="md-chat-image" loading="eager" onclick="window.__openImageModal && window.__openImageModal('${fullSrc}', '${safeAlt}')" /><div class="md-image-caption"><span>${safeAlt}</span><span class="md-zoom-hint">Click to enlarge</span></div></div>`,
    })
    return placeholder
  })

  // 2. HTML img tags: <img src="..." />
  s = s.replace(/<img\s+[^>]*?src=["']([^"']+)["'][^>]*?>/gi, (_all, src) => {
    const placeholder = `__IMG_PLACEHOLDER_${images.length}__`
    const fullSrc = resolveSrc(src)
    images.push({
      id: placeholder,
      html: `<div class="md-image-card"><img src="${fullSrc}" alt="Textbook Page" class="md-chat-image" loading="eager" onclick="window.__openImageModal && window.__openImageModal('${fullSrc}', 'Textbook Page')" /><div class="md-image-caption"><span>Textbook Page</span><span class="md-zoom-hint">Click to enlarge</span></div></div>`,
    })
    return placeholder
  })

  s = escapeHtml(s)
  // Restore <br> tags cleanly so raw HTML does not show as &lt;br&gt;
  s = s.replace(/&lt;br\s*\/?&gt;/gi, '<br />')

  // Remove standalone horizontal rule dividers (---, ***, ___) that visually slice text into distracting lines
  s = s.replace(/^\s*[-*_]{3,}\s*$/gm, '')

  // Step headers: **Step 1: ...** or # Heading
  s = s.replace(/^\s{0,3}#{1,6}\s+(.+)$/gm, '<div class="md-heading">$1</div>')
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>')
  s = s.replace(/^\s*[-*]\s+(.+)$/gm, '<div class="md-bullet"><span class="md-dot">•</span><span>$1</span></div>')
  s = s.replace(/(^|[^\w*])\*(\S[^*\n]*?)\*(?!\*)/g, '$1<em>$2</em>')
  s = s.replace(/`([^`\n]+?)`/g, '<code class="md-inline-code">$1</code>')

  // Parse Markdown pipe tables (| col1 | col2 |) into sleek HTML tables
  s = s.replace(/(?:^[ \t]*\|[^\n]+\|[ \t]*(?:\r?\n|$))+/gm, (tableBlock) => {
    const lines = tableBlock
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|') && l.endsWith('|'))
    if (lines.length < 2) return tableBlock

    const sepIdx = lines.findIndex((l, i) => i > 0 && /^\|(?:[ \t]*:?-+:?[ \t]*\|)+$/.test(l))
    if (sepIdx === -1) return tableBlock

    const headerLines = lines.slice(0, sepIdx)
    const bodyLines = lines.slice(sepIdx + 1)

    const parseCells = (line: string) => {
      const trimmed = line.replace(/^\|/, '').replace(/\|$/, '')
      return trimmed.split('|').map((c) => c.trim())
    }

    let html = '<div class="md-table-container"><table class="md-table">'
    if (headerLines.length > 0) {
      html += '<thead>'
      for (const hLine of headerLines) {
        html += '<tr>'
        for (const cell of parseCells(hLine)) {
          html += `<th>${cell}</th>`
        }
        html += '</tr>'
      }
      html += '</thead>'
    }

    if (bodyLines.length > 0) {
      html += '<tbody>'
      for (const bLine of bodyLines) {
        html += '<tr>'
        for (const cell of parseCells(bLine)) {
          html += `<td>${cell}</td>`
        }
        html += '</tr>'
      }
      html += '</tbody>'
    }

    html += '</table></div>'
    return html
  })

  // Restore image placeholders
  for (const img of images) {
    s = s.replace(img.id, img.html)
  }

  return s
}

export function cleanMathForKaTeX(val: string): string {
  let s = val
  // Fix model quirks: \muk -> \mu_k, \mus -> \mu_s
  s = s.replace(/\\muk\b/g, '\\mu_k')
  s = s.replace(/\\mus\b/g, '\\mu_s')
  // Fix v0 -> v_0, a0 -> a_0, x0 -> x_0
  s = s.replace(/\b([vVaAxXyYzZ])0\b/g, '$1_0')
  // Fix F{\text{fr}} -> F_{\text{fr}}
  s = s.replace(/F\{\\text\{fr\}\}/g, 'F_{\\text{fr}}')
  return s
}

export function renderMath(value: string, display: boolean): string {
  try {
    const cleaned = cleanMathForKaTeX(value)
    return katex.renderToString(cleaned, {
      displayMode: display,
      throwOnError: false,
      trust: true,
      strict: false,
      output: 'htmlAndMathml',
    })
  } catch {
    return `<span class="katex-error">${escapeHtml(value)}</span>`
  }
}

/**
 * Converts raw LaTeX and mathematical notation into intuitive, student-friendly Unicode text.
 * Replaces confusing LaTeX code (like \[ v^2 = v0^2 + 2 a d \quad\text{with final speed } v = 0. \])
 * with clean readable text: "v² = v₀² + 2 a d (with final speed v = 0)"
 */
export function latexToHumanReadable(text: string): string {
  if (!text) return ''
  let s = text

  // 1. Escaped spaces and spacing keywords
  s = s.replace(/\\[ \t]+/g, ' ')
  s = s.replace(/\\(?:quad|qquad)\b|\\(?:quad|qquad)(?=[\\{]|\s)/g, ' ')
  s = s.replace(/\\(?:,|;|!)/g, ' ')
  s = s.replace(/\\left|\\right/g, '')

  // 2. Pre-sanitize common model quirks & variables
  s = s.replace(/\\muk\b|\\mu_k\b/g, 'μₖ')
  s = s.replace(/\\mus\b|\\mu_s\b/g, 'μₛ')
  s = s.replace(/\\mu\b/g, 'μ')
  s = s.replace(/F\{\\text\{fr\}\}|F_\{?\\text\{fr\}\}?|F_?fr\b/gi, 'F_friction')

  // 3. Units: m s^{-1} -> m/s, m s^{-2} -> m/s², m/s^2 -> m/s²
  s = s.replace(/(?:\\text\{\s*m[\s\u202F\u00A0]*s\s*\}|m[\s\u202F\u00A0]*s)\^?\{-?1\}|\\text\{\s*m[\s\u202F\u00A0]*s\^?\{-?1\}\s*\}|m[\s\u202F\u00A0]*s⁻¹/gi, 'm/s')
  s = s.replace(/(?:\\text\{\s*m[\s\u202F\u00A0]*s\s*\}|m[\s\u202F\u00A0]*s)\^?\{-?2\}|\\text\{\s*m[\s\u202F\u00A0]*s\^?\{-?2\}\s*\}|m[\s\u202F\u00A0]*s⁻²|m\/s\^2/gi, 'm/s²')
  s = s.replace(/\\text\{\s*kg\s*\}/gi, 'kg')
  s = s.replace(/\\text\{\s*N\s*\}/gi, 'N')
  s = s.replace(/\\text\{\s*s\s*\}/gi, 's')
  s = s.replace(/\\text\{\s*m\s*\}/gi, 'm')

  // 4. Unwrap \text{...} and \boxed{...} (allow nested braces)
  for (let iter = 0; iter < 4; iter++) {
    s = s.replace(/\\text\{([^{}]*)\}/g, '$1')
    s = s.replace(/\\boxed\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '$1')
    s = s.replace(/\bboxed\b/gi, '')
  }

  // Normalize any remaining unit formats
  s = s.replace(/m[\s\u202F\u00A0]*s⁻¹/g, 'm/s')
  s = s.replace(/m[\s\u202F\u00A0]*s⁻²/g, 'm/s²')

  // 5. Fractions: \frac{a}{b} -> (a / b)
  for (let iter = 0; iter < 4; iter++) {
    s = s.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '($1 / $2)')
  }

  // 6. Square roots: \sqrt{x} -> √(x)
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')

  // 7. Subscripts: _0 -> ₀, _1 -> ₁, _2 -> ₂, _k -> ₖ, _s -> ₛ, _x -> ₓ, _y -> ᵧ, v0 -> v₀
  s = s.replace(/_0\b/g, '₀')
  s = s.replace(/_1\b/g, '₁')
  s = s.replace(/_2\b/g, '₂')
  s = s.replace(/_k\b/g, 'ₖ')
  s = s.replace(/_s\b/g, 'ₛ')
  s = s.replace(/_x\b/g, 'ₓ')
  s = s.replace(/_y\b/g, 'ᵧ')
  s = s.replace(/\b([vVaAxXyYzZ])0\b/g, '$1₀')
  s = s.replace(/_\{([^{}]+)\}/g, '($1)')

  // 8. Superscripts: ^2 -> ², ^3 -> ³, ^0 -> ⁰, ^1 -> ¹, ^{-1} -> ⁻¹, ^{-2} -> ⁻²
  s = s.replace(/\^2\b/g, '²')
  s = s.replace(/\^3\b/g, '³')
  s = s.replace(/\^0\b/g, '⁰')
  s = s.replace(/\^1\b/g, '¹')
  s = s.replace(/\^\{-1\}/g, '⁻¹')
  s = s.replace(/\^\{-2\}/g, '⁻²')
  s = s.replace(/\^\{([^{}]+)\}/g, '^$1')

  // 9. Math symbols & Greek letters
  s = s.replace(/\\times\b|\\cdot\b/g, '×')
  s = s.replace(/\\div\b/g, '÷')
  s = s.replace(/\\approx\b/g, '≈')
  s = s.replace(/\\le\b|\\leq\b/g, '≤')
  s = s.replace(/\\ge\b|\\geq\b/g, '≥')
  s = s.replace(/\\neq\b/g, '≠')
  s = s.replace(/\\pm\b/g, '±')
  s = s.replace(/\\degree\b|\^\\circ\b/g, '°')
  s = s.replace(/\\alpha\b/g, 'α')
  s = s.replace(/\\beta\b/g, 'β')
  s = s.replace(/\\gamma\b/g, 'γ')
  s = s.replace(/\\theta\b/g, 'θ')
  s = s.replace(/\\pi\b/g, 'π')
  s = s.replace(/\\lambda\b/g, 'λ')
  s = s.replace(/\\Delta\b/g, 'Δ')
  s = s.replace(/\\Sigma\b/g, 'Σ')
  s = s.replace(/\\omega\b/g, 'ω')

  // 10. Math fences: $$, $, \[, \], \(, \)
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, '$1')
  s = s.replace(/\\\[([\s\S]*?)\\\]/g, '$1')
  s = s.replace(/\\\(([\s\S]*?)\\\)/g, '$1')
  s = s.replace(/\$([^$\n]+?)\$/g, '$1')
  s = s.replace(/\\[\[\]\(\)]/g, ' ')

  // 11. Clean up remaining braces and stray backslashes
  for (let iter = 0; iter < 3; iter++) {
    s = s.replace(/\{([^{}]+)\}/g, '$1')
  }
  s = s.replace(/\\([a-zA-Z]+)/g, '$1')
  s = s.replace(/\\/g, '')
  s = s.replace(/[ \t]{2,}/g, ' ')
  s = s.replace(/\n{3,}/g, '\n\n')

  return s.trim()
}

/**
 * Converts mathematical and scientific notation into clear, spoken English
 * for Text-To-Speech (TTS) read-aloud.
 * Prevents TTS from reading "backslash quad backslash text with final speed".
 */
export function latexToSpeech(text: string): string {
  if (!text) return ''
  let s = text

  // Strip code blocks and diagrams
  s = s.replace(/```[\s\S]*?```/g, '')
  s = s.replace(/!\[([^\]]*?)\]\([^)]+?\)/g, '$1')
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // Escaped spaces and spacing keywords
  s = s.replace(/\\[ \t]+/g, ' ')
  s = s.replace(/\\(?:quad|qquad)\b|\\(?:quad|qquad)(?=[\\{]|\s)/g, ' ')
  s = s.replace(/\\(?:,|;|!)/g, ' ')
  s = s.replace(/\\left|\\right/g, '')

  // Spoken units
  s = s.replace(/(?:\\text\{\s*m[\s\u202F\u00A0]*s\s*\}|m[\s\u202F\u00A0]*s)\^?\{-?1\}|\\text\{\s*m[\s\u202F\u00A0]*s\^?\{-?1\}\s*\}|m[\s\u202F\u00A0]*s⁻¹|m\/s\b/gi, ' meters per second ')
  s = s.replace(/(?:\\text\{\s*m[\s\u202F\u00A0]*s\s*\}|m[\s\u202F\u00A0]*s)\^?\{-?2\}|\\text\{\s*m[\s\u202F\u00A0]*s\^?\{-?2\}\s*\}|m[\s\u202F\u00A0]*s⁻²|m\/s\^2\b|m\/s²/gi, ' meters per second squared ')
  s = s.replace(/\\text\{\s*kg\s*\}|\bkg\b/gi, ' kilograms ')
  s = s.replace(/\\text\{\s*N\s*\}|(?<=\d|\s)\bN\b/g, ' Newtons ')

  // Spoken variables & subscripts
  s = s.replace(/\\muk\b|\\mu_k\b|μₖ/gi, ' coefficient of kinetic friction ')
  s = s.replace(/\\mus\b|\\mu_s\b|μₛ/gi, ' coefficient of static friction ')
  s = s.replace(/\\mu\b|μ/gi, ' mu ')
  s = s.replace(/F\{\\text\{fr\}\}|F_\{?\\text\{fr\}\}?|F_?fr\b/gi, ' friction force ')
  s = s.replace(/v_0\b|v0\b|v₀/g, ' v zero ')
  s = s.replace(/v\^2\b|v\^\{2\}|v²/g, ' v squared ')
  s = s.replace(/a\^2\b|a\^\{2\}|a²/g, ' a squared ')
  s = s.replace(/x\^2\b|x\^\{2\}|x²/g, ' x squared ')
  s = s.replace(/\^2\b|²/g, ' squared ')
  s = s.replace(/\^3\b|³/g, ' cubed ')

  // Fractions & roots
  for (let iter = 0; iter < 4; iter++) {
    s = s.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, ' $1 over $2 ')
  }
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, ' square root of $1 ')

  // Spoken operators
  s = s.replace(/\\times\b|×/g, ' multiplied by ')
  s = s.replace(/\\cdot\b/g, ' times ')
  s = s.replace(/\\approx\b|≈/g, ' approximately ')
  s = s.replace(/\\le\b|\\leq\b|≤/g, ' is less than or equal to ')
  s = s.replace(/\\ge\b|\\geq\b|≥/g, ' is greater than or equal to ')
  s = s.replace(/\\neq\b|≠/g, ' is not equal to ')
  s = s.replace(/=/g, ' equals ')
  s = s.replace(/\+/g, ' plus ')
  s = s.replace(/-(?=\s|\d)/g, ' minus ')

  // Clean LaTeX keywords and delimiters
  for (let iter = 0; iter < 4; iter++) {
    s = s.replace(/\\text\{([^{}]*)\}/g, ' $1 ')
    s = s.replace(/\\boxed\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, ' $1 ')
    s = s.replace(/\bboxed\b/gi, '')
    s = s.replace(/\{([^{}]+)\}/g, ' $1 ')
  }
  s = s.replace(/[\$\\]/g, ' ')
  s = s.replace(/[\[\]\(\)]/g, ' ')

  // Clean markdown symbols
  s = s.replace(/[#*_`>|~]/g, '')
  s = s.replace(/\s+/g, ' ')
  return s.trim()
}

/**
 * Transforms raw pedagogical markdown into an engaging, warmly paced spoken script.
 * Adds teacher pauses, expands headings/steps, modulates formula delivery,
 * and eliminates monotonous continuous speech so students stay engaged.
 */
export function formatPedagogicalSpeech(text: string): string {
  if (!text) return ''
  let s = text

  // 1. Strip raw code fences, diagrams, HTML tags, and markdown links
  s = s.replace(/```[\s\S]*?```/g, '')
  s = s.replace(/<[^>]+>/g, '')
  s = s.replace(/!\[([^\]]*?)\]\([^)]+?\)/g, '$1')
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

  // 2. Format Headings with a clear spoken introduction and breath pause
  s = s.replace(/^#{1,6}\s*([^\n]+)/gm, (_, title) => `${title.trim()}... \n\n`)

  // 3. Format Pedagogical Sections: Steps, Problems, Results
  s = s.replace(/\b(Step\s*\d+)\s*:/gi, '$1... ')
  s = s.replace(/\b(Problem)\s*:/gi, 'Here is the problem... ')
  s = s.replace(/\b(Final Result|Answer)\s*:/gi, 'Here is the final result... ')
  s = s.replace(/\b(Core idea in plain language)\s*:/gi, 'Core idea in plain language... ')
  s = s.replace(/\b(What we’ll learn|What we will learn)\s*:/gi, 'What we will learn today: ')
  s = s.replace(/\b(Formula & Strategy|Formula and Strategy)\s*:/gi, 'Formula and strategy: ')
  s = s.replace(/\b(Step‑by‑step calculation|Step-by-step calculation)\s*:/gi, 'Step-by-step calculation: ')
  s = s.replace(/\b(Understanding[‑\s]check question)\s*:/gi, 'Check your understanding question: ')

  // 4. Clean list items: ensure bullets end with punctuation and a breath pause
  s = s.replace(/^[-*•]\s+([^\n]+)/gm, (_, item) => {
    const trimmed = item.trim()
    const endsWithPunct = /[.?!…:]$/.test(trimmed)
    return `${trimmed}${endsWithPunct ? '' : '.'} \n`
  })

  // 5. Clean numbered items: "1. Compute ..." -> "Point 1: Compute ..."
  s = s.replace(/^(\d+)\.\s+([^\n]+)/gm, (_, num, item) => {
    const trimmed = item.trim()
    const endsWithPunct = /[.?!…:]$/.test(trimmed)
    return `Point ${num}: ${trimmed}${endsWithPunct ? '' : '.'} \n`
  })

  // 6. Conversational transitions for mathematical arrows & connectors
  s = s.replace(/\s*→\s*|\s*-->\s*/g, ', which leads to ')
  s = s.replace(/\s*←\s*|\s*<--\s*/g, ', comes from ')
  s = s.replace(/\s*⇒\s*|\s*=>\s*/g, ', which means that ')

  // Plain text fractions like F/m or 1/2
  s = s.replace(/(?<=[a-zA-Z0-9])\/(?=[a-zA-Z0-9])/g, ' over ')
  // Standalone meter unit after numbers: 4.3 m -> 4.3 meters
  s = s.replace(/(?<=\d(?:\.\d+)?)\s*m\b/g, ' meters')

  // 7. Spoken units and math formulas
  s = latexToSpeech(s)

  // 8. Clean punctuation, collapse excessive whitespace while preserving breath pauses
  s = s.replace(/([?!])\s*([?!])+/g, '$1')
  s = s.replace(/[ \t]{2,}/g, ' ')
  // Paragraph breaks into gentle pauses
  s = s.replace(/\n{2,}/g, ' — ')
  s = s.replace(/\n+/g, ' ')
  s = s.replace(/\s{2,}/g, ' ')

  return s.trim()
}

export interface ExtractedConcept {
  title: string
  coreConcept: string
  keyBullets: string[]
  fullCleanText: string
  workedExample?: string
  targetForEvaluation: string
}

/**
 * Parses Tark's pedagogical response and extracts the core conceptual answer
 * that a student can recite, cleanly separating out any complex worked numerical
 * examples or practice problem steps that would overwhelm the student.
 */
export function extractRecitationConcept(raw: string): ExtractedConcept {
  // 1. Strip diagram code and mermaid blocks
  let clean = raw.replace(/```[\s\S]*?```/g, '')

  // 2. Extract Title if present (e.g. # Newton's First Law or **What we'll learn:**)
  let title = ''
  const titleMatch = clean.match(/^(?:#+\s*|\*\*)([^\n*]+)(?:\*\*|:)/m)
  if (titleMatch) {
    title = titleMatch[1].trim()
  }

  // 3. Detect sections: Core idea vs Worked example vs Understanding check
  const workedExampleIndex = clean.search(/(?:One worked example|Worked example|Problem:|Step 1:|Step-by-step calculation)/i)
  const questionIndex = clean.search(/(?:Understanding[‑\s]check question|Check your understanding|Practice question)/i)

  let coreSection = clean
  let workedExampleSection = ''

  if (workedExampleIndex !== -1) {
    coreSection = clean.slice(0, workedExampleIndex).trim()
    const endWorked = questionIndex !== -1 && questionIndex > workedExampleIndex ? questionIndex : clean.length
    workedExampleSection = clean.slice(workedExampleIndex, endWorked).trim()
  } else if (questionIndex !== -1) {
    coreSection = clean.slice(0, questionIndex).trim()
  }

  // If the core section is too short (e.g. only 1 line), fall back to whole clean text before question
  if (coreSection.length < 80) {
    coreSection = questionIndex !== -1 ? clean.slice(0, questionIndex).trim() : clean
  }

  // 4. Translate LaTeX to clean human readable in both sections
  const coreReadable = latexToHumanReadable(coreSection)
    .replace(/[#*_`>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const fullClean = latexToHumanReadable(clean)
    .replace(/[#*_`>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const workedReadable = workedExampleSection ? latexToHumanReadable(workedExampleSection).replace(/[#*_`>]/g, '').trim() : undefined

  // 5. Extract 2-4 clean key bullet points from core concept
  const isPreambleFeedback = (s: string) =>
    /^(?:great job|spot on|well done|correct|almost there|good attempt|good try|nice try|excellent|right on|that's right|you got it|close!|exactly|awesome|partially correct|nice effort|you correctly|your answer|feedback on your)/i.test(
      s
    )

  const sentences = coreReadable
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20 && !s.toLowerCase().startsWith('step'))

  const filteredSentences = sentences.filter((s) => !isPreambleFeedback(s))
  const keyBullets = (filteredSentences.length > 0 ? filteredSentences : sentences).slice(0, 4)
  const coreConcept = (filteredSentences.length > 0 ? filteredSentences : sentences).slice(0, 3).join(' ') || coreReadable.slice(0, 280)

  return {
    title: title || 'Core Concept Recitation',
    coreConcept,
    keyBullets,
    fullCleanText: fullClean,
    workedExample: workedReadable,
    targetForEvaluation: coreReadable || fullClean,
  }
}

/**
 * Picks the sweetest, most natural tutor voice available in the browser.
 */
export function getSweetestBrowserVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices || voices.length === 0) return null

  // Priority ranking for natural, sweet tutor voices:
  // 1. Natural / Online voices (Edge/Chrome Natural voices like Jenny, Sonia, Neerja, Aria)
  // 2. Google US English / UK English Female
  // 3. Any English female / warm voice
  const priorityPatterns = [
    /Jenny.*Natural/i,
    /Sonia.*Natural/i,
    /Neerja.*Natural/i,
    /Aria.*Natural/i,
    /Natural.*English/i,
    /Google.*US.*English/i,
    /Google.*UK.*Female/i,
    /Zira/i,
    /Female/i,
  ]

  for (const pat of priorityPatterns) {
    const found = voices.find((v) => pat.test(v.name))
    if (found) return found
  }

  // Fallback to any en-US or en-IN or en voice
  return voices.find((v) => v.lang.startsWith('en')) || voices[0] || null
}

/**
 * Splits text into individual sentences and pedagogical phrases
 * so browser speech synthesis can take natural breaths between sentences.
 */
export function splitSpeechSentences(text: string): string[] {
  if (!text) return []
  return text
    .split(/(?<=[.?!…])\s+|\s+—\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}
