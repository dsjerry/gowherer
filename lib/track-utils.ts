import { TimelineLocation } from "@/types/journey";

const MAX_TRACKING_ACCURACY_METERS = 100;
const MAX_TRACKING_SPEED_KMH = 180;
const MIN_TRACKING_DISTANCE_METERS = 3;
const MAX_NEIGHBOR_DISTANCE_METERS = 500;

export function normalizeTrackLocation(
  location: unknown,
): TimelineLocation | null {
  if (!location || typeof location !== "object") {
    return null;
  }

  const raw = location as {
    latitude?: unknown;
    longitude?: unknown;
    accuracy?: unknown;
    placeName?: unknown;
    capturedAt?: unknown;
    source?: unknown;
    coordSystem?: unknown;
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
    typeof raw.capturedAt === "string" &&
    Number.isFinite(Date.parse(raw.capturedAt))
      ? new Date(raw.capturedAt).toISOString()
      : undefined;
  const source =
    raw.source === "tracking"
      ? "tracking"
      : raw.source === "manual"
        ? "manual"
        : undefined;

  const coordSystem =
    raw.coordSystem === "wgs84" || raw.coordSystem === "gcj02"
      ? raw.coordSystem
      : undefined;

  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(raw.accuracy) ? Number(raw.accuracy) : undefined,
    placeName: typeof raw.placeName === "string" ? raw.placeName : undefined,
    capturedAt,
    source,
    coordSystem,
  };
}

export function sanitizeTrackLocations(
  locations: Array<TimelineLocation | null | undefined>,
): TimelineLocation[] {
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
  next?: TimelineLocation,
): TimelineLocation {
  return {
    accuracy: base.accuracy ?? previous?.accuracy ?? next?.accuracy,
    placeName: base.placeName ?? previous?.placeName ?? next?.placeName,
    capturedAt: base.capturedAt ?? previous?.capturedAt ?? next?.capturedAt,
    source: base.source ?? previous?.source ?? next?.source,
    coordSystem: base.coordSystem ?? previous?.coordSystem ?? next?.coordSystem,
    latitude: base.latitude,
    longitude: base.longitude,
  };
}

export function smoothTrackLocations(
  locations: TimelineLocation[],
): TimelineLocation[] {
  const safeLocations = sanitizeTrackLocations(locations);
  if (safeLocations.length < 3) {
    return safeLocations;
  }

  const metersToDegLat = 1 / 111000;
  const cosLat = Math.cos((safeLocations[0].latitude * Math.PI) / 180);
  const metersToDegLng = 1 / (111000 * Math.max(0.01, cosLat));

  const DEFAULT_ACCURACY = 15;
  const PROCESS_NOISE = 3;

  let estLat = safeLocations[0].latitude;
  let estLng = safeLocations[0].longitude;
  let estVarLat =
    DEFAULT_ACCURACY * DEFAULT_ACCURACY * metersToDegLat * metersToDegLat;
  let estVarLng =
    DEFAULT_ACCURACY * DEFAULT_ACCURACY * metersToDegLng * metersToDegLng;

  const smoothed: TimelineLocation[] = [
    { ...safeLocations[0], latitude: estLat, longitude: estLng },
  ];

  for (let i = 1; i < safeLocations.length; i += 1) {
    const current = safeLocations[i];
    const accuracyM =
      typeof current.accuracy === "number"
        ? current.accuracy
        : DEFAULT_ACCURACY;
    const measVarLat = accuracyM * accuracyM * metersToDegLat * metersToDegLat;
    const measVarLng = accuracyM * accuracyM * metersToDegLng * metersToDegLng;
    const procVarLat =
      PROCESS_NOISE * PROCESS_NOISE * metersToDegLat * metersToDegLat;
    const procVarLng =
      PROCESS_NOISE * PROCESS_NOISE * metersToDegLng * metersToDegLng;

    estVarLat += procVarLat;
    estVarLng += procVarLng;

    const kalmanGainLat = estVarLat / (estVarLat + measVarLat);
    const kalmanGainLng = estVarLng / (estVarLng + measVarLng);

    estLat += kalmanGainLat * (current.latitude - estLat);
    estLng += kalmanGainLng * (current.longitude - estLng);
    estVarLat = (1 - kalmanGainLat) * estVarLat;
    estVarLng = (1 - kalmanGainLng) * estVarLng;

    smoothed.push(
      mergeLocationMeta(
        { ...current, latitude: estLat, longitude: estLng },
        smoothed[smoothed.length - 1],
        current,
      ),
    );
  }

  return smoothed;
}

