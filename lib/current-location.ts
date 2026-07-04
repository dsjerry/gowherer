import { ExpoGaodeMapModule, type Coordinates } from "expo-gaode-map";

import { normalizeTrackLocation } from "@/lib/track-utils";
import { TimelineLocation } from "@/types/journey";

const DEFAULT_CURRENT_LOCATION_TIMEOUT_MS = 12000;

type LocationSource = NonNullable<TimelineLocation["source"]>;

type CurrentLocationOptions = {
  source?: LocationSource;
  currentTimeoutMs?: number;
  onLastKnownLocation?: (location: TimelineLocation) => void | Promise<void>;
};

export function toTimelineLocation(
  location: Coordinates,
  source: LocationSource,
): TimelineLocation | null {
  return normalizeTrackLocation({
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy ?? undefined,
    capturedAt: new Date(location.timestamp).toISOString(),
    source,
  });
}

export async function requestForegroundLocationAccess() {
  const permission = await ExpoGaodeMapModule.requestLocationPermission();
  return permission.granted;
}

async function getCurrentTimelineLocation({
  source,
  timeoutMs,
}: {
  source: LocationSource;
  timeoutMs: number;
}) {
  const locationPromise = ExpoGaodeMapModule.getCurrentLocation().then(
    (location) => toTimelineLocation(location, source),
  );
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  return Promise.race([locationPromise, timeoutPromise]);
}

export async function getBestCurrentTimelineLocation(
  options: CurrentLocationOptions = {},
) {
  const source = options.source ?? "manual";

  try {
    const current = await getCurrentTimelineLocation({
      source,
      timeoutMs:
        options.currentTimeoutMs ?? DEFAULT_CURRENT_LOCATION_TIMEOUT_MS,
    });
    return current;
  } catch {
    return null;
  }
}
