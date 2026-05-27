import * as FileSystem from 'expo-file-system/legacy';
import { Journey, TimelineMedia } from '@/types/journey';

const OLD_CACHE_DIR = `${FileSystem.cacheDirectory}ImagePicker/`;
const NEW_MEDIA_DIR = `${FileSystem.documentDirectory}gowherer-media/`;

export async function getMediaMigrationStats() {
  const oldFiles = await FileSystem.readDirectoryAsync(OLD_CACHE_DIR).catch(() => []);
  return {
    hasOldMedia: oldFiles.length > 0,
    oldFileCount: oldFiles.length,
  };
}

function getMediaFileExt(type: 'photo' | 'video' | 'audio'): string {
  switch (type) {
    case 'photo':
      return 'jpeg';
    case 'video':
      return 'mp4';
    case 'audio':
      return 'm4a';
    default:
      return 'bin';
  }
}

function isOldMediaUri(uri: string): boolean {
  return uri.includes('/cache/ImagePicker/');
}

export async function migrateMediaFiles(journeys: Journey[]): Promise<{
  success: boolean;
  migratedCount: number;
  failedCount: number;
  updatedJourneys: Journey[];
  errors: string[];
}> {
  const errors: string[] = [];
  let migratedCount = 0;
  let failedCount = 0;

  // 确保目标目录存在
  const dirInfo = await FileSystem.getInfoAsync(NEW_MEDIA_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(NEW_MEDIA_DIR, { intermediates: true });
  }

  // 收集所有需要迁移的媒体文件
  const filesToMove: Array<{
    oldUri: string;
    newUri: string;
    media: TimelineMedia;
  }> = [];

  for (const journey of journeys) {
    for (const entry of journey.entries) {
      for (const media of entry.media) {
        if (isOldMediaUri(media.uri)) {
          const ext = getMediaFileExt(media.type);
          const newUri = `${NEW_MEDIA_DIR}${media.type}-media-${media.id}.${ext}`;
          filesToMove.push({
            oldUri: media.uri,
            newUri,
            media,
          });
        }
      }
    }
  }

  if (filesToMove.length === 0) {
    return {
      success: true,
      migratedCount: 0,
      failedCount: 0,
      updatedJourneys: journeys,
      errors: [],
    };
  }

  // 执行迁移
  const uriMap = new Map<string, string>();
  for (const { oldUri, newUri } of filesToMove) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(oldUri);
      if (fileInfo.exists) {
        await FileSystem.moveAsync({ from: oldUri, to: newUri });
        uriMap.set(oldUri, newUri);
        migratedCount++;
      }
    } catch (err) {
      failedCount++;
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to migrate ${oldUri}: ${errMsg}`);
    }
  }

  // 更新 journey 数据中的 URI
  const updatedJourneys = journeys.map((journey) => ({
    ...journey,
    entries: journey.entries.map((entry) => ({
      ...entry,
      media: entry.media.map((media) => {
        const newUri = uriMap.get(media.uri);
        return newUri ? { ...media, uri: newUri } : media;
      }),
    })),
  }));

  return {
    success: failedCount === 0,
    migratedCount,
    failedCount,
    updatedJourneys,
    errors,
  };
}

export async function cleanupOldMediaCache() {
  try {
    const files = await FileSystem.readDirectoryAsync(OLD_CACHE_DIR);
    for (const file of files) {
      const filePath = `${OLD_CACHE_DIR}${file}`;
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
  } catch {
    // 目录可能不存在或已清理
  }
}
