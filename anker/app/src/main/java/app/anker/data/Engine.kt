package app.anker.data

import android.content.Context
import app.anker.guard.Catalog
import app.anker.guard.Policy
import app.anker.usage.Usage
import java.time.LocalDate
import java.time.LocalTime
import kotlin.math.max

/**
 * Alles, was Waechter und Oberflaeche gemeinsam brauchen: verbrauchte Minuten,
 * verzoegerte Lockerungen, Tagesabschluss und Punkte.
 */
object Engine {

    const val LOOSEN_DELAY_MS = 24L * 60 * 60 * 1000
    const val UNLOCK_WAIT_MS = 10L * 60 * 1000
    const val UNLOCK_WAIT_NIGHT_MS = 20L * 60 * 1000

    // ---- Minuten ---------------------------------------------------------------------

    fun webSecondsToday(s: Store): Int =
        if (s.webDopamineDay == LocalDate.now().toString()) s.webDopamineSeconds else 0

    fun addWebSeconds(s: Store, seconds: Int) {
        val today = LocalDate.now().toString()
        if (s.webDopamineDay != today) { s.webDopamineDay = today; s.webDopamineSeconds = 0 }
        s.webDopamineSeconds = s.webDopamineSeconds + seconds
    }

    fun usedMinutesToday(context: Context, s: Store, today: Map<String, Long> = Usage.todayMillis(context)): Int =
        Usage.sumMinutes(today, s.dopaminePackages) + webSecondsToday(s) / 60

    fun nightActive(s: Store, now: LocalTime = LocalTime.now()): Boolean =
        s.nightEnabled && Policy.inWindow(
            now,
            Policy.parseTime(s.nightStart, LocalTime.of(22, 30)),
            Policy.parseTime(s.nightEnd, LocalTime.of(6, 30)),
        )

    fun focusActive(s: Store) = s.focusUntil > System.currentTimeMillis()
    fun unlockActive(s: Store) = s.unlockUntil > System.currentTimeMillis()
    fun guardPaused(s: Store) = s.guardPausedUntil > System.currentTimeMillis()

    /** Lockerungen nur mit Verzoegerung, sobald der Schutz scharf ist. */
    fun armed(s: Store) = s.strictArmed && !guardPaused(s)

    // ---- Lockerungen mit Wartezeit -------------------------------------------------------

    /**
     * Verschaerfungen gelten sofort. Lockerungen laufen ueber diese Funktion: vor dem
     * Scharfschalten sofort, danach erst nach 24 Stunden. Das ist der "Odysseus-Vertrag":
     * Die Entscheidung triffst du mit klarem Kopf, nicht im Moment des Verlangens.
     */
    fun requestLoosening(s: Store, type: String, value: String, label: String): Boolean {
        if (!armed(s)) { apply(s, type, value); return true }
        s.pending = s.pending.filterNot { it.type == type && it.value == value } +
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
            "night_start" -> s.nightStart = value
            "night_end" -> s.nightEnd = value
            "night_browsers" -> s.nightBlockBrowsers = value == "true"
            "intercept" -> s.interceptEnabled = value == "true"
            "max_unlocks" -> value.toIntOrNull()?.let { s.maxUnlocksPerDay = it.coerceIn(0, 5) }
            "shield_off" -> s.shieldEnabled = false
            "shield_private" -> s.shieldBlockPrivate = value == "true"
            "shield_scan" -> s.shieldScanContent = value == "true"
            "disarm" -> s.strictArmed = false
        }
    }

    // ---- Punkte ----------------------------------------------------------------------------

    fun addXp(s: Store, amount: Int) {
        if (amount <= 0) return
        s.xp = s.xp + amount
        s.coins = s.coins + amount
    }

    /** Level n braucht 50 * n * (n - 1) XP: 0, 100, 300, 600, 1000, ... */
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
        if (done) addXp(s, taskXp(t)) else { s.xp = max(0, s.xp - taskXp(t)); s.coins = max(0, s.coins - taskXp(t)) }
        s.plan = s.plan.map { if (it.taskId == id) it.copy(done = done) else it }
    }

    // ---- Tagesabschluss ------------------------------------------------------------------

    /**
     * Schliesst alle vergangenen Tage ab, die noch offen sind (hoechstens 14):
     * Minuten unter dem Budget werden zu Punkten, eine saubere Nacht gibt einen Bonus.
     */
    fun closePastDays(context: Context, s: Store) {
        val today = LocalDate.now()
        val last = runCatching { LocalDate.parse(s.lastClosedDay) }.getOrNull()
        if (last == null) { s.lastClosedDay = today.minusDays(1).toString(); return }
        var d = last.plusDays(1)
        if (d.isBefore(today.minusDays(14))) d = today.minusDays(14)
        val exclude = Catalog.launcherPackages(context) + setOf(context.packageName, "com.android.systemui")
        val records = s.days.toMutableList()
        while (d.isBefore(today)) {
            val map = Usage.dayMillis(context, d)
            val dop = Usage.sumMinutes(map, s.dopaminePackages) + (if (s.webDopamineDay == d.toString()) s.webDopamineSeconds / 60 else 0)
            val total = Usage.totalMinutes(map, exclude)
            val nightUnlock = s.unlocks.any {
                val z = java.time.Instant.ofEpochMilli(it.at).atZone(java.time.ZoneId.systemDefault())
                z.toLocalDate() == d && nightActive(s, z.toLocalTime())
            }
            var xp = 0
            if (map.isNotEmpty() && dop <= s.budgetMin) xp += 20 + (s.budgetMin - dop)
            if (!nightUnlock) xp += 10
            records.removeAll { it.date == d.toString() }
            records += DayRecord(d.toString(), dop, total, s.budgetMin, xp, !nightUnlock)
            addXp(s, xp)
            d = d.plusDays(1)
        }
        s.days = records.sortedBy { it.date }
        s.lastClosedDay = today.minusDays(1).toString()
        // Fokus-Belohnung: abgelaufene Sessions abrechnen
        settleFocus(s)
    }

    fun startFocus(s: Store, minutes: Int) {
        val now = System.currentTimeMillis()
        s.focusStartedAt = now
        s.focusUntil = now + minutes * 60_000L
    }

    /** Beendet eine Fokus-Session und gibt 1 XP pro Minute, die durchgehalten wurde. */
    fun settleFocus(s: Store, stopNow: Boolean = false) {
        if (s.focusStartedAt == 0L) return
        val now = System.currentTimeMillis()
        if (!stopNow && s.focusUntil > now) return
        val end = minOf(now, s.focusUntil)
        val minutes = ((end - s.focusStartedAt) / 60_000L).toInt()
        addXp(s, minutes)
        s.focusStartedAt = 0L
        if (stopNow) s.focusUntil = 0L
    }

    /** Laengste Serie aufeinanderfolgender Tage unter Budget, bis gestern. */
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

    fun shieldDays(s: Store): Int {
        if (s.shieldStreakStart == 0L) return 0
        return ((System.currentTimeMillis() - s.shieldStreakStart) / (24L * 60 * 60 * 1000)).toInt()
    }
}
