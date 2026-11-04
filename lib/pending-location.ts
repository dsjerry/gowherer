import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeTrackLocation } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

/**
 * 地图选点页 -> 发起页 的一次性交接通道。
 * - `journey`：旅程时间线条目的定位草稿（默认，保持原有行为）
 * - `city-walk`：城市漫步的起点
 */
export type PendingLocationChannel = 'journey' | 'city-walk';

function getStorageKey(channel: PendingLocationChannel) {
  // `journey` 沿用旧 key，避免升级后读到遗留的一次性交接数据时失效
  return channel === 'journey'
    ? 'gowherer:pending-location:v1'
    : `gowherer:pending-location:v1:${channel}`;
}

function normalizeLocation(value: unknown): TimelineLocation | null {
  return normalizeTrackLocation(value);
}

export async function setPendingLocation(
  location: TimelineLocation,
  channel: PendingLocationChannel = 'journey',
): Promise<void> {
  await AsyncStorage.setItem(getStorageKey(channel), JSON.stringify(location));
}

export async function consumePendingLocation(
  channel: PendingLocationChannel = 'journey',
): Promise<TimelineLocation | null> {
  const key = getStorageKey(channel);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return null;
  }
  await AsyncStorage.removeItem(key);

  try {
    const parsed = JSON.parse(raw);
    return normalizeLocation(parsed);
  } catch {
    return null;
  }
}
