// Test der Brücke gegen einen Stellvertreter für `claude`:  node --test anker/pc/bridge.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18787;
const config = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "anker-test-")), "config.json");
const base = `http://127.0.0.1:${PORT}`;
let proc, code;

before(async () => {
  const fake = path.join(here, "fake-claude.mjs");
  fs.chmodSync(fake, 0o755);
  proc = spawn(process.execPath, [path.join(here, "anker-bridge.mjs")], {
    env: { ...process.env, ANKER_PORT: String(PORT), ANKER_CONFIG: config, ANKER_CLAUDE_BIN: fake, ANTHROPIC_API_KEY: "sk-test-should-not-leak" },
  });
  let out = "";
  await new Promise((resolve, reject) => {
    proc.stdout.on("data", (d) => { out += d; if (out.includes("Kopplungscode")) resolve(); });
    proc.on("exit", () => reject(new Error("Brücke beendet: " + out)));
    setTimeout(() => reject(new Error("Brücke startet nicht: " + out)), 10_000);
  });
  code = JSON.parse(fs.readFileSync(config, "utf8")).code;
});
after(() => proc?.kill());

const post = (body, token) => fetch(`${base}/v1/complete`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

test("health braucht keinen Code und verrät nichts", async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, name: "anker-bridge", version: "1" });
});

test("ohne oder mit falschem Code keine Antwort", async () => {
  assert.equal((await post({ prompt: "hi" })).status, 401);
  assert.equal((await post({ prompt: "hi" }, "FALSCHFALS")).status, 401);
});

test("mit Code: Frage über stdin, Systemtext aus Datei, keine Werkzeuge, kein API-Key", async () => {
  const r = await post({ system: "Sei knapp.", prompt: "Mathe \"S. 42\" & Bio; $(rm -rf x)", model: "claude-opus-5-5" }, code);
  assert.equal(r.status, 200);
  const got = JSON.parse((await r.json()).text);
  assert.equal(got.echo, "Mathe \"S. 42\" & Bio; $(rm -rf x)");
  assert.equal(got.system, "Sei knapp.");
  assert.equal(got.noTools, true);
  assert.equal(got.print, true);
  assert.equal(got.model, "claude-opus-5-5");
  assert.equal(got.apiKeyVisible, false);
});

test("Code mit Bindestrich und Kleinbuchstaben wird akzeptiert", async () => {
  const pretty = `${code.slice(0, 5)}-${code.slice(5)}`.toLowerCase();
  assert.equal((await post({ prompt: "hi" }, pretty)).status, 200);
});

test("Modellname mit Sonderzeichen wird nicht an die Kommandozeile gereicht", async () => {
  const r = await post({ prompt: "hi", model: "x; rm -rf /" }, code);
  assert.equal(JSON.parse((await r.json()).text).model, null);
});

test("Fehler von Claude kommen als verständliche Meldung an", async () => {
  const r = await post({ prompt: "BITTE_FEHLER" }, code);
  assert.equal(r.status, 502);
  assert.match((await r.json()).error, /Not logged in/);
});

test("kaputte und leere Anfragen", async () => {
  assert.equal((await post("{kaputt", code)).status, 400);
  assert.equal((await post({ prompt: "  " }, code)).status, 400);
  assert.equal((await fetch(`${base}/irgendwas`)).status, 404);
});

test("nach 8 Fehlversuchen gesperrt, auch mit richtigem Code", async () => {
  for (let i = 0; i < 8; i++) await post({ prompt: "hi" }, "FALSCHFALS");
  assert.equal((await post({ prompt: "hi" }, code)).status, 429);
});
