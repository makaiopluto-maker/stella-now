package now.stella.app;

import android.content.Context;
import android.content.SharedPreferences;

final class StellaPrefs {
  static final String PREFS = "stella_native";
  static final String OSHI_SLUG = "oshi_slug";
  static final String OSHI_CHANNEL = "oshi_channel";
  static final String OSHI_NAME = "oshi_name";
  static final String OSHI_ALERT = "oshi_alert";
  static final String LAST_OPEN = "oshi_last_open";
  static final String WIDGET_LIVE = "widget_last_live";

  private StellaPrefs() {}

  static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }
}
