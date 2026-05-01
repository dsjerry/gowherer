import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AudioPlayer } from '@/components/audio-player';
import { MediaVideoCover } from '@/components/media-viewers';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Journey, JourneyKind, TimelineLocation, TimelineMedia } from '@/types/journey';
import { EntryTemplate } from '@/types/template';

interface Props {
  activeJourney: Journey;

  // End journey
  onEndJourney: () => void;

  // Location tracking
  locationTracking: boolean;
  trackingBusy: boolean;
  onLocationTrackingChange: (value: boolean) => void;

  // Entry draft
  editingEntryId: string | null;
  entryText: string;
  onEntryTextChange: (text: string) => void;
  entryTagsInput: string;
  onEntryTagsInputChange: (text: string) => void;
  draftLocation: TimelineLocation | undefined;
  onRemoveDraftLocation: () => void;
  draftMedia: TimelineMedia[];
  onRemoveDraftMedia: (id: string) => void;

  // Templates
  entryTemplates: EntryTemplate[];
  onApplyTemplate: (template: EntryTemplate) => void;
  onOpenTemplateModal: () => void;

  // Actions
  savingEntry: boolean;
  onSaveEntry: () => void;
  onResetDraft: () => void;

  // Media & Location pickers
  openingLocationPicker: boolean;
  onOpenLocationPicker: () => void;
  pickingMedia: boolean;
  onPickMediaFromLibrary: () => void;
  onCapturePhoto: () => void;
  onCaptureVideo: () => void;

  // Audio
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

function mediaPreviewUri(media: TimelineMedia) {
  if (media.type === 'video') return media.thumbnailUri;
  if (media.type === 'audio') return undefined;
  return media.uri;
}

export function ActiveJourneyCard({
  activeJourney,
  locationTracking,
  trackingBusy,
  onEndJourney,
  onLocationTrackingChange,
  editingEntryId,
  entryText,
  onEntryTextChange,
  entryTagsInput,
  onEntryTagsInputChange,
  draftLocation,
  onRemoveDraftLocation,
  draftMedia,
  onRemoveDraftMedia,
  entryTemplates,
  onApplyTemplate,
  onOpenTemplateModal,
  savingEntry,
  onSaveEntry,
  onResetDraft,
  openingLocationPicker,
  onOpenLocationPicker,
  pickingMedia,
  onPickMediaFromLibrary,
  onCapturePhoto,
  onCaptureVideo,
  isRecording,
  onStartRecording,
  onStopRecording,
}: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  function kindLabel(kind: JourneyKind) {
    return t(kind === 'travel' ? 'journey.kind.travel' : 'journey.kind.commute');
  }

  function formatDateTime(iso: string) {
    const date = new Date(iso);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  }

  const themedCard = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
  };
  const themedSectionTitle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const themedMuted = { color: isDark ? '#94a3b8' : '#64748b' };
  const themedGhostButton = {
    borderColor: isDark ? '#f59e0b' : '#f59e0b',
    backgroundColor: isDark ? '#1f2937' : '#ffffff',
  };
  const themedGhostButtonText = {
    color: isDark ? '#fbbf24' : '#b45309',
  };
  const themedLabel = { color: isDark ? '#cbd5e1' : '#334155' };
  const themedInput = {
    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    borderColor: isDark ? '#334155' : '#cbd5e1',
    color: isDark ? '#e2e8f0' : '#0f172a',
  };
  const themedPlaceholder = isDark ? '#94a3b8' : '#64748b';
  const themedLocationText = { color: isDark ? '#cbd5e1' : '#334155' };
  const themedSecondaryButton = { backgroundColor: isDark ? '#334155' : '#e2e8f0' };
  const themedSecondaryButtonText = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const themedCancelButton = {
    borderColor: isDark ? '#334155' : '#cbd5e1',
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
  };
  const themedCancelButtonText = { color: isDark ? '#cbd5e1' : '#334155' };
  const themedTemplateChip = {
    borderColor: isDark ? '#334155' : '#cbd5e1',
    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
  };
  const themedTemplateChipText = { color: isDark ? '#cbd5e1' : '#334155' };
  const themedMediaBox = {
    borderColor: isDark ? '#334155' : '#e2e8f0',
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
  };
  const themedMediaFooter = { backgroundColor: isDark ? '#1e293b' : '#f8fafc' };
  const themedBadge = { color: isDark ? '#e2e8f0' : '#0f172a' };

