import AsyncStorage from '@react-native-async-storage/async-storage';

import { Journey } from '@/types/journey';

const JOURNEY_STORAGE_KEY = 'gowherer:journeys:v1';

export async function loadJourneys(): Promise<Journey[]> {
  const raw = await AsyncStorage.getItem(JOURNEY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => ({
      ...item,
      kind: item.kind === 'commute' ? 'commute' : 'travel',
    })) as Journey[];
  } catch {
    return [];
  }
}

export async function saveJourneys(journeys: Journey[]): Promise<void> {
  await AsyncStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(journeys));
}
