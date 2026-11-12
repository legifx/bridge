# Anker

Android-App gegen zu viel Handyzeit: misst, wie lange du in Social Media und Spielen bist,
erinnert dich rechtzeitig, belohnt dich für Tage unter dem Limit und plant deinen Tag aus dem,
was du ihr erzählst.

Dazu ein **Netzfilter** (lokaler DNS-Filter, wie bei Werbeblockern): blockiert nicht jugendfreie
Seiten im ganzen Handy, erzwingt SafeSearch und trennt Social-Media-Apps vom Netz, sobald das
Tageslimit erreicht ist, nachts oder in einer Fokus-Session.

**Kein Schutz gegen dich selbst:** Der Filter lässt sich in den Android-Einstellungen unter VPN
trennen; die App zeigt das an, verhindert es aber nicht. Für eine Grenze, die du nicht selbst
aufheben kannst, zusätzlich Google Family Link mit einer Vertrauensperson nutzen (Anleitung in
der App unter *Mehr → Einrichtung & harte Sperre*).

## Installieren

1. `release/anker.apk` aufs Handy laden (Android 8 oder neuer).
2. Antippen. Android fragt einmal, ob dein Browser bzw. deine Dateien-App Apps installieren darf: erlauben.
3. Play Protect warnt, weil die App nicht aus dem Play Store kommt. „Trotzdem installieren“.
4. In der App: *Nutzungszugriff* erlauben (Pflicht), Benachrichtigungen, Akku-Optimierung aus.

## Was drin ist

| Bereich | Was es tut |
|---|---|
| **Heute** | Ring mit Social-Media-Minuten gegen dein Tageslimit (Standard 60), Handyzeit gesamt, Top-Apps, nächste Aufgaben |
| **Agent arbeitet?** | Fokus-Session (10–60 Min) für die Wartezeit, während Claude arbeitet, mit Mikro-Aufgaben. Ohne Social Media in der Zeit gibt es doppelte Punkte |
| **Plan** | Reinlabern per Spracheingabe → Claude (über dein Abo, siehe unten) macht daraus Aufgaben mit Zeitschätzung, Priorität, Fälligkeit, erkennt Klausuren. „Tag planen“ baut einen Zeitplan für den Rest des Tages |
| **Statistik** | 7 Tage Social Media und Handy gesamt, Level, Serien |
| **Netzfilter** | Inhaltsfilter (eigene Liste + Cloudflare for Families), SafeSearch für Google/Bing/DuckDuckGo, Netzsperre für die Apps der Limit-Liste bei Limit, nachts und im Fokus. Nur Namensanfragen laufen durch den Tunnel, kein Datenverkehr |
| **Warnungen** | Bei 50 / 80 / 100 % des Limits, danach alle 15 Min, und nachts, wenn eine Dopamin-App läuft |
| **Punkte** | Erledigte Aufgaben, Tage unter Limit (+1 pro gesparter Minute), ruhige Abende, Fokus-Sessions. Einlösbar gegen selbst gewählte Belohnungen |
| **Festschreiben** | Danach gilt jede Lockerung erst nach 24 Stunden (höheres Limit, App entfernen, Nachtzeit aus) |
| **Schule & Profil** | Stundenplan, Klausuren, Rhythmus, „Über mich“. Die KI nutzt das beim Planen |
| **Privat** | Optional mit PIN: Tage-Zähler, 10-Minuten-Drang-Hilfe, Rückfall-Protokoll mit Auslösern, Tipps. Neutral benannt |
| **Sicherung** | Export/Import aller Daten als JSON |
| **Updates** | Meldet neue Versionen in der App und installiert sie mit einem Tipp |

## KI über dein Claude-Abo (PC-Brücke)

Der Planer braucht keinen API-Key. Auf dem PC läuft ein kleines Skript, das Anfragen der App an
das dort installierte, unveränderte Claude Code weiterreicht (`claude -p`). Abgerechnet wird über
das Abo, mit dem Claude Code angemeldet ist.

```bash
node anker/pc/anker-bridge.mjs
```

Das Fenster zeigt Adresse(n) und einen Kopplungscode. Beides in der App unter
*Mehr → KI-Einstellungen* eintragen und „Verbinden & testen“ tippen.

