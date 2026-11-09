package app.anker.util

import java.time.LocalTime

/** Kleine Zeit-Helfer ohne Android-Abhaengigkeit (per Unit-Test geprueft). */
object Times {
    /** Liegt [t] im Fenster [start, end)? Fenster ueber Mitternacht sind erlaubt. */
    fun inWindow(t: LocalTime, start: LocalTime, end: LocalTime): Boolean =
        if (start == end) false
        else if (start < end) !t.isBefore(start) && t.isBefore(end)
        else !t.isBefore(start) || t.isBefore(end)

    fun parse(s: String, fallback: LocalTime): LocalTime {
        val m = Regex("""^\s*(\d{1,2})[:.](\d{2})\s*$""").find(s) ?: return fallback
        val h = m.groupValues[1].toInt(); val min = m.groupValues[2].toInt()
        return if (h in 0..23 && min in 0..59) LocalTime.of(h, min) else fallback
    }

    fun minutesLabel(min: Int): String =
        if (min < 60) "$min Min" else "${min / 60} h ${(min % 60).toString().padStart(2, '0')}"
}
