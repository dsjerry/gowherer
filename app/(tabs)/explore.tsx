import { useFocusEffect } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { TrackMap } from '@/components/track-map';
import { loadJourneys, saveJourneys } from '@/lib/journey-storage';
import { Journey, JourneyKind, TimelineLocation, TimelineMedia } from '@/types/journey';

type JourneyFilter = 'all' | JourneyKind;

function formatDateTime(iso?: string) {
  if (!iso) {
    return '-';
  }
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function kindLabel(kind: JourneyKind) {
  return kind === 'travel' ? '旅行' : '通勤';
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildTrackSvgDataUri(locations: TimelineLocation[]) {
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

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
    <rect x='0' y='0' width='${width}' height='${height}' fill='#f8fafc' rx='12' />
    <polyline points='${points}' fill='none' stroke='#0f766e' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' />
    <circle cx='${start.split(',')[0]}' cy='${start.split(',')[1]}' r='7' fill='#0284c7' />
    <circle cx='${end.split(',')[0]}' cy='${end.split(',')[1]}' r='7' fill='#dc2626' />
    <text x='20' y='24' font-size='12' fill='#334155'>起点</text>
    <text x='64' y='24' font-size='12' fill='#334155'>终点</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function journeyToHtml(journey: Journey) {
  const locations = journey.entries
    .filter((entry) => Boolean(entry.location))
    .map((entry) => entry.location!)
    .filter(Boolean);
  const trackSvgUri = buildTrackSvgDataUri(locations);

  const cover = `
    <section style="height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:20px;">
      <h1 style="margin:0;font-size:38px;color:#0f172a;">${escapeHtml(journey.title)}</h1>
      <p style="margin:14px 0 0;color:#475569;font-size:16px;">
        ${kindLabel(journey.kind)} · ${formatDateTime(journey.createdAt)} - ${formatDateTime(journey.endedAt)}
      </p>
      <p style="margin:6px 0 16px;color:#64748b;">共 ${journey.entries.length} 条记录</p>
      ${
        trackSvgUri
          ? `<img src="${trackSvgUri}" alt="轨迹图" style="width:95%;max-width:780px;border:1px solid #e2e8f0;border-radius:12px;" />`
          : `<div style="padding:14px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#64748b;">无足够定位点生成轨迹图</div>`
      }
    </section>
    <div style="page-break-after:always;"></div>
  `;

  const items = journey.entries
    .map((entry) => {
      const location = entry.location
        ? `<div style="color:#475569;">定位：${entry.location.latitude.toFixed(5)}, ${entry.location.longitude.toFixed(5)}</div>`
        : '';
      const mediaCount = entry.media.length
        ? `<div style="color:#475569;">媒体：${entry.media.filter((m) => m.type === 'photo').length} 张照片 / ${entry.media.filter((m) => m.type === 'video').length} 段视频</div>`
        : '';
      return `<div style="margin-bottom:12px;padding:12px;border:1px solid #e2e8f0;border-radius:8px;">
        <div style="font-size:12px;color:#64748b;">${formatDateTime(entry.createdAt)}</div>
        <div style="margin-top:6px;line-height:1.6;color:#0f172a;">${escapeHtml(entry.text || '(无文案)')}</div>
        ${location}
        ${mediaCount}
      </div>`;
    })
    .join('');

  return `<!doctype html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:20px;">
      ${cover}
      <h2 style="margin:0 0 12px;color:#0f172a;">时间线明细</h2>
      ${items || '<div style="color:#64748b;">无记录</div>'}
    </body>
  </html>`;
}

export default function JourneyHistoryScreen() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [filter, setFilter] = useState<JourneyFilter>('all');
  const [previewMedia, setPreviewMedia] = useState<TimelineMedia | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const stored = await loadJourneys();
        if (active) {
          setJourneys(stored);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  const completedJourneys = useMemo(
    () => journeys.filter((item) => item.status === 'completed'),
    [journeys]
  );

  const filteredJourneys = useMemo(() => {
    if (filter === 'all') {
      return completedJourneys;
    }
    return completedJourneys.filter((item) => item.kind === filter);
  }, [completedJourneys, filter]);

  async function removeJourney(journeyId: string) {
    const next = journeys.filter((item) => item.id !== journeyId);
    setJourneys(next);
    await saveJourneys(next);
  }

  async function exportJourneyPdf(journey: Journey) {
    try {
      const html = journeyToHtml(journey);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }

      const file = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('导出成功', `PDF 已生成：${file.uri}`);
        return;
      }

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${journey.title}.pdf`,
      });
    } catch {
      Alert.alert('导出失败', '请稍后重试。');
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>旅程回顾</Text>
      <Text style={styles.subTitle}>结束后的旅程会按时间展示在这里，方便复盘每一段路。</Text>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}>
          <Text style={[styles.filterButtonText, filter === 'all' && styles.filterButtonTextActive]}>
            全部
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, filter === 'travel' && styles.filterButtonActive]}
          onPress={() => setFilter('travel')}>
          <Text style={[styles.filterButtonText, filter === 'travel' && styles.filterButtonTextActive]}>
            旅行
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, filter === 'commute' && styles.filterButtonActive]}
          onPress={() => setFilter('commute')}>
          <Text style={[styles.filterButtonText, filter === 'commute' && styles.filterButtonTextActive]}>
            通勤
          </Text>
        </Pressable>
      </View>

      {filteredJourneys.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>没有匹配的已完成旅程</Text>
          <Text style={styles.emptyText}>换个筛选条件，或先在「旅程」页完成一次记录。</Text>
        </View>
      ) : (
        filteredJourneys.map((journey) => {
          const locations = journey.entries
            .filter((entry) => Boolean(entry.location))
            .map((entry) => entry.location!)
            .filter(Boolean);

          return (
            <View key={journey.id} style={styles.card}>
              <View style={styles.journeyHeader}>
                <View>
                  <Text style={styles.journeyTitle}>{journey.title}</Text>
                  <Text style={styles.journeyMeta}>
                    {kindLabel(journey.kind)} · {formatDateTime(journey.createdAt)} -{' '}
                    {formatDateTime(journey.endedAt)}
                  </Text>
                  <Text style={styles.journeyMeta}>记录数：{journey.entries.length}</Text>
                </View>
                <View style={styles.journeyHeaderActions}>
                  <Pressable onPress={() => void exportJourneyPdf(journey)}>
                    <Text style={styles.exportText}>导出 PDF</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      Alert.alert('删除这条旅程？', '将同时删除该旅程下所有记录。', [
                        { text: '取消', style: 'cancel' },
                        {
                          text: '删除',
                          style: 'destructive',
                          onPress: () => {
                            void removeJourney(journey.id);
                          },
                        },
                      ])
                    }>
                    <Text style={styles.deleteText}>删除旅程</Text>
                  </Pressable>
                </View>
              </View>

              {locations.length > 0 ? (
                <View>
                  <Text style={styles.mapTitle}>轨迹地图</Text>
                  <TrackMap locations={locations} />
                </View>
              ) : (
                <Text style={styles.emptyText}>该旅程没有定位点，暂无法生成轨迹。</Text>
              )}

              <View style={styles.divider} />

              {journey.entries.length === 0 ? (
                <Text style={styles.emptyText}>这条旅程还没有记录内容。</Text>
              ) : (
                journey.entries.map((entry) => (
                  <View key={entry.id} style={styles.entryItem}>
                    <Text style={styles.entryTime}>{formatDateTime(entry.createdAt)}</Text>
                    {entry.text ? <Text style={styles.entryText}>{entry.text}</Text> : null}
                    {entry.location ? (
                      <Text style={styles.metaLine}>
                        定位：{entry.location.latitude.toFixed(5)}, {entry.location.longitude.toFixed(5)}
                      </Text>
                    ) : null}
                    {entry.media.length > 0 ? (
                      <>
                        <Text style={styles.metaLine}>
                          媒体：{entry.media.filter((m) => m.type === 'photo').length} 张照片 /{' '}
                          {entry.media.filter((m) => m.type === 'video').length} 段视频
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          {entry.media.map((media) => (
                            <Pressable
                              key={media.id}
                              style={styles.mediaPreviewBox}
                              onPress={() => setPreviewMedia(media)}>
                              <Image
                                source={{ uri: media.uri }}
                                style={styles.mediaPreview}
                                contentFit="cover"
                              />
                              <Text style={styles.mediaBadge}>{media.type === 'video' ? '视频' : '照片'}</Text>
                            </Pressable>
                          ))}
                        </ScrollView>
                      </>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          );
        })
      )}

      <Modal visible={Boolean(previewMedia)} transparent animationType="fade" onRequestClose={() => setPreviewMedia(null)}>
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewClose} onPress={() => setPreviewMedia(null)}>
            <Text style={styles.previewCloseText}>关闭</Text>
          </Pressable>
          {previewMedia?.type === 'video' ? (
            <Video
              source={{ uri: previewMedia.uri }}
              style={styles.previewMedia}
              useNativeControls
              shouldPlay
              resizeMode={ResizeMode.CONTAIN}
            />
          ) : previewMedia ? (
            <Image source={{ uri: previewMedia.uri }} style={styles.previewMedia} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
    paddingBottom: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  subTitle: {
    color: '#475569',
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  filterButtonText: {
    color: '#0f172a',
    fontWeight: '600',
    fontSize: 13,
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  journeyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  journeyHeaderActions: {
    alignItems: 'flex-end',
    gap: 6,
  },
  journeyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  journeyMeta: {
    color: '#64748b',
    fontSize: 13,
  },
  mapTitle: {
    fontWeight: '600',
    color: '#334155',
  },
  exportText: {
    color: '#0369a1',
    fontWeight: '600',
    fontSize: 12,
  },
  deleteText: {
    color: '#b91c1c',
    fontWeight: '600',
    fontSize: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  emptyText: {
    color: '#64748b',
    lineHeight: 20,
  },
  entryItem: {
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 10,
    gap: 4,
  },
  entryTime: {
    color: '#64748b',
    fontSize: 12,
  },
  entryText: {
    color: '#0f172a',
    lineHeight: 21,
    fontSize: 15,
  },
  metaLine: {
    color: '#334155',
    fontSize: 12,
  },
  mediaPreviewBox: {
    marginRight: 10,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    width: 110,
  },
  mediaPreview: {
    width: 110,
    height: 80,
  },
  mediaBadge: {
    fontSize: 11,
    color: '#0f172a',
    padding: 4,
    backgroundColor: '#f8fafc',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  previewMedia: {
    width: '100%',
    height: '78%',
  },
  previewClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  previewCloseText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
