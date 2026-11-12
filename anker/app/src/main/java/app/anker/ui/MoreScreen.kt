package app.anker.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Backup
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.EmojiEvents
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.filled.Timer
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.anker.LocalUi
import app.anker.ai.Bridge
import app.anker.data.Engine
import app.anker.data.Exam
import app.anker.data.Reward
import app.anker.util.Catalog
import app.anker.util.Times
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.LocalTime

@Composable
fun MoreScreen(sub: String, go: (String) -> Unit) {
    val back = { go("") }
    when (sub) {
        "setup" -> SetupScreen(back)
        "rewards" -> RewardsScreen(back)
        "school" -> SchoolScreen(back)
        "limits" -> LimitsScreen(back)
        "ai" -> AiScreen(back)
        "backup" -> BackupScreen(back)
        "private" -> PrivateGate(back)
        "filter" -> FilterScreen(back)
        else -> MoreMenu(go)
    }
}

@Composable
private fun MoreMenu(go: (String) -> Unit) {
    SpacedColumn {
        ScreenTitle("Mehr")
        Section {
            MenuRow(Icons.Filled.EmojiEvents, "Belohnungen", "Punkte gegen selbst gewählte Belohnungen tauschen", C.xp) { go("rewards") }
            HorizontalDivider(color = C.border)
            MenuRow(Icons.Filled.School, "Schule & Profil", "Stundenplan, Klausuren, Tagesrhythmus", C.accent2) { go("school") }
            HorizontalDivider(color = C.border)
            MenuRow(Icons.Filled.Timer, "Limits", "Tageslimit, welche Apps zählen, Nachtzeit", C.warn) { go("limits") }
            HorizontalDivider(color = C.border)
            MenuRow(Icons.Filled.SmartToy, "KI-Einstellungen", "Planer über dein Claude-Abo verbinden", C.accent) { go("ai") }
        }
        Section {
            MenuRow(Icons.Filled.WifiOff, "Netzfilter", "Inhalte filtern, Apps bei Limit und nachts vom Netz trennen", C.bad) { go("filter") }
            HorizontalDivider(color = C.border)
            MenuRow(Icons.Filled.Shield, "Einrichtung & harte Sperre", "Berechtigungen und wie du Apps wirklich sperrst", C.accent) { go("setup") }
            HorizontalDivider(color = C.border)
            MenuRow(Icons.Filled.Backup, "Sicherung", "Daten exportieren / importieren", C.accent2) { go("backup") }
            HorizontalDivider(color = C.border)
            MenuRow(Icons.Filled.Lock, "Privat", null, C.dim) { go("private") }
        }
        Section { UpdateRow() }
    }
}

// ---- Belohnungen -------------------------------------------------------------------------

