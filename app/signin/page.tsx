"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/components/LanguageProvider";
import { LanguageSelect } from "@/components/LanguageSelect";

function SignInForm() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const expired = useSearchParams().get("expired") === "1";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ownerCode, setOwnerCode] = useState("");
  const [showOwner, setShowOwner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `explore` sign-ins (the seeded demo profiles) carry no credentials.
  async function submit(name?: string) {
    const value = (name ?? username).trim();
    if (!value) return;
    const explore = name !== undefined;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: value,
          language: lang,
          ...(explore ? {} : { password: password || undefined, ownerCode: ownerCode || undefined }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error ?? `Sign-in failed (server responded ${res.status}).`);
      }
      router.push(data.hasProfile ? "/" : "/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.somethingWrong"));
      setBusy(false);
    }
  }

  return (
    <main className="page-enter mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-10 pt-14">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Bridge</p>
          <LanguageSelect compact />
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text">
          {t("signin.heroTitle")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-dim">{t("signin.heroSub")}</p>

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
            {expired ? t("signin.sessionEnded") : t("signin.pickName")}
          </label>
          {expired && (
            <p className="mt-2 text-xs leading-relaxed text-orange-text">{t("signin.expiredNote")}</p>
          )}
          <input
            id="user"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t("signin.placeholder")}
            maxLength={24}
            autoFocus
            className="input mt-3"
          />
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={t("signin.passwordPlaceholder")}
            maxLength={128}
            autoComplete="current-password"
            className="input mt-3"
          />
          <p className="mt-2 text-xs leading-relaxed text-faint">{t("signin.passwordHint")}</p>

          {showOwner ? (
            <input
              id="owner"
              value={ownerCode}
              onChange={(e) => setOwnerCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder={t("signin.ownerPlaceholder")}
              maxLength={128}
              className="input mt-3"
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowOwner(true)}
              className="slabel mt-3 text-faint transition hover:text-dim"
            >
              {t("signin.ownerToggle")}
            </button>
          )}

          {error && <p className="mt-2 text-xs text-reject-text">{error}</p>}
          <button
            onClick={() => submit()}
            disabled={busy || username.trim().length < 2}
            className={`btn mt-4 w-full ${busy ? "btn-working" : "btn-primary"}`}
          >
            {busy ? t("signin.opening") : t("signin.start")}
          </button>
          <p className="mt-4 text-xs leading-relaxed text-faint">{t("signin.existing")}</p>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <span className="h-px flex-1 bg-hair" />
          <span className="slabel text-faint">{t("signin.orExplore")}</span>
          <span className="h-px flex-1 bg-hair" />
        </div>
        <div className="mt-4 flex gap-3">
          <button onClick={() => submit("Mara")} disabled={busy} className="btn btn-glass flex-1">
            {t("signin.mara")}
          </button>
          <button onClick={() => submit("Theo")} disabled={busy} className="btn btn-glass flex-1">
            {t("signin.theo")}
          </button>
        </div>
      </div>

      <footer className="mt-12 space-y-2 text-center">
        <p className="text-2xs leading-relaxed text-faint">{t("signin.footer1")}</p>
        <p className="text-2xs leading-relaxed text-faint">{t("signin.footer2")}</p>
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
