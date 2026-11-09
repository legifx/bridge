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
| **Plan** | Reinlabern per Spracheingabe → Claude macht daraus Aufgaben mit Zeitschätzung, Priorität, Fälligkeit, erkennt Klausuren. „Tag planen“ baut einen Zeitplan für den Rest des Tages |
| **Statistik** | 7 Tage Social Media und Handy gesamt, Level, Serien |
| **Netzfilter** | Inhaltsfilter (eigene Liste + Cloudflare for Families), SafeSearch für Google/Bing/DuckDuckGo, Netzsperre für die Apps der Limit-Liste bei Limit, nachts und im Fokus. Nur Namensanfragen laufen durch den Tunnel, kein Datenverkehr |
| **Warnungen** | Bei 50 / 80 / 100 % des Limits, danach alle 15 Min, und nachts, wenn eine Dopamin-App läuft |
| **Punkte** | Erledigte Aufgaben, Tage unter Limit (+1 pro gesparter Minute), ruhige Abende, Fokus-Sessions. Einlösbar gegen selbst gewählte Belohnungen |
| **Festschreiben** | Danach gilt jede Lockerung erst nach 24 Stunden (höheres Limit, App entfernen, Nachtzeit aus) |
| **Schule & Profil** | Stundenplan, Klausuren, Rhythmus, „Über mich“. Die KI nutzt das beim Planen |
| **Privat** | Optional mit PIN: Tage-Zähler, 10-Minuten-Drang-Hilfe, Rückfall-Protokoll mit Auslösern, Tipps. Neutral benannt |
| **Sicherung** | Export/Import aller Daten als JSON |

## KI

Der Planer nutzt die Claude-API (`claude-opus-5-5`, structured outputs). Dafür braucht es einen
API-Key von console.anthropic.com (unter *Mehr → KI-Einstellungen*). Ohne Key wird beim
Umwandeln jeder Satz eine Aufgabe, ohne Schätzung.

An Claude geht nur, was du selbst abschickst, plus offene Aufgaben, Klausuren, Stundenplan und
„Über mich“. Keine Nutzungsdaten, nichts aus dem privaten Bereich.

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
./gradlew testDebugUnitTest      # Logik-, Filter- und Durchklick-Tests mit Screenshots (app/build/screens)
```

Signieren: Ohne `keystore.properties` wird mit dem Debug-Schlüssel signiert. Für Updates, die
sich über die alte Version installieren lassen, einen eigenen Schlüssel anlegen und in
`keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`) beschreiben.
Beide Dateien sind in `.gitignore`. Passt die Signatur nicht, vorher in der App sichern,
deinstallieren, neu installieren, importieren.
