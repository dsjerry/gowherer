import AsyncStorage from "@react-native-async-storage/async-storage";

import { JOURNEY_STORAGE_KEY } from "@/lib/storage-keys";
import { Journey } from "@/types/journey";
import { normalizeTrackLocation } from "@/lib/track-utils";

/** Journeys created on or after this date may have GCJ-02 track points
 *  stored without a coordSystem marker (post Gaode SDK migration). */
const GCJ02_MIGRATION_CUTOFF_MS = Date.parse("2026-07-05T00:00:00+08:00");

function resolveCoordSystem(
  rawCoordSystem: unknown,
  journeyCreatedAt: string | undefined,
): "wgs84" | "gcj02" | undefined {
  if (rawCoordSystem === "wgs84" || rawCoordSystem === "gcj02") {
    return rawCoordSystem;
  }
  // Legacy data without coordSystem: if the journey was created
  // after the Gaode SDK migration, the points are actually GCJ-02.
  if (journeyCreatedAt) {
    const journeyMs = Date.parse(journeyCreatedAt);
    if (Number.isFinite(journeyMs) && journeyMs >= GCJ02_MIGRATION_CUTOFF_MS) {
      return "gcj02";
    }
  }
  return "wgs84";
}

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

  return raw.map((item: any) => {
    const journeyCreatedAt: string | undefined =
      typeof item.createdAt === "string" ? item.createdAt : undefined;

    return {
      ...item,
      kind: item.kind === "commute" ? "commute" : "travel",
      tags: normalizeTags(item.tags),
      entries: Array.isArray(item.entries)
        ? item.entries.map((entry: any) => ({
            ...entry,
            tags: normalizeTags(entry.tags),
            location: (() => {
              const loc = normalizeTrackLocation(entry.location);
              if (!loc) return undefined;
              if (!loc.coordSystem) {
                loc.coordSystem = resolveCoordSystem(
                  (entry.location as any)?.coordSystem,
                  journeyCreatedAt,
                );
              }
              return loc;
            })(),
            media: Array.isArray(entry.media)
              ? entry.media
                  .map((media: any) => normalizeMediaItem(media))
                  .filter(Boolean)
              : [],
          }))
        : [],
      trackLocations: Array.isArray(item.trackLocations)
        ? item.trackLocations
            .map((location: any) => {
              const loc = normalizeTrackLocation(location);
              if (!loc) return null;
              if (!loc.coordSystem) {
                // Use the same date-based inference as entries: journeys created after
                // the Gaode SDK migration are GCJ-02, earlier ones are WGS-84.
                loc.coordSystem = resolveCoordSystem(
                  (location as any)?.coordSystem,
                  journeyCreatedAt,
                );
              }
              return loc;
            })
            .filter(Boolean)
        : [],
    } as Journey;
  });
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
