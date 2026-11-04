import AsyncStorage from '@react-native-async-storage/async-storage';

import { logLocalError } from '@/lib/local-log';
import { CITY_WALK_PLANS_KEY } from '@/lib/storage-keys';
import {
  CITY_WALK_INTERESTS,
  CITY_WALK_PACES,
  CITY_WALK_ROUTE_SHAPES,
  CityWalkCandidate,
  CityWalkCoordinate,
  CityWalkInterest,
  CityWalkLeg,
  CityWalkPace,
  CityWalkPlan,
  CityWalkPreferences,
  CityWalkRouteShape,
  CityWalkStop,
} from '@/types/city-walk';

/** 只保留最近若干条方案，避免本地存储无限增长 */
export const MAX_SAVED_CITY_WALK_PLANS = 20;

function toFiniteNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeCoordinate(value: unknown): CityWalkCoordinate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as { latitude?: unknown; longitude?: unknown };
  const latitude = toFiniteNumber(raw.latitude);
  const longitude = toFiniteNumber(raw.longitude);
  if (
    latitude === undefined ||
    longitude === undefined ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return { latitude, longitude, coordinateSystem: 'gcj02' };
}

function normalizeCandidate(value: unknown): CityWalkCandidate | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as {
    poiId?: unknown;
    name?: unknown;
    category?: unknown;
    address?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    distanceFromOriginMeters?: unknown;
  };
  const coordinate = normalizeCoordinate(raw);
  if (!coordinate || typeof raw.poiId !== 'string' || !raw.poiId.trim()) {
    return null;
  }
  if (typeof raw.name !== 'string' || !raw.name.trim()) {
    return null;
  }
  return {
    poiId: raw.poiId.trim(),
    name: raw.name.trim(),
    category: typeof raw.category === 'string' ? raw.category : undefined,
    address: typeof raw.address === 'string' ? raw.address : undefined,
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
    coordinateSystem: 'gcj02',
    distanceFromOriginMeters: toFiniteNumber(raw.distanceFromOriginMeters),
  };
}

function normalizeStop(value: unknown): CityWalkStop | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as {
    poi?: unknown;
    order?: unknown;
    suggestedStayMinutes?: unknown;
    reason?: unknown;
  };
  const poi = normalizeCandidate(raw.poi);
  if (!poi) {
    return null;
  }
  return {
    poi,
    order: toFiniteNumber(raw.order) ?? 1,
    suggestedStayMinutes: Math.max(0, Math.round(toFiniteNumber(raw.suggestedStayMinutes) ?? 0)),
    reason: typeof raw.reason === 'string' ? raw.reason : '',
  };
}

function normalizeLeg(value: unknown): CityWalkLeg | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as {
    fromPoiId?: unknown;
    toPoiId?: unknown;
    distanceMeters?: unknown;
    durationSeconds?: unknown;
    polyline?: unknown;
  };
  if (typeof raw.toPoiId !== 'string' || !raw.toPoiId) {
    return null;
  }
  const polyline = Array.isArray(raw.polyline)
    ? raw.polyline
        .map((point) => normalizeCoordinate(point))
        .filter((point): point is CityWalkCoordinate => Boolean(point))
    : [];
  return {
    fromPoiId: typeof raw.fromPoiId === 'string' ? raw.fromPoiId : undefined,
    toPoiId: raw.toPoiId,
    distanceMeters: Math.max(0, Math.round(toFiniteNumber(raw.distanceMeters) ?? 0)),
    durationSeconds: Math.max(0, Math.round(toFiniteNumber(raw.durationSeconds) ?? 0)),
    polyline,
  };
}

function normalizePreferences(value: unknown): CityWalkPreferences | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as {
    durationMinutes?: unknown;
    interests?: unknown;
    pace?: unknown;
    routeShape?: unknown;
    maxStops?: unknown;
    radiusMeters?: unknown;
  };
  const durationMinutes = toFiniteNumber(raw.durationMinutes);
  if (durationMinutes === undefined) {
    return null;
  }
  const interests = Array.isArray(raw.interests)
    ? raw.interests.filter((item): item is CityWalkInterest =>
        CITY_WALK_INTERESTS.includes(item as CityWalkInterest),
      )
    : [];
  const pace: CityWalkPace = CITY_WALK_PACES.includes(raw.pace as CityWalkPace)
    ? (raw.pace as CityWalkPace)
    : 'normal';
  const routeShape: CityWalkRouteShape = CITY_WALK_ROUTE_SHAPES.includes(
    raw.routeShape as CityWalkRouteShape,
  )
    ? (raw.routeShape as CityWalkRouteShape)
    : 'loop';
  return {
    durationMinutes,
    interests,
    pace,
    routeShape,
    maxStops: Math.max(1, Math.round(toFiniteNumber(raw.maxStops) ?? 5)),
    radiusMeters: Math.max(200, Math.round(toFiniteNumber(raw.radiusMeters) ?? 2500)),
  };
}

