import { useState } from 'react';
import { todayEthiopian } from '../data/ethiopian_calendar';
import '../styles/keyboard.css';

interface Props {
  onCommit: (char: string) => void;
  onDelete: () => void;
  onInsertSpace: () => void;
  onBack: () => void;  // returns to main keyboard
}

const ARABIC_ROWS = [
  ['1','2','3','+'],
  ['4','5','6','-'],
  ['7','8','9','×'],
  ['.','0','=','÷'],
];

export function NumberPad({ onCommit, onDelete, onInsertSpace, onBack }: Props) {
  const [geezMode, setGeezMode] = useState(false);

  const handleKey = (k: string) => {
    if (geezMode) {
      const mapped = toGeez(k);
      onCommit(mapped);
    } else {
      onCommit(k);
    }
  };

  const todayStr = todayEthiopian();

  return (
    <div className="number-pad">
      {/* Mode toggle + calendar chip */}
      <div className="numpad-header">
        <div className="numpad-toggle">
          <button
            className={`toggle-btn ${!geezMode ? 'toggle-btn--active' : ''}`}
            onPointerDown={() => setGeezMode(false)}
          >123</button>
          <button
            className={`toggle-btn ${geezMode ? 'toggle-btn--active' : ''}`}
            onPointerDown={() => setGeezMode(true)}
          >፩፪፫</button>
        </div>
        <button
          className="calendar-chip"
          onPointerDown={() => onCommit(todayStr)}
          title="Paste today's Ethiopian date"
        >
          📅 {todayStr}
        </button>
      </div>

      {/* Key grid */}
      <div className="numpad-grid">
        {ARABIC_ROWS.map((row, ri) => (
          <div key={ri} className="numpad-row">
            {row.map((k) => (
              <button
                key={k}
                className="numpad-key"
                onPointerDown={() => handleKey(k)}
              >
                {geezMode ? toGeezDisplay(k) : k}
              </button>
            ))}
          </div>
        ))}
        {/* Bottom utility row */}
        <div className="numpad-row">
          <button className="numpad-key numpad-key--back"  onPointerDown={onBack}>ፊደል</button>
          <button className="numpad-key numpad-key--space" onPointerDown={onInsertSpace}>ባዶ</button>
          <button className="numpad-key numpad-key--del"   onPointerDown={onDelete}>⌫</button>
          <button className="numpad-key numpad-key--enter" onPointerDown={() => onCommit('\n')}>↵</button>
        </div>
      </div>
    </div>
  );
}

const ARABIC_TO_GEEZ: Record<string, string> = {
  '1': '፩', '2': '፪', '3': '፫', '4': '፬', '5': '፭',
  '6': '፮', '7': '፯', '8': '፰', '9': '፱',
  // 0 has no Ge'ez equivalent — keep as Arabic so "10" → "፩0" not "፩፲"
  '+': '፣', '-': '።', '×': '×', '÷': '÷', '.': '፡', '=': '=',
};

function toGeez(k: string): string {
  return ARABIC_TO_GEEZ[k] ?? k;
}

function toGeezDisplay(k: string): string {
  return ARABIC_TO_GEEZ[k] ?? k;
}

