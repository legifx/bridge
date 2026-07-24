"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "./LanguageProvider";

/**
 * Speak-your-answer: a small mic that transcribes speech into a text field via
 * the browser's SpeechRecognition API. Speaking often conveys meaning better
 * than typing, and the grader reads the transcript the same as typed text.
 * Renders nothing when the browser has no speech recognition.
 */

// BCP-47 hints for the recognizer, keyed by our short UI language codes.
const SPEECH_LOCALE: Record<string, string> = {
  en: "en-US", de: "de-DE", es: "es-ES", fr: "fr-FR", it: "it-IT",
  pt: "pt-PT", tr: "tr-TR", pl: "pl-PL", uk: "uk-UA", ar: "ar-SA",
};

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function MicButton({ onText, className = "" }: { onText: (text: string) => void; className?: string }) {
  const { lang, t } = useI18n();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
    return () => recRef.current?.stop();
  }, []);

  function toggle() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = SPEECH_LOCALE[lang] ?? "en-US";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      if (text.trim()) onText(text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={t("check.speak")}
      aria-label={t("check.speak")}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${className}`}
      style={{
        background: listening ? "rgba(255,59,172,0.18)" : "rgba(255,255,255,0.07)",
        boxShadow: listening
          ? "0 0 0 1px rgba(255,59,172,0.5), 0 0 16px rgba(255,59,172,0.4)"
          : "inset 0 1px 0 rgba(255,255,255,0.1)",
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden className={listening ? "animate-pulse" : ""}>
        <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
        <path d="M5 11a7 7 0 0014 0M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}
