package app.anker.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
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
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import app.anker.LocalUi
import app.anker.usage.Usage

@Composable
fun SetupScreen(back: () -> Unit) {
    val ui = LocalUi.current
    val s = ui.store
    val context = LocalContext.current
    var tick by remember { mutableIntStateOf(0) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { tick++ }

    @Suppress("UNUSED_EXPRESSION") tick
    val usage = Usage.hasPermission(context)
    val notif = Build.VERSION.SDK_INT < 33 ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
    val battery = context.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(context.packageName)
    val mic = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    fun open(intent: Intent) = runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
        .onFailure { open2(context) }

    SpacedColumn {
        SubHeader("Einrichtung", back)
        Section("1. Berechtigungen") {
            Step(usage, "Nutzungszugriff", "Damit die App sieht, wie lange du in welcher App bist. Pflicht.") {
                open(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
            }
            Step(notif, "Benachrichtigungen", "Für die Warnungen bei 50 / 80 / 100 % und nachts.") {
                open(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
            }
            Step(battery, "Akku-Optimierung aus", "Sonst verschluckt Android die Warnungen manchmal.") {
                @Suppress("BatteryLife")
                open(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}")))
            }
            Step(mic, "Mikrofon (optional)", "Zum Reinlabern. Wird beim ersten Tippen auf das Mikro gefragt.") {
                open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
            }
            if (!s.setupDone) {
                Spacer(Modifier.height(8.dp))
                Button(enabled = usage, onClick = { s.setupDone = true; back() }) { Text("Fertig") }
            }
        }

        Section("2. Apps wirklich sperren (empfohlen)") {
            Text("Diese App misst, erinnert und belohnt — sie sperrt nicht. Für eine harte Grenze, die du nicht einfach wegklicken kannst, nimm die eingebauten Werkzeuge:", color = C.text, fontSize = 14.sp)
            Spacer(Modifier.height(10.dp))
            Guide(
                "Google Family Link mit Vertrauensperson",
                "Die stärkste Variante. Eine Person, der du vertraust (Eltern, Geschwister, Freund), verwaltet dein Handy über Family Link. " +
                    "Dort: Social Media & Spiele zusammen max. 60 Min/Tag, nachts gesperrt, WhatsApp/Claude immer erlaubt. " +
                    "Brauchst du mal mehr (Video hochladen), fragst du die Person — sie kann dir Zeit freigeben. " +
                    "Das ist dein \"Freischalt-Prozess\" mit echtem Menschen statt Code.",
            )
            Guide(
                "Digital Wellbeing: App-Timer",
                "Einstellungen → Digital Wellbeing → Dashboard → App antippen → Timer. Ist das Limit erreicht, wird die App für den Rest des Tages grau. " +
                    "Lässt sich selbst wieder ändern — darum am besten zusammen mit Family Link.",
            )
            Guide(
                "Schlafenszeit-Modus",
                "Digital Wellbeing → Schlafenszeitmodus: ab z. B. 22:30 Graustufen und Nicht stören. Graues Display macht Scrollen spürbar langweiliger.",
            )
            Spacer(Modifier.height(4.dp))
            OutlinedButton(onClick = { open2(context) }) { Text("Digital Wellbeing öffnen") }
        }

        Section("3. Was nachweislich hilft") {
            Hint(
                "• Handy nachts ausserhalb des Schlafzimmers laden. Der wirksamste einzelne Schritt gegen Scrollen im Bett.\n" +
                    "• Apps vom Startbildschirm in einen Ordner auf Seite 3 schieben: jede Sekunde Reibung zählt.\n" +
                    "• Kurz innehalten vor dem Öffnen (\"Warum öffne ich das gerade?\") senkt das Öffnen deutlich (Studie zu \"one sec\", PNAS 2023).\n" +
                    "• Wenn-Dann-Pläne: \"Wenn der Agent arbeitet, dann starte ich eine Fokus-Session und mache eine Mikro-Aufgabe.\"\n" +
                    "• Graustufen-Display, Push-Benachrichtigungen von Social Media komplett aus.\n" +
                    "• Ersatz statt nur Verzicht: Was machst du stattdessen in den 3,5 Stunden?"
            )
        }
    }
}

@Composable
private fun Step(done: Boolean, title: String, sub: String, onClick: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 6.dp)) {
        Icon(
            if (done) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked, null,
            tint = if (done) C.accent else C.faint,
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = C.text)
            Text(sub, color = C.dim, fontSize = 12.sp)
        }
        if (!done) OutlinedButton(onClick = onClick) { Text("Öffnen") }
    }
}

@Composable
private fun Guide(title: String, text: String) {
    Text(title, color = C.accent, fontWeight = FontWeight.SemiBold)
    Text(text, color = C.dim, fontSize = 13.sp, lineHeight = 18.sp)
    Spacer(Modifier.height(10.dp))
}

private fun open2(context: android.content.Context) {
    val wellbeing = context.packageManager.getLaunchIntentForPackage("com.google.android.apps.wellbeing")
        ?: context.packageManager.getLaunchIntentForPackage("com.samsung.android.forest")
    runCatching {
        context.startActivity((wellbeing ?: Intent(Settings.ACTION_SETTINGS)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
