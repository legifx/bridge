package app.anker.filter

/**
 * Was der Netzfilter blockiert. Reine Logik ohne Android, per Unit-Test geprüft.
 *
 * Drei Ebenen:
 *  1. Nicht jugendfreie Seiten: eigene Liste eindeutiger Namen, zusätzlich filtert der
 *     vorgeschaltete DNS-Dienst (Cloudflare for Families) alles, was dort als solches geführt wird.
 *  2. SafeSearch: Suchmaschinen werden auf ihre gefilterte Variante umgeleitet.
 *  3. Netzsperre: Domains der Social-Media-Apps, solange Limit, Nachtzeit oder Fokus gilt.
 */
object Blocklist {

    enum class Verdict { ALLOW, BLOCK_CONTENT, BLOCK_LIMIT, SAFE_SEARCH }

    data class State(
        val contentFilter: Boolean,
        val safeSearch: Boolean,
        /** Domains, die gerade vom Netz getrennt sind (leer = keine Netzsperre aktiv). */
        val blockedAppDomains: Set<String>,
    )

    /** Namensbestandteile, die in einem Hostnamen eindeutig sind. */
    private val CONTENT_TOKENS = listOf(
        "porn", "xxx", "xvideos", "xhamster", "xnxx", "redtube", "youporn", "brazzers", "onlyfans",
        "chaturbate", "stripchat", "bongacams", "livejasmin", "hentai", "rule34", "nhentai", "spankbang",
        "eporner", "tnaflix", "fapello", "thothub", "nsfw", "camsoda", "myfreecams", "fansly", "manyvids",
        "hqporner", "redgifs", "gelbooru", "danbooru", "xbooru", "literotica", "motherless", "erome",
    )

    /** Einzelne Domains ohne eindeutigen Namensbestandteil. */
    private val CONTENT_DOMAINS = setOf(
        "e621.net", "cam4.com", "sex.com", "beeg.com", "tube8.com", "f95zone.to", "kemono.su", "kemono.party",
        "coomer.su", "coomer.party", "sankakucomplex.com", "daftsex.com",
        "scrolller.com", "imagefap.com", "txxx.com", "pornhub.org",
    )

    /** Suchmaschine → ihre fest gefilterte Adresse. */
    val SAFE_SEARCH = mapOf(
        "www.google.com" to "forcesafesearch.google.com",
        "google.com" to "forcesafesearch.google.com",
        "www.google.de" to "forcesafesearch.google.com",
        "google.de" to "forcesafesearch.google.com",
        "www.google.at" to "forcesafesearch.google.com",
        "www.google.ch" to "forcesafesearch.google.com",
        "www.google.co.uk" to "forcesafesearch.google.com",
        "www.bing.com" to "strict.bing.com",
        "bing.com" to "strict.bing.com",
        "duckduckgo.com" to "safe.duckduckgo.com",
        "www.duckduckgo.com" to "safe.duckduckgo.com",
    )

    /** Welche Domains zu welcher App gehören. Nur Apps aus deiner Limit-Liste werden getrennt. */
    val DOMAINS_BY_PACKAGE = mapOf(
        "com.zhiliaoapp.musically" to listOf("tiktok.com", "tiktokv.com", "tiktokcdn.com", "tiktokcdn-eu.com", "tiktokv.eu", "musical.ly", "byteoversea.com", "ibytedtos.com", "ttwstatic.com"),
        "com.ss.android.ugc.trill" to listOf("tiktok.com", "tiktokv.com", "tiktokcdn.com", "tiktokcdn-eu.com", "tiktokv.eu", "byteoversea.com", "ibytedtos.com"),
        "com.instagram.android" to listOf("instagram.com", "cdninstagram.com", "ig.me"),
        "com.instagram.barcelona" to listOf("threads.net", "threads.com"),
        "com.snapchat.android" to listOf("snapchat.com", "sc-cdn.net", "snap-dev.net", "sc-gw.com"),
        "com.google.android.youtube" to listOf("youtube.com", "googlevideo.com", "ytimg.com", "youtu.be", "youtubei.googleapis.com", "youtube-nocookie.com"),
        "com.reddit.frontpage" to listOf("reddit.com", "redd.it", "redditmedia.com", "redditstatic.com"),
        "com.twitter.android" to listOf("twitter.com", "x.com", "twimg.com"),
        "com.facebook.katana" to listOf("www.facebook.com", "m.facebook.com", "web.facebook.com", "b-graph.facebook.com"),
        "tv.twitch.android.app" to listOf("twitch.tv", "ttvnw.net", "jtvnw.net"),
        "com.pinterest" to listOf("pinterest.com", "pinterest.de", "pinimg.com"),
        "com.bereal.ft" to listOf("bere.al", "bereal.com"),
        "com.tumblr" to listOf("tumblr.com"),
        "com.ninegag.android.app" to listOf("9gag.com", "9cache.com"),
        "com.kick.mobile" to listOf("kick.com"),
        "com.netflix.mediaclient" to listOf("netflix.com", "nflxvideo.net", "nflximg.net", "nflxext.com"),
        "com.amazon.avod.thirdpartyclient" to listOf("primevideo.com", "aiv-cdn.net", "aiv-delivery.net"),
        "com.disney.disneyplus" to listOf("disneyplus.com", "disney-plus.net", "dssott.com", "bamgrid.com"),
        "com.discord" to listOf("discord.com", "discord.gg", "discordapp.com", "discordapp.net", "discord.media"),
    )

    fun domainsFor(packages: Set<String>): Set<String> =
        packages.flatMap { DOMAINS_BY_PACKAGE[it].orEmpty() }.toSet()

    fun isContentBlocked(host: String): Boolean {
        val h = normalize(host)
        if (matchesSuffix(h, CONTENT_DOMAINS)) return true
        return CONTENT_TOKENS.any { h.contains(it) }
    }

    fun decide(host: String, st: State): Verdict {
        val h = normalize(host)
        if (h.isEmpty()) return Verdict.ALLOW
        if (st.contentFilter && isContentBlocked(h)) return Verdict.BLOCK_CONTENT
        if (st.blockedAppDomains.isNotEmpty() && matchesSuffix(h, st.blockedAppDomains)) return Verdict.BLOCK_LIMIT
        if (st.contentFilter && st.safeSearch && h in SAFE_SEARCH) return Verdict.SAFE_SEARCH
        return Verdict.ALLOW
    }

    fun normalize(host: String): String = host.trim().trimEnd('.').lowercase()

    /** Ist [host] eine der Domains oder eine Subdomain davon? */
    fun matchesSuffix(host: String, domains: Set<String>): Boolean {
        var h = host
        while (true) {
            if (h in domains) return true
            val dot = h.indexOf('.')
            if (dot < 0) return false
            h = h.substring(dot + 1)
        }
    }
}
