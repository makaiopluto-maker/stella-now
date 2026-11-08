package now.stella.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.JavascriptInterface;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

public class StellaNativeBridge {
  private final Activity activity;

  public StellaNativeBridge(Activity activity) {
    this.activity = activity;
  }

  @JavascriptInterface
  public void setOshiAlert(String slug, String channelId, String name, boolean enabled) {
    StellaPrefs.prefs(activity)
      .edit()
      .putString(StellaPrefs.OSHI_SLUG, slug == null ? "" : slug)
      .putString(StellaPrefs.OSHI_CHANNEL, channelId == null ? "" : channelId)
      .putString(StellaPrefs.OSHI_NAME, name == null ? "" : name)
      .putBoolean(StellaPrefs.OSHI_ALERT, enabled)
      .putString(StellaPrefs.LAST_OPEN, enabled ? "__pending__" : "")
      .apply();
    if (enabled) {
      LiveAlertScheduler.schedule(activity);
    } else {
      LiveAlertScheduler.cancel(activity);
    }
    // Refresh home-screen widgets so oshi filtering updates immediately.
    LiveWidgetProvider.requestUpdate(activity);
  }

  @JavascriptInterface
  public void requestNotifyPermission() {
    if (Build.VERSION.SDK_INT < 33) return;
    if (ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS)
        == PackageManager.PERMISSION_GRANTED) {
      return;
    }
    activity.runOnUiThread(
      () -> ActivityCompat.requestPermissions(
        activity,
        new String[] { Manifest.permission.POST_NOTIFICATIONS },
        1101
      )
    );
  }

  /** Legacy flag used before the dedicated service player. Kept as a stop/start helper. */
  @JavascriptInterface
  public void setMusicPlaying(boolean playing, String title, String artist) {
    if (!playing) {
      MusicKeepAliveService.stop(activity.getApplicationContext());
    }
  }

  @JavascriptInterface
  public void playMusic(String videoId, String title, String artist) {
    if (videoId == null || videoId.isEmpty()) return;
    MusicKeepAliveService.play(
      activity.getApplicationContext(),
      videoId,
      title == null ? "StellaNow" : title,
      artist == null ? "" : artist
    );
  }

  @JavascriptInterface
  public void pauseMusic() {
    MusicKeepAliveService.pause(activity.getApplicationContext());
  }

  @JavascriptInterface
  public void resumeMusic() {
    MusicKeepAliveService.resume(activity.getApplicationContext());
  }

  @JavascriptInterface
  public void stopMusic() {
    MusicKeepAliveService.stop(activity.getApplicationContext());
  }

  @JavascriptInterface
  public String getAppVersion() {
    try {
      return activity.getPackageManager()
        .getPackageInfo(activity.getPackageName(), 0)
        .versionName;
    } catch (Exception ignored) {
      return "";
    }
  }
}
