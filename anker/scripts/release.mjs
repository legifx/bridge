#!/usr/bin/env node
// Legt die fertige APK und ihre Update-Beschreibung (version.json) nach anker/release/.
// Aufruf aus dem Ordner anker/:   node scripts/release.mjs
// Vorher bauen:                   ./gradlew assembleRelease
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const gradle = fs.readFileSync(path.join(root, "app/build.gradle.kts"), "utf8");
const versionCode = Number(gradle.match(/versionCode = (\d+)/)[1]);
const versionName = gradle.match(/versionName = "([^"]+)"/)[1];

const built = path.join(root, "app/build/outputs/apk/release/app-release.apk");
if (!fs.existsSync(built)) { console.error("Keine APK gefunden. Erst ./gradlew assembleRelease ausführen."); process.exit(1); }

const out = path.join(root, "release");
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(built, path.join(out, "anker.apk"));
const bytes = fs.readFileSync(path.join(out, "anker.apk"));
const notesFile = path.join(out, "notes.txt");
const manifest = {
  versionCode,
  versionName,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  size: bytes.length,
  apk: "anker.apk",
  notes: fs.existsSync(notesFile) ? fs.readFileSync(notesFile, "utf8").trim() : "",
};
fs.writeFileSync(path.join(out, "version.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Anker ${versionName} (${versionCode}), ${(bytes.length / 1048576).toFixed(1)} MB, sha256 ${manifest.sha256.slice(0, 12)}…`);
