# Bridge — Reifegrad-Analyse: von der Demo zum echten Produkt

## Was Bridge ist
Eine KI-Lern-Web-App (Next.js, Prisma/SQLite lokal bzw. Turso gehostet, OpenRouter-LLMs,
lokale Embeddings). Kernidee: neuen Lernstoff über die bestehenden Interessen des Lernenden
erklären (analoges Transferlernen). Pipeline: Interessen-Interview → Interessenprofil
(Vektorspeicher) → Material erfassen (Bild/PDF/DOCX → Konzeptgraph) → zugeschnittene Analogie
mit unabhängigem Faktencheck-Verify → aktiver Abruf (Quiz) → Spaced Repetition. Login nur
Name+Passwort (keine E-Mail), öffentliche Demo mit KI-Budget pro Profil; 10 UI-Sprachen.

## Aktueller Stand (nach Härtungsrunde)
Funktioniert **manuell verifiziert** end-to-end in mehreren Sprachen (de/tr/ar inkl. RTL) —
d.h. Kernflüsse wurden gezielt durchgeklickt, es existiert kein automatisiertes Testprotokoll
(siehe P1.3, das ist eine echte Lücke, keine Formsache). Auth gehärtet: Passwortpflicht +
Trust-on-first-use, scrypt-Hash, Brute-Force-Lockout, timing-safe Owner-Code, Secure-Cookie über
HTTPS. Sprach-Konsistenz gefixt (lokale Wahl gewinnt, Profil-Sync). Bridge probiert bei
Analogie-Ablehnung die nächstbeste Interesse vor dem Plain-Fallback.

## Reifegrad-Einstufung auf einen Blick

| Bereich | Status | Begründung |
|---|---|---|
| Auth & Zugriff | 🟡 Beta | gehärtet, aber kein Recovery-Pfad |
| Lern-Kernfunktion (Bridge/Grading) | 🟡 Beta | funktioniert, Bewertungsqualität unvalidiert |
| Testabdeckung | 🔴 Demo | nur Algorithmen unit-getestet, keine API-Tests |
| Datenschutz & Recht | 🔴 Demo | keine DSGVO-Betrachtung, kein Impressum/ToS |
| Content-Sicherheit (Ingestion) | 🔴 Demo | kein Schutz vor Prompt-Injection über Uploads |
| Betrieb/Resilienz | 🔴 Demo | kein Monitoring, kein Backup-Konzept, Single-Vendor-LLM |
| Internationalisierung | 🟢 produktionsnah | de/tr/ar inkl. RTL verifiziert; Embeddings aber englisch-zentriert |
| Feinschliff (A11y, Materialverwaltung, Offline) | 🔴 offen | noch nicht angegangen |

**Gesamt: Demo → Beta, noch nicht produktionsreif.** Die Lücken mit Rechtsbezug (Datenschutz,
Nutzungsbedingungen) sind der Unterschied zwischen "funktionierender Beta" und "startfähigem
Produkt" — sie sind unabhängig von der technischen Qualität blockierend.

## Ehrliche Lücken bis zum echten Produkt (priorisierte Roadmap)

Jeder Punkt mit grober Aufwandsschätzung (S = Tage, M = 1–2 Wochen, L = mehrere Wochen inkl.
Migration/Nacharbeit) und Abhängigkeiten.

### P1 — blockierend für echte Nutzer
1. **Kein Passwort-/Konto-Recovery.** *(Aufwand: S, keine Abhängigkeit)* Ohne E-Mail ist ein
   vergessenes Passwort = Account weg. Optionen: einmaliger Recovery-Code bei Registrierung
   (gehasht), oder optionale E-Mail.
2. **Assessment-Integrität hängt am LLM-Grader.** *(Aufwand: M, keine Abhängigkeit)* Die
   Bewertung des freien Abrufs macht ein Sprachmodell; keine Kalibrierung/Nachvollziehbarkeit.
   Für „echtes Lernen" braucht es zumindest Stichproben-Validierung und ein transparentes Rubric.
3. **Keine API-Route-Tests.** *(Aufwand: M, keine Abhängigkeit)* Nur die Algorithmen (Graph,
   Dedupe, Bandit, SM-2) sind unit-getestet; die Endpunkte (Auth, Extract, Bridge, Answer) haben
   keine automatisierten Tests → Regressionen fallen erst im Betrieb auf.
4. **Kein Datenschutz-/DSGVO-Konzept.** *(Aufwand: M–L, blockiert Punkt 5)* Bridge legt pro
   Nutzer ein Interessenprofil im Vektorspeicher an und speichert hochgeladenes Lernmaterial
   (Bild/PDF/DOCX), gehostet über Turso und verarbeitet über OpenRouter — beides Auftrags-
   verarbeiter außerhalb der eigenen Infrastruktur. Für einen echten Launch fehlen: Rechtsgrundlage
   für die Profilbildung, Löschkonzept, Datenexport, AVV mit Turso/OpenRouter. Das ist ein
   rechtlicher, nicht nur technischer Block.
5. **Fehlende rechtliche Grundlagen für den Launch.** *(Aufwand: S, Abhängigkeit: Punkt 4)*
   Kein Impressum, keine Nutzungsbedingungen, keine explizite Einwilligung zur Verarbeitung der
   Interessendaten. Ohne Punkt 4 lässt sich das nicht sauber formulieren.
