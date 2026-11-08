package now.stella.app;

import android.annotation.SuppressLint;
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
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.app.NotificationCompat;

/**
 * Plays YouTube audio inside a Service-owned WebView so playback can continue
 * when the activity is backgrounded (the activity WebView gets suspended).
 */
public class MusicKeepAliveService extends Service {
  static final String ACTION_START = "now.stella.app.MUSIC_START";
  static final String ACTION_STOP = "now.stella.app.MUSIC_STOP";
  static final String ACTION_PAUSE = "now.stella.app.MUSIC_PAUSE";
  static final String ACTION_RESUME = "now.stella.app.MUSIC_RESUME";
  static final String EXTRA_TITLE = "title";
  static final String EXTRA_ARTIST = "artist";
  static final String EXTRA_VIDEO_ID = "videoId";
  private static final String CHANNEL_ID = "stella_music_playback";
  private static final int NOTIFY_ID = 9101;

  private static volatile boolean running = false;
  private static volatile EndedListener endedListener;

  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private WebView playerView;
  private boolean engineReady = false;
  private String pendingVideoId = "";
  private String title = "StellaNow";
  private String artist = "";
  private boolean wantPlay = false;

  private PowerManager.WakeLock wakeLock;
  private AudioManager audioManager;
  private AudioFocusRequest focusRequest;
  private final AudioManager.OnAudioFocusChangeListener focusListener = (change) -> {};

  interface EndedListener {
    void onEnded();
  }

  static boolean isRunning() {
    return running;
  }

  static void setEndedListener(EndedListener listener) {
    endedListener = listener;
  }

