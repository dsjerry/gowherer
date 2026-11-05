import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MapView, Marker, Polyline, type MapViewRef } from 'expo-gaode-map';

import { getCityWalkTheme } from '@/components/city-walk-theme';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CityWalkPlan } from '@/types/city-walk';

const ORIGIN_MARKER_ICON = 'marker_start';
const ORIGIN_MARKER_SIZE = 28;
/** 预览态地图高度 */
const MAP_PREVIEW_HEIGHT = 240;
/** 放大 / 收起的高度过渡时长 */
const MAP_RESIZE_DURATION = 260;

function getZoomForSpan(span: number) {
  if (span < 0.005) return 16;
  if (span < 0.01) return 15;
  if (span < 0.02) return 14;
  if (span < 0.05) return 13;
  if (span < 0.1) return 12;
  if (span < 0.3) return 11;
  return 10;
}

type Props = {
  plan: CityWalkPlan;
  /** 放大后的目标高度，由调用方按可视区域计算 */
  expandedHeight: number;
  /** 通知调用方切换状态（放大时应禁用页面滚动，避免手势冲突） */
  onEnlargedChange?: (enlarged: boolean) => void;
};

/**
 * 计划路线地图：折线与途经点全部来自高德步行规划结果（GCJ-02）。
 *
 * 放大只改自身容器高度，绝不重新挂载 MapView —— AMap 在已有实例存活时
 * 新建实例会渲染黑屏（见 docs/PROJECT_STATE.md 的多实例限制）。
 */
export function CityWalkMap({ plan, expandedHeight, onEnlargedChange }: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = getCityWalkTheme(isDark);

  const routePoints = useMemo(() => {
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

  // initialCameraPosition 只在首帧生效；删站/重算后需要重新把整条路线框进视野
  const bounds = useMemo(
    () => [
      { latitude: plan.origin.latitude, longitude: plan.origin.longitude },
      ...plan.stops.map((stop) => ({
        latitude: stop.poi.latitude,
        longitude: stop.poi.longitude,
      })),
      ...routePoints,
    ],
    [plan.origin.latitude, plan.origin.longitude, plan.stops, routePoints],
  );

  const camera = useMemo(() => {
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
  }, [bounds, plan.origin.latitude, plan.origin.longitude]);

  const mapRef = useRef<MapViewRef | null>(null);
  const hasFittedRef = useRef(false);

  /** 把整条路线框进视野；失败只影响取景，不影响已经画好的路线 */
  const fitBounds = useCallback(() => {
    const ref = mapRef.current;
    if (!ref || bounds.length < 2 || typeof ref.fitToCoordinates !== 'function') {
      return;
    }
    hasFittedRef.current = true;
    void ref
      .fitToCoordinates(bounds, { paddingPx: 44, maxZoom: 16, duration: 250 })
      .catch(() => undefined);
  }, [bounds]);

  useEffect(() => {
    // 首次取景交给 onLoad（地图就绪后 viewport 才是有效尺寸），之后随路线变化重取景
    if (!hasFittedRef.current) {
      return;
    }
    fitBounds();
  }, [fitBounds]);

  // ---- 放大 / 收起 -------------------------------------------------------

  const [enlarged, setEnlarged] = useState(false);
  const mapHeight = useSharedValue(MAP_PREVIEW_HEIGHT);
  const animatedMapStyle = useAnimatedStyle(() => ({ height: mapHeight.value }));

  const collapse = useCallback(() => {
    setEnlarged(false);
    onEnlargedChange?.(false);
    // 缩回后 viewport 变小，重新把整条路线框进视野
    setTimeout(fitBounds, 40);
  }, [fitBounds, onEnlargedChange]);

  const toggleEnlarged = useCallback(() => {
    if (!enlarged) {
      setEnlarged(true);
      onEnlargedChange?.(true);
      mapHeight.value = withTiming(expandedHeight, { duration: MAP_RESIZE_DURATION });
      // 容器变大后 viewport 才更新，等动画结束再重新取景
      setTimeout(fitBounds, MAP_RESIZE_DURATION + 40);
      return;
    }
    // 收起时必须等高度动画结束再改回预览高度，否则会立刻回弹
    mapHeight.value = withTiming(
      MAP_PREVIEW_HEIGHT,
      { duration: MAP_RESIZE_DURATION },
      (finished) => {
        if (finished) {
          runOnJS(collapse)();
        }
      },
    );
  }, [collapse, enlarged, expandedHeight, fitBounds, mapHeight, onEnlargedChange]);

  // 视口变化（旋转 / 分屏）时，放大态跟随新的目标高度
  useEffect(() => {
    if (enlarged) {
      mapHeight.value = withTiming(expandedHeight, { duration: MAP_RESIZE_DURATION });
    }
  }, [enlarged, expandedHeight, mapHeight]);

  return (
    <Animated.View
      style={[
        styles.mapWrap,
        {
          borderColor: theme.line,
          // 地图首帧绘制前用主题底色占位，避免闪白/闪黑
          backgroundColor: theme.subtle,
        },
        animatedMapStyle,
      ]}
    >
      <MapView
        ref={(ref) => {
          mapRef.current = ref;
        }}
        style={styles.map}
        myLocationEnabled={false}
        myLocationButtonEnabled={false}
        zoomControlsEnabled={false}
        scrollGesturesEnabled={enlarged}
        zoomGesturesEnabled={enlarged}
        rotateGesturesEnabled={false}
        tiltGesturesEnabled={false}
        onLoad={fitBounds}
        initialCameraPosition={{ target: camera.center, zoom: camera.zoom }}
      >
        {routePoints.length >= 2 ? (
          <Polyline points={routePoints} strokeWidth={5} strokeColor="#0f766e" />
        ) : null}
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
            <View style={styles.stopMarker}>
              <Text style={styles.stopMarkerText}>{stop.order}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <View
        style={[
          styles.mapLegend,
          { backgroundColor: isDark ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.86)' },
        ]}
      >
        <MaterialIcons name="directions-walk" size={13} color={theme.accent} />
        <Text style={[styles.mapLegendText, { color: isDark ? '#cbd5e1' : '#475569' }]}>
          {t('cityWalk.plannedRouteNote')}
        </Text>
      </View>

      <Pressable
        style={[
          styles.mapEnlargeButton,
          isDark ? styles.mapEnlargeButtonDark : styles.mapEnlargeButtonLight,
        ]}
        onPress={toggleEnlarged}
        accessibilityRole="button"
        accessibilityLabel={enlarged ? t('cityWalk.mapCollapse') : t('cityWalk.mapExpand')}
      >
        <MaterialIcons
          name={enlarged ? 'close-fullscreen' : 'open-in-full'}
          size={16}
          color={isDark ? '#e2e8f0' : '#334155'}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    borderRadius: 17,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  stopMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#176b58',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopMarkerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  mapLegend: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    // 给右下角的放大按钮留出空间
    right: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mapLegendText: {
    fontSize: 11,
    flex: 1,
  },
  mapEnlargeButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapEnlargeButtonLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mapEnlargeButtonDark: {
    backgroundColor: 'rgba(15,23,42,0.72)',
    borderWidth: 1,
    borderColor: '#334155',
  },
});
