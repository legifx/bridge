package app.anker.ui

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.anker.LocalUi
import app.anker.data.Engine
import app.anker.filter.FilterService
import kotlinx.coroutines.delay
import java.time.LocalDate

/** Netzfilter: Inhalte filtern und Social-Media-Apps bei Limit / nachts vom Netz trennen. */
@Composable
fun FilterScreen(back: () -> Unit) {
    val ui = LocalUi.current
    val s = ui.store
    val context = LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { while (!TestMode) { delay(1500); tick++ } }
    @Suppress("UNUSED_EXPRESSION") tick
    val running = FilterService.running

    fun turnOn() {
        s.filterEnabled = true
        s.filterRevokedAt = 0L
        if (!FilterService.start(context)) ui.toast("Filter konnte nicht starten. Ist ein anderes VPN als „durchgehend aktiv“ eingestellt?")
    }
    val consent = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        if (r.resultCode == Activity.RESULT_OK) turnOn() else ui.toast("Ohne die Zustimmung kann der Filter nicht laufen.")
    }
    fun requestOn() {
        val intent = VpnService.prepare(context)
        if (intent != null) consent.launch(intent) else turnOn()
    }
    fun loosen(type: String, label: String, immediate: () -> Unit) {
        if (Engine.requestLoosening(s, type, "", label)) { immediate(); ui.toast("Gespeichert") }
        else ui.toast("Beantragt — gilt in 24 Stunden")
    }

    SpacedColumn {
        SubHeader("Netzfilter", back)

        Section(tint = if (running) C.accent else if (s.filterEnabled) C.bad else null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        when { running -> "Filter läuft"; s.filterEnabled -> "Filter ist getrennt"; else -> "Filter ist aus" },
                        color = when { running -> C.accent; s.filterEnabled -> C.bad; else -> C.text },
                        fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 20.sp,
                    )
                    val n = if (s.filterBlockedDay == LocalDate.now().toString()) s.filterBlockedCount else 0
                    Text(if (running) "Heute $n Anfragen blockiert" else "Nichts wird gefiltert", color = C.dim, fontSize = 13.sp)
                }
                Switch(checked = s.filterEnabled, onCheckedChange = { on ->
                    if (on) requestOn()
                    else loosen("filter_off", "Netzfilter ausschalten") { FilterService.stop(context) }
                })
            }
            if (s.filterEnabled && !running) {
                Spacer(Modifier.height(12.dp))
                Button(onClick = { requestOn() }) { Text("Wieder verbinden") }
            }
        }

        Section("Was der Filter macht") {
            Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f).padding(end = 12.dp)) {
                    Text("Inhaltsfilter", color = C.text, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    Text(
                        "Blockiert nicht jugendfreie Seiten und Schadsoftware im ganzen Handy, in jedem Browser, auch im privaten Fenster.",
                        color = C.dim, fontSize = 12.sp, lineHeight = 17.sp,
                    )
                }
                Pill(if (running) "aktiv" else "mit Filter", if (running) C.accent else C.faint)
            }
            Toggle(
                "Sichere Suche erzwingen", "Google, Bing und DuckDuckGo zeigen nur gefilterte Ergebnisse und Bilder.",
                checked = s.filterSafeSearch,
            ) { on -> if (on) s.filterSafeSearch = true else loosen("safe_search_off", "Sichere Suche ausschalten") {} }
            Toggle(
                "Netzsperre bei Limit", "Ist dein Tageslimit erreicht oder läuft eine Fokus-Session, laden die Apps aus deiner Limit-Liste nichts mehr.",
                checked = s.netBlockLimit,
            ) { on -> if (on) s.netBlockLimit = true else loosen("netblock_limit_off", "Netzsperre bei Limit ausschalten") {} }
            Toggle(
                "Netzsperre nachts", "Von ${s.nightStart} bis ${s.nightEnd} sind dieselben Apps vom Netz getrennt.",
                checked = s.netBlockNight,
            ) { on -> if (on) s.netBlockNight = true else loosen("netblock_night_off", "Netzsperre nachts ausschalten") {} }
            if (s.limitsLocked) Hint("Limits sind festgeschrieben: Ausschalten gilt erst nach 24 Stunden.")
        }

        Section("Damit er an bleibt") {
            Hint(
                "Android kann den Filter nach einem Neustart selbst wieder starten: Einstellungen → Netzwerk & Internet → VPN → Anker → " +
                    "„Durchgehend aktives VPN“ einschalten."
            )
            Spacer(Modifier.height(10.dp))
            OutlinedButton(onClick = {
                runCatching { context.startActivity(Intent(Settings.ACTION_VPN_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }) { Text("VPN-Einstellungen öffnen") }
        }

        Section("Ehrlich: die Grenzen") {
            Hint(
                "• Der Filter sieht nur Adressen, keine Inhalte. In Apps wie Reddit, X oder Telegram kann er einzelne Beiträge nicht unterscheiden. " +
                    "Dort hilft: in den App-Einstellungen Inhalte für Erwachsene ausschalten, oder die App per Netzsperre nachts ganz trennen.\n" +
                    "• Die Netzsperre trennt bekannte Social-Media- und Video-Apps. Spiele ohne Internet laufen weiter.\n" +
                    "• Du kannst den Filter in den Android-Einstellungen trennen. Die App verhindert das nicht, sie zeigt es dir nur an. " +
                    "Wenn du eine Sperre willst, die du nicht selbst aufheben kannst: Family Link mit einer Vertrauensperson (siehe Einrichtung).\n" +
                    "• Es läuft immer nur ein VPN gleichzeitig. Nutzt du ein anderes, ist dieser Filter so lange aus.\n" +
                    "• Durch den Filter laufen nur Namensanfragen (welche Adresse hat eine Seite). Dein Datenverkehr selbst geht nicht hindurch und wird nicht mitgelesen."
            )
        }
    }
}

@Composable
private fun Toggle(title: String, sub: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Text(title, color = C.text, fontSize = 15.sp, fontWeight = FontWeight.Medium)
            Text(sub, color = C.dim, fontSize = 12.sp, lineHeight = 17.sp)
        }
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
