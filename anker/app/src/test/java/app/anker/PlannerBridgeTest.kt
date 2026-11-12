package app.anker

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import app.anker.ai.Bridge
import app.anker.ai.Planner
import app.anker.data.Store
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.io.File

/**
 * Durchgehend: der Planer der App → HTTP → die echte PC-Brücke (Node) → ein Stellvertreter
 * für `claude`. Prüft, dass App und Brücke dasselbe Protokoll sprechen. Wird übersprungen,
 * wenn Node nicht installiert ist.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [34])
class PlannerBridgeTest {
    private var proc: Process? = null
    private lateinit var code: String
    private val port = 18795
    private val url = "http://127.0.0.1:$port"

    @Before fun startBridge() {
        val pc = File(System.getProperty("user.dir")).resolve("../pc").canonicalFile
        val node = listOf("node", "/opt/node22/bin/node", "/usr/bin/node", "/usr/local/bin/node").firstOrNull {
            runCatching { ProcessBuilder(it, "--version").start().waitFor() == 0 }.getOrDefault(false)
        }
        assumeTrue("Node nicht gefunden", node != null)
        val config = File.createTempFile("anker-bridge", ".json").also { it.delete() }
        File(pc, "fake-claude.mjs").setExecutable(true)
        val pb = ProcessBuilder(node, File(pc, "anker-bridge.mjs").path).redirectErrorStream(true)
        pb.environment()["ANKER_PORT"] = port.toString()
        pb.environment()["ANKER_CONFIG"] = config.path
        pb.environment()["ANKER_CLAUDE_BIN"] = File(pc, "fake-claude.mjs").path
        proc = pb.start()
        val deadline = System.currentTimeMillis() + 10_000
        while (!Bridge.health(url)) {
            assertTrue("Brücke startet nicht", System.currentTimeMillis() < deadline)
            Thread.sleep(100)
        }
        code = JSONObject(config.readText()).getString("code")
    }

    @After fun stopBridge() { proc?.destroy() }

    private fun store(): Store = Store.get(ApplicationProvider.getApplicationContext()).also {
        it.bridgeUrl = url; it.bridgeCode = code; it.apiKey = ""
    }

    @Test fun plannerExtractsTasksThroughTheBridge() {
        val r = Planner(store()).extract("FAKE_TASKS Mathe und Video, Bio-Klausur am 1.12.")
        assertEquals(listOf("Mathe S. 42 rechnen", "Video {schneiden}"), r.tasks.map { it.title })
        assertEquals(1, r.tasks[0].priority)
        assertEquals(60, r.tasks[1].estimateMin)
        assertEquals("Bio", r.exams.single().subject)
        assertEquals("2026-12-01", r.exams.single().date)
        assertTrue(r.summary.isNotBlank())
    }

    @Test fun wrongCodeGivesAClearMessage() {
        val s = store().also { it.bridgeCode = "FALSCHFALS" }
        val e = assertThrows(Planner.PlannerException::class.java) { Planner(s).extract("FAKE_TASKS") }
        assertEquals("Kopplungscode stimmt nicht.", e.message)
    }

    @Test fun unreachablePcGivesAClearMessage() {
        val s = store().also { it.bridgeUrl = "http://127.0.0.1:1" }
        val e = assertThrows(Planner.PlannerException::class.java) { Planner(s).extract("FAKE_TASKS") }
        assertTrue(e.message!!.startsWith("PC nicht erreichbar"))
    }

    @Test fun answerWithoutJsonIsReportedNotSwallowed() {
        // Der Stellvertreter antwortet hier mit einem JSON, dem die verlangten Felder fehlen.
        val e = assertThrows(Planner.PlannerException::class.java) { Planner(store()).extract("irgendwas ohne Marker") }
        assertTrue(e.message!!.startsWith("Die Antwort war kein gültiges JSON"))
    }
}
