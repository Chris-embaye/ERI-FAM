export type KeyType = 'consonant' | 'vowel' | 'action' | 'punctuation';

export interface KeyboardKey {
  key: string;
  has_variants: boolean;
  type: KeyType;
  action?: string;
  label?: string;
}

export interface PrimaryGrid {
  row_1: KeyboardKey[];
  row_2: KeyboardKey[];
  row_3: KeyboardKey[];
  row_4: KeyboardKey[];
}

export interface GeezMatrix {
  [baseChar: string]: string[];
}

export interface KeyboardLayout {
  layout_name: string;
  version: string;
  script: string;
  language_code: string;
  primary_grid: PrimaryGrid;
  geez_matrix: GeezMatrix;
}

export type SuggestionType =
  | 'greeting'
  | 'completion'
  | 'prediction'
  | 'phrase'
  | 'homophone'
  | 'compound'        // grammar compound-word correction
  | 'transliteration' // Latin → Ge'ez cross-lingual
  | 'calendar';       // Ethiopian calendar date

export interface Suggestion {
  text: string;
  type: SuggestionType;
  gloss?: string;     // optional English label shown under chip
}

export interface PopupState {
  variants: string[];
  baseKey: string;
  anchorX: number;
  anchorY: number;
}

export type LayoutMode = 'geez' | 'english' | 'numbers';
