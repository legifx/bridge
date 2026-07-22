"use client";

import { useState } from "react";
import type { Answer, Interaction } from "@/lib/onboarding/types";

/**
 * One renderer per interview interaction kind. Each card collects exactly one
 * Answer and hands it up via onAnswer — this-or-that fires on tap, the other
 * kinds confirm with a button so multi-select feels deliberate.
 */
export function StepCard({ step, onAnswer }: { step: Interaction; onAnswer: (a: Answer) => void }) {
  switch (step.kind) {
    case "thisorthat":
      return <ThisOrThat key={step.id} step={step} onAnswer={onAnswer} />;
    case "slider":
      return <SliderStep key={step.id} step={step} onAnswer={onAnswer} />;
    case "suboptions":
      return <SubOptions key={step.id} step={step} onAnswer={onAnswer} />;
    case "wordmagnet":
      return <WordMagnet key={step.id} step={step} onAnswer={onAnswer} />;
  }
}

function Prompt({ domain, prompt }: { domain: string; prompt: string }) {
  return (
    <header className="mb-5">
      <p className="eyebrow">{domain}</p>
      <h2 className="mt-1.5 text-xl font-semibold tracking-tight text-text">{prompt}</h2>
    </header>
  );
}

function ThisOrThat({
  step,
  onAnswer,
}: {
  step: Extract<Interaction, { kind: "thisorthat" }>;
  onAnswer: (a: Answer) => void;
}) {
  return (
    <div className="page-enter">
      <Prompt domain={step.domain} prompt={step.prompt} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[step.left, step.right].map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => onAnswer({ kind: "thisorthat", id: step.id, value: label })}
            className="opt ring-focus min-h-[86px] text-base"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderStep({
  step,
  onAnswer,
}: {
  step: Extract<Interaction, { kind: "slider" }>;
  onAnswer: (a: Answer) => void;
}) {
  const [value, setValue] = useState(50);
  return (
    <div className="page-enter">
      <Prompt domain={step.domain} prompt={step.prompt} />
      <div className="card p-6">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="ring-focus w-full"
          style={{ accentColor: "var(--interest)" }}
          aria-label={step.prompt}
        />
        <div className="mt-2.5 flex justify-between text-xs text-faint">
          <span>{step.leftLabel}</span>
          <span>{step.rightLabel}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAnswer({ kind: "slider", id: step.id, value: value / 100 })}
        className="btn btn-primary mt-4 w-full"
      >
        That&rsquo;s about right →
      </button>
    </div>
  );
}

function SubOptions({
  step,
  onAnswer,
}: {
  step: Extract<Interaction, { kind: "suboptions" }>;
  onAnswer: (a: Answer) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (v: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  return (
    <div className="page-enter">
      <Prompt domain={step.domain} prompt={step.prompt} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`opt ring-focus ${picked.has(o) ? "opt-active" : ""}`}
          >
            {o}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onAnswer({ kind: "suboptions", id: step.id, values: [...picked] })}
        className="btn btn-primary mt-4 w-full"
      >
        {picked.size === 0 ? "None of these — continue" : "Continue →"}
      </button>
    </div>
  );
}

function WordMagnet({
  step,
  onAnswer,
}: {
  step: Extract<Interaction, { kind: "wordmagnet" }>;
  onAnswer: (a: Answer) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const toggle = (t: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  return (
    <div className="page-enter">
      <Prompt domain={step.domain} prompt={step.prompt} />
      <div className="card flex flex-wrap gap-2.5 p-5">
        {step.words.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => toggle(w)}
            className={`chip pop ring-focus ${picked.has(w) ? "chip-interest" : ""}`}
          >
            {w}
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-faint">
        No score, no grade — unknown words are just as useful a signal as known ones.
      </p>
      <button
        type="button"
        onClick={() => onAnswer({ kind: "wordmagnet", id: step.id, picked: [...picked] })}
        className="btn btn-primary mt-4 w-full"
      >
        {picked.size === 0 ? "None of these — continue" : `Lock in ${picked.size} →`}
      </button>
    </div>
  );
}
