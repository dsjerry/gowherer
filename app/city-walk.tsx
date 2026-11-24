import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ExpoGaodeMapModule } from 'expo-gaode-map';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityWalkConfigCard } from '@/components/city-walk-config-card';
import { CityWalkPlanView } from '@/components/city-walk-plan-view';
import { CityWalkSavedList } from '@/components/city-walk-saved-list';
import { CityWalkStatusCard } from '@/components/city-walk-status-card';
import { getCityWalkTheme } from '@/components/city-walk-theme';
import { useCityWalk } from '@/hooks/use-city-walk';
import { useCityWalkTrack } from '@/hooks/use-city-walk-track';
import { useI18n } from '@/hooks/locale-preference';
import { usePlaceSearch } from '@/hooks/use-place-search';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { startLocationTracking } from '@/lib/background-location';
import { getCityWalkErrorI18nKey, toCityWalkErrorInfo } from '@/lib/city-walk-error';
import { logLocalError, logLocalInfo } from '@/lib/local-log';
import { setPendingWalkMapPlan } from '@/lib/pending-walk-map';
import { NearbyPlace } from '@/lib/reverse-geocode';

export default function CityWalkScreen() {
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const isDark = useColorScheme() === 'dark';
  const cityWalk = useCityWalk();
  const search = usePlaceSearch(cityWalk.searchOriginPlaces);
  const scrollRef = useRef<ScrollView | null>(null);

  const {
    phase,
    stage,
    legProgress,
    preferences,
    origin,
    plan,
    error,
    busy,
    locating,
    savedPlans,
    isSaved,
    linkedJourneyId,
    setDuration,
    setPace,
    setRouteShape,
    toggleInterest,
    locateCurrentOrigin,
    pickPlaceAsOrigin,
    clearOrigin,
    consumePickedOrigin,
    generate,
    retry,
    cancelGeneration,
    backToConfig,
    removeStop,
    savePlan,
    startWalk,
    openSavedPlan,
    deleteSavedPlan,
  } = cityWalk;

  const theme = useMemo(() => getCityWalkTheme(isDark), [isDark]);
  // 「开始漫步」后关联旅程的实际 GPS 轨迹（预览页实时刷新）
  const walkedTrack = useCityWalkTrack(linkedJourneyId, phase === 'preview');

  // 从地图选点页返回时接收起点（一次性）
  useFocusEffect(
    useCallback(() => {
      void consumePickedOrigin();
    }, [consumePickedOrigin]),
  );

  // 进入预览时请求一次前台定位权限，让地图能显示实时位置蓝点
  const requestedPreviewLocationRef = useRef(false);
  useEffect(() => {
    if (phase !== 'preview' || Platform.OS === 'web' || requestedPreviewLocationRef.current) {
      return;
    }
    requestedPreviewLocationRef.current = true;
    void (async () => {
      try {
        await ExpoGaodeMapModule.requestLocationPermission();
      } catch (caught) {
        void logLocalError('CityWalkScreen', 'failed to request preview location', caught);
      }
    })();
  }, [phase]);

  // 从旅程页「查看完整方案」进入时，直接打开对应方案
  const openedPlanIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!planId || openedPlanIdRef.current === planId) {
      return;
    }
    const saved = savedPlans.find((item) => item.id === planId);
    if (!saved) {
      return;
    }
    openedPlanIdRef.current = planId;
    openSavedPlan(saved);
  }, [openSavedPlan, planId, savedPlans]);

  /** 打开全屏地图：全屏页没有 ScrollView / 分页，可以自由拖动和缩放 */
  const openWalkMap = useCallback(() => {
    if (!plan) {
      return;
    }
    setPendingWalkMapPlan(plan);
    router.push('/walk-map');
  }, [plan, router]);

  async function handleLocate() {
    const info = await locateCurrentOrigin();
    if (!info) {
      return;
    }
    Alert.alert(t('cityWalk.locationErrorTitle'), t(getCityWalkErrorI18nKey(info.code)));
  }

  function handleOpenMapPicker() {
    if (Platform.OS !== 'android') {
      Alert.alert(t('cityWalk.mapUnsupportedTitle'), t('cityWalk.mapUnsupportedBody'));
      return;
    }
    void logLocalInfo('CityWalkScreen', 'open map picker for origin');
    router.push({
      pathname: '/location-picker',
      params: {
        target: 'city-walk',
        initialSys: 'gcj02',
        ...(origin
          ? {
              initial: JSON.stringify({
                latitude: origin.latitude,
                longitude: origin.longitude,
                placeName: origin.label,
              }),
            }
          : {}),
      },
    });
  }

  function handleSelectPlace(place: NearbyPlace) {
    pickPlaceAsOrigin(place);
    search.reset();
  }

  /** AI 未配置时直接带去设置页，避免用户在本页反复重试 */
  function handleOpenSettings() {
    router.push('/settings');
  }

  function handleGenerate() {
    if (!origin) {
      Alert.alert(t('cityWalk.originRequiredTitle'), t('cityWalk.originRequiredBody'));
      return;
    }
    if (preferences.interests.length === 0) {
      Alert.alert(t('cityWalk.interestRequiredTitle'), t('cityWalk.interestRequiredBody'));
      return;
    }
    void generate();
  }

  async function handleSave() {
    const ok = await savePlan();
    Alert.alert(
      ok ? t('cityWalk.saveSuccessTitle') : t('cityWalk.saveFailedTitle'),
      ok ? t('cityWalk.saveSuccessBody') : t('cityWalk.saveFailedBody'),
    );
  }

  /**
   * 「开始漫步」后自动开启持续定位，让预览页能显示实时位置和已走轨迹。
   * 前台权限被拒绝时静默跳过；后台权限被拒绝时降级为仅前台记录。
   */
  async function ensureWalkTracking(journeyId: string) {
    if (Platform.OS === 'web') {
      return;
    }
    try {
      const foreground = await ExpoGaodeMapModule.requestLocationPermission();
      if (!foreground.granted) {
        return;
      }
      const background = await ExpoGaodeMapModule.requestBackgroundLocationPermission();
      await startLocationTracking(journeyId, {
        notificationTitle: t('cityWalk.trackingNotificationTitle'),
        notificationBody: t('cityWalk.trackingNotificationBody'),
        allowBackground: background.granted,
      });
    } catch (caught) {
      void logLocalError('CityWalkScreen', 'failed to start walk tracking', caught);
    }
  }

  async function handleStartWalk() {
    try {
      const journeyId = await startWalk();
      if (!journeyId) {
        return;
      }
      await ensureWalkTracking(journeyId);
      // 开始漫步后直接回到旅程记录页：路线地图、实时位置与已走轨迹都在那里
      router.back();
    } catch (caught) {
      const info = toCityWalkErrorInfo(caught);
      Alert.alert(t('cityWalk.errorTitle'), t(getCityWalkErrorI18nKey(info.code)));
    }
  }

  function handleDeleteSavedPlan(planId: string) {
    Alert.alert(t('cityWalk.deleteConfirmTitle'), t('cityWalk.deleteConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          void deleteSavedPlan(planId);
        },
      },
    ]);
  }

  const showStatus = phase === 'generating' || phase === 'error';

  return (
    <View style={[styles.page, { backgroundColor: theme.page }]}>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.header}>
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.surface, borderColor: theme.line }]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('cityWalk.back')}
          >
            <MaterialIcons name="arrow-back" size={21} color={theme.text} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.pageTitle, { color: theme.text }]}>
              {t('cityWalk.screenTitle')}
            </Text>
          </View>
          <Text style={[styles.headerMark, { color: theme.muted }]}>CITY WALK / 01</Text>
        </View>

        {showStatus ? (
          <CityWalkStatusCard
            stage={stage}
            legProgress={legProgress}
            error={phase === 'error' ? error : null}
            onCancel={cancelGeneration}
            onRetry={() => void retry()}
            onBackToConfig={backToConfig}
            onOpenSettings={handleOpenSettings}
          />
        ) : null}

        {phase === 'config' ? (
          <CityWalkConfigCard
            origin={origin}
            preferences={preferences}
            locating={locating}
            search={search}
            onLocate={() => void handleLocate()}
            onOpenMapPicker={handleOpenMapPicker}
            onSelectPlace={handleSelectPlace}
            onClearOrigin={clearOrigin}
            onDurationChange={setDuration}
            onToggleInterest={toggleInterest}
            onPaceChange={setPace}
            onRouteShapeChange={setRouteShape}
            onGenerate={handleGenerate}
          />
        ) : null}

        {phase === 'preview' && plan ? (
          <CityWalkPlanView
            plan={plan}
            busy={busy}
            isSaved={isSaved}
            onOpenMap={openWalkMap}
            onRemoveStop={(poiId) => void removeStop(poiId)}
            walkedTrack={walkedTrack}
            onAdjustPreferences={backToConfig}
            onSave={() => void handleSave()}
            onStartWalk={() => void handleStartWalk()}
          />
        ) : null}

        <CityWalkSavedList
          plans={savedPlans}
          currentPlanId={plan?.id}
          onOpen={openSavedPlan}
          onDelete={handleDeleteSavedPlan}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerMark: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