6. **Content-Safety/Prompt-Injection-Risiko in der Ingestion-Pipeline.** *(Aufwand: M, keine
   Abhängigkeit)* Hochgeladene Bilder/PDF/DOCX werden extrahiert und landen als Text im
   LLM-Kontext (Konzeptgraph, Analogie, Faktencheck). Manipulierte Dokumentinhalte könnten den
   Faktencheck-Verify oder die Analogie-Generierung gezielt verfälschen — das untergräbt genau
   das Vertrauen, das Punkt 2 ohnehin schon in Frage stellt. Fehlt: Sanitizing/Isolierung des
   extrahierten Texts vor Prompt-Einbettung, Testfälle für Prompt-Injection über Uploads.

### P2 — Qualität & Vertrauen
7. **Brain-Embeddings englisch-zentriert** (all-MiniLM-L6-v2). *(Aufwand: L, Re-Seed aller
   Vektoren nötig)* Für nicht-englische Interessen ist das Clustering schwächer.
8. **Kein IP-Rate-Limit.** *(Aufwand: S)* Lockout ist nur pro Account; verteiltes Ausprobieren
   vieler Namen oder Massen-Account-Erstellung ist ungebremst.
9. **Bridge-Kosten können springen.** *(Aufwand: S)* Bei Analogie-Ablehnung bis zu 2 Domains ×
   3 Versuche × 2 Calls (generate + verify) = **bis zu 12 LLM-Calls pro Bridge-Anfrage**.
   Kostenobergrenze/Instrumentierung fehlt.
10. **Keine Lern-Analytik.** *(Aufwand: M)* Es gibt keine Messung, ob Nutzer tatsächlich
    besser/schneller lernen — für eine Lern-App die eigentlich wichtigste Metrik.
11. **Abhängigkeit von einem einzigen LLM-Provider (OpenRouter) ohne Fallback.** *(Aufwand:
    S–M)* Kernfunktionen (Analogie, Faktencheck, Grading) hängen vollständig an einem Anbieter;
    Preisänderung, Rate-Limits oder Ausfall legen das Produkt lahm. Kein Fallback-Modell/Provider
    definiert.
12. **Kein Backup-/Recovery-Konzept für die Turso-Datenbank.** *(Aufwand: S)* Bei Datenverlust
    oder fehlerhafter Migration gibt es keinen dokumentierten Wiederherstellungsweg.
13. **Kein Monitoring/Observability/Alerting im Betrieb.** *(Aufwand: M)* Über die reine
    LLM-Kosteninstrumentierung (Punkt 9) hinaus fehlt jede Betriebssicht (Fehlerraten, Latenzen,
    Alerts) — Ausfälle würden nur durch Nutzerbeschwerden auffallen.

### P3 — Feinschliff
14. Accessibility (Tastatur, Screenreader, Kontraste, RTL-Details) ungeprüft.
15. Erfasstes Material nicht editier-/löschbar; keine Verwaltung der Ordner.
16. PWA vorhanden, aber kein Offline-Modus.
17. Onboarding erklärt die Kennzahlen (Gewicht/Kohärenz/Beherrschung) jetzt via Legende, aber die
    Beziehung Karte↔Brain↔Beherrschung bleibt für Erstnutzer abstrakt.

## Bewusste Nicht-Ziele (für den Demo-Zweck ok)
- Offenes Konten-Modell (transparent kommuniziert, keine echten Daten vorgesehen). **Das ist eine
  kommunizierte Policy, keine technische Kontrolle** — nichts hindert Demo-Nutzer daran, echte
  Namen oder echte Interessen einzugeben. Solange Punkt 4/5 nicht gelöst sind, bleibt das ein
  reales Restrisiko, kein rein theoretisches; ein sichtbarer Warnhinweis vor dem Interview wäre
  eine günstige Zwischenlösung.
- SQLite/Turso-Skalierung (für Demo ausreichend, unabhängig vom Backup-Thema in P2.12).

## Empfehlung: der EINE nächste Schritt
Wenn nur ein Punkt gewählt werden muss: **Punkt 4 (Datenschutz-/DSGVO-Kurzaudit inkl. Punkt 5,
Rechtliches)**. Begründung: Er ist der einzige Punkt, der den Übergang zur "echten Produkt"-Phase
*rechtlich* verhindert, unabhängig davon, wie gut die Technik ist — man darf mit echten Nutzern
und echten Interessendaten schlicht nicht live gehen, ohne das geklärt zu haben. Alle anderen
P1-Punkte (Recovery, Grading-Kalibrierung, API-Tests) sind wichtig, aber nachträglich mit
vertretbarem Aufwand nachrüstbar, ohne dass in der Zwischenzeit Schaden entsteht.

Enger zweiter Kandidat: **Punkt 1 (Passwort-Recovery)** — falls der DSGVO-Kurzaudit ergibt, dass
ein vorerst geschlossener Beta-Kreis (statt offener Launch) rechtlich unkritisch ist, wird
Recovery zum dringendsten Punkt, weil Datenverlust für den einzelnen Nutzer irreversibel ist und
Vertrauen sofort zerstört.

**Frage an das Review:** Ist diese Priorisierung stimmig — insbesondere die Einstufung von
Datenschutz/Recht als P1 vor den funktionalen Lücken? Wird eine andere kritische Lücke
unterschätzt oder überschätzt?