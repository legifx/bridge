package app.anker.ui

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.anker.LocalUi
import app.anker.data.Engine
import app.anker.data.Relapse
import kotlinx.coroutines.delay

/** PIN-Abfrage vor dem privaten Bereich (falls eine PIN gesetzt ist). */
@Composable
fun PrivateGate(back: () -> Unit) {
    val s = LocalUi.current.store
    var unlocked by rememberSaveable { mutableStateOf(s.advancedPin.isBlank()) }
    var pin by remember { mutableStateOf("") }
    if (unlocked) { PrivateScreen(back); return }
    SpacedColumn {
        SubHeader("Privat", back)
        Section {
            OutlinedTextField(
                pin, { pin = it.filter(Char::isDigit).take(8) }, Modifier.fillMaxWidth(), label = { Text("PIN") },
                singleLine = true, visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
            )
            Spacer(Modifier.height(8.dp))
            Button(onClick = { if (pin == s.advancedPin) unlocked = true else pin = "" }) { Text("Öffnen") }
        }
    }
}

private val TRIGGERS = listOf("Im Bett", "Müde", "Gelangweilt", "Gestresst", "Allein", "Nach Social Media", "Nach Streit", "Spät wach")

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PrivateScreen(back: () -> Unit) {
    val ui = LocalUi.current
    val s = ui.store
    var urge by rememberSaveable { mutableStateOf(false) }
    var logging by remember { mutableStateOf(false) }
    var pinDialog by remember { mutableStateOf(false) }

    if (urge) { UrgeHelp { urge = false }; return }

    LaunchedEffect(Unit) { if (s.streakStart == 0L) s.streakStart = System.currentTimeMillis() }

    SpacedColumn {
        SubHeader("Privat", back)
        Section {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("${Engine.streakDays(s)}", fontSize = 56.sp, fontWeight = FontWeight.Bold, color = C.accent)
                Text("Klar-Tage", color = C.dim)
                if (s.bestStreakDays > 0) Text("Bester Lauf: ${s.bestStreakDays} Tage", color = C.faint, fontSize = 12.sp)
                Spacer(Modifier.height(10.dp))
                val next = listOf(1, 3, 7, 14, 30, 60, 90, 180, 365).firstOrNull { it > Engine.streakDays(s) }
                if (next != null) Text("Nächstes Ziel: $next " + (if (next == 1) "Tag" else "Tage"), color = C.xp, fontSize = 13.sp)
            }
        }

        Button(
            onClick = { urge = true }, modifier = Modifier.fillMaxWidth().height(56.dp),
            color = C.xp,
        ) { Text("Drang-Hilfe (10 Min)", fontSize = 17.sp) }

        Section("Ehrlich bleiben") {
            Hint("Ein Rückfall löscht nicht, was du gelernt hast. Eintragen hilft, Muster zu sehen: wann, wo, nach was.")
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { logging = true }) { Text("Rückfall eintragen") }
            val rel = s.relapses
            if (rel.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                val counts = rel.flatMap { it.trigger.split(", ").filter(String::isNotBlank) }.groupingBy { it }.eachCount()
                    .entries.sortedByDescending { it.value }.take(4)
                if (counts.isNotEmpty()) {
                    Text("Häufigste Auslöser", color = C.dim, fontSize = 12.sp)
                    counts.forEach { (t, n) -> Text("• $t ($n×)", color = C.text, fontSize = 14.sp) }
                }
                val hours = rel.map { java.time.Instant.ofEpochMilli(it.at).atZone(java.time.ZoneId.systemDefault()).hour }
                val late = hours.count { it >= 21 || it < 4 }
                Text("$late von ${rel.size} spätabends oder nachts", color = C.dim, fontSize = 12.sp)
            }
        }

        Section("Was dagegen wirkt") {
            Hint(
                "• Handy nachts nicht im Bett. Ladekabel in Flur oder Küche, ein normaler Wecker fürs Aufstehen. Das kappt genau deinen Hauptauslöser.\n" +
                    "• Filter ohne extra App: Einstellungen → Netzwerk → Privates DNS → family.cloudflare-dns.com. Blockt solche Seiten im ganzen Handy, auch im privaten Fenster. " +
                    "Damit du es nicht im schwachen Moment ausschaltest: von einer Vertrauensperson per Family Link sperren lassen.\n" +
                    "• Reddit: in den Einstellungen \"Inhalte für Erwachsene\" aus. Oder die App ganz löschen und nur am PC nutzen.\n" +
                    "• Der Drang ist eine Welle. Er steigt, erreicht einen Gipfel und fällt meist in 10–20 Minuten ab, wenn du nicht nachgibst (Urge Surfing).\n" +
                    "• Alles, was die Auslöser oben senkt, hilft: genug Schlaf, weniger Social Media am Abend, nicht allein im Zimmer rumhängen, wenn es kippt.\n" +
                    "• Wenn es dich stark belastet: Mit jemandem reden hilft wirklich, z. B. anonym bei der Nummer gegen Kummer (116 111) oder einer Suchtberatung."
            )
        }

        Section("Optionen") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Zähler auf Startseite zeigen", color = C.text, modifier = Modifier.weight(1f))
                Switch(checked = s.privateShowOnHome, onCheckedChange = { s.privateShowOnHome = it })
            }
            TextButton(onClick = { pinDialog = true }) { Text(if (s.advancedPin.isBlank()) "PIN festlegen" else "PIN ändern / entfernen") }
        }
    }

    if (logging) {
        var picked by remember { mutableStateOf(setOf<String>()) }
        AlertDialog(
            onDismissRequest = { logging = false },
            title = { Text("Was war los?") },
            text = {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    TRIGGERS.forEach { t ->
                        FilterChip(selected = t in picked, onClick = { picked = if (t in picked) picked - t else picked + t }, label = { Text(t) })
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val days = Engine.streakDays(s)
                    if (days > s.bestStreakDays) s.bestStreakDays = days
                    s.relapses = s.relapses + Relapse(System.currentTimeMillis(), picked.joinToString(", "))
                    s.streakStart = System.currentTimeMillis()
                    logging = false
                    ui.toast("Eingetragen. Neuer Anfang ab jetzt.")
                }) { Text("Eintragen") }
            },
            dismissButton = { TextButton(onClick = { logging = false }) { Text("Abbrechen") } },
        )
    }

    if (pinDialog) {
        var newPin by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { pinDialog = false },
            title = { Text("PIN") },
            text = {
                OutlinedTextField(
                    newPin, { newPin = it.filter(Char::isDigit).take(8) }, label = { Text("4–8 Ziffern, leer = keine PIN") },
                    singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    if (newPin.isEmpty() || newPin.length >= 4) { s.advancedPin = newPin; pinDialog = false }
                }) { Text("Speichern") }
            },
            dismissButton = { TextButton(onClick = { pinDialog = false }) { Text("Abbrechen") } },
        )
    }
}

