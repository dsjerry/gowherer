import Constants from 'expo-constants';

import { CityWalkError, isAbortError } from '@/lib/city-walk-error';
import { logLocalError } from '@/lib/local-log';
import { getAmapWebKey } from '@/lib/reverse-geocode';
import {
  CITY_WALK_ORIGIN_POI_ID,
  CityWalkCandidate,
  CityWalkCoordinate,
  CityWalkInterest,
  CityWalkLeg,
  CityWalkOrigin,
  CityWalkPreferences,
  CityWalkRouteShape,
} from '@/types/city-walk';

/**
 * City Walk 地图服务适配层。
 *
 * - 默认直连高德 Web 服务（POI 周边搜索 + 步行路径规划），复用现有 `EXPO_PUBLIC_AMAP_WEB_KEY`。
 * - 配置 `EXPO_PUBLIC_CITY_WALK_API_BASE_URL` 后改走后端代理（`docs/CITY_WALK_PLAN.md` 第 6 节的
 *   `POST /v1/city-walk/candidates` 与 `POST /v1/city-walk/routes`），届时高德 Key 只需存在于服务端。
 *
 * 无论哪种模式，AI 只能拿到候选 POI 的 id/名称/类别/距离，坐标与路线几何都来自高德。
 */

const AMAP_HOST = 'https://restapi.amap.com';
const AMAP_TIMEOUT_MS = 12000;
const AMAP_REQUEST_INTERVAL_MS = 1100;
const AMAP_RATE_LIMIT_RETRIES = 2;
/** 自建后端代理的单次请求上限；后端还要再调高德，留出更宽的时间 */
const BACKEND_TIMEOUT_MS = 20000;
const MAX_INTEREST_QUERIES = 4;
const PER_INTEREST_LIMIT = 8;
const MAX_CANDIDATES = 24;
/** 允许候选点比搜索半径再远一点，避免边缘点全部被丢 */
const RADIUS_TOLERANCE = 1.15;

type AmapPoi = {
  id?: string;
  name?: string;
  type?: string;
  address?: string | string[];
  location?: string;
  distance?: string;
};

type AmapPlaceAroundResponse = {
  status?: string;
  info?: string;
  infocode?: string;
  pois?: AmapPoi[];
};

type AmapWalkingStep = {
  polyline?: string;
};

type AmapWalkingPath = {
  distance?: string;
  duration?: string;
  steps?: AmapWalkingStep[];
};

type AmapWalkingResponse = {
  status?: string;
  info?: string;
  infocode?: string;
  route?: {
    paths?: AmapWalkingPath[];
  };
};

type AmapStatus = { status?: string; info?: string; infocode?: string };

let lastAmapRequestAt = 0;
let amapRequestQueue: Promise<void> = Promise.resolve();

function waitForDelay(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new CityWalkError('cancelled'));
  }
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new CityWalkError('cancelled'));
    };
    signal?.addEventListener('abort', onAbort);
  });
}

/** 同一进程内给高德直连请求限速，避免串行请求仍在同一秒内触发 QPS 限制。 */
function waitForAmapSlot(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new CityWalkError('cancelled'));
  }
  const slot = amapRequestQueue.then(async () => {
    await waitForDelay(
      Math.max(0, lastAmapRequestAt + AMAP_REQUEST_INTERVAL_MS - Date.now()),
      signal,
    );
    lastAmapRequestAt = Date.now();
  });
  amapRequestQueue = slot.catch(() => undefined);

  if (!signal) {
    return slot;
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(new CityWalkError('cancelled'));
    };
    signal.addEventListener('abort', onAbort);
    slot.then(
      () => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

/**
 * 兴趣主题 -> 高德 POI 类型码 / 关键词。
 * 类型码优先（稳定、可控），关键词用于没有合适类型码的主题。
 */
const INTEREST_QUERIES: Record<CityWalkInterest, { types?: string; keywords?: string }> = {
  architecture: { keywords: '老建筑|历史建筑|教堂|骑楼|钟楼|故居' },
  cafe: { types: '050500' },
  park: { types: '110101' },
  museum: { types: '140100|140200|140300' },
  food: { types: '050100|050200|050300' },
  shopping: { types: '060100|062100' },
  riverside: { keywords: '滨江|河畔|绿道|江边|湖畔|湿地' },
  history: { keywords: '古迹|遗址|纪念馆|寺|塔' },
};

/** 所有兴趣都没有结果时的兜底搜索：景点 + 展馆 + 商业街 */
const FALLBACK_QUERY = { types: '110000|140000|060100' };

export type CityWalkCandidateSet = {
  requestId: string;
  origin: CityWalkOrigin;
  candidates: CityWalkCandidate[];
  /** poiId -> 候选点，用于把 AI 输出解析回真实坐标 */
  byId: Record<string, CityWalkCandidate>;
};

export type CityWalkLegsResult = {
  legs: CityWalkLeg[];
  totalDistanceMeters: number;
  walkingDurationSeconds: number;
};

function getCityWalkApiBaseUrl() {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    cityWalk?: { apiBaseUrl?: string };
  };
  const raw = extra.cityWalk?.apiBaseUrl ?? process.env.EXPO_PUBLIC_CITY_WALK_API_BASE_URL;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed ? trimmed.replace(/\/+$/, '') : undefined;
}

