import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheetModal } from '@/components/bottom-sheet-modal';
import { DataLoadError } from '@/components/data-load-error';
import { MapPlaceholder } from '@/components/map-placeholder';
import { TrackMap } from '@/components/track-map';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCostAmount, sumJourneyCosts } from '@/lib/journey-cost';
import { exportJourneyPdf } from '@/lib/journey-pdf';
import { deleteJourney as deleteJourneyById } from '@/lib/journey-repository';
import {
  computeJourneyStats,
  formatDateTime,
  formatDuration,
  getJourneyTrackLocations,
  getJourneyTrackMapMarkerLocations,
  kindLabel,
} from '@/lib/journey-stats';
import { loadJourneys } from '@/lib/journey-storage';
import { logLocalError } from '@/lib/local-log';
import { REVIEW_FILTERS_KEY } from '@/lib/storage-keys';
import { Journey, JourneyKind, TimelineLocation } from '@/types/journey';

type JourneyFilter = 'all' | JourneyKind;

type TFunction = (key: string, params?: Record<string, string | number>) => string;

/** Top padding of the review list content, below the status bar. */
const LIST_CONTENT_TOP_PADDING = 12;
/** Gap kept below an enlarged map so its collapse button stays reachable. */
/** Collapsed height of an inline track map. */
/** Duration of the enlarge / collapse transition. */

function journeyFilterLabel(filter: JourneyFilter, t: TFunction) {
  if (filter === 'travel') {
    return t('review.filterTravel');
  }
  if (filter === 'commute') {
    return t('review.filterCommute');
  }
  return t('review.filterAll');
}

type JourneyDerived = {
  track: TimelineLocation[];
  markerLocations: TimelineLocation[];
  stats: ReturnType<typeof computeJourneyStats>;
};

function includesQueryText(source: string | undefined, query: string) {
  if (!source) {
    return false;
  }
  return source.toLowerCase().includes(query);
}

// Live TrackMap previews render in batches: the first screen renders up to
// MAP_RENDER_BATCH maps, and scrolling down renders more (maps stay mounted
// once rendered). Cards outside the batch show a loading placeholder.
const MAP_RENDER_BATCH = 5;
const MAP_MOUNT_INTERVAL = 600;
const LIST_MAP_HEIGHT = 180;

