import * as FileSystem from 'expo-file-system/legacy';

import { MediaType, TimelineMedia } from '@/types/journey';

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
    const managedThumbnailUri = buildManagedMediaUri(`${media.id}-thumb`, 'photo', media.thumbnailUri);
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
