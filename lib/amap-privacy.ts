import { ExpoGaodeMapModule } from "expo-gaode-map";
import { Platform } from "react-native";

const PRIVACY_VERSION = "2026-03-13";

let initialized = false;

export function ensureAmapPrivacyReady() {
  if (Platform.OS === "web") {
    return;
  }
  if (initialized) {
    return;
  }

  try {
    const status = ExpoGaodeMapModule.getPrivacyStatus();
    if (status.isReady) {
      initialized = true;
      return;
    }

    ExpoGaodeMapModule.setPrivacyConfig({
      hasShow: true,
      hasContainsPrivacy: true,
      hasAgree: true,
      privacyVersion: PRIVACY_VERSION,
    });
    initialized = true;
  } catch {
    // Non-fatal: privacy init may fail if native module isn't loaded yet
  }
}

ensureAmapPrivacyReady();
