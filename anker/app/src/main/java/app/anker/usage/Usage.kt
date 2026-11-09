package app.anker.usage

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Process
import java.time.LocalDate
import java.time.ZoneId

/**
 * Bildschirmzeit pro App, aus den Nutzungsereignissen von Android berechnet.
 *
 * Die Ereignisse (App im Vordergrund / nicht mehr im Vordergrund) sind genauer als
 * die vorgefertigten Tageswerte von UsageStatsManager, die je nach Hersteller
 * merkwuerdig zusammengefasst werden.
 */
object Usage {

    fun hasPermission(context: Context): Boolean {
        val ops = context.getSystemService(AppOpsManager::class.java)
        @Suppress("DEPRECATION")
        val mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        return mode == AppOpsManager.MODE_ALLOWED
    }

    fun dayStart(date: LocalDate): Long = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()

    /** Vordergrundzeit pro Paket in Millisekunden im Intervall [from, to). */
    fun foregroundMillis(context: Context, from: Long, to: Long): Map<String, Long> {
        if (!hasPermission(context)) return emptyMap()
        val usm = context.getSystemService(UsageStatsManager::class.java) ?: return emptyMap()
        val events = usm.queryEvents(from, to)
        val open = HashMap<String, Long>()
        val seen = HashSet<String>()
        val total = HashMap<String, Long>()
        val e = UsageEvents.Event()
        fun add(pkg: String, ms: Long) { if (ms > 0) total[pkg] = (total[pkg] ?: 0L) + ms }
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            val pkg = e.packageName ?: continue
            val t = e.timeStamp
            when (e.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> {
                    if (open[pkg] == null) open[pkg] = t
                    seen.add(pkg)
                }
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED -> {
                    val start = open.remove(pkg)
                    if (start != null) add(pkg, t - start)
                    else if (pkg !in seen && e.eventType == UsageEvents.Event.ACTIVITY_PAUSED) add(pkg, t - from)
                    seen.add(pkg)
                }
                UsageEvents.Event.SCREEN_NON_INTERACTIVE, UsageEvents.Event.DEVICE_SHUTDOWN -> {
                    for ((p, start) in open) add(p, t - start)
                    open.clear()
                }
            }
        }
        val end = minOf(to, System.currentTimeMillis())
        // Nur die zuletzt geoeffnete App kann noch laufen; aeltere "offene" Eintraege
        // sind verlorene Pause-Ereignisse und wuerden sonst Stunden dazuerfinden.
        open.maxByOrNull { it.value }?.let { (p, start) -> add(p, end - start) }
        return total
    }

    fun todayMillis(context: Context): Map<String, Long> {
        val from = dayStart(LocalDate.now())
        return foregroundMillis(context, from, System.currentTimeMillis())
    }

    fun dayMillis(context: Context, date: LocalDate): Map<String, Long> =
        foregroundMillis(context, dayStart(date), dayStart(date.plusDays(1)))

    fun sumMinutes(map: Map<String, Long>, pkgs: Set<String>): Int =
        (map.filterKeys { it in pkgs }.values.sum() / 60000L).toInt()

    /** Gesamte Bildschirmzeit ohne Startbildschirm, Systemoberflaeche und diese App. */
    fun totalMinutes(map: Map<String, Long>, exclude: Set<String>): Int =
        (map.filterKeys { it !in exclude }.values.sum() / 60000L).toInt()
}
