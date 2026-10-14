import { useState, useMemo } from 'react'
import Prism from 'prismjs'

// Import core popular languages for high-fidelity syntax highlighting
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markup'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-yaml'

interface CodeBlockProps {
  code: string
  language?: string
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeLanguage(lang: string = ''): string {
  const l = lang.trim().toLowerCase()
  switch (l) {
    case 'py':
    case 'python3':
      return 'python'
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'ts':
    case 'tsx':
    case 'jsx':
      return 'typescript'
    case 'sh':
    case 'shell':
    case 'zsh':
    case 'terminal':
      return 'bash'
    case 'yml':
      return 'yaml'
    case 'html':
    case 'xml':
    case 'svg':
      return 'markup'
    case 'c++':
      return 'cpp'
    case 'golang':
      return 'go'
    case 'rs':
      return 'rust'
    default:
      return l || 'text'
  }
}

export function CodeBlock({ code, language = 'text' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const normalizedLang = useMemo(() => normalizeLanguage(language), [language])
  const displayLang = useMemo(() => {
    const raw = language?.trim()
    if (!raw || raw.toLowerCase() === 'text' || raw.toLowerCase() === 'plain') {
      return 'code'
    }
    return raw.toLowerCase()
  }, [language])

  const highlightedHtml = useMemo(() => {
    const trimmedCode = code.replace(/\r\n/g, '\n')
    const grammar = Prism.languages[normalizedLang]
    if (grammar) {
      try {
        return Prism.highlight(trimmedCode, grammar, normalizedLang)
      } catch (err) {
        console.warn('Prism highlighting fallback:', err)
      }
    }
    return escapeHtml(trimmedCode)
  }, [code, normalizedLang])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard', err)
    }
  }

  return (
    <div className="code-block-card">
      <div className="code-block-header">
        <div className="code-block-lang-wrap">
          <span className="code-lang-label">{displayLang}</span>
        </div>
        <button
          type="button"
          className={`code-copy-btn ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
          title={copied ? 'Copied to clipboard!' : 'Copy code'}
        >
          {copied ? (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="code-copy-icon"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied!</span>
            </>
          ) : (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="code-copy-icon"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-block-pre">
        <code
          className={`language-${normalizedLang}`}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </pre>
    </div>
  )
}
