package app.anker.filter

/**
 * DNS-Anfragen aus IPv4/UDP-Paketen lesen und Antworten bauen. Reine Byte-Arbeit ohne
 * Android, damit sie sich mit festen Testpaketen prüfen lässt.
 */
object DnsPacket {

    const val TYPE_A = 1
    const val TYPE_AAAA = 28

    class Query(
        val srcIp: ByteArray,
        val dstIp: ByteArray,
        val srcPort: Int,
        val dstPort: Int,
        /** Die DNS-Nachricht selbst (ohne IP- und UDP-Kopf). */
        val dns: ByteArray,
        val name: String,
        val qtype: Int,
        /** Ende des Frage-Abschnitts innerhalb von [dns]. */
        val questionEnd: Int,
    )

    private fun u8(b: ByteArray, i: Int) = b[i].toInt() and 0xFF
    private fun u16(b: ByteArray, i: Int) = (u8(b, i) shl 8) or u8(b, i + 1)
    private fun put16(b: ByteArray, i: Int, v: Int) { b[i] = (v shr 8).toByte(); b[i + 1] = v.toByte() }

    /** Liest ein IPv4/UDP-Paket an Port 53. Alles andere ergibt null. */
    fun parseQuery(packet: ByteArray, length: Int): Query? {
        if (length < 28) return null
        if (u8(packet, 0) shr 4 != 4) return null
        val ihl = (u8(packet, 0) and 0x0F) * 4
        if (ihl < 20 || length < ihl + 8) return null
        if (u8(packet, 9) != 17) return null // nur UDP
        val total = minOf(u16(packet, 2), length)
        val srcPort = u16(packet, ihl)
        val dstPort = u16(packet, ihl + 2)
        if (dstPort != 53) return null
        val dnsStart = ihl + 8
        val dnsLen = total - dnsStart
        if (dnsLen < 17) return null
        val dns = packet.copyOfRange(dnsStart, dnsStart + dnsLen)
        if (u8(dns, 2) and 0x80 != 0) return null // ist schon eine Antwort
        if (u16(dns, 4) < 1) return null
        val (name, end) = readName(dns, 12) ?: return null
        if (end + 4 > dns.size) return null
        return Query(
            packet.copyOfRange(12, 16), packet.copyOfRange(16, 20), srcPort, dstPort,
            dns, name, u16(dns, end), end + 4,
        )
    }

    /** Liest einen (unkomprimierten) Namen ab [offset]; gibt Namen und Position danach zurück. */
    private fun readName(dns: ByteArray, offset: Int): Pair<String, Int>? {
        val sb = StringBuilder()
        var i = offset
        while (true) {
            if (i >= dns.size) return null
            val len = u8(dns, i)
            if (len == 0) return sb.toString() to i + 1
            if (len and 0xC0 != 0) return null // Kompression kommt in Fragen nicht vor
            if (i + 1 + len > dns.size) return null
            if (sb.isNotEmpty()) sb.append('.')
            for (k in 1..len) sb.append((u8(dns, i + k)).toChar())
            i += len + 1
        }
    }

    /** Überspringt einen Namen (auch komprimiert) und gibt die Position danach zurück. */
    private fun skipName(dns: ByteArray, offset: Int): Int {
        var i = offset
        while (i < dns.size) {
            val len = u8(dns, i)
            if (len == 0) return i + 1
            if (len and 0xC0 == 0xC0) return i + 2
            i += len + 1
        }
        return -1
    }

    private fun header(q: Query, rcode: Int, answers: Int): ByteArray {
        val h = ByteArray(12)
        h[0] = q.dns[0]; h[1] = q.dns[1]
        // QR=1, Opcode 0, RD wie in der Frage, RA=1
        h[2] = (0x80 or (u8(q.dns, 2) and 0x01)).toByte()
        h[3] = (0x80 or rcode).toByte()
        put16(h, 4, 1)
        put16(h, 6, answers)
        return h
    }

    private fun question(q: Query) = q.dns.copyOfRange(12, q.questionEnd)

