package app.anker.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.anker.Dash
import app.anker.LocalUi
import app.anker.data.Engine
import app.anker.util.Times
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

@Composable
fun StatsScreen(dash: Dash) {
    val s = LocalUi.current.store
    val byDate = s.days.associateBy { it.date }
    val days = (6 downTo 0).map { LocalDate.now().minusDays(it.toLong()) }
    val dop = days.map { d -> if (d == LocalDate.now()) dash.usedMin else byDate[d.toString()]?.dopamineMin ?: 0 }
    val total = days.map { d -> if (d == LocalDate.now()) dash.totalMin else byDate[d.toString()]?.totalMin ?: 0 }
    val labels = days.map { it.dayOfWeek.getDisplayName(TextStyle.SHORT, Locale.GERMAN).take(2) }
    val recorded = s.days.takeLast(7)

    SpacedColumn {
        Text("Statistik", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = C.text)

        Section("Social Media & Games, 7 Tage") {
            BarChart(dop, labels, s.budgetMin)
            Spacer(Modifier.height(8.dp))
            Hint("Gestrichelt: dein Limit (${s.budgetMin} Min). Rot: drüber.")
        }

        Section("Handy gesamt, 7 Tage") {
            BarChart(total, labels, limit = 120, highlightLast = true)
            Spacer(Modifier.height(8.dp))
            val avg = if (recorded.isNotEmpty()) recorded.sumOf { it.totalMin } / recorded.size else dash.totalMin
            Hint("Schnitt: ${Times.minutesLabel(avg)} pro Tag. Gestrichelt: 2 Stunden als Richtwert.")
        }

        Section("Fortschritt") {
            val lvl = Engine.level(s.xp)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                Stat("$lvl", "Level", C.xp)
                Stat("${s.xp}", "XP gesamt", C.xp)
                Stat("${Engine.budgetStreak(s)}", "Tage unter\nLimit", C.accent)
                Stat("${recorded.count { it.nightClean }}/${recorded.size}", "ruhige\nAbende", C.accent)
            }
            Spacer(Modifier.height(10.dp))
            val floor = Engine.levelFloor(lvl); val ceil = Engine.levelCeil(lvl)
            Bar((s.xp - floor) / (ceil - floor).toFloat(), C.xp)
            Text("${ceil - s.xp} XP bis Level ${lvl + 1}", color = C.dim, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp))
        }

        if (dash.apps.isNotEmpty()) {
            Section("Heute pro App") {
                dash.apps.take(15).forEach { (label, min, counts) ->
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 3.dp)) {
                        Dot(if (counts) C.warn else C.faint)
                        Spacer(Modifier.width(8.dp))
                        Text(label, color = C.text, modifier = Modifier.weight(1f), maxLines = 1)
                        Text(Times.minutesLabel(min), color = C.dim)
                    }
                }
            }
        }

        Section("So bekommst du Punkte") {
            Hint(
                "• Aufgabe erledigt: 10–40 XP je nach Dauer und Priorität\n" +
                    "• Tag unter Limit: 20 XP + 1 XP pro nicht genutzter Minute\n" +
                    "• Abend ohne Social Media ab Nachtzeit: 15 XP\n" +
                    "• Fokus-Session: 1 XP pro Minute, doppelt ohne Social Media\n" +
                    "Tage werden am nächsten Morgen abgerechnet. Punkte kannst du unter Mehr → Belohnungen einlösen."
            )
        }
        Spacer(Modifier.height(8.dp))
    }
}
