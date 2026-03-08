import AsyncStorage from '@react-native-async-storage/async-storage';

import { TimelineLocation } from '@/types/journey';

const PENDING_LOCATION_KEY = 'gowherer:pending-location:v1';

function normalizeLocation(value: unknown): TimelineLocation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const data = value as {
    latitude?: unknown;
    longitude?: unknown;
    placeName?: unknown;
    accuracy?: unknown;
  };
  const latitude = Number(data.latitude);
  const longitude = Number(data.longitude);
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
    placeName: typeof data.placeName === 'string' ? data.placeName : undefined,
    accuracy: Number.isFinite(data.accuracy) ? Number(data.accuracy) : undefined,
  };
}

export async function setPendingLocation(location: TimelineLocation): Promise<void> {
  await AsyncStorage.setItem(PENDING_LOCATION_KEY, JSON.stringify(location));
}

export async function consumePendingLocation(): Promise<TimelineLocation | null> {
  const raw = await AsyncStorage.getItem(PENDING_LOCATION_KEY);
  if (!raw) {
    return null;
  }
  await AsyncStorage.removeItem(PENDING_LOCATION_KEY);

  try {
    const parsed = JSON.parse(raw);
    return normalizeLocation(parsed);
  } catch {
    return null;
  }
}
