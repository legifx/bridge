package app.anker.update

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.os.Build
import app.anker.Notify
import app.anker.data.Store
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Selbst-Update: Die App fragt eine kleine Beschreibungsdatei (version.json) ab, die neben
 * der APK im eigenen GitHub-Repository liegt. Ist dort eine höhere Versionsnummer, wird die
 * APK geladen, ihre SHA-256-Prüfsumme mit der aus der Beschreibung verglichen und dann dem
 * Android-Paketinstaller übergeben.
 *
 * Zwei Sicherungen: die Prüfsumme (Datei ist vollständig und die erwartete) und Android
 * selbst, das ein Update nur annimmt, wenn es mit demselben Schlüssel signiert ist wie die
 * installierte App.
 */
object Updater {

    /** Wo die Beschreibung liegt. Erst der feste Release-Kanal, dann der Entwicklungszweig. */
    val MANIFEST_URLS = listOf(
        "https://github.com/legifx/bridge/releases/download/anker-latest/version.json",
        "https://raw.githubusercontent.com/legifx/bridge/claude/productivity-addiction-blocker-app-r5bbec/anker/release/version.json",
    )

    data class Release(
        val versionCode: Int,
        val versionName: String,
        val sha256: String,
        val size: Long,
        val apkUrl: String,
        val notes: String,
    )

    sealed class State {
        data object Idle : State()
        data class Downloading(val percent: Int) : State()
        data object Installing : State()
        data class Failed(val message: String) : State()
    }

    fun installedVersionCode(context: Context): Int {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        @Suppress("DEPRECATION")
        return if (Build.VERSION.SDK_INT >= 28) info.longVersionCode.toInt() else info.versionCode
    }

    fun installedVersionName(context: Context): String =
        context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "?"

    /** Liest eine Beschreibung. [baseUrl] dient dazu, einen relativen APK-Pfad aufzulösen. */
    fun parseManifest(json: String, baseUrl: String): Release {
        val o = JSONObject(json)
        val apk = o.getString("apk")
        val url = if (apk.contains("://")) {
            require(apk.startsWith("https://")) { "APK-Adresse muss https sein" }
            apk
        } else {
            // Relativ: nur ein schlichter Dateiname neben der Beschreibung, kein Pfad nach oben.
            require(Regex("^[A-Za-z0-9._-]+$").matches(apk) && !apk.contains("..")) { "APK-Name ungültig" }
            baseUrl.substringBeforeLast('/') + "/" + apk
        }
        require(url.startsWith("https://")) { "APK-Adresse muss https sein" }
        val sha = o.getString("sha256").lowercase()
        require(sha.length == 64 && sha.all { it in "0123456789abcdef" }) { "Prüfsumme ungültig" }
        return Release(o.getInt("versionCode"), o.getString("versionName"), sha, o.optLong("size", 0L), url, o.optString("notes", ""))
    }

    fun isNewer(release: Release, installedCode: Int) = release.versionCode > installedCode

    /** Fragt die Kanäle der Reihe nach ab und gibt die höchste gefundene Version zurück (oder null). */
    fun fetchLatest(): Release? =
        MANIFEST_URLS.mapNotNull { url ->
            runCatching { parseManifest(httpGet(url), url) }.getOrNull()
        }.maxByOrNull { it.versionCode }

    /** Prüft höchstens alle 6 Stunden; merkt sich das Ergebnis für den Hinweis in der App. */
    fun checkIfDue(context: Context, force: Boolean = false): Release? {
        val s = Store.get(context)
        val now = System.currentTimeMillis()
        if (!force && now - s.updateCheckedAt < 6 * 3600_000L) return cached(context)
        val latest = fetchLatest()
        s.updateCheckedAt = now
        if (latest != null) s.updateManifest = JSONObject()
            .put("versionCode", latest.versionCode).put("versionName", latest.versionName)
            .put("sha256", latest.sha256).put("size", latest.size).put("apk", latest.apkUrl).put("notes", latest.notes).toString()
        return cached(context)
    }

    /** Die zuletzt gefundene Version, falls sie neuer ist als die installierte. */
    fun cached(context: Context): Release? {
        val raw = Store.get(context).updateManifest
        if (raw.isBlank()) return null
        val r = runCatching { parseManifest(raw, "https://github.com/") }.getOrNull() ?: return null
        return r.takeIf { isNewer(it, installedVersionCode(context)) }
    }

