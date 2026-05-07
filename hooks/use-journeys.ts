import { useEffect, useMemo, useState } from 'react';

import {
  createJourney,
  deleteJourneyEntry,
  insertJourneyEntry,
  markJourneyCompleted,
  overwriteJourneys,
  replaceJourneyEntry,
} from '@/lib/journey-repository';
import { loadJourneys } from '@/lib/journey-storage';
import { initLocalLogFile } from '@/lib/local-log';
import { Journey, JourneyKind, TimelineEntry } from '@/types/journey';

export function useJourneys() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      await initLocalLogFile();
      const stored = await loadJourneys();
      if (!active) return;
      setJourneys(stored);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function updateJourneys(next: Journey[]) {
    const stored = await overwriteJourneys(next);
    setJourneys(stored);
  }

  async function addJourney(title: string, kind: JourneyKind, tags: string[]) {
    const next = await createJourney(title, kind, tags);
    setJourneys(next);
  }

  async function completeJourney(journeyId: string) {
    const next = await markJourneyCompleted(journeyId);
    setJourneys(next);
  }

  async function addEntry(journeyId: string, entry: TimelineEntry) {
    const next = await insertJourneyEntry(journeyId, entry);
    setJourneys(next);
  }

  async function updateEntry(journeyId: string, entry: TimelineEntry) {
    const next = await replaceJourneyEntry(journeyId, entry);
    setJourneys(next);
  }

  async function removeEntry(journeyId: string, entryId: string) {
    const next = await deleteJourneyEntry(journeyId, entryId);
    setJourneys(next);
  }

  async function refreshJourneys() {
    const stored = await loadJourneys();
    setJourneys(stored);
  }

  const activeJourney = useMemo(
    () => journeys.find((item) => item.status === 'active'),
    [journeys]
  );

  const completedJourneysCount = useMemo(
    () => journeys.filter((item) => item.status === 'completed').length,
    [journeys]
  );

  return {
    journeys,
    setJourneys,
    loading,
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
