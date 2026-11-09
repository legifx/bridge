package app.anker.util

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo

/** Welche Apps sind was? Bekannte Listen plus das, was auf dem Handy installiert ist. */
object Catalog {

    /** Bekannte High-Dopamin-Apps. Spiele werden zusaetzlich ueber die App-Kategorie erkannt. */
    val KNOWN_DOPAMINE = mapOf(
        "com.zhiliaoapp.musically" to "TikTok",
        "com.ss.android.ugc.trill" to "TikTok",
        "com.zhiliaoapp.musically.go" to "TikTok Lite",
        "com.ss.android.ugc.tiktok.lite" to "TikTok Lite",
        "com.instagram.android" to "Instagram",
        "com.instagram.barcelona" to "Threads",
        "com.snapchat.android" to "Snapchat",
        "com.google.android.youtube" to "YouTube",
        "app.revanced.android.youtube" to "YouTube ReVanced",
        "com.reddit.frontpage" to "Reddit",
        "com.twitter.android" to "X",
        "com.facebook.katana" to "Facebook",
        "com.facebook.lite" to "Facebook Lite",
        "tv.twitch.android.app" to "Twitch",
        "com.pinterest" to "Pinterest",
        "com.bereal.ft" to "BeReal",
        "com.tumblr" to "Tumblr",
        "com.ninegag.android.app" to "9GAG",
        "com.kick.mobile" to "Kick",
        "com.lemon.lvoverseas" to "CapCut",
        "com.vk.vkvideo" to "VK Video",
        "com.netflix.mediaclient" to "Netflix",
        "com.amazon.avod.thirdpartyclient" to "Prime Video",
        "com.disney.disneyplus" to "Disney+",
        "com.discord" to "Discord",
        "com.joyreactor" to "Joyreactor",
    )

    private val ALWAYS_ALLOWED = setOf(
        "app.anker", "com.android.systemui", "com.whatsapp", "com.whatsapp.w4b", "com.anthropic.claude",
        "com.google.android.dialer", "com.android.dialer", "com.samsung.android.dialer",
        "com.google.android.apps.messaging", "com.samsung.android.messaging", "org.thoughtcrime.securesms",
        "com.google.android.apps.maps", "com.android.phone", "com.google.android.calendar",
    )

    data class AppEntry(val pkg: String, val label: String, val isGame: Boolean, val known: Boolean)

    fun launchableApps(context: Context): List<AppEntry> {
        val pm = context.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val infos = pm.queryIntentActivities(intent, 0)
        return infos.map { it.activityInfo.applicationInfo }
            .distinctBy { it.packageName }
            .filter { it.packageName != context.packageName }
            .map { ai ->
                AppEntry(
                    pkg = ai.packageName,
                    label = ai.loadLabel(pm).toString(),
                    isGame = isGame(ai),
                    known = ai.packageName in KNOWN_DOPAMINE,
                )
            }
            .sortedWith(compareByDescending<AppEntry> { it.known || it.isGame }.thenBy { it.label.lowercase() })
    }

    @Suppress("DEPRECATION")
    fun isGame(ai: ApplicationInfo): Boolean =
        ai.category == ApplicationInfo.CATEGORY_GAME || (ai.flags and ApplicationInfo.FLAG_IS_GAME) != 0

    /** Startliste: alle installierten bekannten Dopamin-Apps und alle Spiele. */
    fun defaultDopamineSet(context: Context): Set<String> =
        launchableApps(context).filter { (it.known || it.isGame) && it.pkg !in ALWAYS_ALLOWED }.map { it.pkg }.toSet() +
            KNOWN_DOPAMINE.keys // auch noch nicht installierte, damit eine Neuinstallation sofort zaehlt

    fun label(context: Context, pkg: String): String =
        runCatching {
            val pm = context.packageManager
            pm.getApplicationInfo(pkg, 0).loadLabel(pm).toString()
        }.getOrElse { KNOWN_DOPAMINE[pkg] ?: pkg }

    fun launcherPackages(context: Context): Set<String> {
        val i = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        return context.packageManager.queryIntentActivities(i, 0).map { it.activityInfo.packageName }.toSet()
    }
}
