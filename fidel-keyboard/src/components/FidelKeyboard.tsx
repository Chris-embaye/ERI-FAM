import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type { PopupState, Suggestion, KeyboardLayout, KeyboardKey, LayoutMode } from '../types/keyboard.types';
import { GeezKeyboardHandler } from '../engine/GeezKeyboardHandler';
import { PhoneticMutator } from '../engine/PhoneticMutator';
import { ContextualSuggestions } from '../ai/ContextualSuggestions';
import { applyCompound } from '../engine/CompoundWordFixer';
import { convertPhoneticToGeez, hasGeezChars } from '../engine/PhoneticParser';
import { predictNextLatinKey } from '../engine/PredictedKey';
import { useVoiceRecognition } from '../engine/useVoiceRecognition';
import { SuggestionBar } from './SuggestionBar';
import { KeyButton } from './KeyButton';
import { VariantPopup } from './VariantPopup';
import { UtilityRibbon } from './UtilityRibbon';
import { ClipboardPanel } from './ClipboardPanel';
import { NumberPad } from './NumberPad';
import { HadasPanel } from './HadasPanel';
import { getCharFamily } from '../engine/characterFamily';
import geezLayout    from '../data/tigrinya_keyboard_layout.json';
import englishLayout from '../data/english_keyboard_layout.json';
import '../styles/keyboard.css';

const LAYOUTS: Record<string, KeyboardLayout> = {
  geez:    geezLayout    as KeyboardLayout,
  english: englishLayout as KeyboardLayout,
};

const CLIPBOARD_KEY = 'fidel-clipboard-history';
function loadClipboard(): string[] {
  try { return JSON.parse(localStorage.getItem(CLIPBOARD_KEY) ?? '[]'); } catch { return []; }
}
function saveClipboard(items: string[]) {
  localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(items.slice(0, 10)));
}

const aiEngine = new ContextualSuggestions();

interface Props {
  text: string;                                        // committed (finalized) text from App
  onTextChange: React.Dispatch<React.SetStateAction<string>>;
  onPreEditChange: (preEdit: string) => void;          // sends underlined in-progress portion up to App
}

