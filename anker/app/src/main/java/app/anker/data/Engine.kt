package app.anker.data

import android.content.Context
import app.anker.usage.Usage
import app.anker.util.Catalog
import app.anker.util.Times
import java.time.LocalDate
import java.time.LocalTime
import kotlin.math.max

/**
 * Alles, was Oberflaeche und Hintergrund-Check gemeinsam brauchen: verbrauchte
 * Minuten, verzoegerte Lockerungen, Tagesabschluss und Punkte.
 */
object Engine {

    const val LOOSEN_DELAY_MS = 24L * 60 * 60 * 1000

    // ---- Minuten ---------------------------------------------------------------------

    fun usedMinutesToday(context: Context, s: Store, today: Map<String, Long> = Usage.todayMillis(context)): Int =
        Usage.sumMinutes(today, s.dopaminePackages)

    fun nightStart(s: Store): LocalTime = Times.parse(s.nightStart, LocalTime.of(22, 30))
    fun nightEnd(s: Store): LocalTime = Times.parse(s.nightEnd, LocalTime.of(6, 30))

    fun nightActive(s: Store, now: LocalTime = LocalTime.now()): Boolean =
        s.nightEnabled && Times.inWindow(now, nightStart(s), nightEnd(s))

    fun focusActive(s: Store) = s.focusUntil > System.currentTimeMillis()

    fun excludedFromTotal(context: Context): Set<String> =
        Catalog.launcherPackages(context) + setOf(context.packageName, "com.android.systemui")

    // ---- Lockerungen mit Wartezeit -------------------------------------------------------

    /**
     * Verschaerfungen gelten sofort. Lockerungen laufen ueber diese Funktion: solange die
     * Limits nicht festgeschrieben sind sofort, danach erst nach 24 Stunden. Das ist ein
     * "Odysseus-Vertrag": Die Entscheidung triffst du mit klarem Kopf, nicht im Moment,
     * in dem du gerade mehr willst. Gibt true zurueck, wenn die Aenderung sofort galt.
     */
    fun requestLoosening(s: Store, type: String, value: String, label: String): Boolean {
        if (!s.limitsLocked) { apply(s, type, value); return true }
        s.pending = s.pending.filterNot { it.type == type } +
            Pending(type = type, value = value, applyAt = System.currentTimeMillis() + LOOSEN_DELAY_MS, label = label)
        return false
    }

    fun cancelPending(s: Store, id: String) { s.pending = s.pending.filterNot { it.id == id } }

    fun applyDuePending(s: Store) {
        val now = System.currentTimeMillis()
        val due = s.pending.filter { it.applyAt <= now }
        if (due.isEmpty()) return
        due.forEach { apply(s, it.type, it.value) }
        s.pending = s.pending.filter { it.applyAt > now }
    }

    private fun apply(s: Store, type: String, value: String) {
        when (type) {
            "budget" -> value.toIntOrNull()?.let { s.budgetMin = it.coerceIn(0, 240) }
            "remove_app" -> s.dopaminePackages = s.dopaminePackages - value
            "night_enabled" -> s.nightEnabled = value == "true"
            "night_window" -> value.split("-").takeIf { it.size == 2 }?.let { s.nightStart = it[0]; s.nightEnd = it[1] }
            "unlock_limits" -> s.limitsLocked = false
            "filter_off" -> s.filterEnabled = false
            "safe_search_off" -> s.filterSafeSearch = false
            "netblock_limit_off" -> s.netBlockLimit = false
            "netblock_night_off" -> s.netBlockNight = false
        }
    }

    // ---- Punkte ----------------------------------------------------------------------------

    fun addXp(s: Store, amount: Int) {
        if (amount <= 0) return
        s.xp = s.xp + amount
        s.coins = s.coins + amount
    }

    /** Level n beginnt bei 50 * n * (n - 1) XP: 0, 100, 300, 600, 1000, ... */
    fun level(xp: Int): Int {
        var n = 1
        while (50 * (n + 1) * n <= xp) n++
        return n
    }
    fun levelFloor(level: Int) = 50 * level * (level - 1)
    fun levelCeil(level: Int) = 50 * (level + 1) * level

    fun taskXp(t: Task): Int = 10 + (t.estimateMin / 10) * 2 + (3 - t.priority.coerceIn(1, 3)) * 5

