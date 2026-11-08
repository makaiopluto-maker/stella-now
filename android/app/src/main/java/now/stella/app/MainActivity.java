package now.stella.app;

import android.content.Intent;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  static final String PATH_EXTRA = "stella_path";

  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    openPath(getIntent());
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    if (intent != null) setIntent(intent);
    openPath(intent);
  }

  private void openPath(Intent intent) {
    if (intent == null) return;
    String path = intent.getStringExtra(PATH_EXTRA);
    if (path == null || path.isEmpty()) return;
    intent.removeExtra(PATH_EXTRA);

    Bridge bridge = getBridge();
    if (bridge == null) return;
    WebView webView = bridge.getWebView();
    if (webView == null) return;

    final String target = path.startsWith("/") ? path : "/" + path;
    // Wait until the WebView has finished Capacitor's first load before routing.
    webView.postDelayed(
      () -> {
        Bridge ready = getBridge();
        if (ready == null || ready.getWebView() == null) return;
        ready.getWebView().evaluateJavascript("window.location.assign(" + quote(target) + ")", null);
      },
      250
    );
  }

  private static String quote(String value) {
    StringBuilder out = new StringBuilder("\"");
    for (int i = 0; i < value.length(); i += 1) {
      char c = value.charAt(i);
      if (c == '\\' || c == '"') out.append('\\');
      out.append(c);
    }
    out.append('"');
    return out.toString();
  }
}
