package app.anker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.anker.Dash
import app.anker.LocalUi
import app.anker.data.Engine
import app.anker.util.Times
import kotlinx.coroutines.delay
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun HomeScreen(dash: Dash) {
    val ui = LocalUi.current
    val s = ui.store
    val context = LocalContext.current

    SpacedColumn {
        // ---- Kopf ----
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Heute", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = C.text)
                Text(LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, d. MMMM", Locale.GERMAN)), color = C.dim)
            }
            val lvl = Engine.level(s.xp)
            AssistChip(
                onClick = { ui.navigate("rewards") },
                label = { Text("Level $lvl · ${s.coins} Punkte") },
                colors = AssistChipDefaults.assistChipColors(labelColor = C.xp),
            )
        }

        if (dash.ready && !dash.permission) {
            Section {
                Text("Zeitmessung ist noch aus", color = C.warn, fontWeight = FontWeight.SemiBold)
                Hint("Ohne den Nutzungszugriff weiss die App nicht, wie lange du wo bist.")
                Spacer(Modifier.height(8.dp))
                Button(onClick = { ui.navigate("setup") }) { Text("Einrichten") }
            }
        }

        // ---- Budget-Ring ----
        Section {
            val left = (s.budgetMin - dash.usedMin).coerceAtLeast(0)
            val color = budgetColor(dash.usedMin, s.budgetMin)
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Ring(progress = if (s.budgetMin > 0) dash.usedMin / s.budgetMin.toFloat() else 1f, color = color) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("${dash.usedMin}", fontSize = 40.sp, fontWeight = FontWeight.Bold, color = color)
                        Text("von ${s.budgetMin} Min", color = C.dim, fontSize = 13.sp)
                    }
                }
                Text("Social Media & Games", color = C.text, fontWeight = FontWeight.SemiBold)
                Text(
                    if (dash.usedMin >= s.budgetMin) "Limit erreicht. Ab hier verlierst du die Tagespunkte."
                    else "Noch $left Minuten für heute",
                    color = if (dash.usedMin >= s.budgetMin) C.bad else C.dim, fontSize = 13.sp,
                )
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    Stat(Times.minutesLabel(dash.totalMin), "Handy gesamt")
                    Stat("${Engine.budgetStreak(s)}", "Tage unter\nLimit", C.accent)
                    Stat(s.nightStart, if (Engine.nightActive(s)) "Nachtzeit\naktiv" else "Nachtzeit\nab", C.xp)
                }
            }
        }

        FocusCard()

        // ---- Als Naechstes ----
        NextUpCard()

        if (s.privateShowOnHome && s.streakStart > 0) {
            Section {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Klar-Tage", color = C.dim, modifier = Modifier.weight(1f))
                    Text("${Engine.streakDays(s)}", color = C.accent, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // ---- Wartende Lockerungen ----
        val pending = s.pending
        if (pending.isNotEmpty()) {
            Section("Wartet auf 24 Stunden") {
                pending.forEach { p ->
                    val h = ((p.applyAt - System.currentTimeMillis()) / 3_600_000L).coerceAtLeast(0)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(p.label, color = C.text)
                            Text("gilt in ca. $h h", color = C.dim, fontSize = 12.sp)
                        }
                        TextButton(onClick = { Engine.cancelPending(s, p.id) }) { Text("Verwerfen") }
                    }
                }
            }
        }

        // ---- Top-Apps heute ----
        if (dash.apps.isNotEmpty()) {
            Section("Heute am meisten") {
                val max = dash.apps.first().second.coerceAtLeast(1)
                dash.apps.take(5).forEach { (label, min, counts) ->
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                        Text(label, color = C.text, modifier = Modifier.width(110.dp), maxLines = 1)
                        Bar(min / max.toFloat(), if (counts) C.warn else C.accent.copy(alpha = 0.6f), Modifier.weight(1f))
                        Text(Times.minutesLabel(min), color = C.dim, fontSize = 12.sp, modifier = Modifier.padding(start = 8.dp).width(56.dp))
                    }
                }
                Hint("Orange = zählt zu deinem Limit")
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

/** "Agent arbeitet": Wartezeit am PC ohne Handy ueberbruecken. */
@Composable
private fun FocusCard() {
    val ui = LocalUi.current
    val s = ui.store
    val context = LocalContext.current
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
    val active = s.focusUntil > now && s.focusStartedAt > 0
    LaunchedEffect(active) {
        while (active && !TestMode) { delay(1000); now = System.currentTimeMillis() }
    }
    LaunchedEffect(s.focusUntil, now) {
        if (s.focusStartedAt > 0 && s.focusUntil <= now) {
            Engine.settleFocus(context, s)?.let { (m, xp, clean) ->
                ui.toast(if (clean) "$m Min Fokus ohne Ablenkung: +$xp XP" else "$m Min Fokus: +$xp XP")
            }
        }
    }
    Section("Agent arbeitet?") {
        if (!active) {
            Hint("Statt zum Handy zu greifen, während Claude arbeitet: starte eine Fokus-Session. Bleibst du dabei von Social Media weg, gibt's doppelte Punkte.")
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(10, 20, 30, 60).forEach { m ->
                    OutlinedButton(onClick = { Engine.startFocus(s, m); now = System.currentTimeMillis() }) { Text("$m") }
                }
            }
            Text("Minuten", color = C.faint, fontSize = 11.sp)
        } else {
            val rest = (s.focusUntil - now) / 1000
            Text(
                "%d:%02d".format(rest / 60, rest % 60),
                fontSize = 36.sp, fontWeight = FontWeight.Bold, color = C.accent,
            )
            Text("Handy weg. Während du wartest:", color = C.dim)
            Spacer(Modifier.height(6.dp))
            var checked by remember { mutableStateOf(setOf<Int>()) }
            s.agentWaitTasks.forEachIndexed { i, t ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(
                        checked = i in checked, onCheckedChange = { checked = if (it) checked + i else checked - i },
                        colors = CheckboxDefaults.colors(checkedColor = C.accent),
                    )
                    Text(t, color = if (i in checked) C.faint else C.text,
                        textDecoration = if (i in checked) TextDecoration.LineThrough else null)
                }
            }
            TextButton(onClick = {
                Engine.settleFocus(context, s, stopNow = true)?.let { (m, xp, _) -> ui.toast("$m Min Fokus: +$xp XP") }
            }) { Text("Beenden") }
        }
    }
}