- Voraussetzungen am PC: Node 18+, Claude Code installiert und mit dem Abo angemeldet.
- Handy und PC im selben WLAN, oder beide im selben Tailscale-Netz (dann die `100.x`-Adresse).
- Die Brücke startet Claude ohne Werkzeuge: Text rein, Text raus. Sie beantwortet nur Anfragen
  mit dem Kopplungscode und sperrt eine Adresse nach 8 Fehlversuchen für 10 Minuten.
- Nur für dich selbst: Port nicht ins Internet freigeben, Code nicht weitergeben.
- Ist der PC aus, geht der Planer nicht. Als Ausweichweg lässt sich in der App ein API-Key
  eintragen; er wird nur benutzt, wenn keine Brücke verbunden ist.

Warum nicht das Abo direkt in der App? Anthropic erlaubt die Anmeldung mit dem Abo nur in den
eigenen Programmen (Claude-Apps, Claude Code), nicht in selbstgebauten Apps
([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)). Die Brücke nutzt
deshalb das Claude Code auf dem eigenen PC.

An Claude geht nur, was du selbst abschickst, plus offene Aufgaben, Klausuren, Stundenplan und
„Über mich“. Keine Nutzungsdaten, nichts aus dem privaten Bereich. Das Diktieren selbst macht
die Spracherkennung des Handys.

## Updates

Die App schaut beim Öffnen (höchstens alle 6 Stunden) nach einer neuen Version, meldet sie und
installiert sie mit einem Tipp. Sie lädt `version.json` und die APK aus diesem Repository,
vergleicht die SHA-256-Prüfsumme und übergibt die Datei dem Android-Paketinstaller. Beim ersten
Update fragt Android einmal nach; danach kann es ohne Rückfrage laufen (ab Android 12).

Zwei Kanäle, die App nimmt die höhere Version:

1. Release `anker-latest` (wird vom Workflow `.github/workflows/anker-release.yml` befüllt)
2. `anker/release/` auf dem Entwicklungszweig

**Signaturschlüssel:** Android nimmt ein Update nur an, wenn es mit demselben Schlüssel signiert
ist. Damit der Workflow das kann, einmalig das Repository-Secret `ANKER_KEYSTORE_B64` anlegen
(GitHub → Settings → Secrets and variables → Actions → New repository secret; Inhalt: die
Schlüsseldatei als base64). Ohne das Secret baut und testet der Workflow nur.

Neue Version veröffentlichen: `versionCode` und `versionName` in `app/build.gradle.kts` erhöhen,
`release/notes.txt` anpassen, pushen. Von Hand: `./gradlew assembleRelease && node scripts/release.mjs`.

## Grenzen des Filters

- Er sieht Adressen, keine Inhalte: einzelne Beiträge in Reddit, X oder Telegram kann er nicht
  unterscheiden. Dort die App-Einstellung für Inhalte für Erwachsene ausschalten oder die App
  nachts per Netzsperre trennen.
- Es läuft immer nur ein VPN gleichzeitig.
- Auf einem echten Gerät ist der Filter noch nicht erprobt; getestet sind Blockliste und
  DNS-Paketbau per Unit-Test.

Schriften: Sora und Inter (SIL Open Font License, siehe `licenses/`).

## Bauen

```bash
cd anker
echo "sdk.dir=/pfad/zum/android-sdk" > local.properties
./gradlew assembleRelease        # APK: app/build/outputs/apk/release/app-release.apk
./gradlew testDebugUnitTest      # Logik-, Filter-, Update- und Durchklick-Tests (Screenshots: app/build/screens)
node --test pc/bridge.test.mjs   # PC-Brücke gegen einen Stellvertreter für claude
```

Signieren: Ohne `keystore.properties` wird mit dem Debug-Schlüssel des jeweiligen Rechners
signiert, und solche Builds lassen sich nicht über eine anders signierte Installation
installieren. `keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`)
und Schlüsseldateien sind in `.gitignore`. Passt die Signatur einmal nicht: in der App sichern,
deinstallieren, neu installieren, importieren.