  static void play(Context context, String videoId, String title, String artist) {
    Intent intent = new Intent(context, MusicKeepAliveService.class);
    intent.setAction(ACTION_START);
    intent.putExtra(EXTRA_VIDEO_ID, videoId == null ? "" : videoId);
    intent.putExtra(EXTRA_TITLE, title == null ? "StellaNow" : title);
    intent.putExtra(EXTRA_ARTIST, artist == null ? "" : artist);
    if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent);
    else context.startService(intent);
  }

  static void pause(Context context) {
    Intent intent = new Intent(context, MusicKeepAliveService.class);
    intent.setAction(ACTION_PAUSE);
    context.startService(intent);
  }

  static void resume(Context context) {
    Intent intent = new Intent(context, MusicKeepAliveService.class);
    intent.setAction(ACTION_RESUME);
    context.startService(intent);
  }

  static void stop(Context context) {
    Intent intent = new Intent(context, MusicKeepAliveService.class);
    intent.setAction(ACTION_STOP);
    context.startService(intent);
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null) return START_STICKY;
    String action = intent.getAction();

    if (ACTION_STOP.equals(action)) {
      wantPlay = false;
      mainHandler.post(this::stopEngine);
      teardown();
      stopForeground(STOP_FOREGROUND_REMOVE);
      stopSelf();
      return START_NOT_STICKY;
    }

    if (ACTION_PAUSE.equals(action)) {
      wantPlay = false;
      mainHandler.post(() -> eval("window.stellaPause && window.stellaPause();"));
      updateNotification();
      return START_STICKY;
    }

    if (ACTION_RESUME.equals(action)) {
      wantPlay = true;
      running = true;
      acquireWakeLock();
      requestFocus();
      mainHandler.post(() -> {
        ensurePlayer();
        eval("window.stellaResume && window.stellaResume();");
      });
      updateNotification();
      return START_STICKY;
    }

    // START / play
    String videoId = intent.getStringExtra(EXTRA_VIDEO_ID);
    title = intent.getStringExtra(EXTRA_TITLE);
    artist = intent.getStringExtra(EXTRA_ARTIST);
    if (title == null || title.isEmpty()) title = "StellaNow";
    if (artist == null) artist = "";
    if (videoId == null) videoId = "";
    pendingVideoId = videoId;
    wantPlay = true;

    ensureChannel();
    running = true;
    acquireWakeLock();
    requestFocus();
    if (Build.VERSION.SDK_INT >= 29) {
      startForeground(NOTIFY_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
    } else {
      startForeground(NOTIFY_ID, buildNotification());
    }

    final String loadId = videoId;
    mainHandler.post(() -> {
      ensurePlayer();
      if (engineReady) {
        eval("window.stellaPlay && window.stellaPlay(" + jsonString(loadId) + ");");
      }
    });
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    mainHandler.post(this::destroyPlayer);
    teardown();
    super.onDestroy();
  }

  private void teardown() {
    running = false;
    abandonFocus();
    releaseWakeLock();
  }

  private void stopEngine() {
    eval("window.stellaStop && window.stellaStop();");
  }

  @SuppressLint("SetJavaScriptEnabled")
  private void ensurePlayer() {
    if (playerView != null) return;
    playerView = new WebView(getApplicationContext());
    WebSettings settings = playerView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setLoadWithOverviewMode(true);
    if (Build.VERSION.SDK_INT >= 17) {
      settings.setMediaPlaybackRequiresUserGesture(false);
    }
    playerView.setWebChromeClient(new WebChromeClient());
    playerView.setWebViewClient(
      new WebViewClient() {
        @Override
        public void onPageFinished(WebView view, String url) {
          engineReady = true;
          if (wantPlay && pendingVideoId != null && !pendingVideoId.isEmpty()) {
            eval("window.stellaPlay && window.stellaPlay(" + jsonString(pendingVideoId) + ");");
          }
        }
      }
    );
    playerView.addJavascriptInterface(new Bridge(), "StellaMusic");
    // https base URL is required for the YouTube IFrame API to load reliably.
    try {
      java.io.InputStream in = getAssets().open("music_engine.html");
      byte[] raw = new byte[in.available()];
      //noinspection ResultOfMethodCallIgnored
      in.read(raw);
      in.close();
      String html = new String(raw, java.nio.charset.StandardCharsets.UTF_8);
      playerView.loadDataWithBaseURL("https://www.youtube.com", html, "text/html", "utf-8", null);
    } catch (Exception e) {
      playerView.loadUrl("file:///android_asset/music_engine.html");
    }
  }

  private void destroyPlayer() {
    if (playerView == null) return;
    try {
      playerView.loadUrl("about:blank");
      playerView.stopLoading();
      playerView.destroy();
    } catch (Exception ignored) {
      // ignore
    }
    playerView = null;
    engineReady = false;
  }

  private void eval(String js) {
    if (playerView == null) return;
    try {
      playerView.evaluateJavascript(js, null);
    } catch (Exception ignored) {
      // ignore
    }
  }

  private void updateNotification() {
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager != null) manager.notify(NOTIFY_ID, buildNotification());
  }

  private Notification buildNotification() {
    Intent open = new Intent(this, MainActivity.class);
    open.putExtra(MainActivity.PATH_EXTRA, "/music/");
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pending = PendingIntent.getActivity(
      this,
      88,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    String text = artist.isEmpty() ? (wantPlay ? "재생 중" : "일시정지") : artist;
    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(text)
      .setOngoing(wantPlay)
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

  private void acquireWakeLock() {
    if (wakeLock != null && wakeLock.isHeld()) return;
    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
    if (pm == null) return;
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "StellaNow:Music");
    wakeLock.setReferenceCounted(false);
    wakeLock.acquire(3 * 60 * 60 * 1000L);
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
      if (focusRequest == null) {
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
      }
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
  }

  private static String jsonString(String value) {
    StringBuilder out = new StringBuilder("\"");
    for (int i = 0; i < value.length(); i += 1) {
      char c = value.charAt(i);
      if (c == '\\' || c == '"') out.append('\\');
      if (c == '\n') {
        out.append("\\n");
        continue;
      }
      out.append(c);
    }
    out.append('"');
    return out.toString();
  }

  private class Bridge {
    @JavascriptInterface
    public void onEvent(String type) {
      if ("ended".equals(type)) {
        EndedListener listener = endedListener;
        if (listener != null) {
          mainHandler.post(listener::onEnded);
        }
      }
    }
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
