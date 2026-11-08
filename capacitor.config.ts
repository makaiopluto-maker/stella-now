import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "now.stella.app",
  appName: "Stella Now",
  webDir: "out",
  plugins: {
    // Native HTTP bypasses WebView CORS for Chzzk / cafe / image saves.
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