export function FidelKeyboard({ text, onTextChange, onPreEditChange }: Props) {
  const [layoutMode, setLayoutMode]       = useState<LayoutMode>('geez');
  const [phoneticMode, setPhoneticMode]   = useState(true);
  const [shiftActive, setShiftActive]     = useState(false);
  const [rawBuffer, setRawBuffer]         = useState('');   // Latin chars being composed (English mode)
  const [popup, setPopup]                 = useState<PopupState | null>(null);
  const [suggestions, setSuggestions]     = useState<Suggestion[]>([]);
  const [showClipboard, setShowClipboard] = useState(false);
  const [clipboard, setClipboard]         = useState<string[]>(loadClipboard);
  const [showHadas, setShowHadas]          = useState(false);

  const activeLayout = LAYOUTS[layoutMode] ?? LAYOUTS.geez;

  const mutator = useMemo(
    () => new PhoneticMutator(activeLayout.geez_matrix),
    [activeLayout.geez_matrix]
  );

  // ── Stable refs for use inside callbacks ─────────────────────────────────
  const layoutModeRef   = useRef(layoutMode);
  const phoneticRef     = useRef(phoneticMode);
  const shiftRef        = useRef(shiftActive);
  const rawBufferRef    = useRef(rawBuffer);
  const committedRef    = useRef(text);           // mirrors the `text` prop
  const centerChipRef   = useRef('');             // tracks current centre suggestion for auto-accept

  useEffect(() => { layoutModeRef.current  = layoutMode; });
  useEffect(() => { phoneticRef.current    = phoneticMode; });
  useEffect(() => { shiftRef.current       = shiftActive; });
  useEffect(() => { rawBufferRef.current   = rawBuffer; });
  useEffect(() => { committedRef.current   = text; });
  useEffect(() => {
    centerChipRef.current = suggestions[1]?.text ?? suggestions[0]?.text ?? '';
  }, [suggestions]);

  // ── Helper: recompute suggestions ────────────────────────────────────────
  const refreshSuggestions = useCallback((committed: string, raw: string, mode: LayoutMode, phon: boolean) => {
    const context = mode === 'english' ? committed + raw : committed;
    setSuggestions(aiEngine.getSuggestions(context, mode === 'numbers', mode, phon));
  }, []);

  // ── Flush the raw buffer into committed text ──────────────────────────────
  const flushBuffer = useCallback((word: string) => {
    onTextChange(prev => {
      const next = prev + (word ? word + ' ' : '');
      // Refresh suggestions immediately with the new committed text
      refreshSuggestions(next, '', layoutModeRef.current, phoneticRef.current);
      return next;
    });
    setRawBuffer('');
    onPreEditChange('');
  }, [onTextChange, onPreEditChange, refreshSuggestions]);

  // ── Text operations ───────────────────────────────────────────────────────

  // Character committed: English+phonetic → rawBuffer; Ge'ez → directly to text
  const commitText = useCallback((char: string) => {
    const mode = layoutModeRef.current;
    const phon = phoneticRef.current;
    const shifted = shiftRef.current ? char.toUpperCase() : char;
    if (shiftRef.current) setShiftActive(false);

    if (mode === 'english' && phon) {
      // Pre-edit: append to raw buffer, show phonetic conversion underlined
      setRawBuffer(prev => {
        const next = prev + shifted;
        const preEdit = convertPhoneticToGeez(next);
        onPreEditChange(preEdit);
        refreshSuggestions(committedRef.current, next, 'english', true);
        return next;
      });
    } else {
      // Ge'ez mode or phonetic OFF: commit directly, update suggestions
      onTextChange(prev => {
        const committed = mode === 'geez'
          ? (mutator.tryMutate(prev, shifted) ?? prev + shifted)
          : prev + shifted;
        refreshSuggestions(committed, '', mode, phon);
        return committed;
      });
    }
    setPopup(null);
  }, [mutator, onTextChange, onPreEditChange, refreshSuggestions]);

  // Backspace: delete from rawBuffer first; then from committed text
  const onDeleteChar = useCallback(() => {
    const mode = layoutModeRef.current;
    const phon = phoneticRef.current;

    if (mode === 'english' && phon && rawBufferRef.current.length > 0) {
      setRawBuffer(prev => {
        const next = [...prev].slice(0, -1).join('');
        const preEdit = convertPhoneticToGeez(next);
        onPreEditChange(preEdit);
        refreshSuggestions(committedRef.current, next, 'english', true);
        return next;
      });
    } else {
      onTextChange(prev => {
        const next = [...prev].slice(0, -1).join('');
        refreshSuggestions(next, '', mode, phon);
        return next;
      });
    }
  }, [onTextChange, onPreEditChange, refreshSuggestions]);

  // Spacebar: iOS auto-accept — commits the CENTER chip when composing
  const onInsertSpace = useCallback(() => {
    const mode = layoutModeRef.current;
    const phon = phoneticRef.current;
    const raw  = rawBufferRef.current;

    if (mode === 'english' && phon && raw.length > 0) {
      // Auto-accept: center chip is the AI's best prediction
      const center = centerChipRef.current || convertPhoneticToGeez(raw);
      // Guard: only flush if we have actual text — prevents trailing spaces from empty conversions
      if (center) {
        flushBuffer(center);
        refreshSuggestions(committedRef.current + center + ' ', '', 'english', phon);
      } else {
        setRawBuffer('');
        onPreEditChange('');
        onTextChange(prev => prev + ' ');
      }
    } else {
      onTextChange(prev => {
        const next = prev + ' ';
        refreshSuggestions(next, '', mode, phon);
        return next;
      });
    }
  }, [flushBuffer, onTextChange, refreshSuggestions]);

  const onInsertNewline = useCallback(() => {
    onTextChange(prev => prev + '\n');
  }, [onTextChange]);

  const switchLayout = useCallback((action?: string) => {
    if (rawBufferRef.current) {
      // Flush any pending phonetic buffer before switching layout
      const phonetic = convertPhoneticToGeez(rawBufferRef.current);
      if (hasGeezChars(phonetic)) flushBuffer(phonetic);
      else { setRawBuffer(''); onPreEditChange(''); }
    }
    if (action === 'switch_to_english') setLayoutMode('english');
    if (action === 'switch_to_geez')    setLayoutMode('geez');
  }, [flushBuffer, onPreEditChange]);

  // ── Stable callback ref (handler created once per matrix) ────────────────
  const cbRef = useRef({ commitText, onDeleteChar, onInsertSpace, onInsertNewline, switchLayout });
  useEffect(() => { cbRef.current = { commitText, onDeleteChar, onInsertSpace, onInsertNewline, switchLayout }; });

  const handler = useMemo(() => new GeezKeyboardHandler(activeLayout.geez_matrix, {
    onShowPopup:     (v,k,x,y) => setPopup({ variants: v, baseKey: k, anchorX: x, anchorY: y }),
    onHidePopup:     ()  => setPopup(null),
    onCommitText:    (c) => cbRef.current.commitText(c),
    onDeleteChar:    ()  => cbRef.current.onDeleteChar(),
    onInsertSpace:   ()  => cbRef.current.onInsertSpace(),
    onInsertNewline: ()  => cbRef.current.onInsertNewline(),
  }), [activeLayout.geez_matrix]);

  // ── Voice ─────────────────────────────────────────────────────────────────
  const voice = useVoiceRecognition(useCallback((transcript) => {
    setRawBuffer('');
    onPreEditChange('');
    onTextChange(prev => {
      const next = prev + transcript + ' ';
      refreshSuggestions(next, '', layoutModeRef.current, phoneticRef.current);
      return next;
    });
  }, [onTextChange, onPreEditChange, refreshSuggestions]));

  // ── Suggestion chip selection ─────────────────────────────────────────────
  const handleSuggestionSelect = useCallback((s: Suggestion) => {
    if (s.type === 'compound') {
      onTextChange(prev => {
        const next = applyCompound(prev, {
          rule: { word1: '', word2: '', result: s.text, gloss: s.gloss ?? '' },
          replaceLastNWords: 2,
        });
        refreshSuggestions(next, '', layoutModeRef.current, phoneticRef.current);
        return next;
      });
      return;
    }
    // Tap on a chip = commit that chip text, clear pre-edit buffer, refresh suggestions
    flushBuffer(s.text.trimEnd());
  }, [flushBuffer, onTextChange, refreshSuggestions]);

  // ── Clipboard ─────────────────────────────────────────────────────────────
  const fullText = text + convertPhoneticToGeez(rawBuffer);
  const saveCurrent  = useCallback(() => {
    if (!fullText.trim()) return;
    const next = [fullText.trim(), ...clipboard.filter(c => c !== fullText.trim())].slice(0, 10);
    setClipboard(next); saveClipboard(next);
  }, [fullText, clipboard]);
  const pasteClipboard = useCallback((item: string) => {
    onTextChange(prev => prev + item);
    setShowClipboard(false);
  }, [onTextChange]);
  const clearClipboard = useCallback(() => { setClipboard([]); saveClipboard([]); }, []);

  // ── Dynamic touch target: predict next Latin key ──────────────────────────
  const predictedKey = useMemo(() => {
    if (layoutMode !== 'english' || !phoneticMode) return null;
    // Pass committed Ge'ez + current raw buffer so the glow advances as user types
    // e.g. raw='s' → glow moves from 's' to 'e' (next char needed for 'se'→'ሰ')
    const committedGeez = convertPhoneticToGeez(text);
    const center = suggestions[1]?.text ?? '';
    return predictNextLatinKey(committedGeez, rawBuffer, center);
  }, [rawBuffer, text, suggestions, layoutMode, phoneticMode]);

  // ── Smart punctuation swap ────────────────────────────────────────────────
  const tigrinyaContext = useMemo(() => {
    if (layoutMode !== 'english' || !phoneticMode) return false;
    return hasGeezChars(text.slice(-20));
  }, [text, layoutMode, phoneticMode]);

  // ── Compute display rows ──────────────────────────────────────────────────
  const displayRows = useMemo((): KeyboardKey[][] => {
    const base: KeyboardKey[][] = [
      activeLayout.primary_grid.row_1,
      activeLayout.primary_grid.row_2,
      activeLayout.primary_grid.row_3,
      activeLayout.primary_grid.row_4,
    ];
    if (!tigrinyaContext) return base;
    const row4 = base[3].map(k =>
      k.key === ',' ? { ...k, key: '፣', label: undefined }
      : k.key === '.' ? { ...k, key: '።', label: undefined }
      : k
    );
    return [...base.slice(0, 3), row4];
  }, [activeLayout, tigrinyaContext]);

  // ── Initial suggestions on mount ─────────────────────────────────────────
  const mountText    = useRef(text);
  const mountLayout  = useRef(layoutMode);
  const mountPhonetic = useRef(phoneticMode);
  useEffect(() => {
    setSuggestions(aiEngine.getSuggestions(mountText.current, false, mountLayout.current, mountPhonetic.current));
  }, []); // intentional empty deps — reads stable mount-time refs

  // ── Number pad ────────────────────────────────────────────────────────────
  if (layoutMode === 'numbers') {
    return (
      <div className="fidel-keyboard">
        <UtilityRibbon voice={voice} clipboardCount={clipboard.length} layoutMode={layoutMode}
          phoneticMode={phoneticMode} onTogglePhonetic={() => setPhoneticMode(v => !v)}
          onToggleClipboard={() => setShowClipboard(v => !v)} onOpenNumbers={() => setLayoutMode('geez')} />
        {showClipboard && (
          <ClipboardPanel items={clipboard} currentText={fullText}
            onPaste={pasteClipboard} onSaveCurrent={saveCurrent}
            onClear={clearClipboard} onClose={() => setShowClipboard(false)} />
        )}
        <NumberPad onCommit={(c) => onTextChange(p => p + c)}
          onDelete={onDeleteChar} onInsertSpace={() => onTextChange(p => p + ' ')}
          onBack={() => setLayoutMode('geez')} />
      </div>
    );
  }

  return (
    <div className="fidel-keyboard">
      <UtilityRibbon voice={voice} clipboardCount={clipboard.length} layoutMode={layoutMode}
        phoneticMode={phoneticMode} onTogglePhonetic={() => setPhoneticMode(v => !v)}
        onToggleClipboard={() => setShowClipboard(v => !v)} onOpenNumbers={() => setLayoutMode('numbers')}
        onOpenHadas={() => setShowHadas(v => !v)} hadasActive={showHadas} />

      {showHadas && (
        <HadasPanel
          currentText={text}
          onInsert={(t) => onTextChange(prev => prev + t)}
          onClose={() => setShowHadas(false)}
        />
      )}

      {showClipboard && (
        <ClipboardPanel items={clipboard} currentText={fullText}
          onPaste={pasteClipboard} onSaveCurrent={saveCurrent}
          onClear={clearClipboard} onClose={() => setShowClipboard(false)} />
      )}

      <SuggestionBar suggestions={suggestions} onSelect={handleSuggestionSelect} />

      <div className={`kbd-rows kbd-rows--${activeLayout.language_code}`}>
        {displayRows.map((row, ri) => (
          <div key={ri} className={`kbd-row kbd-row--${ri + 1}`}>
            {row.map((keyItem, ki) => (
              <KeyButton
                key={`${ri}-${ki}`}
                keyItem={keyItem}
                handler={handler}
                shiftActive={shiftActive && layoutMode === 'english'}
                isPredicted={predictedKey !== null && keyItem.key === predictedKey}
                tigrinyaContext={tigrinyaContext && (keyItem.key === '፣' || keyItem.key === '።')}
                showFamilyColors={layoutMode === 'geez'}
                onActionOverride={
                  keyItem.action === 'toggle_shift'
                    ? () => setShiftActive(v => !v)
                    : keyItem.action?.startsWith('switch_to')
                      ? () => switchLayout(keyItem.action)
                      : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>

      {popup && (
        <VariantPopup
          popup={popup}
          onSelect={(v) => handler.handleVariantSelect(v)}
          onDismiss={() => { handler.resetState(); setPopup(null); }}
        />
      )}
    </div>
  );
}
