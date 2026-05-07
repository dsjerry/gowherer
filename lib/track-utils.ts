import { TimelineLocation } from '@/types/journey';

const MAX_TRACKING_ACCURACY_METERS = 100;
const MAX_TRACKING_SPEED_KMH = 180;
const MIN_TRACKING_DISTANCE_METERS = 3;

export function normalizeTrackLocation(location: unknown): TimelineLocation | null {
  if (!location || typeof location !== 'object') {
    return null;
  }

  const raw = location as {
    latitude?: unknown;
    longitude?: unknown;
    accuracy?: unknown;
    placeName?: unknown;
    capturedAt?: unknown;
    source?: unknown;
  };
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  const capturedAt =
    typeof raw.capturedAt === 'string' && Number.isFinite(Date.parse(raw.capturedAt))
      ? new Date(raw.capturedAt).toISOString()
      : undefined;
  const source = raw.source === 'tracking' ? 'tracking' : raw.source === 'manual' ? 'manual' : undefined;

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(raw.accuracy) ? Number(raw.accuracy) : undefined,
    placeName: typeof raw.placeName === 'string' ? raw.placeName : undefined,
    capturedAt,
    source,
  };
}

export function sanitizeTrackLocations(locations: Array<TimelineLocation | null | undefined>): TimelineLocation[] {
  return locations
    .map((location) => normalizeTrackLocation(location))
    .filter((location): location is TimelineLocation => Boolean(location));
}

export function haversineKm(a: TimelineLocation, b: TimelineLocation) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function sortLocationsByCapturedAt(locations: TimelineLocation[]) {
  return [...locations].sort((a, b) => {
    if (!a.capturedAt || !b.capturedAt) {
      return 0;
    }
    return Date.parse(a.capturedAt) - Date.parse(b.capturedAt);
  });
}

function mergeLocationMeta(
  base: TimelineLocation,
  previous?: TimelineLocation,
  next?: TimelineLocation
): TimelineLocation {
  return {
    accuracy: base.accuracy ?? previous?.accuracy ?? next?.accuracy,
    placeName: base.placeName ?? previous?.placeName ?? next?.placeName,
    capturedAt: base.capturedAt ?? previous?.capturedAt ?? next?.capturedAt,
    source: base.source ?? previous?.source ?? next?.source,
    latitude: base.latitude,
    longitude: base.longitude,
  };
}

export function smoothTrackLocations(locations: TimelineLocation[]): TimelineLocation[] {
  const safeLocations = sanitizeTrackLocations(locations);
  if (safeLocations.length < 3) {
    return safeLocations;
  }

  const smoothed: TimelineLocation[] = [safeLocations[0]];
  for (let i = 1; i < safeLocations.length - 1; i += 1) {
    const prev = safeLocations[i - 1];
    const current = safeLocations[i];
    const next = safeLocations[i + 1];

    const smoothLat =
      prev.latitude * 0.25 +
      current.latitude * 0.5 +
      next.latitude * 0.25;
    const smoothLng =
      prev.longitude * 0.25 +
      current.longitude * 0.5 +
      next.longitude * 0.25;

    smoothed.push(
      mergeLocationMeta(
        {
          ...current,
          latitude: smoothLat,
          longitude: smoothLng,
        },
        prev,
        next
      )
    );
  }
  smoothed.push(safeLocations[safeLocations.length - 1]);

  return smoothed;
}

export function prepareTrackRouteLocations(locations: TimelineLocation[]) {
  const safeLocations = sortLocationsByCapturedAt(sanitizeTrackLocations(locations));
  if (safeLocations.length < 2) {
    return safeLocations;
  }

  const filtered: TimelineLocation[] = [];
  for (const location of safeLocations) {
    const previous = filtered[filtered.length - 1];
    const isTrackingPoint = location.source !== 'manual';

    if (
      isTrackingPoint &&
      typeof location.accuracy === 'number' &&
      location.accuracy > MAX_TRACKING_ACCURACY_METERS
    ) {
      continue;
    }

    if (!previous) {
      filtered.push(location);
      continue;
    }

    const distanceKm = haversineKm(previous, location);
    if (distanceKm * 1000 < MIN_TRACKING_DISTANCE_METERS) {
      continue;
    }

    if (previous.capturedAt && location.capturedAt) {
      const durationHours =
        (Date.parse(location.capturedAt) - Date.parse(previous.capturedAt)) / 3600000;
      if (durationHours > 0) {
        const speedKmh = distanceKm / durationHours;
        if (speedKmh > MAX_TRACKING_SPEED_KMH) {
          continue;
        }
      }
    }

    filtered.push(location);
  }

  return filtered;
}

export function calculateTrackDistanceKm(locations: TimelineLocation[]) {
  const safeLocations = sanitizeTrackLocations(locations);
  if (safeLocations.length < 2) {
    return 0;
  }

  let distanceKm = 0;
  for (let i = 1; i < safeLocations.length; i += 1) {
    distanceKm += haversineKm(safeLocations[i - 1], safeLocations[i]);
  }

  return distanceKm;
}
