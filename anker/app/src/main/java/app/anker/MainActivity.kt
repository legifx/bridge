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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
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
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import app.anker.data.Engine
import app.anker.data.Store
import app.anker.ui.AnkerTheme
import app.anker.ui.C
import app.anker.ui.HomeScreen
import app.anker.ui.MoreScreen
import app.anker.ui.PlanScreen
import app.anker.ui.StatsScreen
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

val LocalUi = staticCompositionLocalOf<Ui> { error("kein Ui") }

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

    val ui = remember { Ui(store, snackbar, scope, { reload++ }, { r -> tab = 3; sub = r }) }

    BackHandler(enabled = sub.isNotEmpty() || tab != 0) {
        if (sub.isNotEmpty()) sub = "" else tab = 0
    }

    CompositionLocalProvider(LocalUi provides ui) {
        Scaffold(
            containerColor = C.bg,
            snackbarHost = { SnackbarHost(snackbar) },
            bottomBar = {
                NavigationBar(containerColor = C.surface) {
                    val items = listOf(
                        Triple("Heute", Icons.Filled.Home, 0),
                        Triple("Plan", Icons.Filled.Checklist, 1),
                        Triple("Statistik", Icons.Filled.BarChart, 2),
                        Triple("Mehr", Icons.Filled.MoreHoriz, 3),
                    )
                    items.forEach { (label, icon, i) ->
                        NavigationBarItem(
                            selected = tab == i,
                            onClick = { tab = i; sub = "" },
                            icon = { Icon(icon, label) },
                            label = { Text(label) },
                            colors = NavigationBarItemDefaults.colors(indicatorColor = C.surface2),
                        )
                    }
                }
            },
        ) { pad ->
            Box(Modifier.fillMaxSize().padding(pad)) {
                Box(
                    Modifier.fillMaxSize().verticalScroll(rememberScrollState())
                        .padding(PaddingValues(horizontal = 16.dp, vertical = 12.dp))
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
    if (!Usage.hasPermission(context)) return Dash(ready = true, permission = false)
    Engine.applyDuePending(s)
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
