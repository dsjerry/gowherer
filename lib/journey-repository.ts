import { Journey, JourneyKind, TimelineEntry, TimelineLocation } from '@/types/journey';
import {
  fetchJourneys,
  createJourneyApi,
  completeJourneyApi,
  deleteJourneyApi,
  addEntryApi,
  updateEntryApi,
  deleteEntryApi,
  appendTrackApi,
} from '@/lib/api-client';

export async function createJourney(title: string, kind: JourneyKind, tags: string[]) {
  await createJourneyApi(title, kind, tags);
  return fetchJourneys();
}

export async function markJourneyCompleted(journeyId: string) {
  await completeJourneyApi(journeyId);
  return fetchJourneys();
}

export async function insertJourneyEntry(journeyId: string, entry: TimelineEntry) {
  await addEntryApi(journeyId, entry);
  return fetchJourneys();
}

export async function replaceJourneyEntry(journeyId: string, entry: TimelineEntry) {
  await updateEntryApi(entry.id, entry);
  return fetchJourneys();
}

export async function deleteJourneyEntry(journeyId: string, entryId: string) {
  await deleteEntryApi(entryId);
  return fetchJourneys();
}

export async function appendJourneyTrackLocations(
  journeyId: string,
  locations: TimelineLocation[]
) {
  if (locations.length === 0) {
    return fetchJourneys();
  }
  await appendTrackApi(journeyId, locations);
  return fetchJourneys();
}

export async function overwriteJourneys(journeys: Journey[]) {
  // In API mode, this is a no-op since each mutation is an API call.
  // Just return the current server state.
  return fetchJourneys();
}

export async function deleteJourney(journeyId: string) {
  await deleteJourneyApi(journeyId);
  return fetchJourneys();
}