function normalizePlan(value: unknown): CityWalkPlan | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as {
    id?: unknown;
    createdAt?: unknown;
    title?: unknown;
    summary?: unknown;
    origin?: unknown;
    stops?: unknown;
    legs?: unknown;
    totalDistanceMeters?: unknown;
    walkingDurationSeconds?: unknown;
    estimatedTotalMinutes?: unknown;
    preferences?: unknown;
    aiModel?: unknown;
    linkedJourneyId?: unknown;
    truncatedStops?: unknown;
    overBudget?: unknown;
  };
  if (typeof raw.id !== 'string' || !raw.id) {
    return null;
  }
  const origin = value && typeof raw.origin === 'object' ? normalizeCoordinate(raw.origin) : null;
  if (!origin) {
    return null;
  }
  const originRaw = raw.origin as { label?: unknown };
  const preferences = normalizePreferences(raw.preferences);
  if (!preferences) {
    return null;
  }
  const stops = Array.isArray(raw.stops)
    ? raw.stops.map(normalizeStop).filter((stop): stop is CityWalkStop => Boolean(stop))
    : [];
  const legs = Array.isArray(raw.legs)
    ? raw.legs.map(normalizeLeg).filter((leg): leg is CityWalkLeg => Boolean(leg))
    : [];
  if (stops.length === 0 || legs.length === 0) {
    return null;
  }

  return {
    id: raw.id,
    createdAt:
      typeof raw.createdAt === 'string' && Number.isFinite(Date.parse(raw.createdAt))
        ? raw.createdAt
        : new Date().toISOString(),
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : '',
    summary: typeof raw.summary === 'string' ? raw.summary : undefined,
    origin: {
      ...origin,
      label: typeof originRaw.label === 'string' ? originRaw.label : undefined,
    },
    stops: stops.map((stop, index) => ({ ...stop, order: index + 1 })),
    legs,
    totalDistanceMeters: Math.max(0, Math.round(toFiniteNumber(raw.totalDistanceMeters) ?? 0)),
    walkingDurationSeconds: Math.max(
      0,
      Math.round(toFiniteNumber(raw.walkingDurationSeconds) ?? 0),
    ),
    estimatedTotalMinutes: Math.max(0, Math.round(toFiniteNumber(raw.estimatedTotalMinutes) ?? 0)),
    preferences,
    aiModel: typeof raw.aiModel === 'string' ? raw.aiModel : undefined,
    linkedJourneyId:
      typeof raw.linkedJourneyId === 'string' && raw.linkedJourneyId
        ? raw.linkedJourneyId
        : undefined,
    truncatedStops: toFiniteNumber(raw.truncatedStops),
    overBudget: raw.overBudget === true ? true : undefined,
  };
}

/** 把任意来源（本地存储 / 备份文件）的数据归一化成合法的方案列表 */
export function normalizeCityWalkPlanList(value: unknown): CityWalkPlan[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizePlan(item))
    .filter((plan): plan is CityWalkPlan => Boolean(plan))
    .slice(0, MAX_SAVED_CITY_WALK_PLANS);
}

async function readPlans(): Promise<CityWalkPlan[]> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(CITY_WALK_PLANS_KEY);
  } catch (error) {
    void logLocalError('city-walk-storage', error, { stage: 'read' });
    return [];
  }
  if (!raw) {
    return [];
  }

  try {
    return normalizeCityWalkPlanList(JSON.parse(raw));
  } catch (error) {
    void logLocalError('city-walk-storage', error, { stage: 'parse' });
    return [];
  }
}

async function writePlans(plans: CityWalkPlan[]): Promise<CityWalkPlan[]> {
  const next = plans.slice(0, MAX_SAVED_CITY_WALK_PLANS);
  await AsyncStorage.setItem(CITY_WALK_PLANS_KEY, JSON.stringify(next));
  return next;
}

export async function loadCityWalkPlans(): Promise<CityWalkPlan[]> {
  return readPlans();
}

/** 数据备份恢复：整库替换 */
export async function replaceCityWalkPlans(plans: CityWalkPlan[]): Promise<CityWalkPlan[]> {
  return writePlans(plans);
}

/** 保存（或覆盖同 id 的）方案，返回保存后的完整列表 */
export async function saveCityWalkPlan(plan: CityWalkPlan): Promise<CityWalkPlan[]> {
  const plans = await readPlans();
  const withoutCurrent = plans.filter((item) => item.id !== plan.id);
  return writePlans([plan, ...withoutCurrent]);
}

export async function deleteCityWalkPlan(planId: string): Promise<CityWalkPlan[]> {
  const plans = await readPlans();
  return writePlans(plans.filter((item) => item.id !== planId));
}

/**
 * 旅程被删除时解除关联，避免「已保存方案」指向不存在的旅程。
 * 只处理已持久化的方案，内存中的未保存方案由 UI 自行处理。
 */
export async function clearCityWalkPlanLinkForJourney(journeyId: string): Promise<void> {
  const plans = await readPlans();
  if (!plans.some((item) => item.linkedJourneyId === journeyId)) {
    return;
  }
  await writePlans(
    plans.map((item) =>
      item.linkedJourneyId === journeyId ? { ...item, linkedJourneyId: undefined } : item,
    ),
  );
}
