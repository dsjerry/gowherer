import { useFocusEffect } from '@react-navigation/native';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActiveJourneyCard } from '@/components/active-journey-card';
import { JourneyCreateCard } from '@/components/journey-create-card';
import { MediaPreviewModal } from '@/components/media-preview-modal';
import { TemplateModal } from '@/components/template-modal';
import { TimelineList } from '@/components/timeline-list';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useJourneys } from '@/hooks/use-journeys';
import { useLocationTracking } from '@/hooks/use-location-tracking';
import { stopLocationTracking } from '@/lib/background-location';
import {
  getLocalLogFileUri,
  logLocalError,
  logLocalInfo,
} from '@/lib/local-log';
import { consumePendingLocation } from '@/lib/pending-location';
import {
  getDefaultEntryTemplateConfig,
  loadEntryTemplateConfig,
  saveEntryTemplateConfig,
} from '@/lib/template-storage-i18n';
import {
  JourneyKind,
  MediaType,
  TimelineEntry,
  TimelineLocation,
  TimelineMedia,
} from '@/types/journey';
import { EntryTemplate, EntryTemplateConfig } from '@/types/template';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseTagsInput(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[,，、]/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

function buildTimelineMedia(asset: ImagePicker.ImagePickerAsset): TimelineMedia {
  const type: MediaType = asset.type === 'video' ? 'video' : 'photo';
  return { id: createId('media'), uri: asset.uri, type, thumbnailUri: undefined };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function JourneyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { t, locale } = useI18n();
  const isDark = colorScheme === 'dark';

  const pageTitleColor = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const pageSubTitleColor = { color: isDark ? '#94a3b8' : '#475569' };

  // ---- Journey data -------------------------------------------------------
  const {
    loading,
    activeJourney,
    completedJourneysCount,
    addJourney,
    completeJourney,
    addEntry,
    updateEntry,
    removeEntry,
    refreshJourneys,
  } = useJourneys();

  // ---- Location tracking --------------------------------------------------
  const { locationTracking, trackingBusy, handleTrackingChange } =
    useLocationTracking(activeJourney, refreshJourneys);

  // ---- Draft entry state --------------------------------------------------
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [entryText, setEntryText] = useState('');
  const [entryTagsInput, setEntryTagsInput] = useState('');
  const [draftLocation, setDraftLocation] = useState<TimelineLocation>();
  const [draftMedia, setDraftMedia] = useState<TimelineMedia[]>([]);

  // ---- New-journey form ---------------------------------------------------
  const [journeyTitle, setJourneyTitle] = useState('');
  const [journeyTagsInput, setJourneyTagsInput] = useState('');
  const [journeyKind, setJourneyKind] = useState<JourneyKind>('travel');
  const [creating, setCreating] = useState(false);

  // ---- Templates ----------------------------------------------------------
  const [templateConfig, setTemplateConfig] = useState<EntryTemplateConfig>(
    getDefaultEntryTemplateConfig(locale),
  );
  const [templateModalVisible, setTemplateModalVisible] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await loadEntryTemplateConfig(locale);
      if (!active) return;
      setTemplateConfig(stored);
    })();
    return () => {
      active = false;
    };
  }, [locale]);

  const templateKind: JourneyKind = activeJourney?.kind ?? journeyKind;
  const entryTemplates = useMemo(
    () => templateConfig[templateKind],
    [templateConfig, templateKind],
  );

  // ---- Media / audio state ------------------------------------------------
  const [pickingMedia, setPickingMedia] = useState(false);
  const [openingLocationPicker, setOpeningLocationPicker] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [previewMedia, setPreviewMedia] = useState<TimelineMedia | null>(null);

  // ---- Pending location from picker page ----------------------------------
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
    }, []),
  );

  // ---- Handlers: journey CRUD --------------------------------------------

  async function handleCreateJourney() {
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
      const tags = parseTagsInput(journeyTagsInput);
      await addJourney(title, journeyKind, tags);
      setJourneyTitle('');
      setJourneyTagsInput('');
      setJourneyKind('travel');
    } finally {
      setCreating(false);
    }
  }

  async function handleEndJourney() {
    if (!activeJourney) return;
    try {
      await stopLocationTracking();
    } catch (error) {
      void logLocalError('JourneyScreen', 'failed to stop location tracking while ending journey', error);
    }
    await completeJourney(activeJourney.id);
    resetDraft();
  }

  // ---- Handlers: entry draft ----------------------------------------------

  function resetDraft() {
    setEditingEntryId(null);
    setEntryText('');
    setEntryTagsInput('');
    setDraftLocation(undefined);
    setDraftMedia([]);
    if (recorderState.isRecording) {
      void audioRecorder.stop();
    }
  }

  function startEditEntry(entry: TimelineEntry) {
    setEditingEntryId(entry.id);
    setEntryText(entry.text);
    setEntryTagsInput(entry.tags.join(', '));
    setDraftLocation(entry.location);
    setDraftMedia(entry.media);
  }

  async function handleDeleteEntry(entryId: string) {
    if (!activeJourney) return;
    await removeEntry(activeJourney.id, entryId);
    if (editingEntryId === entryId) {
      resetDraft();
    }
  }

  async function handleSaveEntry() {
    if (!activeJourney) return;
    const text = entryText.trim();
    const tags = parseTagsInput(entryTagsInput);
    if (!text && draftMedia.length === 0 && !draftLocation && tags.length === 0) {
      Alert.alert(t('journey.recordEmptyTitle'), t('journey.recordEmptyBody'));
      return;
    }

    setSavingEntry(true);
    try {
      if (editingEntryId) {
        const original = activeJourney.entries.find((e) => e.id === editingEntryId);
        const entry: TimelineEntry = {
          id: editingEntryId,
          createdAt: original?.createdAt ?? new Date().toISOString(),
          text,
          tags,
          location: draftLocation,
          media: draftMedia,
        };
        await updateEntry(activeJourney.id, entry);
      } else {
        const entry: TimelineEntry = {
          id: createId('entry'),
          createdAt: new Date().toISOString(),
          text,
          tags,
          location: draftLocation,
          media: draftMedia,
        };
        await addEntry(activeJourney.id, entry);
      }
      resetDraft();
    } finally {
      setSavingEntry(false);
    }
  }

  // ---- Handlers: template CRUD -------------------------------------------

  async function updateTemplateConfig(next: EntryTemplateConfig) {
    setTemplateConfig(next);
    await saveEntryTemplateConfig(locale, next);
  }

  async function handleSaveTemplate(
    label: string,
    text: string,
    tags: string[],
    editingId: string | null,
  ) {
    const templates = templateConfig[templateKind];
    const nextTemplate: EntryTemplate = {
      id: editingId ?? createId(`template-${templateKind}`),
      label,
      text,
      tags,
    };
    const nextTemplates = editingId
      ? templates.map((t) => (t.id === editingId ? nextTemplate : t))
      : [...templates, nextTemplate];
    await updateTemplateConfig({ ...templateConfig, [templateKind]: nextTemplates });
  }

  async function handleRemoveTemplate(templateId: string) {
    const templates = templateConfig[templateKind];
    const nextTemplates = templates.filter((t) => t.id !== templateId);
    if (nextTemplates.length === 0) return; // guarded by modal
    await updateTemplateConfig({ ...templateConfig, [templateKind]: nextTemplates });
  }

  async function handleResetTemplates() {
    const defaults = getDefaultEntryTemplateConfig(locale);
    await updateTemplateConfig({
      ...templateConfig,
      [templateKind]: defaults[templateKind],
    });
  }

  // ---- Handlers: media / audio / location ---------------------------------

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
      if (result.canceled || result.assets.length === 0) return;
      setDraftMedia((prev) => [...prev, ...result.assets.map(buildTimelineMedia)]);
    } finally {
      setPickingMedia(false);
    }
  }

  async function captureMediaWithCamera(type: MediaType) {
    setPickingMedia(true);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t('journey.alertCameraDeniedTitle'), t('journey.alertCameraDeniedBody'));
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes:
          type === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        videoMaxDuration: 120,
      });
      if (result.canceled || result.assets.length === 0) return;
      setDraftMedia((prev) => [...prev, ...result.assets.map(buildTimelineMedia)]);
    } finally {
      setPickingMedia(false);
    }
  }

  async function startRecording() {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('journey.alertMicDeniedTitle'), t('journey.alertMicDeniedBody'));
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  }

  async function stopRecording() {
    if (!recorderState.isRecording) return;
    await audioRecorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = audioRecorder.uri;
    if (uri) {
      setDraftMedia((prev) => [
        ...prev,
        { id: createId('audio'), uri, type: 'audio' as const, thumbnailUri: undefined },
      ]);
    }
  }

  async function openAmapPlacePicker() {
    setOpeningLocationPicker(true);
    try {
      if (Platform.OS !== 'android') {
        Alert.alert(t('journey.alertMapUnsupportedTitle'), t('journey.alertMapUnsupportedBody'));
        return;
      }
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
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
      router.push({ pathname: '/location-picker', params: initial ? { initial } : {} });
    } catch (error) {
      void logLocalError('JourneyScreen', error, { stage: 'open-map-picker' });
      Alert.alert(
        t('journey.alertOpenMapFailedTitle'),
        t('journey.alertOpenMapFailedBody', { uri: getLocalLogFileUri() }),
      );
    } finally {
      setOpeningLocationPicker(false);
    }
  }

  // ---- Render -------------------------------------------------------------

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
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 12 }]}
      >
        {/* Page header */}
        <View style={styles.pageHeader}>
          <Text style={[styles.pageTitle, pageTitleColor]}>{t('journey.screenTitle')}</Text>
        </View>
        <Text style={[styles.pageSubTitle, pageSubTitleColor]}>
          {t('journey.screenSummary', {
            count: completedJourneysCount,
            status: activeJourney ? t('journey.statusActive') : t('journey.statusInactive'),
          })}
        </Text>

        {/* Create or Active journey card */}
        {!activeJourney ? (
          <JourneyCreateCard
            journeyTitle={journeyTitle}
            onChangeTitle={setJourneyTitle}
            journeyTagsInput={journeyTagsInput}
            onChangeTagsInput={setJourneyTagsInput}
            journeyKind={journeyKind}
            onChangeKind={setJourneyKind}
            creating={creating}
            onCreateJourney={handleCreateJourney}
          />
        ) : (
          <>
            <ActiveJourneyCard
              activeJourney={activeJourney}
              onEndJourney={handleEndJourney}
              locationTracking={locationTracking}
              trackingBusy={trackingBusy}
              onLocationTrackingChange={handleTrackingChange}
              editingEntryId={editingEntryId}
              entryText={entryText}
              onEntryTextChange={setEntryText}
              entryTagsInput={entryTagsInput}
              onEntryTagsInputChange={setEntryTagsInput}
              draftLocation={draftLocation}
              onRemoveDraftLocation={() => setDraftLocation(undefined)}
              draftMedia={draftMedia}
              onRemoveDraftMedia={(id) =>
                setDraftMedia((prev) => prev.filter((m) => m.id !== id))
              }
              entryTemplates={entryTemplates}
              onApplyTemplate={(template) => {
                const text = entryText.trim();
                const nextText = text
                  ? `${text}\n${template.text}`
                  : template.text;
                const currentTags = parseTagsInput(entryTagsInput);
                const merged = Array.from(new Set([...currentTags, ...template.tags]));
                setEntryText(nextText);
                setEntryTagsInput(merged.join(', '));
              }}
              onOpenTemplateModal={() => setTemplateModalVisible(true)}
              savingEntry={savingEntry}
              onSaveEntry={handleSaveEntry}
              onResetDraft={resetDraft}
              openingLocationPicker={openingLocationPicker}
              onOpenLocationPicker={openAmapPlacePicker}
              pickingMedia={pickingMedia}
              onPickMediaFromLibrary={pickMediaFromLibrary}
              onCapturePhoto={() => captureMediaWithCamera('photo')}
              onCaptureVideo={() => captureMediaWithCamera('video')}
              isRecording={recorderState.isRecording}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
            />

            {/* Timeline */}
            {activeJourney.entries.length > 0 ? (
              <TimelineList
                entries={activeJourney.entries}
                onEditEntry={startEditEntry}
                onDeleteEntry={handleDeleteEntry}
                onPreviewMedia={setPreviewMedia}
              />
            ) : null}
          </>
        )}

        {/* Template modal */}
        <TemplateModal
          visible={templateModalVisible}
          onClose={() => setTemplateModalVisible(false)}
          templateKind={templateKind}
          entryTemplates={entryTemplates}
          onSave={handleSaveTemplate}
          onRemove={handleRemoveTemplate}
          onReset={handleResetTemplates}
        />

        {/* Media preview */}
        <MediaPreviewModal
          previewMedia={previewMedia}
          onClose={() => setPreviewMedia(null)}
        />
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Remaining styles
// ---------------------------------------------------------------------------

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
});
