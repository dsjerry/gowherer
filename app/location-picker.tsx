import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/locale-preference';
import { setPendingLocation } from '@/lib/pending-location';
import {
  NearbyPlace,
  queryNearbyPlaces,
  reverseGeocodePlaceName,
  toGcj02,
  toWgs84,
} from '@/lib/reverse-geocode';
import { TimelineLocation } from '@/types/journey';

type AMapLatLng = {
  latitude: number;
  longitude: number;
};

function parseInitialLocation(raw: string | string[] | undefined): TimelineLocation | null {
  if (!raw || Array.isArray(raw)) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      latitude?: unknown;
      longitude?: unknown;
      placeName?: unknown;
    };
    const latitude = Number(parsed.latitude);
    const longitude = Number(parsed.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }
    return {
      latitude,
      longitude,
      placeName: typeof parsed.placeName === 'string' ? parsed.placeName : undefined,
    };
  } catch {
    return null;
  }
}

export default function LocationPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();
  const params = useLocalSearchParams<{ initial?: string }>();
  const initialLocation = useMemo(
    () => parseInitialLocation(params.initial),
    [params.initial]
  );
  const pendingCameraTargetRef = useRef<AMapLatLng | null>(null);
  const selectionRequestIdRef = useRef(0);
  const autoLocateTriggeredRef = useRef(false);
  const screenActiveRef = useRef(false);
  const mapRef = useRef<{
    moveCamera?: (cameraPosition: { target: AMapLatLng; zoom?: number }, duration?: number) => void;
  } | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AMapLatLng | null>(null);
  const [selectedWgs, setSelectedWgs] = useState<AMapLatLng | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [nearbyHint, setNearbyHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [mapVisible, setMapVisible] = useState(true);

  const amapAndroidApiKey =
    Constants.expoConfig?.extra?.amap?.androidApiKey ??
    process.env.EXPO_PUBLIC_AMAP_ANDROID_API_KEY;
  const amapWebKey =
    Constants.expoConfig?.extra?.geocoding?.amapWebKey ??
    process.env.EXPO_PUBLIC_AMAP_WEB_KEY;

  const theme = {
    page: { backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    title: { color: isDark ? '#e2e8f0' : '#0f172a' },
    muted: { color: isDark ? '#94a3b8' : '#475569' },
    coord: { color: isDark ? '#cbd5e1' : '#334155' },
    item: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    itemTitle: { color: isDark ? '#e2e8f0' : '#0f172a' },
    itemSub: { color: isDark ? '#94a3b8' : '#64748b' },
  };

  function moveCameraTo(target: AMapLatLng, duration = 250) {
    if (!screenActiveRef.current) {
      return;
    }
    pendingCameraTargetRef.current = target;
    mapRef.current?.moveCamera?.({ target, zoom: 16 }, duration);
  }

  const refreshNearbyPlaces = useCallback(
    async (target: AMapLatLng) => {
      if (!amapWebKey) {
        setNearbyHint(t('mapPicker.missingWebKey'));
        setNearbyPlaces([]);
        return;
      }
      setLoadingNearby(true);
      setNearbyHint('');
      try {
        const list = await queryNearbyPlaces(
          target.latitude,
          target.longitude,
          1200,
          { coordinateType: 'gcj02' }
        );
        setNearbyPlaces(list);
        if (list.length === 0) {
          setNearbyHint(t('mapPicker.nearbyEmpty'));
        }
      } catch {
        setNearbyPlaces([]);
        setNearbyHint(t('mapPicker.nearbyFailed'));
      } finally {
        setLoadingNearby(false);
      }
    },
    [amapWebKey, t]
  );

  const selectPoint = useCallback(
    (target: AMapLatLng, source: 'wgs84' | 'gcj02', presetName?: string) => {
      if (!screenActiveRef.current) {
        return;
      }
      const mapTarget = source === 'gcj02' ? target : toGcj02(target.latitude, target.longitude);
      const wgsTarget = source === 'wgs84' ? target : toWgs84(target.latitude, target.longitude);
      const requestId = selectionRequestIdRef.current + 1;
      selectionRequestIdRef.current = requestId;

      setSelected(mapTarget);
      setSelectedWgs(wgsTarget);
      moveCameraTo(mapTarget);
      if (presetName) {
        setPlaceName(presetName);
      }

      void (async () => {
        if (!presetName) {
          try {
            const name = await reverseGeocodePlaceName(
              mapTarget.latitude,
              mapTarget.longitude,
              { coordinateType: 'gcj02' }
            );
            if (screenActiveRef.current && selectionRequestIdRef.current === requestId) {
              setPlaceName(name ?? '');
            }
          } catch {
            if (screenActiveRef.current && selectionRequestIdRef.current === requestId) {
              setPlaceName('');
            }
          }
        }

        if (screenActiveRef.current && selectionRequestIdRef.current === requestId) {
          await refreshNearbyPlaces(mapTarget);
        }
      })();
    },
    [refreshNearbyPlaces]
  );

  const locateCurrent = useCallback(async () => {
    if (!screenActiveRef.current) {
      return;
    }
    setLoadingLocation(true);
    let hasPosition = false;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!screenActiveRef.current) {
        return;
      }
      if (!permission.granted) {
        Alert.alert(t('mapPicker.locationDeniedTitle'), t('mapPicker.locationDeniedBody'));
        return;
      }

      const lastKnown = await Location.getLastKnownPositionAsync({
        maxAge: 1000 * 60 * 5,
        requiredAccuracy: 300,
      });

      if (lastKnown?.coords) {
        hasPosition = true;
        selectPoint(
          {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          },
          'wgs84'
        );
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (!screenActiveRef.current) {
        return;
      }
      hasPosition = true;
      selectPoint(
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        'wgs84'
      );
    } catch {
      if (screenActiveRef.current && !hasPosition) {
        Alert.alert(t('mapPicker.locationFailedTitle'), t('mapPicker.locationFailedBody'));
      }
    } finally {
      if (screenActiveRef.current) {
        setLoadingLocation(false);
      }
    }
  }, [selectPoint, t]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      setSdkReady(false);
      setSdkError(t('mapPicker.sdkAndroidOnly'));
      return;
    }
    if (!amapAndroidApiKey) {
      setSdkReady(false);
      setSdkError(t('mapPicker.sdkMissingKey'));
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { AMapSdk } = require('react-native-amap3d');
      AMapSdk.init(amapAndroidApiKey);
      setSdkError(null);
      setSdkReady(true);
    } catch {
      setSdkReady(false);
      setSdkError(t('mapPicker.sdkUnavailable'));
    }
  }, [amapAndroidApiKey, t]);

  useFocusEffect(
    useCallback(() => {
      screenActiveRef.current = true;
      setMapVisible(true);

      if (autoLocateTriggeredRef.current) {
        return () => {
          screenActiveRef.current = false;
          mapRef.current = null;
          selectionRequestIdRef.current += 1;
        };
      }
      autoLocateTriggeredRef.current = true;

      if (initialLocation) {
        selectPoint(
          { latitude: initialLocation.latitude, longitude: initialLocation.longitude },
          'wgs84',
          initialLocation.placeName
        );
        return () => {
          screenActiveRef.current = false;
          mapRef.current = null;
          selectionRequestIdRef.current += 1;
        };
      }
      void locateCurrent();

      return () => {
        screenActiveRef.current = false;
        mapRef.current = null;
        selectionRequestIdRef.current += 1;
      };
    }, [initialLocation, locateCurrent, selectPoint])
  );

  async function confirmLocation() {
    if (!selected || !selectedWgs) {
      Alert.alert(t('mapPicker.selectFirstTitle'), t('mapPicker.selectFirstBody'));
      return;
    }
    setSaving(true);
    try {
      await setPendingLocation({
        latitude: selectedWgs.latitude,
        longitude: selectedWgs.longitude,
        placeName: placeName.trim() || undefined,
      });
      // Unmount AMap first, then navigate back, to avoid native crash during concurrent teardown.
      setMapVisible(false);
      screenActiveRef.current = false;
      mapRef.current = null;
      selectionRequestIdRef.current += 1;
      setTimeout(() => {
        router.back();
      }, 120);
    } finally {
      if (screenActiveRef.current) {
        setSaving(false);
      }
    }
  }

  function renderMap() {
    if (!mapVisible) {
      return (
        <View style={styles.mapFallback}>
          <Text style={[styles.mapFallbackText, theme.muted]}>{t('mapPicker.savingBack')}</Text>
        </View>
      );
    }

    if (!sdkReady) {
      return (
        <View style={styles.mapFallback}>
          <Text style={[styles.mapFallbackText, theme.muted]}>
            {sdkError ?? t('mapPicker.mapInit')}
          </Text>
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
            ref.moveCamera?.({ target: pendingCameraTargetRef.current, zoom: 16 }, 250);
          }
        }}
        style={styles.map}
        myLocationEnabled={false}
        myLocationButtonEnabled={false}
        onPress={({ nativeEvent }: { nativeEvent: AMapLatLng }) => {
          void selectPoint(nativeEvent, 'gcj02');
        }}
        onPressPoi={({
          nativeEvent,
        }: {
          nativeEvent: { name?: string; position: AMapLatLng };
        }) => {
          void selectPoint(nativeEvent.position, 'gcj02', nativeEvent.name);
        }}>
        {selected ? <Marker position={selected} /> : null}
      </MapView>
    );
  }

  return (
    <View style={[styles.page, theme.page, { paddingTop: insets.top + 6 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.mapSection, theme.card]}>
        <View style={styles.mapHeader}>
          <Text style={[styles.sectionTitle, theme.title]}>{t('mapPicker.sectionMap')}</Text>
          <Pressable
            style={styles.locateButton}
            onPress={() => void locateCurrent()}
            disabled={loadingLocation}>
            <MaterialIcons name="my-location" size={16} color="#ffffff" />
            <Text style={styles.locateButtonText}>
              {loadingLocation ? t('mapPicker.locating') : t('mapPicker.locateButton')}
            </Text>
          </Pressable>
        </View>
        <Text style={[styles.coordText, theme.coord]}>
          {selected
            ? `${placeName ? `${placeName} ¡¤ ` : ''}${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`
            : t('mapPicker.pickHint')}
        </Text>
        <View style={styles.mapWrap}>{renderMap()}</View>
      </View>

      <View style={[styles.listSection, theme.card]}>
        <View style={styles.listHeader}>
          <Text style={[styles.sectionTitle, theme.title]}>{t('mapPicker.sectionNearby')}</Text>
          {loadingNearby ? <ActivityIndicator size="small" /> : null}
        </View>
        <ScrollView contentContainerStyle={styles.listScroll}>
          {nearbyPlaces.length === 0 ? (
            <Text style={[styles.emptyText, theme.muted]}>
              {nearbyHint || t('mapPicker.emptyNearby')}
            </Text>
          ) : (
            nearbyPlaces.map((item) => (
              <Pressable
                key={item.id}
                style={[styles.placeItem, theme.item]}
                onPress={() =>
                  void selectPoint(
                    { latitude: item.latitude, longitude: item.longitude },
                    'gcj02',
                    item.name
                  )
                }>
                <Text style={[styles.placeTitle, theme.itemTitle]}>{item.name}</Text>
                <Text style={[styles.placeMeta, theme.itemSub]}>
                  {item.address ? `${item.address} ¡¤ ` : ''}
                  {typeof item.distance === 'number' ? `${Math.round(item.distance)}m` : ''}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
        <Pressable style={styles.confirmButton} onPress={() => void confirmLocation()} disabled={saving}>
          <Text style={styles.confirmButtonText}>
            {saving ? t('mapPicker.saving') : t('mapPicker.confirmUse')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
  },
  mapSection: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  listSection: {
    flex: 2,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  mapWrap: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 10,
  },
  mapFallbackText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  coordText: {
    fontSize: 12,
    lineHeight: 18,
  },
  locateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0f766e',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  locateButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 12,
  },
  listScroll: {
    gap: 8,
    paddingBottom: 8,
  },
  placeItem: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  placeTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeMeta: {
    fontSize: 12,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  confirmButton: {
    marginTop: 'auto',
    backgroundColor: '#0f766e',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  confirmButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
