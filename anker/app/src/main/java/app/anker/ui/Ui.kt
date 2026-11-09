package app.anker.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ProvideTextStyle
import androidx.compose.material3.Shapes
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.anker.R

/** Unter Robolectric (Screenshot-Test) laufen keine Endlos-Timer, sonst wird der Test nie fertig. */
val TestMode: Boolean = android.os.Build.FINGERPRINT == "robolectric"

/** Farben: tiefes Tintenblau als Grund, Seegrün als Akzent, Bernstein und Koralle als Warnstufen. */
object C {
    val bg = Color(0xFF080C14)
    val surface = Color(0xFF101623)
    val surface2 = Color(0xFF182032)
    val border = Color(0xFF222C42)
    val text = Color(0xFFEEF2F8)
    val dim = Color(0xFF94A1B8)
    val faint = Color(0xFF5A667D)
    val accent = Color(0xFF5EEAD4)   // Seegrün: alles im Rahmen
    val accent2 = Color(0xFF38BDF8)  // Himmelblau: zweite Farbe im Verlauf
    val warn = Color(0xFFFBBF24)     // Bernstein: wird knapp
    val bad = Color(0xFFFB7185)      // Koralle: drüber
    val xp = Color(0xFFA78BFA)       // Violett: Punkte
    val onAccent = Color(0xFF04201C)
}

val Display = FontFamily(Font(R.font.sora_semibold, FontWeight.SemiBold), Font(R.font.sora_bold, FontWeight.Bold))
val Body = FontFamily(
    Font(R.font.inter_regular, FontWeight.Normal),
    Font(R.font.inter_medium, FontWeight.Medium),
    Font(R.font.inter_semibold, FontWeight.SemiBold),
    Font(R.font.inter_semibold, FontWeight.Bold),
)

@Composable
fun AnkerTheme(content: @Composable () -> Unit) {
    val base = Typography()
    fun TextStyle.body() = copy(fontFamily = Body, letterSpacing = 0.sp)
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = C.accent, onPrimary = C.onAccent,
            secondary = C.xp, background = C.bg, surface = C.surface,
            surfaceVariant = C.surface2, onSurface = C.text, onBackground = C.text,
            onSurfaceVariant = C.dim, error = C.bad, outline = C.border, outlineVariant = C.border,
            surfaceContainerHigh = C.surface2, surfaceContainer = C.surface, surfaceContainerHighest = C.surface2,
            primaryContainer = C.accent, onPrimaryContainer = C.onAccent,
            secondaryContainer = C.surface2, onSecondaryContainer = C.text,
        ),
        typography = Typography(
            bodyLarge = base.bodyLarge.body(), bodyMedium = base.bodyMedium.body(), bodySmall = base.bodySmall.body(),
            labelLarge = base.labelLarge.body().copy(fontWeight = FontWeight.SemiBold), labelMedium = base.labelMedium.body(),
            labelSmall = base.labelSmall.body(), titleLarge = base.titleLarge.copy(fontFamily = Display),
            titleMedium = base.titleMedium.body(), titleSmall = base.titleSmall.body(),
            headlineSmall = base.headlineSmall.copy(fontFamily = Display, fontWeight = FontWeight.SemiBold),
        ),
        shapes = Shapes(
            extraSmall = RoundedCornerShape(14.dp), small = RoundedCornerShape(14.dp),
            medium = RoundedCornerShape(18.dp), large = RoundedCornerShape(24.dp), extraLarge = RoundedCornerShape(28.dp),
        ),
        content = content,
    )
}

fun budgetColor(used: Int, budget: Int): Color = when {
    budget <= 0 || used >= budget -> C.bad
    used * 100 / budget >= 80 -> C.warn
    else -> C.accent
}

/** Hintergrund der ganzen App: dunkel, mit einem schwachen Lichtschein oben. */
@Composable
fun AppBackground(content: @Composable () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(C.bg).background(
            Brush.radialGradient(
                listOf(C.accent.copy(alpha = 0.10f), Color.Transparent),
                center = Offset(200f, -120f), radius = 1100f,
            )
        )
    ) { content() }
}

