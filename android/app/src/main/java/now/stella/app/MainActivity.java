package now.stella.app;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  static final String PATH_EXTRA = "stella_path";

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    attachBridge();
    openPath(getIntent());
    if (StellaPrefs.prefs(this).getBoolean(StellaPrefs.OSHI_ALERT, false)) {
      LiveAlertScheduler.schedule(this);
    }
  }

  @Override
  public void onStart() {
    super.onStart();
    attachBridge();
  }

  @Override
  public void onPause() {
    super.onPause();
    // Capacitor pauses WebView timers here, which stops YouTube audio.
    // Keep timers alive while the music foreground service is running.
    keepWebViewAudioAlive();
  }

  @Override
  public void onStop() {
    super.onStop();
    keepWebViewAudioAlive();
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    if (intent != null) setIntent(intent);
    openPath(intent);
  }

  private void keepWebViewAudioAlive() {
    if (!MusicKeepAliveService.isRunning()) return;
    Bridge bridge = getBridge();
    if (bridge == null || bridge.getWebView() == null) return;
    WebView webView = bridge.getWebView();
    webView.post(
      () -> {
        try {
          webView.onResume();
          webView.resumeTimers();
        } catch (Exception ignored) {
          // Best-effort keep-alive.
        }
      }
    );
  }

  private void attachBridge() {
    Bridge bridge = getBridge();
    if (bridge == null || bridge.getWebView() == null) return;
    WebView webView = bridge.getWebView();
    webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
    webView.addJavascriptInterface(new StellaNativeBridge(this), "StellaNative");
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