@Composable
private fun RewardsScreen(back: () -> Unit) {
    val ui = LocalUi.current
    val s = ui.store
    var title by remember { mutableStateOf("") }
    var cost by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        if (s.rewards.isEmpty()) s.rewards = listOf(
            Reward(title = "Lieblingsessen bestellen", cost = 400),
            Reward(title = "Kinoabend / Film mit Freunden", cost = 600),
            Reward(title = "Neues Teil für Setup / Hobby", cost = 1500),
            Reward(title = "Ausschlafen ohne Wecker", cost = 250),
        )
    }
    SpacedColumn {
        SubHeader("Belohnungen", back)
        Section {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                Stat("${s.coins}", "Punkte einlösbar", C.xp)
                Stat("Level ${Engine.level(s.xp)}", "${s.xp} XP gesamt", C.xp)
            }
            Spacer(Modifier.height(8.dp))
            Hint("Belohnungen aus dem echten Leben, nicht mehr Bildschirmzeit — sonst trainierst du genau das, wovon du weg willst.")
        }
        Section("Deine Belohnungen") {
            s.rewards.sortedBy { it.cost }.forEach { r ->
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                    Column(Modifier.weight(1f)) {
                        Text(r.title, color = C.text)
                        Text("${r.cost} Punkte", color = C.xp, fontSize = 12.sp)
                    }
                    Button(enabled = s.coins >= r.cost, onClick = {
                        s.coins = s.coins - r.cost
                        ui.toast("Gönn dir: ${r.title} 🎉")
                    }) { Text("Einlösen") }
                    IconButton(onClick = { s.rewards = s.rewards.filterNot { it.id == r.id } }) {
                        Icon(Icons.Filled.Delete, "Löschen", tint = C.faint)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(title, { title = it }, Modifier.fillMaxWidth(), placeholder = { Text("Neue Belohnung") }, singleLine = true)
            Spacer(Modifier.height(6.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(
                    cost, { cost = it.filter(Char::isDigit).take(5) }, Modifier.width(140.dp),
                    placeholder = { Text("Kosten") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                Spacer(Modifier.width(10.dp))
                Button(enabled = title.isNotBlank() && cost.isNotBlank(), onClick = {
                    s.rewards = s.rewards + Reward(title = title.trim(), cost = cost.toInt())
                    title = ""; cost = ""
                }) { Text("Hinzufügen") }
            }
        }
    }
}

// ---- Schule & Profil -------------------------------------------------------------------------

@Composable
private fun SchoolScreen(back: () -> Unit) {
    val ui = LocalUi.current
    val s = ui.store
    var wake by remember { mutableStateOf(s.wakeTime) }
    var sleep by remember { mutableStateOf(s.sleepTime) }
    var timetable by remember { mutableStateOf(s.timetable) }
    var about by remember { mutableStateOf(s.aboutMe) }
    var subject by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf("Klausur") }
    var topics by remember { mutableStateOf("") }

    SpacedColumn {
        SubHeader("Schule & Profil", back)
        Section("Tagesrhythmus") {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(wake, { wake = it }, Modifier.weight(1f), label = { Text("Aufstehen") }, singleLine = true)
                OutlinedTextField(sleep, { sleep = it }, Modifier.weight(1f), label = { Text("Schlafen") }, singleLine = true)
            }
        }
        Section("Stundenplan") {
            Hint("Frei formuliert, z. B.:\nMo 8-15 Uhr (Mathe, Deutsch, Info)\nDi 8-13 Uhr, nachmittags Training 17-19")
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(timetable, { timetable = it }, Modifier.fillMaxWidth().heightIn(min = 120.dp))
        }
        Section("Über mich") {
            Hint("Was die KI wissen soll: Projekte, wann du am fittesten bist, feste Termine. Wird auch automatisch aus dem Reinlabern ergänzt.")
            Spacer(Modifier.height(6.dp))
            OutlinedTextField(about, { about = it }, Modifier.fillMaxWidth().heightIn(min = 120.dp))
        }
        Button(onClick = {
            s.wakeTime = Times.parse(wake, LocalTime.of(7, 0)).toString()
            s.sleepTime = Times.parse(sleep, LocalTime.of(23, 0)).toString()
            s.timetable = timetable; s.aboutMe = about
            ui.toast("Gespeichert")
        }) { Text("Speichern") }

        Section("Klausuren & Abgaben") {
            val upcoming = s.exams.sortedBy { it.date }
            if (upcoming.isEmpty()) Hint("Noch nichts eingetragen.")
            upcoming.forEach { e ->
                val past = e.date < LocalDate.now().toString()
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("${e.kind} ${e.subject}", color = if (past) C.faint else C.text)
                        Text(e.date + (if (e.topics.isNotBlank()) " · ${e.topics}" else ""), color = C.dim, fontSize = 12.sp)
                    }
                    IconButton(onClick = { s.exams = s.exams.filterNot { it.id == e.id } }) {
                        Icon(Icons.Filled.Delete, "Löschen", tint = C.faint)
                    }
                }
            }
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(subject, { subject = it }, Modifier.fillMaxWidth(), label = { Text("Fach") }, singleLine = true)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(date, { date = it }, Modifier.weight(1f), label = { Text("Datum (2026-12-01)") }, singleLine = true)
                OutlinedTextField(kind, { kind = it }, Modifier.weight(1f), label = { Text("Art") }, singleLine = true)
            }
            OutlinedTextField(topics, { topics = it }, Modifier.fillMaxWidth(), label = { Text("Themen (optional)") }, singleLine = true)
            Spacer(Modifier.height(6.dp))
            Button(onClick = {
                val d = parseDate(date)
                if (subject.isBlank() || d == null) { ui.toast("Fach und Datum (JJJJ-MM-TT oder TT.MM.JJJJ) angeben"); return@Button }
                s.exams = s.exams + Exam(subject = subject.trim(), date = d, kind = kind.ifBlank { "Klausur" }, topics = topics.trim())
                subject = ""; date = ""; topics = ""
            }) { Text("Eintragen") }
        }
    }
}

