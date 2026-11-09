package app.anker.ai

import app.anker.data.Exam
import app.anker.data.PlanBlock
import app.anker.data.Store
import app.anker.data.Task
import com.anthropic.client.okhttp.AnthropicOkHttpClient
import com.anthropic.core.JsonValue
import com.anthropic.errors.AnthropicIoException
import com.anthropic.errors.AnthropicServiceException
import com.anthropic.errors.BadRequestException
import com.anthropic.errors.OverloadedException
import com.anthropic.errors.PermissionDeniedException
import com.anthropic.errors.RateLimitException
import com.anthropic.errors.UnauthorizedException
import com.anthropic.models.messages.JsonOutputFormat
import com.anthropic.models.messages.MessageCreateParams
import com.anthropic.models.messages.OutputConfig
import com.anthropic.models.messages.StopReason
import org.json.JSONObject
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Der Planer: aus Gesprochenem werden Aufgaben, aus Aufgaben + Schule wird ein Tagesplan.
 *
 * Beide Aufrufe verlangen eine Antwort nach festem JSON-Schema (structured outputs),
 * damit nichts geraten oder per Text-Suche herausgefischt werden muss.
 */
class Planner(private val store: Store) {

    class PlannerException(message: String) : Exception(message)

    data class ExtractResult(val summary: String, val tasks: List<Task>, val exams: List<Exam>, val profileNotes: String)
    data class DayPlan(val blocks: List<PlanBlock>, val advice: String, val agentTasks: List<String>)

    private val system = """
        Du bist der persoenliche Planungs-Coach in der App "Anker" fuer einen Schueler, der gleichzeitig
        viel am PC mit KI-Agenten (Claude) an eigenen Projekten arbeitet. Sein Ziel: moeglichst viel am Tag
        schaffen, weniger Zeit am Handy, besonders weniger Social Media.

        Arbeitsweise:
        - Antworte immer auf Deutsch, knapp und konkret. Keine Floskeln.
        - Aufgaben sind konkrete naechste Schritte mit Verb am Anfang ("Mathe S. 42 Nr. 3-5 rechnen"),
          nicht vage Themen ("Mathe").
        - Schaetze die Dauer realistisch (in Minuten). Grosse Brocken in Teilaufgaben von 25-90 Minuten zerlegen.
        - Prioritaet: 1 = heute wichtig/dringend, 2 = diese Woche, 3 = irgendwann.
        - Faelligkeitsdatum als yyyy-MM-dd, wenn erkennbar (relative Angaben wie "Freitag" vom heutigen Datum
          aus aufloesen), sonst leerer String.
        - Fuer anstehende Klausuren: verteiltes Lernen einplanen (mehrere kurze Lerneinheiten an verschiedenen
          Tagen, aktives Abfragen statt nur Lesen), nicht alles am Vorabend.
        - Nutze, was du ueber Stundenplan, Klausuren und Gewohnheiten weisst. Erfinde keine Termine.
    """.trimIndent()

    // ---- Aufgaben aus Gesprochenem --------------------------------------------------------

    fun extract(transcript: String): ExtractResult {
        val prompt = buildString {
            appendLine(context())
            appendLine()
            appendLine("Hier ist, was ich gerade ins Handy gesprochen habe (Spracherkennung, kann Fehler enthalten):")
            appendLine("\"\"\"")
            appendLine(transcript.trim())
            appendLine("\"\"\"")
            appendLine()
            appendLine("Mach daraus neue Aufgaben (keine Duplikate zu meinen offenen Aufgaben), erkenne neue Klausuren/Tests/Abgaben,")
            appendLine("und notiere in profile_notes kurz neue dauerhafte Fakten über mich (Gewohnheiten, feste Termine), sonst leer.")
            appendLine("summary: 1-2 Sätze, was du verstanden hast.")
        }
        val schema = mapOf(
            "summary" to str(),
            "profile_notes" to str(),
            "tasks" to arr(obj(
                "title" to str(), "estimate_min" to int(), "priority" to int(),
                "due" to str(), "category" to str(), "notes" to str(),
            )),
            "exams" to arr(obj("subject" to str(), "date" to str(), "kind" to str(), "topics" to str())),
        )
        val o = call(prompt, schema)
        val tasks = o.optJSONArray("tasks")?.let { a ->
            (0 until a.length()).map { i ->
                val t = a.getJSONObject(i)
                Task(
                    title = t.getString("title"),
                    estimateMin = t.optInt("estimate_min", 25).coerceIn(5, 480),
                    priority = t.optInt("priority", 2).coerceIn(1, 3),
                    due = t.optString("due", "").takeIf { isDate(it) } ?: "",
                    category = t.optString("category", "Allgemein").ifBlank { "Allgemein" },
                    notes = t.optString("notes", ""),
                )
            }
        } ?: emptyList()
        val exams = o.optJSONArray("exams")?.let { a ->
            (0 until a.length()).mapNotNull { i ->
                val e = a.getJSONObject(i)
                val date = e.optString("date", "")
                if (!isDate(date)) null
                else Exam(subject = e.getString("subject"), date = date, kind = e.optString("kind", "Klausur"), topics = e.optString("topics", ""))
            }
        } ?: emptyList()
        return ExtractResult(o.optString("summary", ""), tasks, exams, o.optString("profile_notes", ""))
    }

