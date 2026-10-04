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
  /** Extra polyline drawn on top of the route (e.g. a selected segment). */
  highlightLocations?: TimelineLocation[];
  /**
   * Whether pan/zoom gestures are enabled. Defaults to a static preview: AMap
   * does not call `requestDisallowInterceptTouchEvent`, so an interactive map
   * inside a scrollable list loses its drags to the list / tab pager.
   */
  interactive?: boolean;
};

export function TrackMap({
  routeLocations,
  markerLocations = routeLocations,
  highlightLocations,
  interactive = false,
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

  return (
    <View style={styles.mapWrap}>
      <MapView
        style={styles.map}
        myLocationEnabled={false}
        myLocationButtonEnabled={false}
        zoomControlsEnabled={false}
        scrollGesturesEnabled={interactive}
        zoomGesturesEnabled={interactive}
        rotateGesturesEnabled={interactive}
        tiltGesturesEnabled={interactive}
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
  // Fills the caller-provided box; expo-gaode-map's own wrapper needs a
  // definite parent height, which the caller now supplies (see explore.tsx).
  mapWrap: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 6,
  },
  map: {
    width: "100%",
    flex: 1,
  },
});
