import { useState } from 'react';
import { FidelKeyboard } from './components/FidelKeyboard';
import { InstallGuide } from './components/InstallGuide';
import './styles/keyboard.css';

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
            <span className="text-preview-content">
              {committedText}
              {preEditText && (
                <span className="text-preedit">{preEditText}</span>
              )}
              <span className="cursor" />
            </span>
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