@Composable
fun ScreenTitle(title: String, sub: String? = null) {
    Column {
        Text(title, fontFamily = Display, fontWeight = FontWeight.Bold, fontSize = 30.sp, color = C.text, letterSpacing = (-0.5).sp)
        if (sub != null) Text(sub, color = C.dim, fontSize = 14.sp)
    }
}

@Composable
fun Section(title: String? = null, modifier: Modifier = Modifier, tint: Color? = null, content: @Composable ColumnScope.() -> Unit) {
    val shape = RoundedCornerShape(24.dp)
    val bg = if (tint == null) Brush.verticalGradient(listOf(C.surface, C.surface))
    else Brush.verticalGradient(listOf(lerp(C.surface, tint, 0.13f), C.surface))
    Column(
        modifier.fillMaxWidth().clip(shape).background(bg)
            .border(1.dp, if (tint == null) C.border else lerp(C.border, tint, 0.35f), shape)
            .padding(18.dp)
    ) {
        if (title != null) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(width = 3.dp, height = 12.dp).background(tint ?: C.accent, RoundedCornerShape(2.dp)))
                Spacer(Modifier.width(8.dp))
                Text(title.uppercase(), color = C.dim, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.3.sp)
            }
            Spacer(Modifier.height(12.dp))
        }
        content()
    }
}

/** Fortschrittsring mit Farbverlauf, Skalenstrichen und leuchtendem Endpunkt. */
@Composable
fun Ring(progress: Float, color: Color, size: Dp = 200.dp, stroke: Dp = 16.dp, center: @Composable () -> Unit) {
    val target = progress.coerceIn(0f, 1f)
    val shown by animateFloatAsState(target, tween(if (TestMode) 0 else 900), label = "ring")
    val second = if (color == C.accent) C.accent2 else lerp(color, Color.White, 0.25f)
    Box(Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val s = stroke.toPx()
            val inset = s / 2 + 10.dp.toPx()
            val arcSize = Size(this.size.width - inset * 2, this.size.height - inset * 2)
            val topLeft = Offset(inset, inset)
            // Skala: 28 kurze Striche aussen
            val c = Offset(this.size.width / 2, this.size.height / 2)
            for (i in 0..27) {
                val a = 135f + 270f * i / 27f
                rotate(a, c) {
                    drawLine(
                        if (i / 27f <= shown && shown > 0f) color.copy(alpha = 0.55f) else C.border,
                        Offset(this.size.width - 5.dp.toPx(), c.y), Offset(this.size.width - 1.dp.toPx(), c.y),
                        strokeWidth = 1.5.dp.toPx(), cap = StrokeCap.Round,
                    )
                }
            }
            drawArc(lerp(C.surface2, C.text, 0.06f), 135f, 270f, false, topLeft, arcSize, style = Stroke(s, cap = StrokeCap.Round))
            if (shown > 0f) {
                rotate(135f, c) {
                    drawArc(
                        Brush.sweepGradient(0f to second, 0.75f to color, 0.9f to color, 1f to second, center = c),
                        0f, 270f * shown, false, topLeft, arcSize, style = Stroke(s, cap = StrokeCap.Round),
                    )
                }
                // Endpunkt mit Schein
                val r = arcSize.width / 2
                val ang = Math.toRadians((135f + 270f * shown).toDouble())
                val end = Offset(c.x + r * kotlin.math.cos(ang).toFloat(), c.y + r * kotlin.math.sin(ang).toFloat())
                drawCircle(color.copy(alpha = 0.25f), s * 0.95f, end)
                drawCircle(Color.White, s * 0.22f, end)
            }
        }
        center()
    }
}

@Composable
fun Bar(progress: Float, color: Color, modifier: Modifier = Modifier, height: Dp = 8.dp) {
    Box(modifier.fillMaxWidth().height(height).background(C.surface2, RoundedCornerShape(50))) {
        val p = progress.coerceIn(0f, 1f)
        if (p > 0f) Box(
            Modifier.fillMaxWidth(p).height(height)
                .background(Brush.horizontalGradient(listOf(color.copy(alpha = 0.65f), color)), RoundedCornerShape(50))
        )
    }
}

