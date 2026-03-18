
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useMemo, useState } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TrackMap } from '@/components/track-map';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/locale-preference';
import {
  calculateTrackDistanceKm,
  sanitizeTrackLocations,
  smoothTrackLocations,
} from '@/lib/track-utils';
import { loadJourneys, saveJourneys } from '@/lib/journey-storage';
import { Journey, JourneyKind, TimelineLocation, TimelineMedia } from '@/types/journey';

type JourneyFilter = 'all' | JourneyKind;

type TFunction = (key: string, params?: Record<string, string | number>) => string;

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

function getJourneyLocations(journey: Journey, smooth = true) {
  const locations = sanitizeTrackLocations(journey.entries.map((entry) => entry.location));

  return smooth ? smoothTrackLocations(locations) : locations;
}

function computeJourneyStats(journey: Journey) {
  const locations = getJourneyLocations(journey);
  const distanceKm = calculateTrackDistanceKm(locations);

  const endMs = journey.endedAt
    ? new Date(journey.endedAt).getTime()
    : journey.entries.length > 0
      ? new Date(journey.entries[journey.entries.length - 1].createdAt).getTime()
      : new Date(journey.createdAt).getTime();
  const startMs = new Date(journey.createdAt).getTime();
  const durationMs = Number.isFinite(endMs - startMs) ? Math.max(0, endMs - startMs) : 0;
  const avgSpeedKmh = durationMs > 0 ? distanceKm / (durationMs / 3600000) : 0;

  return {
    locationPoints: locations.length,
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
  if (media.type === 'video') {
    return media.thumbnailUri;
  }
  return media.uri;
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildTrackSvgDataUri(
  locations: TimelineLocation[],
  labels: { start: string; end: string }
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

function journeyToHtml(journey: Journey, t: TFunction) {
  const stats = computeJourneyStats(journey);
  const locations = getJourneyLocations(journey);
  const trackSvgUri = buildTrackSvgDataUri(locations, {
    start: t('review.html.start'),
    end: t('review.html.end'),
  });

  const cover = `
    <section style="height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:20px;">
      <h1 style="margin:0;font-size:38px;color:#0f172a;">${escapeHtml(journey.title)}</h1>
      <p style="margin:14px 0 0;color:#475569;font-size:16px;">
        ${escapeHtml(kindLabel(journey.kind, t))} · ${formatDateTime(journey.createdAt)} - ${formatDateTime(journey.endedAt)}
      </p>
      ${
        journey.tags.length > 0
          ? `<p style="margin:8px 0 0;color:#334155;font-size:13px;">${escapeHtml(
              t('review.html.tags', { tags: journey.tags.map((tag) => `#${escapeHtml(tag)}`).join(' ') })
            )}</p>`
          : ''
      }
      <p style="margin:8px 0 0;color:#334155;font-size:13px;">
        ${escapeHtml(
          t('review.html.stats', {
            distance: stats.distanceKm.toFixed(2),
            duration: formatDuration(stats.durationMs, t),
            speed: stats.avgSpeedKmh.toFixed(2),
            points: stats.locationPoints,
          })
        )}
      </p>
      <p style="margin:6px 0 16px;color:#64748b;">${escapeHtml(
        t('review.html.totalEntries', { count: journey.entries.length })
      )}</p>
      ${
        trackSvgUri
          ? `<img src="${trackSvgUri}" alt="${escapeHtml(t('review.html.trackAlt'))}" style="width:95%;max-width:780px;border:1px solid #e2e8f0;border-radius:12px;" />`
          : `<div style="padding:14px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#64748b;">${escapeHtml(
              t('review.html.trackEmpty')
            )}</div>`
      }
    </section>
    <div style="page-break-after:always;"></div>
  `;

  const items = journey.entries
    .map((entry) => {
      const location = entry.location
        ? `<div style="color:#475569;">${escapeHtml(
            t('review.html.locationLabel', { location: formatLocationLabel(entry.location) })
          )}</div>`
        : '';
      const mediaCount = entry.media.length
        ? `<div style="color:#475569;">${escapeHtml(
            t('review.html.mediaLabel', {
              photos: entry.media.filter((m) => m.type === 'photo').length,
              videos: entry.media.filter((m) => m.type === 'video').length,
              audios: entry.media.filter((m) => m.type === 'audio').length,
            })
          )}</div>`
        : '';
      const tags = entry.tags.length
        ? `<div style="color:#334155;">${escapeHtml(
            t('review.html.tags', { tags: entry.tags.map((tag) => `#${escapeHtml(tag)}`).join(' ') })
          )}</div>`
        : '';
      return `<div style="margin-bottom:12px;padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">${formatDateTime(entry.createdAt)}</div>
        <div style="margin-top:6px;line-height:1.6;color:#0f172a;">${escapeHtml(
          entry.text || t('review.html.noText')
        )}</div>
        ${tags}
        ${location}
        ${mediaCount}
      </div>`;
    })
    .join('');

  return `<!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;">
      ${cover}
      <h2 style="margin:0 0 12px;color:#0f172a;">${escapeHtml(t('review.html.title'))}</h2>
      ${items || `<div style="color:#64748b;">${escapeHtml(t('review.html.emptyText'))}</div>`}
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
    tagFilterChip: {
      backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
      borderColor: isDark ? '#334155' : '#cbd5e1',
    },
    tagFilterText: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
    filterButton: {
      backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
      borderColor: isDark ? '#334155' : '#cbd5e1',
    },
    filterButtonText: {
      color: isDark ? '#cbd5e1' : '#0f172a',
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
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<TimelineMedia | null>(null);
  const [collapsedJourneyIds, setCollapsedJourneyIds] = useState<string[]>([]);

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
    }, [])
  );

  const completedJourneys = useMemo(
    () => journeys.filter((item) => item.status === 'completed'),
    [journeys]
  );

  const availableTags = useMemo(
    () =>
      Array.from(
        new Set(
          completedJourneys.flatMap((journey) => [
            ...journey.tags,
            ...journey.entries.flatMap((entry) => entry.tags),
          ])
        )
      ).sort((a, b) => a.localeCompare(b, tagSortLocale)),
    [completedJourneys, tagSortLocale]
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
            entry.tags.some((tag) => includesQueryText(tag, query))
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
          entry.tags.some((tag) => includesQueryText(tag, query))
      );
    });
  }, [completedJourneys, filter, searchQuery, selectedTag, t]);

  async function removeJourney(journeyId: string) {
    const next = journeys.filter((item) => item.id !== journeyId);
    setJourneys(next);
    await saveJourneys(next);
    setCollapsedJourneyIds((prev) => prev.filter((id) => id !== journeyId));
  }

  function toggleJourneyCollapsed(journeyId: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsedJourneyIds((prev) =>
      prev.includes(journeyId)
        ? prev.filter((id) => id !== journeyId)
        : [...prev, journeyId]
    );
  }

  async function exportJourneyPdf(journey: Journey) {
    try {
      const html = journeyToHtml(journey, t);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }

      const file = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert(t('review.exportSuccessTitle'), t('review.exportSuccessBody', { uri: file.uri }));
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${journey.title}.pdf`,
      });
    } catch {
      Alert.alert(t('review.exportFailedTitle'), t('review.exportFailedBody'));
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 12 },
      ]}>
      <View style={styles.pageHeader}>
        <Text style={[styles.title, themed.title]}>{t('review.title')}</Text>
      </View>
      <Text style={[styles.subTitle, themed.subTitle]}>
        {t('review.subtitle')}
      </Text>
      <TextInput
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder={t('review.searchPlaceholder')}
        placeholderTextColor={themed.placeholder}
        style={[styles.searchInput, themed.searchInput]}
      />

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterButton, themed.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}>
          <Text
            style={[
              styles.filterButtonText,
              themed.filterButtonText,
              filter === 'all' && styles.filterButtonTextActive,
            ]}>
            {t('review.filterAll')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, themed.filterButton, filter === 'travel' && styles.filterButtonActive]}
          onPress={() => setFilter('travel')}>
          <Text
            style={[
              styles.filterButtonText,
              themed.filterButtonText,
              filter === 'travel' && styles.filterButtonTextActive,
            ]}>
            {t('review.filterTravel')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, themed.filterButton, filter === 'commute' && styles.filterButtonActive]}
          onPress={() => setFilter('commute')}>
          <Text
            style={[
              styles.filterButtonText,
              themed.filterButtonText,
              filter === 'commute' && styles.filterButtonTextActive,
            ]}>
            {t('review.filterCommute')}
          </Text>
        </Pressable>
      </View>
      {availableTags.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.tagFilterRow}>
            <Pressable
              style={[
                styles.tagFilterChip,
                themed.tagFilterChip,
                !selectedTag && styles.tagFilterChipActive,
              ]}
              onPress={() => setSelectedTag(null)}>
              <Text
                style={[
                  styles.tagFilterText,
                  themed.tagFilterText,
                  !selectedTag && styles.tagFilterTextActive,
                ]}>
                {t('review.filterAllTags')}
              </Text>
            </Pressable>
            {availableTags.map((tag) => (
              <Pressable
                key={tag}
                style={[
                  styles.tagFilterChip,
                  themed.tagFilterChip,
                  selectedTag === tag && styles.tagFilterChipActive,
                ]}
                onPress={() => setSelectedTag(tag)}>
                <Text
                  style={[
                    styles.tagFilterText,
                    themed.tagFilterText,
                    selectedTag === tag && styles.tagFilterTextActive,
                  ]}>
                  #{tag}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {filteredJourneys.length === 0 ? (
        <View style={[styles.card, themed.card]}>
          <Text style={[styles.emptyTitle, themed.emptyTitle]}>{t('review.emptyTitle')}</Text>
          <Text style={[styles.emptyText, themed.emptyText]}>
            {t('review.emptyBody')}
          </Text>
        </View>
      ) : (
        filteredJourneys.map((journey) => {
          const isCollapsed = collapsedJourneyIds.includes(journey.id);
          const stats = computeJourneyStats(journey);
          const locations = getJourneyLocations(journey);

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
                    {t('review.journeyCount', { count: journey.entries.length })}
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
                  <Pressable onPress={() => toggleJourneyCollapsed(journey.id)}>
                    <MaterialIcons
                      name={isCollapsed ? 'expand-more' : 'expand-less'}
                      size={22}
                      color={isDark ? '#cbd5e1' : '#334155'}
                    />
                  </Pressable>
                  {!isCollapsed ? (
                    <Pressable onPress={() => void exportJourneyPdf(journey)}>
                      <MaterialIcons
                        name="picture-as-pdf"
                        size={20}
                        color={isDark ? '#7dd3fc' : '#0369a1'}
                      />
                    </Pressable>
                  ) : null}
                  {!isCollapsed ? (
                    <Pressable
                      onPress={() =>
                        Alert.alert(
                          t('review.deleteJourneyTitle'),
                          t('review.deleteJourneyBody'),
                          [
                            { text: t('common.cancel'), style: 'cancel' },
                            {
                              text: t('common.delete'),
                              style: 'destructive',
                              onPress: () => {
                                void removeJourney(journey.id);
                              },
                            },
                          ]
                        )
                      }>
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
                      <Text style={[styles.statLabel, themed.statLabel]}>{t('review.statsDistance')}</Text>
                      <Text style={[styles.statValue, themed.statValue]}>{stats.distanceKm.toFixed(2)} km</Text>
                    </View>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>{t('review.statsDuration')}</Text>
                      <Text style={[styles.statValue, themed.statValue]}>{formatDuration(stats.durationMs, t)}</Text>
                    </View>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>{t('review.statsAvgSpeed')}</Text>
                      <Text style={[styles.statValue, themed.statValue]}>{stats.avgSpeedKmh.toFixed(2)} km/h</Text>
                    </View>
                    <View style={[styles.statItem, themed.statItem]}>
                      <Text style={[styles.statLabel, themed.statLabel]}>{t('review.statsLocationPoints')}</Text>
                      <Text style={[styles.statValue, themed.statValue]}>{stats.locationPoints}</Text>
                    </View>
                  </View>

                  {locations.length > 0 ? (
                    <View>
                      <Text style={[styles.mapTitle, themed.mapTitle]}>{t('review.trackMapTitle')}</Text>
                      <TrackMap locations={locations} />
                    </View>
                  ) : (
                    <Text style={[styles.emptyText, themed.emptyText]}>
                      {t('review.trackMapEmpty')}
                    </Text>
                  )}

                  <View style={[styles.divider, themed.divider]} />

                  {journey.entries.length === 0 ? (
                    <Text style={[styles.emptyText, themed.emptyText]}>{t('review.emptyEntries')}</Text>
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
                              {entry.text ? <Text style={[styles.entryText, themed.entryText]}>{entry.text}</Text> : null}
                              {entry.tags.length > 0 ? (
                                <View style={styles.tagRow}>
                                  {entry.tags.map((tag) => (
                                    <View key={tag} style={[styles.tagChip, themed.tagChip]}>
                                      <Text style={[styles.tagChipText, themed.tagChipText]}>#{tag}</Text>
                                    </View>
                                  ))}
                                </View>
                              ) : null}
                              {entry.location ? (
                                <Text style={[styles.metaLine, themed.metaLine]}>
                                  {t('review.locationLine', { location: formatLocationLabel(entry.location) })}
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
                                      <Text style={[styles.mediaSectionTitle, themed.mediaSectionTitle]}>
                                        {t('review.sectionPhotos')}
                                      </Text>
                                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {photos.map((media) => (
                                          <Pressable
                                            key={media.id}
                                            style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}
                                            onPress={() => setPreviewMedia(media)}>
                                            <Image
                                              source={{ uri: media.uri }}
                                              style={styles.mediaPreview}
                                              contentFit="cover"
                                            />
                                            <Text style={[styles.mediaBadge, themed.mediaBadge]}>{t('common.photo')}</Text>
                                          </Pressable>
                                        ))}
                                      </ScrollView>
                                    </>
                                  ) : null}
                                  {videos.length > 0 ? (
                                    <>
                                      <Text style={[styles.mediaSectionTitle, themed.mediaSectionTitle]}>
                                        {t('review.sectionVideos')}
                                      </Text>
                                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {videos.map((media) => (
                                          <Pressable
                                            key={media.id}
                                            style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}
                                            onPress={() => setPreviewMedia(media)}>
                                            {mediaPreviewUri(media) ? (
                                              <Image
                                                source={{ uri: mediaPreviewUri(media) }}
                                                style={styles.mediaPreview}
                                                contentFit="cover"
                                              />
                                            ) : media.type === 'video' ? (
                                              <MediaVideoCover uri={media.uri} />
                                            ) : (
                                              <View style={[styles.mediaPlaceholder, themed.mediaPlaceholder]}>
                                                <Text
                                                  style={[
                                                    styles.mediaPlaceholderText,
                                                    themed.mediaPlaceholderText,
                                                  ]}>
                                                  {t('common.video')}
                                                </Text>
                                              </View>
                                            )}
                                            <Text style={[styles.mediaBadge, themed.mediaBadge]}>{t('common.video')}</Text>
                                          </Pressable>
                                        ))}
                                      </ScrollView>
                                    </>
                                  ) : null}
                                  {audios.length > 0 ? (
                                    <>
                                      <Text style={[styles.mediaSectionTitle, themed.mediaSectionTitle]}>
                                        {t('review.sectionAudios')}
                                      </Text>
                                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {audios.map((media) => (
                                          <View
                                            key={media.id}
                                            style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}>
                                            <AudioPlayer uri={media.uri} label={t('common.audio')} />
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

      <Modal visible={Boolean(previewMedia)} transparent animationType="fade" onRequestClose={() => setPreviewMedia(null)}>
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewClose} onPress={() => setPreviewMedia(null)}>
            <Text style={styles.previewCloseText}>{t('review.previewClose')}</Text>
          </Pressable>
          {previewMedia?.type === 'video' ? (
            <PreviewVideo uri={previewMedia.uri} />
          ) : previewMedia ? (
            <Image source={{ uri: previewMedia.uri }} style={styles.previewMedia} contentFit="contain" />
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 6,
  },
  tagFilterChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  tagFilterChipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  tagFilterText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  tagFilterTextActive: {
    color: '#ffffff',
  },
  filterButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  filterButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 13,
  },
  filterButtonTextActive: {
    color: '#ffffff',
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
    minWidth: '47%',
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

