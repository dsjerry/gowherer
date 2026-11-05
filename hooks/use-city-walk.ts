import { useCallback, useEffect, useRef, useState } from 'react';

import { useI18n } from '@/hooks/locale-preference';
import { isAiConfigured, loadAiSettings } from '@/lib/ai-settings';
import { CityWalkError, toCityWalkErrorInfo } from '@/lib/city-walk-error';
import { generateCityWalkPlan, recalculateCityWalkPlan } from '@/lib/city-walk-planner';
import { deleteCityWalkPlan, loadCityWalkPlans, saveCityWalkPlan } from '@/lib/city-walk-storage';
import {
  getBestCurrentTimelineLocation,
  requestForegroundLocationAccess,
} from '@/lib/current-location';
import { logLocalError, logLocalInfo } from '@/lib/local-log';
import { consumePendingLocation } from '@/lib/pending-location';
import { NearbyPlace, reverseGeocodePlaceName, searchPlaces, toGcj02 } from '@/lib/reverse-geocode';
import { createJourney } from '@/lib/journey-repository';
import { loadJourneys } from '@/lib/journey-storage';
import {
  CITY_WALK_INTERESTS,
  CityWalkBusyKind,
  CityWalkErrorInfo,
  CityWalkGenerationStage,
  CityWalkInterest,
  CityWalkPace,
  CityWalkPlan,
  CityWalkPreferences,
  CityWalkRouteShape,
  CityWalkStop,
} from '@/types/city-walk';

/** 一次生成的兜底超时：候选 + 模型 + 逐段路线都应在这之内完成 */
const GENERATION_TIMEOUT_MS = 150000;

export type CityWalkPhase = 'config' | 'generating' | 'preview' | 'error';

type CityWalkLegProgress = { completed: number; total: number };

const DEFAULT_PREFERENCES: CityWalkPreferences = {
  durationMinutes: 90,
  interests: ['architecture', 'cafe', 'park'],
  pace: 'normal',
  routeShape: 'loop',
  maxStops: 5,
  radiusMeters: 2500,
};

/** 搜索半径随可用时长与节奏粗调，避免 45 分钟却给出 5 公里外的候选 */
function deriveRadiusMeters(durationMinutes: number, pace: CityWalkPace) {
  const base = pace === 'brisk' ? 3200 : pace === 'relaxed' ? 1800 : 2500;
  const scale = Math.min(1.6, Math.max(0.6, durationMinutes / 90));
  return Math.round(Math.min(5000, Math.max(800, base * scale)));
}

function toGcj02Origin(location: {
  latitude: number;
  longitude: number;
  coordSystem?: 'wgs84' | 'gcj02';
}) {
  if (location.coordSystem === 'gcj02') {
    return { latitude: location.latitude, longitude: location.longitude };
  }
  return toGcj02(location.latitude, location.longitude);
}

