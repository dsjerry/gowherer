import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import { useNavigation } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TrackMap } from '@/components/track-map';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteJourney as deleteJourneyById } from '@/lib/journey-repository';
import { logLocalError } from '@/lib/local-log';
import { loadJourneys } from '@/lib/journey-storage';
import { REVIEW_FILTERS_KEY } from '@/lib/storage-keys';
import {
  calculateTrackDistanceKm,
  haversineKm,
  sanitizeTrackLocations,
  simplifyTrackLocations,
} from '@/lib/track-utils';
import { toGcj02 } from '@/lib/reverse-geocode';
import { Journey, JourneyKind, TimelineLocation, TimelineMedia } from '@/types/journey';

type JourneyFilter = 'all' | JourneyKind;

type TFunction = (key: string, params?: Record<string, string | number>) => string;

/** Top padding of the review list content, below the status bar. */
const LIST_CONTENT_TOP_PADDING = 12;
/** Gap kept below an enlarged map so its collapse button stays reachable. */
const ENLARGED_MAP_BOTTOM_GAP = 24;
/** Collapsed height of an inline track map. */
const PREVIEW_MAP_HEIGHT = 180;
/** Duration of the enlarge / collapse transition. */
const MAP_RESIZE_DURATION = 260;

function formatDateTime(iso?: string) {
  if (!iso) {
    return '-';
  }
  const date = new Date(iso);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

function kindLabel(kind: JourneyKind, t: TFunction) {
  return kind === 'travel' ? t('journey.kind.travel') : t('journey.kind.commute');
}

function journeyFilterLabel(filter: JourneyFilter, t: TFunction) {
  if (filter === 'travel') {
    return t('review.filterTravel');
  }
  if (filter === 'commute') {
    return t('review.filterCommute');
  }
  return t('review.filterAll');
}

function formatDuration(durationMs: number, t: TFunction) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return t('duration.minutes', { minutes });
  }
  if (minutes === 0) {
    return t('duration.hours', { hours });
  }
  return t('duration.hoursMinutes', { hours, minutes });
}

function getJourneyTrackLocations(journey: Journey) {
  return sanitizeTrackLocations(journey.trackLocations ?? []);
}

function getJourneyEntryLocations(journey: Journey) {
  return sanitizeTrackLocations(journey.entries.map((entry) => entry.location));
}

function getJourneyTrackMapMarkerLocations(journey: Journey, trackLocations?: TimelineLocation[]) {
  const routeLocations = trackLocations ?? getJourneyTrackLocations(journey);
  const entryLocations = getJourneyEntryLocations(journey);

  if (routeLocations.length === 0) {
    return entryLocations;
  }

  const start = routeLocations[0];
  const end = routeLocations[routeLocations.length - 1];
  const hasStartEntry = entryLocations.some(
    (loc) =>
      Math.abs(loc.latitude - start.latitude) < 0.0001 &&
      Math.abs(loc.longitude - start.longitude) < 0.0001,
  );
  const hasEndEntry = entryLocations.some(
    (loc) =>
      Math.abs(loc.latitude - end.latitude) < 0.0001 &&
      Math.abs(loc.longitude - end.longitude) < 0.0001,
  );

  const markers: TimelineLocation[] = [];
  if (!hasStartEntry) markers.push(start);
  markers.push(...entryLocations);
  if (!hasEndEntry) markers.push(end);
  return markers;
}

type SegmentStats = {
  durationMs: number;
  distanceKm: number | null;
  avgSpeedKmh: number | null;
  segmentTrack: TimelineLocation[];
};

type JourneyDerived = {
  track: TimelineLocation[];
  markerLocations: TimelineLocation[];
  stats: ReturnType<typeof computeJourneyStats>;
};

function computeSegmentStats(
  journey: Journey,
  trackLocations: TimelineLocation[],
  startIndex: number,
  endIndex: number,
): SegmentStats {
  const from = journey.entries[Math.min(startIndex, endIndex)];
  const to = journey.entries[Math.max(startIndex, endIndex)];
  if (!from || !to) {
    return {
      durationMs: 0,
      distanceKm: null,
      avgSpeedKmh: null,
      segmentTrack: [],
    };
  }
  const startMs = Date.parse(from.createdAt);
  const endMs = Date.parse(to.createdAt);
  const durationMs =
    Number.isFinite(startMs) && Number.isFinite(endMs) ? Math.max(0, endMs - startMs) : 0;

  // Prefer GPS track points captured between the two record points; fall back
  // to the straight line between their own locations.
  const segmentTrack = trackLocations.filter((point) => {
    if (!point.capturedAt) {
      return false;
    }
    const at = Date.parse(point.capturedAt);
    return at >= startMs && at <= endMs;
  });

  let distanceKm: number | null = null;
  if (segmentTrack.length >= 2) {
    distanceKm = calculateTrackDistanceKm(segmentTrack);
  } else if (from.location && to.location) {
    distanceKm = haversineKm(from.location, to.location);
  }

  const avgSpeedKmh =
    distanceKm != null && durationMs > 0 ? distanceKm / (durationMs / 3600000) : null;

  return { durationMs, distanceKm, avgSpeedKmh, segmentTrack };
}

// Cached per journey/selection so toggling the dropdowns does not re-filter
// and re-measure thousands of track points on every render.
const segmentStatsCache = new Map<string, SegmentStats>();

function getSegmentStats(
  journey: Journey,
  trackLocations: TimelineLocation[],
  journeyId: string,
  startIndex: number,
  endIndex: number,
) {
  const cacheKey = `${journeyId}:${startIndex}:${endIndex}`;
  const cached = segmentStatsCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  if (segmentStatsCache.size > 100) {
    segmentStatsCache.clear();
  }
  const stats = computeSegmentStats(journey, trackLocations, startIndex, endIndex);
  segmentStatsCache.set(cacheKey, stats);
  return stats;
}

function computeJourneyStats(journey: Journey, trackLocations?: TimelineLocation[]) {
  const track = trackLocations ?? getJourneyTrackLocations(journey);
  const entryLocations = getJourneyEntryLocations(journey);
  const distanceSource = track.length >= 2 ? track : entryLocations;
  const distanceKm = calculateTrackDistanceKm(distanceSource);

  const endMs = journey.endedAt
    ? new Date(journey.endedAt).getTime()
    : journey.entries.length > 0
      ? new Date(journey.entries[journey.entries.length - 1].createdAt).getTime()
      : new Date(journey.createdAt).getTime();
  const startMs = new Date(journey.createdAt).getTime();
  const durationMs = Number.isFinite(endMs - startMs) ? Math.max(0, endMs - startMs) : 0;
  const avgSpeedKmh = durationMs > 0 ? distanceKm / (durationMs / 3600000) : 0;

  return {
    locationPoints: track.length + entryLocations.length,
    distanceKm,
    durationMs,
    avgSpeedKmh,
  };
}

