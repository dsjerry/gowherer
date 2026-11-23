import * as Location from 'expo-location';
import { Marker, Polygon } from 'expo-gaode-map';
import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { logLocalError } from '@/lib/local-log';

export type CityWalkUserLocation = {
  latitude: number;
  longitude: number;
};

/** 朝向低通滤波系数：越小越平滑，越大越跟手 */
const HEADING_SMOOTHING = 0.3;
/** 变化小于该角度不触发重绘，避免传感器抖动造成闪烁 */
const HEADING_DEADBAND_DEG = 3;

/** 箭头轮廓（屏幕像素）：f 为朝向方向的前后距离，r 为左右距离；尖端朝向前方 */
const ARROW_SHAPE_PX = [
  { f: 30, r: 0 },
  { f: -6, r: 13 },
  { f: -2, r: 0 },
  { f: -6, r: -13 },
];

/** Web 墨卡托下，单位屏幕像素对应的地面米数（256 px 瓦片体系） */
function metersPerPixel(latitude: number, zoom: number) {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;
}

/** 两个角度之间的最短有符号差（度） */
function angleDelta(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

/**
 * 设备朝向（真北优先，缺失时用磁北）。
 * 由系统融合陀螺仪 / 加速度计 / 磁力计，比直接积分陀螺仪稳定，不会随时间漂移。
 */
export function useDeviceHeading(enabled: boolean) {
  const [heading, setHeading] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') {
      return;
    }
    let active = true;
    let subscription: { remove: () => void } | null = null;
    let smoothed: number | null = null;

    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted) {
          return;
        }
        const sub = await Location.watchHeadingAsync((event) => {
          const raw = event.trueHeading >= 0 ? event.trueHeading : event.magHeading;
          if (!Number.isFinite(raw) || raw < 0) {
            return;
          }
          smoothed =
            smoothed === null
              ? raw
              : (smoothed + HEADING_SMOOTHING * angleDelta(smoothed, raw) + 360) % 360;
          const next = smoothed;
          setHeading((prev) =>
            prev === null || Math.abs(angleDelta(prev, next)) >= HEADING_DEADBAND_DEG ? next : prev,
          );
        });
        if (active) {
          subscription = sub;
        } else {
          sub.remove();
        }
      } catch (caught) {
        void logLocalError('CityWalkUserMarker', 'failed to watch device heading', caught);
      }
    })();

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled]);

  return heading;
}

/** 以中心为原点、朝向 headingDeg 的导航箭头；尺寸按缩放级别换算，屏幕上大小保持一致 */
export function buildNavArrow(
  center: { latitude: number; longitude: number },
  headingDeg: number,
  zoom: number,
) {
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.max(0.01, Math.cos((center.latitude * Math.PI) / 180));
  const scale = metersPerPixel(center.latitude, zoom);
  const rad = (headingDeg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  return ARROW_SHAPE_PX.map(({ f, r }) => {
    // 正北为 0、顺时针：前向单位向量 (sin, cos)，右向单位向量 (cos, -sin)
    const east = (f * sin + r * cos) * scale;
    const north = (f * cos - r * sin) * scale;
    return {
      latitude: center.latitude + north / metersPerLat,
      longitude: center.longitude + east / metersPerLng,
    };
  });
}

/** 当前位置：圆点 + 随设备朝向旋转的导航箭头（朝向不可用时只显示圆点） */
export function CityWalkUserMarker({
  location,
  zoom,
}: {
  location: CityWalkUserLocation;
  zoom: number;
}) {
  const heading = useDeviceHeading(true);
  const center = useMemo(
    () => ({ latitude: location.latitude, longitude: location.longitude }),
    [location.latitude, location.longitude],
  );
  const arrow = useMemo(
    () => (heading === null ? null : buildNavArrow(center, heading, zoom)),
    [center, heading, zoom],
  );

  return (
    <>
      {arrow ? (
        <Polygon
          points={arrow}
          fillColor="#176b58"
          strokeColor="#ffffff"
          strokeWidth={2}
          zIndex={1}
        />
      ) : null}
      <Marker
        position={center}
        anchor={{ x: 0.5, y: 0.5 }}
        centerOffset={{ x: 0, y: 0 }}
        zIndex={2}
        cacheKey="city-walk-user-location"
      >
        <View style={styles.halo}>
          <View style={styles.ring}>
            <View style={styles.dot} />
          </View>
        </View>
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  halo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(23,107,88,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#176b58',
  },
});
