import { TimelineLocation } from '@/types/journey';

function normalizeTrackLocation(location: unknown): TimelineLocation | null {
  if (!location || typeof location !== 'object') {
    return null;
  }

  const raw = location as {
    latitude?: unknown;
    longitude?: unknown;
    accuracy?: unknown;
    placeName?: unknown;
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

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(raw.accuracy) ? Number(raw.accuracy) : undefined,
    placeName: typeof raw.placeName === 'string' ? raw.placeName : undefined,
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

function mergeLocationMeta(
  base: TimelineLocation,
  previous?: TimelineLocation,
  next?: TimelineLocation
): TimelineLocation {
  return {
    accuracy: base.accuracy ?? previous?.accuracy ?? next?.accuracy,
    placeName: base.placeName ?? previous?.placeName ?? next?.placeName,
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
