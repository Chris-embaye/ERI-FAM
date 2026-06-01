import '../styles/keyboard.css';

interface Props {
  items: string[];
  currentText: string;
  onPaste: (text: string) => void;
  onSaveCurrent: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function ClipboardPanel({ items, currentText, onPaste, onSaveCurrent, onClear, onClose }: Props) {
  return (
    <div className="clipboard-panel">
      <div className="clipboard-header">
        <span className="clipboard-title">📋 ክሊፕቦርድ — 100% ዓሊ ኦፍላይን</span>
        <button className="clipboard-close" onPointerDown={onClose}>✕</button>
      </div>

      {currentText.trim() && (
        <button className="clipboard-save-btn" onPointerDown={onSaveCurrent}>
          + ናይ ሕጂ ጽሑፍ ምዕቃብ
        </button>
      )}

      {items.length === 0 ? (
        <p className="clipboard-empty">ዝዕቀብ ጽሑፍ የለን</p>
      ) : (
        <>
          <div className="clipboard-list">
            {items.map((item, i) => (
              <button key={i} className="clipboard-item" onPointerDown={() => onPaste(item)}>
                <span className="clipboard-item-text">{item}</span>
                <span className="clipboard-paste-hint">ለጥፍ ↑</span>
              </button>
            ))}
          </div>
          <button className="clipboard-clear-btn" onPointerDown={onClear}>
            ኩሎም ምደምሳስ
          </button>
        </>
      )}
    </div>
  );
}
