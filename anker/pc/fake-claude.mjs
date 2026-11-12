#!/usr/bin/env node
// Stellvertreter für `claude` im Test der Brücke: prüft, wie er aufgerufen wird, und
// antwortet im Format von `claude -p --output-format json`.
import fs from "node:fs";
const args = process.argv.slice(2);
const sysFile = args[args.indexOf("--system-prompt-file") + 1];
const system = fs.readFileSync(sysFile, "utf8");
let prompt = "";
process.stdin.on("data", (d) => (prompt += d));
process.stdin.on("end", () => {
  if (prompt.includes("BITTE_FEHLER")) {
    process.stdout.write(JSON.stringify({ is_error: true, result: "Not logged in" }));
    process.exit(1);
  }
  if (prompt.includes("FAKE_TASKS")) {
    // Wie ein echtes Modell es manchmal tut: Satz davor, Code-Zaun drumherum.
    const answer = {
      summary: "Zwei Aufgaben und eine Klausur erkannt.", profile_notes: "",
      tasks: [
        { title: "Mathe S. 42 rechnen", estimate_min: 30, priority: 1, due: "", category: "Schule", notes: "" },
        { title: "Video {schneiden}", estimate_min: 60, priority: 3, due: "", category: "Projekt", notes: "Klammern } im \"Text\"" },
      ],
      exams: [{ subject: "Bio", date: "2026-12-01", kind: "Klausur", topics: "Genetik" }],
    };
    process.stdout.write(JSON.stringify({ is_error: false, result: "Hier ist das Ergebnis:\n```json\n" + JSON.stringify(answer, null, 2) + "\n```" }));
    return;
  }
  process.stdout.write(JSON.stringify({
    is_error: false,
    result: JSON.stringify({
      echo: prompt, system, noTools: args[args.indexOf("--disallowedTools") + 1] === "*",
      print: args.includes("-p"), model: args.includes("--model") ? args[args.indexOf("--model") + 1] : null,
      apiKeyVisible: Boolean(process.env.ANTHROPIC_API_KEY),
    }),
  }));
});
