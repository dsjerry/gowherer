import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { syncBufferedTrackLocations } from '@/lib/background-location';
import { loadJourneyTrackLocations } from '@/lib/journey-storage';
import { logLocalError } from '@/lib/local-log';
import { prepareTrackRouteLocations } from '@/lib/track-utils';
import { TimelineLocation } from '@/types/journey';

/** 实时轨迹刷新间隔：后台定位每 2 秒一个点，5 秒足够看到移动 */
const TRACK_POLL_INTERVAL_MS = 5000;

/**
 * 读取「开始漫步」后关联旅程的实际 GPS 轨迹，并定期把后台缓冲点写入存储。
 * 只读取单条旅程的轨迹表，不做整库加载。
 */
export function useCityWalkTrack(journeyId: string | undefined, enabled: boolean) {
  const [track, setTrack] = useState<TimelineLocation[]>([]);

  useEffect(() => {
    if (!enabled || !journeyId) {
      setTrack([]);
      return;
    }

    let active = true;
    const readTrack = async () => {
      try {
        if (Platform.OS !== 'web') {
          await syncBufferedTrackLocations(journeyId);
        }
        const locations = await loadJourneyTrackLocations(journeyId);
        if (active) {
          setTrack(prepareTrackRouteLocations(locations));
        }
      } catch (error) {
        void logLocalError('city-walk', error, { stage: 'walked-track' });
      }
    };

    void readTrack();
    const timer = setInterval(() => {
      void readTrack();
    }, TRACK_POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled, journeyId]);

  return track;
}