    // ---- Tagesplan ----------------------------------------------------------------------------

    fun planDay(extraWish: String): DayPlan {
        val now = LocalDateTime.now()
        val prompt = buildString {
            appendLine(context())
            appendLine()
            appendLine("Erstelle meinen Plan für den REST von heute, ab jetzt (${now.format(DateTimeFormatter.ofPattern("HH:mm"))}) bis zu meiner Schlafenszeit.")
            appendLine("- Zeitblöcke mit start/end im Format HH:mm, lückenlos ist nicht nötig, Pausen explizit als kind \"pause\".")
            appendLine("- Wichtiges zuerst, schwere Aufgaben in Phasen hoher Energie, 25-90-Minuten-Blöcke, dazwischen kurze Pausen.")
            appendLine("- task_id: die id einer meiner offenen Aufgaben, wenn der Block zu ihr gehört, sonst leerer String.")
            appendLine("- kind: eins von task, lernen, pause, schule, routine, agent (agent = Arbeit mit KI-Agent am PC).")
            appendLine("- Die letzte Stunde vor dem Schlafen ohne Bildschirm planen (Routine).")
            appendLine("- agent_tasks: 5-8 Mikro-Aufgaben (1-5 Min) für Wartezeiten, während mein KI-Agent arbeitet, passend zu meinem Tag.")
            appendLine("- advice: 1-3 Sätze, worauf es heute ankommt.")
            if (extraWish.isNotBlank()) appendLine("Zusätzlicher Wunsch für heute: ${extraWish.trim()}")
        }
        val schema = mapOf(
            "advice" to str(),
            "agent_tasks" to arr(str()),
            "blocks" to arr(obj("start" to str(), "end" to str(), "title" to str(), "task_id" to str(), "kind" to str())),
        )
        val o = call(prompt, schema)
        val ids = store.tasks.map { it.id }.toSet()
        val blocks = o.optJSONArray("blocks")?.let { a ->
            (0 until a.length()).map { i ->
                val b = a.getJSONObject(i)
                val tid = b.optString("task_id", "").takeIf { it in ids } ?: ""
                PlanBlock(b.getString("start"), b.getString("end"), b.getString("title"), tid, b.optString("kind", "task"))
            }.sortedBy { it.start }
        } ?: emptyList()
        val agent = o.optJSONArray("agent_tasks")?.let { a -> (0 until a.length()).map { a.getString(it) } } ?: emptyList()
        return DayPlan(blocks, o.optString("advice", ""), agent)
    }

    // ---- Gemeinsamer Kontext --------------------------------------------------------------------

    private fun context(): String {
        val today = LocalDate.now()
        val fmt = DateTimeFormatter.ofPattern("EEEE, d. MMMM yyyy, HH:mm", Locale.GERMAN)
        return buildString {
            appendLine("Jetzt: ${LocalDateTime.now().format(fmt)} (heute = $today)")
            appendLine("Aufstehen ca. ${store.wakeTime}, Schlafen ca. ${store.sleepTime}.")
            if (store.aboutMe.isNotBlank()) appendLine("Über mich: ${store.aboutMe.trim()}")
            if (store.timetable.isNotBlank()) appendLine("Stundenplan:\n${store.timetable.trim()}")
            val exams = store.exams.filter { it.date >= today.toString() }.sortedBy { it.date }
            if (exams.isNotEmpty()) {
                appendLine("Anstehende Klausuren/Tests:")
                exams.forEach { appendLine("- ${it.date}: ${it.kind} ${it.subject}${if (it.topics.isNotBlank()) " (${it.topics})" else ""}") }
            }
            val open = store.tasks.filter { !it.done }
            if (open.isNotEmpty()) {
                appendLine("Meine offenen Aufgaben:")
                open.forEach {
                    appendLine("- id=${it.id} | ${it.title} | ${it.estimateMin} Min | Prio ${it.priority}" +
                        (if (it.due.isNotBlank()) " | fällig ${it.due}" else "") + " | ${it.category}")
                }
            } else appendLine("Keine offenen Aufgaben.")
        }
    }

    // ---- API-Aufruf -------------------------------------------------------------------------

