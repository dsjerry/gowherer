import { MapView, Marker, Polyline } from "expo-gaode-map";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { toGcj02 } from "@/lib/reverse-geocode";
import {
    sanitizeTrackLocations,
    simplifyTrackLocations,
    smoothTrackLocations,
} from "@/lib/track-utils";
import { TimelineLocation } from "@/types/journey";

const startMarkerIcon = require("../assets/images/marker-start.png");
const endMarkerIcon = require("../assets/images/marker-end.png");
const midMarkerIcon = require("../assets/images/marker-mid.png");

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
};

export function TrackMap({
  routeLocations,
  markerLocations = routeLocations,
}: TrackMapProps) {
  const displayRouteLocations = simplifyTrackLocations(
    smoothTrackLocations(sanitizeTrackLocations(routeLocations)),
  );
  const displayMarkerLocations = sanitizeTrackLocations(markerLocations);
  const allDisplayLocations = sanitizeTrackLocations([
    ...displayRouteLocations,
    ...displayMarkerLocations,
  ]);
  const amapLocations = useMemo(
    () =>
      displayRouteLocations.map((item) =>
        toGcj02(item.latitude, item.longitude),
      ),
    [displayRouteLocations],
  );
  const amapMarkerLocations = useMemo(
    () =>
      displayMarkerLocations.map((item) =>
        toGcj02(item.latitude, item.longitude),
      ),
    [displayMarkerLocations],
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
        {amapMarkerLocations.map((point, index) => {
          const isStart = index === 0;
          const isEnd = index === amapMarkerLocations.length - 1;
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
