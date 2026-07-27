import AsyncStorage from "@react-native-async-storage/async-storage";
import { ExpoGaodeMapModule, type Coordinates } from "expo-gaode-map";
import { Platform } from "react-native";

import { toTimelineLocation } from "@/lib/current-location";
import { appendJourneyTrackLocations } from "@/lib/journey-repository";
import { normalizeTrackLocation } from "@/lib/track-utils";
import { TimelineLocation } from "@/types/journey";

const MAX_COLLECTION_ACCURACY_METERS = 100;

const TRACKING_JOURNEY_ID_KEY = "gowherer:tracking:journey-id:v1";
const TRACKING_BATCH_PREFIX = "gowherer:tracking:batch:v1";

let locationListener: { remove: () => void } | null = null;

async function appendTrackLocation(location: Coordinates) {
  const trackedJourneyId = await AsyncStorage.getItem(TRACKING_JOURNEY_ID_KEY);
  if (!trackedJourneyId) {
    return;
  }

  const timelineLocation = toTimelineLocation(location, "tracking");
  if (!timelineLocation) {
    return;
  }

  if (
    typeof timelineLocation.accuracy === "number" &&
    timelineLocation.accuracy > MAX_COLLECTION_ACCURACY_METERS
  ) {
    return;
  }

  const batchKey = `${TRACKING_BATCH_PREFIX}:${trackedJourneyId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  await AsyncStorage.setItem(batchKey, JSON.stringify([timelineLocation]));
}

export async function isBackgroundLocationTrackingAvailable() {
  if (Platform.OS === "web") {
    return false;
  }

  return true;
}

export async function isLocationTrackingActive() {
  if (Platform.OS === "web") {
    return false;
  }

  return ExpoGaodeMapModule.isStarted();
}

export async function startLocationTracking(
  journeyId: string,
  _options: {
    notificationTitle: string;
    notificationBody: string;
    journeyKind?: "travel" | "commute";
  },
) {
  if (Platform.OS === "web") {
    return;
  }

  if (await ExpoGaodeMapModule.isStarted()) {
    ExpoGaodeMapModule.stop();
    if (locationListener) {
      locationListener.remove();
      locationListener = null;
    }
  }

  await AsyncStorage.setItem(TRACKING_JOURNEY_ID_KEY, journeyId);

  ExpoGaodeMapModule.setAllowsBackgroundLocationUpdates(true);
  ExpoGaodeMapModule.start();

  locationListener = ExpoGaodeMapModule.addLocationListener((location) => {
    void appendTrackLocation(location);
  });
}

export async function stopLocationTracking() {
  if (Platform.OS !== "web" && (await ExpoGaodeMapModule.isStarted())) {
    ExpoGaodeMapModule.stop();
  }

  if (locationListener) {
    locationListener.remove();
    locationListener = null;
  }

  await AsyncStorage.removeItem(TRACKING_JOURNEY_ID_KEY);
}

export async function syncBufferedTrackLocations(journeyId: string) {
  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = `${TRACKING_BATCH_PREFIX}:${journeyId}:`;
  const batchKeys = allKeys.filter((key) => key.startsWith(prefix));

  if (batchKeys.length === 0) {
    return 0;
  }

  const rawItems = await AsyncStorage.multiGet(batchKeys);
  const nextLocations = rawItems.flatMap(([, raw]) => {
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed
            .map((location) => normalizeTrackLocation(location))
            .filter((location): location is TimelineLocation =>
              Boolean(location),
            )
        : [];
    } catch {
      return [];
    }
  });

  await appendJourneyTrackLocations(journeyId, nextLocations);
  await AsyncStorage.multiRemove(batchKeys);
  return nextLocations.length;
}