    /** "Gibt es nicht" (NXDOMAIN) als Antwort auf [q]. */
    fun blockedResponse(q: Query): ByteArray = header(q, 3, 0) + question(q)

    /** Erfolgreiche, aber leere Antwort (z. B. für AAAA, wenn nur IPv4 umgeleitet wird). */
    fun emptyResponse(q: Query): ByteArray = header(q, 0, 0) + question(q)

    /** Antwort mit festen IPv4-Adressen. */
    fun addressResponse(q: Query, addresses: List<ByteArray>, ttl: Int = 300): ByteArray {
        var out = header(q, 0, addresses.size) + question(q)
        for (a in addresses) {
            val rr = ByteArray(16)
            rr[0] = 0xC0.toByte(); rr[1] = 0x0C // Zeiger auf den Namen in der Frage
            put16(rr, 2, TYPE_A); put16(rr, 4, 1)
            rr[6] = (ttl ushr 24).toByte(); rr[7] = (ttl ushr 16).toByte(); rr[8] = (ttl ushr 8).toByte(); rr[9] = ttl.toByte()
            put16(rr, 10, 4)
            System.arraycopy(a, 0, rr, 12, 4)
            out += rr
        }
        return out
    }

    /** Eine frische A-Anfrage für [name] bauen. */
    fun buildQuery(id: Int, name: String): ByteArray {
        val labels = name.trimEnd('.').split('.')
        val out = ByteArray(12 + labels.sumOf { it.length + 1 } + 1 + 4)
        put16(out, 0, id)
        out[2] = 0x01 // RD
        put16(out, 4, 1)
        var i = 12
        for (l in labels) {
            out[i++] = l.length.toByte()
            for (c in l) out[i++] = c.code.toByte()
        }
        out[i++] = 0
        put16(out, i, TYPE_A); put16(out, i + 2, 1)
        return out
    }

    /** Alle IPv4-Adressen aus einer DNS-Antwort. */
    fun parseARecords(dns: ByteArray): List<ByteArray> {
        if (dns.size < 12) return emptyList()
        val qd = u16(dns, 4)
        val an = u16(dns, 6)
        var i = 12
        repeat(qd) {
            i = skipName(dns, i)
            if (i < 0) return emptyList()
            i += 4
        }
        val out = ArrayList<ByteArray>()
        repeat(an) {
            i = skipName(dns, i)
            if (i < 0 || i + 10 > dns.size) return out
            val type = u16(dns, i)
            val len = u16(dns, i + 8)
            i += 10
            if (i + len > dns.size) return out
            if (type == TYPE_A && len == 4) out += dns.copyOfRange(i, i + 4)
            i += len
        }
        return out
    }

    /** Verpackt eine DNS-Antwort in IPv4 + UDP, Absender und Empfänger gegenüber [q] vertauscht. */
    fun wrapResponse(q: Query, dns: ByteArray): ByteArray {
        val total = 20 + 8 + dns.size
        val p = ByteArray(total)
        p[0] = 0x45
        put16(p, 2, total)
        p[6] = 0x40 // nicht fragmentieren
        p[8] = 64 // TTL
        p[9] = 17 // UDP
        System.arraycopy(q.dstIp, 0, p, 12, 4)
        System.arraycopy(q.srcIp, 0, p, 16, 4)
        put16(p, 10, ipChecksum(p, 0, 20))
        put16(p, 20, q.dstPort)
        put16(p, 22, q.srcPort)
        put16(p, 24, 8 + dns.size)
        // UDP-Prüfsumme 0 = nicht berechnet, bei IPv4 erlaubt
        System.arraycopy(dns, 0, p, 28, dns.size)
        return p
    }

    fun ipChecksum(b: ByteArray, offset: Int, length: Int): Int {
        var sum = 0L
        var i = offset
        while (i < offset + length) {
            sum += u16(b, i).toLong()
            i += 2
        }
        while (sum shr 16 != 0L) sum = (sum and 0xFFFF) + (sum shr 16)
        return (sum.inv() and 0xFFFF).toInt()
    }
}