function formatLocationLabel(location: TimelineLocation) {
  const coords = `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;
  return location.placeName ? `${location.placeName} · ${coords}` : coords;
}

function includesQueryText(source: string | undefined, query: string) {
  if (!source) {
    return false;
  }
  return source.toLowerCase().includes(query);
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const PDF_IMAGE_MAX_EDGE = 1280;
const PDF_IMAGE_COMPRESS = 0.7;

// Downscale + re-encode to JPEG before inlining so a photo-heavy journey does
// not produce a multi-hundred-MB HTML string. Falls back to the raw file when
// the manipulator fails.
async function buildEmbeddedImage(uri: string): Promise<string | null> {
  try {
    if (!uri || uri.startsWith('data:')) {
      return uri;
    }
    // First render at native size to read dimensions (ImageRef cannot be
    // resized after render), then re-decode scaled down when oversized.
    let rendered = await ImageManipulator.manipulate(uri).renderAsync();
    if (Math.max(rendered.width, rendered.height) > PDF_IMAGE_MAX_EDGE) {
      const scale = PDF_IMAGE_MAX_EDGE / Math.max(rendered.width, rendered.height);
      rendered = await ImageManipulator.manipulate(uri)
        .resize({
          width: Math.round(rendered.width * scale),
          height: Math.round(rendered.height * scale),
        })
        .renderAsync();
    }
    const result = await rendered.saveAsync({
      compress: PDF_IMAGE_COMPRESS,
      format: SaveFormat.JPEG,
      base64: true,
    });
    return `data:image/jpeg;base64,${result.base64}`;
  } catch {
    try {
      if (!uri || uri.startsWith('data:')) return uri;
      if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
        return uri;
      }
      const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
        encoding: 'base64' as const,
      });
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';
      return `data:image/${mime};base64,${base64}`;
    } catch {
      return null;
    }
  }
}

async function buildVideoThumbnailDataUri(uri: string): Promise<string | null> {
  try {
    const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(uri, {
      time: 500,
    });
    return await buildEmbeddedImage(thumbnailUri);
  } catch {
    return null;
  }
}

function mediaCellHtml(dataUri: string, badge: string) {
  return (
    `<div style="flex:1;min-width:0;position:relative;">` +
    `<img src="${dataUri}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;display:block;" />` +
    `<span style="position:absolute;right:5px;bottom:5px;background:rgba(15,23,42,0.55);color:#ffffff;font-size:9px;padding:1px 5px;border-radius:6px;">${badge}</span>` +
    `</div>`
  );
}

const videoThumbCache = new Map<string, string>();

// Review timeline videos render as generated thumbnails with a play badge;
// the actual player only runs inside the full-screen preview modal.
function VideoThumbCover({ uri }: { uri: string }) {
  const [thumbnail, setThumbnail] = useState<string | null>(videoThumbCache.get(uri) ?? null);

  useEffect(() => {
    if (thumbnail) {
      return;
    }
    let active = true;
    (async () => {
      try {
        const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(uri, { time: 500 });
        videoThumbCache.set(uri, thumbnailUri);
        if (active) {
          setThumbnail(thumbnailUri);
        }
      } catch {
        // Keep the loading placeholder on failure.
      }
    })();
    return () => {
      active = false;
    };
  }, [uri, thumbnail]);

  return (
    <View style={styles.videoThumbWrap}>
      {thumbnail ? (
        <Image source={{ uri: thumbnail }} style={styles.mediaPreview} contentFit="cover" />
      ) : (
        <View
          style={[styles.mediaPlaceholder, styles.videoThumbWrap, { backgroundColor: '#0f172a' }]}
        >
          <ActivityIndicator size="small" color="#94a3b8" />
        </View>
      )}
      <View style={styles.videoPlayBadge} pointerEvents="none">
        <MaterialIcons name="play-arrow" size={20} color="#ffffff" />
      </View>
    </View>
  );
}

async function buildEntryMediaHtml(media: TimelineMedia[], t: TFunction): Promise<string> {
  const cells: string[] = [];
  let unrenderedVideos = 0;
  let audioCount = 0;

  // Sequential on purpose: parallel renders of full-size photos spike memory.
  for (const item of media) {
    if (item.type === 'audio') {
      audioCount += 1;
      continue;
    }
    if (item.type === 'video') {
      const thumbnail = await buildVideoThumbnailDataUri(item.uri);
      if (thumbnail) {
        cells.push(mediaCellHtml(thumbnail, t('journey.mediaBadgeVideo')));
      } else {
        unrenderedVideos += 1;
      }
      continue;
    }
    const dataUri = await buildEmbeddedImage(item.uri);
    if (dataUri) {
      cells.push(mediaCellHtml(dataUri, t('journey.mediaBadgePhoto')));
    }
  }

  const lines: string[] = [];
  for (let i = 0; i < cells.length; i += 3) {
    lines.push(
      `<div style="display:flex;gap:6px;margin-top:8px;">${cells.slice(i, i + 3).join('')}</div>`,
    );
  }
  if (unrenderedVideos > 0) {
    lines.push(
      `<div style="color:#64748b;font-size:12px;margin-top:6px;">${t(
        'journey.mediaBadgeVideo',
      )} × ${unrenderedVideos}</div>`,
    );
  }
  if (audioCount > 0) {
    lines.push(
      `<div style="color:#64748b;font-size:12px;margin-top:6px;">${t(
        'journey.audioBadge',
      )} × ${audioCount}</div>`,
    );
  }
  return lines.join('');
}

function buildTrackSvgDataUri(
  locations: TimelineLocation[],
  labels: { start: string; end: string },
) {
  if (locations.length < 2) {
    return '';
  }

  const width = 780;
  const height = 260;
  const padding = 24;
  const lats = locations.map((item) => item.latitude);
  const lngs = locations.map((item) => item.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(0.00001, maxLat - minLat);
  const lngSpan = Math.max(0.00001, maxLng - minLng);

  const points = locations
    .map((item) => {
      const x = padding + ((item.longitude - minLng) / lngSpan) * (width - padding * 2);
      const y = height - padding - ((item.latitude - minLat) / latSpan) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const start = points.split(' ')[0];
  const end = points.split(' ')[points.split(' ').length - 1];

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
    <rect x='0' y='0' width='${width}' height='${height}' fill='#f8fafc' rx='12' />
    <polyline points='${points}' fill='none' stroke='#0f766e' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' />
    <circle cx='${start.split(',')[0]}' cy='${start.split(',')[1]}' r='7' fill='#0284c7' />
    <circle cx='${end.split(',')[0]}' cy='${end.split(',')[1]}' r='7' fill='#dc2626' />
    <text x='20' y='24' font-size='12' fill='#334155'>${escapeHtml(labels.start)}</text>
    <text x='64' y='24' font-size='12' fill='#334155'>${escapeHtml(labels.end)}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function getAmapWebKey() {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    geocoding?: { amapWebKey?: string };
  };
  return extra.geocoding?.amapWebKey ?? process.env.EXPO_PUBLIC_AMAP_WEB_KEY;
}

// A real AMap static map when the web key is available; the hand-drawn SVG
// polyline stays as the offline fallback.
async function buildTrackImage(
  locations: TimelineLocation[],
  t: TFunction,
): Promise<string | null> {
  if (locations.length < 2) {
    return null;
  }
  const staticMapUri = await buildTrackStaticMapUri(locations);
  return (
    staticMapUri ??
    buildTrackSvgDataUri(locations, {
      start: t('review.html.start'),
      end: t('review.html.end'),
    })
  );
}

async function buildTrackStaticMapUri(locations: TimelineLocation[]): Promise<string | null> {
  try {
    const amapWebKey = getAmapWebKey();
    if (!amapWebKey) {
      return null;
    }

    const simplified = simplifyTrackLocations(locations, 160);
    if (simplified.length < 2) {
      return null;
    }
    const gcjPoints = simplified.map((point) => {
      if (point.coordSystem === 'gcj02') {
        return { latitude: point.latitude, longitude: point.longitude };
      }
      const converted = toGcj02(point.latitude, point.longitude);
      return { latitude: converted.latitude, longitude: converted.longitude };
    });

    const lats = gcjPoints.map((p) => p.latitude);
    const lngs = gcjPoints.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.0001);
    const spanLng = Math.max(maxLng - minLng, 0.0001);

    // Fit the whole route into the preview. AMap staticmap zoom is NOT
    // standard Mercator-256 — calibrated against rendered output: ~123 logical
    // px per degree of longitude at zoom 6, doubling per level, ~114 px/deg
    // latitude at this latitude band.
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const IMAGE_W = 750;
    const IMAGE_H = 360;
    const VIEW_PADDING = 0.85;
    const zoomFitLng = Math.log2((VIEW_PADDING * IMAGE_W) / (spanLng * 123));
    const zoomFitLat = Math.log2((VIEW_PADDING * IMAGE_H) / (spanLat * 114));
    const zoom = Math.max(4, Math.min(17, 6 + Math.floor(Math.min(zoomFitLng, zoomFitLat))));

    const start = gcjPoints[0];
    const end = gcjPoints[gcjPoints.length - 1];
    const params = new URLSearchParams({
      key: amapWebKey,
      location: `${centerLng.toFixed(6)},${centerLat.toFixed(6)}`,
      zoom: String(zoom),
      size: `${IMAGE_W}*${IMAGE_H}`,
      scale: '2',
      // AMap path overlays do not render for this key; start/end markers do
      // (multi-group lists need %7C-encoded separators and uppercase hex).
      markers: `mid,0x0284C7,A:${start.longitude.toFixed(6)},${start.latitude.toFixed(6)}|mid,0xDC2626,B:${end.longitude.toFixed(6)},${end.latitude.toFixed(6)}`,
    });
    return `https://restapi.amap.com/v3/staticmap?${params.toString()}`;
  } catch (error) {
    void logLocalError('JourneyScreen', 'build static map failed', error);
    return null;
  }
}

