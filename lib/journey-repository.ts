import { Journey, JourneyKind, TimelineEntry, TimelineLocation } from '@/types/journey';
import { loadJourneys, saveJourneys } from '@/lib/journey-storage';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

let writeQueue = Promise.resolve<Journey[] | void>(undefined);

async function enqueueJourneyMutation(
  mutator: (journeys: Journey[]) => Journey[]
): Promise<Journey[]> {
  const run = async () => {
    const current = await loadJourneys();
    const next = mutator(current);
    await saveJourneys(next);
    return next;
  };

  const nextRun = writeQueue.then(run, run);
  writeQueue = nextRun.then(() => undefined, () => undefined);
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
        : item
    )
  );
}

export async function insertJourneyEntry(journeyId: string, entry: TimelineEntry) {
  return enqueueJourneyMutation((journeys) =>
    journeys.map((item) =>
      item.id === journeyId
        ? { ...item, entries: [...item.entries, entry] }
        : item
    )
  );
}

export async function replaceJourneyEntry(journeyId: string, entry: TimelineEntry) {
  return enqueueJourneyMutation((journeys) =>
    journeys.map((item) =>
      item.id === journeyId
        ? {
            ...item,
            entries: item.entries.map((existing) =>
              existing.id === entry.id ? entry : existing
            ),
          }
        : item
    )
  );
}

export async function deleteJourneyEntry(journeyId: string, entryId: string) {
  return enqueueJourneyMutation((journeys) =>
    journeys.map((item) =>
      item.id === journeyId
        ? {
            ...item,
            entries: item.entries.filter((entry) => entry.id !== entryId),
          }
        : item
    )
  );
}

export async function appendJourneyTrackLocations(
  journeyId: string,
  locations: TimelineLocation[]
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
        : item
    )
  );
}

export async function overwriteJourneys(journeys: Journey[]) {
  return enqueueJourneyMutation(() => journeys);
}

export async function deleteJourney(journeyId: string) {
  return enqueueJourneyMutation((journeys) =>
    journeys.filter((journey) => journey.id !== journeyId)
  );
}
