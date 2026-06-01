import { useRef } from 'react';
import type { KeyboardKey } from '../types/keyboard.types';
import type { GeezKeyboardHandler } from '../engine/GeezKeyboardHandler';
import '../styles/keyboard.css';

interface Props {
  keyItem: KeyboardKey;
  handler: GeezKeyboardHandler;
  onActionOverride?: () => void;
  tigrinyaContext?: boolean;
  shiftActive?: boolean;
  isPredicted?: boolean;    // AI expanded touch target — next most likely key
}

const ACTION_FALLBACK: Record<string, string> = {
  toggle_shift:     '⇧',
  delete_char:      '⌫',
  switch_to_english: '🌐',
  switch_to_geez:   'ፊደል',
};

export function KeyButton({ keyItem, handler, onActionOverride, tigrinyaContext, shiftActive, isPredicted }: Props) {
  const isAction = keyItem.type === 'action';
  // Use !== undefined so that label: "" (blank spacebar) renders nothing intentionally
  const baseLabel = isAction
    ? (keyItem.label !== undefined ? keyItem.label : (ACTION_FALLBACK[keyItem.action ?? ''] ?? keyItem.key))
    : (keyItem.label !== undefined ? keyItem.label : keyItem.key);
  // Show uppercase when shift is active and the key is a single Latin letter
  const displayLabel = (shiftActive && /^[a-z]$/.test(baseLabel))
    ? baseLabel.toUpperCase()
    : baseLabel;

  const btnRef = useRef<HTMLButtonElement>(null);

  const getAnchor = () => {
    const el = btnRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top };
  };

  return (
    <button
      ref={btnRef}
      className={[
        'kbd-key',
        isAction                              ? 'kbd-key--action'       : '',
        keyItem.action === 'insert_space'     ? 'kbd-key--space'        : '',
        keyItem.action === 'insert_newline'   ? 'kbd-key--enter'        : '',
        keyItem.action === 'delete_char'      ? 'kbd-key--delete'       : '',
        keyItem.action === 'switch_to_english'? 'kbd-key--globe'        : '',
        keyItem.action === 'switch_to_geez'   ? 'kbd-key--globe'        : '',
        keyItem.type   === 'vowel'            ? 'kbd-key--vowel'        : '',
        keyItem.has_variants                  ? 'kbd-key--has-variants' : '',
        tigrinyaContext                       ? 'kbd-key--geez-punct'   : '',
        shiftActive && keyItem.action === 'toggle_shift' ? 'kbd-key--shift-on'   : '',
        isPredicted                                     ? 'kbd-key--predicted'   : '',
      ].join(' ').trim()}
      onPointerDown={(e) => {
        e.preventDefault();
        const { x, y } = getAnchor();
        handler.handleKeyPressStart(keyItem, x, y);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        if (onActionOverride && keyItem.type === 'action') {
          onActionOverride();
        } else {
          handler.handleKeyPressEnd(keyItem);
        }
      }}
      onPointerLeave={() => handler.handlePointerLeave()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {displayLabel}
      {keyItem.has_variants && <span className="variant-dot" />}
    </button>
  );
}
