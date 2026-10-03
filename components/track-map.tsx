import { MapView, Marker, Polyline } from "expo-gaode-map";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { toGcj02 } from "@/lib/reverse-geocode";
import { sanitizeTrackLocations } from "@/lib/track-utils";
import { TimelineLocation } from "@/types/journey";

function toAmapCoordinate(location: TimelineLocation) {
  if (location.coordSystem === "gcj02") {
    return { latitude: location.latitude, longitude: location.longitude };
  }
  return toGcj02(location.latitude, location.longitude);
}

// Native MarkerView expects drawable resource names (see
// plugins/with-android-map-marker-icons.js), not require() ids. iconWidth/
// iconHeight are density-scaled by the SDK, so pass dp values directly.
const startMarkerIcon = "marker_start";
const endMarkerIcon = "marker_end";
const midMarkerIcon = "marker_mid";

const startEndIconSize = 28;
const midIconSize = 20;

function getAmapZoom(locations: TimelineLocation[]) {
  if (locations.length <= 1) {
    return 16;
  }

  const lats = locations.map((item) => item.latitude);
  const lngs = locations.map((item) => item.longitude);
  const span = Math.max(
    Math.max(...lats) - Math.min(...lats),
    Math.max(...lngs) - Math.min(...lngs),
  );

  if (span < 0.005) return 17;
  if (span < 0.01) return 16;
  if (span < 0.02) return 15;
  if (span < 0.05) return 13;
  if (span < 0.1) return 12;
  if (span < 0.5) return 10;
  if (span < 1.0) return 8;
  if (span < 3.0) return 6;
  return 5;
}

type TrackMapProps = {
  routeLocations: TimelineLocation[];
  markerLocations?: TimelineLocation[];
  height?: number;
  /** Extra polyline drawn on top of the route (e.g. a selected segment). */
  highlightLocations?: TimelineLocation[];
};

export function TrackMap({
  routeLocations,
  markerLocations = routeLocations,
  height,
  highlightLocations,
}: TrackMapProps) {
  const displayRouteLocations = sanitizeTrackLocations(routeLocations);
  const displayMarkerLocations = sanitizeTrackLocations(markerLocations);
  const allDisplayLocations = sanitizeTrackLocations([
    ...displayRouteLocations,
    ...displayMarkerLocations,
  ]);
  const amapLocations = useMemo(
    () =>
      displayRouteLocations.map((item) =>
        toAmapCoordinate(item),
      ),
    [displayRouteLocations],
  );
  const amapMarkerLocations = useMemo(
    () =>
      displayMarkerLocations.map((item) =>
        toAmapCoordinate(item),
      ),
    [displayMarkerLocations],
  );
  const amapHighlightLocations = useMemo(
    () =>
      sanitizeTrackLocations(highlightLocations ?? []).map((item) =>
        toAmapCoordinate(item),
      ),
    [highlightLocations],
  );

  if (allDisplayLocations.length === 0) {
    return null;
  }

  const centerSource =
    amapLocations.length > 0 ? amapLocations : amapMarkerLocations;
  const center = centerSource[Math.floor(centerSource.length / 2)];

  // The MapView wrapper (expo-gaode-map) always sets flex: 1 on its container,
  // which collapses to 0 inside auto-height parents measured with a definite
  // constraint (e.g. RN Modal). Give the wrapper an explicit height so the
  // flex container always has a definite parent to fill.
  const mapHeightStyle = height != null ? { height } : null;

  return (
    <View style={[styles.mapWrap, mapHeightStyle]}>
      <MapView
        style={[styles.map, mapHeightStyle]}
        myLocationEnabled={false}
        myLocationButtonEnabled={false}
        zoomControlsEnabled={false}
        initialCameraPosition={{
          target: center,
          zoom: getAmapZoom(
            amapLocations.length > 0 ? amapLocations : amapMarkerLocations,
          ),
        }}
      >
        {amapLocations.length >= 2 ? (
          <Polyline
            points={amapLocations}
            strokeWidth={4}
            strokeColor="#0f766e"
          />
        ) : null}
        {amapHighlightLocations.length >= 2 ? (
          <Polyline
            points={amapHighlightLocations}
            strokeWidth={6}
            strokeColor="#ea580c"
          />
        ) : null}
        {amapMarkerLocations.map((point, index) => {
          const isStart = index === 0;
          const isEnd = index === amapMarkerLocations.length - 1;
          const isEndpoint = isStart || isEnd;
          return (
            <Marker
              key={`${point.latitude}-${point.longitude}-${index}`}
              position={point}
              icon={
                isStart
                  ? startMarkerIcon
                  : isEnd
                    ? endMarkerIcon
                    : midMarkerIcon
              }
              iconWidth={isEndpoint ? startEndIconSize : midIconSize}
              iconHeight={isEndpoint ? startEndIconSize : midIconSize}
            />
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 6,
  },
  map: {
    width: "100%",
    height: 180,
  },
});
