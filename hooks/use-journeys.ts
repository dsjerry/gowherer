import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createJourney,
  deleteJourneyEntry,
  insertJourneyEntry,
  markJourneyCompleted,
  overwriteJourneys,
  replaceJourneyEntry,
} from '@/lib/journey-repository';
import { loadJourneys } from '@/lib/journey-storage';
import { initLocalLogFile, logLocalError } from '@/lib/local-log';
import { Journey, JourneyKind, TimelineEntry } from '@/types/journey';

export function useJourneys() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      await initLocalLogFile();
      try {
        const stored = await loadJourneys();
        if (!active) return;
        setJourneys(stored);
        setLoadError(false);
      } catch (error) {
        if (!active) return;
        void logLocalError('journeys-load', error);
        setLoadError(true);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const updateJourneys = useCallback(async (next: Journey[]) => {
    const stored = await overwriteJourneys(next);
    setJourneys(stored);
  }, []);

  const addJourney = useCallback(async (title: string, kind: JourneyKind, tags: string[]) => {
    const next = await createJourney(title, kind, tags);
    setJourneys(next);
  }, []);

  const completeJourney = useCallback(async (journeyId: string) => {
    const next = await markJourneyCompleted(journeyId);
    setJourneys(next);
  }, []);

  const addEntry = useCallback(async (journeyId: string, entry: TimelineEntry) => {
    const next = await insertJourneyEntry(journeyId, entry);
    setJourneys(next);
  }, []);

  const updateEntry = useCallback(async (journeyId: string, entry: TimelineEntry) => {
    const next = await replaceJourneyEntry(journeyId, entry);
    setJourneys(next);
  }, []);

  const removeEntry = useCallback(async (journeyId: string, entryId: string) => {
    const next = await deleteJourneyEntry(journeyId, entryId);
    setJourneys(next);
  }, []);

  /**
   * 重新从存储读取旅程。
   * 引用必须稳定：页面用 useFocusEffect 在回到前台时调用它，否则每次渲染都会
   * 触发 effect → setJourneys → 再渲染的循环。
   */
  const refreshJourneys = useCallback(async () => {
    try {
      const stored = await loadJourneys();
      setJourneys(stored);
      setLoadError(false);
    } catch (error) {
      void logLocalError('journeys-refresh', error);
      setLoadError(true);
    }
  }, []);

  const retryLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const stored = await loadJourneys();
      setJourneys(stored);
    } catch (error) {
      void logLocalError('journeys-load-retry', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const activeJourney = useMemo(
    () => journeys.find((item) => item.status === 'active'),
    [journeys],
  );

  const completedJourneysCount = useMemo(
    () => journeys.filter((item) => item.status === 'completed').length,
    [journeys],
  );

  return {
    journeys,
    setJourneys,
    loading,
    loadError,
    retryLoad,
    updateJourneys,
    addJourney,
    completeJourney,
    addEntry,
    updateEntry,
    removeEntry,
    refreshJourneys,
    activeJourney,
    completedJourneysCount,
  };
}
