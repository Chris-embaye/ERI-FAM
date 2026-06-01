/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useRef } from 'react';

function getSpeechRec(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Language preference order: Tigrinya first, Amharic fallback (shares Ge'ez script)
const LANG_PREFERENCE = ['ti', 'am-ET'];

export interface VoiceRecognitionHook {
  isRecording: boolean;
  isSupported: boolean;
  interimText: string;
  errorMessage: string | null;
  start: () => void;
  stop:  () => void;
}

export function useVoiceRecognition(
  onFinalResult: (transcript: string) => void
): VoiceRecognitionHook {
  const SpeechRec = getSpeechRec();
  const isSupported = SpeechRec !== null;

  const [isRecording, setIsRecording]   = useState(false);
  const [interimText, setInterimText]   = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const recRef      = useRef<any>(null);
  const langIdxRef  = useRef(0);  // tracks which language we're currently trying

  const startWithLang = useCallback((lang: string) => {
    if (!SpeechRec) return;
    const rec = new SpeechRec();
    rec.lang            = lang;
    rec.continuous      = false;
    rec.interimResults  = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => { setIsRecording(true); setErrorMessage(null); };
    rec.onend   = () => { setIsRecording(false); setInterimText(''); };

    rec.onerror = (event: any) => {
      setIsRecording(false);
      setInterimText('');

      if (event.error === 'language-not-supported') {
        // Try next language in preference list
        const nextIdx = langIdxRef.current + 1;
        if (nextIdx < LANG_PREFERENCE.length) {
          langIdxRef.current = nextIdx;
          startWithLang(LANG_PREFERENCE[nextIdx]);
          return;
        }
        setErrorMessage('Voice input not supported on this device');
      } else if (event.error === 'not-allowed') {
        setErrorMessage('Microphone permission denied');
      } else if (event.error !== 'aborted') {
        setErrorMessage('Voice input error — try again');
      }
    };

    rec.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) onFinalResult(event.results[i][0].transcript);
        else interim += event.results[i][0].transcript;
      }
      setInterimText(interim);
    };

    rec.start();
    recRef.current = rec;
    setIsRecording(true);
  }, [SpeechRec, onFinalResult]);

  const start = useCallback(() => {
    langIdxRef.current = 0;
    startWithLang(LANG_PREFERENCE[0]);
  }, [startWithLang]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
  }, []);

  return { isRecording, isSupported, interimText, errorMessage, start, stop };
}