private fun parseDate(raw: String): String? {
    val t = raw.trim()
    runCatching { return LocalDate.parse(t).toString() }
    val m = Regex("""^(\d{1,2})\.(\d{1,2})\.(\d{2,4})?$""").find(t) ?: return null
    val y = m.groupValues[3].let { if (it.isBlank()) LocalDate.now().year else if (it.length == 2) 2000 + it.toInt() else it.toInt() }
    return runCatching { LocalDate.of(y, m.groupValues[2].toInt(), m.groupValues[1].toInt()).toString() }.getOrNull()
}

// ---- Limits ---------------------------------------------------------------------------------

@Composable
private fun LimitsScreen(back: () -> Unit) {
    val ui = LocalUi.current
    val s = ui.store
    val context = LocalContext.current
    var budget by remember { mutableFloatStateOf(s.budgetMin.toFloat()) }
    var nightStart by remember { mutableStateOf(s.nightStart) }
    var nightEnd by remember { mutableStateOf(s.nightEnd) }
    var apps by remember { mutableStateOf<List<Catalog.AppEntry>>(emptyList()) }
    var confirmLock by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { apps = withContext(Dispatchers.IO) { Catalog.launchableApps(context) } }

    fun loosened(applied: Boolean) = ui.toast(if (applied) "Gespeichert" else "Lockerung beantragt — gilt in 24 Stunden")

    SpacedColumn {
        SubHeader("Limits", back)
        Section("Tageslimit Social Media & Games") {
            Text("${budget.toInt()} Minuten", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = budgetColor(0, 1))
            Slider(
                value = budget, onValueChange = { budget = it }, valueRange = 0f..180f, steps = 35,
                colors = SliderDefaults.colors(activeTickColor = Color.Transparent, inactiveTickColor = Color.Transparent, inactiveTrackColor = C.surface2),
            )
            Hint("Dein Ziel war höchstens 1 Stunde, eher weniger. Tipp: jede Woche um 5–10 Minuten runter.")
            Spacer(Modifier.height(8.dp))
            Button(onClick = {
                val v = budget.toInt()
                when {
                    v == s.budgetMin -> {}
                    v < s.budgetMin -> { s.budgetMin = v; ui.toast("Limit gesenkt — gilt sofort") }
                    else -> loosened(Engine.requestLoosening(s, "budget", "$v", "Limit auf $v Minuten erhöhen"))
                }
            }) { Text("Übernehmen") }
        }

        Section("Nachtzeit") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Abends erinnern & Abend-Bonus", color = C.text, modifier = Modifier.weight(1f))
                Switch(checked = s.nightEnabled, onCheckedChange = { on ->
                    if (on) s.nightEnabled = true
                    else loosened(Engine.requestLoosening(s, "night_enabled", "false", "Nachtzeit ausschalten"))
                })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(nightStart, { nightStart = it }, Modifier.weight(1f), label = { Text("ab") }, singleLine = true)
                OutlinedTextField(nightEnd, { nightEnd = it }, Modifier.weight(1f), label = { Text("bis") }, singleLine = true)
            }
            Spacer(Modifier.height(6.dp))
            OutlinedButton(onClick = {
                val a = Times.parse(nightStart, LocalTime.of(22, 30)).toString()
                val b = Times.parse(nightEnd, LocalTime.of(6, 30)).toString()
                loosened(Engine.requestLoosening(s, "night_window", "$a-$b", "Nachtzeit auf $a–$b ändern"))
            }) { Text("Zeiten speichern") }
            Hint("Läuft nachts eine Dopamin-App, kommt eine Erinnerung. Ein Abend ganz ohne gibt 15 XP.")
        }

        Section("Festschreiben") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Limits festschreiben", color = C.text)
                    Hint("Dann gilt jede Lockerung (höheres Limit, App entfernen, Nachtzeit aus) erst nach 24 Stunden. Verschärfen geht immer sofort.")
                }
                Switch(checked = s.limitsLocked, onCheckedChange = { on ->
                    if (on) confirmLock = true
                    else loosened(Engine.requestLoosening(s, "unlock_limits", "", "Festschreiben aufheben"))
                })
            }
        }

        Section("Welche Apps zählen zum Limit") {
            Hint("Vorausgewählt: bekannte Social-Media-, Video- und Spiele-Apps. WhatsApp, Claude & Co. zählen nicht.")
            Spacer(Modifier.height(6.dp))
            if (apps.isEmpty()) Hint("Lade Apps…")
            apps.forEach { a ->
                val on = a.pkg in s.dopaminePackages
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = on,
                        onCheckedChange = { add ->
                            if (add) s.dopaminePackages = s.dopaminePackages + a.pkg
                            else loosened(Engine.requestLoosening(s, "remove_app", a.pkg, "${a.label} nicht mehr zählen"))
                        },
                        color = C.warn,
                    )
                    Text(a.label, color = C.text, modifier = Modifier.weight(1f))
                    if (a.isGame) Text("Spiel", color = C.faint, fontSize = 11.sp)
                }
            }
        }
    }

    if (confirmLock) {
        AlertDialog(
            onDismissRequest = { confirmLock = false },
            title = { Text("Festschreiben?") },
            text = { Text("Danach kannst du Limits nur noch mit 24 Stunden Verzögerung lockern — auch das Aufheben dauert 24 Stunden.") },
            confirmButton = { TextButton(onClick = { s.limitsLocked = true; confirmLock = false }) { Text("Festschreiben") } },
            dismissButton = { TextButton(onClick = { confirmLock = false }) { Text("Abbrechen") } },
        )
    }
}

