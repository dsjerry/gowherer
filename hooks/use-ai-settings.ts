import { useCallback, useEffect, useState } from 'react';

import { AiSettings, loadAiSettings, saveAiSettings } from '@/lib/ai-settings';

/** 读取并持久化 AI 配置；settings 为 null 表示尚未加载完成 */
export function useAiSettings() {
  const [settings, setSettings] = useState<AiSettings | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const loaded = await loadAiSettings();
      if (active) {
        setSettings(loaded);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(async (next: AiSettings) => {
    setSettings(next);
    await saveAiSettings(next);
  }, []);

  return { settings, update };
}
