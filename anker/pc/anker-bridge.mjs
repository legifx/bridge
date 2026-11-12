#!/usr/bin/env node
// Anker PC-Brücke
//
// Reicht Anfragen der Anker-App an das unveränderte Claude Code auf diesem PC weiter
// (`claude -p`). Dadurch laufen sie über dein Claude-Abo; die App braucht keinen API-Key.
//
// Starten:   node anker-bridge.mjs
// Danach die angezeigte Adresse und den Kopplungscode in der App eintragen
// (Mehr → KI-Einstellungen).
//
// Sicherheit:
//  - Nur wer den Kopplungscode kennt, bekommt eine Antwort. Nach 8 Fehlversuchen ist die
//    Adresse des Absenders 10 Minuten gesperrt.
//  - Claude wird ohne Werkzeuge gestartet: Es kann nur Text beantworten, keine Dateien
//    lesen und nichts ausführen.
//  - Nur für dich. Gib die Adresse nicht weiter und mach den Port nicht im Internet auf.
//    Für unterwegs: Tailscale.

import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const VERSION = "1";
const PORT = Number(process.env.ANKER_PORT || 8787);
const CLAUDE = process.env.ANKER_CLAUDE_BIN || "claude";
const CONFIG = process.env.ANKER_CONFIG || path.join(os.homedir(), ".anker-bridge.json");
const MAX_BODY = 256 * 1024;
const TIMEOUT_MS = 180_000;
const WORKDIR = path.join(os.tmpdir(), "anker-bridge");

// ---- Kopplungscode ---------------------------------------------------------------

/** 10 Zeichen ohne verwechselbare Buchstaben (kein 0/O, 1/I/L). */
function newCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function loadCode() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
    if (typeof c.code === "string" && c.code.length >= 8) return c.code;
  } catch {}
  const code = newCode();
  fs.writeFileSync(CONFIG, JSON.stringify({ code }, null, 2), { mode: 0o600 });
  return code;
}

const CODE = process.argv.includes("--new-code")
  ? (fs.rmSync(CONFIG, { force: true }), loadCode())
  : loadCode();

function sameCode(given) {
  const a = Buffer.from(String(given || "").toUpperCase().replace(/[^A-Z0-9]/g, ""));
  const b = Buffer.from(CODE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---- Sperre nach Fehlversuchen ---------------------------------------------------

const failures = new Map(); // Adresse → { count, until }
function blocked(ip) {
  const f = failures.get(ip);
  return f && f.until > Date.now();
}
function fail(ip) {
  const f = failures.get(ip) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= 8) { f.until = Date.now() + 10 * 60_000; f.count = 0; }
  failures.set(ip, f);
}

// ---- Claude aufrufen ---------------------------------------------------------------

let busy = Promise.resolve(); // eine Anfrage nach der anderen

function runClaude({ system, prompt, model }) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(WORKDIR, { recursive: true });
    const sysFile = path.join(WORKDIR, `system-${crypto.randomBytes(4).toString("hex")}.txt`);
    fs.writeFileSync(sysFile, system || "", { mode: 0o600 });

    const args = [
      "-p",
      "--output-format", "json",
      "--system-prompt-file", sysFile,
      "--disallowedTools", "*", // keine Werkzeuge: nur Text rein, Text raus
      "--max-turns", "3",
      "--no-session-persistence",
    ];
    if (model && /^[A-Za-z0-9._\-\[\]]+$/.test(model)) args.push("--model", model);

    // Ein gesetzter API-Key hätte Vorrang vor dem Abo. Für diesen Aufruf entfernen.
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    delete env.ANTHROPIC_AUTH_TOKEN;

    // Unter Windows ist `claude` je nach Installation eine .cmd-Datei und braucht die Shell.
    // Alle Argumente oben sind bewusst frei von Leer- und Sonderzeichen aus der Anfrage:
    // Systemtext kommt aus einer Datei, die Frage über die Standardeingabe.
    const child = spawn(CLAUDE, args, { cwd: WORKDIR, env, shell: process.platform === "win32", windowsHide: true });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("Zeitüberschreitung: Claude hat nicht rechtzeitig geantwortet.")); }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer); fs.rmSync(sysFile, { force: true });
      reject(new Error(e.code === "ENOENT" ? "Claude Code wurde nicht gefunden. Ist es installiert und im PATH?" : String(e.message)));
    });
    child.on("close", (code) => {
      clearTimeout(timer); fs.rmSync(sysFile, { force: true });
      let parsed = null;
      try { parsed = JSON.parse(out); } catch {}
      if (parsed && typeof parsed.result === "string" && !parsed.is_error && code === 0) return resolve(parsed.result);
      const detail = (parsed && typeof parsed.result === "string" ? parsed.result : err || out).trim().slice(0, 400);
      reject(new Error(detail || `Claude Code endete mit Code ${code}.`));
    });
    child.stdin.end(prompt);
  });
}

// ---- HTTP -------------------------------------------------------------------------

function send(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error("zu groß")); req.destroy(); } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const ip = req.socket.remoteAddress || "?";
  try {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, name: "anker-bridge", version: VERSION });
    if (req.method !== "POST" || req.url !== "/v1/complete") return send(res, 404, { error: "Unbekannte Adresse." });
    if (blocked(ip)) return send(res, 429, { error: "Zu viele Fehlversuche. In 10 Minuten nochmal." });

    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ") || !sameCode(auth.slice(7))) { fail(ip); return send(res, 401, { error: "Kopplungscode stimmt nicht." }); }
    failures.delete(ip);

    let body;
    try { body = JSON.parse(await readBody(req)); } catch { return send(res, 400, { error: "Anfrage nicht lesbar." }); }
    if (typeof body.prompt !== "string" || !body.prompt.trim()) return send(res, 400, { error: "Leere Anfrage." });

    const job = busy.then(() => runClaude({ system: String(body.system || ""), prompt: body.prompt, model: body.model }));
    busy = job.catch(() => {});
    const text = await job;
    console.log(`${new Date().toLocaleTimeString()}  Anfrage beantwortet (${text.length} Zeichen)`);
    send(res, 200, { text });
  } catch (e) {
    console.log(`${new Date().toLocaleTimeString()}  Fehler: ${e.message}`);
    send(res, 502, { error: e.message });
  }
});

function addresses() {
  const list = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== "IPv4" || a.internal) continue;
      const tailscale = a.address.startsWith("100.") && Number(a.address.split(".")[1]) >= 64 && Number(a.address.split(".")[1]) <= 127;
      list.push({ url: `http://${a.address}:${PORT}`, hint: tailscale ? "Tailscale: geht von überall" : `WLAN/LAN (${name})` });
    }
  }
  return list;
}

server.listen(PORT, "0.0.0.0", () => {
  console.log("\nAnker PC-Brücke läuft.\n");
  console.log("In der App unter Mehr → KI-Einstellungen eintragen:\n");
  for (const a of addresses()) console.log(`  Adresse:        ${a.url}    (${a.hint})`);
  console.log(`  Kopplungscode:  ${CODE.slice(0, 5)}-${CODE.slice(5)}\n`);
  console.log("Fenster offen lassen. Beenden mit Strg+C. Neuer Code: node anker-bridge.mjs --new-code\n");
});
