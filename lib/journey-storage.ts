import { Journey } from '@/types/journey';
import { fetchJourneys } from '@/lib/api-client';

export async function loadJourneys(): Promise<Journey[]> {
  try {
    return await fetchJourneys();
  } catch {
    return [];
  }
}

// saveJourneys is no longer needed in API mode — each mutation is an individual API call.
// Kept as a no-op for backward compatibility.
export async function saveJourneys(_journeys: Journey[]): Promise<void> {
  // no-op
}
