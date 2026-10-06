import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { VideoThumbCover } from '@/components/video-thumb-cover';
import { buildTrackSvgMarkup, svgToBase64DataUri } from '@/lib/journey-pdf';
import {
  computeJourneyStats,
  formatDateTime,
  formatDuration,
  formatLocationLabel,
  getJourneyTrackLocations,
  kindLabel,
  TFunction,
} from '@/lib/journey-stats';
import { simplifyTrackLocations } from '@/lib/track-utils';
import type { ReportTemplateId } from '@/lib/report-templates';
import { Journey } from '@/types/journey';

type Design = {
  accent: string;
  accentSoftBg: string;
  textMain: string;
  textDim: string;
  withGradientHeader: boolean;
  entryCard: boolean;
};

const DESIGNS: Record<ReportTemplateId, Design> = {
  classic: {
    accent: '#0f766e',
    accentSoftBg: '#f0fdfa',
    textMain: '#0f172a',
    textDim: '#64748b',
    withGradientHeader: true,
    entryCard: true,
  },
  compact: {
    accent: '#1d4ed8',
    accentSoftBg: '#eff6ff',
    textMain: '#111827',
    textDim: '#6b7280',
    withGradientHeader: false,
    entryCard: false,
  },
};

type Props = {
  journey: Journey;
  template: ReportTemplateId;
  t: TFunction;
  width: number;
};

/** 旅程报告的纯 RN 渲染（供 view-shot 截图导出长图）。固定宽度、自然高度，
 *  不含任何 GL 视图（视频用缩略图、地图用手绘 SVG），保证截图不会黑块。 */
