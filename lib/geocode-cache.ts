import AsyncStorage from '@react-native-async-storage/async-storage';

import { GEOCODE_CACHE_KEY } from '@/lib/storage-keys';

const CACHE_VERSION = 1;
const MAX_ENTRIES = 500;
const FLUSH_DELAY_MS = 2000;

type GeocodeCacheEntry = { n: string; t: number };
type GeocodeCachePayload = {
  v: number;
  entries: Record<string, GeocodeCacheEntry>;
};

const memoryCache = new Map<string, GeocodeCacheEntry>();
let loadPromise: Promise<void> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function pruneToCap() {
  if (memoryCache.size <= MAX_ENTRIES) {
    return;
  }
  const oldest = [...memoryCache.entries()].sort((a, b) => a[1].t - b[1].t);
  for (const [key] of oldest.slice(0, memoryCache.size - MAX_ENTRIES)) {
    memoryCache.delete(key);
  }
}

async function flush() {
  flushTimer = null;
  const payload: GeocodeCachePayload = {
    v: CACHE_VERSION,
    entries: Object.fromEntries(memoryCache),
  };
  try {
    await AsyncStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('[geocode-cache] persist failed', error);
  }
}

function scheduleFlush() {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(() => {
    void flush();
  }, FLUSH_DELAY_MS);
}

export async function loadGeocodeCache() {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(GEOCODE_CACHE_KEY);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw) as GeocodeCachePayload;
        if (parsed?.v !== CACHE_VERSION || !parsed.entries) {
          return;
        }
        for (const [key, entry] of Object.entries(parsed.entries)) {
          if (entry && typeof entry.n === 'string') {
            memoryCache.set(key, { n: entry.n, t: Number(entry.t) || 0 });
          }
        }
        pruneToCap();
      } catch (error) {
        console.warn('[geocode-cache] load failed', error);
      }
    })();
  }
  return loadPromise;
}

/** ~0.001°(约 110m)网格键;调用方传入规范化的 gcj02 坐标。 */
export function buildGeocodeCacheKey(latitude: number, longitude: number) {
  return `g:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
}

export function getCachedPlaceName(key: string) {
  const entry = memoryCache.get(key);
  if (!entry) {
    return undefined;
  }
  entry.t = Date.now();
  return entry.n;
}

export function setCachedPlaceName(key: string, placeName: string) {
  memoryCache.set(key, { n: placeName, t: Date.now() });
  pruneToCap();
  scheduleFlush();
}
