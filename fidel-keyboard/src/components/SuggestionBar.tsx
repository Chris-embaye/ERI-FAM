import type { Suggestion } from '../types/keyboard.types';
import '../styles/keyboard.css';

interface Props {
  suggestions: Suggestion[];
  onSelect: (suggestion: Suggestion) => void;
}

const TYPE_LABEL: Record<string, string> = {
  greeting:        'ሰላምታ',
  completion:      'ቃል',
  prediction:      'ቀጺሉ',
  phrase:          'ሓሳብ',
  homophone:       'ፊደሊ',
  compound:        'ቁርን',    // grammar compound
  transliteration: 'ትርጉም',   // cross-lingual conversion
  calendar:        'ዓዲ ዓዲ',  // Ethiopian calendar
};

export function SuggestionBar({ suggestions, onSelect }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="suggestion-bar">
      {suggestions.map((s, i) => (
        <button
          key={i}
          className={[
            'suggestion-chip',
            i === 1                   ? 'suggestion-chip--primary' : '',
            `suggestion-chip--${s.type}`,
          ].join(' ').trim()}
          onPointerDown={() => onSelect(s)}
        >
          <span className="suggestion-type-label">{TYPE_LABEL[s.type] ?? s.type}</span>
          <span className="suggestion-text">{s.text}</span>
          {s.gloss && <span className="suggestion-gloss">{s.gloss}</span>}
        </button>
      ))}
    </div>
  );
}
