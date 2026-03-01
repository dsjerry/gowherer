import { StyleSheet, Text, View } from 'react-native';

import { smoothTrackLocations } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

export function TrackMap({ locations }: { locations: TimelineLocation[] }) {
  const displayLocations = smoothTrackLocations(locations);

  if (displayLocations.length === 0) {
    return null;
  }

  const first = displayLocations[0];
  const last = displayLocations[displayLocations.length - 1];

  return (
    <View style={styles.fallbackBox}>
      <Text style={styles.title}>轨迹地图（Web 端简化）</Text>
      <Text style={styles.line}>
        起点：{first.latitude.toFixed(5)}, {first.longitude.toFixed(5)}
      </Text>
      <Text style={styles.line}>
        终点：{last.latitude.toFixed(5)}, {last.longitude.toFixed(5)}
      </Text>
      <Text style={styles.line}>定位点数量：{displayLocations.length}</Text>
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
