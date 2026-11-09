package app.anker.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.NightsStay
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.WifiOff
import androidx.compose.material3.Icon
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.anker.Dash
import app.anker.LocalUi
import app.anker.data.Engine
import app.anker.filter.FilterService
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
    val over = dash.usedMin >= s.budgetMin
    val focus = Engine.focusActive(s)
    val night = Engine.nightActive(s)

    SpacedColumn {
        // ---- Kopf: Titel links, Level mit Fortschritt rechts ----
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                ScreenTitle("Heute", LocalDate.now().format(DateTimeFormatter.ofPattern("EEEE, d. MMMM", Locale.GERMAN)))
            }
            val lvl = Engine.level(s.xp)
            val floor = Engine.levelFloor(lvl); val ceil = Engine.levelCeil(lvl)
            Column(
                Modifier.clip(RoundedCornerShape(18.dp)).background(C.surface).border(1.dp, C.border, RoundedCornerShape(18.dp))
                    .clickable { ui.navigate("rewards") }.padding(horizontal = 14.dp, vertical = 10.dp).width(104.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Level $lvl", color = C.xp, fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.weight(1f))
                    Text("${s.coins} P", color = C.dim, fontSize = 12.sp)
                }
                Spacer(Modifier.height(6.dp))
                Bar((s.xp - floor) / (ceil - floor).toFloat(), C.xp, height = 5.dp)
            }
        }

        if (dash.ready && !dash.permission) {
            Section(tint = C.warn) {
                Text("Zeitmessung ist noch aus", color = C.warn, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Spacer(Modifier.height(4.dp))
                Hint("Ohne den Nutzungszugriff weiß die App nicht, wie lange du wo bist.")
                Spacer(Modifier.height(12.dp))
                Button(onClick = { ui.navigate("setup") }) { Text("Einrichten") }
            }
        }

        if (s.filterEnabled && !FilterService.running && s.filterRevokedAt > 0) {
            Section(tint = C.bad) {
                Text("Filter ist getrennt", color = C.bad, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Spacer(Modifier.height(4.dp))
                Hint("Der Netzfilter wurde in den Android-Einstellungen ausgeschaltet. Solange er aus ist, wird nichts gefiltert.")
                Spacer(Modifier.height(12.dp))
                Button(onClick = { ui.navigate("filter") }, color = C.bad) { Text("Wieder einschalten") }
            }
        }

        // ---- Hero: Ring ----
        val color = budgetColor(dash.usedMin, s.budgetMin)
        Section(tint = color) {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("SOCIAL MEDIA & GAMES", color = C.dim, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.3.sp)
                Spacer(Modifier.height(6.dp))
                Ring(progress = if (s.budgetMin > 0) dash.usedMin / s.budgetMin.toFloat() else 1f, color = color) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("${dash.usedMin}", fontFamily = Display, fontSize = 54.sp, fontWeight = FontWeight.Bold, color = C.text, letterSpacing = (-1.5).sp)
                        Text("von ${s.budgetMin} Min", color = C.dim, fontSize = 13.sp)
                    }
                }
                val left = (s.budgetMin - dash.usedMin).coerceAtLeast(0)
                Pill(if (over) "Limit erreicht" else "Noch $left Minuten für heute", color)
                Spacer(Modifier.height(16.dp))
                Row(Modifier.fillMaxWidth()) {
                    Stat(Times.minutesLabel(dash.totalMin), "Handy gesamt")
                    Stat("${Engine.budgetStreak(s)}", "Tage unter Limit", C.accent)
                    Stat(s.nightStart, if (night) "Nachtzeit aktiv" else "Nachtzeit ab", C.xp)
                }
            }
        }

        // ---- Status: was gerade wirkt ----
        val netBlocked = s.filterEnabled && FilterService.running &&
            ((s.netBlockNight && night) || (s.netBlockLimit && (over || focus)))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatusChip(
                Icons.Filled.Shield, if (s.filterEnabled && FilterService.running) "Filter an" else "Filter aus",
                if (s.filterEnabled && FilterService.running) C.accent else C.faint, Modifier.weight(1f),
            ) { ui.navigate("filter") }
            StatusChip(
                if (netBlocked) Icons.Filled.WifiOff else if (night) Icons.Filled.NightsStay else Icons.Filled.Bolt,
                when { netBlocked -> "Netzsperre aktiv"; night -> "Nachtzeit"; focus -> "Fokus läuft"; else -> "Alles offen" },
                when { netBlocked -> C.bad; night -> C.xp; focus -> C.accent; else -> C.faint }, Modifier.weight(1f),
            ) { ui.navigate("filter") }
        }

        FocusCard()
        NextUpCard()

        if (s.privateShowOnHome && s.streakStart > 0) {
            Section {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Klar-Tage", color = C.dim, modifier = Modifier.weight(1f))
                    Text("${Engine.streakDays(s)}", color = C.accent, fontFamily = Display, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // ---- Wartende Lockerungen ----
        val pending = s.pending
        if (pending.isNotEmpty()) {
            Section("Wartet auf 24 Stunden", tint = C.warn) {
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
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 6.dp)) {
                        Text(label, color = C.text, modifier = Modifier.width(104.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 14.sp)
                        Bar(min / max.toFloat(), if (counts) C.warn else C.accent2, Modifier.weight(1f))
                        Text(Times.minutesLabel(min), color = C.dim, fontSize = 12.sp, modifier = Modifier.padding(start = 10.dp).width(54.dp))
                    }
                }
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Dot(C.warn); Spacer(Modifier.width(6.dp)); Text("zählt zum Limit", color = C.dim, fontSize = 12.sp)
                    Spacer(Modifier.width(14.dp))
                    Dot(C.accent2); Spacer(Modifier.width(6.dp)); Text("zählt nicht", color = C.dim, fontSize = 12.sp)
                }
            }
        }
        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun StatusChip(icon: ImageVector, text: String, color: Color, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val shape = RoundedCornerShape(16.dp)
    Row(
        modifier.clip(shape).background(C.surface).border(1.dp, C.border, shape).clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = color, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Text(text, color = if (color == C.faint) C.dim else color, fontSize = 13.sp, fontWeight = FontWeight.Medium, maxLines = 1)
    }
}

