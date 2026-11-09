package app.anker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Unter Robolectric (Screenshot-Test) laufen keine Endlos-Timer, sonst wird der Test nie fertig. */
val TestMode: Boolean = android.os.Build.FINGERPRINT == "robolectric"

object C {
    val bg = Color(0xFF0E1116)
    val surface = Color(0xFF171B22)
    val surface2 = Color(0xFF20262F)
    val text = Color(0xFFE8ECF1)
    val dim = Color(0xFF9AA4B2)
    val faint = Color(0xFF5E6875)
    val accent = Color(0xFF4FD1C5)   // Teal: gut
    val warn = Color(0xFFF6AD55)     // Orange: knapp
    val bad = Color(0xFFFC6D6D)      // Rot: drueber
    val xp = Color(0xFFB794F4)       // Violett: Punkte
}

@Composable
fun AnkerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = C.accent, onPrimary = Color(0xFF00201D),
            secondary = C.xp, background = C.bg, surface = C.surface,
            surfaceVariant = C.surface2, onSurface = C.text, onBackground = C.text,
            onSurfaceVariant = C.dim, error = C.bad, outline = C.faint,
        ),
        content = content,
    )
}

fun budgetColor(used: Int, budget: Int): Color = when {
    budget <= 0 || used >= budget -> C.bad
    used * 100 / budget >= 80 -> C.warn
    else -> C.accent
}

@Composable
fun Section(title: String? = null, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = C.surface),
    ) {
        Column(Modifier.padding(16.dp)) {
            if (title != null) {
                Text(title.uppercase(), color = C.dim, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.2.sp)
                Spacer(Modifier.height(10.dp))
            }
            content()
        }
    }
}

@Composable
fun Ring(progress: Float, color: Color, size: Dp = 168.dp, stroke: Dp = 14.dp, center: @Composable () -> Unit) {
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val s = stroke.toPx()
            val arcSize = Size(this.size.width - s, this.size.height - s)
            val topLeft = Offset(s / 2, s / 2)
            drawArc(C.surface2, 135f, 270f, false, topLeft, arcSize, style = Stroke(s, cap = StrokeCap.Round))
            drawArc(color, 135f, 270f * progress.coerceIn(0f, 1f), false, topLeft, arcSize, style = Stroke(s, cap = StrokeCap.Round))
        }
        center()
    }
}

@Composable
fun Bar(progress: Float, color: Color, modifier: Modifier = Modifier, height: Dp = 8.dp) {
    Box(modifier.fillMaxWidth().height(height).background(C.surface2, RoundedCornerShape(50))) {
        Box(Modifier.fillMaxWidth(progress.coerceIn(0f, 1f)).height(height).background(color, RoundedCornerShape(50)))
    }
}

@Composable
fun Stat(value: String, label: String, color: Color = C.text, modifier: Modifier = Modifier) {
    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = color, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(label, color = C.dim, fontSize = 11.sp, textAlign = TextAlign.Center)
    }
}

@Composable
fun Dot(color: Color, size: Dp = 8.dp) {
    Box(Modifier.size(size).background(color, CircleShape))
}

@Composable
fun MenuRow(icon: ImageVector, title: String, sub: String? = null, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, null, tint = C.accent)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = C.text, fontSize = 16.sp)
            if (sub != null) Text(sub, color = C.dim, fontSize = 12.sp)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = C.faint)
    }
}

@Composable
fun SubHeader(title: String, onBack: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 8.dp)) {
        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zurück", tint = C.text) }
        Text(title, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = C.text)
    }
}

@Composable
fun Hint(text: String) {
    Text(text, color = C.dim, fontSize = 13.sp, lineHeight = 18.sp)
}

@Composable
fun SpacedColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
}

/** Einfaches Balkendiagramm: [values] mit Beschriftungen, eine Linie bei [limit]. */
@Composable
fun BarChart(values: List<Int>, labels: List<String>, limit: Int, highlightLast: Boolean = true) {
    val max = (values.maxOrNull() ?: 0).coerceAtLeast(limit).coerceAtLeast(1)
    Column {
        Box(Modifier.fillMaxWidth().height(140.dp)) {
            Canvas(Modifier.matchParentSize()) {
                val n = values.size.coerceAtLeast(1)
                val slot = size.width / n
                val barW = slot * 0.55f
                values.forEachIndexed { i, v ->
                    val h = size.height * v / max
                    val color = when {
                        v > limit -> C.bad
                        highlightLast && i == values.lastIndex -> C.accent
                        else -> C.accent.copy(alpha = 0.55f)
                    }
                    drawRoundRect(
                        color, Offset(i * slot + (slot - barW) / 2, size.height - h), Size(barW, h),
                        androidx.compose.ui.geometry.CornerRadius(6f, 6f),
                    )
                }
                val y = size.height - size.height * limit / max
                drawLine(C.warn, Offset(0f, y), Offset(size.width, y), strokeWidth = 2f,
                    pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(10f, 8f)))
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 4.dp)) {
            labels.forEach { Text(it, Modifier.weight(1f), color = C.dim, fontSize = 11.sp, textAlign = TextAlign.Center) }
        }
    }
}
