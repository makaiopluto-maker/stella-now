package now.stella.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

public class MusicKeepAliveService extends Service {
  static final String ACTION_START = "now.stella.app.MUSIC_START";
  static final String ACTION_STOP = "now.stella.app.MUSIC_STOP";
  static final String EXTRA_TITLE = "title";
  static final String EXTRA_ARTIST = "artist";
  private static final String CHANNEL_ID = "stella_music_playback";
  private static final int NOTIFY_ID = 9101;

  static void start(Context context, String title, String artist) {
    Intent intent = new Intent(context, MusicKeepAliveService.class);
    intent.setAction(ACTION_START);
    intent.putExtra(EXTRA_TITLE, title == null ? "StellaNow" : title);
    intent.putExtra(EXTRA_ARTIST, artist == null ? "" : artist);
    if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
    else context.startService(intent);
  }

  static void stop(Context context) {
    Intent intent = new Intent(context, MusicKeepAliveService.class);
    intent.setAction(ACTION_STOP);
    context.startService(intent);
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent != null && ACTION_STOP.equals(intent.getAction())) {
      stopForeground(STOP_FOREGROUND_REMOVE);
      stopSelf();
      return START_NOT_STICKY;
    }

    String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : "StellaNow";
    String artist = intent != null ? intent.getStringExtra(EXTRA_ARTIST) : "";
    if (title == null || title.isEmpty()) title = "StellaNow";
    ensureChannel();
    Notification notification = buildNotification(title, artist);
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFY_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIFY_ID, notification);
    }
    return START_STICKY;
  }

  private Notification buildNotification(String title, String artist) {
    Intent open = new Intent(this, MainActivity.class);
    open.putExtra(MainActivity.PATH_EXTRA, "/music/");
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pending = PendingIntent.getActivity(
      this,
      88,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(artist == null || artist.isEmpty() ? "재생 중" : artist)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(pending)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build();
  }

  private void ensureChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager == null) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "음악 재생",
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("백그라운드 음악 재생을 유지합니다.");
    manager.createNotificationChannel(channel);
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
