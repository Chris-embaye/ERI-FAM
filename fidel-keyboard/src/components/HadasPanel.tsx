import { useState } from 'react';
import '../styles/keyboard.css';

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`;

interface Props {
  currentText: string;
  onInsert: (text: string) => void;
  onClose: () => void;
}

function isGeez(text: string): boolean {
  return /[ሀ-፿]/.test(text);
}

export function HadasPanel({ currentText, onInsert, onClose }: Props) {
  const [query, setQuery]   = useState(currentText.trim().slice(-120));
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const hasKey = !!import.meta.env.VITE_GEMINI_API_KEY;
  const directionLabel = isGeez(query) ? 'ትግርኛ → English' : 'English → ትግርኛ';

  async function translate() {
    if (!query.trim()) return;
    if (!hasKey) { setError('Add VITE_GEMINI_API_KEY to .env'); return; }
    setLoading(true);
    setError('');
    setResult('');
    try {
      const prompt = isGeez(query)
        ? `Translate this Tigrinya text to English. Reply with ONLY the translation:\n${query}`
        : `Translate this text to Tigrinya (Ge'ez script). Reply with ONLY the translation:\n${query}`;

      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
        }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      setResult(text.trim());
    } catch (e: any) {
      setError(e?.message ?? 'Translation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hadas-panel">
      <div className="hadas-panel-header">
        <span className="hadas-panel-logo">ሓ</span>
        <span className="hadas-panel-title">Hadas Translate</span>
        <span className="hadas-panel-dir">{directionLabel}</span>
        <button className="hadas-close" onPointerDown={onClose}>✕</button>
      </div>

      <div className="hadas-panel-body">
        <textarea
          className="hadas-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ክትተርጉም ዝደሊ ጽሑፍ ኣእቱ…"
          rows={2}
          autoFocus
        />

        <button
          className="hadas-translate-btn"
          onPointerDown={translate}
          disabled={loading || !query.trim()}
        >
          {loading ? <span className="hadas-spinner">⟳</span> : '⇄ Translate'}
        </button>

        {error && <div className="hadas-error">{error}</div>}

        {result && (
          <div className="hadas-result">
            <p className="hadas-result-text">{result}</p>
            <div className="hadas-result-actions">
              <button
                className="hadas-copy-btn"
                onPointerDown={() => navigator.clipboard?.writeText(result)}
              >📋 Copy</button>
              <button
                className="hadas-insert-btn"
                onPointerDown={() => { onInsert(result); onClose(); }}
              >↓ Insert</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
