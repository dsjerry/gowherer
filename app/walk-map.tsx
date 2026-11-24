import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MapView, type MapViewRef } from 'expo-gaode-map';

import {
  CityWalkRouteOverlays,
  useCityWalkCamera,
  useCityWalkMapZoom,
  useCityWalkRoutePoints,
  useCityWalkUserLocation,
  useCityWalkWalkedPoints,
} from '@/components/city-walk-map';
import { getCityWalkTheme } from '@/components/city-walk-theme';
import { useCityWalkTrack } from '@/hooks/use-city-walk-track';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { consumePendingWalkMapPlan } from '@/lib/pending-walk-map';
import { CityWalkPlan } from '@/types/city-walk';

/** 全屏地图：没有 ScrollView / 分页，高德地图可以直接拖动、缩放 */
export default function WalkMapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const isDark = useColorScheme() === 'dark';
  const theme = getCityWalkTheme(isDark);

  // 一次性交接：进入页面时读取方案，之后清空
  const [plan] = useState(() => consumePendingWalkMapPlan());
  const walkedTrack = useCityWalkTrack(plan?.linkedJourneyId, Boolean(plan?.linkedJourneyId));

  const routePoints = useCityWalkRoutePoints(plan ?? EMPTY_PLAN);
  const walkedPoints = useCityWalkWalkedPoints(walkedTrack);
  const camera = useCityWalkCamera(plan ?? EMPTY_PLAN, routePoints);
  const userLocation = useCityWalkUserLocation(Boolean(plan));
  const mapZoom = useCityWalkMapZoom(camera.zoom);

  const mapRef = useRef<MapViewRef | null>(null);
  const lastFollowAtRef = useRef(0);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!following || !userLocation) {
      return;
    }
    const now = Date.now();
    if (now - lastFollowAtRef.current < 2500) {
      return;
    }
    lastFollowAtRef.current = now;
    void mapRef.current?.setCenter(userLocation, true).catch(() => undefined);
  }, [following, userLocation]);

  const toggleFollow = useCallback(() => {
    if (following) {
      setFollowing(false);
      return;
    }
    setFollowing(true);
    if (userLocation) {
      lastFollowAtRef.current = Date.now();
      void mapRef.current?.setCenter(userLocation, true).catch(() => undefined);
      void mapRef.current?.setZoom(16, true).catch(() => undefined);
    }
  }, [following, userLocation]);

  if (!plan) {
    return (
      <View style={[styles.page, { backgroundColor: theme.page, paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.line }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('cityWalk.back')}
          >
            <MaterialIcons name="arrow-back" size={21} color={theme.text} />
          </Pressable>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.muted }]}>{t('cityWalk.mapEmpty')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: theme.page }]}>
      <MapView
        ref={(ref) => {
          mapRef.current = ref;
        }}
        style={StyleSheet.absoluteFill}
        myLocationEnabled={false}
        myLocationButtonEnabled={false}
        zoomControlsEnabled={false}
        scrollGesturesEnabled
        zoomGesturesEnabled
        rotateGesturesEnabled={false}
        tiltGesturesEnabled={false}
        initialCameraPosition={{ target: camera.center, zoom: camera.zoom }}
        onCameraMove={mapZoom.onCameraChange}
        onCameraIdle={mapZoom.onCameraChange}
      >
        <CityWalkRouteOverlays
          plan={plan}
          routePoints={routePoints}
          walkedPoints={walkedPoints}
          userLocation={userLocation}
          zoom={mapZoom.zoom}
        />
      </MapView>

      <View style={[styles.header, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.line }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('cityWalk.back')}
        >
          <MaterialIcons name="arrow-back" size={21} color={theme.text} />
        </Pressable>
        <View
          style={[styles.titleCard, { backgroundColor: theme.surface, borderColor: theme.line }]}
        >
          <Text style={[styles.overline, { color: theme.accent }]}>{t('cityWalk.walkingNow')}</Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {plan.title || t('cityWalk.defaultPlanTitle', { count: plan.stops.length })}
          </Text>
        </View>
      </View>

      <View style={styles.legendWrap} pointerEvents="box-none">
        <View
          style={[
            styles.mapLegend,
            { backgroundColor: isDark ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.9)' },
          ]}
        >
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#0f766e' }]} />
            <Text style={[styles.mapLegendText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
              {t('cityWalk.legendPlanned')}
            </Text>
          </View>
          {walkedPoints.length > 0 ? (
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#f97316' }]} />
              <Text style={[styles.mapLegendText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
                {t('cityWalk.legendWalked', { count: walkedPoints.length })}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          style={[
            styles.followButton,
            isDark ? styles.mapControlDark : styles.mapControlLight,
            following && styles.mapControlActive,
          ]}
          onPress={toggleFollow}
          accessibilityRole="button"
          accessibilityLabel={
            following ? t('cityWalk.stopFollowLocation') : t('cityWalk.followLocation')
          }
        >
          <MaterialIcons
            name={following ? 'gps-fixed' : 'gps-not-fixed'}
            size={20}
            color={following ? '#ffffff' : isDark ? '#e2e8f0' : '#334155'}
          />
        </Pressable>
      </View>
    </View>
  );
}

/** 方案缺失时的占位，保证 hooks 调用顺序稳定 */
const EMPTY_PLAN: CityWalkPlan = {
  id: '',
  createdAt: '',
  title: '',
  origin: { latitude: 0, longitude: 0, coordinateSystem: 'gcj02' },
  stops: [],
  legs: [],
  totalDistanceMeters: 0,
  walkingDurationSeconds: 0,
  estimatedTotalMinutes: 0,
  preferences: {
    durationMinutes: 0,
    interests: [],
    pace: 'normal',
    routeShape: 'loop',
    maxStops: 5,
    radiusMeters: 0,
  },
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  overline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  legendWrap: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  mapLegend: {
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mapLegendText: {
    fontSize: 11,
  },
  followButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlLight: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapControlDark: {
    backgroundColor: 'rgba(15,23,42,0.78)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  mapControlActive: {
    backgroundColor: '#176b58',
    borderWidth: 1,
    borderColor: '#176b58',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
