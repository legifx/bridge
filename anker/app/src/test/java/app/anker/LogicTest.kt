package app.anker

import app.anker.ai.Planner
import app.anker.data.Engine
import app.anker.data.Task
import app.anker.util.Times
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalTime

class LogicTest {
    private fun t(s: String) = LocalTime.parse(s)

    @Test fun windowOverMidnight() {
        assertTrue(Times.inWindow(t("23:00"), t("22:30"), t("06:30")))
        assertTrue(Times.inWindow(t("02:00"), t("22:30"), t("06:30")))
        assertTrue(Times.inWindow(t("22:30"), t("22:30"), t("06:30")))
        assertFalse(Times.inWindow(t("06:30"), t("22:30"), t("06:30")))
        assertFalse(Times.inWindow(t("12:00"), t("22:30"), t("06:30")))
    }

    @Test fun windowSameDayAndEmpty() {
        assertTrue(Times.inWindow(t("13:00"), t("12:00"), t("14:00")))
        assertFalse(Times.inWindow(t("14:00"), t("12:00"), t("14:00")))
        assertFalse(Times.inWindow(t("10:00"), t("10:00"), t("10:00")))
    }

    @Test fun parseTimes() {
        assertEquals(t("07:05"), Times.parse("7:05", t("00:00")))
        assertEquals(t("22:30"), Times.parse("22.30", t("00:00")))
        assertEquals(t("01:00"), Times.parse("25:00", t("01:00")))
        assertEquals(t("01:00"), Times.parse("abends", t("01:00")))
    }

    @Test fun levels() {
        assertEquals(1, Engine.level(0))
        assertEquals(1, Engine.level(99))
        assertEquals(2, Engine.level(100))
        assertEquals(3, Engine.level(300))
        assertEquals(4, Engine.level(999))
        assertEquals(5, Engine.level(1000))
        for (l in 1..20) {
            assertEquals(l, Engine.level(Engine.levelFloor(l)))
            assertEquals(l + 1, Engine.level(Engine.levelCeil(l)))
        }
    }

    @Test fun taskXpRewardsPriorityAndEffort() {
        val small = Engine.taskXp(Task(title = "a", estimateMin = 10, priority = 3))
        val big = Engine.taskXp(Task(title = "a", estimateMin = 90, priority = 1))
        assertTrue(big > small)
        assertEquals(12, small)
    }

    @Test fun offlineSplit() {
        val tasks = Planner.offlineTasks("Mathe Hausaufgaben machen. Bio lernen und dann Video schneiden\nZimmer aufraeumen")
        assertEquals(listOf("Mathe Hausaufgaben machen", "Bio lernen", "Video schneiden", "Zimmer aufraeumen"), tasks.map { it.title })
    }

    @Test fun minutesLabel() {
        assertEquals("45 Min", Times.minutesLabel(45))
        assertEquals("3 h 05", Times.minutesLabel(185))
    }
}
