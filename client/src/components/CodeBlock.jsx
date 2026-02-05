import { useState } from 'react';

/**
 * Code block with copy-to-clipboard functionality
 * @param {string} code - The code to display and copy
 * @param {string} language - Optional language label (e.g., "bash", "json")
 * @param {boolean} inline - If true, renders as inline code (no copy button)
 * @param {string} className - Additional classes
 */
export default function CodeBlock({ code, language, inline = false, className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (inline) {
    return (
      <code className={`bg-[var(--color-bg-canvas)] px-1.5 py-0.5 rounded text-sm font-mono text-[var(--color-text-secondary)] ${className}`}>
        {code}
      </code>
    );
  }

  return (
    <div className={`relative group ${className}`}>
      {language && (
        <div className="absolute top-0 left-0 px-2 py-1 text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wider">
          {language}
        </div>
      )}
      
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-[var(--color-bg-emphasis)] hover:bg-[var(--color-border-default)] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        title="Copy to clipboard"
      >
        {copied ? (
          <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      <pre className={`bg-[var(--color-bg-canvas)] rounded-lg p-4 ${language ? 'pt-8' : ''} overflow-x-auto`}>
        <code className="text-sm font-mono text-[var(--color-text-secondary)] whitespace-pre-wrap">
          {code}
        </code>
      </pre>
    </div>
  );
}

/**
 * Compact inline code with copy button (for endpoints)
 */
export function CopyableCode({ code, className = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-2 bg-[var(--color-bg-canvas)] hover:bg-[var(--color-bg-emphasis)] px-3 py-1.5 rounded text-xs font-mono text-[var(--color-text-muted)] transition-colors group ${className}`}
      title="Click to copy"
    >
      <span>{code}</span>
      {copied ? (
        <svg className="w-3.5 h-3.5 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
