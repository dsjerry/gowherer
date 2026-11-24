import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type NativeSyntheticEvent,
} from 'react-native';
import {
  ExpoGaodeMapModule,
  MapView,
  Marker,
  Polyline,
  type CameraEvent,
  type MapViewRef,
} from 'expo-gaode-map';

import { getCityWalkTheme } from '@/components/city-walk-theme';
import { CityWalkUserMarker, type CityWalkUserLocation } from '@/components/city-walk-user-marker';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { toGcj02 } from '@/lib/reverse-geocode';
import { CityWalkPlan } from '@/types/city-walk';
import { TimelineLocation } from '@/types/journey';

const ORIGIN_MARKER_ICON = 'marker_start';
const ORIGIN_MARKER_SIZE = 28;
/** 预览态地图高度 */
const MAP_PREVIEW_HEIGHT = 240;
/** 计划路线颜色（高德步行规划） */
const PLANNED_ROUTE_COLOR = '#0f766e';
/** 实际 GPS 轨迹颜色，与计划路线区分 */
const WALKED_TRACK_COLOR = '#f97316';
/** 跟随模式下的相机移动节流 */
const FOLLOW_THROTTLE_MS = 2500;
/** 当前位置刷新间隔（单次定位，不启动持续定位） */
const LOCATION_POLL_MS = 5000;

function getZoomForSpan(span: number) {
  if (span < 0.005) return 16;
  if (span < 0.01) return 15;
  if (span < 0.02) return 14;
  if (span < 0.05) return 13;
  if (span < 0.1) return 12;
  if (span < 0.3) return 11;
  return 10;
}

function toAmapCoordinate(location: TimelineLocation) {
  if (location.coordSystem === 'gcj02') {
    return { latitude: location.latitude, longitude: location.longitude };
  }
  return toGcj02(location.latitude, location.longitude);
}

export function useCityWalkUserLocation(enabled = true) {
  const [userLocation, setUserLocation] = useState<CityWalkUserLocation | null>(null);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      return;
    }
    let active = true;
    const read = async () => {
      try {
        const location = await ExpoGaodeMapModule.getCurrentLocation();
        if (
          !active ||
          !Number.isFinite(location.latitude) ||
          !Number.isFinite(location.longitude)
        ) {
          return;
        }
        setUserLocation({ latitude: location.latitude, longitude: location.longitude });
      } catch {
        // 定位失败只影响蓝点显示，不影响路线
      }
    };
    void read();
    const timer = setInterval(() => {
      void read();
    }, LOCATION_POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled]);

  return userLocation;
}

/** 缩放级别变化小于该值时不更新，避免每个相机事件都重绘覆盖物 */
const ZOOM_UPDATE_EPSILON = 0.05;

/** 跟踪地图缩放级别（缩放过程中实时更新），供当前位置箭头按屏幕像素定尺寸 */
export function useCityWalkMapZoom(initialZoom: number) {
  const [zoom, setZoom] = useState(initialZoom);
  const onCameraChange = useCallback((event: NativeSyntheticEvent<CameraEvent>) => {
    const next = event.nativeEvent.cameraPosition.zoom;
    if (next === undefined || !Number.isFinite(next)) {
      return;
    }
    setZoom((prev) => (Math.abs(prev - next) < ZOOM_UPDATE_EPSILON ? prev : next));
  }, []);
  return { zoom, onCameraChange };
}

export function useCityWalkRoutePoints(plan: CityWalkPlan) {
  return useMemo(() => {
    const points: { latitude: number; longitude: number }[] = [];
    for (const leg of plan.legs) {
      for (const point of leg.polyline) {
        const last = points[points.length - 1];
        if (last && last.latitude === point.latitude && last.longitude === point.longitude) {
          continue;
        }
        points.push({ latitude: point.latitude, longitude: point.longitude });
      }
    }
    return points;
  }, [plan.legs]);
}

export function useCityWalkWalkedPoints(walkedTrack?: TimelineLocation[]) {
  return useMemo(
    () => (walkedTrack ?? []).map((location) => toAmapCoordinate(location)),
    [walkedTrack],
  );
}

export function useCityWalkCamera(
  plan: CityWalkPlan,
  routePoints: { latitude: number; longitude: number }[],
) {
  return useMemo(() => {
    const bounds = [
      { latitude: plan.origin.latitude, longitude: plan.origin.longitude },
      ...plan.stops.map((stop) => ({
        latitude: stop.poi.latitude,
        longitude: stop.poi.longitude,
      })),
      ...routePoints,
    ];
    if (bounds.length === 0) {
      return {
        center: { latitude: plan.origin.latitude, longitude: plan.origin.longitude },
        zoom: 15,
      };
    }
    const lats = bounds.map((point) => point.latitude);
    const lngs = bounds.map((point) => point.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      center: { latitude: (minLat + maxLat) / 2, longitude: (minLng + maxLng) / 2 },
      zoom: getZoomForSpan(Math.max(maxLat - minLat, maxLng - minLng)),
    };
  }, [plan.origin.latitude, plan.origin.longitude, plan.stops, routePoints]);
}

