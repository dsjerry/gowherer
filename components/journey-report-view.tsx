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
import type { ReportTemplateId } from '@/lib/report-templates';
import { simplifyTrackLocations } from '@/lib/track-utils';
import { Journey } from '@/types/journey';

type Design = {
  accent: string;
  accentSoftBg: string;
  textMain: string;
  textDim: string;
  /** classic：纸感浅色编辑式封面 */
  withGradientHeader: boolean;
  /** premium：深色封面 + 悬浮统计卡 */
  coverHeader?: boolean;
  entryCard: boolean;
  /** premium：柔和底色圆角卡片条目 */
  entrySoft?: boolean;
};

const DESIGNS: Record<ReportTemplateId, Design> = {
  classic: {
    accent: '#347568',
    accentSoftBg: '#eef4ed',
    textMain: '#20332e',
    textDim: '#75827c',
    withGradientHeader: true,
    entryCard: true,
  },
  compact: {
    accent: '#315fe8',
    accentSoftBg: '#edf2ff',
    textMain: '#18243d',
    textDim: '#78839a',
    withGradientHeader: false,
    entryCard: false,
  },
  premium: {
    accent: '#c9a86a',
    accentSoftBg: '#f7f2e8',
    textMain: '#1c2a3b',
    textDim: '#718096',
    withGradientHeader: false,
    coverHeader: true,
    entryCard: false,
    entrySoft: true,
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

  const bodyPadding =
    design.withGradientHeader || design.coverHeader ? { paddingHorizontal: 16 } : { padding: 20 };
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
      {design.coverHeader ? (
        <>
          <View style={styles.premiumCover}>
            <View style={styles.premiumCoverGlow} />
            <View style={styles.premiumBadge}>
              <Text style={styles.premiumBadgeText}>{kindLabel(journey.kind, t)}</Text>
            </View>
            <Text style={styles.premiumTitle}>{journey.title}</Text>
            <Text style={styles.premiumMeta}>
              {formatDateTime(journey.createdAt)} —{' '}
              {journey.endedAt ? formatDateTime(journey.endedAt) : ''}
            </Text>
            {journey.tags.length > 0 ? (
              <View style={[styles.tagRow, styles.premiumTagRow]}>
                {journey.tags.map((tag) => (
                  <View key={tag} style={styles.premiumTagChip}>
                    <Text style={styles.premiumTagChipText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <View style={styles.premiumStatsCard}>
            <Text style={styles.premiumStatsEyebrow}>{t('review.templatePremiumStats')}</Text>
            <View style={[styles.statsRow, styles.premiumStatsRow]}>
              {statItems.map(([value, label]) => (
                <View key={label} style={styles.statItem}>
                  <Text style={[styles.statValue, { color: design.accent }]}>{value}</Text>
                  <Text style={[styles.statLabel, { color: design.textDim }]}>{label}</Text>
                </View>
              ))}
            </View>
            {trackImageUri ? (
              <Image
                source={{ uri: trackImageUri }}
                style={styles.trackImage}
                contentFit="contain"
              />
            ) : (
              <View style={[styles.trackFallback, { borderColor: '#e2e8f0' }]}>
                <MaterialCommunityIcons name="map-marker-radius" size={20} color="#94a3b8" />
                <Text style={[styles.trackFallbackText, { color: design.textDim }]}>
                  {t('review.html.trackEmpty')}
                </Text>
              </View>
            )}
          </View>
        </>
      ) : design.withGradientHeader ? (
        <View style={[styles.classicHeader, { backgroundColor: design.accentSoftBg }]}>
          <View style={styles.editorialTopline}>
            <Text style={[styles.kind, { color: design.accent }]}>
              {kindLabel(journey.kind, t)}
            </Text>
            <Text style={[styles.editorialMark, { color: design.accent }]}>
              {t('review.templateClassicKicker')}
            </Text>
          </View>
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
          <View style={styles.classicStatsPanel}>
            {statItems.map(([value, label], index) => (
              <View
                key={label}
                style={[styles.classicStatTile, index % 3 !== 0 && styles.classicStatDivider]}
              >
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
          <View style={styles.compactTopline}>
            <Text style={[styles.kind, { color: design.accent }]}>
              {kindLabel(journey.kind, t)}
            </Text>
            <Text style={[styles.compactKicker, { color: design.accent }]}>
              {t('review.templateCompactKicker')}
            </Text>
          </View>
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

      <View style={[styles.body, bodyPadding]}>
        {journey.entries.map((entry, index) => {
          const photos = entry.media.filter((media) => media.type === 'photo');
          const videos = entry.media.filter((media) => media.type === 'video');
          const audios = entry.media.filter((media) => media.type === 'audio');
          return (
            <View
              key={entry.id}
              style={
                design.entrySoft
                  ? styles.premiumEntry
                  : design.entryCard
                    ? [
                        styles.classicEntry,
                        { borderLeftColor: design.accent, backgroundColor: '#ffffff' },
                      ]
                    : [styles.compactEntry, { borderBottomColor: '#e2e8f0' }]
              }
            >
              <View style={styles.entryHead}>
                <View
                  style={[
                    styles.entryIndex,
                    { backgroundColor: design.accent },
                    design.entrySoft && styles.premiumEntryIndex,
                  ]}
                >
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
          <View style={styles.costBlock}>
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
    paddingTop: 28,
    gap: 9,
    alignItems: 'stretch',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  editorialTopline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  editorialMark: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  classicStatsPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52,117,104,0.12)',
    marginTop: 8,
    paddingVertical: 12,
  },
  classicStatTile: {
    width: '33.333%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  classicStatDivider: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(52,117,104,0.14)',
  },
  premiumCover: {
    backgroundColor: '#1c2a3b',
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 46,
    gap: 9,
    overflow: 'hidden',
  },
  premiumCoverGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -64,
    top: -92,
    borderWidth: 1,
    borderColor: 'rgba(201,168,106,0.32)',
  },
  premiumStatsEyebrow: {
    color: '#8a938e',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.6,
    textAlign: 'center',
    marginBottom: 12,
  },
  premiumStatsRow: {
    marginTop: 0,
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,168,106,0.16)',
    borderColor: 'rgba(201,168,106,0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumBadgeText: {
    color: '#e0c58f',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  premiumTitle: {
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 38,
  },
  premiumMeta: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
  },
  premiumTagRow: {
    justifyContent: 'flex-start',
  },
  premiumTagChip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  premiumTagChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  premiumStatsCard: {
    marginTop: -30,
    marginHorizontal: 18,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e6e2d8',
    padding: 18,
    shadowColor: '#1c2a3b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  premiumEntry: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e5de',
    padding: 16,
    gap: 8,
  },
  premiumEntryIndex: {
    backgroundColor: '#1c2a3b',
  },
  compactHeader: {
    padding: 22,
    paddingTop: 28,
    gap: 10,
    backgroundColor: '#f5f7ff',
    borderBottomWidth: 4,
  },
  compactTopline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactKicker: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  kind: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Georgia',
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'left',
    marginTop: 8,
  },
  titleCompact: {
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.5,
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
    rowGap: 14,
    columnGap: 4,
    marginTop: 12,
    justifyContent: 'center',
  },
  statItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: 3,
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
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7ebf5',
    borderRadius: 10,
    padding: 12,
    gap: 7,
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
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
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
