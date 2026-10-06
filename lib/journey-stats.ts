import { Journey, JourneyKind, TimelineLocation } from '@/types/journey';
import { calculateTrackDistanceKm, haversineKm, sanitizeTrackLocations } from '@/lib/track-utils';

export type TFunction = (key: string, params?: Record<string, string | number>) => string;

export function formatDateTime(iso?: string) {
  if (!iso) {
    return '-';
  }
  const date = new Date(iso);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

export function kindLabel(kind: JourneyKind, t: TFunction) {
  return kind === 'travel' ? t('journey.kind.travel') : t('journey.kind.commute');
}

export function formatDuration(durationMs: number, t: TFunction) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return t('duration.minutes', { minutes });
  }
  if (minutes === 0) {
    return t('duration.hours', { hours });
  }
  return t('duration.hoursMinutes', { hours, minutes });
}

export function formatLocationLabel(location: TimelineLocation) {
  const coords = `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
  return location.placeName ? `${location.placeName} · ${coords}` : coords;
}

export function getJourneyTrackLocations(journey: Journey) {
  return sanitizeTrackLocations(journey.trackLocations ?? []);
}

export function getJourneyEntryLocations(journey: Journey) {
  return sanitizeTrackLocations(journey.entries.map((entry) => entry.location));
}

export function getJourneyTrackMapMarkerLocations(
  journey: Journey,
  trackLocations?: TimelineLocation[],
) {
  const routeLocations = trackLocations ?? getJourneyTrackLocations(journey);
  const entryLocations = getJourneyEntryLocations(journey);

  if (routeLocations.length === 0) {
    return entryLocations;
  }

  const start = routeLocations[0];
  const end = routeLocations[routeLocations.length - 1];
  const hasStartEntry = entryLocations.some(
    (loc) =>
      Math.abs(loc.latitude - start.latitude) < 0.0001 &&
      Math.abs(loc.longitude - start.longitude) < 0.0001,
  );
  const hasEndEntry = entryLocations.some(
    (loc) =>
      Math.abs(loc.latitude - end.latitude) < 0.0001 &&
      Math.abs(loc.longitude - end.longitude) < 0.0001,
  );

  const markers: TimelineLocation[] = [];
  if (!hasStartEntry) markers.push(start);
  markers.push(...entryLocations);
  if (!hasEndEntry) markers.push(end);
  return markers;
}

export type SegmentStats = {
  durationMs: number;
  distanceKm: number | null;
  avgSpeedKmh: number | null;
  segmentTrack: TimelineLocation[];
};

export function computeSegmentStats(
  journey: Journey,
  trackLocations: TimelineLocation[],
  startIndex: number,
  endIndex: number,
): SegmentStats {
  const from = journey.entries[Math.min(startIndex, endIndex)];
  const to = journey.entries[Math.max(startIndex, endIndex)];
  if (!from || !to) {
    return {
      durationMs: 0,
      distanceKm: null,
      avgSpeedKmh: null,
      segmentTrack: [],
    };
  }
  const startMs = Date.parse(from.createdAt);
  const endMs = Date.parse(to.createdAt);
  const durationMs =
    Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0;

  // Prefer GPS track points captured between the two record points; fall back
  // to the straight line between their own locations.
  const segmentTrack = trackLocations.filter((point) => {
    if (!point.capturedAt) {
      return false;
    }
    const at = Date.parse(point.capturedAt);
    return at >= startMs && at <= endMs;
  });

  let distanceKm: number | null = null;
  if (segmentTrack.length >= 2) {
    distanceKm = calculateTrackDistanceKm(segmentTrack);
  } else if (from.location && to.location) {
    distanceKm = haversineKm(from.location, to.location);
  }

  const avgSpeedKmh =
    distanceKm != null && durationMs > 0 ? distanceKm / (durationMs / 3600000) : null;

  return { durationMs, distanceKm, avgSpeedKmh, segmentTrack };
}

// Cached per journey/selection so toggling the dropdowns does not re-filter
// and re-measure thousands of track points on every render.
const segmentStatsCache = new Map<string, SegmentStats>();

export function getSegmentStats(
  journey: Journey,
  trackLocations: TimelineLocation[],
  journeyId: string,
  startIndex: number,
  endIndex: number,
) {
  const cacheKey = `${journeyId}:${startIndex}:${endIndex}`;
  const cached = segmentStatsCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  if (segmentStatsCache.size > 100) {
    segmentStatsCache.clear();
  }
  const stats = computeSegmentStats(journey, trackLocations, startIndex, endIndex);
  segmentStatsCache.set(cacheKey, stats);
  return stats;
}

export function computeJourneyStats(journey: Journey, trackLocations?: TimelineLocation[]) {
  const track = trackLocations ?? getJourneyTrackLocations(journey);
  const entryLocations = getJourneyEntryLocations(journey);
  const distanceSource = track.length >= 2 ? track : entryLocations;
  const distanceKm = calculateTrackDistanceKm(distanceSource);

  const endMs = journey.endedAt
    ? new Date(journey.endedAt).getTime()
    : journey.entries.length > 0
      ? new Date(journey.entries[journey.entries.length - 1].createdAt).getTime()
      : new Date(journey.createdAt).getTime();
  const startMs = new Date(journey.createdAt).getTime();
  const durationMs = Number.isFinite(endMs - startMs) ? Math.max(0, endMs - startMs) : 0;
  const avgSpeedKmh = durationMs > 0 ? distanceKm / (durationMs / 3600000) : 0;

  return {
    locationPoints: track.length + entryLocations.length,
    distanceKm,
    durationMs,
    avgSpeedKmh,
  };
}
