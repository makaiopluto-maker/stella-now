package now.stella.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LiveWidgetProvider extends AppWidgetProvider {
  private static final ExecutorService WORK = Executors.newSingleThreadExecutor();
  private static final Handler MAIN = new Handler(Looper.getMainLooper());
  private static final String PREFS = "stella_live_widget";
  private static final String LAST_LIVE = "last_live_names";

  private static final String[][] CHANNELS = {
    {"유니", "45e71a76e949e16a34764deb962f9d9f"},
    {"후야", "36ddb9bb4f17593b60f1b63cec86611d"},
    {"히나", "b044e3a3b9259246bc92e863e7d3f3b8"},
    {"마시로", "4515b179f86b67b4981e16190817c580"},
    {"리제", "4325b1d5bbc321fad3042306646e2e50"},
    {"타비", "a6c4ddb09cdb160478996007bff35296"},
    {"시부키", "64d76089fba26b180d9c9e48a32600d9"},
    {"린", "516937b5f85cbf2249ce31b0ad046b0f"},
    {"나나", "4d812b586ff63f8a2946e64fa860bbf5"},
    {"리코", "8fd39bb8de623317de90654718638b10"},
    {"토아", "2299fad4bebb504b0978e1ec08b2f7d3"},
    {"랑", "c657aa3592260a2b59669a72ec151936"},
    {"히요리", "49d2c3cf8f0b2843d934ec15e82bb54c"},
    {"메리", "792acf9ca28b42918710327e14b06b68"},
  };

  @Override
  public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
    for (int id : appWidgetIds) {
      bindLoading(context, manager, id);
      refresh(context, manager, id);
    }
  }

  private void bindLoading(Context context, AppWidgetManager manager, int widgetId) {
    RemoteViews views = baseViews(context);
    views.setTextViewText(R.id.widget_status, "방송 확인 중");
    views.setTextViewText(R.id.widget_detail, "잠시만요");
    manager.updateAppWidget(widgetId, views);
  }

  private void refresh(Context context, AppWidgetManager manager, int widgetId) {
    WORK.execute(() -> {
      String cached = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(LAST_LIVE, "");
      List<String> previous = new ArrayList<>();
      if (cached != null && !cached.isEmpty()) {
        for (String name : cached.split("\u001f")) {
          if (!name.isEmpty()) previous.add(name);
        }
      }

      List<String> live = new ArrayList<>();
      int answered = 0;
      for (String[] row : CHANNELS) {
        Boolean status = readLive(row[1]);
        if (status == null) {
          // Failed request must not invent offline — keep last known if they were live.
          if (previous.contains(row[0])) live.add(row[0]);
          continue;
        }
        answered += 1;
        if (status) live.add(row[0]);
      }
      if (answered == 0 && live.isEmpty()) live.addAll(previous);
      if (answered > 0) {
        StringBuilder packed = new StringBuilder();
        for (int i = 0; i < live.size(); i += 1) {
          if (i > 0) packed.append('\u001f');
          packed.append(live.get(i));
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
          .edit()
          .putString(LAST_LIVE, packed.toString())
          .apply();
      }
      List<String> shown = live;
      MAIN.post(() -> {
        RemoteViews views = baseViews(context);
        if (shown.isEmpty()) {
          views.setTextViewText(R.id.widget_status, "방송 중인 멤버 없음");
          views.setTextViewText(R.id.widget_detail, "탭해서 Stella Now 열기");
        } else {
          views.setTextViewText(R.id.widget_status, shown.size() + "명 방송 중");
          views.setTextViewText(R.id.widget_detail, joinNames(shown));
        }
        manager.updateAppWidget(widgetId, views);
      });
    });
  }

  private RemoteViews baseViews(Context context) {
    RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_live);
    Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (intent == null) {
      intent = new Intent(context, MainActivity.class);
    }
    intent.putExtra("android.intent.extra.TEXT", "/live/");
    intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent pending = PendingIntent.getActivity(
      context,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
    views.setOnClickPendingIntent(R.id.widget_root, pending);
    return views;
  }

  /** @return true/false when Chzzk answered, null when the request failed */
  private static Boolean readLive(String channelId) {
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
      JSONObject root = new JSONObject(body.toString());
      JSONObject content = root.optJSONObject("content");
      if (content == null) return null;
      String status = content.optString("status", "");
      String closeDate = content.optString("closeDate", "");
      boolean open = "OPEN".equals(status) && (closeDate == null || closeDate.isEmpty() || "null".equals(closeDate));
      return open;
    } catch (Exception ignored) {
      return null;
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  private static String joinNames(List<String> names) {
    StringBuilder text = new StringBuilder();
    int limit = Math.min(names.size(), 4);
    for (int i = 0; i < limit; i += 1) {
      if (i > 0) text.append(" · ");
      text.append(names.get(i));
    }
    if (names.size() > limit) text.append(" 외 ").append(names.size() - limit).append("명");
    return text.toString();
  }
}
