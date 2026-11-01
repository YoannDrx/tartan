package coach.tartan.uploadservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

// L'envoi lui-même reste dans l'app : ce service garde le processus en vie et le processeur éveillé
// quand l'écran s'éteint, et montre la progression. Rien du contenu de la vidéo ne passe par lui.
class UploadForegroundService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    val power = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "tartan:upload").apply {
      setReferenceCounted(false)
      acquire(WAKE_LOCK_TIMEOUT_MS)
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val notification = buildNotification(
      this,
      channelId,
      intent?.getStringExtra(EXTRA_TITLE) ?: "",
      intent?.getStringExtra(EXTRA_TEXT) ?: "",
      null,
    )
    try {
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC else 0
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    } catch (_: Exception) {
      stopSelf()
    }
    // Sans relance par le système : c'est la file de l'app qui sait quoi envoyer, à sa prochaine ouverture.
    return START_NOT_STICKY
  }

  // Android 15 borne un service de synchronisation à 6 h par jour : il faut s'arrêter à temps.
  override fun onTimeout(startId: Int, fgsType: Int) {
    stopSelf()
  }

  override fun onDestroy() {
    wakeLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
    running = false
    super.onDestroy()
  }

  companion object {
    private const val NOTIFICATION_ID = 7240
    private const val EXTRA_TITLE = "title"
    private const val EXTRA_TEXT = "text"
    private const val WAKE_LOCK_TIMEOUT_MS = 2 * 60 * 60 * 1000L

    @Volatile private var running = false
    @Volatile private var channelId = "envois"

    fun start(
      context: Context,
      channel: String,
      channelName: String,
      channelDetail: String,
      title: String,
      text: String,
    ): Boolean {
      channelId = channel
      createChannel(context, channel, channelName, channelDetail)
      if (running) {
        notify(context, title, text, null)
        return true
      }
      val intent = Intent(context, UploadForegroundService::class.java)
        .putExtra(EXTRA_TITLE, title)
        .putExtra(EXTRA_TEXT, text)
      return try {
        ContextCompat.startForegroundService(context, intent)
        running = true
        true
      } catch (_: Exception) {
        // ForegroundServiceStartNotAllowedException : l'app est en arrière-plan.
        false
      }
    }

    fun update(context: Context, title: String, text: String, percent: Int) {
      if (running) notify(context, title, text, percent)
    }

    fun stop(context: Context) {
      if (running) context.stopService(Intent(context, UploadForegroundService::class.java))
      running = false
    }

    private fun notify(context: Context, title: String, text: String, percent: Int?) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.notify(NOTIFICATION_ID, buildNotification(context, channelId, title, text, percent))
    }

    private fun createChannel(context: Context, id: String, name: String, detail: String) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      // Sans effet si le canal existe déjà : l'utilisateur garde ses réglages.
      manager.createNotificationChannel(
        NotificationChannel(id, name, NotificationManager.IMPORTANCE_LOW).apply { description = detail },
      )
    }

    private fun buildNotification(
      context: Context,
      channel: String,
      title: String,
      text: String,
      percent: Int?,
    ): Notification {
      val resources = context.resources
      val icon = resources.getIdentifier("notification_icon", "drawable", context.packageName)
      val color = resources.getIdentifier("notification_icon_color", "color", context.packageName)
      val open = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
        PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
      }
      return NotificationCompat.Builder(context, channel)
        .setSmallIcon(if (icon != 0) icon else context.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(text)
        .setContentIntent(open)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setCategory(NotificationCompat.CATEGORY_PROGRESS)
        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
        .setProgress(100, percent ?: 0, percent == null)
        .apply { if (color != 0) setColor(ContextCompat.getColor(context, color)) }
        .build()
    }
  }
}
