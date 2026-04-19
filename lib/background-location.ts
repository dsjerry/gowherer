import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { loadJourneys, saveJourneys } from '@/lib/journey-storage';

const TRACKING_TASK_NAME = 'gowherer-background-location-task';
const TRACKING_JOURNEY_ID_KEY = 'gowherer:tracking:journey-id:v1';

type StartTrackingOptions = {
  notificationTitle: string;
  notificationBody: string;
};

type BackgroundLocationTaskData = {
  locations?: Location.LocationObject[];
};

async function appendTrackLocations(locations: Location.LocationObject[]) {
  if (locations.length === 0) {
    return;
  }

  const trackedJourneyId = await AsyncStorage.getItem(TRACKING_JOURNEY_ID_KEY);
  if (!trackedJourneyId) {
    return;
  }

  const journeys = await loadJourneys();
  const nextLocations = locations.map((item) => ({
    latitude: item.coords.latitude,
    longitude: item.coords.longitude,
    accuracy: item.coords.accuracy ?? undefined,
  }));

  const nextJourneys = journeys.map((journey) =>
    journey.id === trackedJourneyId
      ? {
          ...journey,
          trackLocations: [...journey.trackLocations, ...nextLocations],
        }
      : journey
  );

  await saveJourneys(nextJourneys);
}

if (!TaskManager.isTaskDefined(TRACKING_TASK_NAME)) {
  TaskManager.defineTask<BackgroundLocationTaskData>(TRACKING_TASK_NAME, async ({ data, error }) => {
    if (error) {
      console.error('Background location task failed', error);
      return;
    }

    await appendTrackLocations(data?.locations ?? []);
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
