import { Journey, JourneyKind, TimelineEntry, TimelineLocation } from '@/types/journey';
import { loadJourneys, saveJourneys } from '@/lib/journey-storage';
import { logLocalError } from '@/lib/local-log';
import { deleteMediaFiles, diffManagedMediaUris } from '@/lib/media-storage';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 数据备份导入是直写 AsyncStorage,不走这里;那部分遗留孤儿由设置页清理兜底。 */
function cleanupRemovedMedia(before: Journey[], after: Journey[]) {
  const removed = diffManagedMediaUris(before, after);
  if (removed.length === 0) {
    return;
  }
  void deleteMediaFiles(removed).catch((error) => {
    void logLocalError('media-cleanup', error, { count: removed.length });
  });
}

let writeQueue = Promise.resolve<Journey[] | void>(undefined);

async function enqueueJourneyMutation(
  mutator: (journeys: Journey[]) => Journey[],
): Promise<Journey[]> {
  const run = async () => {
    const current = await loadJourneys();
    const next = mutator(current);
    await saveJourneys(next);
    return next;
  };

  const nextRun = writeQueue.then(run, run);
  writeQueue = nextRun.then(
    () => undefined,
    () => undefined,
  );
  return nextRun;
}

export async function createJourney(title: string, kind: JourneyKind, tags: string[]) {
  const now = new Date().toISOString();
  return enqueueJourneyMutation((journeys) => [
    {
      id: createId('journey'),
      title,
      kind,
      createdAt: now,
      status: 'active',
      tags,
      entries: [],
      trackLocations: [],
    },
    ...journeys,
  ]);
}

export async function markJourneyCompleted(journeyId: string) {
  return enqueueJourneyMutation((journeys) =>
    journeys.map((item) =>
      item.id === journeyId
        ? { ...item, status: 'completed' as const, endedAt: new Date().toISOString() }
        : item,
    ),
  );
}

export async function insertJourneyEntry(journeyId: string, entry: TimelineEntry) {
  return enqueueJourneyMutation((journeys) =>
    journeys.map((item) =>
      item.id === journeyId ? { ...item, entries: [...item.entries, entry] } : item,
    ),
  );
}

export async function replaceJourneyEntry(journeyId: string, entry: TimelineEntry) {
  return enqueueJourneyMutation((journeys) => {
    const next = journeys.map((item) =>
      item.id === journeyId
        ? {
            ...item,
            entries: item.entries.map((existing) => (existing.id === entry.id ? entry : existing)),
          }
        : item,
    );
    cleanupRemovedMedia(journeys, next);
    return next;
  });
}

export async function deleteJourneyEntry(journeyId: string, entryId: string) {
  return enqueueJourneyMutation((journeys) => {
    const next = journeys.map((item) =>
      item.id === journeyId
        ? {
            ...item,
            entries: item.entries.filter((entry) => entry.id !== entryId),
          }
        : item,
    );
    cleanupRemovedMedia(journeys, next);
    return next;
  });
}

export async function appendJourneyTrackLocations(
  journeyId: string,
  locations: TimelineLocation[],
) {
  if (locations.length === 0) {
    return loadJourneys();
  }

  return enqueueJourneyMutation((journeys) =>
    journeys.map((item) =>
      item.id === journeyId
        ? {
            ...item,
            trackLocations: [...item.trackLocations, ...locations],
          }
        : item,
    ),
  );
}

export async function overwriteJourneys(journeys: Journey[]) {
  return enqueueJourneyMutation((current) => {
    cleanupRemovedMedia(current, journeys);
    return journeys;
  });
}

export async function deleteJourney(journeyId: string) {
  return enqueueJourneyMutation((journeys) => {
    const next = journeys.filter((journey) => journey.id !== journeyId);
    cleanupRemovedMedia(journeys, next);
    return next;
  });
}