/**
 * Zehn Minuten Drang-Hilfe in drei Phasen: aufstehen, atmen, die Welle beobachten.
 * Ziel ist nicht, den Drang wegzudruecken, sondern ihn vorbeiziehen zu lassen.
 */
@Composable
private fun UrgeHelp(done: () -> Unit) {
    val ui = LocalUi.current
    val total = 600
    var left by rememberSaveable { mutableIntStateOf(total) }
    LaunchedEffect(Unit) { while (left > 0 && !TestMode) { delay(1000); left-- } }
    val elapsed = total - left
    val phase = when {
        elapsed < 60 -> 0
        elapsed < 240 -> 1
        else -> 2
    }
    val breath = rememberInfiniteTransition(label = "atem")
    // 4 Sekunden ein, 6 Sekunden aus
    val scale by breath.animateFloat(
        0.6f, if (TestMode) 0.6f else 1f,
        infiniteRepeatable(tween(4000, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "atem",
    )

    SpacedColumn {
        SubHeader("Drang-Hilfe", done)
        Section {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("%d:%02d".format(left / 60, left % 60), fontSize = 44.sp, fontWeight = FontWeight.Bold, color = C.xp)
                Bar(elapsed / total.toFloat(), C.xp)
                Spacer(Modifier.height(16.dp))
                when (phase) {
                    0 -> {
                        Text("1. Raus aus der Situation", color = C.text, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                        Spacer(Modifier.height(8.dp))
                        Hint("Steh jetzt auf. Wenn du im Bett liegst: raus aus dem Bett, Licht an, Handy auf den Tisch legen und nur noch auf diesen Timer schauen. Ein Glas kaltes Wasser trinken.")
                    }
                    1 -> {
                        Text("2. Atmen", color = C.text, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                        Spacer(Modifier.height(16.dp))
                        Box(Modifier.size(150.dp), contentAlignment = Alignment.Center) {
                            Box(Modifier.size(150.dp).scale(scale).background(C.xp.copy(alpha = 0.35f), CircleShape))
                        }
                        Spacer(Modifier.height(12.dp))
                        Hint("Einatmen, während der Kreis wächst. Langsam ausatmen, während er schrumpft. Langes Ausatmen beruhigt den Körper messbar.")
                    }
                    else -> {
                        Text("3. Die Welle beobachten", color = C.text, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                        Spacer(Modifier.height(8.dp))
                        Hint(
                            "Wo im Körper spürst du den Drang? Wie stark ist er gerade, 1 bis 10? Du musst nichts damit machen — nur beobachten, wie er sich verändert. " +
                                "Er wird stärker und dann schwächer, wie eine Welle.\n\nDanach etwas Körperliches: 20 Liegestütze, kurz raus an die Luft, " +
                                "jemandem schreiben, Musik an. Und wenn es nachts ist: Handy aus dem Zimmer bringen."
                        )
                    }
                }
            }
        }
        if (left == 0) {
            Button(onClick = {
                Engine.addXp(ui.store, 25)
                ui.toast("Stark. Welle überstanden: +25 XP")
                done()
            }, modifier = Modifier.fillMaxWidth()) { Text("Geschafft") }
        } else {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Spacer(Modifier.width(0.dp))
                Text("Bleib bis der Timer abläuft.", color = C.faint, fontSize = 12.sp)
            }
        }
    }
}