  return (
    <View style={[styles.card, themedCard]}>
      {/* Card header */}
      <View style={styles.cardHeader}>
        <View style={styles.headerInfo}>
          <Text style={[styles.sectionTitle, themedSectionTitle]}>
            {activeJourney.title}
          </Text>
          <Text style={[styles.mutedText, themedMuted]}>
            {t('journey.currentJourneyMeta', {
              kind: kindLabel(activeJourney.kind),
              date: formatDateTime(activeJourney.createdAt),
              count: activeJourney.entries.length,
            })}
          </Text>
        </View>
        <Pressable
          style={[styles.ghostButton, themedGhostButton]}
          onPress={onEndJourney}
        >
          <Text style={[styles.ghostButtonText, themedGhostButtonText]}>
            {t('journey.endJourney')}
          </Text>
        </Pressable>
      </View>

      {/* Location tracking */}
      <View style={styles.trackingRow}>
        <Text style={[styles.trackingLabel, themedSectionTitle]}>
          {t('journey.locationTracking')}
        </Text>
        <Switch
          value={locationTracking}
          onValueChange={onLocationTrackingChange}
          disabled={trackingBusy}
          trackColor={{ false: '#94a3b8', true: '#0f766e' }}
          thumbColor="#ffffff"
        />
      </View>
      {locationTracking && activeJourney.trackLocations.length > 0 ? (
        <Text style={[styles.mutedText, themedMuted]}>
          {t('journey.trackingPoints', {
            count: activeJourney.trackLocations.length,
          })}
        </Text>
      ) : null}

      {/* Entry editor */}
      <Text style={[styles.sectionTitle, themedSectionTitle]}>
        {t('journey.recordEditorTitle', {
          mode: editingEntryId
            ? t('journey.modeEdit')
            : t('journey.modeCreate'),
        })}
      </Text>

      {/* Template shortcuts */}
      <View style={styles.templateWrap}>
        <View style={styles.templateHeaderRow}>
          <Text style={[styles.mutedText, themedMuted]}>
            {t('journey.templateShortcuts', {
              kind: kindLabel(activeJourney.kind),
            })}
          </Text>
          <Pressable onPress={onOpenTemplateModal}>
            <Text style={styles.linkText}>{t('journey.manageTemplates')}</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.templateRow}
        >
          {entryTemplates.map((template) => (
            <Pressable
              key={template.id}
              style={[styles.templateChip, themedTemplateChip]}
              onPress={() => onApplyTemplate(template)}
            >
              <Text
                style={[styles.templateChipText, themedTemplateChipText]}
              >
                {template.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Entry inputs */}
      <TextInput
        value={entryText}
        onChangeText={onEntryTextChange}
        placeholder={t('journey.entryTextPlaceholder')}
        placeholderTextColor={themedPlaceholder}
        style={[styles.input, styles.textArea, themedInput]}
        multiline
      />
      <TextInput
        value={entryTagsInput}
        onChangeText={onEntryTagsInputChange}
        placeholder={t('journey.entryTagsPlaceholder')}
        placeholderTextColor={themedPlaceholder}
        style={[styles.input, themedInput]}
      />

      {/* Location display */}
      <View style={styles.actionRow}>
        <View style={styles.locationTextContainer}>
          <Text style={[styles.locationText, themedLocationText]}>
            {t('journey.locationLabel')}
            {draftLocation
              ? `${draftLocation.placeName ? `${draftLocation.placeName} · ` : ''}${draftLocation.latitude.toFixed(5)}, ${draftLocation.longitude.toFixed(5)}`
              : '-'}
          </Text>
        </View>
        {draftLocation ? (
          <Pressable
            style={styles.inlineAction}
            onPress={onRemoveDraftLocation}
          >
            <Text style={styles.linkText}>
              {t('journey.removeLocation')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Draft media */}
      {draftMedia.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.mediaRow}
        >
          {draftMedia.map((item) =>
            item.type === 'audio' ? (
              <View key={item.id} style={[styles.mediaPreviewBox, themedMediaBox]}>
                <AudioPlayer
                  uri={item.uri}
                  label={t('journey.audioBadge')}
                />
                <View style={[styles.mediaFooter, themedMediaFooter]}>
                  <Text style={[styles.mediaBadge, themedBadge]}>
                    {t('journey.audioBadge')}
                  </Text>
                  <Pressable
                    onPress={() => onRemoveDraftMedia(item.id)}
                  >
                    <Text style={styles.linkText}>
                      {t('common.delete')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View key={item.id} style={[styles.mediaPreviewBox, themedMediaBox]}>
                {mediaPreviewUri(item) ? (
                  <Image
                    source={{ uri: mediaPreviewUri(item) }}
                    style={styles.mediaPreview}
                    contentFit="cover"
                  />
                ) : item.type === 'video' ? (
                  <MediaVideoCover uri={item.uri} />
                ) : (
                  <View
                    style={[
                      styles.mediaPlaceholder,
                      { backgroundColor: isDark ? '#334155' : '#0f172a' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.mediaPlaceholderText,
                        { color: '#ffffff' },
                      ]}
                    >
                      {t('journey.mediaBadgeVideo')}
                    </Text>
                  </View>
                )}
                <View style={[styles.mediaFooter, themedMediaFooter]}>
                  <Text style={[styles.mediaBadge, themedBadge]}>
                    {item.type === 'video'
                      ? t('journey.mediaBadgeVideo')
                      : t('journey.mediaBadgePhoto')}
                  </Text>
                  <Pressable
                    onPress={() => onRemoveDraftMedia(item.id)}
                  >
                    <Text style={styles.linkText}>
                      {t('common.delete')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )
          )}
        </ScrollView>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.secondaryButton, themedSecondaryButton]}
          onPress={onOpenLocationPicker}
          disabled={openingLocationPicker}
        >
          <Text style={[styles.secondaryButtonText, themedSecondaryButtonText]}>
            {openingLocationPicker
              ? t('journey.openingMap')
              : `📍 ${t('journey.addLocation')}`}
          </Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.secondaryButton, themedSecondaryButton]}
          onPress={onPickMediaFromLibrary}
          disabled={pickingMedia}
        >
          <Text style={[styles.secondaryButtonText, themedSecondaryButtonText]}>
            {pickingMedia
              ? t('journey.readingAlbum')
              : `🖼️ ${t('journey.addFromAlbum')}`}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, themedSecondaryButton]}
          onPress={onCapturePhoto}
          disabled={pickingMedia}
        >
          <Text style={[styles.secondaryButtonText, themedSecondaryButtonText]}>
            {pickingMedia
              ? t('journey.processingMedia')
              : `📷 ${t('journey.takePhoto')}`}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, themedSecondaryButton]}
          onPress={onCaptureVideo}
          disabled={pickingMedia}
        >
          <Text style={[styles.secondaryButtonText, themedSecondaryButtonText]}>
            {pickingMedia
              ? t('journey.processingMedia')
              : `🎥 ${t('journey.takeVideo')}`}
          </Text>
        </Pressable>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.secondaryButton, themedSecondaryButton]}
          onPress={() =>
            isRecording ? onStopRecording() : onStartRecording()
          }
          disabled={pickingMedia}
        >
          <Text style={[styles.secondaryButtonText, themedSecondaryButtonText]}>
            {isRecording
              ? `⏹️ ${t('journey.stopRecording')}`
              : `🎙️ ${t('journey.recordAudio')}`}
          </Text>
        </Pressable>
      </View>

      {/* Save / Cancel */}
      <Pressable
        style={styles.primaryButton}
        onPress={onSaveEntry}
        disabled={savingEntry}
      >
        <Text style={styles.primaryButtonText}>
          {savingEntry
            ? t('journey.savingEntry')
            : editingEntryId
              ? t('journey.updateEntry')
              : t('journey.saveEntry')}
        </Text>
      </Pressable>
      {editingEntryId ? (
        <Pressable
          style={[styles.cancelButton, themedCancelButton]}
          onPress={onResetDraft}
        >
          <Text style={[styles.cancelButtonText, themedCancelButtonText]}>
            {t('journey.cancelEdit')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerInfo: {
    flex: 1,
    minWidth: 0,
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
  trackingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  trackingLabel: {
    fontSize: 15,
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
  actionRow: {
    flexDirection: 'row',
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
});
