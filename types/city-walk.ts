/**
 * City Walk（城市漫步）数据类型。
 *
 * 规划路线（CityWalkPlan）与实际 GPS 轨迹（Journey.trackLocations）是两套数据：
 * 前者来自高德步行路径规划 + AI 排序，坐标体系统一为 GCJ-02；后者是设备真实采集的轨迹。
 */

/** City Walk 全程统一使用高德坐标系 GCJ-02 */
export type CityWalkCoordinateSystem = 'gcj02';

export type CityWalkCoordinate = {
  latitude: number;
  longitude: number;
  coordinateSystem: CityWalkCoordinateSystem;
};

export type CityWalkInterest =
  'architecture' | 'cafe' | 'park' | 'museum' | 'food' | 'shopping' | 'riverside' | 'history';

export const CITY_WALK_INTERESTS: CityWalkInterest[] = [
  'architecture',
  'cafe',
  'park',
  'museum',
  'food',
  'shopping',
  'riverside',
  'history',
];

/** 步行节奏：影响搜索半径与建议停留时间 */
export type CityWalkPace = 'relaxed' | 'normal' | 'brisk';

export const CITY_WALK_PACES: CityWalkPace[] = ['relaxed', 'normal', 'brisk'];

/** 环线会额外计算「最后一站 -> 起点」路段 */
export type CityWalkRouteShape = 'loop' | 'one-way';

export const CITY_WALK_ROUTE_SHAPES: CityWalkRouteShape[] = ['loop', 'one-way'];

export type CityWalkPreferences = {
  /** 用户可用时长（分钟），默认 90 */
  durationMinutes: number;
  interests: CityWalkInterest[];
  pace: CityWalkPace;
  routeShape: CityWalkRouteShape;
  /** 途经点上限，MVP 固定 5 */
  maxStops: number;
  /** 候选 POI 搜索半径（米） */
  radiusMeters: number;
};

export type CityWalkOrigin = CityWalkCoordinate & {
  /** 起点展示名（当前位置/地图选点/地点搜索得到，可能为空） */
  label?: string;
};

/** 高德返回的真实 POI，AI 只能在这个集合里选择与排序 */
export type CityWalkCandidate = {
  poiId: string;
  name: string;
  category?: string;
  address?: string;
  latitude: number;
  longitude: number;
  coordinateSystem: CityWalkCoordinateSystem;
  distanceFromOriginMeters?: number;
};

/** 起点/回到终点的虚拟 POI ID，用于路段描述 */
export const CITY_WALK_ORIGIN_POI_ID = '__origin__';

export type CityWalkStop = {
  poi: CityWalkCandidate;
  /** 从 1 开始，连续不重复 */
  order: number;
  suggestedStayMinutes: number;
  /** AI 给出的推荐理由；非高德数据，UI 需明确标注为 AI 生成 */
  reason: string;
};

export type CityWalkLeg = {
  /** 起点路段没有 fromPoiId */
  fromPoiId?: string;
  /** 回到起点时为 CITY_WALK_ORIGIN_POI_ID */
  toPoiId: string;
  distanceMeters: number;
  durationSeconds: number;
  /** 高德步行规划返回的真实折线（GCJ-02） */
  polyline: CityWalkCoordinate[];
};

export type CityWalkPlan = {
  id: string;
  createdAt: string;
  title: string;
  /** AI 生成的一句话说明（可为空） */
  summary?: string;
  origin: CityWalkOrigin;
  stops: CityWalkStop[];
  legs: CityWalkLeg[];
  totalDistanceMeters: number;
  /** 纯步行时间（高德步行规划累计），不含停留 */
  walkingDurationSeconds: number;
  /** 步行时间 + 建议停留时间 */
  estimatedTotalMinutes: number;
  preferences: CityWalkPreferences;
  /** 生成该方案的模型标识，如 'deepseek-chat' */
  aiModel?: string;
  /** 用户点「开始漫步」后关联的 Journey */
  linkedJourneyId?: string;
  /** 因时长预算被自动削减的站点数 */
  truncatedStops?: number;
  /** 步行时间超出用户可用时长（含回程），UI 需提示可以删站或放宽时长 */
  overBudget?: boolean;
};

/** 预览页的忙碌态：重算路线 / 保存方案 / 创建旅程 */
export type CityWalkBusyKind = null | 'recalculating' | 'saving' | 'starting';

export type CityWalkGenerationStage = 'candidates' | 'planning' | 'routing';

export type CityWalkErrorCode =
  | 'missing-web-key'
  | 'no-candidates'
  | 'amap-error'
  | 'network'
  | 'location-denied'
  | 'location-failed'
  | 'ai-not-configured'
  | 'ai-failed'
  | 'ai-invalid-output'
  | 'route-failed'
  | 'active-journey'
  | 'cancelled'
  | 'timeout'
  | 'unknown';

export type CityWalkErrorInfo = {
  code: CityWalkErrorCode;
  /** 供日志与错误提示展示的原始信息（可能为空） */
  detail?: string;
};