@Composable
private fun NextUpCard() {
    val ui = LocalUi.current
    val s = ui.store
    val nowStr = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm"))
    val plan = if (s.lastPlanDate == LocalDate.now().toString()) s.plan else emptyList()
    val current = plan.firstOrNull { !it.done && it.end > nowStr }
    val open = s.tasks.filter { !it.done }.sortedWith(compareBy({ it.priority }, { it.due.ifBlank { "9999" } }))

    Section("Als Nächstes") {
        if (current != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("${current.start}–${current.end}", color = C.accent, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.width(10.dp))
                Text(current.title, color = C.text, modifier = Modifier.weight(1f))
            }
            Spacer(Modifier.height(6.dp))
        }
        if (open.isEmpty() && current == null) {
            Hint("Nichts geplant. Geh auf \"Plan\" und sprich einfach rein, was ansteht.")
        }
        open.take(3).forEach { t ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = false,
                    onCheckedChange = { Engine.completeTask(s, t.id, true); ui.toast("Erledigt: +${Engine.taskXp(t)} XP") },
                    colors = CheckboxDefaults.colors(checkedColor = C.accent),
                )
                Column(Modifier.weight(1f)) {
                    Text(t.title, color = C.text)
                    Text("${t.estimateMin} Min" + (if (t.due.isNotBlank()) " · bis ${t.due}" else ""), color = C.dim, fontSize = 12.sp)
                }
                Dot(prioColor(t.priority))
            }
        }
        if (open.size > 3) Text("+ ${open.size - 3} weitere im Plan", color = C.faint, fontSize = 12.sp)
    }
}

fun prioColor(p: Int) = when (p) { 1 -> C.bad; 2 -> C.warn; else -> C.faint }