    private fun call(userPrompt: String, schemaProps: Map<String, Any>): JSONObject {
        val key = store.apiKey.trim()
        if (key.isBlank()) throw PlannerException("Kein API-Key. Trag ihn unter Mehr → KI-Einstellungen ein.")
        val client = AnthropicOkHttpClient.builder().apiKey(key).build()
        try {
            return try {
                send(client, userPrompt, schemaProps, withFallbacks = true)
            } catch (e: BadRequestException) {
                // Falls der Fallback-Parameter fuer diesen Schluessel nicht freigeschaltet ist:
                // einmal ohne ihn wiederholen, statt den Planer komplett ausfallen zu lassen.
                send(client, userPrompt, schemaProps, withFallbacks = false)
            }
        } catch (e: UnauthorizedException) {
            throw PlannerException("API-Key ungültig. Bitte unter KI-Einstellungen prüfen.")
        } catch (e: PermissionDeniedException) {
            throw PlannerException("Der API-Key darf dieses Modell nicht nutzen (${store.model}).")
        } catch (e: RateLimitException) {
            throw PlannerException("Zu viele Anfragen oder kein Guthaben mehr. Kurz warten bzw. Guthaben prüfen.")
        } catch (e: OverloadedException) {
            throw PlannerException("Claude ist gerade überlastet. In einer Minute nochmal versuchen.")
        } catch (e: BadRequestException) {
            throw PlannerException("Anfrage abgelehnt: ${e.message}")
        } catch (e: AnthropicServiceException) {
            throw PlannerException("Fehler vom Server (${e.statusCode()}). Später nochmal versuchen.")
        } catch (e: AnthropicIoException) {
            throw PlannerException("Keine Verbindung. Bist du online?")
        } finally {
            client.close()
        }
    }

    private fun send(
        client: com.anthropic.client.AnthropicClient,
        userPrompt: String,
        schemaProps: Map<String, Any>,
        withFallbacks: Boolean,
    ): JSONObject {
        val schema = JsonOutputFormat.Schema.builder()
            .putAdditionalProperty("type", JsonValue.from("object"))
            .putAdditionalProperty("properties", JsonValue.from(schemaProps))
            .putAdditionalProperty("required", JsonValue.from(schemaProps.keys.toList()))
            .putAdditionalProperty("additionalProperties", JsonValue.from(false))
            .build()
        val builder = MessageCreateParams.builder()
            .model(store.model.ifBlank { "claude-opus-5-5" })
            .maxTokens(16000L)
            .system(system)
            .outputConfig(
                OutputConfig.builder()
                    .effort(OutputConfig.Effort.MEDIUM)
                    .format(JsonOutputFormat.builder().schema(schema).build())
                    .build()
            )
            .addUserMessage(userPrompt)
        if (withFallbacks) {
            // Falls eine Anfrage vom Sicherheitsfilter abgelehnt wird, beantwortet sie
            // serverseitig automatisch ein passendes anderes Modell.
            builder.putAdditionalHeader("anthropic-beta", "server-side-fallback-2026-07-01")
            builder.putAdditionalBodyProperty("fallbacks", JsonValue.from("default"))
        }
        val msg = client.messages().create(builder.build())
        val stop = msg.stopReason().orElse(null)
        if (stop == StopReason.REFUSAL) throw PlannerException("Claude hat diese Anfrage abgelehnt. Formulier sie anders.")
        if (stop == StopReason.MAX_TOKENS) throw PlannerException("Antwort war zu lang und wurde abgeschnitten. Bitte kürzer fassen.")
        val text = msg.content().mapNotNull { it.text().orElse(null)?.text() }.joinToString("")
        return runCatching { JSONObject(text) }.getOrElse { throw PlannerException("Antwort war kein gültiges JSON.") }
    }

    // ---- Schema-Helfer ----------------------------------------------------------------------

    private fun str(): Map<String, Any> = mapOf("type" to "string")
    private fun int(): Map<String, Any> = mapOf("type" to "integer")
    private fun arr(items: Map<String, Any>): Map<String, Any> = mapOf("type" to "array", "items" to items)
    private fun obj(vararg props: Pair<String, Map<String, Any>>): Map<String, Any> = mapOf(
        "type" to "object",
        "properties" to props.toMap(),
        "required" to props.map { it.first },
        "additionalProperties" to false,
    )

    private fun isDate(s: String) = runCatching { LocalDate.parse(s) }.isSuccess

    companion object {
        /** Einfacher Ersatz ohne KI: jeder Satz wird eine Aufgabe. */
        fun offlineTasks(transcript: String): List<Task> =
            transcript.split(Regex("""[.!?\n]+|\bund dann\b|\bausserdem\b|\baußerdem\b""", RegexOption.IGNORE_CASE))
                .map { it.trim().trim(',', ';') }
                .filter { it.length >= 4 }
                .map { Task(title = it.replaceFirstChar { c -> c.uppercase() }) }
    }
}
