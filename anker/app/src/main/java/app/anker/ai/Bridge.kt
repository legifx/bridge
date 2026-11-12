package app.anker.ai

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Verbindung zur PC-Brücke (anker/pc/anker-bridge.mjs). Die Brücke reicht die Anfrage an das
 * Claude Code auf dem eigenen PC weiter, dadurch läuft sie über das Claude-Abo statt über
 * einen API-Key.
 */
object Bridge {

    class BridgeException(message: String) : Exception(message)

    /** "192.168.1.5:8787" → "http://192.168.1.5:8787"; ohne Port wird 8787 angenommen. */
    fun normalizeUrl(raw: String): String {
        var u = raw.trim().trimEnd('/')
        if (u.isEmpty()) return ""
        if (!u.startsWith("http://") && !u.startsWith("https://")) u = "http://$u"
        val hostPart = u.substringAfter("://")
        if (u.startsWith("http://") && !hostPart.contains(':')) u += ":8787"
        return u
    }

    fun normalizeCode(raw: String): String = raw.uppercase().filter { it.isLetterOrDigit() }

    /** Läuft unter der Adresse eine Anker-Brücke? */
    fun health(baseUrl: String): Boolean = runCatching {
        val c = URL(normalizeUrl(baseUrl) + "/health").openConnection() as HttpURLConnection
        c.connectTimeout = 5000; c.readTimeout = 5000
        try {
            c.responseCode == 200 && JSONObject(c.inputStream.use { it.readBytes().decodeToString() }).optString("name") == "anker-bridge"
        } finally { c.disconnect() }
    }.getOrDefault(false)

    fun complete(baseUrl: String, code: String, system: String, prompt: String, model: String): String {
        val url = normalizeUrl(baseUrl)
        if (url.isEmpty()) throw BridgeException("Keine Adresse für die PC-Brücke eingetragen.")
        val c = try {
            URL("$url/v1/complete").openConnection() as HttpURLConnection
        } catch (e: Exception) { throw BridgeException("Die Adresse der PC-Brücke ist ungültig.") }
        try {
            c.requestMethod = "POST"
            c.connectTimeout = 8000
            c.readTimeout = 200_000
            c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            c.setRequestProperty("Authorization", "Bearer ${normalizeCode(code)}")
            val body = JSONObject().put("system", system).put("prompt", prompt).put("model", model).toString()
            c.outputStream.use { it.write(body.toByteArray()) }
            val status = c.responseCode
            val text = (if (status in 200..299) c.inputStream else c.errorStream)?.use { it.readBytes().decodeToString() }.orEmpty()
            val json = runCatching { JSONObject(text) }.getOrNull()
            if (status == 200 && json != null) return json.getString("text")
            throw BridgeException(
                when (status) {
                    401 -> "Kopplungscode stimmt nicht."
                    429 -> "Zu viele Fehlversuche. Die Brücke sperrt 10 Minuten."
                    else -> json?.optString("error")?.takeIf { it.isNotBlank() } ?: "Die PC-Brücke meldet Fehler $status."
                }
            )
        } catch (e: BridgeException) {
            throw e
        } catch (e: java.net.SocketTimeoutException) {
            throw BridgeException("Die PC-Brücke antwortet nicht rechtzeitig.")
        } catch (e: java.io.IOException) {
            throw BridgeException("PC nicht erreichbar. Läuft die Brücke, und bist du im selben WLAN oder im Tailscale-Netz?")
        } finally { c.disconnect() }
    }

    /**
     * Holt das JSON-Objekt aus einer Textantwort: von der ersten öffnenden bis zur passenden
     * schließenden Klammer. Verträgt Code-Zäune und einen Satz davor oder danach.
     */
    fun extractJson(text: String): String? {
        val start = text.indexOf('{')
        if (start < 0) return null
        var depth = 0
        var inString = false
        var escaped = false
        for (i in start until text.length) {
            val ch = text[i]
            if (inString) {
                if (escaped) escaped = false
                else if (ch == '\\') escaped = true
                else if (ch == '"') inString = false
                continue
            }
            when (ch) {
                '"' -> inString = true
                '{' -> depth++
                '}' -> { depth--; if (depth == 0) return text.substring(start, i + 1) }
            }
        }
        return null
    }
}
