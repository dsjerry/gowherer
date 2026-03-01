import { TimelineLocation } from '@/types/journey';

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
  if (locations.length < 3) {
    return locations;
  }

  const smoothed: TimelineLocation[] = [locations[0]];
  for (let i = 1; i < locations.length - 1; i += 1) {
    const prev = locations[i - 1];
    const current = locations[i];
    const next = locations[i + 1];

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
  smoothed.push(locations[locations.length - 1]);

  return smoothed;
}

export function calculateTrackDistanceKm(locations: TimelineLocation[]) {
  if (locations.length < 2) {
    return 0;
  }

  let distanceKm = 0;
  for (let i = 1; i < locations.length; i += 1) {
    distanceKm += haversineKm(locations[i - 1], locations[i]);
  }

  return distanceKm;
}
