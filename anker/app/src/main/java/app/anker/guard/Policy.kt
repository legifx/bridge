package app.anker.guard

import java.time.LocalTime

/**
 * Die gesamte Entscheidungslogik, ohne Android-Abhaengigkeiten — damit sie sich
 * per Unit-Test pruefen laesst. Der Waechter-Dienst sammelt nur Fakten ein und
 * fragt hier, was zu tun ist.
 */
object Policy {

    enum class AppClass { DOPAMINE, BROWSER, OTHER }
    enum class BlockReason { BUDGET, NIGHT, FOCUS, CONTENT }

    sealed class Decision {
        data object Allow : Decision()
        data class Intercept(val remainingMin: Int) : Decision()
        data class Block(val reason: BlockReason) : Decision()
    }

    data class Input(
        val now: LocalTime,
        val appClass: AppClass,
        val usedMin: Int,
        val budgetMin: Int,
        val nightEnabled: Boolean,
        val nightStart: LocalTime,
        val nightEnd: LocalTime,
        val nightBlockBrowsers: Boolean,
        val focusActive: Boolean,
        val unlockActive: Boolean,
        val hasPass: Boolean,
        val interceptEnabled: Boolean,
    )

    fun decide(i: Input): Decision {
        val night = i.nightEnabled && inWindow(i.now, i.nightStart, i.nightEnd)
        return when (i.appClass) {
            AppClass.OTHER -> Decision.Allow
            AppClass.BROWSER ->
                if (night && i.nightBlockBrowsers && !i.unlockActive) Decision.Block(BlockReason.NIGHT) else Decision.Allow
            AppClass.DOPAMINE -> when {
                i.unlockActive -> Decision.Allow
                i.focusActive -> Decision.Block(BlockReason.FOCUS)
                night -> Decision.Block(BlockReason.NIGHT)
                i.usedMin >= i.budgetMin -> Decision.Block(BlockReason.BUDGET)
                i.hasPass || !i.interceptEnabled -> Decision.Allow
                else -> Decision.Intercept(i.budgetMin - i.usedMin)
            }
        }
    }

    /** Liegt [t] im Fenster [start, end)? Fenster ueber Mitternacht sind erlaubt. */
    fun inWindow(t: LocalTime, start: LocalTime, end: LocalTime): Boolean =
        if (start == end) false
        else if (start < end) !t.isBefore(start) && t.isBefore(end)
        else !t.isBefore(start) || t.isBefore(end)

    fun parseTime(s: String, fallback: LocalTime): LocalTime =
        runCatching { LocalTime.parse(s.trim().padStart(5, '0')) }.getOrDefault(fallback)

    private fun containsWord(text: String, word: String): Boolean {
        var idx = text.indexOf(word)
        while (idx >= 0) {
            val before = if (idx == 0) ' ' else text[idx - 1]
            val afterIdx = idx + word.length
            val after = if (afterIdx >= text.length) ' ' else text[afterIdx]
            if (!before.isLetterOrDigit() && !after.isLetterOrDigit()) return true
            idx = text.indexOf(word, idx + 1)
        }
        return false
    }

    // ---- Inhalts-Waechter (Schutzfilter) -----------------------------------------------

    enum class ContentHit { PRIVATE_MODE, ADULT, SECURE_DNS }

    private val PRIVATE_PHRASES = listOf(
        "inkognitomodus", "inkognito-modus", "you've gone incognito", "you’ve gone incognito",
        "du bist jetzt im inkognito", "sie sind jetzt im inkognito", "privater modus", "private browsing",
        "privates surfen", "geheimmodus", "secret mode", "inprivate", "private tabs", "private tab",
        "privater tab", "private tabs", "privates fenster", "private window",
    )

    private val SECURE_DNS_PHRASES = listOf(
        "sicheres dns", "secure dns", "dns über https", "dns over https", "dns-over-https", "dns ueber https",
    )

    /** Domains/Tokens, die in einer Adresszeile eindeutig sind. */
    val ADULT_TOKENS = listOf(
        "porn", "xxx", "xvideos", "xhamster", "xnxx", "redtube", "youporn", "brazzers", "onlyfans",
        "chaturbate", "stripchat", "bongacams", "livejasmin", "cam4", "hentai", "rule34", "e621",
        "nhentai", "spankbang", "eporner", "tnaflix", "motherless", "fapello", "erome", "thothub",
        "nsfw", "camsoda", "myfreecams", "fansly", "manyvids", "sex.com", "beeg", "tube8", "hqporner",
        "porntrex", "daftsex", "literotica", "f95zone", "gelbooru", "danbooru", "sankaku", "kemono.",
        "coomer.", "redgifs", "sexvid", "xbooru",
    )

    /** Tokens, die auch im Fliesstext eines Fensters eindeutig genug sind. */
    private val ADULT_PAGE_TOKENS = listOf(
        "pornhub", "xvideos", "xhamster", "xnxx", "onlyfans", "chaturbate", "redgifs", "rule34",
        "nhentai", "spankbang", "stripchat", "brazzers", "fansly",
    )

    private val NSFW_APP_PACKAGES = setOf(
        "com.reddit.frontpage", "com.twitter.android", "org.telegram.messenger", "com.tumblr",
        "com.discord", "com.instagram.android", "com.zhiliaoapp.musically", "com.ss.android.ugc.trill",
    )

    fun contentViolation(
        pkg: String,
        appClass: AppClass,
        text: String,
        urlText: String,
        blockPrivate: Boolean,
        scanContent: Boolean,
    ): ContentHit? {
        if (appClass == AppClass.BROWSER) {
            if (blockPrivate && PRIVATE_PHRASES.any { text.contains(it) }) return ContentHit.PRIVATE_MODE
            if (SECURE_DNS_PHRASES.any { text.contains(it) }) return ContentHit.SECURE_DNS
            val url = urlText.lowercase()
            if (url.isNotBlank() && ADULT_TOKENS.any { url.contains(it) }) return ContentHit.ADULT
            if (scanContent && ADULT_PAGE_TOKENS.any { text.contains(it) }) return ContentHit.ADULT
        }
        if (scanContent && pkg in NSFW_APP_PACKAGES) {
            if (containsWord(text, "nsfw") || text.contains("18+") || text.contains("sensible inhalte") ||
                text.contains("sensitive content") || ADULT_PAGE_TOKENS.any { text.contains(it) }
            ) return ContentHit.ADULT
        }
        return null
    }

    /** Web-Versionen der Dopamin-Apps, damit der Browser kein Schlupfloch ist. */
    private val DOPAMINE_WEB = listOf(
        "tiktok.com", "instagram.com", "youtube.com/shorts", "m.youtube.com/shorts", "reddit.com",
        "x.com", "twitter.com", "facebook.com", "twitch.tv", "9gag.com", "snapchat.com", "pinterest.",
        "kick.com", "tumblr.com",
    )

    fun isDopamineUrl(urlText: String): Boolean {
        val url = urlText.lowercase().removePrefix("https://").removePrefix("http://").removePrefix("www.")
        if (url.isBlank()) return false
        return DOPAMINE_WEB.any { d -> url.startsWith(d) || url.contains(".$d") || url.contains("/$d") }
    }
}
