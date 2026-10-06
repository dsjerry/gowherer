import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { Alert, Platform } from 'react-native';

import {
  computeJourneyStats,
  formatDateTime,
  formatDuration,
  formatLocationLabel,
  getJourneyEntryLocations,
  getJourneyTrackLocations,
  kindLabel,
  TFunction,
} from '@/lib/journey-stats';
import { logLocalError } from '@/lib/local-log';
import { simplifyTrackLocations } from '@/lib/track-utils';
import { toGcj02 } from '@/lib/reverse-geocode';
import { DEFAULT_REPORT_TEMPLATE, type ReportTemplateId } from '@/lib/report-templates';
import { Journey, TimelineLocation, TimelineMedia } from '@/types/journey';

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const PDF_IMAGE_MAX_EDGE = 1280;
const PDF_IMAGE_COMPRESS = 0.7;

// Downscale + re-encode to JPEG before inlining so a photo-heavy journey does
// not produce a multi-hundred-MB HTML string. Falls back to the raw file when
// the manipulator fails.
async function buildEmbeddedImage(uri: string): Promise<string | null> {
  try {
    if (!uri || uri.startsWith('data:')) {
      return uri;
    }
    // First render at native size to read dimensions (ImageRef cannot be
    // resized after render), then re-decode scaled down when oversized.
    let rendered = await ImageManipulator.manipulate(uri).renderAsync();
    if (Math.max(rendered.width, rendered.height) > PDF_IMAGE_MAX_EDGE) {
      const scale = PDF_IMAGE_MAX_EDGE / Math.max(rendered.width, rendered.height);
      rendered = await ImageManipulator.manipulate(uri)
        .resize({
          width: Math.round(rendered.width * scale),
          height: Math.round(rendered.height * scale),
        })
        .renderAsync();
    }
    const result = await rendered.saveAsync({
      compress: PDF_IMAGE_COMPRESS,
      format: SaveFormat.JPEG,
      base64: true,
    });
    return `data:image/jpeg;base64,${result.base64}`;
  } catch {
    try {
      if (!uri || uri.startsWith('data:')) return uri;
      if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
        return uri;
      }
      const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
        encoding: 'base64' as const,
      });
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const mime = ext === 'png' ? 'png' : ext === 'webp' ? 'webp' : 'jpeg';
      return `data:image/${mime};base64,${base64}`;
    } catch {
      return null;
    }
  }
}

async function buildVideoThumbnailDataUri(uri: string): Promise<string | null> {
  try {
    const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(uri, {
      time: 500,
    });
    return await buildEmbeddedImage(thumbnailUri);
  } catch {
    return null;
  }
}

function mediaCellHtml(dataUri: string, badge: string) {
  return (
    `<div style="flex:1;min-width:0;position:relative;">` +
    `<img src="${dataUri}" style="width:100%;height:110px;object-fit:cover;border-radius:8px;display:block;" />` +
    `<span style="position:absolute;right:5px;bottom:5px;background:rgba(15,23,42,0.55);color:#ffffff;font-size:9px;padding:1px 5px;border-radius:6px;">${badge}</span>` +
    `</div>`
  );
}

async function buildEntryMediaHtml(media: TimelineMedia[], t: TFunction): Promise<string> {
  const cells: string[] = [];
  let unrenderedVideos = 0;
  let audioCount = 0;

  // Sequential on purpose: parallel renders of full-size photos spike memory.
  for (const item of media) {
    if (item.type === 'audio') {
      audioCount += 1;
      continue;
    }
    if (item.type === 'video') {
      const thumbnail = await buildVideoThumbnailDataUri(item.uri);
      if (thumbnail) {
        cells.push(mediaCellHtml(thumbnail, t('journey.mediaBadgeVideo')));
      } else {
        unrenderedVideos += 1;
      }
      continue;
    }
    const dataUri = await buildEmbeddedImage(item.uri);
    if (dataUri) {
      cells.push(mediaCellHtml(dataUri, t('journey.mediaBadgePhoto')));
    }
  }

  const lines: string[] = [];
  for (let i = 0; i < cells.length; i += 3) {
    lines.push(
      `<div style="display:flex;gap:6px;margin-top:8px;">${cells.slice(i, i + 3).join('')}</div>`,
    );
  }
  if (unrenderedVideos > 0) {
    lines.push(
      `<div style="color:#64748b;font-size:12px;margin-top:6px;">${t(
        'journey.mediaBadgeVideo',
      )} × ${unrenderedVideos}</div>`,
    );
  }
  if (audioCount > 0) {
    lines.push(
      `<div style="color:#64748b;font-size:12px;margin-top:6px;">${t(
        'journey.audioBadge',
      )} × ${audioCount}</div>`,
    );
  }
  return lines.join('');
}

