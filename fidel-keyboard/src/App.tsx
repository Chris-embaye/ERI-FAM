import { useState, useMemo } from 'react';
import { FidelKeyboard } from './components/FidelKeyboard';
import { InstallGuide } from './components/InstallGuide';
import { ContextualSuggestions } from './ai/ContextualSuggestions';
import './styles/keyboard.css';

const spellChecker = new ContextualSuggestions();

/** Renders text with unknown Ge'ez words underlined in red */
function TextPreview({ committed, preEdit }: { committed: string; preEdit: string }) {
  const unknown = useMemo(
    () => spellChecker.getUnknownWords(committed),
    [committed]
  );

  const parts = committed.split(/(\s+)/);

  return (
    <span className="text-preview-content">
      {parts.map((part, i) =>
        unknown.has(part)
          ? <span key={i} className="text-spell-error" title="ዘይፍለጥ ቃል">{part}</span>
          : <span key={i}>{part}</span>
      )}
      {preEdit && <span className="text-preedit">{preEdit}</span>}
      <span className="cursor" />
    </span>
  );
}

export default function App() {
  const [committedText, setCommittedText] = useState('');
  const [preEditText, setPreEditText]     = useState('');
  const [showInstall, setShowInstall]     = useState(false);

  const hasContent = committedText || preEditText;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-geez">ፊደል</span>
          <span className="app-logo-latin">Fidel</span>
        </div>
        <button className="install-btn" onPointerDown={() => setShowInstall(true)}>
          📱 ምትካል
        </button>
      </header>

      <main className="app-body">
        <div className="text-preview">
          {!hasContent ? (
            <span className="text-preview-placeholder">ክትጽሕፍ ጀምር…</span>
          ) : (
            <TextPreview committed={committedText} preEdit={preEditText} />
          )}
        </div>

        {hasContent && (
          <div className="text-actions">
            <button
              className="clear-btn"
              onClick={() => { setCommittedText(''); setPreEditText(''); }}
            >
              Clear
            </button>
          </div>
        )}
      </main>

      <footer className="app-keyboard-wrapper">
        <FidelKeyboard
          text={committedText}
          onTextChange={setCommittedText}
          onPreEditChange={setPreEditText}
        />
      </footer>

      {showInstall && <InstallGuide onClose={() => setShowInstall(false)} />}
    </div>
  );
}
