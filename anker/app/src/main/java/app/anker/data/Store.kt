package app.anker.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.util.UUID
import kotlin.properties.ReadWriteProperty
import kotlin.reflect.KProperty

/**
 * Der gesamte Zustand der App, in einer einzigen SharedPreferences-Datei.
 *
 * Bewusst simpel: kein Server, keine Datenbank, nichts verlaesst das Handy ausser
 * dem, was du selbst an Claude schickst. Jede Schreiboperation erhoeht [version],
 * damit die Oberflaeche neu zeichnet, egal ob die Aenderung vom Bildschirm, vom
 * Waechter-Dienst oder vom Filter kam.
 */
class Store private constructor(context: Context) {
    private val sp: SharedPreferences = context.getSharedPreferences("anker", Context.MODE_PRIVATE)
    private val _version = MutableStateFlow(0)
    val version: StateFlow<Int> = _version

    private fun bump() { _version.value = _version.value + 1 }

    // ---- Limits ---------------------------------------------------------------
    /** Tagesbudget fuer alle "High-Dopamin"-Apps zusammen, in Minuten. */
    var budgetMin by int("budget_min", 60)
    /** Pakete, die zum Budget zaehlen (Social Media, Spiele, Kurzvideo). */
    var dopaminePackages by stringSet("dopamine_pkgs", emptySet())
    var catalogSeeded by bool("catalog_seeded", false)

    var interceptEnabled by bool("intercept_enabled", true)
    var interceptSeconds by int("intercept_seconds", 10)

    var nightEnabled by bool("night_enabled", true)
    var nightStart by string("night_start", "22:30")
    var nightEnd by string("night_end", "06:30")
    var nightBlockBrowsers by bool("night_block_browsers", true)

    /** Einstellungs-Waechter scharf: Deinstallieren/Deaktivieren wird abgefangen. */
    var strictArmed by bool("strict_armed", false)
    /** Bis wann der Waechter fuer Wartung pausiert ist (nach 24 h Antrag + PC-Code). */
    var guardPausedUntil by long("guard_paused_until", 0L)

    // ---- Fokus (Agent arbeitet) -----------------------------------------------
    var focusUntil by long("focus_until", 0L)
    var focusStartedAt by long("focus_started_at", 0L)

    // ---- Freischaltung ----------------------------------------------------------
    var unlockSecret by string("unlock_secret", "")
    var unlockSecretConfirmed by bool("unlock_secret_confirmed", false)
    var unlockUntil by long("unlock_until", 0L)
    var unlockRequestAt by long("unlock_request_at", 0L)
    var unlockRequestReason by string("unlock_request_reason", "")
    var unlockChallenge by string("unlock_challenge", "")
    var maxUnlocksPerDay by int("max_unlocks_per_day", 2)

    // ---- Schutzfilter (diskret) -------------------------------------------------
    var shieldEnabled by bool("shield_enabled", false)
    var shieldBlockPrivate by bool("shield_block_private", true)
    var shieldScanContent by bool("shield_scan_content", true)
    var shieldShowOnHome by bool("shield_show_home", false)
    var shieldStreakStart by long("shield_streak_start", 0L)
    var shieldBestStreakDays by int("shield_best_streak", 0)
    var advancedPin by string("advanced_pin", "")

    // ---- Profil / Schule / KI ---------------------------------------------------
    var apiKey by string("api_key", "")
    var model by string("model", "claude-opus-5-5")
    var aboutMe by string("about_me", "")
    var timetable by string("timetable", "")
    var wakeTime by string("wake_time", "07:00")
    var sleepTime by string("sleep_time", "23:00")
    var lastPlanAdvice by string("last_plan_advice", "")
    var lastPlanDate by string("last_plan_date", "")
    var agentWaitTasks by stringList("agent_wait_tasks", DEFAULT_AGENT_TASKS)

    // ---- Fortschritt -------------------------------------------------------------
    var xp by int("xp", 0)
    var coins by int("coins", 0)
    var lastClosedDay by string("last_closed_day", "")
    var resistedCount by int("resisted_count", 0)
    var webDopamineDay by string("web_dopamine_day", "")
    var webDopamineSeconds by int("web_dopamine_seconds", 0)
    var warnedLevelDay by string("warned_level_day", "")
    var warnedLevel by int("warned_level", 0)
    var installedAt by long("installed_at", 0L)
    var guardLastSeen by long("guard_last_seen", 0L)
    var setupDone by bool("setup_done", false)