// ---- KI -------------------------------------------------------------------------------------

@Composable
private fun AiScreen(back: () -> Unit) {
    val ui = LocalUi.current
    val s = ui.store
    var url by remember { mutableStateOf(s.bridgeUrl) }
    var code by remember { mutableStateOf(s.bridgeCode) }
    var key by remember { mutableStateOf(s.apiKey) }
    var model by remember { mutableStateOf(s.model) }
    var testing by remember { mutableStateOf(false) }
    var showKey by remember { mutableStateOf(s.apiKey.isNotBlank()) }

    SpacedColumn {
        SubHeader("KI-Einstellungen", back)

        Section(tint = if (s.bridgeUrl.isNotBlank()) C.accent else null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Über dein Claude-Abo", color = C.text, fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 19.sp, modifier = Modifier.weight(1f))
                if (s.bridgeUrl.isNotBlank()) Pill("verbunden", C.accent)
            }
            Spacer(Modifier.height(6.dp))
            Hint(
                "Kein API-Key nötig: Die App schickt ihre Anfragen an ein kleines Programm auf deinem PC (die PC-Brücke), " +
                    "das sie an dein Claude Code weiterreicht. Abgerechnet wird über dein Abo."
            )
            Spacer(Modifier.height(12.dp))
            Text("So geht's", color = C.dim, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            Hint(
                "1. Am PC im Projektordner: node anker/pc/anker-bridge.mjs\n" +
                    "2. Das Fenster zeigt eine Adresse und einen Kopplungscode. Beides hier eintragen.\n" +
                    "3. Handy und PC müssen im selben WLAN sein. Für unterwegs: Tailscale auf beiden, dann die 100.x-Adresse nehmen."
            )
            Spacer(Modifier.height(10.dp))
            OutlinedTextField(url, { url = it.trim() }, Modifier.fillMaxWidth(), label = { Text("Adresse, z. B. 192.168.1.20:8787") }, singleLine = true)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(code, { code = it.uppercase() }, Modifier.fillMaxWidth(), label = { Text("Kopplungscode") }, singleLine = true)
            Spacer(Modifier.height(12.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(enabled = !testing && url.isNotBlank() && code.isNotBlank(), onClick = {
                    testing = true
                    ui.scope.launch {
                        val result = withContext(Dispatchers.IO) {
                            val u = Bridge.normalizeUrl(url)
                            if (!Bridge.health(u)) return@withContext "Unter dieser Adresse antwortet keine PC-Brücke. Läuft sie, und stimmt das WLAN?"
                            try {
                                Bridge.complete(u, code, "Antworte mit genau einem Wort.", "Sag: bereit", s.model)
                                null
                            } catch (e: Bridge.BridgeException) { e.message }
                        }
                        testing = false
                        if (result == null) {
                            s.bridgeUrl = Bridge.normalizeUrl(url); s.bridgeCode = Bridge.normalizeCode(code)
                            url = s.bridgeUrl
                            ui.toast("Verbunden. Der Planer läuft jetzt über dein Abo.")
                        } else ui.toast(result)
                    }
                }) { Text(if (testing) "Teste…" else "Verbinden & testen") }
                if (s.bridgeUrl.isNotBlank()) TextButton(onClick = { s.bridgeUrl = ""; s.bridgeCode = ""; url = ""; code = "" }) { Text("Trennen") }
            }
        }

        Section("Modell") {
            OutlinedTextField(model, { model = it.trim() }, Modifier.fillMaxWidth(), label = { Text("Modell") }, singleLine = true)
            Spacer(Modifier.height(8.dp))
            Hint("Standard: claude-opus-5-5. Schneller und sparsamer fürs Abo-Limit: claude-sonnet-5-5 oder claude-haiku-5-5.")
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { s.model = model.ifBlank { "claude-opus-5-5" }; ui.toast("Gespeichert") }) { Text("Speichern") }
        }

        Section("Ohne PC: API-Key") {
            Hint(
                "Falls der PC aus ist. Wird nur benutzt, wenn keine PC-Brücke verbunden ist. Kostet extra (grob 1–3 Cent pro Planung). " +
                    "Bei Max-Abos ist monatliches API-Guthaben enthalten, das du in der Claude Console einlösen kannst."
            )
            Spacer(Modifier.height(8.dp))
            if (!showKey) OutlinedButton(onClick = { showKey = true }) { Text("API-Key eintragen") }
            else {
                OutlinedTextField(
                    key, { key = it.trim() }, Modifier.fillMaxWidth(), label = { Text("sk-ant-…") },
                    singleLine = true, visualTransformation = PasswordVisualTransformation(),
                )
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = { s.apiKey = key; ui.toast("Gespeichert") }) { Text("Speichern") }
            }
        }

        Section("Gut zu wissen") {
            Hint(
                "• Das Diktieren selbst macht die Spracherkennung deines Handys. An Claude geht danach nur der Text.\n" +
                    "• An Claude geht nur, was du mit „In Aufgaben umwandeln“ oder „Tag planen“ abschickst, dazu offene Aufgaben, Klausuren, " +
                    "Stundenplan und „Über mich“. Keine Nutzungsdaten, nichts aus dem privaten Bereich.\n" +
                    "• Das Abo direkt in die App einzubauen erlaubt Anthropic nicht; die Anmeldung mit dem Abo ist den eigenen Programmen " +
                    "wie Claude Code vorbehalten. Die PC-Brücke nutzt genau dieses Claude Code auf deinem PC."
            )
        }
    }
}

