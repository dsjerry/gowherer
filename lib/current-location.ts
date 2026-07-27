import { ExpoGaodeMapModule, type Coordinates } from "expo-gaode-map";

import { normalizeTrackLocation } from "@/lib/track-utils";
import { TimelineLocation } from "@/types/journey";

const DEFAULT_CURRENT_LOCATION_TIMEOUT_MS = 12000;
const DEFAULT_DESIRED_ACCURACY_METERS = 50;
const MAX_LOCATION_ATTEMPT_TIMEOUT_MS = 5000;
const LOCATION_ATTEMPT_INTERVAL_MS = 800;

type LocationSource = NonNullable<TimelineLocation["source"]>;

type CurrentLocationOptions = {
  source?: LocationSource;
  currentTimeoutMs?: number;
  desiredAccuracyMeters?: number;
};

function inferCoordSystem(location: Coordinates): "wgs84" | "gcj02" {
  const rawCoordType = (location as { coordType?: unknown }).coordType;
  if (typeof rawCoordType === "string" && rawCoordType.toUpperCase() === "WGS84") {
    return "wgs84";
  }
  // Gaode SDK defaults to GCJ-02 on Android; keep legacy default for other cases.
  return "gcj02";
}

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
    coordSystem: inferCoordSystem(location),
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
}): Promise<TimelineLocation | null> {
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
): Promise<TimelineLocation | null> {
  const source = options.source ?? "manual";
  const totalTimeoutMs =
    options.currentTimeoutMs ?? DEFAULT_CURRENT_LOCATION_TIMEOUT_MS;
  const desiredAccuracyMeters =
    options.desiredAccuracyMeters ?? DEFAULT_DESIRED_ACCURACY_METERS;
  const deadline = Date.now() + totalTimeoutMs;
  let best: TimelineLocation | null = null;

  while (Date.now() < deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }

    try {
      const location = await getCurrentTimelineLocation({
        source,
        timeoutMs: Math.min(remaining, MAX_LOCATION_ATTEMPT_TIMEOUT_MS),
      });

      if (location) {
        const accuracy = location.accuracy;
        if (
          typeof accuracy === "number" &&
          accuracy > 0 &&
          accuracy <= desiredAccuracyMeters
        ) {
          return location;
        }

        if (
          !best ||
          (typeof accuracy === "number" &&
            accuracy > 0 &&
            (best.accuracy === undefined ||
              best.accuracy === null ||
              accuracy < best.accuracy))
        ) {
          best = location;
        }
      }
    } catch {
      // Ignore per-attempt failures and retry while time remains.
    }

    const pause = Math.min(
      LOCATION_ATTEMPT_INTERVAL_MS,
      deadline - Date.now(),
    );
    if (pause > 0) {
      await new Promise((resolve) => setTimeout(resolve, pause));
    }
  }

  return best;
}