export function JourneyReportView({ journey, template, t, width }: Props) {
  const design = DESIGNS[template];
  const stats = useMemo(() => computeJourneyStats(journey), [journey]);
  const costEntries = journey.entries.filter((entry) => entry.cost);
  const costTotal = journey.entries.reduce((sum, entry) => sum + (entry.cost?.amount ?? 0), 0);
  const track = useMemo(() => getJourneyTrackLocations(journey), [journey]);
  const trackImageUri = useMemo(() => {
    if (track.length < 2) {
      return null;
    }
    const svg = buildTrackSvgMarkup(simplifyTrackLocations(track, 200));
    return svg ? svgToBase64DataUri(svg) : null;
  }, [track]);

  const pad = design.withGradientHeader ? 0 : 20;
  const statItems: [string, string][] = [
    [stats.distanceKm.toFixed(2), 'km'],
    [formatDuration(stats.durationMs, t), t('review.statsDuration')],
    [stats.avgSpeedKmh.toFixed(1), 'km/h'],
    [String(stats.locationPoints), t('review.statsLocationPoints')],
  ];
  if (costEntries.length > 0) {
    statItems.push([`¥${formatCostText(costTotal)}`, t('review.statsCost')]);
  }

  return (
    <View style={[styles.root, { width }]}>
      {design.withGradientHeader ? (
        <View style={[styles.classicHeader, { backgroundColor: design.accentSoftBg }]}>
          <Text style={[styles.kind, { color: design.accent }]}>{kindLabel(journey.kind, t)}</Text>
          <Text style={[styles.title, { color: design.textMain }]}>{journey.title}</Text>
          <Text style={[styles.meta, { color: design.textDim }]}>
            {formatDateTime(journey.createdAt)} —{' '}
            {journey.endedAt ? formatDateTime(journey.endedAt) : ''}
          </Text>
          <View style={styles.tagRow}>
            {journey.tags.map((tag) => (
              <View key={tag} style={[styles.tagChip, { backgroundColor: '#f1f5f9' }]}>
                <Text style={[styles.tagChipText, { color: design.textDim }]}>#{tag}</Text>
              </View>
            ))}
          </View>
          <View style={styles.statsRow}>
            {statItems.map(([value, label]) => (
              <View key={label} style={styles.statItem}>
                <Text style={[styles.statValue, { color: design.accent }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: design.textDim }]}>{label}</Text>
              </View>
            ))}
          </View>
          {trackImageUri ? (
            <Image source={{ uri: trackImageUri }} style={styles.trackImage} contentFit="contain" />
          ) : (
            <View style={[styles.trackFallback, { borderColor: '#e2e8f0' }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={20} color="#94a3b8" />
              <Text style={[styles.trackFallbackText, { color: design.textDim }]}>
                {t('review.html.trackEmpty')}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.compactHeader, { borderBottomColor: design.accent }]}>
          <Text style={[styles.kind, { color: design.accent }]}>{kindLabel(journey.kind, t)}</Text>
          <Text style={[styles.titleCompact, { color: design.textMain }]}>{journey.title}</Text>
          <Text style={[styles.meta, { color: design.textDim }]}>
            {formatDateTime(journey.createdAt)} —{' '}
            {journey.endedAt ? formatDateTime(journey.endedAt) : ''} ·{' '}
            {t('review.html.totalEntries', { count: journey.entries.length })}
          </Text>
          <View style={styles.statsRow}>
            {statItems.map(([value, label]) => (
              <View key={label} style={styles.statItem}>
                <Text style={[styles.statValueCompact, { color: design.accent }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: design.textDim }]}>{label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={[styles.body, { padding: pad }]}>
        {journey.entries.map((entry, index) => {
          const photos = entry.media.filter((media) => media.type === 'photo');
          const videos = entry.media.filter((media) => media.type === 'video');
          const audios = entry.media.filter((media) => media.type === 'audio');
          return (
            <View
              key={entry.id}
              style={
                design.entryCard
                  ? [
                      styles.classicEntry,
                      { borderLeftColor: design.accent, backgroundColor: '#ffffff' },
                    ]
                  : [styles.compactEntry, { borderBottomColor: '#e2e8f0' }]
              }
            >
              <View style={styles.entryHead}>
                <View style={[styles.entryIndex, { backgroundColor: design.accent }]}>
                  <Text style={styles.entryIndexText}>{index + 1}</Text>
                </View>
                <Text style={[styles.entryTime, { color: design.textDim }]}>
                  {formatDateTime(entry.createdAt)}
                </Text>
                {entry.cost ? (
                  <View style={[styles.costChip, { backgroundColor: design.accentSoftBg }]}>
                    <Text style={[styles.costChipText, { color: design.accent }]}>
                      {t(`journey.costMode.${entry.cost.mode}`)} ¥
                      {formatCostText(entry.cost.amount)}
                    </Text>
                  </View>
                ) : null}
              </View>
              {entry.text ? (
                <Text style={[styles.entryText, { color: design.textMain }]}>{entry.text}</Text>
              ) : null}
              {entry.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {entry.tags.map((tag) => (
                    <View key={tag} style={[styles.tagChip, { backgroundColor: '#f1f5f9' }]}>
                      <Text style={[styles.tagChipText, { color: design.textDim }]}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {entry.location ? (
                <Text style={[styles.entryLocation, { color: design.textDim }]}>
                  📍 {formatLocationLabel(entry.location)}
                </Text>
              ) : null}
              {entry.media.length > 0 ? (
                <View style={styles.mediaGrid}>
                  {photos.map((media) => (
                    <Image
                      key={media.id}
                      source={{ uri: media.uri }}
                      style={styles.mediaCell}
                      contentFit="cover"
                    />
                  ))}
                  {videos.map((media) => (
                    <View key={media.id} style={styles.mediaCell}>
                      <VideoThumbCover uri={media.uri} />
                    </View>
                  ))}
                  {audios.length > 0 ? (
                    <View style={[styles.audioNote, { backgroundColor: '#f1f5f9' }]}>
                      <Text style={[styles.audioNoteText, { color: design.textDim }]}>
                        {t('journey.audioBadge')} × {audios.length}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}

        {costEntries.length > 0 ? (
          <View style={[styles.costBlock, { borderColor: design.accent }]}>
            <Text
              style={[
                styles.sectionTitle,
                { color: design.textMain, borderBottomColor: design.accent },
              ]}
            >
              {t('review.html.costTitle')}
            </Text>
            {costEntries.map((entry) => (
              <View key={entry.id} style={styles.costRow}>
                <Text style={[styles.costMode, { color: design.textMain }]}>
                  {t(`journey.costMode.${entry.cost!.mode}`)}
                </Text>
                <Text style={[styles.costNote, { color: design.textDim }]} numberOfLines={1}>
                  {entry.text || entry.location?.placeName || '—'}
                </Text>
                <Text style={[styles.costAmount, { color: design.textMain }]}>
                  ¥{formatCostText(entry.cost!.amount)}
                </Text>
              </View>
            ))}
            <View style={styles.costRow}>
              <Text style={[styles.costMode, { color: design.textMain }]}>
                {t('review.html.costTotalRow')}
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.costAmount, { color: design.accent }]}>
                ¥{formatCostText(costTotal)}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={[styles.footer, { color: design.textDim }]}>
          {t('review.reportFooter')} · {formatDateTime(new Date().toISOString())}
        </Text>
      </View>
    </View>
  );
}

function formatCostText(amount: number) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#ffffff',
  },
  classicHeader: {
    padding: 24,
    gap: 6,
    alignItems: 'center',
  },
  compactHeader: {
    padding: 20,
    gap: 4,
    borderBottomWidth: 2,
  },
  kind: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 24,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    justifyContent: 'center',
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 18,
    marginTop: 12,
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statValueCompact: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  trackImage: {
    width: '100%',
    height: 160,
    marginTop: 14,
  },
  trackFallback: {
    width: '100%',
    height: 80,
    marginTop: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  trackFallbackText: {
    fontSize: 12,
  },
  body: {
    gap: 14,
    paddingTop: 16,
    paddingBottom: 20,
  },
  classicEntry: {
    borderLeftWidth: 3,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    padding: 14,
    gap: 6,
  },
  compactEntry: {
    borderBottomWidth: 1,
    paddingVertical: 10,
    gap: 6,
  },
  entryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entryIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryIndexText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  entryTime: {
    fontSize: 12,
    flex: 1,
  },
  costChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  costChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  entryText: {
    fontSize: 14,
    lineHeight: 22,
  },
  entryLocation: {
    fontSize: 12,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  mediaCell: {
    width: 104,
    height: 76,
    borderRadius: 8,
    overflow: 'hidden',
  },
  audioNote: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  audioNoteText: {
    fontSize: 11,
  },
  costBlock: {
    borderTopWidth: 2,
    paddingTop: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  costMode: {
    fontSize: 13,
    fontWeight: '600',
    width: 70,
  },
  costNote: {
    fontSize: 12,
    flex: 1,
  },
  costAmount: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },
});
