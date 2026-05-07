import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { sanitizeTrackLocations, smoothTrackLocations } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

type TrackMapProps = {
  routeLocations: TimelineLocation[];
  markerLocations?: TimelineLocation[];
};

export function TrackMap({
  routeLocations,
  markerLocations = routeLocations,
}: TrackMapProps) {
  const { t } = useI18n();
  const displayRouteLocations = smoothTrackLocations(sanitizeTrackLocations(routeLocations));
  const displayMarkerLocations = sanitizeTrackLocations(markerLocations);
  const summaryLocations =
    displayRouteLocations.length > 0 ? displayRouteLocations : displayMarkerLocations;

  if (summaryLocations.length === 0) {
    return null;
  }

  const first = summaryLocations[0];
  const last = summaryLocations[summaryLocations.length - 1];

  return (
    <View style={styles.fallbackBox}>
      <Text style={styles.title}>{t('trackMap.webTitle')}</Text>
      <Text style={styles.line}>
        {t('trackMap.webStart', { lat: first.latitude.toFixed(5), lng: first.longitude.toFixed(5) })}
      </Text>
      <Text style={styles.line}>
        {t('trackMap.webEnd', { lat: last.latitude.toFixed(5), lng: last.longitude.toFixed(5) })}
      </Text>
      <Text style={styles.line}>{t('trackMap.webCount', { count: displayMarkerLocations.length })}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    gap: 4,
    marginTop: 6,
  },
  title: {
    color: '#0f172a',
    fontWeight: '600',
  },
  line: {
    color: '#334155',
    fontSize: 12,
  },
});
