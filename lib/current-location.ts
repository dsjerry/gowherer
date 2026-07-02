import * as Location from 'expo-location';

import { normalizeTrackLocation } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

const DEFAULT_LAST_KNOWN_MAX_AGE_MS = 1000 * 60 * 5;
const DEFAULT_LAST_KNOWN_REQUIRED_ACCURACY_METERS = 300;
const DEFAULT_CURRENT_LOCATION_TIMEOUT_MS = 12000;

type LocationSource = NonNullable<TimelineLocation['source']>;

type CurrentLocationOptions = {
  source?: LocationSource;
  lastKnownMaxAgeMs?: number;
  lastKnownRequiredAccuracyMeters?: number;
  currentAccuracy?: Location.Accuracy;
  currentTimeoutMs?: number;
  onLastKnownLocation?: (location: TimelineLocation) => void | Promise<void>;
};

export function toTimelineLocation(
  location: Location.LocationObject,
  source: LocationSource
): TimelineLocation | null {
  return normalizeTrackLocation({
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy ?? undefined,
    capturedAt: new Date(location.timestamp).toISOString(),
    source,
  });
}

export async function requestForegroundLocationAccess() {
  const permission = await Location.requestForegroundPermissionsAsync();
  return permission.granted;
}

async function getLastKnownTimelineLocation({
  source,
  maxAge,
  requiredAccuracy,
}: {
  source: LocationSource;
  maxAge: number;
  requiredAccuracy: number;
}) {
  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge,
    requiredAccuracy,
  });

  return lastKnown ? toTimelineLocation(lastKnown, source) : null;
}

async function getCurrentTimelineLocation({
  source,
  accuracy,
  timeoutMs,
}: {
  source: LocationSource;
  accuracy: Location.Accuracy;
  timeoutMs: number;
}) {
  const locationPromise = Location.getCurrentPositionAsync({ accuracy }).then((location) =>
    toTimelineLocation(location, source)
  );
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  return Promise.race([locationPromise, timeoutPromise]);
}

export async function getBestCurrentTimelineLocation(options: CurrentLocationOptions = {}) {
  const source = options.source ?? 'manual';
  const lastKnown = await getLastKnownTimelineLocation({
    source,
    maxAge: options.lastKnownMaxAgeMs ?? DEFAULT_LAST_KNOWN_MAX_AGE_MS,
    requiredAccuracy:
      options.lastKnownRequiredAccuracyMeters ?? DEFAULT_LAST_KNOWN_REQUIRED_ACCURACY_METERS,
  });

  if (lastKnown) {
    await options.onLastKnownLocation?.(lastKnown);
  }

  try {
    const current = await getCurrentTimelineLocation({
      source,
      accuracy: options.currentAccuracy ?? Location.Accuracy.High,
      timeoutMs: options.currentTimeoutMs ?? DEFAULT_CURRENT_LOCATION_TIMEOUT_MS,
    });
    return current ?? lastKnown;
  } catch {
    return lastKnown;
  }
}