export default function JourneyHistoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
    costChip: {
      backgroundColor: isDark ? '#134e4a' : '#ccfbf1',
    },
    costChipText: {
      color: isDark ? '#5eead4' : '#0f766e',
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
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [costSheetJourneyId, setCostSheetJourneyId] = useState<string | null>(null);
  const [costSheetVisible, setCostSheetVisible] = useState(false);
  const [actionsSheetJourneyId, setActionsSheetJourneyId] = useState<string | null>(null);
  const [actionsSheetVisible, setActionsSheetVisible] = useState(false);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);
  const [reviewHydrated, setReviewHydrated] = useState(false);
  const [kindFilterSheetVisible, setKindFilterSheetVisible] = useState(false);
  const [tagFilterSheetVisible, setTagFilterSheetVisible] = useState(false);

  const reloadJourneys = useCallback(async () => {
    try {
      const stored = await loadJourneys();
      setJourneys(stored);
      setLoadError(false);
    } catch (error) {
      void logLocalError('review-load', error);
      setLoadError(true);
    }
  }, []);

  // AMap 并发实例有配额（累积超额会让新旧地图一起黑屏）。配额只在「根栈压入
  // 其他页面」（详情页/选点页会挂自己的地图）时需要腾出：立即卸载列表地图，
  // 返回后等 400ms 让对方的拆除 settle 完再重挂。tab 之间切换不动地图，
  // 避免每次切换都拆建 5 个 GL 实例造成卡顿。
  const [stackOverlay, setStackOverlay] = useState(false);
  const [mapsSettled, setMapsSettled] = useState(true);

  const navigation = useNavigation();
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) {
      return;
    }
    const unsub = parent.addListener('state', (event) => {
      setStackOverlay(event.data.state.index > 0);
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    if (stackOverlay) {
      setMapsSettled(false);
      setMountedMapCount(0);
      return;
    }
    const timer = setTimeout(() => setMapsSettled(true), 400);
    return () => clearTimeout(timer);
  }, [stackOverlay]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const stored = await loadJourneys();
          if (!active) {
            return;
          }
          setJourneys(stored);
          setLoadError(false);
        } catch (error) {
          if (!active) {
            return;
          }
          void logLocalError('review-load', error);
          setLoadError(true);
        } finally {
          if (active) {
            setHasLoadedOnce(true);
          }
        }
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

  const costSheetJourney =
    costSheetVisible && costSheetJourneyId
      ? (completedJourneys.find((item) => item.id === costSheetJourneyId) ?? null)
      : null;

  function openCostSheet(journeyId: string) {
    setCostSheetJourneyId(journeyId);
    setCostSheetVisible(true);
  }

  const actionsSheetJourney =
    actionsSheetVisible && actionsSheetJourneyId
      ? (completedJourneys.find((item) => item.id === actionsSheetJourneyId) ?? null)
      : null;

  function openActionsSheet(journeyId: string) {
    setActionsSheetJourneyId(journeyId);
    setActionsSheetVisible(true);
  }

  function handleActionsSheetView() {
    const journey = actionsSheetJourney;
    setActionsSheetVisible(false);
    if (journey) {
      router.push({ pathname: '/journey-detail', params: { id: journey.id } });
    }
  }

  function handleActionsSheetExport() {
    const journey = actionsSheetJourney;
    setActionsSheetVisible(false);
    if (journey) {
      setExportingPdfId(journey.id);
      exportJourneyPdf(journey, t).finally(() => setExportingPdfId(null));
    }
  }

  function handleActionsSheetDelete() {
    const journey = actionsSheetJourney;
    setActionsSheetVisible(false);
    if (!journey) {
      return;
    }
    Alert.alert(t('review.deleteJourneyTitle'), t('review.deleteJourneyBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void removeJourney(journey.id);
        },
      },
    ]);
  }

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

  // 地图分批渲染：首屏渲染 MAP_RENDER_BATCH 张，滚动接近时增量放开，
  // 已渲染的保持挂载不回收。
  const [mapRenderLimit, setMapRenderLimit] = useState(MAP_RENDER_BATCH);
  // AMap 创建存在竞态：同一时间挂多个实例，后创建的会输掉 GL 初始化而黑屏。
  // 因此实际挂载按 MAP_MOUNT_INTERVAL 逐个进行，占位图顶住等待期。
  const [mountedMapCount, setMountedMapCount] = useState(0);
  const [listViewportHeight, setListViewportHeight] = useState(0);
  const cardLayoutsRef = useRef<Record<string, number>>({});

  // 任何 sheet 打开期间暂停地图挂载 ramp：AMap 实例初始化会挤占 UI 线程，
  // 把 sheet 的收起动画卡死（回调不再触发）。
  const anySheetOpen =
    costSheetVisible || actionsSheetVisible || kindFilterSheetVisible || tagFilterSheetVisible;

  useEffect(() => {
    if (!mapsSettled || anySheetOpen) {
      return;
    }
    if (mountedMapCount >= mapRenderLimit) {
      return;
    }
    const timer = setTimeout(() => {
      setMountedMapCount((prev) => Math.min(prev + 1, mapRenderLimit));
    }, MAP_MOUNT_INTERVAL);
    return () => clearTimeout(timer);
  }, [mapsSettled, anySheetOpen, mountedMapCount, mapRenderLimit]);

  function updateMapRenderLimit(scrollY: number) {
    if (listViewportHeight === 0) {
      return;
    }
    const viewportBottom = scrollY + listViewportHeight + 400;
    let count = 0;
    for (const item of filteredJourneys) {
      const y = cardLayoutsRef.current[item.id];
      if (y != null && y <= viewportBottom) {
        count += 1;
      }
    }
    setMapRenderLimit((prev) => Math.max(prev, count, MAP_RENDER_BATCH));
  }

  async function removeJourney(journeyId: string) {
    const next = await deleteJourneyById(journeyId);
    setJourneys(next);
  }

  if (!hasLoadedOnce) {
    if (loadError) {
      return (
        <View style={[styles.center, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
          <DataLoadError onRetry={reloadJourneys} />
        </View>
      );
    }
    return (
      <View style={[styles.center, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + LIST_CONTENT_TOP_PADDING },
      ]}
      onLayout={(event) => {
        setListViewportHeight(event.nativeEvent.layout.height);
      }}
      onScroll={(event) => {
        updateMapRenderLimit(event.nativeEvent.contentOffset.y);
      }}
      scrollEventThrottle={64}
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
          onPress={() => setKindFilterSheetVisible(true)}
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
          <MaterialIcons name="expand-more" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
        </Pressable>
        {availableTags.length > 0 ? (
          <Pressable
            style={[
              styles.segmentTrigger,
              isDark ? styles.segmentTriggerDark : styles.segmentTriggerLight,
              selectedTag != null && styles.segmentTriggerActive,
            ]}
            onPress={() => setTagFilterSheetVisible(true)}
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
            <MaterialIcons name="expand-more" size={18} color={isDark ? '#94a3b8' : '#64748b'} />
          </Pressable>
        ) : null}
      </View>
      {filteredJourneys.length === 0 ? (
        <View style={[styles.card, themed.card]}>
          <Text style={[styles.emptyTitle, themed.emptyTitle]}>{t('review.emptyTitle')}</Text>
          <Text style={[styles.emptyText, themed.emptyText]}>{t('review.emptyBody')}</Text>
        </View>
      ) : (
        filteredJourneys.map((journey, index) => {
          const derived = journeyDerivedById.get(journey.id);
          const stats = derived?.stats ?? computeJourneyStats(journey);
          const routeLocations = derived?.track ?? getJourneyTrackLocations(journey);
          const markerLocations =
            derived?.markerLocations ?? getJourneyTrackMapMarkerLocations(journey, derived?.track);
          const hasTrackMap = routeLocations.length > 0 || markerLocations.length > 0;
          const hasCosts = journey.entries.some((entry) => entry.cost);
          const costTotal = sumJourneyCosts(journey);

          return (
            <Pressable
              key={journey.id}
              style={[styles.card, themed.card]}
              onLayout={(event) => {
                cardLayoutsRef.current[journey.id] = event.nativeEvent.layout.y;
              }}
              onPress={() =>
                router.push({ pathname: '/journey-detail', params: { id: journey.id } })
              }
            >
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
                  {exportingPdfId === journey.id ? (
                    <ActivityIndicator size={18} color={isDark ? '#7dd3fc' : '#0369a1'} />
                  ) : (
                    <Pressable
                      onPress={() => openActionsSheet(journey.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t('review.moreActions')}
                    >
                      <MaterialIcons
                        name="more-vert"
                        size={20}
                        color={isDark ? '#cbd5e1' : '#334155'}
                      />
                    </Pressable>
                  )}
                </View>
              </View>
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
                  {hasCosts ? (
                    <Pressable
                      style={styles.costStatRow}
                      onPress={() => openCostSheet(journey.id)}
                      accessibilityRole="button"
                      accessibilityLabel={t('review.statsCost')}
                    >
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
                    </Pressable>
                  ) : (
                    <View style={styles.costStatLeft}>
                      <Text style={[styles.statLabel, themed.statLabel]}>
                        {t('review.statsCost')}
                      </Text>
                      <Text style={[styles.statValue, themed.statValue]}>
                        ¥{formatCostAmount(costTotal)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {hasTrackMap ? (
                index < mountedMapCount && index < mapRenderLimit && mapsSettled ? (
                  <View style={{ height: LIST_MAP_HEIGHT }}>
                    <TrackMap routeLocations={routeLocations} markerLocations={markerLocations} />
                  </View>
                ) : (
                  <MapPlaceholder height={LIST_MAP_HEIGHT} />
                )
              ) : null}
            </Pressable>
          );
        })
      )}

      <BottomSheetModal
        visible={costSheetVisible}
        onClose={() => setCostSheetVisible(false)}
        title={
          costSheetJourney ? `${costSheetJourney.title} · ${t('review.statsCost')}` : undefined
        }
        footer={
          <View style={styles.costSheetTotalRow}>
            <Text style={[styles.costSheetMode, themed.journeyTitle]}>
              {t('review.html.costTotalRow')}
            </Text>
            <Text style={[styles.costSheetAmount, themed.costChipText]}>
              ¥{formatCostAmount(costSheetJourney ? sumJourneyCosts(costSheetJourney) : 0)}
            </Text>
          </View>
        }
      >
        <ScrollView>
          {costSheetJourney?.entries
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
        visible={actionsSheetVisible}
        onClose={() => setActionsSheetVisible(false)}
        title={actionsSheetJourney?.title}
      >
        <Pressable
          style={[styles.actionSheetItem, { borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
          onPress={handleActionsSheetView}
          accessibilityRole="button"
        >
          <MaterialIcons name="visibility" size={20} color={isDark ? '#7dd3fc' : '#0369a1'} />
          <Text style={[styles.actionSheetItemText, themed.journeyTitle]}>
            {t('review.actionViewDetail')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionSheetItem, { borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
          onPress={handleActionsSheetExport}
          accessibilityRole="button"
        >
          <MaterialIcons name="picture-as-pdf" size={20} color={isDark ? '#7dd3fc' : '#0369a1'} />
          <Text style={[styles.actionSheetItemText, themed.journeyTitle]}>
            {t('review.actionExportPdf')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionSheetItem, { borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
          onPress={handleActionsSheetDelete}
          accessibilityRole="button"
        >
          <MaterialIcons name="delete-outline" size={20} color={isDark ? '#f87171' : '#dc2626'} />
          <Text style={[styles.actionSheetItemText, styles.actionSheetItemTextDanger]}>
            {t('review.actionDelete')}
          </Text>
        </Pressable>
        <Pressable style={styles.actionSheetCancel} onPress={() => setActionsSheetVisible(false)}>
          <Text style={[styles.actionSheetItemText, themed.statLabel]}>{t('common.cancel')}</Text>
        </Pressable>
      </BottomSheetModal>
      <BottomSheetModal
        visible={kindFilterSheetVisible}
        onClose={() => setKindFilterSheetVisible(false)}
        title={t('review.filterKind')}
      >
        {(['all', 'travel', 'commute'] as const).map((value) => (
          <Pressable
            key={value}
            style={[styles.actionSheetItem, { borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
            onPress={() => {
              setFilter(value);
              setKindFilterSheetVisible(false);
            }}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.actionSheetItemText,
                filter === value ? themed.costChipText : themed.journeyTitle,
              ]}
            >
              {journeyFilterLabel(value, t)}
            </Text>
            {filter === value ? (
              <MaterialIcons name="check" size={18} color={isDark ? '#5eead4' : '#0f766e'} />
            ) : null}
          </Pressable>
        ))}
      </BottomSheetModal>

      <BottomSheetModal
        visible={tagFilterSheetVisible}
        onClose={() => setTagFilterSheetVisible(false)}
        title={t('review.filterTag')}
      >
        <ScrollView>
          <Pressable
            style={[styles.actionSheetItem, { borderBottomColor: isDark ? '#334155' : '#e2e8f0' }]}
            onPress={() => {
              setSelectedTag(null);
              setTagFilterSheetVisible(false);
            }}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.actionSheetItemText,
                selectedTag === null ? themed.costChipText : themed.journeyTitle,
              ]}
            >
              {t('review.filterAllTags')}
            </Text>
            {selectedTag === null ? (
              <MaterialIcons name="check" size={18} color={isDark ? '#5eead4' : '#0f766e'} />
            ) : null}
          </Pressable>
          {availableTags.map((tag) => (
            <Pressable
              key={tag}
              style={[
                styles.actionSheetItem,
                { borderBottomColor: isDark ? '#334155' : '#e2e8f0' },
              ]}
              onPress={() => {
                setSelectedTag(tag);
                setTagFilterSheetVisible(false);
              }}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.actionSheetItemText,
                  selectedTag === tag ? themed.costChipText : themed.journeyTitle,
                ]}
                numberOfLines={1}
              >
                #{tag}
              </Text>
              {selectedTag === tag ? (
                <MaterialIcons name="check" size={18} color={isDark ? '#5eead4' : '#0f766e'} />
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheetModal>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreviewFallback: {
    height: LIST_MAP_HEIGHT,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreviewFallbackDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  mapPlaceholderText: {
    fontSize: 12,
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
  costStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  costStatLeft: {
    gap: 4,
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
  actionSheetItemTextDanger: {
    color: '#dc2626',
  },
  actionSheetCancel: {
    alignItems: 'center',
    paddingVertical: 14,
  },
});
