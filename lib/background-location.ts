import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { appendTrackApi } from '@/lib/api-client';
import { normalizeTrackLocation } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

const TRACKING_TASK_NAME = 'gowherer-background-location-task';
const TRACKING_JOURNEY_ID_KEY = 'gowherer:tracking:journey-id:v1';
const TRACKING_BATCH_PREFIX = 'gowherer:tracking:batch:v1';

type StartTrackingOptions = {
  notificationTitle: string;
  notificationBody: string;
};

type BackgroundLocationTaskData = {
  locations?: Location.LocationObject[];
};

async function bufferTrackLocations(locations: Location.LocationObject[]) {
  if (locations.length === 0) {
    return;
  }

  const trackedJourneyId = await AsyncStorage.getItem(TRACKING_JOURNEY_ID_KEY);
  if (!trackedJourneyId) {
    return;
  }

  const nextLocations: TimelineLocation[] = locations.map((item) => ({
    latitude: item.coords.latitude,
    longitude: item.coords.longitude,
    accuracy: item.coords.accuracy ?? undefined,
    capturedAt: new Date(item.timestamp).toISOString(),
    source: 'tracking',
  }));

  // Buffer locally (background tasks may not have network)
  const batchKey = `${TRACKING_BATCH_PREFIX}:${trackedJourneyId}:${Date.now()}:${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  await AsyncStorage.setItem(batchKey, JSON.stringify(nextLocations));
}

if (!TaskManager.isTaskDefined(TRACKING_TASK_NAME)) {
  TaskManager.defineTask<BackgroundLocationTaskData>(TRACKING_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('Background location task failed', error);
      return;
    }

    await bufferTrackLocations(data?.locations ?? []);
  });
}

export async function isBackgroundLocationTrackingAvailable() {
  if (Platform.OS === 'web') {
    return false;
  }

  return TaskManager.isAvailableAsync();
}

export async function isLocationTrackingActive() {
  if (Platform.OS === 'web') {
    return false;
  }

  return Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME);
}

export async function startLocationTracking(
  journeyId: string,
  options: StartTrackingOptions
) {
  if (Platform.OS === 'web') {
    return;
  }

  if (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME)) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
  }

  await AsyncStorage.setItem(TRACKING_JOURNEY_ID_KEY, journeyId);

  await Location.startLocationUpdatesAsync(TRACKING_TASK_NAME, {
    accuracy: Location.Accuracy.BestForNavigation,
    activityType: Location.ActivityType.Fitness,
    timeInterval: 3000,
    distanceInterval: 3,
    deferredUpdatesInterval: 5000,
    deferredUpdatesDistance: 5,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: options.notificationTitle,
      notificationBody: options.notificationBody,
      notificationColor: '#0f766e',
      killServiceOnDestroy: false,
    },
  });
}

export async function stopLocationTracking() {
  if (Platform.OS !== 'web' && (await Location.hasStartedLocationUpdatesAsync(TRACKING_TASK_NAME))) {
    await Location.stopLocationUpdatesAsync(TRACKING_TASK_NAME);
  }

  await AsyncStorage.removeItem(TRACKING_JOURNEY_ID_KEY);
}

/**
 * Sync buffered track locations from AsyncStorage to the server API.
 * Background tasks buffer locally because network may not be available.
 */
export async function syncBufferedTrackLocations(journeyId: string) {
  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = `${TRACKING_BATCH_PREFIX}:${journeyId}:`;
  const batchKeys = allKeys.filter((key) => key.startsWith(prefix));

  if (batchKeys.length === 0) {
    return 0;
  }

  const rawItems = await AsyncStorage.multiGet(batchKeys);
  const nextLocations = rawItems.flatMap(([, raw]) => {
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed
            .map((location) => normalizeTrackLocation(location))
            .filter((location): location is TimelineLocation => Boolean(location))
        : [];
    } catch {
      return [];
    }
  });

  // Send to server
  try {
    await appendTrackApi(journeyId, nextLocations);
    // Only remove from buffer after successful sync
    await AsyncStorage.multiRemove(batchKeys);
  } catch {
    // Keep in buffer if sync fails — will retry next time
    console.warn('Track sync failed, will retry');
  }

  return nextLocations.length;
}
