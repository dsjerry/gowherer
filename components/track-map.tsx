import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { smoothTrackLocations } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

function getRegion(locations: TimelineLocation[]) {
  if (locations.length === 0) {
    return {
      latitude: 39.9042,
      longitude: 116.4074,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };
  }

  if (locations.length === 1) {
    return {
      latitude: locations[0].latitude,
      longitude: locations[0].longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }

  const lats = locations.map((item) => item.latitude);
  const lngs = locations.map((item) => item.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * 1.4),
    longitudeDelta: Math.max(0.01, (maxLng - minLng) * 1.4),
  };
}

export function TrackMap({ locations }: { locations: TimelineLocation[] }) {
  const displayLocations = smoothTrackLocations(locations);

  if (displayLocations.length === 0) {
    return null;
  }

  return (
    <View style={styles.mapWrap}>
      <MapView style={styles.map} initialRegion={getRegion(displayLocations)}>
        <Polyline coordinates={displayLocations} strokeWidth={4} strokeColor="#0f766e" />
        {displayLocations.map((location, index) => (
          <Marker
            key={`${location.latitude}-${location.longitude}-${index}`}
            coordinate={location}
            title={index === 0 ? '起点' : index === displayLocations.length - 1 ? '终点' : `节点 ${index + 1}`}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 6,
  },
  map: {
    width: '100%',
    height: 180,
  },
});
