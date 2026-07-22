"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SignInForm() {
  const router = useRouter();
  const expired = useSearchParams().get("expired") === "1";
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(name?: string) {
    const value = (name ?? username).trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: value }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error ?? `Sign-in failed (server responded ${res.status}).`);
      }
      router.push(data.hasProfile ? "/" : "/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10 pt-14">
      <div className="flex-1">
        <p className="eyebrow">Bridge</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text">
          Learn new things through what you already know.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          Bridge builds an interest profile from a few taps, then re-explains any study material
          through your world — and fact-checks every analogy before you see it.
        </p>

        <div
          className="aura card mt-10 p-6"
          style={
            {
              "--glow": "var(--curriculum)",
              "--aura-x": "20%",
              "--aura-y": "20%",
              "--aura-strength": 0.5,
            } as React.CSSProperties
          }
        >
          <label htmlFor="user" className="slabel text-curriculum-text">
            {expired ? "session ended — sign back in" : "pick a name to start"}
          </label>
          {expired && (
            <p className="mt-2 text-xs leading-relaxed text-orange-text">
              Your session ended. Enter the same name to pick up exactly where you left off.
            </p>
          )}
          <input
            id="user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. nova, tim, käsebrot…"
            maxLength={24}
            autoFocus
            className="input mt-3"
          />
          {error && <p className="mt-2 text-xs text-reject-text">{error}</p>}
          <button
            onClick={() => submit()}
            disabled={busy || username.trim().length < 2}
            className="btn btn-primary mt-4 w-full"
          >
            {busy ? "Signing in…" : "Start learning"}
          </button>
          <p className="mt-4 text-xs leading-relaxed text-faint">
            Existing name? Signing in with it brings your profile right back.
          </p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-hair" />
          <span className="slabel text-faint">or explore a lived-in profile</span>
          <span className="h-px flex-1 bg-hair" />
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={() => submit("Mara")} disabled={busy} className="btn btn-glass flex-1">
            Mara · gaming
          </button>
          <button onClick={() => submit("Theo")} disabled={busy} className="btn btn-glass flex-1">
            Theo · horses
          </button>
        </div>
      </div>

      <footer className="mt-12 space-y-2 text-center">
        <p className="text-2xs leading-relaxed text-faint">
          Public test demo — accounts are open: anyone who knows a name can open that profile.
          Please don&rsquo;t enter private or personal data. Each profile has a small AI budget.
        </p>
        <p className="text-2xs leading-relaxed text-faint">
          This demo exists so you can see how Bridge reads your interests — and tell us whether it
          got you right.
        </p>
      </footer>
    </main>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
