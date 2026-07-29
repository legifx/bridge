import Link from "next/link";
import { Shell } from "@/components/Shell";
import { PageHead } from "@/components/PageHead";

/**
 * The Android download.
 *
 * Written to be read before the button is pressed, not after. The app is the
 * client for a *self-hosted* Bridge server — it cannot talk to this demo, whose
 * accounts are anonymous and open by design. Saying that here costs a paragraph;
 * not saying it costs whoever downloads it an install that never gets past the
 * first screen, and they will blame the app rather than the missing server.
 */
export const metadata = {
  title: "Bridge for Android",
  description:
    "The native Android client for a self-hosted Bridge server. Signed APK, 1.5 MB, no trackers.",
};

const FACTS = [
  { label: "Version", value: "1.0.2" },
  { label: "Size", value: "1.5 MB" },
  { label: "Requires", value: "Android 8.0 (API 26) or newer" },
  { label: "Permissions", value: "Internet and notifications — no camera, no storage, no location" },
];

export default function Android() {
  return (
    <Shell>
      <PageHead
        eyebrow="Download"
        title="Bridge for Android"
        sub="The native client — onboarding interview, camera capture, learning sessions and streaks, in a 1.5 MB app."
      />

      <div
        className="aura card p-6"
        style={{ "--glow": "var(--interest)", "--aura-x": "20%", "--aura-y": "25%", "--aura-strength": 0.4 } as React.CSSProperties}
      >
        <p className="eyebrow mb-3">Before you download</p>
        <p className="text-sm leading-relaxed text-dim">
          This app does <strong className="text-text">not</strong> connect to the demo you are
          looking at. The demo runs on anonymous, open profiles; the app expects a Bridge server
          with real accounts — the one in{" "}
          <Link
            href="https://github.com/legifx/bridge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-curriculum-text underline underline-offset-2"
          >
            this repository
          </Link>
          , running under your own domain.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          On first launch the app asks for that address. Without one it will show you a sign-in
          screen and nothing else — that is expected, not a bug.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          The address has to be <code className="font-mono text-xs text-text">https://</code>.
          Android blocks unencrypted connections outright, so a plain-HTTP instance on your local
          network will not answer no matter how correct the address is — put it behind Tailscale or
          a reverse proxy first.
        </p>
      </div>

      <div className="mt-6">
        <a
          href="/bridge-app.apk"
          download
          className="btn btn-primary w-full"
        >
          Download APK · 1.5 MB
        </a>
        <p className="mt-3 text-center text-2xs leading-relaxed text-faint">
          Signed release build. Android will ask you to allow installs from your browser once.
        </p>
      </div>

      <div className="card mt-6 p-5">
        <p className="eyebrow mb-2">Android will warn you. Here is what that warning means</p>
        <p className="text-sm leading-relaxed text-dim">
          Play Protect flags every app that did not come from the Play Store and is not signed by a
          developer Google has registered. It is a statement about <em>where the file came from</em>,
          not about what is in it — nothing was scanned and found; the app is simply unknown. The
          same build stops triggering it once it is published through the Play Console, because
          Google signs and reviews it there.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-dim">
          What you can check yourself, instead of taking that on trust: the app asks for two
          permissions — internet access and permission to show notifications. No camera permission
          (photographs are taken by your camera app), no storage, no location, no contacts. The
          fingerprint below tells you the file is the one built from this repository.
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {FACTS.map((f) => (
          <div key={f.label} className="card p-5">
            <p className="eyebrow mb-2">{f.label}</p>
            <p className="text-sm text-dim">{f.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <div className="card p-5">
          <p className="eyebrow mb-2">Verify what you installed</p>
          <p className="text-sm leading-relaxed text-dim">
            Sideloaded software should be checkable. SHA-256 of the file served here:
          </p>
          <code className="mt-3 block break-all font-mono text-xs text-text">
            d93e6a358d46ae2623955b98f66f466d85bf25134573a64625d03556f227c381
          </code>
          <p className="mt-3 text-sm leading-relaxed text-dim">
            Signing certificate (SHA-256), the same key every future build carries:
          </p>
          <code className="mt-3 block break-all font-mono text-xs text-text">
            1a:6b:08:b3:2f:ad:66:6c:ea:86:8e:2f:fc:ea:b4:3e:bc:8b:8b:65:0d:4d:cb:20:25:66:80:66:ee:23:e5:fc
          </code>
        </div>

        <div className="card p-5">
          <p className="eyebrow mb-2">What it does with your data</p>
          <p className="text-sm leading-relaxed text-dim">
            Photographed pages are downscaled on the phone and sent to your server, which keeps only
            the text transcription — the image itself is never stored, on the phone or on the
            server. There is no analytics SDK and no third-party network call: the app talks to the
            address you entered and to nothing else.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-dim">
            If the app crashes it writes the stack trace to a file on the phone and shows it to you
            on the next start, so you can copy it and report it. That report is never uploaded —
            there is nowhere for it to go.
          </p>
        </div>

        <div className="card p-5">
          <p className="eyebrow mb-2">When the Play Store version arrives</p>
          <p className="text-sm leading-relaxed text-dim">
            It will be signed by Google rather than by this key, so Android will refuse to install
            it over this build. Uninstalling this one first is the whole workaround — but your
            account and everything in it live on your server, not in the app, so nothing is lost.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <Link
          href="/project"
          className="card ring-focus block p-5 transition hover:bg-white/[0.06]"
        >
          <p className="font-semibold text-text">How Bridge works</p>
          <p className="text-sm text-dim">The architecture, the tech stack, and every design decision</p>
        </Link>
      </div>
    </Shell>
  );
}
