package app.anker

import android.graphics.Bitmap
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.ui.unit.dp
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithContentDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.anker.data.Store
import app.anker.data.Task
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.io.File

/**
 * Startet die echte App, klickt durch alle Bildschirme und speichert Screenshots.
 * Faengt Abstuerze beim Aufbau der Oberflaeche ab, die ein Compiler nicht sieht.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34], qualifiers = "w411dp-h891dp-xxhdpi")
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.NATIVE)
class ScreensTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private fun settle() {
        rule.waitForIdle()
    }

    private fun shot(name: String) {
        settle()
        val dir = File(System.getProperty("user.dir"), "build/screens").apply { mkdirs() }
        val view = rule.activity.window.decorView
        val bmp = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
        view.draw(android.graphics.Canvas(bmp))
        File(dir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private fun click(text: String) {
        settle()
        rule.onAllNodesWithText(text)[0].performClick()
        settle()
    }

    private fun tab(name: String) {
        settle()
        rule.onAllNodesWithContentDescription(name)[0].performClick()
        settle()
    }

    @Test fun walkThroughAllScreens() {
        val s = Store.get(rule.activity)
        s.setupDone = true
        s.tasks = listOf(
            Task(title = "Mathe S. 42 Nr. 3-5 rechnen", estimateMin = 30, priority = 1, due = "2026-11-10"),
            Task(title = "Bio-Referat Gliederung", estimateMin = 45, priority = 2),
            Task(title = "Video fuer Kanal schneiden", estimateMin = 60, priority = 3),
        )
        rule.waitForIdle()
        tab("Heute"); shot("1-heute")
        tab("Plan"); shot("2-plan")
        // Änderungen im Speicher müssen sofort auf dem Bildschirm ankommen.
        rule.onAllNodesWithText("AUFGABEN (3 OFFEN)")[0].assertExists()
        rule.onAllNodes(androidx.compose.ui.test.isToggleable())[0].performScrollTo().performClick()
        settle()
        rule.onAllNodesWithText("AUFGABEN (2 OFFEN)")[0].assertExists()
        tab("Statistik"); shot("3-statistik")
        tab("Mehr"); shot("4-mehr")
        click("Belohnungen"); shot("5-belohnungen")
        tab("Mehr")
        click("Schule & Profil"); shot("6-schule")
        tab("Mehr")
        click("Limits"); shot("7-limits")
        tab("Mehr")
        click("KI-Einstellungen"); shot("8-ki")
        tab("Mehr")
        click("Netzfilter"); shot("9-netzfilter")
        tab("Mehr")
        click("Einrichtung & harte Sperre"); shot("10-einrichtung")
        tab("Mehr")
        click("Sicherung")
        tab("Mehr")
        click("Privat"); shot("11-privat")
        click("Drang-Hilfe (10 Min)"); shot("12-drang")
        tab("Heute")
        click("20"); shot("13-fokus")
        rule.onAllNodesWithText("Fokus läuft")[0].assertExists()
    }

    /** Startseite und Statistik mit Beispieldaten, um Ring und Diagramme gefüllt zu sehen. */
    @Test fun screensWithSampleData() {
        val s = Store.get(rule.activity)
        s.setupDone = true
        s.xp = 740; s.coins = 520
        s.tasks = listOf(
            Task(title = "Mathe S. 42 Nr. 3-5 rechnen", estimateMin = 30, priority = 1, due = java.time.LocalDate.now().plusDays(1).toString()),
            Task(title = "Bio-Referat Gliederung", estimateMin = 45, priority = 2),
        )
        val today = java.time.LocalDate.now()
        s.days = listOf(95, 72, 48, 55, 31, 64).mapIndexed { i, m ->
            app.anker.data.DayRecord(today.minusDays((6 - i).toLong()).toString(), m, m * 3 + 40, 60, 40, i % 2 == 0)
        }
        val dash = Dash(
            ready = true, permission = true, usedMin = 47, totalMin = 164,
            apps = listOf(Triple("TikTok", 28, true), Triple("WhatsApp", 41, false), Triple("Instagram", 19, true), Triple("Claude", 52, false), Triple("Chrome", 24, false)),
        )
        fun show(name: String, content: @androidx.compose.runtime.Composable () -> Unit) {
            rule.activity.setContent {
                app.anker.ui.AnkerTheme {
                    val scope = androidx.compose.runtime.rememberCoroutineScope()
                    val ui = androidx.compose.runtime.remember {
                        Ui(s, androidx.compose.material3.SnackbarHostState(), scope, {}, {})
                    }
                    androidx.compose.runtime.CompositionLocalProvider(LocalUi provides ui) {
                        app.anker.ui.AppBackground {
                            androidx.compose.foundation.layout.Box(
                                androidx.compose.ui.Modifier.padding(horizontal = 18.dp, vertical = 14.dp).statusBarsPadding()
                            ) { content() }
                        }
                    }
                }
            }
            shot(name)
        }
        show("20-heute-daten") { app.anker.ui.HomeScreen(dash) }
        show("21-statistik-daten") { app.anker.ui.StatsScreen(dash) }
        show("22-heute-ueber-limit") { app.anker.ui.HomeScreen(dash.copy(usedMin = 71)) }
    }
}