    // ---- Listen ------------------------------------------------------------------
    var tasks: List<Task>
        get() = readList("tasks", Task::from)
        set(v) = writeList("tasks", v.map { it.json() })
    var exams: List<Exam>
        get() = readList("exams", Exam::from)
        set(v) = writeList("exams", v.map { it.json() })
    var rewards: List<Reward>
        get() = readList("rewards", Reward::from)
        set(v) = writeList("rewards", v.map { it.json() })
    var days: List<DayRecord>
        get() = readList("days", DayRecord::from)
        set(v) = writeList("days", v.takeLast(120).map { it.json() })
    var plan: List<PlanBlock>
        get() = readList("plan", PlanBlock::from)
        set(v) = writeList("plan", v.map { it.json() })
    var pending: List<Pending>
        get() = readList("pending", Pending::from)
        set(v) = writeList("pending", v.map { it.json() })
    var relapses: List<Relapse>
        get() = readList("relapses", Relapse::from)
        set(v) = writeList("relapses", v.takeLast(200).map { it.json() })
    var unlocks: List<UnlockEvent>
        get() = readList("unlocks", UnlockEvent::from)
        set(v) = writeList("unlocks", v.takeLast(200).map { it.json() })
    var violations: List<Violation>
        get() = readList("violations", Violation::from)
        set(v) = writeList("violations", v.takeLast(200).map { it.json() })

    fun logViolation(kind: String, detail: String = "") {
        violations = violations + Violation(System.currentTimeMillis(), kind, detail)
    }

    fun unlocksToday(): Int {
        val today = LocalDate.now()
        return unlocks.count { java.time.Instant.ofEpochMilli(it.at).atZone(java.time.ZoneId.systemDefault()).toLocalDate() == today }
    }

    // ---- Delegates -----------------------------------------------------------------
    private fun int(key: String, def: Int) = object : ReadWriteProperty<Any?, Int> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getInt(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Int) { sp.edit().putInt(key, value).apply(); bump() }
    }
    private fun long(key: String, def: Long) = object : ReadWriteProperty<Any?, Long> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getLong(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Long) { sp.edit().putLong(key, value).apply(); bump() }
    }
    private fun bool(key: String, def: Boolean) = object : ReadWriteProperty<Any?, Boolean> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getBoolean(key, def)
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Boolean) { sp.edit().putBoolean(key, value).apply(); bump() }
    }
    private fun string(key: String, def: String) = object : ReadWriteProperty<Any?, String> {
        override fun getValue(thisRef: Any?, property: KProperty<*>) = sp.getString(key, def) ?: def
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: String) { sp.edit().putString(key, value).apply(); bump() }
    }
    private fun stringSet(key: String, def: Set<String>) = object : ReadWriteProperty<Any?, Set<String>> {
        override fun getValue(thisRef: Any?, property: KProperty<*>): Set<String> = sp.getStringSet(key, def)?.toSet() ?: def
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: Set<String>) { sp.edit().putStringSet(key, HashSet(value)).apply(); bump() }
    }
    private fun stringList(key: String, def: List<String>) = object : ReadWriteProperty<Any?, List<String>> {
        override fun getValue(thisRef: Any?, property: KProperty<*>): List<String> {
            val raw = sp.getString(key, null) ?: return def
            return runCatching { JSONArray(raw).let { a -> List(a.length()) { a.getString(it) } } }.getOrDefault(def)
        }
        override fun setValue(thisRef: Any?, property: KProperty<*>, value: List<String>) {
            sp.edit().putString(key, JSONArray(value).toString()).apply(); bump()
        }
    }

    private fun <T> readList(key: String, parse: (JSONObject) -> T): List<T> {
        val raw = sp.getString(key, null) ?: return emptyList()
        return runCatching {
            val a = JSONArray(raw)
            (0 until a.length()).mapNotNull { i -> runCatching { parse(a.getJSONObject(i)) }.getOrNull() }
        }.getOrDefault(emptyList())
    }

    private fun writeList(key: String, items: List<JSONObject>) {
        sp.edit().putString(key, JSONArray(items).toString()).apply()
        bump()
    }

    companion object {
        @Volatile private var instance: Store? = null
        fun get(context: Context): Store = instance ?: synchronized(this) {
            instance ?: Store(context.applicationContext).also { instance = it }
        }

        fun newId(): String = UUID.randomUUID().toString().take(8)

        val DEFAULT_AGENT_TASKS = listOf(
            "Naechsten Prompt fuer den Agenten vorformulieren",
            "Aufgabenliste checken: was kommt nach diesem Schritt?",
            "Glas Wasser holen",
            "10 Kniebeugen oder 1 Minute dehnen",
            "Schreibtisch / Desktop aufraeumen (2 Min)",
            "5 Karteikarten fuer die naechste Klausur",
            "Augen 20 Sekunden aus dem Fenster in die Ferne richten",
        )
    }
}

