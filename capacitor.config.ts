import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.kisem.pumpup",
  appName: "Pump-Up",
  webDir: "out",
  server: {
    androidScheme: "https",
    allowNavigation: ["pump-up.vercel.app", "*.vercel.app"],
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