/** Kennzahl als Kachel. In einer Row teilen sich mehrere den Platz gleichmaessig. */
@Composable
fun RowScope.Stat(value: String, label: String, color: Color = C.text) {
    Column(
        Modifier.weight(1f).padding(horizontal = 4.dp).clip(RoundedCornerShape(16.dp)).background(C.surface2.copy(alpha = 0.7f))
            .defaultMinSize(minHeight = 78.dp).padding(vertical = 12.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
    ) {
        Text(value, color = color, fontFamily = Display, fontWeight = FontWeight.SemiBold, fontSize = 19.sp, maxLines = 1)
        Spacer(Modifier.height(2.dp))
        Text(label.replace("\n", " "), color = C.dim, fontSize = 11.sp, textAlign = TextAlign.Center, lineHeight = 14.sp)
    }
}

@Composable
fun Dot(color: Color, size: Dp = 8.dp) {
    Box(Modifier.size(size).background(color, CircleShape))
}

/** Kleines farbiges Etikett. */
@Composable
fun Pill(text: String, color: Color, modifier: Modifier = Modifier) {
    Text(
        text, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
        modifier = modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.14f)).padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

/** Hauptknopf: Pille mit Verlauf. Gleiche Parameter wie der Material-Button. */
@Composable
fun Button(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    color: Color = C.accent,
    content: @Composable RowScope.() -> Unit,
) {
    val shape = RoundedCornerShape(50)
    val second = if (color == C.accent) C.accent2 else lerp(color, Color.White, 0.2f)
    Row(
        modifier.defaultMinSize(minHeight = 46.dp).clip(shape)
            .background(if (enabled) Brush.horizontalGradient(listOf(color, second)) else Brush.horizontalGradient(listOf(C.surface2, C.surface2)))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(PaddingValues(horizontal = 22.dp, vertical = 12.dp)),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        CompositionLocalProvider(LocalContentColor provides if (enabled) C.onAccent else C.faint) {
            ProvideTextStyle(TextStyle(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = if (enabled) C.onAccent else C.faint)) {
                content()
            }
        }
    }
}

/** Zweitknopf: Umriss. */
@Composable
fun OutlinedButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, content: @Composable RowScope.() -> Unit) {
    val shape = RoundedCornerShape(50)
    Row(
        modifier.defaultMinSize(minHeight = 44.dp).clip(shape).background(C.surface2.copy(alpha = 0.5f))
            .border(BorderStroke(1.dp, C.border), shape).clickable(enabled = enabled, onClick = onClick)
            .padding(PaddingValues(horizontal = 20.dp, vertical = 11.dp)),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        CompositionLocalProvider(LocalContentColor provides C.accent) {
            ProvideTextStyle(TextStyle(fontFamily = Body, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = C.accent)) { content() }
        }
    }
}

/** Runde Checkbox. Gleiche Parameter wie die Material-Checkbox. */
@Composable
fun Checkbox(checked: Boolean, onCheckedChange: (Boolean) -> Unit, color: Color = C.accent) {
    val fill by animateColorAsState(if (checked) color else Color.Transparent, label = "check")
    Box(
        Modifier.size(44.dp).toggleable(
            value = checked, interactionSource = remember { MutableInteractionSource() }, indication = null,
            role = Role.Checkbox, onValueChange = onCheckedChange,
        ),
        contentAlignment = Alignment.Center,
    ) {
        Box(
            Modifier.size(24.dp).clip(CircleShape).background(fill).border(2.dp, if (checked) color else C.faint, CircleShape),
            contentAlignment = Alignment.Center,
        ) {
            if (checked) Icon(Icons.Filled.Check, null, tint = C.onAccent, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
fun MenuRow(icon: ImageVector, title: String, sub: String? = null, tint: Color = C.accent, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).clickable(onClick = onClick).padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(42.dp).background(tint.copy(alpha = 0.13f), RoundedCornerShape(13.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, color = C.text, fontSize = 16.sp, fontWeight = FontWeight.Medium)
            if (sub != null) Text(sub, color = C.dim, fontSize = 12.sp, lineHeight = 16.sp)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = C.faint)
    }
}

@Composable
fun SubHeader(title: String, onBack: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 4.dp)) {
        Box(
            Modifier.size(40.dp).clip(CircleShape).background(C.surface).border(1.dp, C.border, CircleShape).clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Zurück", tint = C.text, modifier = Modifier.size(20.dp)) }
        Spacer(Modifier.width(14.dp))
        Text(title, fontFamily = Display, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = C.text, letterSpacing = (-0.3).sp)
    }
}

@Composable
fun Hint(text: String) {
    Text(text, color = C.dim, fontSize = 13.sp, lineHeight = 19.sp)
}

@Composable
fun SpacedColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
}

