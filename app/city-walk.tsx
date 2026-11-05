import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityWalkConfigCard } from '@/components/city-walk-config-card';
import { CityWalkPlanView } from '@/components/city-walk-plan-view';
import { CityWalkSavedList } from '@/components/city-walk-saved-list';
import { CityWalkStatusCard } from '@/components/city-walk-status-card';
import { getCityWalkTheme } from '@/components/city-walk-theme';
import { useCityWalk } from '@/hooks/use-city-walk';
import { useI18n } from '@/hooks/locale-preference';
import { usePlaceSearch } from '@/hooks/use-place-search';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCityWalkErrorI18nKey, toCityWalkErrorInfo } from '@/lib/city-walk-error';
import { logLocalInfo } from '@/lib/local-log';
import { NearbyPlace } from '@/lib/reverse-geocode';

export default function CityWalkScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useI18n();
  const isDark = useColorScheme() === 'dark';
  const cityWalk = useCityWalk();
  const search = usePlaceSearch(cityWalk.searchOriginPlaces);
  // 地图放大时禁用页面滚动，否则拖动地图会把页面一起带走
  const [mapEnlarged, setMapEnlarged] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const expandedMapHeight = Math.max(300, Math.round(windowHeight * 0.5));

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

  // 从地图选点页返回时接收起点（一次性）
  useFocusEffect(
    useCallback(() => {
      void consumePickedOrigin();
    }, [consumePickedOrigin]),
  );

  // 离开预览（重新生成 / 返回设置）时恢复页面滚动
  useEffect(() => {
    if (phase !== 'preview') {
      setMapEnlarged(false);
    }
  }, [phase]);

  const handleMapEnlargedChange = useCallback((next: boolean) => {
    setMapEnlarged(next);
    if (next) {
      // 放大后地图可能超出可视区，滚到顶部保证收起按钮可见
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  }, []);

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

  async function handleStartWalk() {
    try {
      const journeyId = await startWalk();
      if (!journeyId) {
        return;
      }
      Alert.alert(t('cityWalk.startSuccessTitle'), t('cityWalk.startSuccessBody'), [
        { text: t('cityWalk.stayHere'), style: 'cancel' },
        { text: t('cityWalk.viewJourney'), onPress: () => router.back() },
      ]);
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
        scrollEnabled={!mapEnlarged}
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
            expandedMapHeight={expandedMapHeight}
            onMapEnlargedChange={handleMapEnlargedChange}
            onRemoveStop={(poiId) => void removeStop(poiId)}
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
