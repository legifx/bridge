package app.anker.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import app.anker.LocalUi
import app.anker.ai.Planner
import app.anker.data.Engine
import app.anker.data.Task
import app.anker.voice.Dictation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

@Composable
fun PlanScreen() {
    SpacedColumn {
        Text("Plan", fontSize = 28.sp, fontWeight = FontWeight.Bold, color = C.text)
        DictationCard()
        DayPlanCard()
        TaskListCard()
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun DictationCard() {
    val ui = LocalUi.current
    val s = ui.store
    val context = LocalContext.current
    var transcript by rememberSaveable { mutableStateOf("") }
    var partial by remember { mutableStateOf("") }
    var listening by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var summary by rememberSaveable { mutableStateOf("") }

    val dictation = remember {
        Dictation(
            context,
            onText = { committed, p -> transcript = committed; partial = p },
            onState = { l, err -> listening = l; if (err != null) ui.toast(err) },
        )
    }
    DisposableEffect(Unit) { onDispose { dictation.stop() } }

    val micPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) dictation.start(transcript) else ui.toast("Ohne Mikrofon geht nur Tippen.")
    }

    Section("Reinlabern") {
        Hint("Erzähl einfach, was ansteht: Hausaufgaben, Klausuren, Projekte, Termine, was dir im Kopf rumgeht. Die KI macht daraus Aufgaben mit Zeitschätzung.")
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(64.dp).background(if (listening) C.bad else C.accent, CircleShape),
                contentAlignment = Alignment.Center,
            ) {
                IconButton(onClick = {
                    if (listening) dictation.stop()
                    else if (!dictation.available) ui.toast("Keine Spracherkennung auf diesem Gerät gefunden.")
                    else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) dictation.start(transcript)
                    else micPerm.launch(Manifest.permission.RECORD_AUDIO)
                }) {
                    Icon(if (listening) Icons.Filled.Stop else Icons.Filled.Mic, "Sprechen", tint = Color.Black, modifier = Modifier.size(32.dp))
                }
            }
            Spacer(Modifier.width(14.dp))
            Text(if (listening) "Ich höre zu… tippe zum Beenden" else "Tippen und lossprechen", color = C.dim)
        }
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = if (partial.isNotEmpty()) "$transcript $partial".trim() else transcript,
            onValueChange = { if (!listening) transcript = it },
            modifier = Modifier.fillMaxWidth().heightIn(min = 110.dp),
            placeholder = { Text("…oder hier tippen") },
        )
        Spacer(Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Button(
                enabled = transcript.isNotBlank() && !busy && !listening,
                onClick = {
                    busy = true
                    ui.scope.launch {
                        try {
                            if (s.apiKey.isBlank()) {
                                val tasks = Planner.offlineTasks(transcript)
                                s.tasks = s.tasks + tasks
                                summary = "${tasks.size} Aufgaben ohne KI angelegt (Satz für Satz). Mit API-Key werden sie geschätzt, priorisiert und sortiert."
                            } else {
                                val r = withContext(Dispatchers.IO) { Planner(s).extract(transcript) }
                                s.tasks = s.tasks + r.tasks
                                if (r.exams.isNotEmpty()) {
                                    val known = s.exams.map { it.subject.lowercase() + it.date }.toSet()
                                    s.exams = s.exams + r.exams.filter { (it.subject.lowercase() + it.date) !in known }
                                }
                                if (r.profileNotes.isNotBlank()) s.aboutMe = (s.aboutMe.trim() + "\n" + r.profileNotes.trim()).trim()
                                summary = r.summary + "\n+${r.tasks.size} Aufgaben" + (if (r.exams.isNotEmpty()) ", +${r.exams.size} Termine" else "")
                            }
                            transcript = ""
                        } catch (e: Planner.PlannerException) {
                            ui.toast(e.message ?: "Fehler")
                        } catch (e: Exception) {
                            ui.toast("Fehler: ${e.message}")
                        } finally { busy = false }
                    }
                },
            ) { Text("In Aufgaben umwandeln") }
            if (busy) CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
            if (transcript.isNotBlank() && !busy) TextButton(onClick = { transcript = "" }) { Text("Leeren") }
        }
        if (summary.isNotBlank()) {
            Spacer(Modifier.height(8.dp))
            Text(summary, color = C.accent, fontSize = 13.sp)
        }
    }
}

