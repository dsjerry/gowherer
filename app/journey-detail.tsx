import { Stack, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { VideoView, useVideoPlayer } from 'expo-video';
import { captureRef } from 'react-native-view-shot';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { BottomSheetModal } from '@/components/bottom-sheet-modal';
import { JourneyReportView } from '@/components/journey-report-view';
import { MapPlaceholder } from '@/components/map-placeholder';
import { TrackMap } from '@/components/track-map';
import { VideoThumbCover } from '@/components/video-thumb-cover';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCostAmount, sumJourneyCosts } from '@/lib/journey-cost';
import { exportJourneyPdf } from '@/lib/journey-pdf';
import {
  computeJourneyStats,
  formatDateTime,
  formatDuration,
  formatLocationLabel,
  getJourneyTrackLocations,
  getJourneyTrackMapMarkerLocations,
  getSegmentStats,
  kindLabel,
} from '@/lib/journey-stats';
import { loadJourneys } from '@/lib/journey-storage';
import {
  DEFAULT_REPORT_TEMPLATE,
  REPORT_TEMPLATES,
  ReportTemplateId,
} from '@/lib/report-templates';
import { Journey, TimelineMedia } from '@/types/journey';

const MAP_PREVIEW_HEIGHT = 220;
/** 长图导出的逻辑宽度（pt），实际像素 = 宽度 × 屏幕像素密度 */
const REPORT_VIEW_WIDTH = 400;
const MAP_RESIZE_DURATION = 260;

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

