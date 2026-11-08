package now.stella.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;

final class LiveAlertScheduler {
  private static final long INTERVAL_MS = 15 * 60 * 1000L;

  private LiveAlertScheduler() {}

  static void schedule(Context context) {
    AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarms == null) return;
    PendingIntent pending = pending(context);
    alarms.cancel(pending);
    alarms.setInexactRepeating(
      AlarmManager.ELAPSED_REALTIME_WAKEUP,
      SystemClock.elapsedRealtime() + 30_000L,
      INTERVAL_MS,
      pending
    );
    // Also fire once soon so the first check does not wait a full interval.
    context.sendBroadcast(new Intent(context, LiveAlertReceiver.class));
  }

  static void cancel(Context context) {
    AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    if (alarms == null) return;
    alarms.cancel(pending(context));
  }

  private static PendingIntent pending(Context context) {
    Intent intent = new Intent(context, LiveAlertReceiver.class);
    return PendingIntent.getBroadcast(
      context,
      42,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
    );
  }
}
