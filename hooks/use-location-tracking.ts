import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import * as Location from 'expo-location';

import { useI18n } from '@/hooks/locale-preference';
import {
  isBackgroundLocationTrackingAvailable,
  isLocationTrackingActive,
  startLocationTracking,
  stopLocationTracking,
} from '@/lib/background-location';
import { logLocalError } from '@/lib/local-log';
import { Journey } from '@/types/journey';

export function useLocationTracking(
  activeJourney: Journey | undefined,
  onRefreshJourneys?: () => void
) {
  const { t } = useI18n();
  const [locationTracking, setLocationTracking] = useState(false);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const onRefreshRef = useRef(onRefreshJourneys);
  onRefreshRef.current = onRefreshJourneys;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!activeJourney) {
        if (active) setLocationTracking(false);
        return;
      }
      const started = await isLocationTrackingActive();
      if (active) setLocationTracking(started);
    })();
    return () => {
      active = false;
    };
  }, [activeJourney?.id]);

  useEffect(() => {
    if (!locationTracking || !activeJourney) return;
    const intervalId = setInterval(() => {
      onRefreshRef.current?.();
    }, 10000);
    return () => clearInterval(intervalId);
  }, [locationTracking, activeJourney]);

  const handleTrackingChange = useCallback(
    async (nextValue: boolean) => {
      if (!activeJourney || trackingBusy) return;
      setTrackingBusy(true);
      try {
        if (!nextValue) {
          await stopLocationTracking();
          setLocationTracking(false);
          onRefreshRef.current?.();
          return;
        }

        const available = await isBackgroundLocationTrackingAvailable();
        if (!available) {
          Alert.alert(
            t('journey.alertTrackingUnavailableTitle'),
            t('journey.alertTrackingUnavailableBody')
          );
          return;
        }

        const foregroundPermission =
          await Location.requestForegroundPermissionsAsync();
        if (foregroundPermission.status !== 'granted') {
          Alert.alert(
            t('journey.alertTrackingPermissionTitle'),
            t('journey.alertTrackingPermissionBody')
          );
          return;
        }

        const backgroundPermission =
          await Location.requestBackgroundPermissionsAsync();
        if (backgroundPermission.status !== 'granted') {
          Alert.alert(
            t('journey.alertTrackingPermissionTitle'),
            t('journey.alertTrackingPermissionBody')
          );
          return;
        }

        await startLocationTracking(activeJourney.id, {
          notificationTitle: t('journey.trackingNotificationTitle'),
          notificationBody: t('journey.trackingNotificationBody'),
        });
        setLocationTracking(true);
      } catch (error) {
        void logLocalError(
          'JourneyScreen',
          'failed to toggle location tracking',
          error
        );
        Alert.alert(
          t('journey.alertTrackingStartFailedTitle'),
          t('journey.alertTrackingStartFailedBody')
        );
      } finally {
        setTrackingBusy(false);
      }
    },
    [activeJourney, trackingBusy, t]
  );

  return { locationTracking, trackingBusy, handleTrackingChange };
}
