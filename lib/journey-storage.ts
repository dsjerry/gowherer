import AsyncStorage from "@react-native-async-storage/async-storage";

import { JOURNEY_STORAGE_KEY } from "@/lib/storage-keys";
import { Journey } from "@/types/journey";

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter(Boolean)
    )
  );
}

function normalizeMediaItem(media: unknown) {
  if (!media || typeof media !== "object") {
    return null;
  }

  const item = media as {
    id?: unknown;
    type?: unknown;
    uri?: unknown;
    thumbnailUri?: unknown;
  };
  if (typeof item.id !== "string" || typeof item.uri !== "string") {
    return null;
  }

  return {
    ...item,
    type:
      item.type === "video"
        ? "video"
        : item.type === "audio"
        ? "audio"
        : "photo",
    thumbnailUri:
      typeof item.thumbnailUri === "string" && item.thumbnailUri.trim()
        ? item.thumbnailUri
        : undefined,
  };
}

export function normalizeJourneyList(raw: unknown): Journey[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => ({
    ...item,
    kind: item.kind === "commute" ? "commute" : "travel",
    tags: normalizeTags(item.tags),
    entries: Array.isArray(item.entries)
      ? item.entries.map((entry) => ({
          ...entry,
          tags: normalizeTags(entry.tags),
          media: Array.isArray(entry.media)
            ? entry.media
                .map((media) => normalizeMediaItem(media))
                .filter(Boolean)
            : [],
        }))
      : [],
    trackLocations: Array.isArray(item.trackLocations)
      ? item.trackLocations
      : [],
  })) as Journey[];
}

export async function loadJourneys(): Promise<Journey[]> {
  const raw = await AsyncStorage.getItem(JOURNEY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeJourneyList(parsed);
  } catch {
    return [];
  }
}

export async function saveJourneys(journeys: Journey[]): Promise<void> {
  await AsyncStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(journeys));
}
