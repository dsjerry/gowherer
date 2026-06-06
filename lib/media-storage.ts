import { MediaType, TimelineMedia } from '@/types/journey';
import { uploadMediaApi, getMediaDownloadUrl } from '@/lib/api-client';

/**
 * Upload media to MinIO via the server API.
 * Returns a TimelineMedia with the server URI.
 */
async function persistMediaItem(media: TimelineMedia): Promise<TimelineMedia> {
  if (!media.uri) {
    return media;
  }

  // If already a server URL, skip
  if (media.uri.startsWith('http://') || media.uri.startsWith('https://')) {
    return media;
  }

  const ext = getFileExtension(media.uri, media.type);
  const fileName = `${media.type}-${media.id}.${ext}`;
  const mimeType = getMimeType(media.type, ext);

  try {
    const result = await uploadMediaApi(media.id, media.type, media.uri, fileName, mimeType);
    return {
      ...media,
      uri: result.uri,
    };
  } catch {
    // Fallback: keep local URI if upload fails
    return media;
  }
}

export async function persistTimelineMedia(mediaItems: TimelineMedia[]) {
  return Promise.all(mediaItems.map((item) => persistMediaItem(item)));
}

function getFileExtension(uri: string, type: MediaType): string {
  const cleanUri = uri.split('?')[0];
  const lastSegment = cleanUri.split('/').pop() ?? '';
  const filename = lastSegment.includes('.') ? lastSegment : '';
  const extension = filename.split('.').pop()?.trim().toLowerCase();

  if (extension) return extension;
  if (type === 'video') return 'mp4';
  if (type === 'audio') return 'm4a';
  return 'jpg';
}

function getMimeType(type: MediaType, ext: string): string {
  if (type === 'video') return 'video/mp4';
  if (type === 'audio') return 'audio/m4a';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Get download URL for a media item (for display in Image/Video components)
 */
export function getMediaSource(media: TimelineMedia) {
  if (media.uri.startsWith('http')) {
    return { uri: media.uri };
  }
  return { uri: media.uri };
}
