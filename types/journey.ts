export type JourneyStatus = 'active' | 'completed';
export type MediaType = 'photo' | 'video' | 'audio';
export type JourneyKind = 'travel' | 'commute';

export type JourneyCostMode = 'metro' | 'rail' | 'bus' | 'taxi' | 'flight' | 'other';

/** 记录条目上的交通费（区间/备注由条目文案与定位承担） */
export type EntryCost = {
  mode: JourneyCostMode;
  /** 金额（元），保留两位小数 */
  amount: number;
};

export type TimelineLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  placeName?: string;
  capturedAt?: string;
  source?: 'manual' | 'tracking';
  /** Coordinate system of this point.
   * - `'wgs84'`: GPS raw (expo-location, manual picker saved WGS-84)
   * - `'gcj02'`: Gaode SDK native (expo-gaode-map)
   * - `undefined`: legacy data — resolved by migration in normalizeJourneyList */
  coordSystem?: 'wgs84' | 'gcj02';
};

export type TimelineMedia = {
  id: string;
  type: MediaType;
  uri: string;
  thumbnailUri?: string;
};

export type TimelineEntry = {
  id: string;
  createdAt: string;
  text: string;
  location?: TimelineLocation;
  media: TimelineMedia[];
  tags: string[];
  /** 本段交通花费 */
  cost?: EntryCost;
};

export type Journey = {
  id: string;
  title: string;
  kind: JourneyKind;
  createdAt: string;
  endedAt?: string;
  status: JourneyStatus;
  tags: string[];
  entries: TimelineEntry[];
  /** Continuously recorded GPS track points while tracking is enabled */
  trackLocations: TimelineLocation[];
};
