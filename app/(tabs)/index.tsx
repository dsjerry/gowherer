import { VideoView, useVideoPlayer } from 'expo-video';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemeToggle } from '@/components/theme-toggle';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { loadJourneys, saveJourneys } from '@/lib/journey-storage';
import { reverseGeocodePlaceName } from '@/lib/reverse-geocode';
import {
  getDefaultEntryTemplateConfig,
  loadEntryTemplateConfig,
  saveEntryTemplateConfig,
} from '@/lib/template-storage';
import {
  Journey,
  JourneyKind,
  MediaType,
  TimelineEntry,
  TimelineLocation,
  TimelineMedia,
} from '@/types/journey';
import { EntryTemplate, EntryTemplateConfig } from '@/types/template';

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${min}`;
}

function kindLabel(kind: JourneyKind) {
  return kind === 'travel' ? '旅行' : '通勤';
}

function parseTagsInput(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[,\n，、]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function mediaPreviewUri(media: TimelineMedia) {
  if (media.type === 'video') {
    return media.thumbnailUri;
  }
  return media.uri;
}

function buildTimelineMedia(asset: ImagePicker.ImagePickerAsset): TimelineMedia {
  const type: MediaType = asset.type === 'video' ? 'video' : 'photo';

  return {
    id: createId('media'),
    uri: asset.uri,
    type,
    thumbnailUri: undefined,
  };
}

function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.previewMedia}
      nativeControls
      contentFit="contain"
    />
  );
}

function MediaVideoCover({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
  });

  return (
    <VideoView
      player={player}
      style={styles.mediaPreview}
      nativeControls={false}
      contentFit="cover"
    />
  );
}

export default function JourneyScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const themed = {
    pageTitle: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    pageSubTitle: {
      color: isDark ? '#94a3b8' : '#475569',
    },
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    sectionTitle: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    mutedText: {
      color: isDark ? '#94a3b8' : '#64748b',
    },
    input: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderColor: isDark ? '#334155' : '#cbd5e1',
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    inputPlaceholder: isDark ? '#94a3b8' : '#64748b',
    tagChip: {
      backgroundColor: isDark ? '#334155' : '#e0f2fe',
    },
    tagChipText: {
      color: isDark ? '#e2e8f0' : '#0c4a6e',
    },
    kindButton: {
      backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
      borderColor: isDark ? '#334155' : '#cbd5e1',
    },
    kindButtonText: {
      color: isDark ? '#cbd5e1' : '#0f172a',
    },
    ghostButton: {
      borderColor: isDark ? '#f59e0b' : '#f59e0b',
      backgroundColor: isDark ? '#1f2937' : '#ffffff',
    },
    ghostButtonText: {
      color: isDark ? '#fbbf24' : '#b45309',
    },
    editorLabel: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
    secondaryButton: {
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
    },
    secondaryButtonText: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    cancelButton: {
      borderColor: isDark ? '#334155' : '#cbd5e1',
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
    },
    cancelButtonText: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
    locationText: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
    timelineDot: {
      backgroundColor: isDark ? '#22d3ee' : '#0f766e',
    },
    timelineLine: {
      backgroundColor: isDark ? '#475569' : '#cbd5e1',
    },
    timelineTime: {
      color: isDark ? '#94a3b8' : '#64748b',
    },
    timelineText: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    templateChip: {
      borderColor: isDark ? '#334155' : '#cbd5e1',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    templateChipText: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
    mediaPreviewBox: {
      borderColor: isDark ? '#334155' : '#e2e8f0',
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
    },
    mediaFooter: {
      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
    },
    mediaBadge: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    mediaPlaceholder: {
      backgroundColor: isDark ? '#334155' : '#0f172a',
    },
    mediaPlaceholderText: {
      color: '#ffffff',
    },
    modalCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    modalTitle: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    templateItem: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    templateItemTitle: {
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    templateItemText: {
      color: isDark ? '#cbd5e1' : '#334155',
    },
  };
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [pickingMedia, setPickingMedia] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  const [journeyTitle, setJourneyTitle] = useState('');
  const [journeyTagsInput, setJourneyTagsInput] = useState('');
  const [journeyKind, setJourneyKind] = useState<JourneyKind>('travel');
  const [entryText, setEntryText] = useState('');
  const [entryTagsInput, setEntryTagsInput] = useState('');
  const [draftLocation, setDraftLocation] = useState<TimelineLocation>();
  const [draftMedia, setDraftMedia] = useState<TimelineMedia[]>([]);
  const [previewMedia, setPreviewMedia] = useState<TimelineMedia | null>(null);
  const [templateConfig, setTemplateConfig] = useState<EntryTemplateConfig>(
    getDefaultEntryTemplateConfig()
  );
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null
  );
  const [templateLabelInput, setTemplateLabelInput] = useState('');
  const [templateTextInput, setTemplateTextInput] = useState('');
  const [templateTagsInput, setTemplateTagsInput] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      const [storedJourneys, storedTemplateConfig] = await Promise.all([
        loadJourneys(),
        loadEntryTemplateConfig(),
      ]);
      if (!active) {
        return;
      }
      setJourneys(storedJourneys);
      setTemplateConfig(storedTemplateConfig);
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
  const templateKind = activeJourney?.kind ?? journeyKind;
  const entryTemplates = useMemo(
    () => templateConfig[templateKind],
    [templateConfig, templateKind]
  );

  function resetDraft() {
    setEditingEntryId(null);
    setEntryText('');
    setEntryTagsInput('');
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
      const tags = parseTagsInput(journeyTagsInput);
      const nextJourney: Journey = {
        id: createId('journey'),
        title,
        kind: journeyKind,
        createdAt: now,
        status: 'active',
        tags,
        entries: [],
      };

      await updateJourneys([nextJourney, ...journeys]);
      setJourneyTitle('');
      setJourneyTagsInput('');
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

      const picked = result.assets.map((asset) => buildTimelineMedia(asset));
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

      const captured = result.assets.map((asset) => buildTimelineMedia(asset));
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
      let placeName: string | undefined;
      try {
        placeName = await reverseGeocodePlaceName(
          position.coords.latitude,
          position.coords.longitude
        );
      } catch {
        placeName = undefined;
      }
      setDraftLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        placeName,
      });
    } finally {
      setLoadingLocation(false);
    }
  }

  function startEditEntry(entry: TimelineEntry) {
    setEditingEntryId(entry.id);
    setEntryText(entry.text);
    setEntryTagsInput(entry.tags.join(', '));
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
    const tags = parseTagsInput(entryTagsInput);
    if (!text && draftMedia.length === 0 && !draftLocation && tags.length === 0) {
      Alert.alert('记录为空', '至少添加文案、标签、定位、照片或视频中的一项。');
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
                    tags,
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
          tags,
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

  function applyTemplate(template: EntryTemplate) {
    const currentText = entryText.trim();
    const nextText = currentText ? `${currentText}\n${template.text}` : template.text;
    const currentTags = parseTagsInput(entryTagsInput);
    const mergedTags = Array.from(new Set([...currentTags, ...template.tags]));

    setEntryText(nextText);
    setEntryTagsInput(mergedTags.join(', '));
  }

  function resetTemplateEditor() {
    setEditingTemplateId(null);
    setTemplateLabelInput('');
    setTemplateTextInput('');
    setTemplateTagsInput('');
  }

  function startEditTemplate(template: EntryTemplate) {
    setEditingTemplateId(template.id);
    setTemplateLabelInput(template.label);
    setTemplateTextInput(template.text);
    setTemplateTagsInput(template.tags.join(', '));
  }

  async function updateTemplateConfig(next: EntryTemplateConfig) {
    setTemplateConfig(next);
    await saveEntryTemplateConfig(next);
  }

  async function saveTemplate() {
    const label = templateLabelInput.trim();
    const text = templateTextInput.trim();
    const tags = parseTagsInput(templateTagsInput);

    if (!label || !text) {
      Alert.alert('模板信息不完整', '请填写模板名称和模板文案。');
      return;
    }

    const templates = templateConfig[templateKind];
    const nextTemplate: EntryTemplate = {
      id: editingTemplateId ?? createId(`template-${templateKind}`),
      label,
      text,
      tags,
    };
    const nextTemplates = editingTemplateId
      ? templates.map((template) =>
          template.id === editingTemplateId ? nextTemplate : template
        )
      : [...templates, nextTemplate];

    await updateTemplateConfig({
      ...templateConfig,
      [templateKind]: nextTemplates,
    });
    resetTemplateEditor();
  }

  async function removeTemplate(templateId: string) {
    const templates = templateConfig[templateKind];
    const nextTemplates = templates.filter((template) => template.id !== templateId);

    if (nextTemplates.length === 0) {
      Alert.alert('至少保留一个模板', '请至少保留一个模板，或使用“恢复默认模板”。');
      return;
    }

    await updateTemplateConfig({
      ...templateConfig,
      [templateKind]: nextTemplates,
    });

    if (editingTemplateId === templateId) {
      resetTemplateEditor();
    }
  }

  async function resetTemplatesToDefault() {
    const defaults = getDefaultEntryTemplateConfig();
    await updateTemplateConfig({
      ...templateConfig,
      [templateKind]: defaults[templateKind],
    });
    resetTemplateEditor();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 12 },
      ]}>
      <View style={styles.pageHeader}>
        <Text style={[styles.pageTitle, themed.pageTitle]}>GoWherer 旅程时间线</Text>
        <ThemeToggle />
      </View>
      <Text style={[styles.pageSubTitle, themed.pageSubTitle]}>
        已完成旅程 {completedJourneysCount} 条，当前
        {activeJourney ? '有进行中旅程' : '暂无进行中旅程'}
      </Text>

      {!activeJourney ? (
        <View style={[styles.card, themed.card]}>
          <Text style={[styles.sectionTitle, themed.sectionTitle]}>开始新的旅程</Text>
          <View style={styles.actionRow}>
            <Pressable
              style={[
                styles.kindButton,
                themed.kindButton,
                journeyKind === 'travel' && styles.kindButtonActive,
              ]}
              onPress={() => setJourneyKind('travel')}>
              <Text
                style={[
                  styles.kindButtonText,
                  themed.kindButtonText,
                  journeyKind === 'travel' && styles.kindButtonTextActive,
                ]}>
                旅行
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.kindButton,
                themed.kindButton,
                journeyKind === 'commute' && styles.kindButtonActive,
              ]}
              onPress={() => setJourneyKind('commute')}>
              <Text
                style={[
                  styles.kindButtonText,
                  themed.kindButtonText,
                  journeyKind === 'commute' && styles.kindButtonTextActive,
                ]}>
                通勤
              </Text>
            </Pressable>
          </View>
          <TextInput
            value={journeyTitle}
            onChangeText={setJourneyTitle}
            placeholder="例如：厦门周末旅行 / 周一通勤"
            placeholderTextColor={themed.inputPlaceholder}
            style={[styles.input, themed.input]}
          />
          <TextInput
            value={journeyTagsInput}
            onChangeText={setJourneyTagsInput}
            placeholder="旅程标签（逗号分隔）：周末, 海边, 自驾"
            placeholderTextColor={themed.inputPlaceholder}
            style={[styles.input, themed.input]}
          />
          <Pressable style={styles.primaryButton} onPress={createJourney} disabled={creating}>
            <Text style={styles.primaryButtonText}>{creating ? '创建中...' : '创建旅程'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.card, themed.card]}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.sectionTitle, themed.sectionTitle]}>{activeJourney.title}</Text>
              <Text style={[styles.mutedText, themed.mutedText]}>
                {kindLabel(activeJourney.kind)} · 开始于 {formatDateTime(activeJourney.createdAt)} ·{' '}
                {activeJourney.entries.length} 条记录
              </Text>
              {activeJourney.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {activeJourney.tags.map((tag) => (
                    <View key={tag} style={[styles.tagChip, themed.tagChip]}>
                      <Text style={[styles.tagChipText, themed.tagChipText]}>#{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            <Pressable style={[styles.ghostButton, themed.ghostButton]} onPress={endCurrentJourney}>
              <Text style={[styles.ghostButtonText, themed.ghostButtonText]}>结束旅程</Text>
            </Pressable>
          </View>

          <Text style={[styles.editorLabel, themed.editorLabel]}>
            {editingEntryId ? '编辑记录' : '新增记录'}
          </Text>
          <View style={styles.templateWrap}>
            <View style={styles.templateHeaderRow}>
              <Text style={[styles.mutedText, themed.mutedText]}>
                快捷模板（{kindLabel(templateKind)}）：
              </Text>
              <Pressable onPress={() => setTemplateModalVisible(true)}>
                <Text style={styles.linkText}>管理模板</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.templateRow}>
                {entryTemplates.map((template) => (
                  <Pressable
                    key={template.id}
                    style={[styles.templateChip, themed.templateChip]}
                    onPress={() => applyTemplate(template)}>
                    <Text style={[styles.templateChipText, themed.templateChipText]}>
                      {template.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
          <TextInput
            value={entryText}
            onChangeText={setEntryText}
            placeholder="写下此刻的感受、见闻或备注..."
            placeholderTextColor={themed.inputPlaceholder}
            style={[styles.input, styles.textArea, themed.input]}
            multiline
          />
          <TextInput
            value={entryTagsInput}
            onChangeText={setEntryTagsInput}
            placeholder="记录标签（逗号分隔）：地铁, 雨天, 晚高峰"
            placeholderTextColor={themed.inputPlaceholder}
            style={[styles.input, themed.input]}
          />

          {draftLocation ? (
            <View style={styles.inlineRow}>
              <View style={styles.locationTextContainer}>
                <Text style={[styles.locationText, themed.locationText]}>
                  定位：
                  {draftLocation.placeName ? ` ${draftLocation.placeName} · ` : ' '}
                  {draftLocation.latitude.toFixed(5)}, {draftLocation.longitude.toFixed(5)}
                </Text>
              </View>
              <Pressable style={styles.inlineAction} onPress={() => setDraftLocation(undefined)}>
                <Text style={styles.linkText}>移除定位</Text>
              </Pressable>
            </View>
          ) : null}

          {draftMedia.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
              {draftMedia.map((item) => (
                <Pressable
                  key={item.id}
                  style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}
                  onPress={() => setPreviewMedia(item)}>
                  {mediaPreviewUri(item) ? (
                    <Image source={{ uri: mediaPreviewUri(item) }} style={styles.mediaPreview} contentFit="cover" />
                  ) : item.type === 'video' ? (
                    <MediaVideoCover uri={item.uri} />
                  ) : (
                    <View style={[styles.mediaPlaceholder, themed.mediaPlaceholder]}>
                      <Text style={[styles.mediaPlaceholderText, themed.mediaPlaceholderText]}>视频</Text>
                    </View>
                  )}
                  <View style={[styles.mediaFooter, themed.mediaFooter]}>
                    <Text style={[styles.mediaBadge, themed.mediaBadge]}>
                      {item.type === 'video' ? '视频' : '照片'}
                    </Text>
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
              style={[styles.secondaryButton, themed.secondaryButton]}
              onPress={attachCurrentLocation}
              disabled={loadingLocation}>
              <Text style={[styles.secondaryButtonText, themed.secondaryButtonText]}>
                {loadingLocation ? '定位中...' : '添加定位'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, themed.secondaryButton]}
              onPress={pickMediaFromLibrary}
              disabled={pickingMedia}>
              <Text style={[styles.secondaryButtonText, themed.secondaryButtonText]}>
                {pickingMedia ? '读取中...' : '从相册添加'}
              </Text>
            </Pressable>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.secondaryButton, themed.secondaryButton]}
              onPress={() => captureMediaWithCamera('photo')}
              disabled={pickingMedia}>
              <Text style={[styles.secondaryButtonText, themed.secondaryButtonText]}>
                {pickingMedia ? '处理中...' : '拍照'}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, themed.secondaryButton]}
              onPress={() => captureMediaWithCamera('video')}
              disabled={pickingMedia}>
              <Text style={[styles.secondaryButtonText, themed.secondaryButtonText]}>
                {pickingMedia ? '处理中...' : '拍视频'}
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.primaryButton} onPress={saveTimelineEntry} disabled={savingEntry}>
            <Text style={styles.primaryButtonText}>
              {savingEntry ? '保存中...' : editingEntryId ? '更新记录' : '添加到时间线'}
            </Text>
          </Pressable>
          {editingEntryId ? (
            <Pressable style={[styles.cancelButton, themed.cancelButton]} onPress={resetDraft}>
              <Text style={[styles.cancelButtonText, themed.cancelButtonText]}>取消编辑</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {activeJourney && activeJourney.entries.length > 0 ? (
        <View style={[styles.card, themed.card]}>
          <Text style={[styles.sectionTitle, themed.sectionTitle]}>本次旅程时间线</Text>
          {activeJourney.entries.map((entry, index) => (
            <View key={entry.id} style={styles.timelineItem}>
              <View style={[styles.timelineDot, themed.timelineDot]} />
              <View style={styles.timelineContent}>
                <View style={styles.entryHeader}>
                  <Text style={[styles.timelineTime, themed.timelineTime]}>{formatDateTime(entry.createdAt)}</Text>
                  <View style={styles.inlineRow}>
                    <Pressable onPress={() => startEditEntry(entry)}>
                      <Text style={styles.linkText}>编辑</Text>
                    </Pressable>
                    <Text style={[styles.mutedText, themed.mutedText]}> · </Text>
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
                {entry.text ? <Text style={[styles.timelineText, themed.timelineText]}>{entry.text}</Text> : null}
                {entry.tags.length > 0 ? (
                  <View style={styles.tagRow}>
                    {entry.tags.map((tag) => (
                      <View key={tag} style={[styles.tagChip, themed.tagChip]}>
                        <Text style={[styles.tagChipText, themed.tagChipText]}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {entry.location ? (
                  <Text style={[styles.mutedText, themed.mutedText]}>
                    📍
                    {entry.location.placeName ? ` ${entry.location.placeName} · ` : ' '}
                    {entry.location.latitude.toFixed(5)}, {entry.location.longitude.toFixed(5)}
                  </Text>
                ) : null}
                {entry.media.length > 0 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {entry.media.map((media) => (
                      <Pressable
                        key={media.id}
                        style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}
                        onPress={() => setPreviewMedia(media)}>
                        {mediaPreviewUri(media) ? (
                          <Image
                            source={{ uri: mediaPreviewUri(media) }}
                            style={styles.mediaPreview}
                            contentFit="cover"
                          />
                        ) : media.type === 'video' ? (
                          <MediaVideoCover uri={media.uri} />
                        ) : (
                          <View style={[styles.mediaPlaceholder, themed.mediaPlaceholder]}>
                            <Text style={[styles.mediaPlaceholderText, themed.mediaPlaceholderText]}>视频</Text>
                          </View>
                        )}
                        <Text style={[styles.mediaBadge, themed.mediaBadge]}>
                          {media.type === 'video' ? '视频' : '照片'}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
              {index < activeJourney.entries.length - 1 ? (
                <View style={[styles.timelineLine, themed.timelineLine]} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      <Modal
        visible={templateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setTemplateModalVisible(false);
          resetTemplateEditor();
        }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.templateModalCard, themed.modalCard]}>
            <View style={styles.templateModalHeader}>
              <Text style={[styles.templateModalTitle, themed.modalTitle]}>
                模板管理（{kindLabel(templateKind)}）
              </Text>
              <Pressable
                onPress={() => {
                  setTemplateModalVisible(false);
                  resetTemplateEditor();
                }}>
                <Text style={styles.linkText}>关闭</Text>
              </Pressable>
            </View>

            <ScrollView style={styles.templateModalList}>
              {entryTemplates.map((template) => (
                <View
                  key={template.id}
                  style={[styles.templateItemCard, themed.templateItem]}>
                  <Text style={[styles.templateItemTitle, themed.templateItemTitle]}>
                    {template.label}
                  </Text>
                  <Text style={[styles.templateItemText, themed.templateItemText]}>
                    {template.text}
                  </Text>
                  {template.tags.length > 0 ? (
                    <Text style={[styles.templateItemText, themed.templateItemText]}>
                      标签：{template.tags.map((tag) => `#${tag}`).join(' ')}
                    </Text>
                  ) : null}
                  <View style={styles.inlineRow}>
                    <Pressable onPress={() => startEditTemplate(template)}>
                      <Text style={styles.linkText}>编辑</Text>
                    </Pressable>
                    <Text style={[styles.mutedText, themed.mutedText]}> · </Text>
                    <Pressable
                      onPress={() =>
                        Alert.alert('删除该模板？', '删除后不可恢复。', [
                          { text: '取消', style: 'cancel' },
                          {
                            text: '删除',
                            style: 'destructive',
                            onPress: () => {
                              void removeTemplate(template.id);
                            },
                          },
                        ])
                      }>
                      <Text style={styles.deleteText}>删除</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={styles.templateEditorCard}>
              <Text style={[styles.editorLabel, themed.editorLabel]}>
                {editingTemplateId ? '编辑模板' : '新增模板'}
              </Text>
              <TextInput
                value={templateLabelInput}
                onChangeText={setTemplateLabelInput}
                placeholder="模板名称（如：集合点）"
                placeholderTextColor={themed.inputPlaceholder}
                style={[styles.input, themed.input]}
              />
              <TextInput
                value={templateTextInput}
                onChangeText={setTemplateTextInput}
                placeholder="模板文案"
                placeholderTextColor={themed.inputPlaceholder}
                style={[styles.input, styles.textArea, themed.input]}
                multiline
              />
              <TextInput
                value={templateTagsInput}
                onChangeText={setTemplateTagsInput}
                placeholder="模板标签（逗号分隔）"
                placeholderTextColor={themed.inputPlaceholder}
                style={[styles.input, themed.input]}
              />
              <View style={styles.actionRow}>
                <Pressable
                  style={[styles.primaryButton, styles.templateSaveButton]}
                  onPress={() => void saveTemplate()}>
                  <Text style={styles.primaryButtonText}>
                    {editingTemplateId ? '保存修改' : '添加模板'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.cancelButton, themed.cancelButton, styles.templateResetButton]}
                  onPress={resetTemplateEditor}>
                  <Text style={[styles.cancelButtonText, themed.cancelButtonText]}>
                    清空编辑
                  </Text>
                </Pressable>
              </View>
              <Pressable
                style={[styles.cancelButton, themed.cancelButton]}
                onPress={() =>
                  Alert.alert('恢复默认模板？', '仅恢复当前类型的模板。', [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '恢复',
                      onPress: () => {
                        void resetTemplatesToDefault();
                      },
                    },
                  ])
                }>
                <Text style={[styles.cancelButtonText, themed.cancelButtonText]}>
                  恢复当前类型默认模板
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(previewMedia)} transparent animationType="fade" onRequestClose={() => setPreviewMedia(null)}>
        <View style={styles.previewOverlay}>
          <Pressable style={styles.previewClose} onPress={() => setPreviewMedia(null)}>
            <Text style={styles.previewCloseText}>关闭</Text>
          </Pressable>
          {previewMedia?.type === 'video' ? (
            <PreviewVideo uri={previewMedia.uri} />
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
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
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
    alignItems: 'flex-start',
    gap: 8,
  },
  locationTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  locationText: {
    color: '#334155',
    fontSize: 13,
    flexShrink: 1,
  },
  inlineAction: {
    flexShrink: 0,
    paddingTop: 1,
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
  mediaPlaceholder: {
    width: 110,
    height: 80,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#e0f2fe',
  },
  tagChipText: {
    fontSize: 11,
    color: '#0c4a6e',
    fontWeight: '600',
  },
  templateWrap: {
    gap: 6,
  },
  templateHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  templateRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 6,
  },
  templateChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  templateModalCard: {
    width: '100%',
    maxHeight: '86%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 10,
  },
  templateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  templateModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  templateModalList: {
    maxHeight: 220,
  },
  templateItemCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    padding: 10,
    gap: 6,
    marginBottom: 8,
  },
  templateItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  templateItemText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  templateEditorCard: {
    gap: 8,
  },
  templateResetButton: {
    flex: 1,
  },
  templateSaveButton: {
    flex: 1,
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
