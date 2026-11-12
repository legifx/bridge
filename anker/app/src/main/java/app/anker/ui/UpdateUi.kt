package app.anker.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.SystemUpdate
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.anker.LocalUi
import app.anker.update.Updater
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Beim Öffnen der App nach einer neuen Version schauen und sie anbieten.
 * "Später" gilt bis zum nächsten Start der App.
 */
@Composable
fun UpdateGate() {
    val ui = LocalUi.current
    val context = LocalContext.current
    var release by remember { mutableStateOf<Updater.Release?>(null) }
    var later by rememberSaveable { mutableStateOf(false) }
    var state by remember { mutableStateOf<Updater.State>(Updater.State.Idle) }

    LaunchedEffect(Unit) {
        if (!TestMode) release = withContext(Dispatchers.IO) { runCatching { Updater.checkIfDue(context) }.getOrNull() }
    }

    // Rückmeldung des Paketinstallers (z. B. falscher Schlüssel) einmal anzeigen.
    val error = ui.store.updateError
    if (error.isNotBlank()) {
        AlertDialog(
            onDismissRequest = { ui.store.updateError = "" },
            title = { Text("Update nicht installiert") },
            text = { Text(error) },
            confirmButton = { TextButton(onClick = { ui.store.updateError = "" }) { Text("OK") } },
        )
        return
    }

    val r = release ?: return
    if (later) return
    UpdateDialog(r, state, onLater = { later = true; state = Updater.State.Idle }) {
        ui.scope.launch(Dispatchers.IO) { Updater.downloadAndInstall(context.applicationContext, r) { state = it } }
    }
}

@Composable
private fun UpdateDialog(r: Updater.Release, state: Updater.State, onLater: () -> Unit, onInstall: () -> Unit) {
    val busy = state is Updater.State.Downloading || state is Updater.State.Installing
    AlertDialog(
        onDismissRequest = { if (!busy) onLater() },
        title = { Text("Anker ${r.versionName} ist da", fontFamily = Display, fontWeight = FontWeight.SemiBold) },
        text = {
            Column {
                if (r.notes.isNotBlank()) { Text(r.notes, color = C.dim, fontSize = 14.sp, lineHeight = 20.sp); Spacer(Modifier.height(12.dp)) }
                when (state) {
                    is Updater.State.Downloading -> {
                        Bar(state.percent / 100f, C.accent)
                        Spacer(Modifier.height(6.dp))
                        Text("Lade… ${state.percent} %", color = C.dim, fontSize = 13.sp)
                    }
                    Updater.State.Installing -> Text("Wird installiert. Android fragt eventuell einmal nach.", color = C.dim, fontSize = 13.sp)
                    is Updater.State.Failed -> Text(state.message, color = C.bad, fontSize = 13.sp)
                    Updater.State.Idle -> Text("Deine Daten bleiben erhalten.", color = C.dim, fontSize = 13.sp)
                }
            }
        },
        confirmButton = {
            if (!busy) Button(onClick = onInstall) { Text(if (state is Updater.State.Failed) "Nochmal versuchen" else "Installieren") }
        },
        dismissButton = { if (!busy) TextButton(onClick = onLater) { Text("Später") } },
    )
}

/** Zeile im Menü: installierte Version und manuelle Suche. */
@Composable
fun UpdateRow() {
    val ui = LocalUi.current
    val context = LocalContext.current
    var found by remember { mutableStateOf<Updater.Release?>(null) }
    var state by remember { mutableStateOf<Updater.State>(Updater.State.Idle) }
    var checking by remember { mutableStateOf(false) }

    MenuRow(
        Icons.Filled.SystemUpdate, "Version ${Updater.installedVersionName(context)}",
        if (checking) "Suche…" else "Nach Updates suchen", C.accent,
    ) {
        if (checking) return@MenuRow
        checking = true
        ui.scope.launch {
            val r = withContext(Dispatchers.IO) { runCatching { Updater.checkIfDue(context, force = true) }.getOrNull() }
            checking = false
            if (r == null) ui.toast("Du hast die neueste Version.") else found = r
        }
    }
    found?.let { r ->
        UpdateDialog(r, state, onLater = { found = null; state = Updater.State.Idle }) {
            ui.scope.launch(Dispatchers.IO) { Updater.downloadAndInstall(context.applicationContext, r) { state = it } }
        }
    }
}
