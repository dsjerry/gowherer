import { Journey, TimelineEntry, TimelineLocation } from '@/types/journey';
import { EntryTemplateConfig } from '@/types/template';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

type ApiResponse<T> = {
  code: number;
  message: string;
  success: boolean;
  data: T;
  timestamp: number;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  const json: ApiResponse<T> = await res.json();
  if (!json.success) {
    throw new Error(json.message || 'API Error');
  }
  return json.data;
}

// ==================== Journeys ====================

export async function fetchJourneys(kind?: string, status?: string): Promise<Journey[]> {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (status) params.set('status', status);
  const qs = params.toString();
  return request<Journey[]>(`/journeys${qs ? `?${qs}` : ''}`);
}

export async function fetchJourney(id: string): Promise<Journey> {
  return request<Journey>(`/journeys/${id}`);
}

export async function createJourneyApi(title: string, kind: string, tags: string[]): Promise<Journey> {
  return request<Journey>('/journeys', {
    method: 'POST',
    body: JSON.stringify({ title, kind, tags }),
  });
}

export async function completeJourneyApi(id: string): Promise<void> {
  await request<void>(`/journeys/${id}/complete`, { method: 'PATCH' });
}

export async function deleteJourneyApi(id: string): Promise<void> {
  await request<void>(`/journeys/${id}`, { method: 'DELETE' });
}

export async function updateJourneyApi(id: string, data: Partial<Journey>): Promise<void> {
  await request<void>(`/journeys/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function fetchJourneyStats(id: string) {
  return request<{
    distance: number;
    duration: number;
    averageSpeed: number;
    locationCount: number;
    entryCount: number;
  }>(`/journeys/${id}/stats`);
}

// ==================== Entries ====================

export async function addEntryApi(journeyId: string, entry: TimelineEntry): Promise<TimelineEntry> {
  return request<TimelineEntry>(`/journeys/${journeyId}/entries`, {
    method: 'POST',
    body: JSON.stringify({
      id: entry.id,
      text: entry.text,
      location: entry.location,
      tags: entry.tags,
    }),
  });
}

export async function updateEntryApi(entryId: string, entry: Partial<TimelineEntry>): Promise<void> {
  await request<void>(`/journeys/entries/${entryId}`, {
    method: 'PUT',
    body: JSON.stringify(entry),
  });
}

export async function deleteEntryApi(entryId: string): Promise<void> {
  await request<void>(`/journeys/entries/${entryId}`, { method: 'DELETE' });
}

// ==================== Track Locations ====================

export async function appendTrackApi(journeyId: string, locations: TimelineLocation[]): Promise<void> {
  await request<void>(`/journeys/${journeyId}/track`, {
    method: 'POST',
    body: JSON.stringify({ locations }),
  });
}

// ==================== Media ====================

export async function uploadMediaApi(
  entryId: string,
  type: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
): Promise<{ id: string; uri: string }> {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  const url = `${API_BASE}/media/upload?entryId=${encodeURIComponent(entryId)}&type=${encodeURIComponent(type)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'multipart/form-data' },
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Upload failed');
  return json.data;
}

export async function deleteMediaApi(mediaId: string): Promise<void> {
  await request<void>(`/media/${mediaId}`, { method: 'DELETE' });
}

export function getMediaDownloadUrl(mediaId: string): string {
  return `${API_BASE}/media/${mediaId}/download`;
}

// ==================== Templates ====================

export async function fetchTemplates(locale?: string): Promise<Record<string, EntryTemplateConfig>> {
  const qs = locale ? `?locale=${locale}` : '';
  return request<Record<string, EntryTemplateConfig>>(`/templates${qs}`);
}

export async function updateTemplateApi(id: string, data: { label?: string; text?: string; tags?: string[] }): Promise<void> {
  await request<void>(`/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ==================== Backup ====================

export async function exportBackupApi() {
  return request<any>('/backup/export');
}

export async function importBackupApi(data: any): Promise<void> {
  await request<void>('/backup/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