@Composable
private fun DayPlanCard() {
    val ui = LocalUi.current
    val s = ui.store
    var busy by remember { mutableStateOf(false) }
    var wish by rememberSaveable { mutableStateOf("") }
    val today = LocalDate.now().toString()
    val plan = if (s.lastPlanDate == today) s.plan else emptyList()

    Section("Tagesplan") {
        if (plan.isEmpty()) Hint("Die KI baut aus deinen Aufgaben, dem Stundenplan und den Klausuren einen Zeitplan für den Rest des Tages.")
        else if (s.lastPlanAdvice.isNotBlank()) Text(s.lastPlanAdvice, color = C.text, fontSize = 14.sp)
        Spacer(Modifier.height(8.dp))
        plan.forEachIndexed { i, b ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 2.dp)) {
                Checkbox(
                    checked = b.done,
                    onCheckedChange = { done ->
                        if (b.taskId.isNotBlank()) {
                            val t = s.tasks.find { it.id == b.taskId }
                            Engine.completeTask(s, b.taskId, done)
                            if (done && t != null) ui.toast("Erledigt: +${Engine.taskXp(t)} XP")
                        }
                        s.plan = s.plan.mapIndexed { j, x -> if (j == i) x.copy(done = done) else x }
                    },
                    colors = CheckboxDefaults.colors(checkedColor = C.accent),
                )
                Text("${b.start}–${b.end}", color = kindColor(b.kind), fontSize = 13.sp, modifier = Modifier.width(96.dp))
                Text(
                    b.title, color = if (b.done) C.faint else C.text, modifier = Modifier.weight(1f),
                    textDecoration = if (b.done) TextDecoration.LineThrough else null,
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        OutlinedTextField(
            value = wish, onValueChange = { wish = it }, modifier = Modifier.fillMaxWidth(),
            placeholder = { Text("Wunsch für heute (optional), z. B. \"ab 19 Uhr frei\"") }, singleLine = true,
        )
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Button(
                enabled = !busy,
                onClick = {
                    if (s.apiKey.isBlank()) { ui.toast("Dafür braucht es einen API-Key (Mehr → KI)."); return@Button }
                    busy = true
                    ui.scope.launch {
                        try {
                            val r = withContext(Dispatchers.IO) { Planner(s).planDay(wish) }
                            s.plan = r.blocks
                            s.lastPlanAdvice = r.advice
                            s.lastPlanDate = today
                            if (r.agentTasks.isNotEmpty()) s.agentWaitTasks = r.agentTasks
                            wish = ""
                        } catch (e: Planner.PlannerException) {
                            ui.toast(e.message ?: "Fehler")
                        } catch (e: Exception) {
                            ui.toast("Fehler: ${e.message}")
                        } finally { busy = false }
                    }
                },
            ) { Text(if (plan.isEmpty()) "Tag planen" else "Neu planen") }
            Spacer(Modifier.width(10.dp))
            if (busy) CircularProgressIndicator(Modifier.size(24.dp), strokeWidth = 2.dp)
        }
    }
}

fun kindColor(kind: String) = when (kind) {
    "pause" -> C.faint
    "schule", "lernen" -> C.xp
    "agent" -> C.accent
    "routine" -> C.dim
    else -> C.warn
}

@Composable
private fun TaskListCard() {
    val ui = LocalUi.current
    val s = ui.store
    var newTitle by rememberSaveable { mutableStateOf("") }
    var showDone by remember { mutableStateOf(false) }
    val open = s.tasks.filter { !it.done }.sortedWith(compareBy({ it.priority }, { it.due.ifBlank { "9999" } }))
    val done = s.tasks.filter { it.done }.sortedByDescending { it.doneAt }

    Section("Aufgaben (${open.size} offen)") {
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = newTitle, onValueChange = { newTitle = it }, modifier = Modifier.weight(1f),
                placeholder = { Text("Neue Aufgabe") }, singleLine = true,
            )
            IconButton(onClick = {
                if (newTitle.isNotBlank()) { s.tasks = s.tasks + Task(title = newTitle.trim()); newTitle = "" }
            }) { Icon(Icons.Filled.Add, "Hinzufügen", tint = C.accent) }
        }
        Spacer(Modifier.height(6.dp))
        open.forEach { t -> TaskRow(t) }
        if (done.isNotEmpty()) {
            TextButton(onClick = { showDone = !showDone }) { Text(if (showDone) "Erledigte ausblenden" else "Erledigt (${done.size})") }
            if (showDone) {
                done.take(15).forEach { t -> TaskRow(t) }
                TextButton(onClick = { s.tasks = s.tasks.filter { !it.done } }) {
                    Text("Erledigte löschen", color = C.dim)
                }
            }
        }
    }
}

@Composable
private fun TaskRow(t: Task) {
    val ui = LocalUi.current
    val s = ui.store
    var cycle by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 2.dp)) {
        Checkbox(
            checked = t.done,
            onCheckedChange = {
                Engine.completeTask(s, t.id, it)
                if (it) ui.toast("Erledigt: +${Engine.taskXp(t)} XP")
            },
            colors = CheckboxDefaults.colors(checkedColor = C.accent),
        )
        Column(Modifier.weight(1f)) {
            Text(
                t.title, color = if (t.done) C.faint else C.text,
                textDecoration = if (t.done) TextDecoration.LineThrough else null,
            )
            val meta = listOfNotNull(
                "${t.estimateMin} Min",
                t.due.takeIf { it.isNotBlank() }?.let { "bis $it" },
                t.category.takeIf { it != "Allgemein" },
            ).joinToString(" · ")
            Text(meta, color = if (t.due.isNotBlank() && t.due < LocalDate.now().toString() && !t.done) C.bad else C.dim, fontSize = 12.sp)
        }
        if (!t.done) {
            TextButton(
                onClick = { s.tasks = s.tasks.map { if (it.id == t.id) it.copy(priority = if (it.priority >= 3) 1 else it.priority + 1) else it } },
                colors = ButtonDefaults.textButtonColors(contentColor = prioColor(t.priority)),
            ) { Text("P${t.priority}") }
        }
        IconButton(onClick = { s.tasks = s.tasks.filterNot { it.id == t.id } }) {
            Icon(Icons.Filled.Delete, "Löschen", tint = C.faint)
        }
    }
}
