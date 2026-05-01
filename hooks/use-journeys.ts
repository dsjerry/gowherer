import { useEffect, useMemo, useState } from 'react';

import { loadJourneys, saveJourneys } from '@/lib/journey-storage';
import { initLocalLogFile } from '@/lib/local-log';
import { Journey, JourneyKind, TimelineEntry } from '@/types/journey';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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
    setJourneys(next);
    await saveJourneys(next);
  }

  async function addJourney(title: string, kind: JourneyKind, tags: string[]) {
    const now = new Date().toISOString();
    const next: Journey = {
      id: createId('journey'),
      title,
      kind,
      createdAt: now,
      status: 'active',
      tags,
      entries: [],
      trackLocations: [],
    };
    await updateJourneys([next, ...journeys]);
  }

  async function completeJourney(journeyId: string) {
    const next = journeys.map((item) =>
      item.id === journeyId
        ? { ...item, status: 'completed' as const, endedAt: new Date().toISOString() }
        : item
    );
    await updateJourneys(next);
  }

  async function addEntry(journeyId: string, entry: TimelineEntry) {
    const next = journeys.map((item) =>
      item.id === journeyId
        ? { ...item, entries: [...item.entries, entry] }
        : item
    );
    await updateJourneys(next);
  }

  async function updateEntry(journeyId: string, entry: TimelineEntry) {
    const next = journeys.map((item) =>
      item.id === journeyId
        ? {
            ...item,
            entries: item.entries.map((e) =>
              e.id === entry.id ? entry : e
            ),
          }
        : item
    );
    await updateJourneys(next);
  }

  async function removeEntry(journeyId: string, entryId: string) {
    const next = journeys.map((item) =>
      item.id === journeyId
        ? {
            ...item,
            entries: item.entries.filter((e) => e.id !== entryId),
          }
        : item
    );
    await updateJourneys(next);
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
