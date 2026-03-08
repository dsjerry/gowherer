import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { reverseGeocodePlaceName } from '@/lib/reverse-geocode';
import { getLocalLogFileUri, logLocalError, logLocalInfo } from '@/lib/local-log';
import { TimelineLocation } from '@/types/journey';

type AMapLatLng = {
  latitude: number;
  longitude: number;
};

type Props = {
  visible: boolean;
  initialLocation?: TimelineLocation;
  isDark: boolean;
  onClose: () => void;
  onConfirm: (location: TimelineLocation) => void | Promise<void>;
};

const DEFAULT_CENTER: AMapLatLng = {
  latitude: 39.908692,
  longitude: 116.397477,
};

export function AMapPlacePicker({
  visible,
  initialLocation,
  isDark,
  onClose,
  onConfirm,
}: Props) {
  const initedRef = useRef(false);
  const pendingCameraTargetRef = useRef<AMapLatLng | null>(null);
  const mapRef = useRef<{ moveCamera?: (cameraPosition: { target: AMapLatLng; zoom?: number }, duration?: number) => void } | null>(null);
  const [selected, setSelected] = useState<AMapLatLng | null>(null);
  const [cameraTarget, setCameraTarget] = useState<AMapLatLng>(DEFAULT_CENTER);
  const [placeName, setPlaceName] = useState('');
  const [resolving, setResolving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const center = useMemo<AMapLatLng>(() => {
    if (selected) {
      return selected;
    }
    if (initialLocation) {
      return {
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
      };
    }
    return DEFAULT_CENTER;
  }, [initialLocation, selected]);

  const amapAndroidApiKey =
    Constants.expoConfig?.extra?.amap?.androidApiKey ??
    process.env.EXPO_PUBLIC_AMAP_ANDROID_API_KEY;

  function moveCameraTo(target: AMapLatLng, duration = 300) {
    setCameraTarget(target);
    pendingCameraTargetRef.current = target;
    mapRef.current?.moveCamera?.({ target, zoom: 16 }, duration);
  }

  useEffect(() => {
    if (!visible) {
      return;
    }

    setCameraTarget(
      initialLocation
        ? {
            latitude: initialLocation.latitude,
            longitude: initialLocation.longitude,
          }
        : DEFAULT_CENTER
    );
    setSelected(
      initialLocation
        ? {
            latitude: initialLocation.latitude,
            longitude: initialLocation.longitude,
          }
        : null
    );
    setPlaceName(initialLocation?.placeName ?? '');

    if (Platform.OS !== 'android') {
      setSdkReady(false);
      setSdkError('当前仅支持 Android 高德 SDK 选点。');
      void logLocalInfo('AMapPicker', 'platform not supported', {
        platform: Platform.OS,
      });
      return;
    }

    if (!amapAndroidApiKey) {
      setSdkReady(false);
      setSdkError('未配置高德 Android Key，请检查 app.config.ts。');
      void logLocalInfo('AMapPicker', 'missing android api key');
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AMapSdk } = require('react-native-amap3d');
      if (!initedRef.current) {
        AMapSdk.init(amapAndroidApiKey);
        initedRef.current = true;
        void logLocalInfo('AMapPicker', 'sdk initialized');
      }
      setSdkError(null);
      setSdkReady(true);
    } catch (error) {
      void logLocalError('AMapPicker', error, { stage: 'init-sdk' });
      setSdkReady(false);
      setSdkError('高德 SDK 尚不可用，请使用 Dev Client / EAS 构建后再试。');
    }
  }, [amapAndroidApiKey, initialLocation, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'android' || !sdkReady) {
      return;
    }
    if (!pendingCameraTargetRef.current) {
      return;
    }

    const target = pendingCameraTargetRef.current;
    mapRef.current?.moveCamera?.({ target, zoom: 16 }, 300);
  }, [sdkReady, visible]);

  useEffect(() => {
    if (!visible || Platform.OS !== 'android') {
      return;
    }

    let active = true;
    (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active || !permission.granted) {
          return;
        }

        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) {
          return;
        }

        const target = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        moveCameraTo(target, 300);
        void logLocalInfo('AMapPicker', 'camera moved to current location', target);
      } catch (error) {
        void logLocalError('AMapPicker', error, { stage: 'load-current-position' });
      }
    })();

    return () => {
      active = false;
    };
  }, [visible]);

  async function resolvePlaceName(target: AMapLatLng) {
    setResolving(true);
    try {
      const maybeName = await reverseGeocodePlaceName(
        target.latitude,
        target.longitude
      );
      setPlaceName(maybeName ?? '');
    } catch (error) {
      void logLocalError('AMapPicker', error, {
        stage: 'reverse-geocode',
        target,
      });
      setPlaceName('');
    } finally {
      setResolving(false);
    }
  }

  async function selectByMapTap(target: AMapLatLng) {
    if (!Number.isFinite(target.latitude) || !Number.isFinite(target.longitude)) {
      void logLocalInfo('AMapPicker', 'invalid map tap coordinates', target);
      return;
    }
    setSelected(target);
    void logLocalInfo('AMapPicker', 'map pressed', target);
    await resolvePlaceName(target);
  }

  async function confirmSelection() {
    if (!selected) {
      Alert.alert('请先选点', '请在地图上点击一个地点后再确认。');
      return;
    }
    if (!Number.isFinite(selected.latitude) || !Number.isFinite(selected.longitude)) {
      Alert.alert('选点无效', '当前经纬度无效，请重新选点。');
      void logLocalInfo('AMapPicker', 'invalid selected coordinates', selected);
      return;
    }

    setConfirming(true);
    const location: TimelineLocation = {
      latitude: selected.latitude,
      longitude: selected.longitude,
      placeName: placeName.trim() || undefined,
    };

    try {
      void logLocalInfo('AMapPicker', 'confirm selection', location);
      await Promise.resolve(onConfirm(location));
      onClose();
    } catch (error) {
      void logLocalError('AMapPicker', error, {
        stage: 'confirm',
        location,
      });
      Alert.alert(
        '保存选点失败',
        `请重试，错误已写入本地日志：${getLocalLogFileUri()}`
      );
    } finally {
      setConfirming(false);
    }
  }

  function renderAndroidMap() {
    if (!sdkReady) {
      return (
        <View style={styles.sdkHintWrap}>
          <Text style={styles.sdkHintText}>{sdkError ?? '高德 SDK 初始化中...'}</Text>
        </View>
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MapView, Marker } = require('react-native-amap3d');
    return (
      <MapView
        ref={(ref: typeof mapRef.current) => {
          mapRef.current = ref;
          if (ref && pendingCameraTargetRef.current) {
            ref.moveCamera?.({ target: pendingCameraTargetRef.current, zoom: 16 }, 300);
          }
        }}
        style={styles.map}
        myLocationEnabled
        myLocationButtonEnabled
        onPress={({ nativeEvent }: { nativeEvent: AMapLatLng }) => {
          void selectByMapTap(nativeEvent);
        }}
        onPressPoi={({
          nativeEvent,
        }: {
          nativeEvent: { name: string; position: AMapLatLng };
        }) => {
          void logLocalInfo('AMapPicker', 'poi pressed', nativeEvent);
          setSelected(nativeEvent.position);
          setPlaceName(nativeEvent.name ?? '');
        }}
        initialCameraPosition={{
          target: cameraTarget ?? center,
          zoom: 16,
        }}>
        {selected ? <Marker position={selected} /> : null}
      </MapView>
    );
  }

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[styles.host, visible ? styles.hostVisible : styles.hostHidden]}>
      <View style={styles.mask}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#1e293b' : '#ffffff',
              borderColor: isDark ? '#334155' : '#e2e8f0',
            },
          ]}>
          <Text style={[styles.title, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>
            高德地图选点
          </Text>
          <Text style={[styles.hint, { color: isDark ? '#94a3b8' : '#475569' }]}>
            点击地图或 POI 名称完成选点，再确认回填到记录。
          </Text>

          {renderAndroidMap()}

          <View style={styles.placeNameRow}>
            <TextInput
              style={[
                styles.placeInput,
                {
                  backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                  borderColor: isDark ? '#334155' : '#cbd5e1',
                  color: isDark ? '#e2e8f0' : '#0f172a',
                },
              ]}
              value={placeName}
              onChangeText={setPlaceName}
              placeholder="地点名称（可编辑）"
              placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
            />
            {resolving ? <ActivityIndicator size="small" /> : null}
          </View>

          {selected ? (
            <Text style={[styles.coord, { color: isDark ? '#cbd5e1' : '#334155' }]}>
              {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
            </Text>
          ) : (
            <Text style={[styles.coord, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              暂未选点
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>取消</Text>
            </Pressable>
            <Pressable
              style={styles.confirmButton}
              onPress={() => void confirmSelection()}
              disabled={confirming}>
              <Text style={styles.confirmText}>
                {confirming ? '确认中...' : '确认选点'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
  },
  hostVisible: {
    opacity: 1,
  },
  hostHidden: {
    opacity: 0,
  },
  mask: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    padding: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
  },
  map: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sdkHintWrap: {
    height: 300,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 16,
  },
  sdkHintText: {
    color: '#334155',
    textAlign: 'center',
  },
  placeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  coord: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: '#334155',
    fontWeight: '600',
  },
  confirmText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