// ---- Modelle ------------------------------------------------------------------------

data class Task(
    val id: String = Store.newId(),
    val title: String,
    val estimateMin: Int = 25,
    val priority: Int = 2, // 1 = hoch, 2 = mittel, 3 = niedrig
    val due: String = "", // yyyy-MM-dd oder leer
    val category: String = "Allgemein",
    val notes: String = "",
    val done: Boolean = false,
    val doneAt: Long = 0L,
    val createdAt: Long = System.currentTimeMillis(),
) {
    fun json() = JSONObject().put("id", id).put("title", title).put("est", estimateMin).put("prio", priority)
        .put("due", due).put("cat", category).put("notes", notes).put("done", done).put("doneAt", doneAt)
        .put("created", createdAt)

    companion object {
        fun from(o: JSONObject) = Task(
            o.getString("id"), o.getString("title"), o.optInt("est", 25), o.optInt("prio", 2),
            o.optString("due", ""), o.optString("cat", "Allgemein"), o.optString("notes", ""),
            o.optBoolean("done", false), o.optLong("doneAt", 0L), o.optLong("created", 0L),
        )
    }
}

data class Exam(
    val id: String = Store.newId(),
    val subject: String,
    val date: String, // yyyy-MM-dd
    val kind: String = "Klausur",
    val topics: String = "",
) {
    fun json() = JSONObject().put("id", id).put("subject", subject).put("date", date).put("kind", kind).put("topics", topics)
    companion object {
        fun from(o: JSONObject) = Exam(o.getString("id"), o.getString("subject"), o.getString("date"),
            o.optString("kind", "Klausur"), o.optString("topics", ""))
    }
}

data class Reward(val id: String = Store.newId(), val title: String, val cost: Int) {
    fun json() = JSONObject().put("id", id).put("title", title).put("cost", cost)
    companion object { fun from(o: JSONObject) = Reward(o.getString("id"), o.getString("title"), o.getInt("cost")) }
}

data class DayRecord(
    val date: String,
    val dopamineMin: Int,
    val totalMin: Int,
    val budget: Int,
    val xp: Int,
    val nightClean: Boolean,
) {
    val underBudget get() = dopamineMin <= budget
    fun json() = JSONObject().put("date", date).put("dop", dopamineMin).put("total", totalMin).put("budget", budget)
        .put("xp", xp).put("night", nightClean)
    companion object {
        fun from(o: JSONObject) = DayRecord(o.getString("date"), o.getInt("dop"), o.optInt("total", 0),
            o.optInt("budget", 60), o.optInt("xp", 0), o.optBoolean("night", true))
    }
}

data class PlanBlock(
    val start: String,
    val end: String,
    val title: String,
    val taskId: String = "",
    val kind: String = "task",
    val done: Boolean = false,
) {
    fun json() = JSONObject().put("start", start).put("end", end).put("title", title).put("taskId", taskId)
        .put("kind", kind).put("done", done)
    companion object {
        fun from(o: JSONObject) = PlanBlock(o.getString("start"), o.getString("end"), o.getString("title"),
            o.optString("taskId", ""), o.optString("kind", "task"), o.optBoolean("done", false))
    }
}

/** Eine Lockerung, die erst nach Ablauf der Wartezeit wirksam wird. */
data class Pending(
    val id: String = Store.newId(),
    val type: String,
    val value: String,
    val applyAt: Long,
    val label: String,
) {
    fun json() = JSONObject().put("id", id).put("type", type).put("value", value).put("applyAt", applyAt).put("label", label)
    companion object {
        fun from(o: JSONObject) = Pending(o.getString("id"), o.getString("type"), o.getString("value"),
            o.getLong("applyAt"), o.optString("label", ""))
    }
}

data class Relapse(val at: Long, val trigger: String) {
    fun json() = JSONObject().put("at", at).put("trigger", trigger)
    companion object { fun from(o: JSONObject) = Relapse(o.getLong("at"), o.optString("trigger", "")) }
}

data class UnlockEvent(val at: Long, val reason: String, val minutes: Int) {
    fun json() = JSONObject().put("at", at).put("reason", reason).put("min", minutes)
    companion object { fun from(o: JSONObject) = UnlockEvent(o.getLong("at"), o.optString("reason", ""), o.optInt("min", 0)) }
}

data class Violation(val at: Long, val kind: String, val detail: String) {
    fun json() = JSONObject().put("at", at).put("kind", kind).put("detail", detail)
    companion object { fun from(o: JSONObject) = Violation(o.getLong("at"), o.getString("kind"), o.optString("detail", "")) }
}
