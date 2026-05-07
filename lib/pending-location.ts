import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeTrackLocation } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

const PENDING_LOCATION_KEY = 'gowherer:pending-location:v1';

function normalizeLocation(value: unknown): TimelineLocation | null {
  return normalizeTrackLocation(value);
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