function createRequestId() {
  return `cwreq_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function parseAmapLocation(value?: string): { latitude: number; longitude: number } | null {
  if (typeof value !== 'string' || !value.includes(',')) {
    return null;
  }
  const [lngText, latText] = value.split(',');
  const longitude = Number(lngText);
  const latitude = Number(latText);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

export function toCityWalkCoordinate(latitude: number, longitude: number): CityWalkCoordinate {
  return { latitude, longitude, coordinateSystem: 'gcj02' };
}

/** 两点球面距离（米），仅用于候选筛选与展示，不用于路线几何 */
export function distanceMetersBetween(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function parseCoordinateSystem(value: unknown): 'gcj02' {
  // 目前只接受 GCJ-02；其他坐标系一律视为无效数据，避免坐标错位。
  if (value !== undefined && value !== 'gcj02') {
    throw new CityWalkError('amap-error', `unsupported coordinateSystem: ${String(value)}`);
  }
  return 'gcj02';
}

function parseAmapCategory(type?: string) {
  if (typeof type !== 'string') {
    return undefined;
  }
  const segments = type
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return undefined;
  }
  return segments[segments.length - 1];
}

function parseAmapAddress(address?: string | string[]) {
  if (typeof address === 'string') {
    return address.trim() || undefined;
  }
  if (Array.isArray(address)) {
    const joined = address
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .join('');
    return joined.trim() || undefined;
  }
  return undefined;
}

async function fetchJson(
  url: string,
  options: { signal?: AbortSignal; timeoutMs: number; init?: RequestInit },
) {
  if (options.signal?.aborted) {
    throw new CityWalkError('cancelled');
  }
  const controller = new AbortController();
  const parentSignal = options.signal;
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener('abort', onParentAbort);
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, { ...options.init, signal: controller.signal });
    if (!response.ok) {
      throw new CityWalkError('network', `HTTP ${response.status}`);
    }
    return (await response.json()) as unknown;
  } catch (error) {
    if (parentSignal?.aborted) {
      throw new CityWalkError('cancelled');
    }
    if (error instanceof CityWalkError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new CityWalkError('timeout', `request exceeded ${options.timeoutMs}ms`);
    }
    throw new CityWalkError('network', error instanceof Error ? error.message : String(error));
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', onParentAbort);
  }
}

async function fetchAmapJson<T extends AmapStatus>(url: string, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    await waitForAmapSlot(signal);
    const payload = (await fetchJson(url, { signal, timeoutMs: AMAP_TIMEOUT_MS })) as T;
    const rateLimited =
      payload.status !== '1' &&
      (String(payload.infocode) === '10021' || payload.info === 'CUQPS_HAS_EXCEEDED_THE_LIMIT');
    if (!rateLimited) {
      return payload;
    }
    if (attempt >= AMAP_RATE_LIMIT_RETRIES) {
      throw new CityWalkError(
        'amap-rate-limited',
        `info=${payload.info ?? 'N/A'} infocode=${payload.infocode ?? 'N/A'}`,
      );
    }
    await waitForDelay(1000 * 2 ** attempt, signal);
  }
}

function buildAmapAroundUrl(params: {
  key: string;
  origin: CityWalkOrigin;
  radiusMeters: number;
  query: { types?: string; keywords?: string };
}) {
  const location = `${params.origin.longitude},${params.origin.latitude}`;
  const searchParams = new URLSearchParams({
    key: params.key,
    location,
    radius: String(Math.round(params.radiusMeters)),
    sortrule: 'distance',
    offset: String(PER_INTEREST_LIMIT),
    page: '1',
    extensions: 'base',
    output: 'JSON',
  });
  if (params.query.types) {
    searchParams.set('types', params.query.types);
  }
  if (params.query.keywords) {
    searchParams.set('keywords', params.query.keywords);
  }
  return `${AMAP_HOST}/v3/place/around?${searchParams.toString()}`;
}

async function fetchAmapInterests(params: {
  key: string;
  origin: CityWalkOrigin;
  preferences: CityWalkPreferences;
  query: { types?: string; keywords?: string };
  signal?: AbortSignal;
}): Promise<CityWalkCandidate[]> {
  const url = buildAmapAroundUrl({
    key: params.key,
    origin: params.origin,
    radiusMeters: params.preferences.radiusMeters,
    query: params.query,
  });
  const payload = await fetchAmapJson<AmapPlaceAroundResponse>(url, params.signal);

  if (payload.status !== '1') {
    throw new CityWalkError(
      'amap-error',
      `status=${payload.status ?? 'N/A'} info=${payload.info ?? 'N/A'} infocode=${
        payload.infocode ?? 'N/A'
      }`,
    );
  }

  const candidates: CityWalkCandidate[] = [];
  for (const poi of payload.pois ?? []) {
    const poiId = typeof poi.id === 'string' ? poi.id.trim() : '';
    const name = typeof poi.name === 'string' ? poi.name.trim() : '';
    const coordinate = parseAmapLocation(poi.location);
    if (!poiId || !name || !coordinate) {
      continue;
    }
    const distance = Number(poi.distance);
    candidates.push({
      poiId,
      name,
      category: parseAmapCategory(poi.type),
      address: parseAmapAddress(poi.address),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      coordinateSystem: 'gcj02',
      distanceFromOriginMeters: Number.isFinite(distance)
        ? Math.round(distance)
        : Math.round(distanceMetersBetween(params.origin, coordinate)),
    });
  }
  return candidates;
}

/** 按兴趣轮转挑选，保证候选类型多样，同时限制送给模型的文本量 */
function mergeCandidates(groups: CityWalkCandidate[][], limit: number): CityWalkCandidate[] {
  const seen = new Set<string>();
  const merged: CityWalkCandidate[] = [];
  const sortedGroups = groups.map((group) =>
    [...group].sort(
      (a, b) => (a.distanceFromOriginMeters ?? 0) - (b.distanceFromOriginMeters ?? 0),
    ),
  );
  let index = 0;
  let added = true;
  while (merged.length < limit && added) {
    added = false;
    for (const group of sortedGroups) {
      const candidate = group[index];
      if (!candidate) {
        continue;
      }
      if (seen.has(candidate.poiId)) {
        continue;
      }
      seen.add(candidate.poiId);
      merged.push(candidate);
      added = true;
      if (merged.length >= limit) {
        break;
      }
    }
    index += 1;
  }
  return merged;
}

function buildCandidateSet(
  origin: CityWalkOrigin,
  requestId: string,
  candidates: CityWalkCandidate[],
) {
  const byId: Record<string, CityWalkCandidate> = {};
  for (const candidate of candidates) {
    byId[candidate.poiId] = candidate;
  }
  return { requestId, origin, candidates, byId } satisfies CityWalkCandidateSet;
}

function resolveInterests(preferences: CityWalkPreferences): CityWalkInterest[] {
  const selected = preferences.interests.slice(0, MAX_INTEREST_QUERIES);
  if (selected.length > 0) {
    return selected;
  }
  return ['park', 'cafe', 'architecture'];
}

async function queryCandidatesFromBackend(
  origin: CityWalkOrigin,
  preferences: CityWalkPreferences,
  signal?: AbortSignal,
): Promise<CityWalkCandidateSet> {
  const baseUrl = getCityWalkApiBaseUrl();
  if (!baseUrl) {
    throw new CityWalkError('unknown', 'missing city walk api base url');
  }
  // 与直连高德时保持一致：只按上限内的兴趣数量请求候选
  const payload = (await fetchJson(`${baseUrl}/v1/city-walk/candidates`, {
    signal,
    timeoutMs: BACKEND_TIMEOUT_MS,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin: {
          latitude: origin.latitude,
          longitude: origin.longitude,
          coordinateSystem: 'gcj02',
        },
        radiusMeters: preferences.radiusMeters,
        interests: resolveInterests(preferences),
        maxCandidates: MAX_CANDIDATES,
      }),
    },
  })) as {
    requestId?: unknown;
    candidates?: unknown;
  };
  const requestId =
    typeof payload.requestId === 'string' && payload.requestId
      ? payload.requestId
      : createRequestId();
  const rawCandidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const candidates: CityWalkCandidate[] = [];
  for (const item of rawCandidates) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const raw = item as {
      poiId?: unknown;
      name?: unknown;
      category?: unknown;
      address?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      coordinateSystem?: unknown;
      distanceFromOriginMeters?: unknown;
    };
    const latitude = Number(raw.latitude);
    const longitude = Number(raw.longitude);
    if (
      typeof raw.poiId !== 'string' ||
      !raw.poiId.trim() ||
      typeof raw.name !== 'string' ||
      !raw.name.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }
    candidates.push({
      poiId: raw.poiId.trim(),
      name: raw.name.trim(),
      category: typeof raw.category === 'string' ? raw.category : undefined,
      address: typeof raw.address === 'string' ? raw.address : undefined,
      latitude,
      longitude,
      coordinateSystem: parseCoordinateSystem(raw.coordinateSystem),
      distanceFromOriginMeters: Number.isFinite(Number(raw.distanceFromOriginMeters))
        ? Math.round(Number(raw.distanceFromOriginMeters))
        : undefined,
    });
  }
  return buildCandidateSet(origin, requestId, candidates.slice(0, MAX_CANDIDATES));
}

/**
 * 搜索候选 POI。
 * 搜索失败（网络/高德错误）直接抛错；某个兴趣没有结果不影响其他兴趣。
 */
export async function queryCityWalkCandidates(
  origin: CityWalkOrigin,
  preferences: CityWalkPreferences,
  options?: { signal?: AbortSignal },
): Promise<CityWalkCandidateSet> {
  const signal = options?.signal;
  if (getCityWalkApiBaseUrl()) {
    return queryCandidatesFromBackend(origin, preferences, signal);
  }

  const key = getAmapWebKey();
  if (!key) {
    throw new CityWalkError('missing-web-key');
  }

  const interests = resolveInterests(preferences);
  const perInterest: CityWalkCandidate[][] = [];
  let firstError: CityWalkError | null = null;
  let successCount = 0;

  for (const interest of interests) {
    if (signal?.aborted) {
      throw new CityWalkError('cancelled');
    }
    try {
      const list = await fetchAmapInterests({
        key,
        origin,
        preferences,
        query: INTEREST_QUERIES[interest],
        signal,
      });
      successCount += 1;
      perInterest.push(list);
    } catch (error) {
      if (error instanceof CityWalkError && error.code === 'cancelled') {
        throw error;
      }
      firstError = firstError ?? (error as CityWalkError);
      void logLocalError('city-walk', error, { stage: 'candidates-interest', interest });
    }
  }

  if (successCount === 0 && firstError) {
    throw firstError;
  }

  const maxRadius = preferences.radiusMeters * RADIUS_TOLERANCE;
  const withinRadius = (candidate: CityWalkCandidate) =>
    (candidate.distanceFromOriginMeters ?? 0) <= maxRadius;

  let candidates = mergeCandidates(perInterest, MAX_CANDIDATES).filter(withinRadius);

  if (candidates.length === 0) {
    // 兴趣类型过窄时做一次通用搜索，避免直接失败。
    if (signal?.aborted) {
      throw new CityWalkError('cancelled');
    }
    const fallback = await fetchAmapInterests({
      key,
      origin,
      preferences,
      query: FALLBACK_QUERY,
      signal,
    });
    candidates = mergeCandidates([fallback], MAX_CANDIDATES).filter(withinRadius);
  }

  if (candidates.length === 0) {
    throw new CityWalkError('no-candidates');
  }

  return buildCandidateSet(origin, createRequestId(), candidates);
}

function parseAmapPolyline(steps: AmapWalkingStep[] | undefined): CityWalkCoordinate[] {
  const points: CityWalkCoordinate[] = [];
  for (const step of steps ?? []) {
    // 保留全部折线点，保证路线贴合真实路网；相邻 step 的首尾重复点去重
    const all = typeof step.polyline === 'string' ? step.polyline.split(';') : [];
    for (const item of all) {
      const point = parseAmapLocation(item);
      if (!point) {
        continue;
      }
      const last = points[points.length - 1];
      if (last && last.latitude === point.latitude && last.longitude === point.longitude) {
        continue;
      }
      points.push(toCityWalkCoordinate(point.latitude, point.longitude));
    }
  }
  return points;
}

/** 单段步行路线（高德 `/v3/direction/walking`，坐标经度在前） */
export async function queryWalkingLeg(
  from: CityWalkCoordinate,
  to: CityWalkCoordinate,
  options?: { signal?: AbortSignal },
): Promise<{ distanceMeters: number; durationSeconds: number; polyline: CityWalkCoordinate[] }> {
  const key = getAmapWebKey();
  if (!key) {
    throw new CityWalkError('missing-web-key');
  }
  const searchParams = new URLSearchParams({
    key,
    origin: `${from.longitude},${from.latitude}`,
    destination: `${to.longitude},${to.latitude}`,
    output: 'JSON',
  });
  const payload = await fetchAmapJson<AmapWalkingResponse>(
    `${AMAP_HOST}/v3/direction/walking?${searchParams.toString()}`,
    options?.signal,
  );

  if (payload.status !== '1') {
    throw new CityWalkError(
      'amap-error',
      `walking status=${payload.status ?? 'N/A'} info=${payload.info ?? 'N/A'} infocode=${
        payload.infocode ?? 'N/A'
      }`,
    );
  }

  const path = payload.route?.paths?.[0];
  if (!path) {
    throw new CityWalkError('route-failed', 'empty walking path');
  }
  const polyline = parseAmapPolyline(path.steps);
  const distanceMeters = Number(path.distance);
  const durationSeconds = Number(path.duration);
  return {
    distanceMeters: Number.isFinite(distanceMeters) ? Math.round(distanceMeters) : 0,
    durationSeconds: Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : 0,
    // 高德偶尔不返回 steps 折线，此时退化为起终点直连（仅用于显示，不做距离计算）
    polyline: polyline.length >= 2 ? polyline : [from, to].map((point) => ({ ...point })),
  };
}

type LegWaypoint = { poiId: string; coordinate: CityWalkCoordinate };

/**
 * 按顺序计算起点 -> 各站 -> （可选）回到起点的步行路段。
 * 任何一段失败都会抛错：宁可整体失败，也不把直连直线当成可走路线展示。
 */
export async function queryWalkingLegs(params: {
  candidateSet: CityWalkCandidateSet;
  stopPoiIds: string[];
  returnToOrigin: boolean;
  signal?: AbortSignal;
  onLegComputed?: (completed: number, total: number) => void;
}): Promise<CityWalkLegsResult> {
  const { candidateSet, stopPoiIds, returnToOrigin, signal, onLegComputed } = params;
  const { origin } = candidateSet;
  const originPoint: CityWalkCoordinate = {
    latitude: origin.latitude,
    longitude: origin.longitude,
    coordinateSystem: 'gcj02',
  };

  const waypoints: LegWaypoint[] = stopPoiIds.map((poiId) => {
    const candidate = candidateSet.byId[poiId];
    if (!candidate) {
      throw new CityWalkError('ai-invalid-output', `unknown poiId: ${poiId}`);
    }
    return {
      poiId,
      coordinate: toCityWalkCoordinate(candidate.latitude, candidate.longitude),
    };
  });
  if (waypoints.length === 0) {
    throw new CityWalkError('route-failed', 'no waypoints');
  }

  const baseUrl = getCityWalkApiBaseUrl();
  if (baseUrl) {
    const payload = (await fetchJson(`${baseUrl}/v1/city-walk/routes`, {
      signal,
      timeoutMs: BACKEND_TIMEOUT_MS,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: candidateSet.requestId,
          stopPoiIds,
          returnToOrigin,
        }),
      },
    })) as { legs?: unknown };
    const rawLegs = Array.isArray(payload.legs) ? payload.legs : [];
    const legs: CityWalkLeg[] = [];
    for (const item of rawLegs) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const raw = item as {
        fromPoiId?: unknown;
        toPoiId?: unknown;
        distanceMeters?: unknown;
        durationSeconds?: unknown;
        polyline?: unknown;
      };
      if (typeof raw.toPoiId !== 'string') {
        continue;
      }
      const polyline = Array.isArray(raw.polyline)
        ? raw.polyline
            .map((point) => {
              const value = point as { latitude?: unknown; longitude?: unknown };
              const latitude = Number(value?.latitude);
              const longitude = Number(value?.longitude);
              return Number.isFinite(latitude) && Number.isFinite(longitude)
                ? toCityWalkCoordinate(latitude, longitude)
                : null;
            })
            .filter((point): point is CityWalkCoordinate => Boolean(point))
        : [];
      legs.push({
        fromPoiId: typeof raw.fromPoiId === 'string' ? raw.fromPoiId : undefined,
        toPoiId: raw.toPoiId,
        distanceMeters: Math.max(0, Math.round(Number(raw.distanceMeters) || 0)),
        durationSeconds: Math.max(0, Math.round(Number(raw.durationSeconds) || 0)),
        polyline,
      });
    }
    if (legs.length === 0) {
      throw new CityWalkError('route-failed', 'backend returned no legs');
    }
    return {
      legs,
      totalDistanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
      walkingDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    };
  }

  const total = waypoints.length + (returnToOrigin ? 1 : 0);
  const legs: CityWalkLeg[] = [];
  let previousId: string | undefined;
  let previousCoordinate = originPoint;

  const computeLeg = async (target: LegWaypoint) => {
    const walking = await queryWalkingLeg(previousCoordinate, target.coordinate, { signal });
    const leg: CityWalkLeg = {
      fromPoiId: previousId,
      toPoiId: target.poiId,
      distanceMeters: walking.distanceMeters,
      durationSeconds: walking.durationSeconds,
      polyline: walking.polyline,
    };
    previousId = target.poiId;
    previousCoordinate = target.coordinate;
    return leg;
  };

  for (const [index, waypoint] of waypoints.entries()) {
    if (signal?.aborted) {
      throw new CityWalkError('cancelled');
    }
    try {
      legs.push(await computeLeg(waypoint));
    } catch (error) {
      if (error instanceof CityWalkError && error.code === 'cancelled') {
        throw error;
      }
      throw error instanceof CityWalkError
        ? error
        : new CityWalkError('route-failed', error instanceof Error ? error.message : String(error));
    }
    onLegComputed?.(index + 1, total);
  }

  if (returnToOrigin) {
    if (signal?.aborted) {
      throw new CityWalkError('cancelled');
    }
    legs.push(
      await computeLeg({
        poiId: CITY_WALK_ORIGIN_POI_ID,
        coordinate: originPoint,
      }),
    );
    onLegComputed?.(total, total);
  }

  return {
    legs,
    totalDistanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    walkingDurationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
  };
}

/** 只保留前 `stopCount` 站对应的路段（不含回到起点的路段） */
export function sliceStopLegs(legs: CityWalkLeg[], stopCount: number) {
  return legs.filter((leg) => leg.toPoiId !== CITY_WALK_ORIGIN_POI_ID).slice(0, stopCount);
}

export function getReturnLeg(legs: CityWalkLeg[]) {
  return legs.find((leg) => leg.toPoiId === CITY_WALK_ORIGIN_POI_ID);
}

export function shouldReturnToOrigin(shape: CityWalkRouteShape) {
  return shape === 'loop';
}
