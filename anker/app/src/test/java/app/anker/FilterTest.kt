package app.anker

import app.anker.filter.Blocklist
import app.anker.filter.Blocklist.Verdict
import app.anker.filter.DnsPacket
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class FilterTest {
    private val on = Blocklist.State(contentFilter = true, safeSearch = true, blockedAppDomains = emptySet())

    // ---- Blockliste ----

    @Test fun contentSitesAreBlockedIncludingSubdomains() {
        for (h in listOf("pornhub.com", "www.xvideos.com", "de.xhamster.com", "e621.net", "static.e621.net", "ONLYFANS.com.", "cdn.redgifs.com"))
            assertEquals(h, Verdict.BLOCK_CONTENT, Blocklist.decide(h, on))
    }

    @Test fun ordinarySitesPass() {
        for (h in listOf("wikipedia.org", "api.anthropic.com", "whatsapp.net", "sussex.ac.uk", "essex.gov.uk", "claude.ai", "github.com", "www.youtube.com"))
            assertEquals(h, Verdict.ALLOW, Blocklist.decide(h, on))
    }

    @Test fun safeSearchOnlyForSearchEnginesAndOnlyWhenOn() {
        assertEquals(Verdict.SAFE_SEARCH, Blocklist.decide("www.google.com", on))
        assertEquals(Verdict.SAFE_SEARCH, Blocklist.decide("duckduckgo.com", on))
        assertEquals(Verdict.ALLOW, Blocklist.decide("mail.google.com", on))
        assertEquals(Verdict.ALLOW, Blocklist.decide("www.google.com", on.copy(safeSearch = false)))
    }

    @Test fun netBlockCutsOnlyListedApps() {
        val domains = Blocklist.domainsFor(setOf("com.zhiliaoapp.musically", "com.reddit.frontpage"))
        val st = on.copy(blockedAppDomains = domains)
        assertEquals(Verdict.BLOCK_LIMIT, Blocklist.decide("www.tiktok.com", st))
        assertEquals(Verdict.BLOCK_LIMIT, Blocklist.decide("v16-webapp.tiktokcdn.com", st))
        assertEquals(Verdict.BLOCK_LIMIT, Blocklist.decide("i.redd.it", st))
        assertEquals(Verdict.ALLOW, Blocklist.decide("www.instagram.com", st)) // nicht in der Liste
        assertEquals(Verdict.ALLOW, Blocklist.decide("web.whatsapp.com", st))
        assertEquals(Verdict.ALLOW, Blocklist.decide("nottiktok.com", st)) // kein Suffix-Treffer mitten im Namen
        assertEquals(Verdict.ALLOW, Blocklist.decide("www.tiktok.com", on)) // ohne aktive Sperre frei
    }

    @Test fun suffixMatch() {
        val set = setOf("redd.it", "x.com")
        assertTrue(Blocklist.matchesSuffix("a.b.redd.it", set))
        assertTrue(Blocklist.matchesSuffix("x.com", set))
        assertFalse(Blocklist.matchesSuffix("netflix.com", set))
        assertFalse(Blocklist.matchesSuffix("it", set))
    }

    // ---- DNS-Pakete ----

    /** IPv4/UDP-Paket mit einer A-Anfrage von 10.111.222.1:40000 an 10.111.222.2:53. */
    private fun packet(name: String, qtype: Int = DnsPacket.TYPE_A, dstPort: Int = 53): ByteArray {
        val dns = DnsPacket.buildQuery(0xBEEF, name).also { it[it.size - 3] = qtype.toByte() }
        val p = ByteArray(28 + dns.size)
        p[0] = 0x45; p[2] = (p.size shr 8).toByte(); p[3] = p.size.toByte(); p[8] = 64; p[9] = 17
        byteArrayOf(10, 111, 222.toByte(), 1).copyInto(p, 12)
        byteArrayOf(10, 111, 222.toByte(), 2).copyInto(p, 16)
        p[20] = (40000 shr 8).toByte(); p[21] = 40000.toByte(); p[22] = (dstPort shr 8).toByte(); p[23] = dstPort.toByte()
        val udpLen = 8 + dns.size
        p[24] = (udpLen shr 8).toByte(); p[25] = udpLen.toByte()
        dns.copyInto(p, 28)
        return p
    }

    @Test fun parsesQuery() {
        val p = packet("www.Example.com")
        val q = DnsPacket.parseQuery(p, p.size)
        assertNotNull(q)
        assertEquals("www.Example.com", q!!.name)
        assertEquals(DnsPacket.TYPE_A, q.qtype)
        assertEquals(40000, q.srcPort)
        assertEquals(53, q.dstPort)
        assertEquals(q.dns.size, q.questionEnd)
    }

    @Test fun ignoresEverythingThatIsNotADnsQuery() {
        val other = packet("example.com", dstPort = 443)
        assertNull(DnsPacket.parseQuery(other, other.size))
        val tcp = packet("example.com").also { it[9] = 6 }
        assertNull(DnsPacket.parseQuery(tcp, tcp.size))
        val v6 = packet("example.com").also { it[0] = 0x60 }
        assertNull(DnsPacket.parseQuery(v6, v6.size))
        assertNull(DnsPacket.parseQuery(ByteArray(10), 10))
        val truncated = packet("example.com")
        assertNull(DnsPacket.parseQuery(truncated, 30))
    }

    @Test fun blockedResponseIsNxdomainWithSameIdAndQuestion() {
        val p = packet("blocked.example")
        val q = DnsPacket.parseQuery(p, p.size)!!
        val r = DnsPacket.blockedResponse(q)
        assertEquals(0xBE.toByte(), r[0]); assertEquals(0xEF.toByte(), r[1])
        assertEquals(0x81, r[2].toInt() and 0xFF)          // Antwort, Rekursion gewünscht
        assertEquals(3, r[3].toInt() and 0x0F)             // NXDOMAIN
        assertArrayEquals(q.dns.copyOfRange(12, q.questionEnd), r.copyOfRange(12, r.size))
    }

    @Test fun addressResponseRoundTrips() {
        val p = packet("www.google.com")
        val q = DnsPacket.parseQuery(p, p.size)!!
        val ips = listOf(byteArrayOf(216.toByte(), 239.toByte(), 38, 120), byteArrayOf(1, 2, 3, 4))
        val r = DnsPacket.addressResponse(q, ips)
        val parsed = DnsPacket.parseARecords(r)
        assertEquals(2, parsed.size)
        assertArrayEquals(ips[0], parsed[0]); assertArrayEquals(ips[1], parsed[1])
        assertTrue(DnsPacket.parseARecords(DnsPacket.emptyResponse(q)).isEmpty())
    }

    @Test fun wrappedResponseSwapsEndpointsAndHasValidChecksum() {
        val p = packet("example.com")
        val q = DnsPacket.parseQuery(p, p.size)!!
        val dns = DnsPacket.blockedResponse(q)
        val w = DnsPacket.wrapResponse(q, dns)
        assertEquals(28 + dns.size, w.size)
        assertArrayEquals(byteArrayOf(10, 111, 222.toByte(), 2), w.copyOfRange(12, 16)) // Absender = DNS-Adresse
        assertArrayEquals(byteArrayOf(10, 111, 222.toByte(), 1), w.copyOfRange(16, 20))
        assertEquals(53, ((w[20].toInt() and 0xFF) shl 8) or (w[21].toInt() and 0xFF))
        assertEquals(40000, ((w[22].toInt() and 0xFF) shl 8) or (w[23].toInt() and 0xFF))
        assertEquals(0, DnsPacket.ipChecksum(w, 0, 20)) // Prüfsumme über den Kopf inkl. Prüfsumme ergibt 0
        assertArrayEquals(dns, w.copyOfRange(28, w.size))
    }

    @Test fun parsesCompressedAnswerFromRealServerShape() {
        // Antwort mit CNAME (komprimiert) und einem A-Eintrag dahinter
        val p = packet("a.example")
        val q = DnsPacket.parseQuery(p, p.size)!!
        val head = DnsPacket.emptyResponse(q).also { it[7] = 2 }
        val cname = byteArrayOf(0xC0.toByte(), 0x0C, 0, 5, 0, 1, 0, 0, 0, 60, 0, 4, 1, 'b'.code.toByte(), 0xC0.toByte(), 0x0E)
        val a = byteArrayOf(0xC0.toByte(), 0x0C, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 9, 8, 7, 6)
        val parsed = DnsPacket.parseARecords(head + cname + a)
        assertEquals(1, parsed.size)
        assertArrayEquals(byteArrayOf(9, 8, 7, 6), parsed[0])
    }
}
