import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { loadJourneys } from '@/lib/journey-storage';
import { isManagedMediaUri } from '@/lib/media-storage';
import { Journey } from '@/types/journey';

const BACKUP_DIR_NAME = 'gowherer-media-backup';

/**
 * 外部专属目录(app 自己写入无需存储权限),形如
 * file:///storage/emulated/0/Android/data/<pkg>/files/。该目录可被
 * `adb pull` 直接读取,用于把沙箱内的媒体文件备份到电脑。
 */
function getExternalFilesDirUri() {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory || Platform.OS !== 'android') {
    return null;
  }
  // documentDirectory = file:///data/user/0/<pkg>/files/ → 包名在第 6 段
  const packageName = documentDirectory.split('/')[5];
  if (!packageName) {
    return null;
  }
  return `file:///storage/emulated/0/Android/data/${packageName}/files/`;
}

function collectManagedMediaUris(journeys: Journey[]) {
  const uris = new Set<string>();
  for (const journey of journeys) {
    for (const entry of journey.entries) {
      for (const media of entry.media) {
        for (const uri of [media.uri, media.thumbnailUri]) {
          if (uri && isManagedMediaUri(uri)) {
            uris.add(uri);
          }
        }
      }
    }
  }
  return [...uris];
}

export type MediaExportResult = {
  exportedCount: number;
  failedCount: number;
  totalBytes: number;
  destinationUri: string;
};

/** 把受管媒体文件复制到外部专属目录,供 adb pull 备份。幂等:同名文件直接覆盖。 */
export async function exportMediaBackup(): Promise<MediaExportResult> {
  const externalDir = getExternalFilesDirUri();
  if (!externalDir) {
    throw new Error('External files directory is unavailable.');
  }

  const destination = `${externalDir}${BACKUP_DIR_NAME}/`;
  await FileSystem.makeDirectoryAsync(destination, { intermediates: true }).catch(() => {});

  const journeys = await loadJourneys();
  const uris = collectManagedMediaUris(journeys);

  let exportedCount = 0;
  let failedCount = 0;
  let totalBytes = 0;

  for (const uri of uris) {
    const fileName = uri.split('/').pop();
    if (!fileName) {
      failedCount += 1;
      continue;
    }
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists || info.isDirectory) {
        failedCount += 1;
        continue;
      }
      await FileSystem.copyAsync({ from: uri, to: `${destination}${fileName}` });
      exportedCount += 1;
      totalBytes += typeof info.size === 'number' ? info.size : 0;
    } catch {
      failedCount += 1;
    }
  }

  return { exportedCount, failedCount, totalBytes, destinationUri: destination };
}