    /** Im Hintergrund: einmal pro neuer Version eine Benachrichtigung zeigen. */
    fun notifyIfNew(context: Context) {
        val r = checkIfDue(context) ?: return
        val s = Store.get(context)
        if (s.updateNotifiedCode >= r.versionCode) return
        s.updateNotifiedCode = r.versionCode
        Notify.show(context, Notify.ID_UPDATE, "Anker ${r.versionName} ist da", "Tippe, um die neue Version zu installieren.")
    }

    /** Lädt die APK, prüft sie und übergibt sie dem Paketinstaller. Blockiert; nicht im UI-Thread aufrufen. */
    fun downloadAndInstall(context: Context, release: Release, onState: (State) -> Unit) {
        try {
            onState(State.Downloading(0))
            val dir = File(context.cacheDir, "update").apply { mkdirs() }
            val file = File(dir, "anker-${release.versionCode}.apk")
            val digest = MessageDigest.getInstance("SHA-256")
            val conn = open(release.apkUrl)
            try {
                val total = if (release.size > 0) release.size else conn.contentLengthLong
                var done = 0L
                var lastPct = -1
                conn.inputStream.use { input ->
                    file.outputStream().use { out ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            out.write(buf, 0, n)
                            digest.update(buf, 0, n)
                            done += n
                            val pct = if (total > 0) (done * 100 / total).toInt().coerceIn(0, 100) else 0
                            if (pct != lastPct) { lastPct = pct; onState(State.Downloading(pct)) }
                        }
                    }
                }
            } finally { conn.disconnect() }
            val sha = digest.digest().joinToString("") { "%02x".format(it) }
            if (sha != release.sha256) {
                file.delete()
                onState(State.Failed("Die geladene Datei passt nicht zur Prüfsumme. Nichts wurde installiert."))
                return
            }
            onState(State.Installing)
            install(context, file)
        } catch (e: Exception) {
            onState(State.Failed("Download fehlgeschlagen: ${e.message ?: e.javaClass.simpleName}"))
        }
    }

    private fun install(context: Context, apk: File) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
        params.setAppPackageName(context.packageName)
        params.setSize(apk.length())
        // Ab Android 12 darf eine App sich selbst ohne Rückfrage aktualisieren, sobald sie ihr
        // eigener Installer ist. Beim ersten Update fragt Android noch einmal nach.
        if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        val id = installer.createSession(params)
        installer.openSession(id).use { session ->
            session.openWrite("anker.apk", 0, apk.length()).use { out ->
                apk.inputStream().use { it.copyTo(out) }
                session.fsync(out)
            }
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
            val pi = PendingIntent.getBroadcast(context, id, Intent(context, UpdateReceiver::class.java), flags)
            session.commit(pi.intentSender)
        }
    }

    private fun open(url: String): HttpURLConnection {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15_000
        c.readTimeout = 30_000
        c.instanceFollowRedirects = true
        c.setRequestProperty("User-Agent", "Anker-Updater")
        if (c.responseCode !in 200..299) { val code = c.responseCode; c.disconnect(); error("HTTP $code") }
        return c
    }

    private fun httpGet(url: String): String {
        val c = open(url)
        try { return c.inputStream.use { it.readBytes().decodeToString() } } finally { c.disconnect() }
    }
}

/** Nimmt die Rückmeldung des Paketinstallers entgegen. */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                // Android will eine Bestätigung: den Dialog des Systems öffnen.
                @Suppress("DEPRECATION")
                val confirm = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java)
                else intent.getParcelableExtra(Intent.EXTRA_INTENT)
                if (confirm != null) runCatching { context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            }
            PackageInstaller.STATUS_SUCCESS -> Unit // die App wird dabei neu gestartet
            else -> {
                val msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE).orEmpty()
                Store.get(context).updateError = describe(status, msg)
            }
        }
    }

    private fun describe(status: Int, msg: String): String = when {
        status == PackageInstaller.STATUS_FAILURE_ABORTED -> "Installation abgebrochen."
        status == PackageInstaller.STATUS_FAILURE_CONFLICT || status == PackageInstaller.STATUS_FAILURE_INCOMPATIBLE ||
            msg.contains("signature", true) || msg.contains("UPDATE_INCOMPATIBLE", true) ->
            "Diese Version ist mit einem anderen Schlüssel signiert als die installierte. Sichere deine Daten (Mehr → Sicherung), deinstalliere die App, installiere die neue von Hand und importiere die Sicherung."
        status == PackageInstaller.STATUS_FAILURE_STORAGE -> "Zu wenig Speicherplatz für das Update."
        else -> "Installation fehlgeschlagen. $msg".trim()
    }
}
