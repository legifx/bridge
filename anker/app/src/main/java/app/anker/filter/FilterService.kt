package app.anker.filter

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import app.anker.MainActivity
import app.anker.Notify
import app.anker.R
import app.anker.data.Engine
import app.anker.data.Store
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.time.LocalDate
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * Der Netzfilter: ein lokales VPN, über das ausschließlich DNS-Anfragen laufen.
 *
 * Android schickt jede Namensauflösung ("wo liegt tiktok.com?") an eine Adresse, die nur
 * in diesem Tunnel existiert. Der Dienst beantwortet gesperrte Namen selbst mit "gibt es
 * nicht" und reicht alle anderen an einen filternden DNS-Dienst weiter. Der eigentliche
 * Datenverkehr geht nicht durch den Tunnel, nichts wird mitgelesen, nichts verlässt das
 * Gerät außer der Namensanfrage selbst.
 *
 * Es ist dasselbe Prinzip wie bei lokalen Werbeblockern. Abschalten lässt er sich jederzeit
 * in den Android-Einstellungen unter VPN; die App merkt das und zeigt es an.
 */
class FilterService : VpnService() {

    private var tun: ParcelFileDescriptor? = null
    private var reader: Thread? = null
    private var pool: ExecutorService? = null
    private var out: FileOutputStream? = null
    @Volatile private var state = Blocklist.State(true, true, emptySet())
    @Volatile private var stateAt = 0L
    private val blocked = AtomicInteger(0)

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            shutdown()
            stopSelf()
            return START_NOT_STICKY
        }
        showForeground()
        startTunnel()
        return START_STICKY
    }

    private fun startTunnel() {
        if (tun != null) return
        val store = Store.get(this)
        val builder = Builder()
            .setSession("Anker")
            .addAddress(TUN_ADDRESS, 32)
            .addDnsServer(DNS_ADDRESS)
            .addRoute(DNS_ADDRESS, 32)
            .setBlocking(true)
        if (Build.VERSION.SDK_INT >= 29) builder.setMetered(false)
        val pfd = runCatching { builder.establish() }.getOrNull()
        if (pfd == null) { // Zustimmung fehlt (noch) oder ein anderes VPN ist fest eingestellt
            running = false
            stopSelf()
            return
        }
        tun = pfd
        running = true
        store.filterRevokedAt = 0L
        out = FileOutputStream(pfd.fileDescriptor)
        pool = Executors.newFixedThreadPool(6)
        reader = Thread({ readLoop(FileInputStream(pfd.fileDescriptor)) }, "anker-dns").apply { start() }
    }

    private fun readLoop(input: FileInputStream) {
        val buf = ByteArray(4096)
        while (tun != null) {
            val n = try { input.read(buf) } catch (e: Exception) { break }
            if (n <= 0) continue
            val q = DnsPacket.parseQuery(buf, n) ?: continue
            val p = pool ?: break
            runCatching { p.execute { handle(q) } }
        }
    }

    private fun handle(q: DnsPacket.Query) {
        val st = currentState()
        val answer: ByteArray? = when (Blocklist.decide(q.name, st)) {
            Blocklist.Verdict.BLOCK_CONTENT, Blocklist.Verdict.BLOCK_LIMIT -> {
                countBlocked()
                DnsPacket.blockedResponse(q)
            }
            Blocklist.Verdict.SAFE_SEARCH -> safeSearch(q)
            Blocklist.Verdict.ALLOW -> forward(q.dns)
        }
        if (answer != null) write(DnsPacket.wrapResponse(q, answer))
    }

    /** Suchmaschine auf ihre gefilterte Adresse umbiegen. */
    private fun safeSearch(q: DnsPacket.Query): ByteArray? {
        if (q.qtype == DnsPacket.TYPE_AAAA) return DnsPacket.emptyResponse(q)
        if (q.qtype != DnsPacket.TYPE_A) return forward(q.dns)
        val target = Blocklist.SAFE_SEARCH[Blocklist.normalize(q.name)] ?: return forward(q.dns)
        val reply = forward(DnsPacket.buildQuery(q.dns[0].toInt() shl 8 or (q.dns[1].toInt() and 0xFF) and 0xFFFF, target))
        val addrs = reply?.let { DnsPacket.parseARecords(it) }.orEmpty()
        return if (addrs.isEmpty()) forward(q.dns) else DnsPacket.addressResponse(q, addrs)
    }

    /** Anfrage an den filternden DNS-Dienst schicken, am Tunnel vorbei. */
    private fun forward(dns: ByteArray): ByteArray? {
        for (server in UPSTREAM) {
            try {
                DatagramSocket().use { sock ->
                    protect(sock)
                    sock.soTimeout = 3000
                    sock.send(DatagramPacket(dns, dns.size, InetAddress.getByName(server), 53))
                    val buf = ByteArray(4096)
                    val resp = DatagramPacket(buf, buf.size)
                    sock.receive(resp)
                    return buf.copyOf(resp.length)
                }
            } catch (e: Exception) {
                // nächsten Server versuchen
            }
        }
        return null
    }

    private fun write(packet: ByteArray) {
        val o = out ?: return
        synchronized(o) { runCatching { o.write(packet) } }
    }

    /** Welche Regeln gelten gerade? Alle 20 Sekunden neu berechnet, nicht bei jeder Anfrage. */
    private fun currentState(): Blocklist.State {
        val now = System.currentTimeMillis()
        if (now - stateAt < 20_000) return state
        stateAt = now
        val s = Store.get(this)
        val block = runCatching {
            (s.netBlockNight && Engine.nightActive(s)) ||
                (s.netBlockLimit && (Engine.focusActive(s) || Engine.usedMinutesToday(this, s) >= s.budgetMin))
        }.getOrDefault(false)
        state = Blocklist.State(
            contentFilter = true,
            safeSearch = s.filterSafeSearch,
            blockedAppDomains = if (block) Blocklist.domainsFor(s.dopaminePackages) else emptySet(),
        )
        flushCount(s)
        return state
    }

    private fun countBlocked() { blocked.incrementAndGet() }

    private fun flushCount(s: Store) {
        val n = blocked.getAndSet(0)
        val today = LocalDate.now().toString()
        if (s.filterBlockedDay != today) { s.filterBlockedDay = today; s.filterBlockedCount = n }
        else if (n > 0) s.filterBlockedCount = s.filterBlockedCount + n
    }

    /** Android hat den Tunnel getrennt (in den Einstellungen ausgeschaltet oder anderes VPN gestartet). */
    override fun onRevoke() {
        val s = Store.get(this)
        if (s.filterEnabled) {
            s.filterRevokedAt = System.currentTimeMillis()
            Notify.show(this, Notify.ID_FILTER, "Anker ist getrennt", "Der Schutz läuft gerade nicht. Tippe, um ihn wieder einzuschalten.")
        }
        shutdown()
        stopSelf()
    }

    override fun onDestroy() {
        shutdown()
        super.onDestroy()
    }

    private fun shutdown() {
        running = false
        val t = tun
        tun = null
        runCatching { t?.close() }
        pool?.shutdownNow(); pool = null
        out = null
        reader = null
        runCatching { stopForeground(STOP_FOREGROUND_REMOVE) }
    }

    private fun showForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        if (nm.getNotificationChannel(CHANNEL) == null) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Status", NotificationManager.IMPORTANCE_MIN).apply { setShowBadge(false) }
            )
        }
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val n: Notification = NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat)
            .setContentTitle("Anker aktiv")
            .setContentIntent(open)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
        runCatching {
            if (Build.VERSION.SDK_INT >= 34) startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            else startForeground(NOTIFICATION_ID, n)
        }
    }

    companion object {
        private const val ACTION_STOP = "app.anker.filter.STOP"
        private const val CHANNEL = "status"
        private const val NOTIFICATION_ID = 40
        private const val TUN_ADDRESS = "10.111.222.1"
        private const val DNS_ADDRESS = "10.111.222.2"

        /** Cloudflare for Families: filtert Schadsoftware und nicht jugendfreie Inhalte. */
        private val UPSTREAM = listOf("1.1.1.3", "1.0.0.3", "2606:4700:4700::1113")

        @Volatile var running = false
            private set

        /** Startet den Filter, sofern Android die Zustimmung schon hat. */
        fun start(context: Context): Boolean {
            if (prepare(context) != null) return false
            return runCatching {
                ContextCompat.startForegroundService(context, Intent(context, FilterService::class.java))
            }.isSuccess
        }

        /**
         * Bringt den Dienst in den Zustand, den die Einstellungen verlangen: aus, wenn der Filter
         * abgeschaltet wurde (z. B. nach Ablauf der 24 Stunden); an, wenn er an sein soll und nur
         * der Prozess beendet wurde. Hast du ihn selbst in den Android-Einstellungen getrennt,
         * bleibt er aus, bis du ihn in der App wieder einschaltest.
         */
        fun sync(context: Context) {
            val s = Store.get(context)
            if (!s.filterEnabled) stop(context)
            else if (!running && s.filterRevokedAt == 0L) start(context)
        }

        fun stop(context: Context) {
            if (!running) return
            runCatching { context.startService(Intent(context, FilterService::class.java).setAction(ACTION_STOP)) }
        }
    }
}
