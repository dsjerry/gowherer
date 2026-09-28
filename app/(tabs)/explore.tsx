import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as ExpoFileSystem from "expo-file-system";
import { Image } from "expo-image";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { VideoView, useVideoPlayer } from "expo-video";
import { useCallback, useMemo, useState } from "react";
import {
    Alert,
    LayoutAnimation,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TrackMap } from "@/components/track-map";
import { useI18n } from "@/hooks/locale-preference";
import { useMaterialTheme } from "@/hooks/use-material-theme";
import { deleteJourney as deleteJourneyById } from "@/lib/journey-repository";
import { loadJourneys } from "@/lib/journey-storage";
import {
    calculateTrackDistanceKm,
    sanitizeTrackLocations,
} from "@/lib/track-utils";
import {
    Journey,
    JourneyKind,
    TimelineLocation,
    TimelineMedia,
} from "@/types/journey";

type JourneyFilter = "all" | JourneyKind;

type TFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string;

function formatDateTime(iso?: string) {
  if (!iso) {
    return "-";
  }
  const date = new Date(iso);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

function kindLabel(kind: JourneyKind, t: TFunction) {
  return kind === "travel"
    ? t("journey.kind.travel")
    : t("journey.kind.commute");
}

function formatDuration(durationMs: number, t: TFunction) {
  const totalMinutes = Math.max(0, Math.floor(durationMs / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return t("duration.minutes", { minutes });
  }
  if (minutes === 0) {
    return t("duration.hours", { hours });
  }
  return t("duration.hoursMinutes", { hours, minutes });
}

function getJourneyTrackLocations(journey: Journey) {
  return sanitizeTrackLocations(journey.trackLocations ?? []);
}

function getJourneyEntryLocations(journey: Journey) {
  return sanitizeTrackLocations(journey.entries.map((entry) => entry.location));
}

function getJourneyTrackMapMarkerLocations(journey: Journey) {
  const routeLocations = getJourneyTrackLocations(journey);
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

function computeJourneyStats(journey: Journey) {
  const trackLocations = getJourneyTrackLocations(journey);
  const entryLocations = getJourneyEntryLocations(journey);
  const distanceSource =
    trackLocations.length >= 2 ? trackLocations : entryLocations;
  const distanceKm = calculateTrackDistanceKm(distanceSource);

  const endMs = journey.endedAt
    ? new Date(journey.endedAt).getTime()
    : journey.entries.length > 0
      ? new Date(
          journey.entries[journey.entries.length - 1].createdAt,
        ).getTime()
      : new Date(journey.createdAt).getTime();
  const startMs = new Date(journey.createdAt).getTime();
  const durationMs = Number.isFinite(endMs - startMs)
    ? Math.max(0, endMs - startMs)
    : 0;
  const avgSpeedKmh = durationMs > 0 ? distanceKm / (durationMs / 3600000) : 0;

  return {
    locationPoints: trackLocations.length + entryLocations.length,
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

function mediaPreviewUri(media: TimelineMedia) {
  if (media.type === "video") {
    return media.thumbnailUri;
  }
  return media.uri;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function readImageAsBase64(uri: string): Promise<string | null> {
  try {
    if (!uri || uri.startsWith("data:")) return uri;
    if (uri.startsWith("file://") || uri.startsWith("content://")) {
      const base64 = await ExpoFileSystem.readAsStringAsync(uri, {
        encoding: "base64" as const,
      });
      const ext = uri.split(".").pop()?.toLowerCase() ?? "jpg";
      const mime = ext === "png" ? "png" : ext === "webp" ? "webp" : "jpeg";
      return `data:image/${mime};base64,${base64}`;
    }
    return uri;
  } catch {
    return null;
  }
}

async function buildEntryMediaHtml(media: TimelineMedia[]): Promise<string> {
  const photos = media.filter((m) => m.type === "photo");
  if (photos.length === 0) {
    const videoCount = media.filter((m) => m.type === "video").length;
    const audioCount = media.filter((m) => m.type === "audio").length;
    if (videoCount === 0 && audioCount === 0) return "";
    return `<div style="color:#64748b;font-size:12px;margin-top:8px;">${videoCount} 视频 · ${audioCount} 音频</div>`;
  }

  const imageTags = await Promise.all(
    photos.map(async (photo) => {
      const src = await readImageAsBase64(photo.uri);
      if (!src) return "";
      return `<img src="${src}" style="width:100%;height:200px;object-fit:cover;border-radius:8px;" />`;
    }),
  );
  const validImages = imageTags.filter(Boolean);
  if (validImages.length === 0) return "";

  if (validImages.length === 1) {
    return `<div style="margin-top:10px;">${validImages[0]}</div>`;
  }

  const gridHtml = validImages
    .map(
      (img) =>
        `<div style="flex:1;min-width:0;">${img.replace("height:200px", "height:140px")}</div>`,
    )
    .join("");
  return `<div style="display:flex;gap:6px;margin-top:10px;">${gridHtml}</div>`;
}

function buildTrackSvgDataUri(
  locations: TimelineLocation[],
  labels: { start: string; end: string },
) {
  if (locations.length < 2) {
    return "";
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
      const x =
        padding + ((item.longitude - minLng) / lngSpan) * (width - padding * 2);
      const y =
        height -
        padding -
        ((item.latitude - minLat) / latSpan) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const start = points.split(" ")[0];
  const end = points.split(" ")[points.split(" ").length - 1];

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
    <rect x='0' y='0' width='${width}' height='${height}' fill='#f8fafc' rx='12' />
    <polyline points='${points}' fill='none' stroke='#0f766e' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' />
    <circle cx='${start.split(",")[0]}' cy='${start.split(",")[1]}' r='7' fill='#0284c7' />
    <circle cx='${end.split(",")[0]}' cy='${end.split(",")[1]}' r='7' fill='#dc2626' />
    <text x='20' y='24' font-size='12' fill='#334155'>${escapeHtml(labels.start)}</text>
    <text x='64' y='24' font-size='12' fill='#334155'>${escapeHtml(labels.end)}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function journeyToHtml(journey: Journey, t: TFunction): Promise<string> {
  const stats = computeJourneyStats(journey);
  const routeLocations = getJourneyTrackLocations(journey);
  const fallbackLocations = getJourneyEntryLocations(journey);
  const locations =
    routeLocations.length >= 2 ? routeLocations : fallbackLocations;
  const trackSvgUri = buildTrackSvgDataUri(locations, {
    start: t("review.html.start"),
    end: t("review.html.end"),
  });

  const tagsHtml = journey.tags.length
    ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">${journey.tags
        .map(
          (tag) =>
            `<span style="background:#e2e8f0;color:#334155;padding:3px 10px;border-radius:12px;font-size:12px;">#${escapeHtml(tag)}</span>`,
        )
        .join("")}</div>`
    : "";

  const statsHtml = `
    <div style="display:flex;gap:20px;margin-top:20px;flex-wrap:wrap;">
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0f766e;">${stats.distanceKm.toFixed(2)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">km</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0f766e;">${formatDuration(stats.durationMs, t)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(t("review.statsDuration"))}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0f766e;">${stats.avgSpeedKmh.toFixed(1)}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">km/h</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#0f766e;">${stats.locationPoints}</div>
        <div style="font-size:11px;color:#64748b;margin-top:2px;">${escapeHtml(t("review.statsLocationPoints"))}</div>
      </div>
    </div>`;

  const cover = `
    <section style="min-height:90vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:40px 20px;background:linear-gradient(180deg,#f0fdfa 0%,#ffffff 100%);">
      <div style="font-size:13px;color:#0f766e;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(kindLabel(journey.kind, t))}</div>
      <h1 style="margin:0;font-size:36px;color:#0f172a;font-weight:700;">${escapeHtml(journey.title)}</h1>
      <p style="margin:12px 0 0;color:#475569;font-size:14px;">
        ${formatDateTime(journey.createdAt)} — ${journey.endedAt ? formatDateTime(journey.endedAt) : ""}
      </p>
      ${tagsHtml}
      ${statsHtml}
      <p style="margin:16px 0 0;color:#64748b;font-size:13px;">${escapeHtml(
        t("review.html.totalEntries", { count: journey.entries.length }),
      )}</p>
      ${
        trackSvgUri
          ? `<img src="${trackSvgUri}" alt="${escapeHtml(t("review.html.trackAlt"))}" style="width:90%;max-width:780px;margin-top:24px;border:1px solid #e2e8f0;border-radius:12px;" />`
          : `<div style="margin-top:24px;padding:14px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#64748b;font-size:13px;">${escapeHtml(
              t("review.html.trackEmpty"),
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
        : "";
      const tags = entry.tags.length
        ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${entry.tags
            .map(
              (tag) =>
                `<span style="background:#f1f5f9;color:#475569;padding:2px 8px;border-radius:10px;font-size:11px;">#${escapeHtml(tag)}</span>`,
            )
            .join("")}</div>`
        : "";
      const mediaHtml = await buildEntryMediaHtml(entry.media);
      const textHtml = entry.text
        ? `<div style="margin-top:8px;line-height:1.7;color:#1e293b;font-size:14px;">${escapeHtml(entry.text)}</div>`
        : `<div style="margin-top:8px;color:#94a3b8;font-size:13px;font-style:italic;">${escapeHtml(t("review.html.noText"))}</div>`;

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

  const items = entriesHtml.join("");

  return `<!doctype html>
  <html>
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;margin:0;padding:0;background:#ffffff;color:#0f172a;">
      ${cover}
      <section style="padding:30px 24px;">
        <h2 style="margin:0 0 20px;color:#0f172a;font-size:22px;font-weight:700;border-bottom:2px solid #0f766e;padding-bottom:8px;">${escapeHtml(t("review.html.title"))}</h2>
        ${items || `<div style="color:#64748b;text-align:center;padding:40px;">${escapeHtml(t("review.html.emptyText"))}</div>`}
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
    <VideoView
      player={player}
      style={styles.previewMedia}
      nativeControls
      contentFit="contain"
    />
  );
}

function MediaVideoCover({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
  });

  return (
    <VideoView
      player={player}
      style={styles.mediaPreview}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

function AudioPlayer({ uri, label }: { uri: string; label: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status?.playing ?? false;
  const { colors } = useMaterialTheme();

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
        name={isPlaying ? "pause-circle-filled" : "play-circle-filled"}
        size={20}
        color={colors.textSecondary}
      />
      <Text style={styles.audioLabel} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </Pressable>
  );
}

export default function JourneyHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { t, locale } = useI18n();
  const { colors: c, isDark: isDarkTheme } = useMaterialTheme();
  const tagSortLocale = locale === "zh" ? "zh-CN" : "en";
  const themed = {
    title: {
      color: c.textPrimary,
    },
    subTitle: {
      color: c.textSecondary,
    },
    card: {
      backgroundColor: c.surface,
      borderColor: c.borderSoft,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 2,
      elevation: 1,
    },
    screenBanner: {
      backgroundColor: c.surface,
      borderColor: c.borderSoft,
    },
    searchInput: {
      backgroundColor: c.surface,
      borderColor: "transparent",
      color: c.textPrimary,
    },
    placeholder: c.textTertiary,
    tagChip: {
      backgroundColor: c.bg,
      borderColor: c.borderSoft,
      borderWidth: 1,
    },
    tagChipText: {
      color: c.textSecondary,
    },
    statsWrap: {
      backgroundColor: "transparent",
      borderColor: "transparent",
    },
    statItem: {
      backgroundColor: c.bg,
      borderColor: c.borderSoft,
    },
    statLabel: {
      color: c.textTertiary,
    },
    statValue: {
      color: c.textPrimary,
    },
    journeyTitle: {
      color: c.textPrimary,
    },
    journeyMeta: {
      color: c.textTertiary,
    },
    mapTitle: {
      color: c.textSecondary,
    },
    emptyTitle: {
      color: c.textPrimary,
    },
    emptyText: {
      color: c.textTertiary,
    },
    divider: {
      backgroundColor: c.borderSoft,
    },
    entryItem: {
      backgroundColor: c.bg,
      borderColor: c.borderSoft,
    },
    entryTime: {
      color: c.textTertiary,
    },
    entryText: {
      color: c.textPrimary,
    },
    metaLine: {
      color: c.textSecondary,
    },
    mediaSectionTitle: {
      color: c.textSecondary,
    },
    mediaPreviewBox: {
      borderColor: c.borderSoft,
      backgroundColor: c.bg,
    },
    mediaBadge: {
      color: c.textPrimary,
      backgroundColor: c.surface,
    },
    mediaPlaceholder: {
      backgroundColor: c.borderSoft,
    },
    mediaPlaceholderText: {
      color: c.textTertiary,
    },
  };
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [filter, setFilter] = useState<JourneyFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<TimelineMedia | null>(null);
  const [collapsedJourneyIds, setCollapsedJourneyIds] = useState<string[]>([]);
  const [mapInteracting, setMapInteracting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const stored = await loadJourneys();
        if (active) {
          setJourneys(stored);
        }
      })();

      return () => {
        active = false;
      };
    }, []),
  );

  const completedJourneys = useMemo(
    () => journeys.filter((item) => item.status === "completed"),
    [journeys],
  );

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

    if (filter === "all") {
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

  const summaryDistance = filteredJourneys
    .reduce(
      (total, journey) => total + computeJourneyStats(journey).distanceKm,
      0,
    )
    .toFixed(1);
  const summaryEntries = filteredJourneys.reduce(
    (total, journey) => total + journey.entries.length,
    0,
  );
  const summaryPoints = filteredJourneys.reduce(
    (total, journey) => total + computeJourneyStats(journey).locationPoints,
    0,
  );

  async function removeJourney(journeyId: string) {
    const next = await deleteJourneyById(journeyId);
    setJourneys(next);
    setCollapsedJourneyIds((prev) => prev.filter((id) => id !== journeyId));
  }

  function toggleJourneyCollapsed(journeyId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedJourneyIds((prev) =>
      prev.includes(journeyId)
        ? prev.filter((id) => id !== journeyId)
        : [...prev, journeyId],
    );
  }

  async function exportJourneyPdf(journey: Journey) {
    try {
      const html = await journeyToHtml(journey, t);
      if (Platform.OS === "web") {
        await Print.printAsync({ html });
        return;
      }

      const file = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(
          t("review.exportSuccessTitle"),
          t("review.exportSuccessBody", { uri: file.uri }),
        );
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: "application/pdf",
        dialogTitle: `${journey.title}.pdf`,
      });
    } catch {
      Alert.alert(t("review.exportFailedTitle"), t("review.exportFailedBody"));
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 12 },
      ]}
      scrollEnabled={!mapInteracting}
    >
      <View style={styles.pageHeader}>
        <Text style={[styles.title, themed.title]}>{t("review.title")}</Text>
      </View>
      <View style={[styles.screenBanner, themed.screenBanner]}>
        <View style={styles.bannerCopy}>
          <Text style={[styles.bannerTitle, themed.title]}>
            已完成 {filteredJourneys.length} 次旅程
          </Text>
          <Text style={[styles.bannerSubtitle, themed.subTitle]}>
            {t("review.searchPlaceholder")}
          </Text>
        </View>
        <Text style={[styles.bannerMeta, { color: c.textTertiary }]}>
          {filteredJourneys.length} 条结果
        </Text>
      </View>
      <View style={[styles.summaryCard, themed.card]}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={[styles.summaryTitle, themed.journeyTitle]}>
              旅程回顾总览
            </Text>
            <Text style={[styles.summarySubtitle, themed.subTitle]}>
              筛选后自动汇总距离、记录数和定位点。
            </Text>
          </View>
          <Text
            style={[
              styles.summaryPill,
              {
                color: c.textSecondary,
                borderColor: c.borderSoft,
                backgroundColor: c.bg,
              },
            ]}
          >
            {filteredJourneys.length} 条
          </Text>
        </View>
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryStat, { borderColor: c.borderSoft }]}>
            <Text style={[styles.summaryValue, themed.journeyTitle]}>
              {summaryDistance}
            </Text>
            <Text style={[styles.summaryLabel, themed.statLabel]}>公里</Text>
          </View>
          <View style={[styles.summaryStat, { borderColor: c.borderSoft }]}>
            <Text style={[styles.summaryValue, themed.journeyTitle]}>
              {summaryEntries}
            </Text>
            <Text style={[styles.summaryLabel, themed.statLabel]}>记录</Text>
          </View>
          <View style={[styles.summaryStat, { borderColor: c.borderSoft }]}>
            <Text style={[styles.summaryValue, themed.journeyTitle]}>
              {summaryPoints}
            </Text>
            <Text style={[styles.summaryLabel, themed.statLabel]}>定位点</Text>
          </View>
        </View>
      </View>
      <View style={[styles.searchBar, { backgroundColor: c.surface }]}>
        <MaterialIcons name="search" size={18} color={c.meta} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t("review.searchPlaceholder")}
          placeholderTextColor={themed.placeholder}
          style={[styles.searchInput, { color: c.textPrimary }]}
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <Pressable
            accessibilityLabel={t("common.cancel")}
            onPress={() => setSearchQuery("")}
            hitSlop={8}
          >
            <MaterialIcons name="cancel" size={16} color={c.meta} />
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.segmented, { backgroundColor: c.surface }]}>
        {(
          [
            ["all", t("review.filterAll")],
            ["travel", t("review.filterTravel")],
            ["commute", t("review.filterCommute")],
          ] as const
        ).map(([value, label]) => {
          const isActive = filter === value;
          return (
            <Pressable
              key={value}
              style={[
                styles.segment,
                isActive && [
                  styles.segmentActive,
                  {
                    backgroundColor: isDarkTheme ? c.surfaceWarm : c.bg,
                    shadowColor: "#000000",
                  },
                ],
              ]}
              onPress={() => setFilter(value)}
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.segmentText,
                  { color: c.textSecondary },
                  isActive && { color: c.textPrimary, fontWeight: "600" },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {availableTags.length > 0 ? (
        <View style={styles.tagFilterBlock}>
          <Text style={[styles.tagFilterLabel, { color: c.textTertiary }]}>
            {t("review.tagFilterTitle")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagFilterRow}
          >
            {availableTags.map((tag) => {
              const isActive = selectedTag === tag;
              return (
                <Pressable
                  key={tag}
                  style={[
                    styles.tagFilterChip,
                    {
                      backgroundColor: isActive ? c.fg : c.bg,
                      borderColor: isActive ? c.fg : c.borderSoft,
                    },
                  ]}
                  onPress={() => setSelectedTag(isActive ? null : tag)}
                  accessibilityState={{ selected: isActive }}
                >
                  <Text
                    style={[
                      styles.tagFilterText,
                      { color: c.textSecondary },
                      isActive && { color: c.bg },
                    ]}
                  >
                    #{tag}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {filteredJourneys.length === 0 ? (
        <View style={[styles.card, themed.card, styles.emptyState]}>
          <View style={[styles.emptyIcon, { backgroundColor: c.surfaceWarm }]}>
            <MaterialIcons name="search" size={28} color={c.meta} />
          </View>
          <Text style={[styles.emptyTitle, themed.emptyTitle]}>
            {t("review.emptyTitle")}
          </Text>
          <Text style={[styles.emptyText, themed.emptyText]}>
            {t("review.emptyBody")}
          </Text>
        </View>
      ) : (
        filteredJourneys.map((journey) => {
          const isCollapsed = collapsedJourneyIds.includes(journey.id);
          const stats = computeJourneyStats(journey);
          const routeLocations = getJourneyTrackLocations(journey);
          const markerLocations = getJourneyTrackMapMarkerLocations(journey);
          const hasTrackMap =
            routeLocations.length > 0 || markerLocations.length > 0;

          return (
            <View key={journey.id} style={[styles.card, themed.card]}>
              <View style={styles.journeyHeader}>
                <View style={styles.journeyHeaderMain}>
                  <Text
                    style={[
                      styles.kindChip,
                      journey.kind === "travel"
                        ? {
                            color: c.accent,
                            backgroundColor: `${c.accent}12`,
                            borderColor: `${c.accent}33`,
                          }
                        : {
                            color: c.accentSecondary,
                            backgroundColor: `${c.accentSecondary}12`,
                            borderColor: `${c.accentSecondary}38`,
                          },
                    ]}
                  >
                    {kindLabel(journey.kind, t)}
                  </Text>
                  <View style={styles.journeyTitleRow}>
                    <Text
                      style={[styles.journeyTitle, themed.journeyTitle]}
                      numberOfLines={2}
                    >
                      {journey.title}
                    </Text>
                    <Text style={[styles.journeyDate, themed.journeyMeta]}>
                      {formatDateTime(journey.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.journeyMetaRow}>
                    <Text style={[styles.journeyMeta, themed.journeyMeta]}>
                      {formatDateTime(journey.endedAt)}
                    </Text>
                    <Text
                      style={[styles.journeyCount, { color: c.textSecondary }]}
                    >
                      {t("review.journeyCount", {
                        count: journey.entries.length,
                      })}
                    </Text>
                  </View>
                  {journey.tags.length > 0 ? (
                    <View style={styles.tagRow}>
                      {journey.tags.map((tag) => (
                        <View
                          key={tag}
                          style={[styles.tagChip, themed.tagChip]}
                        >
                          <Text
                            style={[styles.tagChipText, themed.tagChipText]}
                          >
                            #{tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
                <View style={styles.journeyHeaderActions}>
                  <Pressable
                    style={[
                      styles.headerActionButton,
                      { backgroundColor: c.surfaceWarm },
                    ]}
                    onPress={() => toggleJourneyCollapsed(journey.id)}
                  >
                    <MaterialIcons
                      name={isCollapsed ? "expand-more" : "expand-less"}
                      size={20}
                      color={c.muted}
                    />
                  </Pressable>
                  {!isCollapsed ? (
                    <Pressable
                      style={[
                        styles.headerActionButton,
                        { backgroundColor: c.surfaceWarm },
                      ]}
                      onPress={() => void exportJourneyPdf(journey)}
                    >
                      <MaterialIcons
                        name="picture-as-pdf"
                        size={18}
                        color={c.muted}
                      />
                    </Pressable>
                  ) : null}
                  {!isCollapsed ? (
                    <Pressable
                      style={[
                        styles.headerActionButton,
                        { backgroundColor: `${c.danger}1F` },
                      ]}
                      onPress={() =>
                        Alert.alert(
                          t("review.deleteJourneyTitle"),
                          t("review.deleteJourneyBody"),
                          [
                            { text: t("common.cancel"), style: "cancel" },
                            {
                              text: t("common.delete"),
                              style: "destructive",
                              onPress: () => {
                                void removeJourney(journey.id);
                              },
                            },
                          ],
                        )
                      }
                    >
                      <MaterialIcons
                        name="delete-outline"
                        size={20}
                        color={c.danger}
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
                        {t("review.statsDistance")}
                      </Text>
                      <Text style={[styles.statValue, themed.statValue]}>
                        {stats.distanceKm.toFixed(2)} km
                      </Text>
                    </View>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>
                        {t("review.statsDuration")}
                      </Text>
                      <Text style={[styles.statValue, themed.statValue]}>
                        {formatDuration(stats.durationMs, t)}
                      </Text>
                    </View>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>
                        {t("review.statsAvgSpeed")}
                      </Text>
                      <Text style={[styles.statValue, themed.statValue]}>
                        {stats.avgSpeedKmh.toFixed(2)} km/h
                      </Text>
                    </View>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>
                        {t("review.statsLocationPoints")}
                      </Text>
                      <Text style={[styles.statValue, themed.statValue]}>
                        {stats.locationPoints}
                      </Text>
                    </View>
                  </View>

                  {hasTrackMap ? (
                    <View>
                      <View
                        style={[
                          styles.routeCard,
                          { backgroundColor: c.bg, borderColor: c.borderSoft },
                        ]}
                      >
                        <View style={styles.routePreviewLeft}>
                          <View
                            style={[
                              styles.routePreviewIcon,
                              { backgroundColor: `${c.accentSecondary}14` },
                            ]}
                          >
                            <MaterialIcons
                              name="route"
                              size={18}
                              color={c.accentSecondary}
                            />
                          </View>
                          <View style={styles.routeCopy}>
                            <Text
                              style={[
                                styles.routeTitle,
                                { color: c.textPrimary },
                              ]}
                            >
                              {t("review.trackMapTitle")}
                            </Text>
                            <Text
                              style={[
                                styles.routeSubtitle,
                                { color: c.textTertiary },
                              ]}
                            >
                              {stats.locationPoints} 个定位点 ·{" "}
                              {stats.distanceKm.toFixed(1)} 公里
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View
                        style={[styles.mapFrame, { borderColor: c.borderSoft }]}
                        onTouchStart={() => setMapInteracting(true)}
                        onTouchEnd={() => setMapInteracting(false)}
                        onTouchCancel={() => setMapInteracting(false)}
                      >
                        <TrackMap
                          routeLocations={routeLocations}
                          markerLocations={markerLocations}
                        />
                      </View>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.routeCard,
                        { backgroundColor: c.bg, borderColor: c.borderSoft },
                      ]}
                    >
                      <View
                        style={[
                          styles.routePreviewIcon,
                          { backgroundColor: c.surfaceWarm },
                        ]}
                      >
                        <MaterialIcons name="map" size={18} color={c.muted} />
                      </View>
                      <Text style={[styles.emptyText, themed.emptyText]}>
                        {t("review.trackMapEmpty")}
                      </Text>
                    </View>
                  )}

                  <View style={[styles.divider, themed.divider]} />

                  {journey.entries.length === 0 ? (
                    <Text style={[styles.emptyText, themed.emptyText]}>
                      {t("review.emptyEntries")}
                    </Text>
                  ) : (
                    journey.entries.map((entry) => (
                      <View
                        key={entry.id}
                        style={[styles.entryItem, themed.entryItem]}
                      >
                        {(() => {
                          const photos = entry.media.filter(
                            (media) => media.type === "photo",
                          );
                          const videos = entry.media.filter(
                            (media) => media.type === "video",
                          );
                          const audios = entry.media.filter(
                            (media) => media.type === "audio",
                          );

                          return (
                            <>
                              <Text
                                style={[styles.entryTime, themed.entryTime]}
                              >
                                {formatDateTime(entry.createdAt)}
                              </Text>
                              {entry.text ? (
                                <Text
                                  style={[styles.entryText, themed.entryText]}
                                >
                                  {entry.text}
                                </Text>
                              ) : null}
                              {entry.tags.length > 0 ? (
                                <View style={styles.tagRow}>
                                  {entry.tags.map((tag) => (
                                    <View
                                      key={tag}
                                      style={[styles.tagChip, themed.tagChip]}
                                    >
                                      <Text
                                        style={[
                                          styles.tagChipText,
                                          themed.tagChipText,
                                        ]}
                                      >
                                        #{tag}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              ) : null}
                              {entry.location ? (
                                <Text
                                  style={[styles.metaLine, themed.metaLine]}
                                >
                                  {t("review.locationLine", {
                                    location: formatLocationLabel(
                                      entry.location,
                                    ),
                                  })}
                                </Text>
                              ) : null}
                              {entry.media.length > 0 ? (
                                <>
                                  <Text
                                    style={[styles.metaLine, themed.metaLine]}
                                  >
                                    {t("review.mediaLine", {
                                      photos: photos.length,
                                      videos: videos.length,
                                      audios: audios.length,
                                    })}
                                  </Text>
                                  {photos.length > 0 ? (
                                    <>
                                      <Text
                                        style={[
                                          styles.mediaSectionTitle,
                                          themed.mediaSectionTitle,
                                        ]}
                                      >
                                        {t("review.sectionPhotos")}
                                      </Text>
                                      <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                      >
                                        {photos.map((media) => (
                                          <Pressable
                                            key={media.id}
                                            style={[
                                              styles.mediaPreviewBox,
                                              themed.mediaPreviewBox,
                                            ]}
                                            onPress={() =>
                                              setPreviewMedia(media)
                                            }
                                          >
                                            <Image
                                              source={{ uri: media.uri }}
                                              style={styles.mediaPreview}
                                              contentFit="cover"
                                            />
                                            <Text
                                              style={[
                                                styles.mediaBadge,
                                                themed.mediaBadge,
                                              ]}
                                            >
                                              {t("common.photo")}
                                            </Text>
                                          </Pressable>
                                        ))}
                                      </ScrollView>
                                    </>
                                  ) : null}
                                  {videos.length > 0 ? (
                                    <>
                                      <Text
                                        style={[
                                          styles.mediaSectionTitle,
                                          themed.mediaSectionTitle,
                                        ]}
                                      >
                                        {t("review.sectionVideos")}
                                      </Text>
                                      <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                      >
                                        {videos.map((media) => (
                                          <Pressable
                                            key={media.id}
                                            style={[
                                              styles.mediaPreviewBox,
                                              themed.mediaPreviewBox,
                                            ]}
                                            onPress={() =>
                                              setPreviewMedia(media)
                                            }
                                          >
                                            {mediaPreviewUri(media) ? (
                                              <Image
                                                source={{
                                                  uri: mediaPreviewUri(media),
                                                }}
                                                style={styles.mediaPreview}
                                                contentFit="cover"
                                              />
                                            ) : media.type === "video" ? (
                                              <MediaVideoCover
                                                uri={media.uri}
                                              />
                                            ) : (
                                              <View
                                                style={[
                                                  styles.mediaPlaceholder,
                                                  themed.mediaPlaceholder,
                                                ]}
                                              >
                                                <Text
                                                  style={[
                                                    styles.mediaPlaceholderText,
                                                    themed.mediaPlaceholderText,
                                                  ]}
                                                >
                                                  {t("common.video")}
                                                </Text>
                                              </View>
                                            )}
                                            <Text
                                              style={[
                                                styles.mediaBadge,
                                                themed.mediaBadge,
                                              ]}
                                            >
                                              {t("common.video")}
                                            </Text>
                                          </Pressable>
                                        ))}
                                      </ScrollView>
                                    </>
                                  ) : null}
                                  {audios.length > 0 ? (
                                    <>
                                      <Text
                                        style={[
                                          styles.mediaSectionTitle,
                                          themed.mediaSectionTitle,
                                        ]}
                                      >
                                        {t("review.sectionAudios")}
                                      </Text>
                                      <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                      >
                                        {audios.map((media) => (
                                          <View
                                            key={media.id}
                                            style={[
                                              styles.mediaPreviewBox,
                                              themed.mediaPreviewBox,
                                            ]}
                                          >
                                            <AudioPlayer
                                              uri={media.uri}
                                              label={t("common.audio")}
                                            />
                                            <Text
                                              style={[
                                                styles.mediaBadge,
                                                themed.mediaBadge,
                                              ]}
                                            >
                                              {t("common.audio")}
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
          <Pressable
            style={styles.previewClose}
            onPress={() => setPreviewMedia(null)}
          >
            <Text style={styles.previewCloseText}>
              {t("review.previewClose")}
            </Text>
          </Pressable>
          {previewMedia?.type === "video" ? (
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
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.01,
  },
  pageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  subTitle: {
    marginBottom: 4,
  },
  screenBanner: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  bannerCopy: {
    flex: 1,
    gap: 4,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  bannerSubtitle: {
    fontSize: 11,
    lineHeight: 16,
  },
  bannerMeta: {
    fontSize: 11,
    fontWeight: "600",
    paddingTop: 1,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: -0.01,
  },
  summarySubtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  summaryPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "600",
  },
  summaryGrid: {
    flexDirection: "row",
    gap: 8,
  },
  summaryStat: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.01,
    fontVariant: ["tabular-nums"],
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.06,
    textTransform: "uppercase",
    fontWeight: "500",
  },
  searchBar: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  segmented: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentActive: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "500",
  },
  tagFilterBlock: {
    gap: 8,
  },
  tagFilterLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.06,
    textTransform: "uppercase",
  },
  tagFilterRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 6,
    paddingVertical: 1,
  },
  tagFilterChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagFilterText: {
    fontSize: 12,
    fontWeight: "500",
  },
  card: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    gap: 8,
  },
  journeyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  journeyHeaderMain: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  kindChip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: "600",
  },
  journeyHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  journeyTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 2,
  },
  journeyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statItem: {
    width: "48.5%",
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: 0.06,
    textTransform: "uppercase",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "600",
    letterSpacing: -0.01,
    fontVariant: ["tabular-nums"],
  },
  journeyTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: -0.01,
  },
  journeyDate: {
    fontSize: 12,
  },
  journeyMeta: {
    fontSize: 12,
  },
  journeyCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  routeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  routePreviewLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  routePreviewIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  routeCopy: {
    flex: 1,
    minWidth: 0,
  },
  routeTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  routeSubtitle: {
    marginTop: 1,
    fontSize: 12,
  },
  mapFrame: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  emptyText: {
    lineHeight: 20,
    textAlign: "center",
    fontSize: 13,
  },
  entryItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 4,
  },
  entryTime: {
    fontSize: 12,
  },
  entryText: {
    lineHeight: 21,
    fontSize: 15,
  },
  metaLine: {
    fontSize: 12,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  mediaPreviewBox: {
    marginRight: 10,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    width: 110,
  },
  mediaPreview: {
    width: 110,
    height: 80,
  },
  mediaPlaceholder: {
    width: 110,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPlaceholderText: {
    fontSize: 12,
    fontWeight: "700",
  },
  mediaSectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  mediaBadge: {
    fontSize: 11,
    padding: 4,
  },
  audioCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  audioLabel: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
  },
  previewMedia: {
    width: "100%",
    height: "78%",
  },
  previewClose: {
    position: "absolute",
    top: 48,
    right: 20,
    zIndex: 2,
    backgroundColor: "rgba(29,29,31,0.85)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  previewCloseText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