// ---- Sicherung ------------------------------------------------------------------------------

@Composable
private fun BackupScreen(back: () -> Unit) {
    val ui = LocalUi.current
    val s = ui.store
    val context = LocalContext.current
    var confirmImport by remember { mutableStateOf<String?>(null) }
    val exporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) runCatching {
            context.contentResolver.openOutputStream(uri)!!.use { it.write(s.exportJson().toByteArray()) }
        }.onSuccess { ui.toast("Gesichert") }.onFailure { ui.toast("Sichern fehlgeschlagen") }
    }
    val importer = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) runCatching {
            context.contentResolver.openInputStream(uri)!!.use { it.readBytes().decodeToString() }
        }.onSuccess { confirmImport = it }.onFailure { ui.toast("Datei nicht lesbar") }
    }
    SpacedColumn {
        SubHeader("Sicherung", back)
        Section {
            Hint("Alles liegt nur auf diesem Handy. Vor einem Handywechsel oder einer Neuinstallation hier sichern. Die Datei enthält auch den API-Key und den privaten Bereich — gut aufbewahren.")
            Spacer(Modifier.height(10.dp))
            Button(onClick = { exporter.launch("anker-sicherung-${LocalDate.now()}.json") }) { Text("Exportieren") }
            Spacer(Modifier.height(6.dp))
            OutlinedButton(onClick = { importer.launch(arrayOf("application/json", "*/*")) }) { Text("Importieren") }
        }
    }
    confirmImport?.let { raw ->
        AlertDialog(
            onDismissRequest = { confirmImport = null },
            title = { Text("Importieren?") },
            text = { Text("Das ersetzt alle aktuellen Daten in der App.") },
            confirmButton = {
                TextButton(onClick = {
                    runCatching { s.importJson(raw) }
                        .onSuccess { ui.toast("Importiert") }.onFailure { ui.toast("Keine gültige Sicherung") }
                    confirmImport = null
                }) { Text("Ersetzen") }
            },
            dismissButton = { TextButton(onClick = { confirmImport = null }) { Text("Abbrechen") } },
        )
    }
}

@Suppress("unused")
private val settingsIcon = Icons.Filled.Settings
