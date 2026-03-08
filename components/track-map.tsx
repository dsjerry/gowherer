import Constants from 'expo-constants';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { toGcj02 } from '@/lib/reverse-geocode';
import { sanitizeTrackLocations, smoothTrackLocations } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

const startMarkerIcon = require('../assets/images/marker-start.png');
const endMarkerIcon = require('../assets/images/marker-end.png');
const midMarkerIcon = require('../assets/images/marker-mid.png');

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

function getAmapZoom(locations: TimelineLocation[]) {
  if (locations.length <= 1) {
    return 16;
  }

  const lats = locations.map((item) => item.latitude);
  const lngs = locations.map((item) => item.longitude);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));

  if (span < 0.01) {
    return 16;
  }
  if (span < 0.03) {
    return 14;
  }
  if (span < 0.08) {
    return 12;
  }
  return 10;
}

export function TrackMap({ locations }: { locations: TimelineLocation[] }) {
  const displayLocations = smoothTrackLocations(sanitizeTrackLocations(locations));
  const amapAndroidApiKey =
    Constants.expoConfig?.extra?.amap?.androidApiKey ??
    process.env.EXPO_PUBLIC_AMAP_ANDROID_API_KEY;
  const [amapReady, setAmapReady] = useState(Platform.OS !== 'android');
  const [amapError, setAmapError] = useState<string | null>(null);

  const amapLocations = useMemo(
    () =>
      displayLocations.map((item) => toGcj02(item.latitude, item.longitude)),
    [displayLocations]
  );

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    if (!amapAndroidApiKey) {
      setAmapReady(false);
      setAmapError('未配置高德 Android Key。');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AMapSdk } = require('react-native-amap3d');
      AMapSdk.init(amapAndroidApiKey);
      setAmapReady(true);
      setAmapError(null);
    } catch {
      setAmapReady(false);
      setAmapError('高德地图初始化失败。');
    }
  }, [amapAndroidApiKey]);

  if (displayLocations.length === 0) {
    return null;
  }

  if (Platform.OS === 'android' && !amapReady) {
    return (
      <View style={styles.mapFallbackWrap}>
        <Text style={styles.mapFallbackTitle}>轨迹地图暂不可用</Text>
        <Text style={styles.mapFallbackText}>
          {amapError ?? '高德地图初始化中，请稍后重试。'}
        </Text>
      </View>
    );
  }

  if (Platform.OS === 'android') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MapView: AMapView, Marker: AMapMarker, Polyline: AMapPolyline } = require('react-native-amap3d');
    const center = amapLocations[Math.floor(amapLocations.length / 2)];
    const first = amapLocations[0];
    const last = amapLocations[amapLocations.length - 1];

    return (
      <View style={styles.mapWrap}>
        <AMapView
          style={styles.map}
          myLocationEnabled={false}
          myLocationButtonEnabled={false}
          zoomControlsEnabled={false}
          initialCameraPosition={{
            target: center,
            zoom: getAmapZoom(amapLocations),
          }}>
          <AMapPolyline points={amapLocations} width={4} color="#0f766e" colors={[]} />
          {amapLocations.map((point, index) => {
            const isStart = index === 0;
            const isEnd = index === amapLocations.length - 1;
            return (
              <AMapMarker
                key={`${point.latitude}-${point.longitude}-${index}`}
                position={point}
                icon={isStart ? startMarkerIcon : isEnd ? endMarkerIcon : midMarkerIcon}
              />
            );
          })}
        </AMapView>
      </View>
    );
  }

  return (
    <View style={styles.mapWrap}>
      <MapView style={styles.map} initialRegion={getRegion(displayLocations)}>
        <Polyline coordinates={displayLocations} strokeWidth={4} strokeColor="#0f766e" />
        {displayLocations.map((location, index) => (
          <Marker
            key={`${location.latitude}-${location.longitude}-${index}`}
            coordinate={location}
            pinColor={
              index === 0
                ? '#0284c7'
                : index === displayLocations.length - 1
                  ? '#dc2626'
                  : '#0f766e'
            }
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
  mapFallbackWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  mapFallbackTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '700',
  },
  mapFallbackText: {
    color: '#475569',
    fontSize: 12,
    lineHeight: 18,
  },
});
