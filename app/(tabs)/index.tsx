import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { loadJourneys, saveJourneys } from '@/lib/journey-storage';
import {
  Journey,
  JourneyKind,
  MediaType,
  TimelineEntry,
  TimelineLocation,
  TimelineMedia,
} from '@/types/journey';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDateTime(iso: string) {
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

export default function JourneyScreen() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [pickingMedia, setPickingMedia] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [journeyTitle, setJourneyTitle] = useState('');
  const [journeyKind, setJourneyKind] = useState<JourneyKind>('travel');
  const [entryText, setEntryText] = useState('');
  const [draftLocation, setDraftLocation] = useState<TimelineLocation>();
  const [draftMedia, setDraftMedia] = useState<TimelineMedia[]>([]);
  const [previewMedia, setPreviewMedia] = useState<TimelineMedia | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await loadJourneys();
      if (!active) {
        return;
      }
      setJourneys(stored);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  const activeJourney = useMemo(
    () => journeys.find((item) => item.status === 'active'),
    [journeys]
  );

  const completedJourneysCount = useMemo(
    () => journeys.filter((item) => item.status === 'completed').length,
    [journeys]
  );

  function resetDraft() {
    setEditingEntryId(null);
    setEntryText('');
    setDraftLocation(undefined);
    setDraftMedia([]);
  }

  async function updateJourneys(next: Journey[]) {
    setJourneys(next);
    await saveJourneys(next);
  }

  async function createJourney() {
    const title = journeyTitle.trim();
    if (!title) {
      Alert.alert('请输入标题', '请先填写本次旅程的名称。');
      return;
    }

    if (activeJourney) {
      Alert.alert('已有进行中的旅程', '请先结束当前旅程，再新建下一条时间线。');
      return;
    }

    setCreating(true);
    try {
      const now = new Date().toISOString();
      const nextJourney: Journey = {
        id: createId('journey'),
        title,
        kind: journeyKind,
        createdAt: now,
        status: 'active',
        entries: [],
      };

      await updateJourneys([nextJourney, ...journeys]);
      setJourneyTitle('');
      setJourneyKind('travel');
    } finally {
      setCreating(false);
    }
  }

  async function endCurrentJourney() {
    if (!activeJourney) {
      return;
    }

    const next = journeys.map((item) =>
      item.id === activeJourney.id
        ? {
            ...item,
            status: 'completed' as const,
            endedAt: new Date().toISOString(),
          }
        : item
    );
    await updateJourneys(next);
    resetDraft();
  }

  async function pickMediaFromLibrary() {
    setPickingMedia(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('无法访问相册', '请在系统设置中允许访问相册。');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const picked: TimelineMedia[] = result.assets.map((asset) => ({
        id: createId('media'),
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'photo',
      }));
      setDraftMedia((prev) => [...prev, ...picked]);
    } finally {
      setPickingMedia(false);
    }
  }

  async function captureMediaWithCamera(type: MediaType) {
    setPickingMedia(true);
    try {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        Alert.alert('无法访问相机', '请在系统设置中允许使用相机。');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes:
          type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        videoMaxDuration: 120,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const captured: TimelineMedia[] = result.assets.map((asset) => ({
        id: createId('media'),
        uri: asset.uri,
        type: asset.type === 'video' ? 'video' : 'photo',
      }));
      setDraftMedia((prev) => [...prev, ...captured]);
    } finally {
      setPickingMedia(false);
    }
  }

  async function attachCurrentLocation() {
    setLoadingLocation(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('无法获取定位', '请在系统设置中开启定位权限。');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setDraftLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    } finally {
      setLoadingLocation(false);
    }
  }

  function startEditEntry(entry: TimelineEntry) {
    setEditingEntryId(entry.id);
    setEntryText(entry.text);
    setDraftLocation(entry.location);
    setDraftMedia(entry.media);
  }

  async function deleteEntry(entryId: string) {
    if (!activeJourney) {
      return;
    }

    const next = journeys.map((item) =>
      item.id === activeJourney.id
        ? {
            ...item,
            entries: item.entries.filter((entry) => entry.id !== entryId),
          }
        : item
    );
    await updateJourneys(next);

    if (editingEntryId === entryId) {
      resetDraft();
    }
  }

  async function saveTimelineEntry() {
    if (!activeJourney) {
      return;
    }

    const text = entryText.trim();
    if (!text && draftMedia.length === 0 && !draftLocation) {
      Alert.alert('记录为空', '至少添加文案、定位、照片或视频中的一项。');
      return;
    }

    setSavingEntry(true);
    try {
      const next = journeys.map((item) => {
        if (item.id !== activeJourney.id) {
          return item;
        }

        if (editingEntryId) {
          return {
            ...item,
            entries: item.entries.map((entry) =>
              entry.id === editingEntryId
                ? {
                    ...entry,
                    text,
                    location: draftLocation,
                    media: draftMedia,
                  }
                : entry
            ),
          };
        }

        const nextEntry: TimelineEntry = {
          id: createId('entry'),
          createdAt: new Date().toISOString(),
          text,
          location: draftLocation,
          media: draftMedia,
        };
        return {
          ...item,
          entries: [...item.entries, nextEntry],
        };
      });

      await updateJourneys(next);
      resetDraft();
    } finally {
      setSavingEntry(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.pageTitle}>GoWherer 旅程时间线</Text>
      <Text style={styles.pageSubTitle}>
        已完成旅程 {completedJourneysCount} 条，当前
        {activeJourney ? '有进行中旅程' : '暂无进行中旅程'}
      </Text>

      {!activeJourney ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>开始新的旅程</Text>
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.kindButton, journeyKind === 'travel' && styles.kindButtonActive]}
              onPress={() => setJourneyKind('travel')}>
              <Text
                style={[styles.kindButtonText, journeyKind === 'travel' && styles.kindButtonTextActive]}>
                旅行
              </Text>
            </Pressable>
            <Pressable
              style={[styles.kindButton, journeyKind === 'commute' && styles.kindButtonActive]}
              onPress={() => setJourneyKind('commute')}>
              <Text
                style={[styles.kindButtonText, journeyKind === 'commute' && styles.kindButtonTextActive]}>
                通勤
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={journeyTitle}
            onChangeText={setJourneyTitle}
            placeholder="例如：厦门周末旅行 / 周一通勤"
            style={styles.input}
          />
          <Pressable style={styles.primaryButton} onPress={createJourney} disabled={creating}>
            <Text style={styles.primaryButtonText}>{creating ? '创建中...' : '创建旅程'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.sectionTitle}>{activeJourney.title}</Text>
              <Text style={styles.mutedText}>
                {kindLabel(activeJourney.kind)} · 开始于 {formatDateTime(activeJourney.createdAt)} ·{' '}
                {activeJourney.entries.length} 条记录
              </Text>
            </View>
            <Pressable style={styles.ghostButton} onPress={endCurrentJourney}>
              <Text style={styles.ghostButtonText}>结束旅程</Text>
            </Pressable>
          </View>

          <Text style={styles.editorLabel}>{editingEntryId ? '编辑记录' : '新增记录'}</Text>
          <TextInput
            value={entryText}
            onChangeText={setEntryText}
            placeholder="写下此刻的感受、见闻或备注..."
            style={[styles.input, styles.textArea]}
            multiline
          />

          {draftLocation ? (
            <View style={styles.inlineRow}>
              <Text style={styles.locationText}>
                定位：{draftLocation.latitude.toFixed(5)}, {draftLocation.longitude.toFixed(5)}
              </Text>
              <Pressable onPress={() => setDraftLocation(undefined)}>
                <Text style={styles.linkText}>移除定位</Text>
              </Pressable>
            </View>
          ) : null}

          {draftMedia.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
              {draftMedia.map((item) => (
                <Pressable key={item.id} style={styles.mediaPreviewBox} onPress={() => setPreviewMedia(item)}>
                  <Image source={{ uri: item.uri }} style={styles.mediaPreview} contentFit="cover" />
                  <View style={styles.mediaFooter}>
                    <Text style={styles.mediaBadge}>{item.type === 'video' ? '视频' : '照片'}</Text>
                    <Pressable onPress={() => setDraftMedia((prev) => prev.filter((m) => m.id !== item.id))}>
                      <Text style={styles.linkText}>删除</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={attachCurrentLocation}
              disabled={loadingLocation}>
              <Text style={styles.secondaryButtonText}>
                {loadingLocation ? '定位中...' : '添加定位'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={pickMediaFromLibrary}
              disabled={pickingMedia}>
              <Text style={styles.secondaryButtonText}>
                {pickingMedia ? '读取中...' : '从相册添加'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => captureMediaWithCamera('photo')}
              disabled={pickingMedia}>
              <Text style={styles.secondaryButtonText}>{pickingMedia ? '处理中...' : '拍照'}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => captureMediaWithCamera('video')}
              disabled={pickingMedia}>
              <Text style={styles.secondaryButtonText}>{pickingMedia ? '处理中...' : '拍视频'}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.primaryButton} onPress={saveTimelineEntry} disabled={savingEntry}>
            <Text style={styles.primaryButtonText}>
              {savingEntry ? '保存中...' : editingEntryId ? '更新记录' : '添加到时间线'}
            </Text>
          </Pressable>
          {editingEntryId ? (
            <Pressable style={styles.cancelButton} onPress={resetDraft}>
              <Text style={styles.cancelButtonText}>取消编辑</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {activeJourney && activeJourney.entries.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>本次旅程时间线</Text>
          {activeJourney.entries.map((entry, index) => (
            <View key={entry.id} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <View style={styles.entryHeader}>
                  <Text style={styles.timelineTime}>{formatDateTime(entry.createdAt)}</Text>
                  <View style={styles.inlineRow}>
                    <Pressable onPress={() => startEditEntry(entry)}>
                      <Text style={styles.linkText}>编辑</Text>
                    </Pressable>
                    <Text style={styles.mutedText}> · </Text>
                    <Pressable
                      onPress={() =>
                        Alert.alert('删除这条记录？', '删除后无法恢复。', [
                          { text: '取消', style: 'cancel' },
                          {
                            text: '删除',
                            style: 'destructive',
                            onPress: () => {
                              void deleteEntry(entry.id);
                            },
                          },
                        ])
                      }>
                      <Text style={styles.deleteText}>删除</Text>
                    </Pressable>
                  </View>
                </View>
                {entry.text ? <Text style={styles.timelineText}>{entry.text}</Text> : null}
                {entry.location ? (
                  <Text style={styles.mutedText}>
                    📍 {entry.location.latitude.toFixed(5)}, {entry.location.longitude.toFixed(5)}
                  </Text>
                ) : null}
                {entry.media.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {entry.media.map((media) => (
                      <Pressable
                        key={media.id}
                        style={styles.mediaPreviewBox}
                        onPress={() => setPreviewMedia(media)}>
                        <Image source={{ uri: media.uri }} style={styles.mediaPreview} contentFit="cover" />
                        <Text style={styles.mediaBadge}>{media.type === 'video' ? '视频' : '照片'}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
              {index < activeJourney.entries.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
          ))}
        </View>
      ) : null}

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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 12,
  },
  pageSubTitle: {
    color: '#475569',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  mutedText: {
    color: '#64748b',
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f8fafc',
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  editorLabel: {
    color: '#334155',
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontWeight: '500',
  },
  kindButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  kindButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  kindButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  kindButtonTextActive: {
    color: '#ffffff',
  },
  ghostButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ghostButtonText: {
    color: '#b45309',
    fontWeight: '600',
    fontSize: 12,
  },
  cancelButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#334155',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    color: '#334155',
    fontSize: 13,
  },
  linkText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '600',
  },
  deleteText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
  },
  mediaRow: {
    maxHeight: 110,
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
  mediaFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: '#f8fafc',
  },
  mediaBadge: {
    fontSize: 11,
    color: '#0f172a',
    padding: 4,
  },
  timelineItem: {
    position: 'relative',
    paddingLeft: 18,
    paddingBottom: 14,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0f766e',
    position: 'absolute',
    left: 0,
    top: 5,
  },
  timelineLine: {
    position: 'absolute',
    left: 4,
    top: 16,
    bottom: -4,
    width: 2,
    backgroundColor: '#cbd5e1',
  },
  timelineContent: {
    gap: 6,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timelineTime: {
    fontSize: 12,
    color: '#64748b',
  },
  timelineText: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 22,
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
