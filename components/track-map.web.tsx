import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { smoothTrackLocations } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

export function TrackMap({ locations }: { locations: TimelineLocation[] }) {
  const { t } = useI18n();
  const displayLocations = smoothTrackLocations(locations);

  if (displayLocations.length === 0) {
    return null;
  }

  const first = displayLocations[0];
  const last = displayLocations[displayLocations.length - 1];

  return (
    <View style={styles.fallbackBox}>
      <Text style={styles.title}>{t('trackMap.webTitle')}</Text>
      <Text style={styles.line}>
        {t('trackMap.webStart', { lat: first.latitude.toFixed(5), lng: first.longitude.toFixed(5) })}
      </Text>
      <Text style={styles.line}>
        {t('trackMap.webEnd', { lat: last.latitude.toFixed(5), lng: last.longitude.toFixed(5) })}
      </Text>
      <Text style={styles.line}>{t('trackMap.webCount', { count: displayLocations.length })}</Text>
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
