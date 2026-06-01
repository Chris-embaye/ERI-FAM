import { useState, useRef } from 'react';
import type { PopupState } from '../types/keyboard.types';
import '../styles/keyboard.css';

interface Props {
  popup: PopupState;
  onSelect: (variant: string) => void;
  onDismiss: () => void;
}

export function VariantPopup({ popup, onSelect, onDismiss }: Props) {
  const [hoveredIdx, setHoveredIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (e: React.PointerEvent) => {
    const chips = containerRef.current?.children;
    if (!chips) return;

    for (let i = 0; i < chips.length; i++) {
      const rect = (chips[i] as HTMLElement).getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom) {
        if (i !== hoveredIdx) {
          setHoveredIdx(i);
          if ('vibrate' in navigator) navigator.vibrate(4);
        }
        break;
      }
    }
  };

  const CHIP_W = 48;
  const safeLeft = Math.max(
    8,
    Math.min(
      popup.anchorX - (popup.variants.length * CHIP_W) / 2,
      window.innerWidth - popup.variants.length * CHIP_W - 8
    )
  );

  return (
    <>
      <div className="popup-backdrop" onPointerDown={onDismiss} />

      <div
        ref={containerRef}
        className="variant-popup"
        style={{ left: safeLeft, top: popup.anchorY - 68 }}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoveredIdx(-1)}
      >
        {popup.variants.map((v, i) => (
          <button
            key={i}
            className={`variant-chip ${i === hoveredIdx ? 'variant-chip--hover' : ''}`}
            onPointerDown={(e) => { e.stopPropagation(); onSelect(v); }}
          >
            {v}
          </button>
        ))}
      </div>
    </>
  );
}