export function useCityWalk() {
  const { t, locale } = useI18n();

  const [phase, setPhase] = useState<CityWalkPhase>('config');
  const [stage, setStage] = useState<CityWalkGenerationStage | null>(null);
  const [legProgress, setLegProgress] = useState<CityWalkLegProgress | null>(null);
  const [preferences, setPreferences] = useState<CityWalkPreferences>(DEFAULT_PREFERENCES);
  const [origin, setOrigin] = useState<CityWalkPlan['origin'] | null>(null);
  const [plan, setPlan] = useState<CityWalkPlan | null>(null);
  const [error, setError] = useState<CityWalkErrorInfo | null>(null);
  const [busy, setBusy] = useState<CityWalkBusyKind>(null);
  const [savedPlans, setSavedPlans] = useState<CityWalkPlan[]>([]);
  const [locating, setLocating] = useState(false);
  const [linkedJourneyId, setLinkedJourneyId] = useState<string | undefined>();

  const activeRef = useRef(true);
  const generationRunRef = useRef(0);
  const generationAbortRef = useRef<AbortController | null>(null);
  const recalculationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      generationAbortRef.current?.abort();
      recalculationAbortRef.current?.abort();
    };
  }, []);

  // ---- 已保存方案 ---------------------------------------------------------

  const refreshSavedPlans = useCallback(async () => {
    const plans = await loadCityWalkPlans();
    if (activeRef.current) {
      setSavedPlans(plans);
    }
    return plans;
  }, []);

  useEffect(() => {
    void refreshSavedPlans();
  }, [refreshSavedPlans]);

  // ---- 偏好 --------------------------------------------------------------

  const toggleInterest = useCallback((interest: CityWalkInterest) => {
    setPreferences((prev) => {
      const selected = prev.interests.includes(interest)
        ? prev.interests.filter((item) => item !== interest)
        : [...prev.interests, interest].sort(
            (a, b) => CITY_WALK_INTERESTS.indexOf(a) - CITY_WALK_INTERESTS.indexOf(b),
          );
      return { ...prev, interests: selected };
    });
  }, []);

  const setDuration = useCallback((durationMinutes: number) => {
    setPreferences((prev) => ({ ...prev, durationMinutes }));
  }, []);

  const setPace = useCallback((pace: CityWalkPace) => {
    setPreferences((prev) => ({ ...prev, pace }));
  }, []);

  const setRouteShape = useCallback((routeShape: CityWalkRouteShape) => {
    setPreferences((prev) => ({ ...prev, routeShape }));
  }, []);

  // ---- 起点 --------------------------------------------------------------

  const locateCurrentOrigin = useCallback(async () => {
    setLocating(true);
    try {
      const granted = await requestForegroundLocationAccess();
      if (!granted) {
        throw new CityWalkError('location-denied');
      }
      const location = await getBestCurrentTimelineLocation({ source: 'manual' });
      if (!location) {
        throw new CityWalkError('location-failed');
      }
      const gcj02 = toGcj02Origin(location);
      if (!activeRef.current) {
        return null;
      }
      setOrigin({
        ...gcj02,
        coordinateSystem: 'gcj02',
        label: location.placeName,
      });
      setError(null);

      // 补一个可读的起点名（失败不影响规划）
      void (async () => {
        try {
          const name = await reverseGeocodePlaceName(gcj02.latitude, gcj02.longitude, {
            coordinateType: 'gcj02',
          });
          if (activeRef.current && name) {
            setOrigin((prev) => (prev && !prev.label ? { ...prev, label: name } : prev));
          }
        } catch {
          // ignore: 起点名只是展示信息
        }
      })();
      return null;
    } catch (error) {
      void logLocalError('city-walk', error, { stage: 'locate-origin' });
      return toCityWalkErrorInfo(error);
    } finally {
      if (activeRef.current) {
        setLocating(false);
      }
    }
  }, []);

  const pickPlaceAsOrigin = useCallback((place: NearbyPlace) => {
    setOrigin({
      latitude: place.latitude,
      longitude: place.longitude,
      coordinateSystem: 'gcj02',
      label: place.name,
    });
    setError(null);
  }, []);

  const clearOrigin = useCallback(() => {
    setOrigin(null);
  }, []);

  /** 地图选点页返回的起点（WGS-84 -> GCJ-02） */
  const consumePickedOrigin = useCallback(async () => {
    const picked = await consumePendingLocation('city-walk');
    if (!picked || !activeRef.current) {
      return false;
    }
    const gcj02 = toGcj02Origin(picked);
    setOrigin({
      ...gcj02,
      coordinateSystem: 'gcj02',
      label: picked.placeName,
    });
    setError(null);
    return true;
  }, []);

  const searchOriginPlaces = useCallback(
    async (keyword: string) => {
      const trimmed = keyword.trim();
      if (!trimmed) {
        return [];
      }
      try {
        return await searchPlaces(trimmed, {
          near: origin ? { latitude: origin.latitude, longitude: origin.longitude } : undefined,
          coordinateType: 'gcj02',
        });
      } catch (error) {
        void logLocalError('city-walk', error, { stage: 'search-origin' });
        throw error;
      }
    },
    [origin],
  );

  // ---- 生成 --------------------------------------------------------------

  const cancelGeneration = useCallback(() => {
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    generationRunRef.current += 1;
    setStage(null);
    setLegProgress(null);
    setError(null);
    setPhase('config');
  }, []);

  const runGeneration = useCallback(
    async (targetOrigin: CityWalkPlan['origin'], targetPreferences: CityWalkPreferences) => {
      const runId = generationRunRef.current + 1;
      generationRunRef.current = runId;
      generationAbortRef.current?.abort();
      const controller = new AbortController();
      generationAbortRef.current = controller;
      const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

      setPhase('generating');
      setError(null);
      setPlan(null);
      setLinkedJourneyId(undefined);
      setStage('candidates');
      setLegProgress(null);

      try {
        const settings = await loadAiSettings();
        if (!isAiConfigured(settings)) {
          throw new CityWalkError('ai-not-configured');
        }
        const radiusMeters = deriveRadiusMeters(
          targetPreferences.durationMinutes,
          targetPreferences.pace,
        );
        const nextPlan = await generateCityWalkPlan({
          origin: targetOrigin,
          preferences: { ...targetPreferences, radiusMeters },
          settings,
          locale,
          signal: controller.signal,
          onStage: (nextStage) => {
            if (activeRef.current && generationRunRef.current === runId) {
              setStage(nextStage);
            }
          },
          onLegComputed: (completed, total) => {
            if (activeRef.current && generationRunRef.current === runId) {
              setLegProgress({ completed, total });
            }
          },
        });
        if (!activeRef.current || generationRunRef.current !== runId) {
          return;
        }
        setPlan({
          ...nextPlan,
          title: nextPlan.title || t('cityWalk.defaultPlanTitle', { count: nextPlan.stops.length }),
        });
        setStage(null);
        setLegProgress(null);
        setPhase('preview');
        void logLocalInfo('city-walk', 'plan generated', {
          stops: nextPlan.stops.length,
          legs: nextPlan.legs.length,
          distanceMeters: nextPlan.totalDistanceMeters,
          walkingSeconds: nextPlan.walkingDurationSeconds,
        });
      } catch (caught) {
        if (generationRunRef.current !== runId) {
          return;
        }
        const info =
          controller.signal.aborted && !(caught instanceof CityWalkError)
            ? ({ code: 'timeout' } satisfies CityWalkErrorInfo)
            : toCityWalkErrorInfo(caught);
        if (info.code === 'cancelled') {
          if (activeRef.current) {
            setPhase('config');
            setStage(null);
          }
          return;
        }
        void logLocalError('city-walk', caught, { stage: 'generate' });
        if (activeRef.current) {
          setError(info);
          setStage(null);
          setLegProgress(null);
          setPhase('error');
        }
      } finally {
        clearTimeout(timeout);
        if (generationAbortRef.current === controller) {
          generationAbortRef.current = null;
        }
      }
    },
    [locale, t],
  );

  const generate = useCallback(async () => {
    if (!origin) {
      return false;
    }
    if (preferences.interests.length === 0) {
      return false;
    }
    await runGeneration(origin, preferences);
    return true;
  }, [origin, preferences, runGeneration]);

  const retry = useCallback(async () => {
    if (!origin) {
      setPhase('config');
      return;
    }
    await runGeneration(origin, preferences);
  }, [origin, preferences, runGeneration]);

  const backToConfig = useCallback(() => {
    generationAbortRef.current?.abort();
    setPhase('config');
    setError(null);
    setStage(null);
    setLegProgress(null);
  }, []);

  // ---- 预览期操作 ---------------------------------------------------------

  const removeStop = useCallback(
    async (poiId: string) => {
      if (!plan || busy) {
        return;
      }
      const remaining: CityWalkStop[] = plan.stops
        .filter((stop) => stop.poi.poiId !== poiId)
        .map((stop, index) => ({ ...stop, order: index + 1 }));

      if (remaining.length === 0) {
        setPlan(null);
        setPhase('config');
        return;
      }

      const controller = new AbortController();
      recalculationAbortRef.current?.abort();
      recalculationAbortRef.current = controller;
      setBusy('recalculating');
      try {
        const nextPlan = await recalculateCityWalkPlan(plan, remaining, {
          signal: controller.signal,
        });
        if (!activeRef.current) {
          return;
        }
        setPlan(nextPlan);
      } catch (caught) {
        void logLocalError('city-walk', caught, { stage: 'remove-stop' });
        if (activeRef.current) {
          setError(toCityWalkErrorInfo(caught));
          setPhase('error');
        }
      } finally {
        if (activeRef.current) {
          setBusy(null);
        }
        if (recalculationAbortRef.current === controller) {
          recalculationAbortRef.current = null;
        }
      }
    },
    [busy, plan],
  );

  const savePlan = useCallback(async () => {
    if (!plan) {
      return false;
    }
    setBusy('saving');
    try {
      const stored = await saveCityWalkPlan({
        ...plan,
        linkedJourneyId: plan.linkedJourneyId ?? linkedJourneyId,
      });
      if (activeRef.current) {
        setSavedPlans(stored);
      }
      return true;
    } catch (caught) {
      void logLocalError('city-walk', caught, { stage: 'save-plan' });
      return false;
    } finally {
      if (activeRef.current) {
        setBusy(null);
      }
    }
  }, [plan, linkedJourneyId]);

  const startWalk = useCallback(async () => {
    if (!plan) {
      throw new CityWalkError('unknown', 'no plan');
    }
    setBusy('starting');
    try {
      const journeys = await loadJourneys();
      if (journeys.some((journey) => journey.status === 'active')) {
        throw new CityWalkError('active-journey');
      }
      const title = plan.title || t('cityWalk.defaultPlanTitle', { count: plan.stops.length });
      const tags = [
        t('cityWalk.entryTitle'),
        ...plan.preferences.interests.map((interest) => t(`cityWalk.interest.${interest}`)),
      ];
      const nextJourneys = await createJourney(title, 'travel', Array.from(new Set(tags)));
      const created = nextJourneys[0];
      if (!created) {
        throw new CityWalkError('unknown', 'journey not created');
      }
      const savedPlan: CityWalkPlan = {
        ...plan,
        title,
        linkedJourneyId: created.id,
      };
      const stored = await saveCityWalkPlan(savedPlan);
      if (activeRef.current) {
        setPlan(savedPlan);
        setLinkedJourneyId(created.id);
        setSavedPlans(stored);
      }
      void logLocalInfo('city-walk', 'walk started', {
        planId: plan.id,
        journeyId: created.id,
      });
      return created.id;
    } finally {
      if (activeRef.current) {
        setBusy(null);
      }
    }
  }, [plan, t]);

  const openSavedPlan = useCallback((saved: CityWalkPlan) => {
    generationAbortRef.current?.abort();
    setPlan(saved);
    setOrigin(saved.origin);
    setPreferences(saved.preferences);
    setLinkedJourneyId(saved.linkedJourneyId);
    setError(null);
    setPhase('preview');
  }, []);

  const deleteSavedPlan = useCallback(
    async (planId: string) => {
      const stored = await deleteCityWalkPlan(planId);
      if (activeRef.current) {
        setSavedPlans(stored);
        if (plan?.id === planId) {
          setPlan(null);
          setPhase('config');
        }
      }
    },
    [plan?.id],
  );

  const isSaved = Boolean(plan && savedPlans.some((item) => item.id === plan.id));

  return {
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
    searchOriginPlaces,
    generate,
    retry,
    cancelGeneration,
    backToConfig,
    removeStop,
    savePlan,
    startWalk,
    openSavedPlan,
    deleteSavedPlan,
  };
}
