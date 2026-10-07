import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
  ensureLegacyRecovered,
  getJourneyDb,
  loadJourneysFromDb,
  saveJourneysToDb,
} from '@/lib/journey-db';
import { normalizeJourneyList } from '@/lib/journey-normalize';
import { JOURNEY_STORAGE_KEY } from '@/lib/storage-keys';
import { Journey } from '@/types/journey';

export async function loadJourneys(): Promise<Journey[]> {
  if (Platform.OS === 'web') {
    return loadJourneysFromAsyncStorage();
  }

  // 先等旧数据恢复完成,避免恢复与后续读写交错。
  await ensureLegacyRecovered();
  const db = await getJourneyDb();
  return loadJourneysFromDb(db);
}

export async function saveJourneys(journeys: Journey[]): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(journeys));
    return;
  }

  await ensureLegacyRecovered();
  const db = await getJourneyDb();
  await saveJourneysToDb(db, journeys);
}

async function loadJourneysFromAsyncStorage(): Promise<Journey[]> {
  const raw = await AsyncStorage.getItem(JOURNEY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeJourneyList(parsed);
  } catch {
    return [];
  }
}