/** Hand-drawn route sketch. Labels are optional — omit them when the SVG must
 *  stay ASCII-safe (e.g. for the base64 data URI used by expo-image). */
export function buildTrackSvgMarkup(
  locations: TimelineLocation[],
  labels?: { start: string; end: string },
) {
  if (locations.length < 2) {
    return '';
  }

  const width = 780;
  const height = 260;
  const padding = 24;
  const lats = locations.map((item) => item.latitude);
  const lngs = locations.map((item) => item.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(0.00001, maxLat - minLat);
  const lngSpan = Math.max(0.00001, maxLng - minLng);

  const points = locations
    .map((item) => {
      const x = padding + ((item.longitude - minLng) / lngSpan) * (width - padding * 2);
      const y = height - padding - ((item.latitude - minLat) / latSpan) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const start = points.split(' ')[0];
  const end = points.split(' ')[points.split(' ').length - 1];

  const labelsHtml = labels
    ? `<text x='20' y='24' font-size='12' fill='#334155'>${escapeHtml(labels.start)}</text>
    <text x='64' y='24' font-size='12' fill='#334155'>${escapeHtml(labels.end)}</text>`
    : '';

  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
    <rect x='0' y='0' width='${width}' height='${height}' fill='#f8fafc' rx='12' />
    <polyline points='${points}' fill='none' stroke='#0f766e' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' />
    <circle cx='${start.split(',')[0]}' cy='${start.split(',')[1]}' r='7' fill='#0284c7' />
    <circle cx='${end.split(',')[0]}' cy='${end.split(',')[1]}' r='7' fill='#dc2626' />
    ${labelsHtml}
  </svg>`;
}

/** Percent-encoded utf8 data URI — works inside the PDF's WebView. */
export function buildTrackSvgDataUri(
  locations: TimelineLocation[],
  labels: { start: string; end: string },
) {
  const svg = buildTrackSvgMarkup(locations, labels);
  if (!svg) {
    return '';
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** expo-image's Android SVG decoder (Coil) only loads base64 data URIs — the
 *  percent-encoded utf8 variant renders blank. SVG must be ASCII-safe. */
export function svgToBase64DataUri(svg: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < svg.length; i += 3) {
    const b1 = svg.charCodeAt(i);
    const has2 = i + 1 < svg.length;
    const has3 = i + 2 < svg.length;
    const b2 = has2 ? svg.charCodeAt(i + 1) : 0;
    const b3 = has3 ? svg.charCodeAt(i + 2) : 0;
    out += chars[b1 >> 2];
    out += chars[((b1 & 3) << 4) | (b2 >> 4)];
    out += has2 ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    out += has3 ? chars[b3 & 63] : '=';
  }
  return `data:image/svg+xml;base64,${out}`;
}

function getAmapWebKey() {
  const extra = (Constants.expoConfig?.extra ?? {}) as {
    geocoding?: { amapWebKey?: string };
  };
  return extra.geocoding?.amapWebKey ?? process.env.EXPO_PUBLIC_AMAP_WEB_KEY;
}

// A real AMap static map when the web key is available; the hand-drawn SVG
// polyline stays as the offline fallback.
export async function buildTrackImage(
  locations: TimelineLocation[],
  t: TFunction,
): Promise<string | null> {
  if (locations.length < 2) {
    return null;
  }
  const staticMapUri = await buildTrackStaticMapUri(locations);
  return (
    staticMapUri ??
    buildTrackSvgDataUri(locations, {
      start: t('review.html.start'),
      end: t('review.html.end'),
    })
  );
}

async function buildTrackStaticMapUri(locations: TimelineLocation[]): Promise<string | null> {
  try {
    const amapWebKey = getAmapWebKey();
    if (!amapWebKey) {
      return null;
    }

    const simplified = simplifyTrackLocations(locations, 160);
    if (simplified.length < 2) {
      return null;
    }
    const gcjPoints = simplified.map((point) => {
      if (point.coordSystem === 'gcj02') {
        return { latitude: point.latitude, longitude: point.longitude };
      }
      const converted = toGcj02(point.latitude, point.longitude);
      return { latitude: converted.latitude, longitude: converted.longitude };
    });

    const lats = gcjPoints.map((p) => p.latitude);
    const lngs = gcjPoints.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const spanLat = Math.max(maxLat - minLat, 0.0001);
    const spanLng = Math.max(maxLng - minLng, 0.0001);

    // Fit the whole route into the preview. AMap staticmap zoom is NOT
    // standard Mercator-256 — calibrated against rendered output: ~123 logical
    // px per degree of longitude at zoom 6, doubling per level, ~114 px/deg
    // latitude at this latitude band.
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const IMAGE_W = 750;
    const IMAGE_H = 360;
    const VIEW_PADDING = 0.85;
    const zoomFitLng = Math.log2((VIEW_PADDING * IMAGE_W) / (spanLng * 123));
    const zoomFitLat = Math.log2((VIEW_PADDING * IMAGE_H) / (spanLat * 114));
    const zoom = Math.max(4, Math.min(17, 6 + Math.floor(Math.min(zoomFitLng, zoomFitLat))));

    const start = gcjPoints[0];
    const end = gcjPoints[gcjPoints.length - 1];
    const params = new URLSearchParams({
      key: amapWebKey,
      location: `${centerLng.toFixed(6)},${centerLat.toFixed(6)}`,
      zoom: String(zoom),
      size: `${IMAGE_W}*${IMAGE_H}`,
      scale: '2',
      // AMap path overlays do not render for this key; start/end markers do
      // (multi-group lists need %7C-encoded separators and uppercase hex).
      markers: `mid,0x0284C7,A:${start.longitude.toFixed(6)},${start.latitude.toFixed(6)}|mid,0xDC2626,B:${end.longitude.toFixed(6)},${end.latitude.toFixed(6)}`,
    });
    return `https://restapi.amap.com/v3/staticmap?${params.toString()}`;
  } catch (error) {
    void logLocalError('JourneyScreen', 'build static map failed', error);
    return null;
  }
}

type ReportDesign = {
  accent: string;
  accentSoftBg: string;
  textMain: string;
  textDim: string;
  withCover: boolean;
  entryCard: boolean;
};

const REPORT_DESIGNS: Record<ReportTemplateId, ReportDesign> = {
  classic: {
    accent: '#0f766e',
    accentSoftBg: '#f0fdfa',
    textMain: '#0f172a',
    textDim: '#64748b',
    withCover: true,
    entryCard: true,
  },
  compact: {
    accent: '#1d4ed8',
    accentSoftBg: '#eff6ff',
    textMain: '#111827',
    textDim: '#6b7280',
    withCover: false,
    entryCard: false,
  },
};

async function journeyToHtml(
  journey: Journey,
  t: TFunction,
  templateId: ReportTemplateId,
): Promise<string> {
  const design = REPORT_DESIGNS[templateId];
  const stats = computeJourneyStats(journey);
  const routeLocations = getJourneyTrackLocations(journey);
  const fallbackLocations = getJourneyEntryLocations(journey);
  const locations = routeLocations.length >= 2 ? routeLocations : fallbackLocations;
  const trackImageUri = await buildTrackImage(locations, t);
  const costEntries = journey.entries.filter((entry) => entry.cost);
  const costTotal = journey.entries.reduce((sum, entry) => sum + (entry.cost?.amount ?? 0), 0);

  const tagsHtml = journey.tags.length
    ? `<div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">${journey.tags
        .map(
          (tag) =>
            `<span style="background:${design.accentSoftBg};color:${design.accent};padding:3px 10px;border-radius:12px;font-size:12px;">#${escapeHtml(tag)}</span>`,
        )
        .join('')}</div>`
    : '';

  const statBlock = (value: string, label: string) =>
    `<div style="text-align:center;">
      <div style="font-size:24px;font-weight:700;color:${design.accent};">${value}</div>
      <div style="font-size:11px;color:${design.textDim};margin-top:2px;">${escapeHtml(label)}</div>
    </div>`;

  const statsHtml = `
    <div style="display:flex;gap:20px;margin-top:20px;flex-wrap:wrap;">
      ${statBlock(stats.distanceKm.toFixed(2), 'km')}
      ${statBlock(formatDuration(stats.durationMs, t), t('review.statsDuration'))}
      ${statBlock(stats.avgSpeedKmh.toFixed(1), 'km/h')}
      ${statBlock(String(stats.locationPoints), t('review.statsLocationPoints'))}
      ${costEntries.length ? statBlock(`\u00a5${(Math.round(costTotal * 100) / 100).toString()}`, t('review.statsCost')) : ''}
    </div>`;

  const headerBand = `
    <section style="padding:36px 24px 20px;border-bottom:2px solid ${design.accent};">
      <div style="font-size:12px;color:${design.accent};letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">${escapeHtml(kindLabel(journey.kind, t))}</div>
      <h1 style="margin:0;font-size:28px;color:${design.textMain};font-weight:700;">${escapeHtml(journey.title)}</h1>
      <p style="margin:8px 0 0;color:${design.textDim};font-size:13px;">
        ${formatDateTime(journey.createdAt)} \u2014 ${journey.endedAt ? formatDateTime(journey.endedAt) : ''}
        \u00b7 ${escapeHtml(t('review.html.totalEntries', { count: journey.entries.length }))}
      </p>
      ${tagsHtml}
      ${statsHtml}
    </section>`;

  const cover = `
    <section style="min-height:90vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:40px 20px;background:linear-gradient(180deg,${design.accentSoftBg} 0%,#ffffff 100%);">
      <div style="font-size:13px;color:${design.accent};letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(kindLabel(journey.kind, t))}</div>
      <h1 style="margin:0;font-size:36px;color:${design.textMain};font-weight:700;">${escapeHtml(journey.title)}</h1>
      <p style="margin:12px 0 0;color:${design.textDim};font-size:14px;">
        ${formatDateTime(journey.createdAt)} \u2014 ${journey.endedAt ? formatDateTime(journey.endedAt) : ''}
      </p>
      ${tagsHtml}
      ${statsHtml}
      <p style="margin:16px 0 0;color:${design.textDim};font-size:13px;">${escapeHtml(
        t('review.html.totalEntries', { count: journey.entries.length }),
      )}</p>
      ${
        trackImageUri
          ? `<img src="${trackImageUri}" alt="${escapeHtml(t('review.html.trackAlt'))}" style="width:90%;max-width:780px;margin-top:24px;border:1px solid #e2e8f0;border-radius:12px;" />`
          : `<div style="margin-top:24px;padding:14px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:${design.textDim};font-size:13px;">${escapeHtml(
              t('review.html.trackEmpty'),
            )}</div>`
      }
    </section>
    <div style="page-break-after:always;"></div>
  `;

  const entriesHtml = await Promise.all(
    journey.entries.map(async (entry, index) => {
      const location = entry.location
        ? `<div style="color:${design.textDim};font-size:12px;margin-top:4px;">\U0001F4CD ${escapeHtml(
            formatLocationLabel(entry.location),
          )}</div>`
        : '';
      const tags = entry.tags.length
        ? `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap;">${entry.tags
            .map(
              (tag) =>
                `<span style="background:#f1f5f9;color:${design.textDim};padding:2px 8px;border-radius:10px;font-size:11px;">#${escapeHtml(tag)}</span>`,
            )
            .join('')}</div>`
        : '';
      const mediaHtml = await buildEntryMediaHtml(entry.media, t);
      const textHtml = entry.text
        ? `<div style="margin-top:8px;line-height:1.7;color:${design.textMain};font-size:14px;">${escapeHtml(entry.text)}</div>`
        : `<div style="margin-top:8px;color:#94a3b8;font-size:13px;font-style:italic;">${escapeHtml(t('review.html.noText'))}</div>`;
      const costHtml = entry.cost
        ? `<span style="display:inline-block;padding:2px 8px;border-radius:10px;background:${design.accentSoftBg};color:${design.accent};font-size:11px;font-weight:700;">${escapeHtml(t(`journey.costMode.${entry.cost.mode}`))}\u00a5${escapeHtml(String(entry.cost.amount))}</span>`
        : '';

      const cardStyle = design.entryCard
        ? `margin-bottom:20px;padding:16px 20px;background:#ffffff;border-left:3px solid ${design.accent};border-radius:0 8px 8px 0;box-shadow:0 1px 3px rgba(0,0,0,0.06);`
        : `margin-bottom:18px;padding:12px 4px;border-bottom:1px solid #e2e8f0;`;

      return `<div style="${cardStyle}">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:28px;height:28px;border-radius:50%;background:${design.accent};color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;">${index + 1}</div>
          <div style="font-size:12px;color:${design.textDim};">${formatDateTime(entry.createdAt)}</div>
          ${costHtml}
        </div>
        ${textHtml}
        ${tags}
        ${location}
        ${mediaHtml}
      </div>`;
    }),
  );

  const items = entriesHtml.join('');

  const costsSectionHtml = costEntries.length
    ? `<div style="page-break-before:always;"></div>
    <section style="padding:30px 24px;">
      <h2 style="margin:0 0 20px;color:${design.textMain};font-size:22px;font-weight:700;border-bottom:2px solid ${design.accent};padding-bottom:8px;">${escapeHtml(t('review.html.costTitle'))}</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr>
            ${[
              'review.html.costTime',
              'review.html.costMode',
              'review.html.costNote',
              'review.html.costAmount',
            ]
              .map(
                (key) =>
                  `<th style="text-align:left;padding:8px 10px;background:${design.accentSoftBg};color:${design.accent};border-bottom:2px solid ${design.accent};">${escapeHtml(t(key))}</th>`,
              )
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${costEntries
            .map((entry) => {
              const note = entry.text || (entry.location?.placeName ?? '');
              return `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:${design.textDim};white-space:nowrap;">${formatDateTime(entry.createdAt)}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:${design.textMain};">${escapeHtml(t(`journey.costMode.${entry.cost!.mode}`))}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:${design.textDim};">${note ? escapeHtml(note) : '\u2014'}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;color:${design.textMain};font-weight:600;">\u00a5${escapeHtml(String(entry.cost!.amount))}</td>
          </tr>`;
            })
            .join('')}
          <tr>
            <td style="padding:10px;font-weight:700;color:${design.textMain};" colspan="3">${escapeHtml(t('review.html.costTotalRow'))}</td>
            <td style="padding:10px;font-weight:700;color:${design.accent};">\u00a5${escapeHtml(String(Math.round(costTotal * 100) / 100))}</td>
          </tr>
        </tbody>
      </table>
    </section>`
    : '';

  return `<!doctype html>
  <html>
    <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB',sans-serif;margin:0;padding:0;background:#ffffff;color:${design.textMain};">
      ${design.withCover ? cover : headerBand}
      <section style="padding:30px 24px;">
        <h2 style="margin:0 0 20px;color:${design.textMain};font-size:22px;font-weight:700;border-bottom:2px solid ${design.accent};padding-bottom:8px;">${escapeHtml(t('review.html.title'))}</h2>
        ${items || `<div style="color:${design.textDim};text-align:center;padding:40px;">${escapeHtml(t('review.html.emptyText'))}</div>`}
      </section>
      ${costsSectionHtml}
    </body>
  </html>`;
}

/** Build the shareable PDF for a journey and hand it to the system share sheet. */
export async function exportJourneyPdf(
  journey: Journey,
  t: TFunction,
  templateId: ReportTemplateId = DEFAULT_REPORT_TEMPLATE,
) {
  try {
    const html = await journeyToHtml(journey, t, templateId);
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return;
    }

    const file = await Print.printToFileAsync({
      html,
      base64: false,
    });
    // Share a human-readable filename instead of the printer's random one.
    const safeTitle =
      journey.title
        .replace(/[\\/:*?"<>|\n\r]/g, '')
        .trim()
        .slice(0, 50) || 'journey';
    const destination = new File(Paths.cache, `${safeTitle}.pdf`);
    // File.copy 在目标已存在时抛错（不覆盖），重复导出前先清掉旧文件
    if (destination.exists) {
      destination.delete();
    }
    new File(file.uri).copy(destination);
    const pdfUri = destination.uri;

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert(t('review.exportSuccessTitle'), t('review.exportSuccessBody', { uri: pdfUri }));
      return;
    }

    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: `${safeTitle}.pdf`,
    });
  } catch {
    Alert.alert(t('review.exportFailedTitle'), t('review.exportFailedBody'));
  }
}
