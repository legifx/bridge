package app.anker.check

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import app.anker.Notify
import app.anker.data.Engine
import app.anker.data.Store
import app.anker.usage.Usage
import java.time.LocalDate

/**
 * Schaut alle ~10 Minuten nach, wie viel Dopamin-Zeit heute schon verbraucht ist,
 * und sagt Bescheid: bei 50 %, 80 %, 100 % und danach alle 15 Minuten, solange du
 * weiter drueber bist. Nachts kommt ein Hinweis, sobald eine Dopamin-App laeuft.
 *
 * Bewusst ein ungenauer Wecker statt eines Dauerdienstes: kostet praktisch keinen Akku
 * und braucht keine Sonderrechte.
 */
class CheckReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        Thread {
            try {
                runCheck(context.applicationContext)
            } finally {
                schedule(context.applicationContext)
                pending.finish()
            }
        }.start()
    }

    companion object {
        private const val INTERVAL_MS = 10L * 60 * 1000

        fun schedule(context: Context) {
            val am = context.getSystemService(AlarmManager::class.java) ?: return
            val pi = PendingIntent.getBroadcast(
                context, 1, Intent(context, CheckReceiver::class.java),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
            )
            am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + INTERVAL_MS, pi)
        }

        fun runCheck(context: Context) {
            val s = Store.get(context)
            Engine.applyDuePending(s)
            app.anker.filter.FilterService.sync(context)
            if (!Usage.hasPermission(context)) return
            Engine.closePastDays(context, s)
            Engine.settleFocus(context, s)?.let { (min, xp, clean) ->
                Notify.show(
                    context, Notify.ID_FOCUS, "Fokus-Session vorbei",
                    if (clean) "$min Minuten ohne Ablenkung. +$xp XP" else "$min Minuten Fokus. +$xp XP (ohne Social Media gäbe es das Doppelte)",
                )
            }

            val used = Engine.usedMinutesToday(context, s)
            val budget = s.budgetMin.coerceAtLeast(1)
            val pct = used * 100 / budget
            val today = LocalDate.now().toString()
            if (s.warnedLevelDay != today) { s.warnedLevelDay = today; s.warnedLevel = 0 }
            val level = when { pct >= 100 -> 100; pct >= 80 -> 80; pct >= 50 -> 50; else -> 0 }
            val now = System.currentTimeMillis()
            if (level > s.warnedLevel) {
                s.warnedLevel = level
                val left = (s.budgetMin - used).coerceAtLeast(0)
                val (title, text) = when (level) {
                    50 -> "Halbzeit" to "$used von ${s.budgetMin} Minuten Social Media & Games sind weg. Noch $left Minuten für heute."
                    80 -> "Fast aufgebraucht" to "Noch $left Minuten. Jetzt wäre ein guter Moment, das Handy wegzulegen."
                    else -> "Limit erreicht" to "Deine ${s.budgetMin} Minuten für heute sind voll. Alles ab jetzt kostet dich die Punkte für heute."
                }
                Notify.show(context, Notify.ID_BUDGET, title, text)
                if (level == 100) s.lastOverWarn = now
            } else if (level == 100 && now - s.lastOverWarn > 15 * 60_000L && recentlyUsed(context, s)) {
                s.lastOverWarn = now
                Notify.show(context, Notify.ID_BUDGET, "Über dem Limit", "$used von ${s.budgetMin} Minuten. Leg es weg — du hast heute noch was vor.")
            }

            if (Engine.nightActive(s) && now - s.lastNightWarn > 20 * 60_000L && recentlyUsed(context, s)) {
                s.lastNightWarn = now
                Notify.show(
                    context, Notify.ID_SESSION, "Es ist spät",
                    "Nachtzeit seit ${s.nightStart}. Handy aus dem Bett, an die Ladestation ausserhalb des Zimmers.",
                )
            }
        }

        /** Lief in den letzten 10 Minuten mindestens eine Minute eine Dopamin-App? */
        private fun recentlyUsed(context: Context, s: Store): Boolean {
            val now = System.currentTimeMillis()
            val map = Usage.foregroundMillis(context, now - INTERVAL_MS, now)
            return map.filterKeys { it in s.dopaminePackages }.values.sum() >= 60_000L
        }
    }
}

/** Nach einem Neustart den Wecker wieder stellen. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            CheckReceiver.schedule(context.applicationContext)
            app.anker.filter.FilterService.sync(context.applicationContext)
        }
    }
}