    fun completeTask(s: Store, id: String, done: Boolean) {
        val t = s.tasks.find { it.id == id } ?: return
        if (t.done == done) return
        s.tasks = s.tasks.map { if (it.id == id) it.copy(done = done, doneAt = if (done) System.currentTimeMillis() else 0L) else it }
        val xp = taskXp(t)
        if (done) addXp(s, xp) else { s.xp = max(0, s.xp - xp); s.coins = max(0, s.coins - xp) }
        s.plan = s.plan.map { if (it.taskId == id) it.copy(done = done) else it }
    }

    // ---- Fokus (Agent arbeitet) ---------------------------------------------------------------

    fun startFocus(s: Store, minutes: Int) {
        val now = System.currentTimeMillis()
        s.focusStartedAt = now
        s.focusUntil = now + minutes * 60_000L
    }

    /**
     * Rechnet eine Fokus-Session ab: 1 XP pro Minute, und das Doppelte, wenn in der Zeit
     * keine Dopamin-App benutzt wurde. Gibt (Minuten, XP, sauber) zurueck oder null.
     */
    fun settleFocus(context: Context, s: Store, stopNow: Boolean = false): Triple<Int, Int, Boolean>? {
        if (s.focusStartedAt == 0L) return null
        val now = System.currentTimeMillis()
        if (!stopNow && s.focusUntil > now) return null
        val end = minOf(now, s.focusUntil)
        val minutes = ((end - s.focusStartedAt) / 60_000L).toInt()
        val used = Usage.sumMinutes(Usage.foregroundMillis(context, s.focusStartedAt, end), s.dopaminePackages)
        val clean = used == 0
        val xp = if (clean) minutes * 2 else minutes
        addXp(s, xp)
        s.focusStartedAt = 0L
        if (stopNow) s.focusUntil = 0L
        return Triple(minutes, xp, clean)
    }

    // ---- Tagesabschluss ------------------------------------------------------------------

    /**
     * Schliesst alle vergangenen, noch offenen Tage ab (hoechstens 14): Minuten unter dem
     * Budget werden zu Punkten, ein Abend ohne Dopamin-Apps im Nachtfenster gibt einen Bonus.
     */
    fun closePastDays(context: Context, s: Store) {
        val today = LocalDate.now()
        val last = runCatching { LocalDate.parse(s.lastClosedDay) }.getOrNull()
        if (last == null) { s.lastClosedDay = today.minusDays(1).toString(); return }
        var d = last.plusDays(1)
        if (d.isBefore(today.minusDays(14))) d = today.minusDays(14)
        if (!d.isBefore(today)) return
        val exclude = excludedFromTotal(context)
        val records = s.days.toMutableList()
        while (d.isBefore(today)) {
            val map = Usage.dayMillis(context, d)
            val dop = Usage.sumMinutes(map, s.dopaminePackages)
            val total = Usage.totalMinutes(map, exclude)
            val nightClean = nightMinutes(context, s, d) < 2
            var xp = 0
            if (map.isNotEmpty() && dop <= s.budgetMin) xp += 20 + (s.budgetMin - dop)
            if (s.nightEnabled && nightClean) xp += 15
            records.removeAll { it.date == d.toString() }
            records += DayRecord(d.toString(), dop, total, s.budgetMin, xp, nightClean)
            addXp(s, xp)
            d = d.plusDays(1)
        }
        s.days = records.sortedBy { it.date }
        s.lastClosedDay = today.minusDays(1).toString()
    }

    /** Dopamin-Minuten am Abend von [d] ab Beginn des Nachtfensters bis Mitternacht. */
    fun nightMinutes(context: Context, s: Store, d: LocalDate): Int {
        val start = nightStart(s)
        if (start < LocalTime.NOON) return 0 // Fenster beginnt erst nach Mitternacht
        val from = Usage.dayStart(d) + start.toSecondOfDay() * 1000L
        val to = Usage.dayStart(d.plusDays(1))
        return Usage.sumMinutes(Usage.foregroundMillis(context, from, to), s.dopaminePackages)
    }

    /** Aufeinanderfolgende Tage unter Budget, bis gestern. */
    fun budgetStreak(s: Store): Int {
        val byDate = s.days.associateBy { it.date }
        var d = LocalDate.now().minusDays(1)
        var n = 0
        while (true) {
            val r = byDate[d.toString()] ?: break
            if (!r.underBudget) break
            n++; d = d.minusDays(1)
        }
        return n
    }

    fun streakDays(s: Store): Int {
        if (s.streakStart == 0L) return 0
        return ((System.currentTimeMillis() - s.streakStart) / (24L * 60 * 60 * 1000)).toInt()
    }
}