async function journeyToHtml(journey: Journey, t: TFunction): Promise<string> {
  const stats = computeJourneyStats(journey);
  const routeLocations = getJourneyTrackLocations(journey);
  const fallbackLocations = getJourneyEntryLocations(journey);
  const locations = routeLocations.length >= 2 ? routeLocations : fallbackLocations;
  const trackImageUri = await buildTrackImage(locations, t);

  const tagsHtml = journey.tags.length
    ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">${journey.tags
        .map(
          (tag) =>
            `<span style="background:#e2e8f0;color:#334155;padding:3px 10px;border-radius:12px;font-size:12px;">#${escapeHtml(tag)}</span>`,
        )
        .join('')}</div>`
    : '';

  const statsHtml = `
    <div style="display:flex;gap:20px;margin-top:20px;flex-wrap:wrap;">
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0f766e;">${stats.distanceKm.toFixed(2)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">km</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0f766e;">${formatDuration(stats.durationMs, t)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(t('review.statsDuration'))}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0f766e;">${stats.avgSpeedKmh.toFixed(1)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">km/h</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0f766e;">${stats.locationPoints}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(t('review.statsLocationPoints'))}</div>
      </div>
    </div>`;

  const cover = `
    <section style="min-height:90vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:40px 20px;background:linear-gradient(180deg,#f0fdfa 0%,#ffffff 100%);">
      <div style="font-size:13px;color:#0f766e;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(kindLabel(journey.kind, t))}</div>
      <h1 style="margin:0;font-size:36px;color:#0f172a;font-weight:700;">${escapeHtml(journey.title)}</h1>
      <p style="margin:12px 0 0;color:#475569;font-size:14px;">
        ${formatDateTime(journey.createdAt)} — ${journey.endedAt ? formatDateTime(journey.endedAt) : ''}
      </p>
      ${tagsHtml}
      ${statsHtml}
      <p style="margin:16px 0 0;color:#64748b;font-size:13px;">${escapeHtml(
        t('review.html.totalEntries', { count: journey.entries.length }),
      )}</p>
      ${
        trackImageUri
          ? `<img src="${trackImageUri}" alt="${escapeHtml(t('review.html.trackAlt'))}" style="width:90%;max-width:780px;margin-top:24px;border:1px solid #e2e8f0;border-radius:12px;" />`
          : `<div style="margin-top:24px;padding:14px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#64748b;font-size:13px;">${escapeHtml(
              t('review.html.trackEmpty'),
            )}</div>`
      }
    </section>
    <div style="page-break-after:always;"></div>
  `;

  const entriesHtml = await Promise.all(
    journey.entries.map(async (entry, index) => {
      const location = entry.location
        ? `<div style="color:#64748b;font-size:12px;margin-top:4px;">📍 ${escapeHtml(
            formatLocationLabel(entry.location),
          )}</div>`
        : '';
      const tags = entry.tags.length
        ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${entry.tags
            .map(
              (tag) =>
                `<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:10px;font-size:11px;">#${escapeHtml(tag)}</span>`,
            )
            .join('')}</div>`
        : '';
      const mediaHtml = await buildEntryMediaHtml(entry.media, t);
      const textHtml = entry.text
        ? `<div style="margin-top:8px;line-height:1.7;color:#1e293b;font-size:14px;">${escapeHtml(entry.text)}</div>`
        : `<div style="margin-top:8px;color:#94a3b8;font-size:13px;font-style:italic;">${escapeHtml(t('review.html.noText'))}</div>`;

      return `<div style="margin-bottom:20px;padding:16px 20px;background:#ffffff;border-left:3px solid #0f766e;border-radius:0 8px 8px 0;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:50%;background:#0f766e;color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;">${index + 1}</div>
          <div style="font-size:12px;color:#64748b;">${formatDateTime(entry.createdAt)}</div>
        </div>
        ${textHtml}
        ${tags}
        ${location}
        ${mediaHtml}
      </div>`;
    }),
  );

  const items = entriesHtml.join('');

  return `<!doctype html>
  <html>
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;margin:0;padding:0;background:#ffffff;color:#0f172a;">
      ${cover}
      <section style="padding:30px 24px;">
        <h2 style="margin:0 0 20px;color:#0f172a;font-size:22px;font-weight:700;border-bottom:2px solid #0f766e;padding-bottom:8px;">${escapeHtml(t('review.html.title'))}</h2>
        ${items || `<div style="color:#64748b;text-align:center;padding:40px;">${escapeHtml(t('review.html.emptyText'))}</div>`}
      </section>
    </body>
  </html>`;
}

function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.play();
  });

  return (
    <VideoView player={player} style={styles.previewMedia} nativeControls contentFit="contain" />
  );
}

function AudioPlayer({ uri, label }: { uri: string; label: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status?.playing ?? false;

  const togglePlayback = async () => {
    if (isPlaying) {
      await player.pause();
      return;
    }
    if (status?.duration && status.currentTime >= status.duration) {
      await player.seekTo(0);
    }
    await player.play();
  };

  return (
    <Pressable style={styles.audioCard} onPress={togglePlayback}>
      <MaterialIcons
        name={isPlaying ? 'pause-circle-filled' : 'play-circle-filled'}
        size={20}
        color="#0f766e"
      />
      <Text style={styles.audioLabel} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </Pressable>
  );
}

export default function JourneyHistoryScreen() {
  const insets = useSafeAreaInsets();
  const canExpandMap = Platform.OS !== 'web';
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t, locale } = useI18n();
  const tagSortLocale = locale === 'zh' ? 'zh-CN' : 'en';
  const themed = {
    title: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    subTitle: {
      color: isDark ? '#94a3b8' : '#475569',
    },
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    searchInput: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderColor: isDark ? '#334155' : '#cbd5e1',
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    placeholder: isDark ? '#94a3b8' : '#64748b',
    tagChip: {
      backgroundColor: isDark ? '#334155' : '#e0f2fe',
    },
    tagChipText: {
      color: isDark ? '#e2e8f0' : '#0c4a6e',
    },
    statsWrap: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    statItem: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    statLabel: {
      color: isDark ? '#94a3b8' : '#64748b',
    },
    statValue: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    journeyTitle: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    journeyMeta: {
      color: isDark ? '#94a3b8' : '#64748b',
    },
    mapTitle: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
    emptyTitle: {
      color: isDark ? '#e2e8f0' : '#334155',
    },
    emptyText: {
      color: isDark ? '#94a3b8' : '#64748b',
    },
    divider: {
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
    },
    entryItem: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    entryTime: {
      color: isDark ? '#94a3b8' : '#64748b',
    },
    entryText: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    metaLine: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
    mediaSectionTitle: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
    mediaPreviewBox: {
      borderColor: isDark ? '#334155' : '#e2e8f0',
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
    },
    mediaBadge: {
      color: isDark ? '#e2e8f0' : '#0f172a',
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
    },
    mediaPlaceholder: {
      backgroundColor: isDark ? '#334155' : '#0f172a',
    },
    mediaPlaceholderText: {
      color: '#ffffff',
    },
  };
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<TimelineMedia | null>(null);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [enlargedMapId, setEnlargedMapId] = useState<string | null>(null);
  const [listViewportHeight, setListViewportHeight] = useState(0);
  const [reviewHydrated, setReviewHydrated] = useState(false);
  const [segmentRange, setSegmentRange] = useState<{
    journeyId: string;
    start: number | null;
    end: number | null;
  } | null>(null);
  const [segmentPicker, setSegmentPicker] = useState<{
    journeyId: string;
    kind: 'start' | 'end';
  } | null>(null);
  const [filterPicker, setFilterPicker] = useState<'kind' | 'tag' | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const mapWrapRefs = useRef<Record<string, View | null>>({});
  const scrollYRef = useRef(0);

  // Fill the list's visible area, minus the content's own top padding and a gap
  // that keeps the collapse button reachable.
  const enlargedMapHeight = Math.max(
    240,
    listViewportHeight - insets.top - LIST_CONTENT_TOP_PADDING - ENLARGED_MAP_BOTTOM_GAP,
  );

  const mapHeight = useSharedValue(PREVIEW_MAP_HEIGHT);
  const animatedMapStyle = useAnimatedStyle(() => ({
    height: mapHeight.value,
  }));

  // Reuse the card's already-rendering map instance (style-only height
  // change) — the AMap SDK renders a NEW map instance black while other
  // instances exist, so enlarging must never remount.
  function scrollMapIntoView(journeyId: string) {
    const scrollView = scrollViewRef.current;
    const mapWrap = mapWrapRefs.current[journeyId];
    if (!scrollView || !mapWrap) {
      return;
    }
    (scrollView as unknown as View).measureInWindow((_x, scrollViewY) => {
      mapWrap.measureInWindow((_mapX, mapY) => {
        const contentY = mapY - scrollViewY + scrollYRef.current;
        scrollView.scrollTo({
          y: Math.max(0, contentY - insets.top - LIST_CONTENT_TOP_PADDING),
          animated: true,
        });
      });
    });
  }

  // Clear only if this map is still the enlarged one — the user may have
  // opened another map while the shrink was still running.
  const collapseEnlargedMap = useCallback((journeyId: string) => {
    setEnlargedMapId((prev) => (prev === journeyId ? null : prev));
  }, []);

  function toggleMapEnlarged(journeyId: string) {
    if (enlargedMapId !== journeyId) {
      setEnlargedMapId(journeyId);
      mapHeight.value = withTiming(enlargedMapHeight, {
        duration: MAP_RESIZE_DURATION,
      });
      setTimeout(() => scrollMapIntoView(journeyId), MAP_RESIZE_DURATION + 40);
      return;
    }
    // Stay mounted at the enlarged height until the shrink finishes, otherwise
    // the height would snap back before the animation could run.
    mapHeight.value = withTiming(
      PREVIEW_MAP_HEIGHT,
      { duration: MAP_RESIZE_DURATION },
      (finished) => {
        if (finished) {
          runOnJS(collapseEnlargedMap)(journeyId);
        }
      },
    );
  }

  const navigation = useNavigation();

  // Only an enlarged map takes gestures, so suspend tab swiping while one is
  // open. This toggles on the expand button's tap — never mid-gesture — which
  // is what makes it beat the pager's native touch interception.
  useEffect(() => {
    navigation.setOptions({ swipeEnabled: enlargedMapId === null });
  }, [navigation, enlargedMapId]);

  const reloadJourneys = useCallback(async () => {
    const stored = await loadJourneys();
    setJourneys(stored);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const stored = await loadJourneys();
        if (!active) {
          return;
        }
        setJourneys(stored);
        setHasLoadedOnce(true);

        // Accordion default: expand the first card so its content (incl. the
        // small interactive map with the route line) is visible on entry.
        const completed = stored.filter((j) => j.status === 'completed');
        setExpandedCardId((prev) =>
          prev && completed.some((j) => j.id === prev) ? prev : (completed[0]?.id ?? null),
        );
      })();

      return () => {
        active = false;
      };
    }, []),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reloadJourneys();
    } finally {
      setRefreshing(false);
    }
  }, [reloadJourneys]);

  // Load persisted UI state BEFORE the persist effects below — their mount
  // writes would otherwise clobber the stored values with initial defaults.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const storedFilters = await AsyncStorage.getItem(REVIEW_FILTERS_KEY);
        if (active && storedFilters) {
          const parsed = JSON.parse(storedFilters) as {
            filter?: string;
            selectedTag?: string | null;
          };
          if (
            parsed.filter === 'all' ||
            parsed.filter === 'travel' ||
            parsed.filter === 'commute'
          ) {
            setFilter(parsed.filter);
          }
          if (parsed.selectedTag === null || typeof parsed.selectedTag === 'string') {
            setSelectedTag(parsed.selectedTag);
          }
        }
      } catch {
        // Ignore malformed persisted state.
      }
      if (active) {
        setReviewHydrated(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Persist review list filter state across sessions — but only AFTER the
  // persisted values have been loaded, otherwise the mount run would clobber
  // them with initial defaults before the read completes.
  useEffect(() => {
    if (!reviewHydrated) {
      return;
    }
    AsyncStorage.setItem(REVIEW_FILTERS_KEY, JSON.stringify({ filter, selectedTag })).catch(
      () => {},
    );
  }, [reviewHydrated, filter, selectedTag]);

  const completedJourneys = useMemo(
    () => journeys.filter((item) => item.status === 'completed'),
    [journeys],
  );

  // Heavy per-journey derivation (sanitizing thousands of track points,
  // haversine sums, coordinate conversion) is computed once per journey —
  // re-running it on every render made dropdown toggles take ~500ms.
  const journeyDerivedById = useMemo(() => {
    const map = new Map<string, JourneyDerived>();
    for (const journey of completedJourneys) {
      const track = getJourneyTrackLocations(journey);
      map.set(journey.id, {
        track,
        markerLocations: getJourneyTrackMapMarkerLocations(journey, track),
        stats: computeJourneyStats(journey, track),
      });
    }
    return map;
  }, [completedJourneys]);

  const availableTags = useMemo(
    () =>
      Array.from(
        new Set(
          completedJourneys.flatMap((journey) => [
            ...journey.tags,
            ...journey.entries.flatMap((entry) => entry.tags),
          ]),
        ),
      ).sort((a, b) => a.localeCompare(b, tagSortLocale)),
    [completedJourneys, tagSortLocale],
  );

  const filteredJourneys = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (filter === 'all') {
      return completedJourneys.filter((journey) => {
        const tagMatch =
          !selectedTag ||
          journey.tags.includes(selectedTag) ||
          journey.entries.some((entry) => entry.tags.includes(selectedTag));

        if (!tagMatch) {
          return false;
        }

        if (!query) {
          return true;
        }

        const journeyMatch =
          includesQueryText(journey.title, query) ||
          includesQueryText(kindLabel(journey.kind, t), query) ||
          journey.tags.some((tag) => includesQueryText(tag, query));

        if (journeyMatch) {
          return true;
        }

        return journey.entries.some(
          (entry) =>
            includesQueryText(entry.text, query) ||
            includesQueryText(entry.location?.placeName, query) ||
            entry.tags.some((tag) => includesQueryText(tag, query)),
        );
      });
    }
    return completedJourneys.filter((journey) => {
      if (journey.kind !== filter) {
        return false;
      }

      const tagMatch =
        !selectedTag ||
        journey.tags.includes(selectedTag) ||
        journey.entries.some((entry) => entry.tags.includes(selectedTag));
      if (!tagMatch) {
        return false;
      }

      if (!query) {
        return true;
      }

      const journeyMatch =
        includesQueryText(journey.title, query) ||
        includesQueryText(kindLabel(journey.kind, t), query) ||
        journey.tags.some((tag) => includesQueryText(tag, query));

      if (journeyMatch) {
        return true;
      }

      return journey.entries.some(
        (entry) =>
          includesQueryText(entry.text, query) ||
          includesQueryText(entry.location?.placeName, query) ||
          entry.tags.some((tag) => includesQueryText(tag, query)),
      );
    });
  }, [completedJourneys, filter, searchQuery, selectedTag, t]);

  async function removeJourney(journeyId: string) {
    const next = await deleteJourneyById(journeyId);
    setJourneys(next);
    if (expandedCardId === journeyId) {
      setExpandedCardId(null);
    }
  }

  // Accordion: exactly one journey card renders its content (and its single
  // AMap instance) at a time — the AMap SDK renders a NEW map instance black
  // while other instances exist, so a card switch unmounts the previous map,
  // lets the teardown settle, then mounts the next one.
  function toggleCardExpanded(journeyId: string) {
    if (expandedCardId === journeyId) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedCardId(null);
      return;
    }

    const openCard = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpandedCardId(journeyId);
    };

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (expandedCardId != null) {
      setExpandedCardId(null);
      setTimeout(openCard, 400);
      return;
    }
    openCard();
  }

  // Start/end default to the first/last record point; picking one side just
  // overrides that side (the other keeps its previous or default value).
  function handleSegmentPick(journeyId: string, kind: 'start' | 'end', index: number) {
    setSegmentRange((prev) => {
      const base =
        prev && prev.journeyId === journeyId ? prev : { journeyId, start: null, end: null };
      return kind === 'start'
        ? { journeyId, start: index, end: base.end }
        : { journeyId, start: base.start, end: index };
    });
    setSegmentPicker(null);
  }

  async function exportJourneyPdf(journey: Journey) {
    if (exportingPdfId) {
      return;
    }
    setExportingPdfId(journey.id);
    try {
      const html = await journeyToHtml(journey, t);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }

      const file = await Print.printToFileAsync({
        html,
        base64: false,
      });
      // Share a human-readable filename instead of the printer's random one.
      const safeTitle =
        journey.title
          .replace(/[\\/:*?"<>|\n\r]/g, '')
          .trim()
          .slice(0, 50) || 'journey';
      const destination = new File(Paths.cache, `${safeTitle}.pdf`);
      new File(file.uri).copy(destination);
      const pdfUri = destination.uri;

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(t('review.exportSuccessTitle'), t('review.exportSuccessBody', { uri: pdfUri }));
        return;
      }

      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${safeTitle}.pdf`,
      });
    } catch {
      Alert.alert(t('review.exportFailedTitle'), t('review.exportFailedBody'));
    } finally {
      setExportingPdfId(null);
    }
  }

  if (!hasLoadedOnce) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollViewRef}
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + LIST_CONTENT_TOP_PADDING },
      ]}
      scrollEnabled={enlargedMapId === null}
      onLayout={(event) => {
        setListViewportHeight(event.nativeEvent.layout.height);
      }}
      onScroll={(event) => {
        scrollYRef.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={isDark ? '#5eead4' : '#0f766e'}
          colors={[isDark ? '#5eead4' : '#0f766e']}
        />
      }
    >
      <View style={styles.pageHeader}>
        <Text style={[styles.title, themed.title]}>{t('review.title')}</Text>
      </View>
      <Text style={[styles.subTitle, themed.subTitle]}>{t('review.subtitle')}</Text>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('review.searchPlaceholder')}
        placeholderTextColor={themed.placeholder}
        style={[styles.searchInput, themed.searchInput]}
      />

      <View style={styles.segmentTriggerRow}>
        <Pressable
          style={[
            styles.segmentTrigger,
            isDark ? styles.segmentTriggerDark : styles.segmentTriggerLight,
            filter !== 'all' && styles.segmentTriggerActive,
          ]}
          onPress={() => setFilterPicker(filterPicker === 'kind' ? null : 'kind')}
        >
          <Text
            style={[
              styles.segmentTriggerText,
              {
                color: filter !== 'all' ? '#0f766e' : isDark ? '#e2e8f0' : '#0f172a',
              },
            ]}
            numberOfLines={1}
          >
            {`${t('review.filterKind')}${locale === 'zh' ? '：' : ': '}${journeyFilterLabel(filter, t)}`}
          </Text>
          <MaterialIcons
            name={filterPicker === 'kind' ? 'expand-less' : 'expand-more'}
            size={18}
            color={isDark ? '#94a3b8' : '#64748b'}
          />
        </Pressable>
        {availableTags.length > 0 ? (
          <Pressable
            style={[
              styles.segmentTrigger,
              isDark ? styles.segmentTriggerDark : styles.segmentTriggerLight,
              selectedTag != null && styles.segmentTriggerActive,
            ]}
            onPress={() => setFilterPicker(filterPicker === 'tag' ? null : 'tag')}
          >
            <Text
              style={[
                styles.segmentTriggerText,
                {
                  color: selectedTag != null ? '#0f766e' : isDark ? '#e2e8f0' : '#0f172a',
                },
              ]}
              numberOfLines={1}
            >
              {`${t('review.filterTag')}${locale === 'zh' ? '：' : ': '}${selectedTag ? `#${selectedTag}` : t('review.filterAllTags')}`}
            </Text>
            <MaterialIcons
              name={filterPicker === 'tag' ? 'expand-less' : 'expand-more'}
              size={18}
              color={isDark ? '#94a3b8' : '#64748b'}
            />
          </Pressable>
        ) : null}
      </View>
      {filterPicker === 'kind' ? (
        <View
          style={[styles.segmentPanel, isDark ? styles.segmentPanelDark : styles.segmentPanelLight]}
        >
          <ScrollView style={styles.segmentPanelScroll} nestedScrollEnabled>
            {(['all', 'travel', 'commute'] as const).map((value) => (
              <Pressable
                key={value}
                style={[
                  styles.segmentPanelItem,
                  filter === value && styles.segmentPanelItemSelected,
                ]}
                onPress={() => {
                  setFilter(value);
                  setFilterPicker(null);
                }}
              >
                <Text
                  style={[
                    styles.segmentPanelItemText,
                    filter === value ? styles.segmentChipTextSelected : themed.statLabel,
                  ]}
                >
                  {journeyFilterLabel(value, t)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {filterPicker === 'tag' && availableTags.length > 0 ? (
        <View
          style={[styles.segmentPanel, isDark ? styles.segmentPanelDark : styles.segmentPanelLight]}
        >
          <ScrollView style={styles.segmentPanelScroll} nestedScrollEnabled>
            <Pressable
              style={[
                styles.segmentPanelItem,
                selectedTag === null && styles.segmentPanelItemSelected,
              ]}
              onPress={() => {
                setSelectedTag(null);
                setFilterPicker(null);
              }}
            >
              <Text
                style={[
                  styles.segmentPanelItemText,
                  selectedTag === null ? styles.segmentChipTextSelected : themed.statLabel,
                ]}
              >
                {t('review.filterAllTags')}
              </Text>
            </Pressable>
            {availableTags.map((tag) => (
              <Pressable
                key={tag}
                style={[
                  styles.segmentPanelItem,
                  selectedTag === tag && styles.segmentPanelItemSelected,
                ]}
                onPress={() => {
                  setSelectedTag(tag);
                  setFilterPicker(null);
                }}
              >
                <Text
                  style={[
                    styles.segmentPanelItemText,
                    selectedTag === tag ? styles.segmentChipTextSelected : themed.statLabel,
                  ]}
                >
                  #{tag}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {filteredJourneys.length === 0 ? (
        <View style={[styles.card, themed.card]}>
          <Text style={[styles.emptyTitle, themed.emptyTitle]}>{t('review.emptyTitle')}</Text>
          <Text style={[styles.emptyText, themed.emptyText]}>{t('review.emptyBody')}</Text>
        </View>
      ) : (
        filteredJourneys.map((journey) => {
          const isCollapsed = expandedCardId !== journey.id;
          const derived = journeyDerivedById.get(journey.id);
          const stats = derived?.stats ?? computeJourneyStats(journey);
          const routeLocations = derived?.track ?? getJourneyTrackLocations(journey);
          const markerLocations =
            derived?.markerLocations ?? getJourneyTrackMapMarkerLocations(journey);
          const hasTrackMap = routeLocations.length > 0 || markerLocations.length > 0;
          const activeSegment = segmentRange?.journeyId === journey.id ? segmentRange : null;
          const openPicker = segmentPicker?.journeyId === journey.id ? segmentPicker : null;
          const lastEntryIndex = journey.entries.length - 1;
          const segmentStart = activeSegment?.start ?? 0;
          const segmentEnd = activeSegment?.end ?? lastEntryIndex;
          const isFullSegment = segmentStart === 0 && segmentEnd === lastEntryIndex;
          const segmentStats =
            derived && journey.entries.length >= 2
              ? getSegmentStats(journey, derived.track, journey.id, segmentStart, segmentEnd)
              : null;

          return (
            <View key={journey.id} style={[styles.card, themed.card]}>
              <View style={styles.journeyHeader}>
                <View>
                  <Text style={[styles.journeyTitle, themed.journeyTitle]}>{journey.title}</Text>
                  <Text style={[styles.journeyMeta, themed.journeyMeta]}>
                    {kindLabel(journey.kind, t)} · {formatDateTime(journey.createdAt)} -{' '}
                    {formatDateTime(journey.endedAt)}
                  </Text>
                  <Text style={[styles.journeyMeta, themed.journeyMeta]}>
                    {t('review.journeyCount', {
                      count: journey.entries.length,
                    })}
                  </Text>
                  {journey.tags.length > 0 ? (
                    <View style={styles.tagRow}>
                      {journey.tags.map((tag) => (
                        <View key={tag} style={[styles.tagChip, themed.tagChip]}>
                          <Text style={[styles.tagChipText, themed.tagChipText]}>#{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={styles.journeyHeaderActions}>
                  <Pressable onPress={() => toggleCardExpanded(journey.id)}>
                    <MaterialIcons
                      name={isCollapsed ? 'expand-more' : 'expand-less'}
                      size={22}
                      color={isDark ? '#cbd5e1' : '#334155'}
                    />
                  </Pressable>
                  {!isCollapsed ? (
                    <Pressable
                      onPress={() => void exportJourneyPdf(journey)}
                      disabled={exportingPdfId === journey.id}
                    >
                      {exportingPdfId === journey.id ? (
                        <ActivityIndicator size={18} color={isDark ? '#7dd3fc' : '#0369a1'} />
                      ) : (
                        <MaterialIcons
                          name="picture-as-pdf"
                          size={20}
                          color={isDark ? '#7dd3fc' : '#0369a1'}
                        />
                      )}
                    </Pressable>
                  ) : null}
                  {!isCollapsed ? (
                    <Pressable
                      onPress={() =>
                        Alert.alert(t('review.deleteJourneyTitle'), t('review.deleteJourneyBody'), [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('common.delete'),
                            style: 'destructive',
                            onPress: () => {
                              void removeJourney(journey.id);
                            },
                          },
                        ])
                      }
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={20}
                        color={isDark ? '#fca5a5' : '#b91c1c'}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {isCollapsed ? null : (
                <>
                  <View style={[styles.statsWrap, themed.statsWrap]}>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>
                        {t('review.statsDistance')}
                      </Text>
                      <Text style={[styles.statValue, themed.statValue]}>
                        {stats.distanceKm.toFixed(2)} km
                      </Text>
                    </View>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>
                        {t('review.statsDuration')}
                      </Text>
                      <Text style={[styles.statValue, themed.statValue]}>
                        {formatDuration(stats.durationMs, t)}
                      </Text>
                    </View>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>
                        {t('review.statsAvgSpeed')}
                      </Text>
                      <Text style={[styles.statValue, themed.statValue]}>
                        {stats.avgSpeedKmh.toFixed(2)} km/h
                      </Text>
                    </View>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>
                        {t('review.statsLocationPoints')}
                      </Text>
                      <Text style={[styles.statValue, themed.statValue]}>
                        {stats.locationPoints}
                      </Text>
                    </View>
                  </View>

                  {journey.entries.length >= 2 ? (
                    <View
                      style={[
                        styles.segmentSection,
                        {
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                        },
                      ]}
                    >
                      <Text style={[styles.mapTitle, themed.mapTitle]}>
                        {t('review.segmentTitle')}
                      </Text>
                      <Text style={[styles.statLabel, themed.statLabel]}>
                        {t('review.segmentHint')}
                      </Text>
                      <View style={styles.segmentTriggerRow}>
                        {(['start', 'end'] as const).map((kind) => {
                          const isOpen = openPicker?.kind === kind;
                          const picked = kind === 'start' ? segmentStart : segmentEnd;
                          const prefix =
                            kind === 'start' ? t('review.html.start') : t('review.html.end');
                          return (
                            <Pressable
                              key={kind}
                              style={[
                                styles.segmentTrigger,
                                isDark ? styles.segmentTriggerDark : styles.segmentTriggerLight,
                              ]}
                              onPress={() =>
                                setSegmentPicker(isOpen ? null : { journeyId: journey.id, kind })
                              }
                            >
                              <Text
                                style={[
                                  styles.segmentTriggerText,
                                  { color: isDark ? '#e2e8f0' : '#0f172a' },
                                ]}
                                numberOfLines={1}
                              >
                                {prefix}
                                {locale === 'zh' ? '：' : ': '}
                                {`#${picked + 1} · ${formatDateTime(
                                  journey.entries[picked].createdAt,
                                )}`}
                              </Text>
                              <MaterialIcons
                                name={isOpen ? 'expand-less' : 'expand-more'}
                                size={18}
                                color={isDark ? '#94a3b8' : '#64748b'}
                              />
                            </Pressable>
                          );
                        })}
                      </View>
                      {openPicker ? (
                        <View
                          style={[
                            styles.segmentPanel,
                            isDark ? styles.segmentPanelDark : styles.segmentPanelLight,
                          ]}
                        >
                          <ScrollView style={styles.segmentPanelScroll} nestedScrollEnabled>
                            {journey.entries.map((entry, index) => {
                              const isSelected =
                                (openPicker.kind === 'start' ? segmentStart : segmentEnd) === index;
                              // Prefer the address; fall back to the
                              // record's own text when it has none.
                              const hasAddress = Boolean(entry.location?.placeName);
                              const detail = hasAddress ? entry.location?.placeName : entry.text;
                              return (
                                <Pressable
                                  key={entry.id}
                                  style={[
                                    styles.segmentPanelItem,
                                    isSelected && styles.segmentPanelItemSelected,
                                  ]}
                                  onPress={() =>
                                    handleSegmentPick(journey.id, openPicker.kind, index)
                                  }
                                >
                                  <MaterialCommunityIcons
                                    name={hasAddress ? 'map-marker-outline' : 'text-box-outline'}
                                    size={16}
                                    color={isSelected ? '#ffffff' : isDark ? '#94a3b8' : '#64748b'}
                                  />
                                  <Text
                                    style={[
                                      styles.segmentPanelItemText,
                                      isSelected
                                        ? styles.segmentChipTextSelected
                                        : themed.statLabel,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    #{index + 1} · {formatDateTime(entry.createdAt)}
                                    {detail ? ` · ${detail}` : ''}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </ScrollView>
                        </View>
                      ) : null}
                      {segmentStats ? (
                        <View style={styles.segmentStatsRow}>
                          <View style={[styles.statItem, themed.statItem]}>
                            <Text style={[styles.statLabel, themed.statLabel]}>
                              {t('review.segmentDistance')}
                            </Text>
                            <Text style={[styles.statValue, themed.statValue]}>
                              {segmentStats.distanceKm != null
                                ? `${segmentStats.distanceKm.toFixed(2)} km`
                                : '-'}
                            </Text>
                          </View>
                          <View style={[styles.statItem, themed.statItem]}>
                            <Text style={[styles.statLabel, themed.statLabel]}>
                              {t('review.segmentDuration')}
                            </Text>
                            <Text style={[styles.statValue, themed.statValue]}>
                              {formatDuration(segmentStats.durationMs, t)}
                            </Text>
                          </View>
                          <View style={[styles.statItem, themed.statItem]}>
                            <Text style={[styles.statLabel, themed.statLabel]}>
                              {t('review.segmentAvgSpeed')}
                            </Text>
                            <Text style={[styles.statValue, themed.statValue]}>
                              {segmentStats.avgSpeedKmh != null
                                ? `${segmentStats.avgSpeedKmh.toFixed(2)} km/h`
                                : '-'}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {hasTrackMap ? (
                    <View>
                      <Text style={[styles.mapTitle, themed.mapTitle]}>
                        {t('review.trackMapTitle')}
                      </Text>
                      <Animated.View
                        style={[
                          styles.mapWrapInner,
                          enlargedMapId === journey.id
                            ? animatedMapStyle
                            : { height: PREVIEW_MAP_HEIGHT },
                        ]}
                        ref={(node: View | null) => {
                          mapWrapRefs.current[journey.id] = node;
                        }}
                      >
                        <TrackMap
                          routeLocations={routeLocations}
                          markerLocations={markerLocations}
                          highlightLocations={
                            isFullSegment ? undefined : segmentStats?.segmentTrack
                          }
                          interactive={enlargedMapId === journey.id}
                        />
                        {canExpandMap ? (
                          <Pressable
                            style={[
                              styles.mapEnlargeButton,
                              isDark ? styles.mapEnlargeButtonDark : styles.mapEnlargeButtonLight,
                            ]}
                            onPress={() => toggleMapEnlarged(journey.id)}
                            accessibilityRole="button"
                            accessibilityLabel={
                              enlargedMapId === journey.id
                                ? t('review.mapCollapse')
                                : t('review.mapExpand')
                            }
                          >
                            <MaterialIcons
                              name={
                                enlargedMapId === journey.id ? 'close-fullscreen' : 'open-in-full'
                              }
                              size={16}
                              color={isDark ? '#e2e8f0' : '#334155'}
                            />
                          </Pressable>
                        ) : null}
                      </Animated.View>
                    </View>
                  ) : (
                    <Text style={[styles.emptyText, themed.emptyText]}>
                      {t('review.trackMapEmpty')}
                    </Text>
                  )}

                  <View style={[styles.divider, themed.divider]} />

                  {journey.entries.length === 0 ? (
                    <Text style={[styles.emptyText, themed.emptyText]}>
                      {t('review.emptyEntries')}
                    </Text>
                  ) : (
                    journey.entries.map((entry) => (
                      <View key={entry.id} style={[styles.entryItem, themed.entryItem]}>
                        {(() => {
                          const photos = entry.media.filter((media) => media.type === 'photo');
                          const videos = entry.media.filter((media) => media.type === 'video');
                          const audios = entry.media.filter((media) => media.type === 'audio');

                          return (
                            <>
                              <Text style={[styles.entryTime, themed.entryTime]}>
                                {formatDateTime(entry.createdAt)}
                              </Text>
                              {entry.text ? (
                                <Text style={[styles.entryText, themed.entryText]}>
                                  {entry.text}
                                </Text>
                              ) : null}
                              {entry.tags.length > 0 ? (
                                <View style={styles.tagRow}>
                                  {entry.tags.map((tag) => (
                                    <View key={tag} style={[styles.tagChip, themed.tagChip]}>
                                      <Text style={[styles.tagChipText, themed.tagChipText]}>
                                        #{tag}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              ) : null}
                              {entry.location ? (
                                <Text style={[styles.metaLine, themed.metaLine]}>
                                  {t('review.locationLine', {
                                    location: formatLocationLabel(entry.location),
                                  })}
                                </Text>
                              ) : null}
                              {entry.media.length > 0 ? (
                                <>
                                  <Text style={[styles.metaLine, themed.metaLine]}>
                                    {t('review.mediaLine', {
                                      photos: photos.length,
                                      videos: videos.length,
                                      audios: audios.length,
                                    })}
                                  </Text>
                                  {photos.length > 0 ? (
                                    <>
                                      <Text
                                        style={[styles.mediaSectionTitle, themed.mediaSectionTitle]}
                                      >
                                        {t('review.sectionPhotos')}
                                      </Text>
                                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {photos.map((media) => (
                                          <Pressable
                                            key={media.id}
                                            style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}
                                            onPress={() => setPreviewMedia(media)}
                                          >
                                            <Image
                                              source={{ uri: media.uri }}
                                              style={styles.mediaPreview}
                                              contentFit="cover"
                                            />
                                            <Text style={[styles.mediaBadge, themed.mediaBadge]}>
                                              {t('common.photo')}
                                            </Text>
                                          </Pressable>
                                        ))}
                                      </ScrollView>
                                    </>
                                  ) : null}
                                  {videos.length > 0 ? (
                                    <>
                                      <Text
                                        style={[styles.mediaSectionTitle, themed.mediaSectionTitle]}
                                      >
                                        {t('review.sectionVideos')}
                                      </Text>
                                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {videos.map((media) => (
                                          <Pressable
                                            key={media.id}
                                            style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}
                                            onPress={() => setPreviewMedia(media)}
                                          >
                                            <VideoThumbCover uri={media.uri} />
                                            <Text style={[styles.mediaBadge, themed.mediaBadge]}>
                                              {t('common.video')}
                                            </Text>
                                          </Pressable>
                                        ))}
                                      </ScrollView>
                                    </>
                                  ) : null}
                                  {audios.length > 0 ? (
                                    <>
                                      <Text
                                        style={[styles.mediaSectionTitle, themed.mediaSectionTitle]}
                                      >
                                        {t('review.sectionAudios')}
                                      </Text>
                                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {audios.map((media) => (
                                          <View
                                            key={media.id}
                                            style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}
                                          >
                                            <AudioPlayer
                                              uri={media.uri}
                                              label={t('common.audio')}
                                            />
                                            <Text style={[styles.mediaBadge, themed.mediaBadge]}>
                                              {t('common.audio')}
                                            </Text>
                                          </View>
                                        ))}
                                      </ScrollView>
                                    </>
                                  ) : null}
                                </>
                              ) : null}
                            </>
                          );
                        })()}
                      </View>
                    ))
                  )}
                </>
              )}
            </View>
          );
        })
      )}

      <Modal
        visible={Boolean(previewMedia)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewMedia(null)}
      >
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewClose} onPress={() => setPreviewMedia(null)}>
            <Text style={styles.previewCloseText}>{t('review.previewClose')}</Text>
          </Pressable>
          {previewMedia?.type === 'video' ? (
            <PreviewVideo uri={previewMedia.uri} />
          ) : previewMedia ? (
            <Image
              source={{ uri: previewMedia.uri }}
              style={styles.previewMedia}
              contentFit="contain"
            />
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  subTitle: {
    color: '#475569',
    marginBottom: 4,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f8fafc',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  journeyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  journeyHeaderActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statsWrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  statValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  journeyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  journeyMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  mapTitle: {
    fontWeight: '600',
    color: '#334155',
  },
  mapWrapInner: {
    position: 'relative',
  },
  mapEnlargeButton: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
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
  segmentSection: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    gap: 8,
  },
  segmentTriggerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  segmentTriggerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  segmentTriggerDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  segmentTriggerActive: {
    borderColor: '#0f766e',
  },
  segmentTriggerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  segmentPanel: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segmentPanelLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  segmentPanelDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  segmentPanelScroll: {
    maxHeight: 220,
  },
  segmentPanelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  segmentPanelItemSelected: {
    backgroundColor: '#0f766e',
  },
  segmentPanelItemText: {
    flex: 1,
    fontSize: 12,
  },
  segmentChipTextSelected: {
    color: '#ffffff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  staticTrackImage: {
    width: '100%',
    height: 180,
  },
  staticTrackPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumbWrap: {
    width: 110,
    height: 80,
  },
  videoPlayBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  segmentStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exportText: {
    color: '#0369a1',
    fontWeight: '600',
    fontSize: 12,
  },
  deleteText: {
    color: '#b91c1c',
    fontWeight: '600',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  emptyText: {
    color: '#64748b',
    lineHeight: 20,
  },
  entryItem: {
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 10,
    gap: 4,
  },
  entryTime: {
    color: '#64748b',
    fontSize: 12,
  },
  entryText: {
    color: '#0f172a',
    lineHeight: 21,
    fontSize: 15,
  },
  metaLine: {
    color: '#334155',
    fontSize: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e0f2fe',
  },
  tagChipText: {
    fontSize: 11,
    color: '#0c4a6e',
    fontWeight: '600',
  },
  mediaPreviewBox: {
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: 110,
  },
  mediaPreview: {
    width: 110,
    height: 80,
  },
  mediaPlaceholder: {
    width: 110,
    height: 80,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  mediaSectionTitle: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  mediaBadge: {
    fontSize: 11,
    color: '#0f172a',
    padding: 4,
    backgroundColor: '#f8fafc',
  },
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  audioLabel: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  previewMedia: {
    width: '100%',
    height: '78%',
  },
  previewClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewCloseText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
