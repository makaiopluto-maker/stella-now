package now.stella.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public class MusicKeepAliveService extends Service {
  static final String ACTION_START = "now.stella.app.MUSIC_START";
  static final String ACTION_STOP = "now.stella.app.MUSIC_STOP";
  static final String EXTRA_TITLE = "title";
  static final String EXTRA_ARTIST = "artist";
  private static final String CHANNEL_ID = "stella_music_playback";
  private static final int NOTIFY_ID = 9101;
  private static volatile boolean running = false;

  private PowerManager.WakeLock wakeLock;
  private AudioManager audioManager;
  private AudioFocusRequest focusRequest;
  private final AudioManager.OnAudioFocusChangeListener focusListener = (change) -> {
    // Keep holding focus for music; WebView playback is nudged from MainActivity/JS.
  };

  static boolean isRunning() {
    return running;
  }

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
      teardown();
      stopForeground(STOP_FOREGROUND_REMOVE);
      stopSelf();
      return START_NOT_STICKY;
    }

    String title = intent != null ? intent.getStringExtra(EXTRA_TITLE) : "StellaNow";
    String artist = intent != null ? intent.getStringExtra(EXTRA_ARTIST) : "";
    if (title == null || title.isEmpty()) title = "StellaNow";
    ensureChannel();
    Notification notification = buildNotification(title, artist);
    running = true;
    acquireWakeLock();
    requestFocus();
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFY_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIFY_ID, notification);
    }
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    teardown();
    super.onDestroy();
  }

  private void teardown() {
    running = false;
    abandonFocus();
    releaseWakeLock();
  }

  private void acquireWakeLock() {
    if (wakeLock != null && wakeLock.isHeld()) return;
    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
    if (pm == null) return;
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "StellaNow:Music");
    wakeLock.setReferenceCounted(false);
    wakeLock.acquire(60 * 60 * 1000L);
  }

  private void releaseWakeLock() {
    if (wakeLock == null) return;
    try {
      if (wakeLock.isHeld()) wakeLock.release();
    } catch (Exception ignored) {
      // ignore
    }
    wakeLock = null;
  }

  private void requestFocus() {
    audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
    if (audioManager == null) return;
    if (Build.VERSION.SDK_INT >= 26) {
      focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
        .setAudioAttributes(
          new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
            .build()
        )
        .setOnAudioFocusChangeListener(focusListener)
        .setAcceptsDelayedFocusGain(true)
        .build();
      audioManager.requestAudioFocus(focusRequest);
    } else {
      audioManager.requestAudioFocus(
        focusListener,
        AudioManager.STREAM_MUSIC,
        AudioManager.AUDIOFOCUS_GAIN
      );
    }
  }

  private void abandonFocus() {
    if (audioManager == null) return;
    try {
      if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) {
        audioManager.abandonAudioFocusRequest(focusRequest);
      } else {
        audioManager.abandonAudioFocus(focusListener);
      }
    } catch (Exception ignored) {
      // ignore
    }
    focusRequest = null;
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
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
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
    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    manager.createNotificationChannel(channel);
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
