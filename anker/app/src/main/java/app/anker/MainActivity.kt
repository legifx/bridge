package app.anker

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import app.anker.data.Engine
import app.anker.data.Store
import app.anker.filter.FilterService
import app.anker.ui.AnkerTheme
import app.anker.ui.AppBackground
import app.anker.ui.NavBar
import app.anker.ui.C
import app.anker.ui.HomeScreen
import app.anker.ui.MoreScreen
import app.anker.ui.PlanScreen
import app.anker.ui.StatsScreen
import app.anker.ui.UpdateGate
import app.anker.usage.Usage
import app.anker.util.Catalog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

/** Was der Startbildschirm und die Statistik ueber die Handynutzung wissen muessen. */
data class Dash(
    val ready: Boolean = false,
    val permission: Boolean = false,
    val usedMin: Int = 0,
    val totalMin: Int = 0,
    val apps: List<Triple<String, Int, Boolean>> = emptyList(), // Label, Minuten, zaehlt zum Budget
)

/** Gemeinsame Werkzeuge fuer alle Bildschirme. */
class Ui(
    val store: Store,
    val snackbar: SnackbarHostState,
    val scope: CoroutineScope,
    val refresh: () -> Unit,
    val navigate: (String) -> Unit,
) {
    fun toast(msg: String) { scope.launch { snackbar.showSnackbar(msg) } }
}

/**
 * Bewusst kein statisches Local: Bei jeder Änderung im Speicher wird ein neues [Ui] bereitgestellt,
 * und genau die Bildschirmteile, die es lesen, zeichnen sich neu. Sonst blieben z. B. abgehakte
 * Aufgaben stehen, bis zufällig etwas anderes ein Neuzeichnen auslöst.
 */
val LocalUi = compositionLocalOf<Ui> { error("kein Ui") }

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val route = intent?.getStringExtra("route")
        setContent { AnkerTheme { App(route) } }
    }
}

@Composable
private fun App(initialRoute: String?) {
    val context = LocalContext.current
    val store = remember { Store.get(context) }
    val version by store.version.collectAsState()
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var sub by rememberSaveable { mutableStateOf(initialRoute ?: "") }
    var dash by remember { mutableStateOf(Dash()) }
    var reload by remember { mutableIntStateOf(0) }

    val notifPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {}
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
        withContext(Dispatchers.IO) {
            if (!store.catalogSeeded) {
                store.dopaminePackages = Catalog.defaultDopamineSet(context)
                store.catalogSeeded = true
            }
        }
        if (!store.setupDone) { tab = 3; sub = "setup" }
    }

    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) { reload++ }

    // Nutzungsdaten laden: beim Start, beim Zurueckkehren in die App und jede Minute.
    LaunchedEffect(reload, version) {
        dash = withContext(Dispatchers.IO) { loadDash(context, store) }
    }
    LaunchedEffect(Unit) {
        while (!app.anker.ui.TestMode) { delay(60_000); reload++ }
    }

    val ui = remember(version) { Ui(store, snackbar, scope, { reload++ }, { r -> tab = 3; sub = r }) }

    BackHandler(enabled = sub.isNotEmpty() || tab != 0) {
        if (sub.isNotEmpty()) sub = "" else tab = 0
    }

    CompositionLocalProvider(LocalUi provides ui) {
        UpdateGate()
        AppBackground {
            Scaffold(
                containerColor = Color.Transparent,
                snackbarHost = {
                    SnackbarHost(snackbar) { data ->
                        Snackbar(data, containerColor = C.surface2, contentColor = C.text, shape = RoundedCornerShape(18.dp))
                    }
                },
                bottomBar = {
                    NavBar(
                        items = listOf(
                            "Heute" to Icons.Filled.Home,
                            "Plan" to Icons.Filled.Checklist,
                            "Statistik" to Icons.Filled.BarChart,
                            "Mehr" to Icons.Filled.MoreHoriz,
                        ),
                        selected = tab,
                        onSelect = { tab = it; sub = "" },
                        modifier = Modifier.navigationBarsPadding(),
                    )
                },
            ) { pad ->
                Box(
                    Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState())
                        .padding(PaddingValues(horizontal = 18.dp, vertical = 14.dp))
                ) {
                    when (tab) {
                        0 -> HomeScreen(dash)
                        1 -> PlanScreen()
                        2 -> StatsScreen(dash)
                        else -> MoreScreen(sub) { sub = it }
                    }
                }
            }
        }
    }
}

private fun loadDash(context: android.content.Context, s: Store): Dash {
    if (!Usage.hasPermission(context)) { FilterService.sync(context); return Dash(ready = true, permission = false) }
    Engine.applyDuePending(s)
    FilterService.sync(context)
    Engine.closePastDays(context, s)
    val map = Usage.todayMillis(context)
    val exclude = Engine.excludedFromTotal(context)
    val apps = map.filterKeys { it !in exclude }
        .map { (pkg, ms) -> Triple(Catalog.label(context, pkg), (ms / 60000L).toInt(), pkg in s.dopaminePackages) }
        .filter { it.second > 0 }
        .sortedByDescending { it.second }
    return Dash(
        ready = true,
        permission = true,
        usedMin = Engine.usedMinutesToday(context, s, map),
        totalMin = Usage.totalMinutes(map, exclude),
        apps = apps,
    )
}

fun todayString(): String = LocalDate.now().toString()
