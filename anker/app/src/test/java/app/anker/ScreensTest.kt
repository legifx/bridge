package app.anker

import android.graphics.Bitmap
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.performClick
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

    @Test fun walkThroughAllScreens() {
        val s = Store.get(rule.activity)
        s.setupDone = true
        s.tasks = listOf(
            Task(title = "Mathe S. 42 Nr. 3-5 rechnen", estimateMin = 30, priority = 1, due = "2026-11-10"),
            Task(title = "Bio-Referat Gliederung", estimateMin = 45, priority = 2),
            Task(title = "Video fuer Kanal schneiden", estimateMin = 60, priority = 3),
        )
        rule.waitForIdle()
        click("Heute"); shot("1-heute")
        click("Plan"); shot("2-plan")
        click("Statistik"); shot("3-statistik")
        click("Mehr"); shot("4-mehr")
        click("Belohnungen"); shot("5-belohnungen")
        click("Mehr")
        click("Schule & Profil"); shot("6-schule")
        click("Mehr")
        click("Limits"); shot("7-limits")
        click("Mehr")
        click("KI-Einstellungen"); shot("8-ki")
        click("Mehr")
        click("Einrichtung & harte Sperre"); shot("9-einrichtung")
        click("Mehr")
        click("Sicherung")
        click("Mehr")
        click("Privat"); shot("10-privat")
        click("Drang-Hilfe (10 Min)"); shot("11-drang")
        click("Heute")
        click("20"); shot("12-fokus")
    }
}
