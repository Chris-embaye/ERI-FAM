import type { GeezMatrix, KeyboardKey } from '../types/keyboard.types';

interface HandlerCallbacks {
  onShowPopup: (variants: string[], baseKey: string, anchorX: number, anchorY: number) => void;
  onHidePopup: () => void;
  onCommitText: (text: string) => void;
  onDeleteChar: () => void;
  onInsertSpace: () => void;
  onInsertNewline: () => void;
}

export class GeezKeyboardHandler {
  private matrix: GeezMatrix;
  private longPressTimeout: ReturnType<typeof setTimeout> | null = null;
  private longPressActive = false;
  private readonly LONG_PRESS_DURATION = 380;

  private callbacks: HandlerCallbacks;

  constructor(matrixData: GeezMatrix, callbacks: HandlerCallbacks) {
    this.matrix = matrixData;
    this.callbacks = callbacks;
  }

  updateCallbacks(callbacks: HandlerCallbacks): void {
    this.callbacks = callbacks;
  }

  public handleKeyPressStart(keyItem: KeyboardKey, anchorX: number, anchorY: number): void {
    this.clearLongPressTimer();
    this.longPressActive = false;

    if (keyItem.type === 'action') return;

    if (keyItem.has_variants && this.matrix[keyItem.key]) {
      this.longPressTimeout = setTimeout(() => {
        this.longPressActive = true;
        const variants = this.matrix[keyItem.key];
        this.callbacks.onShowPopup(variants, keyItem.key, anchorX, anchorY);
        if ('vibrate' in navigator) navigator.vibrate([8, 20, 8]);
      }, this.LONG_PRESS_DURATION);
    }
  }

  public handleKeyPressEnd(keyItem: KeyboardKey): void {
    this.clearLongPressTimer();

    if (this.longPressActive) return;

    if (keyItem.type === 'action') {
      this.executeAction(keyItem.action);
      return;
    }

    this.callbacks.onCommitText(keyItem.key);
    if ('vibrate' in navigator) navigator.vibrate(6);
  }

  public handlePointerLeave(): void {
    this.clearLongPressTimer();
    // Do NOT hide popup here — the popup may still be open for variant selection.
    // Only cancel if no long press has activated yet.
    if (!this.longPressActive) {
      this.callbacks.onHidePopup();
    }
  }

  public handleVariantSelect(variant: string): void {
    this.longPressActive = false;
    this.callbacks.onCommitText(variant);
    this.callbacks.onHidePopup();
    if ('vibrate' in navigator) navigator.vibrate(5);
  }

  public resetState(): void {
    this.clearLongPressTimer();
    this.longPressActive = false;
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimeout !== null) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
  }

  private executeAction(action?: string): void {
    switch (action) {
      case 'delete_char':    this.callbacks.onDeleteChar();    break;
      case 'insert_space':   this.callbacks.onInsertSpace();   break;
      case 'insert_newline': this.callbacks.onInsertNewline(); break;
      default: break;
    }
  }
}