/** "Agent arbeitet": Wartezeit am PC ohne Handy überbrücken. */
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
    Section("Agent arbeitet?", tint = if (active) C.accent else null) {
        if (!active) {
            Text("Fokus-Session starten", color = C.text, fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
            Spacer(Modifier.height(4.dp))
            Hint("Statt zum Handy zu greifen, während Claude arbeitet. Ohne Social Media gibt es doppelte Punkte.")
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(10, 20, 30, 60).forEach { m ->
                    val shape = RoundedCornerShape(16.dp)
                    Column(
                        Modifier.weight(1f).clip(shape).background(C.surface2).border(1.dp, C.border, shape)
                            .clickable { Engine.startFocus(s, m); now = System.currentTimeMillis() }.padding(vertical = 10.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text("$m", color = C.accent, fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 20.sp)
                        Text("Min", color = C.dim, fontSize = 11.sp)
                    }
                }
            }
        } else {
            val rest = (s.focusUntil - now) / 1000
            val total = ((s.focusUntil - s.focusStartedAt) / 1000).coerceAtLeast(1)
            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    "%d:%02d".format(rest / 60, rest % 60),
                    fontFamily = Display, fontSize = 44.sp, fontWeight = FontWeight.Bold, color = C.accent, letterSpacing = (-1).sp,
                )
                Spacer(Modifier.width(10.dp))
                Text("Handy weg.", color = C.dim, modifier = Modifier.padding(bottom = 10.dp))
            }
            Bar(1f - rest / total.toFloat(), C.accent, height = 6.dp)
            Spacer(Modifier.height(12.dp))
            Text("Während du wartest", color = C.dim, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            var checked by remember { mutableStateOf(setOf<Int>()) }
            s.agentWaitTasks.forEachIndexed { i, t ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = i in checked, onCheckedChange = { checked = if (it) checked + i else checked - i })
                    Text(
                        t, color = if (i in checked) C.faint else C.text, fontSize = 15.sp,
                        textDecoration = if (i in checked) TextDecoration.LineThrough else null,
                    )
                }
            }
            Spacer(Modifier.height(6.dp))
            OutlinedButton(onClick = {
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
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(C.surface2).padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("${current.start}–${current.end}", color = C.accent, fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                Spacer(Modifier.width(12.dp))
                Text(current.title, color = C.text, modifier = Modifier.weight(1f))
            }
            Spacer(Modifier.height(6.dp))
        }
        if (open.isEmpty() && current == null) {
            Hint("Nichts geplant. Geh auf „Plan“ und sprich einfach rein, was ansteht.")
        }
        open.take(3).forEach { t ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(
                    checked = false,
                    onCheckedChange = { Engine.completeTask(s, t.id, true); ui.toast("Erledigt: +${Engine.taskXp(t)} XP") },
                )
                Column(Modifier.weight(1f)) {
                    Text(t.title, color = C.text, fontSize = 15.sp)
                    Text("${t.estimateMin} Min" + (if (t.due.isNotBlank()) " · bis ${dueLabel(t.due)}" else ""), color = C.dim, fontSize = 12.sp)
                }
                Pill("P${t.priority}", prioColor(t.priority))
            }
        }
        if (open.size > 3) {
            Spacer(Modifier.height(4.dp))
            Text("+ ${open.size - 3} weitere im Plan", color = C.faint, fontSize = 12.sp)
        }
    }
}

fun prioColor(p: Int) = when (p) { 1 -> C.bad; 2 -> C.warn; else -> C.faint }

/** 2026-11-10 → "Di, 10.11." (heute/morgen ausgeschrieben). */
fun dueLabel(date: String): String {
    val d = runCatching { LocalDate.parse(date) }.getOrNull() ?: return date
    val today = LocalDate.now()
    return when (d) {
        today -> "heute"
        today.plusDays(1) -> "morgen"
        else -> d.format(DateTimeFormatter.ofPattern("EE, d.M.", Locale.GERMAN))
    }
}