/** 计划路线的覆盖物，供预览地图与全屏地图共用 */
export function CityWalkRouteOverlays({
  plan,
  routePoints,
  walkedPoints,
  userLocation,
  zoom,
}: {
  plan: CityWalkPlan;
  routePoints: { latitude: number; longitude: number }[];
  walkedPoints: { latitude: number; longitude: number }[];
  userLocation: CityWalkUserLocation | null;
  zoom: number;
}) {
  const { t } = useI18n();

  return (
    <>
      {routePoints.length >= 2 ? (
        <Polyline points={routePoints} strokeWidth={5} strokeColor={PLANNED_ROUTE_COLOR} />
      ) : null}
      {walkedPoints.length >= 2 ? (
        <Polyline points={walkedPoints} strokeWidth={5} strokeColor={WALKED_TRACK_COLOR} />
      ) : null}
      {userLocation ? <CityWalkUserMarker location={userLocation} zoom={zoom} /> : null}
      <Marker
        position={{ latitude: plan.origin.latitude, longitude: plan.origin.longitude }}
        icon={ORIGIN_MARKER_ICON}
        iconWidth={ORIGIN_MARKER_SIZE}
        iconHeight={ORIGIN_MARKER_SIZE}
        title={plan.origin.label ?? t('cityWalk.originLabel')}
      />
      {plan.stops.map((stop) => (
        <Marker
          key={stop.poi.poiId}
          position={{ latitude: stop.poi.latitude, longitude: stop.poi.longitude }}
          title={`${stop.order}. ${stop.poi.name}`}
          snippet={stop.poi.category}
          anchor={{ x: 0.5, y: 0.5 }}
          centerOffset={{ x: 0, y: 0 }}
          cacheKey={`city-walk-stop-${stop.order}`}
        >
          <View style={styles.stopHalo}>
            <View style={styles.stopMarker}>
              <Text style={styles.stopMarkerText}>{stop.order}</Text>
            </View>
          </View>
        </Marker>
      ))}
    </>
  );
}

type Props = {
  plan: CityWalkPlan;
  /** 「开始漫步」后关联旅程记录的实际 GPS 轨迹 */
  walkedTrack?: TimelineLocation[];
  /** 打开全屏地图（可自由拖动 / 缩放） */
  onOpenFullscreen?: () => void;
};

/**
 * 内嵌的路线预览地图：静态展示，不接管手势。
 *
 * 高德原生地图不会主动调用 requestDisallowInterceptTouchEvent，放在 ScrollView
 * 或标签页分页里直接拖动会被父级抢走手势，因此这里只做预览，交互统一交给
 * 全屏地图页（app/walk-map.tsx）。
 *
 * 地图实例绝不重新挂载 —— AMap 在已有实例存活时新建实例会渲染黑屏
 * （见 docs/PROJECT_STATE.md 的多实例限制）。
 */
export function CityWalkMap({ plan, walkedTrack, onOpenFullscreen }: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getCityWalkTheme(isDark);

  const routePoints = useCityWalkRoutePoints(plan);
  const walkedPoints = useCityWalkWalkedPoints(walkedTrack);
  const camera = useCityWalkCamera(plan, routePoints);
  const userLocation = useCityWalkUserLocation();
  const mapZoom = useCityWalkMapZoom(camera.zoom);

  const mapRef = useRef<MapViewRef | null>(null);
  const lastFollowAtRef = useRef(0);
  const [following, setFollowing] = useState(false);
  // 只有「本次打开页面后才开始记录」的轨迹才自动跟随
  const startedEmptyRef = useRef(walkedPoints.length === 0);

  useEffect(() => {
    if (startedEmptyRef.current && walkedPoints.length > 0) {
      startedEmptyRef.current = false;
      setFollowing(true);
    }
  }, [walkedPoints.length]);

  useEffect(() => {
    if (!following || !userLocation) {
      return;
    }
    const now = Date.now();
    if (now - lastFollowAtRef.current < FOLLOW_THROTTLE_MS) {
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

  return (
    <View style={[styles.mapWrap, { borderColor: theme.line, backgroundColor: theme.subtle }]}>
      <MapView
        ref={(ref) => {
          mapRef.current = ref;
        }}
        style={styles.map}
        myLocationEnabled={false}
        myLocationButtonEnabled={false}
        zoomControlsEnabled={false}
        scrollGesturesEnabled={false}
        zoomGesturesEnabled={false}
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

      <View
        style={[
          styles.mapLegend,
          { backgroundColor: isDark ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.88)' },
        ]}
        pointerEvents="none"
      >
        <View style={styles.legendRow}>
          <View style={[styles.legendDot, { backgroundColor: PLANNED_ROUTE_COLOR }]} />
          <Text style={[styles.mapLegendText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
            {t('cityWalk.legendPlanned')}
          </Text>
        </View>
        {walkedPoints.length > 0 ? (
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: WALKED_TRACK_COLOR }]} />
            <Text style={[styles.mapLegendText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
              {t('cityWalk.legendWalked', { count: walkedPoints.length })}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.mapControls}>
        <Pressable
          style={[
            styles.mapControlButton,
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
            size={17}
            color={following ? '#ffffff' : isDark ? '#e2e8f0' : '#334155'}
          />
        </Pressable>
        {onOpenFullscreen ? (
          <Pressable
            style={[
              styles.mapControlButton,
              isDark ? styles.mapControlDark : styles.mapControlLight,
            ]}
            onPress={onOpenFullscreen}
            accessibilityRole="button"
            accessibilityLabel={t('cityWalk.openMap')}
          >
            <MaterialIcons name="open-in-full" size={16} color={isDark ? '#e2e8f0' : '#334155'} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: MAP_PREVIEW_HEIGHT,
    borderRadius: 17,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  stopHalo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(23,107,88,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#176b58',
    borderWidth: 2.5,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  stopMarkerText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    includeFontPadding: false,
  },
  mapLegend: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    // 给右侧的跟随 / 全屏按钮留出空间
    right: 62,
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
    flex: 1,
    fontSize: 11,
  },
  mapControls: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    gap: 8,
  },
  mapControlButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapControlLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapControlDark: {
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  mapControlActive: {
    backgroundColor: '#176b58',
    borderWidth: 1,
    borderColor: '#176b58',
  },
});
