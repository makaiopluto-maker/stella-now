package now.stella.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.widget.RemoteViews;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class LiveWidgetProvider extends AppWidgetProvider {
  private static final ExecutorService WORK = Executors.newSingleThreadExecutor();
  private static final Handler MAIN = new Handler(Looper.getMainLooper());

  // slug, short name, channel id
  private static final String[][] CHANNELS = {
    {"yuni", "유니", "45e71a76e949e16a34764deb962f9d9f"},
    {"huya", "후야", "36ddb9bb4f17593b60f1b63cec86611d"},
    {"hina", "히나", "b044e3a3b9259246bc92e863e7d3f3b8"},
    {"mashiro", "마시로", "4515b179f86b67b4981e16190817c580"},
    {"lize", "리제", "4325b1d5bbc321fad3042306646e2e50"},
    {"tabi", "타비", "a6c4ddb09cdb160478996007bff35296"},
    {"shibuki", "시부키", "64d76089fba26b180d9c9e48a32600d9"},
    {"rin", "린", "516937b5f85cbf2249ce31b0ad046b0f"},
    {"nana", "나나", "4d812b586ff63f8a2946e64fa860bbf5"},
    {"riko", "리코", "8fd39bb8de623317de90654718638b10"},
    {"toa", "토아", "2299fad4bebb504b0978e1ec08b2f7d3"},
    {"rang", "랑", "c657aa3592260a2b59669a72ec151936"},
    {"hiyori", "히요리", "49d2c3cf8f0b2843d934ec15e82bb54c"},
    {"mary", "메리", "792acf9ca28b42918710327e14b06b68"},
  };

  static void requestUpdate(Context context) {
    AppWidgetManager manager = AppWidgetManager.getInstance(context);
    int[] ids = manager.getAppWidgetIds(new ComponentName(context, LiveWidgetProvider.class));
    if (ids.length == 0) return;
    Intent intent = new Intent(context, LiveWidgetProvider.class);
    intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
    intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
    context.sendBroadcast(intent);
  }

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
      SharedPreferences prefs = StellaPrefs.prefs(context);
      String oshiSlug = prefs.getString(StellaPrefs.OSHI_SLUG, "");
      String cached = prefs.getString(StellaPrefs.WIDGET_LIVE, "");
      List<String> previous = new ArrayList<>();
      if (cached != null && !cached.isEmpty()) {
        for (String row : cached.split("\u001f")) {
          if (!row.isEmpty()) previous.add(row);
        }
      }

      List<LiveRow> live = new ArrayList<>();
      int answered = 0;
      for (String[] channel : CHANNELS) {
        if (oshiSlug != null && !oshiSlug.isEmpty() && !oshiSlug.equals(channel[0])) continue;
        LiveAlertReceiver.LiveSnapshot snap = LiveAlertReceiver.readLive(channel[2]);
        if (snap == null) {
          for (String prev : previous) {
            if (prev.startsWith(channel[1] + "|")) {
              String[] bits = prev.split("\\|", 2);
              int viewers = 0;
              try { viewers = bits.length > 1 ? Integer.parseInt(bits[1]) : 0; } catch (Exception ignored) {}
              live.add(new LiveRow(channel[1], viewers));
            }
          }
          continue;
        }
        answered += 1;
        if (snap.live) live.add(new LiveRow(channel[1], snap.viewers));
      }

      if (answered == 0 && live.isEmpty()) {
        for (String prev : previous) {
          String[] bits = prev.split("\\|", 2);
          int viewers = 0;
          try { viewers = bits.length > 1 ? Integer.parseInt(bits[1]) : 0; } catch (Exception ignored) {}
          live.add(new LiveRow(bits[0], viewers));
        }
      }

      if (answered > 0) {
        StringBuilder packed = new StringBuilder();
        for (int i = 0; i < live.size(); i += 1) {
          if (i > 0) packed.append('\u001f');
          packed.append(live.get(i).name).append('|').append(live.get(i).viewers);
        }
        prefs.edit().putString(StellaPrefs.WIDGET_LIVE, packed.toString()).apply();
      }

      final List<LiveRow> shown = live;
      final boolean oshiOnly = oshiSlug != null && !oshiSlug.isEmpty();
      MAIN.post(() -> {
        RemoteViews views = baseViews(context);
        if (shown.isEmpty()) {
          views.setTextViewText(R.id.widget_status, oshiOnly ? "오시 방송 없음" : "방송 중인 멤버 없음");
          views.setTextViewText(R.id.widget_detail, "탭해서 StellaNow 열기");
        } else if (oshiOnly && shown.size() == 1) {
          LiveRow row = shown.get(0);
          views.setTextViewText(R.id.widget_status, row.name + " 방송 중");
          views.setTextViewText(
            R.id.widget_detail,
            row.viewers > 0 ? ("시청 " + String.format("%,d", row.viewers) + "명") : "지금 라이브"
          );
        } else {
          views.setTextViewText(R.id.widget_status, shown.size() + "명 방송 중");
          views.setTextViewText(R.id.widget_detail, joinRows(shown));
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
    intent.putExtra(MainActivity.PATH_EXTRA, "/live/");
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

  private static String joinRows(List<LiveRow> rows) {
    StringBuilder text = new StringBuilder();
    int limit = Math.min(rows.size(), 3);
    for (int i = 0; i < limit; i += 1) {
      if (i > 0) text.append(" · ");
      LiveRow row = rows.get(i);
      text.append(row.name);
      if (row.viewers > 0) text.append(' ').append(compact(row.viewers));
    }
    if (rows.size() > limit) text.append(" 외 ").append(rows.size() - limit).append("명");
    return text.toString();
  }

  private static String compact(int viewers) {
    if (viewers >= 10000) return (viewers / 1000) / 10.0 + "만";
    return String.format("%,d", viewers);
  }

  private static final class LiveRow {
    final String name;
    final int viewers;

    LiveRow(String name, int viewers) {
      this.name = name;
      this.viewers = viewers;
    }
  }
}
