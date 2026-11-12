package app.anker

import app.anker.ai.Bridge
import app.anker.update.Updater
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateAndBridgeTest {
    private val sha = "c959e1e0bb2e23f2709c05c765909efe51ad830c6b4963fcb9e2879f93878bf5"
    private val base = "https://github.com/legifx/bridge/releases/download/anker-latest/version.json"

    // ---- Update-Beschreibung ----

    @Test fun manifestWithRelativeApkResolvesNextToIt() {
        val r = Updater.parseManifest("""{"versionCode":7,"versionName":"1.6.0","sha256":"$sha","size":123,"apk":"anker.apk","notes":"Neu"}""", base)
        assertEquals(7, r.versionCode)
        assertEquals("1.6.0", r.versionName)
        assertEquals("https://github.com/legifx/bridge/releases/download/anker-latest/anker.apk", r.apkUrl)
        assertEquals("Neu", r.notes)
    }

    @Test fun manifestRejectsPlainHttpAndBadChecksum() {
        assertThrows(IllegalArgumentException::class.java) {
            Updater.parseManifest("""{"versionCode":7,"versionName":"x","sha256":"$sha","apk":"http://evil.example/a.apk"}""", base)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Updater.parseManifest("""{"versionCode":7,"versionName":"x","sha256":"abc","apk":"anker.apk"}""", base)
        }
        assertThrows(IllegalArgumentException::class.java) {
            Updater.parseManifest("""{"versionCode":7,"versionName":"x","sha256":"$sha","apk":"../../andere/datei.apk"}""", base)
        }
        assertThrows(Exception::class.java) { Updater.parseManifest("kein json", base) }
    }

    @Test fun onlyHigherVersionCodeCountsAsNewer() {
        val r = Updater.parseManifest("""{"versionCode":3,"versionName":"1.2.0","sha256":"$sha","apk":"anker.apk"}""", base)
        assertTrue(Updater.isNewer(r, 2))
        assertFalse(Updater.isNewer(r, 3))
        assertFalse(Updater.isNewer(r, 4))
    }

    // ---- Brücke ----

    @Test fun normalizesAddressesAndCodes() {
        assertEquals("http://192.168.1.20:8787", Bridge.normalizeUrl(" 192.168.1.20 "))
        assertEquals("http://192.168.1.20:9000", Bridge.normalizeUrl("192.168.1.20:9000/"))
        assertEquals("https://pc.tailnet.ts.net", Bridge.normalizeUrl("https://pc.tailnet.ts.net/"))
        assertEquals("", Bridge.normalizeUrl("  "))
        assertEquals("ABCDE23456", Bridge.normalizeCode("abcde-23456 "))
    }

    @Test fun extractsJsonFromChattyAnswers() {
        assertEquals("""{"a":1}""", Bridge.extractJson("""{"a":1}"""))
        assertEquals("""{"a":{"b":"}"}}""", Bridge.extractJson("Klar:\n```json\n{\"a\":{\"b\":\"}\"}}\n```\nFertig."))
        assertEquals("""{"t":"sag \"hi\" {x}"}""", Bridge.extractJson("""Antwort {"t":"sag \"hi\" {x}"} danke"""))
        assertNull(Bridge.extractJson("kein JSON hier"))
        assertNull(Bridge.extractJson("""{"offen": 1"""))
    }
}
