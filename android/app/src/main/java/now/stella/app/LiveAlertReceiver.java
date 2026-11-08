package now.stella.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LiveAlertReceiver extends BroadcastReceiver {
  private static final String CHANNEL_ID = "stella_live_alert";
  private static final ExecutorService WORK = Executors.newSingleThreadExecutor();

  @Override
  public void onReceive(Context context, Intent intent) {
    if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
      SharedPreferences prefs = StellaPrefs.prefs(context);
      if (prefs.getBoolean(StellaPrefs.OSHI_ALERT, false)) {
        LiveAlertScheduler.schedule(context);
      }
      return;
    }

    final PendingResult pending = goAsync();
    WORK.execute(() -> {
      try {
        check(context);
      } finally {
        pending.finish();
      }
    });
  }

  private static void check(Context context) {
    SharedPreferences prefs = StellaPrefs.prefs(context);
    if (!prefs.getBoolean(StellaPrefs.OSHI_ALERT, false)) return;
    String channelId = prefs.getString(StellaPrefs.OSHI_CHANNEL, "");
    String name = prefs.getString(StellaPrefs.OSHI_NAME, "오시");
    if (channelId == null || channelId.isEmpty()) return;

    LiveSnapshot snap = readLive(channelId);
    if (snap == null) return;

    String previous = prefs.getString(StellaPrefs.LAST_OPEN, "");
    if (!snap.live) {
      // Keep pending marker until we observe a live session.
      if (!"__pending__".equals(previous)) {
        prefs.edit().putString(StellaPrefs.LAST_OPEN, "").apply();
      }
      return;
    }

    String token = snap.openDate == null || snap.openDate.isEmpty() ? "live" : snap.openDate;
    if (token.equals(previous)) return;
    // After enabling alerts, remember the current live session without notifying.
    if ("__pending__".equals(previous)) {
      prefs.edit().putString(StellaPrefs.LAST_OPEN, token).apply();
      return;
    }
    prefs.edit().putString(StellaPrefs.LAST_OPEN, token).apply();
    notifyLive(context, name, snap.viewers);
  }

  private static void notifyLive(Context context, String name, int viewers) {
    ensureChannel(context);
    Intent open = new Intent(context, MainActivity.class);
    open.putExtra(MainActivity.PATH_EXTRA, "/live/");
    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pending = PendingIntent.getActivity(
      context,
      77,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    String body = viewers > 0
      ? "지금 방송 중 · 시청 " + String.format("%,d", viewers) + "명"
      : "치지직에서 바로 볼 수 있어요";
    NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(name + " 방송이 시작됐어요")
      .setContentText(body)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setContentIntent(pending);
    try {
      NotificationManagerCompat.from(context).notify(9001, builder.build());
    } catch (SecurityException ignored) {
      // Notification permission may still be denied on Android 13+.
    }
  }

  private static void ensureChannel(Context context) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager manager = context.getSystemService(NotificationManager.class);
    if (manager == null) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "오시 방송 알림",
      NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("선택한 멤버가 방송을 시작할 때 알려줍니다.");
    manager.createNotificationChannel(channel);
  }

  static LiveSnapshot readLive(String channelId) {
    HttpURLConnection connection = null;
    try {
      URL url = new URL("https://api.chzzk.naver.com/polling/v2/channels/" + channelId + "/live-status");
      connection = (HttpURLConnection) url.openConnection();
      connection.setConnectTimeout(6000);
      connection.setReadTimeout(6000);
      connection.setRequestProperty("Accept", "application/json");
      connection.setRequestProperty("User-Agent", "StellaNow/1.0");
      if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) return null;
      BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
      StringBuilder body = new StringBuilder();
      String line;
      while ((line = reader.readLine()) != null) body.append(line);
      reader.close();
      JSONObject content = new JSONObject(body.toString()).optJSONObject("content");
      if (content == null) return null;
      String status = content.optString("status", "");
      String closeDate = content.optString("closeDate", "");
      boolean open = "OPEN".equals(status) && (closeDate == null || closeDate.isEmpty() || "null".equals(closeDate));
      String openDate = content.optString("openDate", "");
      int viewers = content.optInt("concurrentUserCount", 0);
      return new LiveSnapshot(open, openDate, viewers);
    } catch (Exception ignored) {
      return null;
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  static final class LiveSnapshot {
    final boolean live;
    final String openDate;
    final int viewers;

    LiveSnapshot(boolean live, String openDate, int viewers) {
      this.live = live;
      this.openDate = openDate;
      this.viewers = viewers;
    }
  }
}
