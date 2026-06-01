import type { LayoutMode } from '../types/keyboard.types';
import type { VoiceRecognitionHook } from '../engine/useVoiceRecognition';
import '../styles/keyboard.css';

interface Props {
  voice: VoiceRecognitionHook;
  clipboardCount: number;
  layoutMode: LayoutMode;
  phoneticMode: boolean;
  onTogglePhonetic: () => void;
  onToggleClipboard: () => void;
  onOpenNumbers: () => void;
  onOpenHadas: () => void;
  hadasActive: boolean;
}

export function UtilityRibbon({
  voice, clipboardCount, layoutMode, phoneticMode,
  onTogglePhonetic, onToggleClipboard, onOpenNumbers,
  onOpenHadas, hadasActive,
}: Props) {
  return (
    <div className="utility-ribbon">
      {/* Voice */}
      <button
        className={`util-btn ${voice.isRecording ? 'util-btn--recording' : ''}`}
        onPointerDown={voice.isSupported ? voice.start : undefined}
        onPointerUp={voice.isRecording ? voice.stop : undefined}
        disabled={!voice.isSupported}
        title={voice.isSupported ? 'Hold to speak (Tigrinya)' : 'Voice not supported in this browser'}
      >
        <span className="util-icon">{voice.isRecording ? '🔴' : '🎙️'}</span>
        <span className="util-label">{voice.isRecording ? 'ምዝራብ…' : 'ድምጺ'}</span>
      </button>

      {/* Clipboard */}
      <button
        className={`util-btn ${clipboardCount > 0 ? 'util-btn--has-items' : ''}`}
        onPointerDown={onToggleClipboard}
      >
        <span className="util-icon">📋</span>
        <span className="util-label">ክሊፕቦርድ{clipboardCount > 0 ? ` (${clipboardCount})` : ''}</span>
      </button>

      {/* Ge'ez numbers */}
      <button
        className={`util-btn ${layoutMode === 'numbers' ? 'util-btn--active' : ''}`}
        onPointerDown={onOpenNumbers}
      >
        <span className="util-icon">፩</span>
        <span className="util-label">ቁጽሪ</span>
      </button>

      {/* Hadas AI translate */}
      <button
        className={`util-btn util-btn--hadas ${hadasActive ? 'util-btn--active' : ''}`}
        onPointerDown={onOpenHadas}
        title="Translate with Hadas AI"
      >
        <span className="util-icon">ሓ</span>
        <span className="util-label">Translate</span>
      </button>

      {/* Phonetic mode toggle — only visible in English layout */}
      {layoutMode === 'english' && (
        <button
          className={`util-btn util-btn--phonetic ${phoneticMode ? 'util-btn--active' : ''}`}
          onPointerDown={onTogglePhonetic}
          title={phoneticMode ? 'Phonetic engine ON — tap to type English only' : 'Phonetic engine OFF — tap to convert to Ge\'ez'}
        >
          <span className="util-icon util-icon--phonetic">
            {phoneticMode ? 'ፊ' : 'AB'}
          </span>
          <span className="util-label">{phoneticMode ? 'ፊደሊ ON' : 'ፊደሊ OFF'}</span>
        </button>
      )}

      {/* Interim voice text preview */}
      {voice.interimText && (
        <div className="voice-interim">{voice.interimText}</div>
      )}

      {/* Voice error feedback */}
      {voice.errorMessage && (
        <div className="voice-error">{voice.errorMessage}</div>
      )}
    </div>
  );
}
