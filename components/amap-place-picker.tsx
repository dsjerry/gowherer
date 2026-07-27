import {
    ExpoGaodeMapModule,
    MapView,
    Marker,
    type MapViewRef,
} from "expo-gaode-map";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";

import { useI18n } from "@/hooks/locale-preference";
import {
    getLocalLogFileUri,
    logLocalError,
    logLocalInfo,
} from "@/lib/local-log";
import { reverseGeocodePlaceName } from "@/lib/reverse-geocode";
import { TimelineLocation } from "@/types/journey";

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
  const { t } = useI18n();
  const pendingCameraTargetRef = useRef<AMapLatLng | null>(null);
  const mapRef = useRef<MapViewRef | null>(null);
  const [selected, setSelected] = useState<AMapLatLng | null>(null);
  const [cameraTarget, setCameraTarget] = useState<AMapLatLng>(DEFAULT_CENTER);
  const [placeName, setPlaceName] = useState("");
  const [resolving, setResolving] = useState(false);
  const [confirming, setConfirming] = useState(false);

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

  function moveCameraTo(target: AMapLatLng, duration = 300) {
    setCameraTarget(target);
    pendingCameraTargetRef.current = target;
    mapRef.current?.moveCamera({ target, zoom: 16 }, duration);
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
        : DEFAULT_CENTER,
    );
    setSelected(
      initialLocation
        ? {
            latitude: initialLocation.latitude,
            longitude: initialLocation.longitude,
          }
        : null,
    );
    setPlaceName(initialLocation?.placeName ?? "");
  }, [initialLocation, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    if (!pendingCameraTargetRef.current) {
      return;
    }

    const target = pendingCameraTargetRef.current;
    mapRef.current?.moveCamera({ target, zoom: 16 }, 300);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let active = true;
    (async () => {
      try {
        const permission = await ExpoGaodeMapModule.requestLocationPermission();
        if (!active || !permission.granted) {
          return;
        }

        const position = await ExpoGaodeMapModule.getCurrentLocation();
        if (!active) {
          return;
        }

        const target = {
          latitude: position.latitude,
          longitude: position.longitude,
        };
        moveCameraTo(target, 300);
        void logLocalInfo(
          "AMapPicker",
          "camera moved to current location",
          target,
        );
      } catch (error) {
        void logLocalError("AMapPicker", error, {
          stage: "load-current-position",
        });
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
        target.longitude,
        { coordinateType: "gcj02" },
      );
      setPlaceName(maybeName ?? "");
    } catch (error) {
      void logLocalError("AMapPicker", error, {
        stage: "reverse-geocode",
        target,
      });
      setPlaceName("");
    } finally {
      setResolving(false);
    }
  }

  async function selectByMapTap(target: AMapLatLng) {
    if (
      !Number.isFinite(target.latitude) ||
      !Number.isFinite(target.longitude)
    ) {
      void logLocalInfo("AMapPicker", "invalid map tap coordinates", target);
      return;
    }
    setSelected(target);
    void logLocalInfo("AMapPicker", "map pressed", target);
    await resolvePlaceName(target);
  }

  async function confirmSelection() {
    if (!selected) {
      Alert.alert(
        t("amapPicker.selectFirstTitle"),
        t("amapPicker.selectFirstBody"),
      );
      return;
    }
    if (
      !Number.isFinite(selected.latitude) ||
      !Number.isFinite(selected.longitude)
    ) {
      Alert.alert(
        t("amapPicker.invalidPointTitle"),
        t("amapPicker.invalidPointBody"),
      );
      void logLocalInfo("AMapPicker", "invalid selected coordinates", selected);
      return;
    }

    setConfirming(true);
    const location: TimelineLocation = {
      latitude: selected.latitude,
      longitude: selected.longitude,
      placeName: placeName.trim() || undefined,
    };

    try {
      void logLocalInfo("AMapPicker", "confirm selection", location);
      await Promise.resolve(onConfirm(location));
      onClose();
    } catch (error) {
      void logLocalError("AMapPicker", error, {
        stage: "confirm",
        location,
      });
      Alert.alert(
        t("amapPicker.saveFailedTitle"),
        t("amapPicker.saveFailedBody", { uri: getLocalLogFileUri() }),
      );
    } finally {
      setConfirming(false);
    }
  }

  function renderMap() {
    return (
      <MapView
        ref={(ref) => {
          mapRef.current = ref;
          if (ref && pendingCameraTargetRef.current) {
            ref.moveCamera(
              { target: pendingCameraTargetRef.current, zoom: 16 },
              300,
            );
          }
        }}
        style={styles.map}
        myLocationEnabled
        myLocationButtonEnabled
        onMapPress={({ nativeEvent }) => {
          void selectByMapTap(nativeEvent);
        }}
        onPressPoi={({ nativeEvent }) => {
          void logLocalInfo("AMapPicker", "poi pressed", nativeEvent);
          setSelected(nativeEvent.position);
          setPlaceName(nativeEvent.name ?? "");
        }}
        initialCameraPosition={{
          target: cameraTarget ?? center,
          zoom: 16,
        }}
      >
        {selected ? <Marker position={selected} /> : null}
      </MapView>
    );
  }

  return (
    <View
      pointerEvents={visible ? "auto" : "none"}
      style={[styles.host, visible ? styles.hostVisible : styles.hostHidden]}
    >
      <View style={styles.mask}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? "#1e293b" : "#ffffff",
              borderColor: isDark ? "#334155" : "#e2e8f0",
            },
          ]}
        >
          <Text
            style={[styles.title, { color: isDark ? "#e2e8f0" : "#0f172a" }]}
          >
            {t("amapPicker.title")}
          </Text>
          <Text
            style={[styles.hint, { color: isDark ? "#94a3b8" : "#475569" }]}
          >
            {t("amapPicker.subtitle")}
          </Text>

          {renderMap()}

          <View style={styles.placeNameRow}>
            <TextInput
              style={[
                styles.placeInput,
                {
                  backgroundColor: isDark ? "#0f172a" : "#f8fafc",
                  borderColor: isDark ? "#334155" : "#cbd5e1",
                  color: isDark ? "#e2e8f0" : "#0f172a",
                },
              ]}
              value={placeName}
              onChangeText={setPlaceName}
              placeholder={t("amapPicker.placeNamePlaceholder")}
              placeholderTextColor={isDark ? "#94a3b8" : "#64748b"}
            />
            {resolving ? <ActivityIndicator size="small" /> : null}
          </View>

          {selected ? (
            <Text
              style={[styles.coord, { color: isDark ? "#cbd5e1" : "#334155" }]}
            >
              {selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}
            </Text>
          ) : (
            <Text
              style={[styles.coord, { color: isDark ? "#94a3b8" : "#64748b" }]}
            >
              {t("amapPicker.noneSelected")}
            </Text>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>{t("amapPicker.cancel")}</Text>
            </Pressable>
            <Pressable
              style={styles.confirmButton}
              onPress={() => void confirmSelection()}
              disabled={confirming}
            >
              <Text style={styles.confirmText}>
                {confirming
                  ? t("amapPicker.confirming")
                  : t("amapPicker.confirm")}
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
    position: "absolute",
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
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
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
    fontWeight: "700",
  },
  hint: {
    fontSize: 12,
  },
  map: {
    height: 300,
    borderRadius: 12,
    overflow: "hidden",
  },
  placeNameRow: {
    flexDirection: "row",
    alignItems: "center",
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
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelText: {
    color: "#334155",
    fontWeight: "600",
  },
  confirmText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