export default function JourneyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [journey, setJourney] = useState<Journey | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [segmentRange, setSegmentRange] = useState<{
    start: number | null;
    end: number | null;
  } | null>(null);
  const [segmentPicker, setSegmentPicker] = useState<'start' | 'end' | null>(null);
  const [previewMedia, setPreviewMedia] = useState<TimelineMedia | null>(null);
  const [costSheetVisible, setCostSheetVisible] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [imageExporting, setImageExporting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ReportTemplateId>(DEFAULT_REPORT_TEMPLATE);
  const [pendingFormat, setPendingFormat] = useState<'pdf' | 'image'>('pdf');
  const [templateSheetVisible, setTemplateSheetVisible] = useState(false);
  const [reportRendered, setReportRendered] = useState(false);
  const reportWrapRef = useRef<View | null>(null);
  const [enlarged, setEnlarged] = useState(false);
  const [listViewportHeight, setListViewportHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const mapWrapRef = useRef<View | null>(null);
  const scrollYRef = useRef(0);

  // Enlarged map fills the visible area minus a bottom gap that keeps the
  // collapse button reachable.
  const enlargedMapHeight = Math.max(280, listViewportHeight - 24);
  const mapHeight = useSharedValue(MAP_PREVIEW_HEIGHT);
  const animatedMapStyle = useAnimatedStyle(() => ({
    height: mapHeight.value,
  }));

  const collapseEnlargedMap = useCallback(() => setEnlarged(false), []);

  // Reuse the already-rendering map instance (style-only height change) — the
  // AMap SDK renders a NEW map instance black while other instances exist, so
  // enlarging must never remount.
  function scrollMapIntoView() {
    const scrollView = scrollViewRef.current;
    const mapWrap = mapWrapRef.current;
    if (!scrollView || !mapWrap) {
      return;
    }
    (scrollView as unknown as View).measureInWindow((_x, scrollViewY) => {
      mapWrap.measureInWindow((_mapX, mapY) => {
        const contentY = mapY - scrollViewY + scrollYRef.current;
        scrollView.scrollTo({ y: Math.max(0, contentY - 12), animated: true });
      });
    });
  }

  function toggleMapEnlarged() {
    if (!enlarged) {
      setEnlarged(true);
      mapHeight.value = withTiming(enlargedMapHeight, { duration: MAP_RESIZE_DURATION });
      setTimeout(() => scrollMapIntoView(), MAP_RESIZE_DURATION + 40);
      return;
    }
    // Stay mounted at the enlarged height until the shrink finishes, otherwise
    // the height would snap back before the animation could run.
    mapHeight.value = withTiming(
      MAP_PREVIEW_HEIGHT,
      { duration: MAP_RESIZE_DURATION },
      (finished) => {
        if (finished) {
          runOnJS(collapseEnlargedMap)();
        }
      },
    );
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const stored = await loadJourneys();
        if (!active) {
          return;
        }
        setJourney(stored.find((item) => item.id === id) ?? null);
        setHasLoaded(true);
      })();
      return () => {
        active = false;
      };
    }, [id]),
  );

  // AMap 并发实例有配额：本页地图压在列表的地图之上。进页等 400ms（让列表
  // 地图的拆除 settle）再挂载；离开时立即卸载，把配额还给列表。
  const [mapActive, setMapActive] = useState(false);
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => setMapActive(true), 400);
      return () => {
        clearTimeout(timer);
        setEnlarged(false);
        mapHeight.value = MAP_PREVIEW_HEIGHT;
        setMapActive(false);
      };
      // mapHeight is a stable shared value; enlarged reset happens on blur too.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // 离屏报告渲染完成后等图片解码，再截图分享
  useEffect(() => {
    if (!imageExporting || !reportRendered || !journey) {
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const tmpUri = await captureRef(reportWrapRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        if (!active) {
          return;
        }
        const safeTitle =
          journey.title
            .replace(/[\\/:*?"<>|\n\r]/g, '')
            .trim()
            .slice(0, 50) || 'journey';
        const destination = new File(Paths.cache, `${safeTitle}.png`);
        // File.copy 在目标已存在时抛错（不覆盖），重复导出前先清掉旧文件
        if (destination.exists) {
          destination.delete();
        }
        new File(tmpUri).copy(destination);

        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
          Alert.alert(
            t('review.exportSuccessTitle'),
            t('review.exportSuccessBody', { uri: destination.uri }),
          );
          return;
        }
        await Sharing.shareAsync(destination.uri, {
          mimeType: 'image/png',
          dialogTitle: `${safeTitle}.png`,
        });
      } catch {
        Alert.alert(t('review.exportFailedTitle'), t('review.exportFailedBody'));
      } finally {
        if (active) {
          setImageExporting(false);
        }
      }
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [imageExporting, reportRendered, journey, t]);

  if (!hasLoaded) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!journey) {
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
        <Text style={styles.emptyText}>{t('review.emptyTitle')}</Text>
      </View>
    );
  }

  const stats = computeJourneyStats(journey);
  const track = getJourneyTrackLocations(journey);
  const markerLocations = getJourneyTrackMapMarkerLocations(journey, track);
  const routeLocations = track;
  const hasTrackMap = routeLocations.length > 0 || markerLocations.length > 0;
  const lastEntryIndex = journey.entries.length - 1;
  const segmentStart = segmentRange?.start ?? 0;
  const segmentEnd = segmentRange?.end ?? lastEntryIndex;
  const isFullSegment = segmentStart === 0 && segmentEnd === lastEntryIndex;
  const segmentStats =
    journey.entries.length >= 2
      ? getSegmentStats(journey, track, journey.id, segmentStart, segmentEnd)
      : null;
  const hasCosts = journey.entries.some((entry) => entry.cost);
  const costTotal = sumJourneyCosts(journey);

  function handleSegmentPick(kind: 'start' | 'end', index: number) {
    setSegmentRange((prev) =>
      kind === 'start'
        ? { start: index, end: prev?.end ?? null }
        : { start: prev?.start ?? null, end: index },
    );
    setSegmentPicker(null);
  }

  function openTemplateSheet(format: 'pdf' | 'image') {
    setPendingFormat(format);
    setTemplateSheetVisible(true);
  }

  function handleTemplateConfirm() {
    if (!journey) {
      return;
    }
    setTemplateSheetVisible(false);
    if (pendingFormat === 'pdf') {
      if (exporting) {
        return;
      }
      setExporting(true);
      exportJourneyPdf(journey, t, selectedTemplate).finally(() => setExporting(false));
    } else {
      if (imageExporting) {
        return;
      }
      setReportRendered(false);
      setImageExporting(true);
    }
  }

  const themed = {
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    journeyTitle: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    journeyMeta: {
      color: isDark ? '#94a3b8' : '#64748b',
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
    mapTitle: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
    tagChip: {
      backgroundColor: isDark ? '#334155' : '#e0f2fe',
    },
    tagChipText: {
      color: isDark ? '#e2e8f0' : '#0c4a6e',
    },
    costChip: {
      backgroundColor: isDark ? '#134e4a' : '#ccfbf1',
    },
    costChipText: {
      color: isDark ? '#5eead4' : '#0f766e',
    },
    divider: {
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
    },
    emptyText: {
      color: isDark ? '#94a3b8' : '#64748b',
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
  };

  return (
    <View style={[styles.pageWrap, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
      <Stack.Screen options={{ title: journey.title }} />
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.container}
        scrollEnabled={!enlarged}
        onLayout={(event) => {
          setListViewportHeight(event.nativeEvent.layout.height);
        }}
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <View style={[styles.card, themed.card]}>
          <View style={styles.headerInfo}>
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

          <View style={[styles.statsWrap, themed.statsWrap]}>
            <View style={[styles.statItem, themed.statItem]}>
              <Text style={[styles.statLabel, themed.statLabel]}>{t('review.statsDistance')}</Text>
              <Text style={[styles.statValue, themed.statValue]}>
                {stats.distanceKm.toFixed(2)} km
              </Text>
            </View>
            <View style={[styles.statItem, themed.statItem]}>
              <Text style={[styles.statLabel, themed.statLabel]}>{t('review.statsDuration')}</Text>
              <Text style={[styles.statValue, themed.statValue]}>
                {formatDuration(stats.durationMs, t)}
              </Text>
            </View>
            <View style={[styles.statItem, themed.statItem]}>
              <Text style={[styles.statLabel, themed.statLabel]}>{t('review.statsAvgSpeed')}</Text>
              <Text style={[styles.statValue, themed.statValue]}>
                {stats.avgSpeedKmh.toFixed(2)} km/h
              </Text>
            </View>
            <View style={[styles.statItem, themed.statItem]}>
              <Text style={[styles.statLabel, themed.statLabel]}>
                {t('review.statsLocationPoints')}
              </Text>
              <Text style={[styles.statValue, themed.statValue]}>{stats.locationPoints}</Text>
            </View>
            {hasCosts ? (
              <Pressable
                style={[styles.statItem, themed.statItem]}
                onPress={() => setCostSheetVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={t('review.statsCost')}
              >
                <View style={styles.costStatRow}>
                  <View style={styles.costStatLeft}>
                    <Text style={[styles.statLabel, themed.statLabel]}>
                      {t('review.statsCost')}
                    </Text>
                    <Text style={[styles.statValue, themed.statValue]}>
                      ¥{formatCostAmount(costTotal)}
                    </Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={18}
                    color={isDark ? '#94a3b8' : '#64748b'}
                  />
                </View>
              </Pressable>
            ) : null}
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
              <Text style={[styles.mapTitle, themed.mapTitle]}>{t('review.segmentTitle')}</Text>
              <Text style={[styles.statLabel, themed.statLabel]}>{t('review.segmentHint')}</Text>
              <View style={styles.segmentTriggerRow}>
                {(['start', 'end'] as const).map((kind) => {
                  const isOpen = segmentPicker === kind;
                  const picked = kind === 'start' ? segmentStart : segmentEnd;
                  const prefix = kind === 'start' ? t('review.html.start') : t('review.html.end');
                  return (
                    <Pressable
                      key={kind}
                      style={[
                        styles.segmentTrigger,
                        isDark ? styles.segmentTriggerDark : styles.segmentTriggerLight,
                      ]}
                      onPress={() => setSegmentPicker(isOpen ? null : kind)}
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
                        {`#${picked + 1} · ${formatDateTime(journey.entries[picked].createdAt)}`}
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
              {segmentPicker ? (
                <View
                  style={[
                    styles.segmentPanel,
                    isDark ? styles.segmentPanelDark : styles.segmentPanelLight,
                  ]}
                >
                  <ScrollView style={styles.segmentPanelScroll} nestedScrollEnabled>
                    {journey.entries.map((entry, index) => {
                      const isSelected =
                        (segmentPicker === 'start' ? segmentStart : segmentEnd) === index;
                      const hasAddress = Boolean(entry.location?.placeName);
                      const detail = hasAddress ? entry.location?.placeName : entry.text;
                      return (
                        <Pressable
                          key={entry.id}
                          style={[
                            styles.segmentPanelItem,
                            isSelected && styles.segmentPanelItemSelected,
                          ]}
                          onPress={() => handleSegmentPick(segmentPicker, index)}
                        >
                          <MaterialCommunityIcons
                            name={hasAddress ? 'map-marker-outline' : 'text-box-outline'}
                            size={16}
                            color={isSelected ? '#ffffff' : isDark ? '#94a3b8' : '#64748b'}
                          />
                          <Text
                            style={[
                              styles.segmentPanelItemText,
                              isSelected ? styles.segmentChipTextSelected : themed.statLabel,
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
            mapActive ? (
              <View>
                <Text style={[styles.mapTitle, themed.mapTitle]}>{t('review.trackMapTitle')}</Text>
                <Animated.View style={[styles.mapWrap, animatedMapStyle]} ref={mapWrapRef}>
                  <TrackMap
                    routeLocations={routeLocations}
                    markerLocations={markerLocations}
                    highlightLocations={isFullSegment ? undefined : segmentStats?.segmentTrack}
                    interactive={enlarged}
                  />
                  <Pressable
                    style={[
                      styles.mapEnlargeButton,
                      isDark ? styles.mapEnlargeButtonDark : styles.mapEnlargeButtonLight,
                    ]}
                    onPress={toggleMapEnlarged}
                    accessibilityRole="button"
                    accessibilityLabel={enlarged ? t('review.mapCollapse') : t('review.mapExpand')}
                  >
                    <MaterialIcons
                      name={enlarged ? 'close-fullscreen' : 'open-in-full'}
                      size={16}
                      color={isDark ? '#e2e8f0' : '#334155'}
                    />
                  </Pressable>
                </Animated.View>
              </View>
            ) : (
              <MapPlaceholder height={MAP_PREVIEW_HEIGHT} />
            )
          ) : (
            <Text style={[styles.emptyText, themed.emptyText]}>{t('review.trackMapEmpty')}</Text>
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
                      {entry.text ? (
                        <Text style={[styles.entryText, themed.entryText]}>{entry.text}</Text>
                      ) : null}
                      {entry.tags.length > 0 ? (
                        <View style={styles.tagRow}>
                          {entry.tags.map((tag) => (
                            <View key={tag} style={[styles.tagChip, themed.tagChip]}>
                              <Text style={[styles.tagChipText, themed.tagChipText]}>#{tag}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      {entry.cost ? (
                        <View style={styles.tagRow}>
                          <View style={[styles.costChip, themed.costChip]}>
                            <Text style={[styles.costChipText, themed.costChipText]}>
                              {t(`journey.costMode.${entry.cost.mode}`)} ¥
                              {formatCostAmount(entry.cost.amount)}
                            </Text>
                          </View>
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
                              <Text style={[styles.mediaSectionTitle, themed.mediaSectionTitle]}>
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
                              <Text style={[styles.mediaSectionTitle, themed.mediaSectionTitle]}>
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
                              <Text style={[styles.mediaSectionTitle, themed.mediaSectionTitle]}>
                                {t('review.sectionAudios')}
                              </Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {audios.map((media) => (
                                  <View
                                    key={media.id}
                                    style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}
                                  >
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
        </View>

        <View style={styles.actionBar}>
          <Pressable
            style={[
              styles.actionBarItem,
              isDark ? styles.actionBarItemDark : styles.actionBarItemLight,
            ]}
            onPress={() => openTemplateSheet('pdf')}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel={t('review.actionExportPdf')}
          >
            {exporting ? (
              <ActivityIndicator size={20} color={isDark ? '#7dd3fc' : '#0369a1'} />
            ) : (
              <MaterialIcons
                name="picture-as-pdf"
                size={22}
                color={isDark ? '#7dd3fc' : '#0369a1'}
              />
            )}
          </Pressable>
          <Pressable
            style={[
              styles.actionBarItem,
              isDark ? styles.actionBarItemDark : styles.actionBarItemLight,
            ]}
            onPress={() => openTemplateSheet('image')}
            disabled={imageExporting}
            accessibilityRole="button"
            accessibilityLabel={t('review.actionExportImage')}
          >
            {imageExporting ? (
              <ActivityIndicator size={20} color={isDark ? '#7dd3fc' : '#0369a1'} />
            ) : (
              <MaterialIcons name="image" size={22} color={isDark ? '#7dd3fc' : '#0369a1'} />
            )}
          </Pressable>
        </View>
      </ScrollView>

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

      <BottomSheetModal
        visible={costSheetVisible}
        onClose={() => setCostSheetVisible(false)}
        title={`${journey.title} · ${t('review.statsCost')}`}
        footer={
          <View style={styles.costSheetTotalRow}>
            <Text style={[styles.costSheetMode, themed.journeyTitle]}>
              {t('review.html.costTotalRow')}
            </Text>
            <Text style={[styles.costSheetAmount, themed.costChipText]}>
              ¥{formatCostAmount(costTotal)}
            </Text>
          </View>
        }
      >
        <ScrollView>
          {journey.entries
            .filter((entry) => entry.cost)
            .map((entry) => (
              <View
                key={entry.id}
                style={[
                  styles.costSheetItem,
                  { borderBottomColor: isDark ? '#334155' : '#e2e8f0' },
                ]}
              >
                <View style={styles.costSheetItemMain}>
                  <Text style={[styles.costSheetMode, themed.journeyTitle]}>
                    {t(`journey.costMode.${entry.cost!.mode}`)}
                  </Text>
                  <Text style={[styles.costSheetMeta, themed.statLabel]} numberOfLines={1}>
                    {formatDateTime(entry.createdAt)}
                    {entry.text ? ` · ${entry.text}` : ''}
                  </Text>
                </View>
                <Text style={[styles.costSheetAmount, themed.costChipText]}>
                  ¥{formatCostAmount(entry.cost!.amount)}
                </Text>
              </View>
            ))}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        visible={templateSheetVisible}
        onClose={() => setTemplateSheetVisible(false)}
        title={t('review.templateTitle')}
      >
        {REPORT_TEMPLATES.map((id) => {
          const selected = id === selectedTemplate;
          const nameKey = id === 'classic' ? 'review.templateClassic' : 'review.templateCompact';
          const descKey =
            id === 'classic' ? 'review.templateClassicDesc' : 'review.templateCompactDesc';
          return (
            <Pressable
              key={id}
              style={[
                styles.actionSheetItem,
                { borderBottomColor: isDark ? '#334155' : '#e2e8f0' },
              ]}
              onPress={() => setSelectedTemplate(id)}
              accessibilityRole="button"
            >
              <View style={styles.templateRowMain}>
                <Text
                  style={[
                    styles.actionSheetItemText,
                    selected ? themed.costChipText : themed.journeyTitle,
                  ]}
                >
                  {t(nameKey)}
                </Text>
                <Text style={[styles.templateDesc, themed.statLabel]}>{t(descKey)}</Text>
              </View>
              {selected ? (
                <MaterialIcons name="check" size={18} color={isDark ? '#5eead4' : '#0f766e'} />
              ) : null}
            </Pressable>
          );
        })}
        <Pressable
          style={styles.templateConfirmButton}
          onPress={handleTemplateConfirm}
          disabled={exporting || imageExporting}
          accessibilityRole="button"
        >
          {exporting || imageExporting ? <ActivityIndicator size={18} color="#ffffff" /> : null}
          <Text style={styles.templateConfirmText}>
            {pendingFormat === 'pdf' ? t('review.actionExportPdf') : t('review.actionExportImage')}
          </Text>
        </Pressable>
      </BottomSheetModal>

      {imageExporting && journey ? (
        <View style={styles.offscreen} pointerEvents="none">
          <View ref={reportWrapRef} collapsable={false} onLayout={() => setReportRendered(true)}>
            <JourneyReportView
              journey={journey}
              template={selectedTemplate}
              t={t}
              width={REPORT_VIEW_WIDTH}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 36,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 8,
  },
  headerInfo: {
    gap: 4,
  },
  journeyMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBarItem: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBarItemLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  actionBarItemDark: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  templateRowMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  templateDesc: {
    fontSize: 11,
  },
  templateConfirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  templateConfirmText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  offscreen: {
    position: 'absolute',
    top: 0,
    left: -99999,
  },
  statsWrap: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statItem: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 8,
    borderWidth: 1,
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
    fontWeight: '600',
  },
  costStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  costStatLeft: {
    gap: 4,
  },
  mapTitle: {
    fontWeight: '600',
    color: '#334155',
  },
  mapWrap: {
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
  segmentStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  emptyText: {
    color: '#64748b',
    lineHeight: 20,
  },
  entryItem: {
    borderRadius: 10,
    padding: 10,
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
    fontWeight: '600',
  },
  costChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#ccfbf1',
  },
  costChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mediaSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  mediaPreviewBox: {
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBadge: {
    fontSize: 11,
    padding: 4,
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
  actionSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionSheetItemText: {
    fontSize: 15,
  },
  costSheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  costSheetItemMain: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  costSheetMode: {
    fontSize: 15,
    fontWeight: '600',
  },
  costSheetMeta: {
    fontSize: 12,
  },
  costSheetAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  costSheetTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
});
