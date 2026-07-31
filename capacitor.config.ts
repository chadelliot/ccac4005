import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // NOTE: appId is permanent once the app is published to the Play Store —
  // confirm it before the first release.
  appId: "org.ccacbaltimore.app",
  appName: "CCAC",
  // Output of `npm run build:mobile` (vite build --mode mobile).
  webDir: "dist/client",
  android: {
    // Served as https://localhost inside the WebView, which is what Supabase
    // auth redirects and the App Link config have to match.
    allowMixedContent: false,
  },
};

export default config;
