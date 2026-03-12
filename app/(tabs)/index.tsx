
import { useFocusEffect } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/locale-preference';
import { loadJourneys, saveJourneys } from '@/lib/journey-storage';
import { consumePendingLocation } from '@/lib/pending-location';
import {
  getLocalLogFileUri,
  initLocalLogFile,
  logLocalError,
  logLocalInfo,
} from '@/lib/local-log';
import {
  getDefaultEntryTemplateConfig,
  loadEntryTemplateConfig,
  saveEntryTemplateConfig,
} from '@/lib/template-storage-i18n';
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

function parseTagsInput(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[,，、]/)
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { t, locale } = useI18n();
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
  const [openingLocationPicker, setOpeningLocationPicker] = useState(false);
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
    getDefaultEntryTemplateConfig(locale)
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
      await initLocalLogFile();
      const storedJourneys = await loadJourneys();
      if (!active) {
        return;
      }
      setJourneys(storedJourneys);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const storedTemplateConfig = await loadEntryTemplateConfig(locale);
      if (!active) {
        return;
      }
      setTemplateConfig(storedTemplateConfig);
    })();

    return () => {
      active = false;
    };
  }, [locale]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const picked = await consumePendingLocation();
        if (active && picked) {
          setDraftLocation(picked);
          void logLocalInfo('JourneyScreen', 'location selected from picker page', picked);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  const activeJourney = useMemo(
    () => journeys.find((item) => item.status === 'active'),
    [journeys]
  );

  const completedJourneysCount = useMemo(
    () => journeys.filter((item) => item.status === 'completed').length,
    [journeys]
  );

  const kindLabel = useCallback(
    (kind: JourneyKind) => t(kind === 'travel' ? 'journey.kind.travel' : 'journey.kind.commute'),
    [t]
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
      Alert.alert(t('journey.alertEnterTitleTitle'), t('journey.alertEnterTitleBody'));
      return;
    }

    if (activeJourney) {
      Alert.alert(t('journey.alertActiveJourneyTitle'), t('journey.alertActiveJourneyBody'));
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
        Alert.alert(t('journey.alertAlbumDeniedTitle'), t('journey.alertAlbumDeniedBody'));
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
        Alert.alert(t('journey.alertCameraDeniedTitle'), t('journey.alertCameraDeniedBody'));
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

  async function openAmapPlacePicker() {
    setOpeningLocationPicker(true);
    try {
      if (Platform.OS !== 'android') {
        Alert.alert(t('journey.alertMapUnsupportedTitle'), t('journey.alertMapUnsupportedBody'));
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t('journey.alertLocationDeniedTitle'), t('journey.alertLocationDeniedBody'));
        return;
      }

      void logLocalInfo('JourneyScreen', 'open map picker page');
      const initial = draftLocation
        ? JSON.stringify({
            latitude: draftLocation.latitude,
            longitude: draftLocation.longitude,
            placeName: draftLocation.placeName,
          })
        : undefined;
      router.push({
        pathname: '/location-picker',
        params: initial ? { initial } : {},
      });
    } catch (error) {
      void logLocalError('JourneyScreen', error, { stage: 'open-map-picker' });
      Alert.alert(
        t('journey.alertOpenMapFailedTitle'),
        t('journey.alertOpenMapFailedBody', { uri: getLocalLogFileUri() })
      );
    } finally {
      setOpeningLocationPicker(false);
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
      Alert.alert(t('journey.recordEmptyTitle'), t('journey.recordEmptyBody'));
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
    await saveEntryTemplateConfig(locale, next);
  }

  async function saveTemplate() {
    const label = templateLabelInput.trim();
    const text = templateTextInput.trim();
    const tags = parseTagsInput(templateTagsInput);

    if (!label || !text) {
      Alert.alert(t('journey.alertTemplateIncompleteTitle'), t('journey.alertTemplateIncompleteBody'));
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
      Alert.alert(t('journey.alertTemplateMinimumTitle'), t('journey.alertTemplateMinimumBody'));
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
    const defaults = getDefaultEntryTemplateConfig(locale);
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
    <View style={styles.pageWrap}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 12 },
        ]}>
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, themed.pageTitle]}>{t('journey.screenTitle')}</Text>
        </View>
        <Text style={[styles.pageSubTitle, themed.pageSubTitle]}>
          {t('journey.screenSummary', {
            count: completedJourneysCount,
            status: activeJourney ? t('journey.statusActive') : t('journey.statusInactive'),
          })}
        </Text>

        {!activeJourney ? (
          <View style={[styles.card, themed.card]}>
            <Text style={[styles.sectionTitle, themed.sectionTitle]}>{t('journey.startNew')}</Text>
            <View style={styles.kindRow}>
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
                  {t('journey.kind.travel')}
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
                  {t('journey.kind.commute')}
                </Text>
              </Pressable>
            </View>
            <TextInput
              value={journeyTitle}
              onChangeText={setJourneyTitle}
              placeholder={t('journey.journeyTitlePlaceholder')}
              placeholderTextColor={themed.inputPlaceholder}
              style={[styles.input, themed.input]}
            />
            <TextInput
              value={journeyTagsInput}
              onChangeText={setJourneyTagsInput}
              placeholder={t('journey.journeyTagsPlaceholder')}
              placeholderTextColor={themed.inputPlaceholder}
              style={[styles.input, themed.input]}
            />
            <Pressable style={styles.primaryButton} onPress={createJourney} disabled={creating}>
              <Text style={styles.primaryButtonText}>
                {creating ? t('journey.creatingJourney') : t('journey.createJourney')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, themed.card]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.sectionTitle, themed.sectionTitle]}>{activeJourney.title}</Text>
                <Text style={[styles.mutedText, themed.mutedText]}>
                  {t('journey.currentJourneyMeta', {
                    kind: kindLabel(activeJourney.kind),
                    date: formatDateTime(activeJourney.createdAt),
                    count: activeJourney.entries.length,
                  })}
                </Text>
              </View>
              <Pressable
                style={[styles.ghostButton, themed.ghostButton]}
                onPress={() => void endCurrentJourney()}>
                <Text style={[styles.ghostButtonText, themed.ghostButtonText]}>
                  {t('journey.endJourney')}
                </Text>
              </Pressable>
            </View>

            <Text style={[styles.sectionTitle, themed.sectionTitle]}>
              {t('journey.recordEditorTitle', {
                mode: editingEntryId ? t('journey.modeEdit') : t('journey.modeCreate'),
              })}
            </Text>

            <View style={styles.templateWrap}>
              <View style={styles.templateHeaderRow}>
                <Text style={[styles.mutedText, themed.mutedText]}>
                  {t('journey.templateShortcuts', { kind: kindLabel(templateKind) })}
                </Text>
                <Pressable onPress={() => setTemplateModalVisible(true)}>
                  <Text style={styles.linkText}>{t('journey.manageTemplates')}</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateRow}>
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
              </ScrollView>
            </View>

            <TextInput
              value={entryText}
              onChangeText={setEntryText}
              placeholder={t('journey.entryTextPlaceholder')}
              placeholderTextColor={themed.inputPlaceholder}
              style={[styles.input, styles.textArea, themed.input]}
              multiline
            />
            <TextInput
              value={entryTagsInput}
              onChangeText={setEntryTagsInput}
              placeholder={t('journey.entryTagsPlaceholder')}
              placeholderTextColor={themed.inputPlaceholder}
              style={[styles.input, themed.input]}
            />

            <View style={styles.actionRow}>
              <View style={[styles.locationTextContainer, themed.locationText]}>
                <Text style={[styles.locationText, themed.locationText]}>
                  {t('journey.locationLabel')}
                  {draftLocation
                    ? `${draftLocation.placeName ? `${draftLocation.placeName} · ` : ''}${draftLocation.latitude.toFixed(5)}, ${draftLocation.longitude.toFixed(5)}`
                    : '-'}
                </Text>
              </View>
              {draftLocation ? (
                <Pressable style={styles.inlineAction} onPress={() => setDraftLocation(undefined)}>
                  <Text style={styles.linkText}>{t('journey.removeLocation')}</Text>
                </Pressable>
              ) : null}
            </View>

            {draftMedia.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
                {draftMedia.map((item) => (
                  <View key={item.id} style={[styles.mediaPreviewBox, themed.mediaPreviewBox]}>
                    {mediaPreviewUri(item) ? (
                      <Image
                        source={{ uri: mediaPreviewUri(item) }}
                        style={styles.mediaPreview}
                        contentFit="cover"
                      />
                    ) : item.type === 'video' ? (
                      <MediaVideoCover uri={item.uri} />
                    ) : (
                      <View style={[styles.mediaPlaceholder, themed.mediaPlaceholder]}>
                        <Text style={[styles.mediaPlaceholderText, themed.mediaPlaceholderText]}>
                          {t('journey.mediaBadgeVideo')}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.mediaFooter, themed.mediaFooter]}>
                      <Text style={[styles.mediaBadge, themed.mediaBadge]}>
                        {item.type === 'video' ? t('journey.mediaBadgeVideo') : t('journey.mediaBadgePhoto')}
                      </Text>
                      <Pressable
                        onPress={() => setDraftMedia((prev) => prev.filter((media) => media.id !== item.id))}>
                        <Text style={styles.linkText}>{t('common.delete')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                style={[styles.secondaryButton, themed.secondaryButton]}
                onPress={openAmapPlacePicker}
                disabled={openingLocationPicker}>
                <Text style={[styles.secondaryButtonText, themed.secondaryButtonText]}>
                  {openingLocationPicker ? t('journey.openingMap') : t('journey.addLocation')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, themed.secondaryButton]}
                onPress={pickMediaFromLibrary}
                disabled={pickingMedia}>
                <Text style={[styles.secondaryButtonText, themed.secondaryButtonText]}>
                  {pickingMedia ? t('journey.readingAlbum') : t('journey.addFromAlbum')}
                </Text>
              </Pressable>
            </View>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.secondaryButton, themed.secondaryButton]}
                onPress={() => captureMediaWithCamera('photo')}
                disabled={pickingMedia}>
                <Text style={[styles.secondaryButtonText, themed.secondaryButtonText]}>
                  {pickingMedia ? t('journey.processingMedia') : t('journey.takePhoto')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, themed.secondaryButton]}
                onPress={() => captureMediaWithCamera('video')}
                disabled={pickingMedia}>
                <Text style={[styles.secondaryButtonText, themed.secondaryButtonText]}>
                  {pickingMedia ? t('journey.processingMedia') : t('journey.takeVideo')}
                </Text>
              </Pressable>
            </View>

            <Pressable style={styles.primaryButton} onPress={saveTimelineEntry} disabled={savingEntry}>
              <Text style={styles.primaryButtonText}>
                {savingEntry
                  ? t('journey.savingEntry')
                  : editingEntryId
                    ? t('journey.updateEntry')
                    : t('journey.saveEntry')}
              </Text>
            </Pressable>
            {editingEntryId ? (
              <Pressable style={[styles.cancelButton, themed.cancelButton]} onPress={resetDraft}>
                <Text style={[styles.cancelButtonText, themed.cancelButtonText]}>
                  {t('journey.cancelEdit')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {activeJourney && activeJourney.entries.length > 0 ? (
          <View style={[styles.card, themed.card]}>
            <Text style={[styles.sectionTitle, themed.sectionTitle]}>{t('journey.timelineTitle')}</Text>
            {activeJourney.entries.map((entry, index) => (
              <View key={entry.id} style={styles.timelineItem}>
                <View style={[styles.timelineDot, themed.timelineDot]} />
                <View style={styles.timelineContent}>
                  <View style={styles.entryHeader}>
                    <Text style={[styles.timelineTime, themed.timelineTime]}>{formatDateTime(entry.createdAt)}</Text>
                    <View style={styles.inlineRow}>
                      <Pressable onPress={() => startEditEntry(entry)}>
                        <Text style={styles.linkText}>{t('common.edit')}</Text>
                      </Pressable>
                      <Text style={[styles.mutedText, themed.mutedText]}> · </Text>
                      <Pressable
                        onPress={() =>
                          Alert.alert(
                            t('journey.alertDeleteEntryTitle'),
                            t('journey.alertDeleteEntryBody'),
                            [
                              { text: t('common.cancel'), style: 'cancel' },
                              {
                                text: t('common.delete'),
                                style: 'destructive',
                                onPress: () => {
                                  void deleteEntry(entry.id);
                                },
                              },
                            ]
                          )
                        }>
                        <Text style={styles.deleteText}>{t('common.delete')}</Text>
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
                      ??
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
                              <Text style={[styles.mediaPlaceholderText, themed.mediaPlaceholderText]}>
                                {t('journey.mediaBadgeVideo')}
                              </Text>
                            </View>
                          )}
                          <Text style={[styles.mediaBadge, themed.mediaBadge]}>
                            {media.type === 'video' ? t('journey.mediaBadgeVideo') : t('journey.mediaBadgePhoto')}
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
                  {t('journey.templateManagerTitle', { kind: kindLabel(templateKind) })}
                </Text>
                <Pressable
                  onPress={() => {
                    setTemplateModalVisible(false);
                    resetTemplateEditor();
                  }}>
                  <Text style={styles.linkText}>{t('common.close')}</Text>
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
                        {t('common.tags')}：{template.tags.map((tag) => `#${tag}`).join(' ')}
                      </Text>
                    ) : null}
                    <View style={styles.inlineRow}>
                      <Pressable onPress={() => startEditTemplate(template)}>
                        <Text style={styles.linkText}>{t('common.edit')}</Text>
                      </Pressable>
                      <Text style={[styles.mutedText, themed.mutedText]}> · </Text>
                      <Pressable
                        onPress={() =>
                          Alert.alert(
                            t('journey.alertDeleteTemplateTitle'),
                            t('journey.alertDeleteTemplateBody'),
                            [
                              { text: t('common.cancel'), style: 'cancel' },
                              {
                                text: t('common.delete'),
                                style: 'destructive',
                                onPress: () => {
                                  void removeTemplate(template.id);
                                },
                              },
                            ]
                          )
                        }>
                        <Text style={styles.deleteText}>{t('common.delete')}</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.templateEditorCard}>
                <Text style={[styles.editorLabel, themed.editorLabel]}>
                  {t('journey.templateEditorTitle', {
                    mode: editingTemplateId ? t('journey.templateModeEdit') : t('journey.templateModeCreate'),
                  })}
                </Text>
                <TextInput
                  value={templateLabelInput}
                  onChangeText={setTemplateLabelInput}
                  placeholder={t('journey.templateNamePlaceholder')}
                  placeholderTextColor={themed.inputPlaceholder}
                  style={[styles.input, themed.input]}
                />
                <TextInput
                  value={templateTextInput}
                  onChangeText={setTemplateTextInput}
                  placeholder={t('journey.templateTextPlaceholder')}
                  placeholderTextColor={themed.inputPlaceholder}
                  style={[styles.input, styles.textArea, themed.input]}
                  multiline
                />
                <TextInput
                  value={templateTagsInput}
                  onChangeText={setTemplateTagsInput}
                  placeholder={t('journey.templateTagsPlaceholder')}
                  placeholderTextColor={themed.inputPlaceholder}
                  style={[styles.input, themed.input]}
                />
                <View style={styles.actionRow}>
                  <Pressable
                    style={[styles.primaryButton, styles.templateSaveButton]}
                    onPress={() => void saveTemplate()}>
                    <Text style={styles.primaryButtonText}>
                      {editingTemplateId ? t('journey.updateTemplate') : t('journey.saveTemplate')}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.cancelButton, themed.cancelButton, styles.templateResetButton]}
                    onPress={resetTemplateEditor}>
                    <Text style={[styles.cancelButtonText, themed.cancelButtonText]}>
                      {t('journey.clearTemplateEdit')}
                    </Text>
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.cancelButton, themed.cancelButton]}
                  onPress={() =>
                    Alert.alert(
                      t('journey.alertResetTemplatesTitle'),
                      t('journey.alertResetTemplatesBody'),
                      [
                        { text: t('common.cancel'), style: 'cancel' },
                        {
                          text: t('common.confirm'),
                          onPress: () => {
                            void resetTemplatesToDefault();
                          },
                        },
                      ]
                    )
                  }>
                  <Text style={[styles.cancelButtonText, themed.cancelButtonText]}>
                    {t('journey.resetTemplates')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal visible={Boolean(previewMedia)} transparent animationType="fade" onRequestClose={() => setPreviewMedia(null)}>
          <View style={styles.previewOverlay}>
            <Pressable style={styles.previewClose} onPress={() => setPreviewMedia(null)}>
              <Text style={styles.previewCloseText}>{t('common.close')}</Text>
            </Pressable>
            {previewMedia?.type === 'video' ? (
              <PreviewVideo uri={previewMedia.uri} />
            ) : previewMedia ? (
              <Image source={{ uri: previewMedia.uri }} style={styles.previewMedia} contentFit="contain" />
            ) : null}
          </View>
        </Modal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageWrap: {
    flex: 1,
  },
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
  kindRow: {
    flexDirection: 'row',
    gap: 10,
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

