import * as FileSystem from 'expo-file-system/legacy';

import { Journey, MediaType, TimelineMedia } from '@/types/journey';

const MEDIA_DIRECTORY_NAME = 'gowherer-media';

function getMediaDirectoryUri() {
  if (!FileSystem.documentDirectory) {
    throw new Error('Document directory is unavailable.');
  }

  return `${FileSystem.documentDirectory}${MEDIA_DIRECTORY_NAME}/`;
}

function getFileExtension(uri: string, type: MediaType) {
  const cleanUri = uri.split('?')[0];
  const lastSegment = cleanUri.split('/').pop() ?? '';
  const filename = lastSegment.includes('.') ? lastSegment : '';
  const extension = filename.split('.').pop()?.trim().toLowerCase();

  if (extension) {
    return extension;
  }

  if (type === 'video') {
    return 'mp4';
  }
  if (type === 'audio') {
    return 'm4a';
  }
  return 'jpg';
}

function buildManagedMediaUri(id: string, type: MediaType, sourceUri: string) {
  const directory = getMediaDirectoryUri();
  const extension = getFileExtension(sourceUri, type);
  return `${directory}${type}-${id}.${extension}`;
}

async function ensureMediaDirectory() {
  const directory = getMediaDirectoryUri();
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
  return directory;
}

function isManagedMediaUri(uri: string) {
  try {
    return uri.startsWith(getMediaDirectoryUri());
  } catch {
    return false;
  }
}

async function persistMediaItem(media: TimelineMedia): Promise<TimelineMedia> {
  if (!media.uri || isManagedMediaUri(media.uri)) {
    return media;
  }

  await ensureMediaDirectory();
  const managedUri = buildManagedMediaUri(media.id, media.type, media.uri);
  await FileSystem.copyAsync({
    from: media.uri,
    to: managedUri,
  });

  let thumbnailUri = media.thumbnailUri;
  if (media.thumbnailUri && !isManagedMediaUri(media.thumbnailUri)) {
    const managedThumbnailUri = buildManagedMediaUri(
      `${media.id}-thumb`,
      'photo',
      media.thumbnailUri,
    );
    await FileSystem.copyAsync({
      from: media.thumbnailUri,
      to: managedThumbnailUri,
    });
    thumbnailUri = managedThumbnailUri;
  }

  return {
    ...media,
    uri: managedUri,
    thumbnailUri,
  };
}

export async function persistTimelineMedia(mediaItems: TimelineMedia[]) {
  return Promise.all(mediaItems.map((item) => persistMediaItem(item)));
}

export type MediaStorageReport = {
  fileCount: number;
  totalBytes: number;
  orphanCount: number;
  orphanBytes: number;
};

function collectManagedMediaUrisFromJourneys(journeys: Journey[]) {
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
  return uris;
}

/** 返回 before 中存在、after 中不再被引用的受管媒体文件。 */
export function diffManagedMediaUris(before: Journey[], after: Journey[]) {
  const previous = collectManagedMediaUrisFromJourneys(before);
  const current = collectManagedMediaUrisFromJourneys(after);
  return [...previous].filter((uri) => !current.has(uri));
}

export async function deleteMediaFiles(uris: string[]) {
  let deletedCount = 0;
  for (const uri of uris) {
    if (!isManagedMediaUri(uri)) {
      continue;
    }
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      deletedCount += 1;
    } catch {
      // 单个文件删除失败时跳过,遗留文件由孤儿扫描兜底。
    }
  }
  return deletedCount;
}

async function listMediaFiles() {
  try {
    const directory = getMediaDirectoryUri();
    const names = await FileSystem.readDirectoryAsync(directory);
    const files: Array<{ uri: string; size: number }> = [];
    for (const name of names) {
      const uri = `${directory}${name}`;
      try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists || info.isDirectory) {
          continue;
        }
        files.push({ uri, size: typeof info.size === 'number' ? info.size : 0 });
      } catch {
        // 单个文件信息读取失败时跳过。
      }
    }
    return files;
  } catch {
    // 媒体目录不存在(如新安装或 web 端)时视为空。
    return [];
  }
}

export async function scanMediaStorage(journeys: Journey[]): Promise<MediaStorageReport> {
  const files = await listMediaFiles();
  const referenced = collectManagedMediaUrisFromJourneys(journeys);
  const report: MediaStorageReport = {
    fileCount: 0,
    totalBytes: 0,
    orphanCount: 0,
    orphanBytes: 0,
  };
  for (const file of files) {
    report.fileCount += 1;
    report.totalBytes += file.size;
    if (!referenced.has(file.uri)) {
      report.orphanCount += 1;
      report.orphanBytes += file.size;
    }
  }
  return report;
}

export async function deleteOrphanMediaFiles(journeys: Journey[]) {
  const files = await listMediaFiles();
  const referenced = collectManagedMediaUrisFromJourneys(journeys);
  let deletedCount = 0;
  let freedBytes = 0;
  for (const file of files) {
    if (referenced.has(file.uri)) {
      continue;
    }
    try {
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
      deletedCount += 1;
      freedBytes += file.size;
    } catch {
      // 删除失败时留待下次清理。
    }
  }
  return { deletedCount, freedBytes };
}

export function formatMediaBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}
