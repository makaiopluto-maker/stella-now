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

  @JavascriptInterface
  public void setMusicPlaying(boolean playing, String title, String artist) {
    if (playing) {
      MusicKeepAliveService.start(activity.getApplicationContext(), title, artist);
    } else {
      MusicKeepAliveService.stop(activity.getApplicationContext());
    }
  }
}
