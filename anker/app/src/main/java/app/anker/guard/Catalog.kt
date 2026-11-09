package app.anker.guard

import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.view.inputmethod.InputMethodManager

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

    val KNOWN_BROWSERS = setOf(
        "com.android.chrome", "com.chrome.beta", "com.chrome.dev", "com.chrome.canary",
        "org.mozilla.firefox", "org.mozilla.firefox_beta", "org.mozilla.fenix", "org.mozilla.focus",
        "org.mozilla.klar", "com.sec.android.app.sbrowser", "com.sec.android.app.sbrowser.beta",
        "com.brave.browser", "com.opera.browser", "com.opera.mini.native", "com.opera.gx",
        "com.microsoft.emmx", "com.duckduckgo.mobile.android", "com.kiwibrowser.browser",
        "com.vivaldi.browser", "com.yandex.browser", "com.UCMobile.intl", "com.mi.globalbrowser",
        "com.android.browser", "com.huawei.browser", "com.heytap.browser", "org.chromium.chrome",
        "com.ecosia.android", "com.cloudmosa.puffinFree", "mark.via.gp", "com.qwant.liberty",
        "org.torproject.torbrowser", "info.guardianproject.orfox", "com.aloha.browser",
        "com.google.android.googlequicksearchbox",
    )

    /** View-IDs der Adresszeile in verbreiteten Browsern. */
    val URL_BAR_IDS = listOf(
        "com.android.chrome:id/url_bar", "com.chrome.beta:id/url_bar", "org.chromium.chrome:id/url_bar",
        "org.mozilla.firefox:id/mozac_browser_toolbar_url_view", "org.mozilla.fenix:id/mozac_browser_toolbar_url_view",
        "com.sec.android.app.sbrowser:id/location_bar_edit_text", "com.sec.android.app.sbrowser:id/custom_tab_toolbar_url_bar_text",
        "com.brave.browser:id/url_bar", "com.opera.browser:id/url_field", "com.microsoft.emmx:id/url_bar",
        "com.duckduckgo.mobile.android:id/omnibarTextInput", "com.kiwibrowser.browser:id/url_bar",
        "com.vivaldi.browser:id/url_bar", "com.ecosia.android:id/url_bar",
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

    fun isBrowser(context: Context, pkg: String): Boolean {
        if (pkg in KNOWN_BROWSERS) return true
        return browserPackages(context).contains(pkg)
    }

    @Volatile private var browserCache: Set<String>? = null
    fun browserPackages(context: Context): Set<String> {
        browserCache?.let { return it }
        val pm = context.packageManager
        val i = Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://example.com"))
        val set = pm.queryIntentActivities(i, PackageManager.MATCH_ALL).map { it.activityInfo.packageName }.toSet()
        browserCache = set
        return set
    }

    @Volatile private var imeCache: Set<String>? = null
    fun inputMethods(context: Context): Set<String> {
        imeCache?.let { return it }
        val imm = context.getSystemService(InputMethodManager::class.java)
        val set = imm?.inputMethodList?.map { it.packageName }?.toSet() ?: emptySet()
        imeCache = set
        return set
    }

    fun launcherPackages(context: Context): Set<String> {
        val i = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        return context.packageManager.queryIntentActivities(i, 0).map { it.activityInfo.packageName }.toSet()
    }
}
