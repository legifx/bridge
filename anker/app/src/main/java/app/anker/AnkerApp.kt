package app.anker

import android.app.Application
import app.anker.check.CheckReceiver
import app.anker.data.Store

class AnkerApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notify.ensureChannel(this)
        val s = Store.get(this)
        if (s.installedAt == 0L) s.installedAt = System.currentTimeMillis()
        CheckReceiver.schedule(this)
    }
}