export function prepareTrackRouteLocations(locations: TimelineLocation[]) {
  const safeLocations = sortLocationsByCapturedAt(
    sanitizeTrackLocations(locations),
  );
  if (safeLocations.length < 2) {
    return safeLocations;
  }

  const filtered: TimelineLocation[] = [];
  for (const location of safeLocations) {
    const previous = filtered[filtered.length - 1];
    const isTrackingPoint = location.source !== "manual";

    if (
      isTrackingPoint &&
      typeof location.accuracy === "number" &&
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

    if (distanceKm * 1000 > MAX_NEIGHBOR_DISTANCE_METERS) {
      continue;
    }

    if (previous.capturedAt && location.capturedAt) {
      const durationHours =
        (Date.parse(location.capturedAt) - Date.parse(previous.capturedAt)) /
        3600000;
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

function perpendicularDistanceKm(
  point: TimelineLocation,
  lineStart: TimelineLocation,
  lineEnd: TimelineLocation,
): number {
  const latLng = lineEnd.latitude - lineStart.latitude;
  const lngLng = lineEnd.longitude - lineStart.longitude;

  const lenSq = latLng * latLng + lngLng * lngLng;
  if (lenSq === 0) {
    return haversineKm(point, lineStart);
  }

  let t =
    ((point.latitude - lineStart.latitude) * latLng +
      (point.longitude - lineStart.longitude) * lngLng) /
    lenSq;
  t = Math.max(0, Math.min(1, t));

  const projLat = lineStart.latitude + t * latLng;
  const projLng = lineStart.longitude + t * lngLng;

  return haversineKm(point, {
    latitude: projLat,
    longitude: projLng,
  } as TimelineLocation);
}

function douglasPeucker(
  locations: TimelineLocation[],
  epsilonKm: number,
): TimelineLocation[] {
  if (locations.length < 3) {
    return locations;
  }

  let maxDist = 0;
  let maxIndex = 0;
  const start = locations[0];
  const end = locations[locations.length - 1];

  for (let i = 1; i < locations.length - 1; i += 1) {
    const dist = perpendicularDistanceKm(locations[i], start, end);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilonKm) {
    const left = douglasPeucker(locations.slice(0, maxIndex + 1), epsilonKm);
    const right = douglasPeucker(locations.slice(maxIndex), epsilonKm);
    return [...left.slice(0, -1), ...right];
  }

  return [start, end];
}

export function simplifyTrackLocations(
  locations: TimelineLocation[],
  maxPoints = 200,
): TimelineLocation[] {
  const safeLocations = sanitizeTrackLocations(locations);
  if (safeLocations.length <= maxPoints) {
    return safeLocations;
  }

  const totalDistanceKm = calculateTrackDistanceKm(safeLocations);
  const epsilonKm = Math.max(
    0.0005,
    (totalDistanceKm / safeLocations.length) * 0.5,
  );

  let result = douglasPeucker(safeLocations, epsilonKm);
  let currentEpsilon = epsilonKm;
  while (result.length > maxPoints) {
    currentEpsilon *= 2;
    const simplified = douglasPeucker(result, currentEpsilon);
    // If simplification didn't reduce points, further iterations won't help
    if (simplified.length === result.length) break;
    result = simplified;
  }

  return result;
}
