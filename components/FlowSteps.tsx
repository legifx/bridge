"use client";

import { useT } from "./LanguageProvider";

/**
 * Where am I in this aspect? Explanation → check → result.
 *
 * The flow spans two screens, and nothing on the first one said that a check
 * was coming — so the check button read as "leave" rather than "next step".
 * Deliberately small: orientation, not a progress bar demanding completion.
 */
export function FlowSteps({ current }: { current: 1 | 2 | 3 }) {
  const t = useT();
  const steps = [t("flow.explain"), t("flow.check"), t("flow.result")];
  return (
    <ol className="mb-5 flex items-center gap-2" aria-label={t("flow.label")}>
      {steps.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`slabel transition-colors ${
                active ? "text-interest-text" : done ? "text-faint" : "text-faint opacity-50"
              }`}
              aria-current={active ? "step" : undefined}
            >
              <span
                aria-hidden
                className="me-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{
                  background: active ? "var(--interest)" : done ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.15)",
                  boxShadow: active ? "0 0 8px var(--interest)" : undefined,
                }}
              />
              {label}
            </span>
            {i < steps.length - 1 && <span aria-hidden className="h-px w-4 bg-hair" />}
          </li>
        );
      })}
    </ol>
  );
}