/** Balkendiagramm mit Wert über jedem Balken und einer gestrichelten Linie bei [limit]. */
@Composable
fun BarChart(values: List<Int>, labels: List<String>, limit: Int, highlightLast: Boolean = true, overColor: Color = C.bad) {
    val max = (values.maxOrNull() ?: 0).coerceAtLeast(limit).coerceAtLeast(1)
    Column {
        Row(Modifier.fillMaxWidth()) {
            values.forEachIndexed { i, v ->
                Text(
                    if (v > 0) "$v" else "", Modifier.weight(1f), textAlign = TextAlign.Center, fontSize = 11.sp,
                    color = if (v > limit) overColor else if (i == values.lastIndex) C.text else C.faint, fontWeight = FontWeight.Medium,
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        Box(Modifier.fillMaxWidth().height(130.dp)) {
            Canvas(Modifier.matchParentSize()) {
                val n = values.size.coerceAtLeast(1)
                val slot = size.width / n
                val barW = slot * 0.5f
                val radius = CornerRadius(barW / 2, barW / 2)
                values.forEachIndexed { i, v ->
                    val x = i * slot + (slot - barW) / 2
                    drawRoundRect(C.surface2.copy(alpha = 0.6f), Offset(x, 0f), Size(barW, size.height), radius)
                    val h = (size.height * v / max).coerceAtLeast(if (v > 0) barW else 0f)
                    if (h > 0f) {
                        val top = if (v > limit) overColor else C.accent
                        val bottom = if (v > limit) overColor.copy(alpha = 0.5f) else C.accent2.copy(alpha = 0.7f)
                        val a = if (highlightLast && i != values.lastIndex && v <= limit) 0.55f else 1f
                        drawRoundRect(
                            Brush.verticalGradient(listOf(top, bottom), startY = size.height - h, endY = size.height),
                            Offset(x, size.height - h), Size(barW, h), radius, alpha = a,
                        )
                    }
                }
                val y = size.height - size.height * limit / max
                drawLine(C.warn.copy(alpha = 0.8f), Offset(0f, y), Offset(size.width, y), strokeWidth = 1.5.dp.toPx(),
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f)))
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            labels.forEachIndexed { i, l ->
                Text(l, Modifier.weight(1f), color = if (i == labels.lastIndex) C.text else C.dim, fontSize = 11.sp, textAlign = TextAlign.Center)
            }
        }
    }
}

/** Schwebende Navigationsleiste. */
@Composable
fun NavBar(items: List<Pair<String, ImageVector>>, selected: Int, onSelect: (Int) -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(26.dp)
    Row(
        modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp).clip(shape).background(C.surface)
            .border(1.dp, C.border, shape).padding(6.dp),
        horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically,
    ) {
        items.forEachIndexed { i, (label, icon) ->
            val on = i == selected
            Row(
                Modifier.weight(if (on) 1.5f else 1f).height(48.dp).clip(RoundedCornerShape(20.dp))
                    .background(if (on) C.accent.copy(alpha = 0.14f) else Color.Transparent)
                    .clickable { onSelect(i) },
                horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(icon, label, tint = if (on) C.accent else C.faint, modifier = Modifier.size(22.dp))
                if (on) {
                    Spacer(Modifier.width(8.dp))
                    Text(label, color = C.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                }
            }
        }
    }
}
