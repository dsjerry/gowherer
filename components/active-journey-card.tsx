import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { AudioPlayer } from '@/components/audio-player';
import { MediaVideoCover } from '@/components/media-viewers';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { JOURNEY_COST_MODES } from '@/lib/journey-cost';
import {
  Journey,
  JourneyCostMode,
  JourneyKind,
  TimelineLocation,
  TimelineMedia,
} from '@/types/journey';
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

  // Entry cost draft
  draftCostMode: JourneyCostMode;
  onDraftCostModeChange: (mode: JourneyCostMode) => void;
  draftCostAmount: string;
  onDraftCostAmountChange: (amount: string) => void;
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
  draftCostMode,
  onDraftCostModeChange,
  draftCostAmount,
  onDraftCostAmountChange,
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
    borderColor: isDark ? '#8b5a3c' : '#e8c3ae',
    backgroundColor: isDark ? '#2c2521' : '#fff8f3',
  };
  const themedGhostButtonText = {
    color: isDark ? '#f0b48f' : '#a84f2b',
  };
  const themedTrackingPanel = {
    backgroundColor: isDark ? '#12242a' : '#f0f6f3',
    borderColor: isDark ? '#284044' : '#e1ebe5',
  };
  const themedLocationPanel = {
    backgroundColor: isDark ? '#101b22' : '#f7f9f7',
    borderColor: isDark ? '#2b3d43' : '#e1e8e3',
  };
  const themedSectionDivider = { backgroundColor: isDark ? '#33444a' : '#e8ede9' };
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
  const themedCostChipSelected = {
    borderColor: '#0f766e',
    backgroundColor: isDark ? '#134e4a' : '#ccfbf1',
  };
  const themedCostChipTextSelected = { color: isDark ? '#5eead4' : '#0f766e' };
  const themedMediaBox = {
    borderColor: isDark ? '#334155' : '#e2e8f0',
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
  };
  const themedMediaFooter = { backgroundColor: isDark ? '#1e293b' : '#f8fafc' };
  const themedBadge = { color: isDark ? '#e2e8f0' : '#0f172a' };

  return (
    <View style={[styles.card, themedCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.headerInfo}>
          <View style={styles.journeyMetaRow}>
            <View style={[styles.kindBadge, { backgroundColor: isDark ? '#173c3a' : '#e4f2ec' }]}>
              <Text style={[styles.kindBadgeText, { color: isDark ? '#5eead4' : '#0f766e' }]}>
                {kindLabel(activeJourney.kind)}
              </Text>
            </View>
            <Text style={[styles.mutedText, themedMuted]}>
              {formatDateTime(activeJourney.createdAt)}
            </Text>
          </View>
          <Text style={[styles.sectionTitle, themedSectionTitle]}>{activeJourney.title}</Text>
          <Text style={[styles.mutedText, themedMuted]}>
            {t('journey.entryCount', { count: activeJourney.entries.length })}
          </Text>
        </View>
        <Pressable style={[styles.ghostButton, themedGhostButton]} onPress={onEndJourney}>
          <MaterialIcons name="flag" size={15} color={themedGhostButtonText.color} />
          <Text style={[styles.ghostButtonText, themedGhostButtonText]}>
            {t('journey.endJourney')}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.trackingPanel, themedTrackingPanel]}>
        <View style={styles.trackingInfo}>
          <MaterialIcons name="my-location" size={18} color={isDark ? '#5eead4' : '#0f766e'} />
          <View style={styles.trackingCopy}>
            <Text style={[styles.trackingLabel, themedSectionTitle]}>
              {t('journey.locationTracking')}
            </Text>
            {locationTracking && activeJourney.trackLocations.length > 0 ? (
              <Text style={[styles.trackingHint, themedMuted]}>
                {t('journey.trackingPoints', { count: activeJourney.trackLocations.length })}
              </Text>
            ) : null}
          </View>
        </View>
        <Switch
          value={locationTracking}
          onValueChange={onLocationTrackingChange}
          disabled={trackingBusy}
          trackColor={{ false: '#94a3b8', true: '#0f766e' }}
          thumbColor="#ffffff"
        />
      </View>

      <View style={[styles.sectionDivider, themedSectionDivider]} />
      <View style={styles.editorHeading}>
        <View style={[styles.editorIcon, { backgroundColor: isDark ? '#173c3a' : '#e4f2ec' }]}>
          <MaterialIcons name="edit-note" size={18} color={isDark ? '#5eead4' : '#0f766e'} />
        </View>
        <Text style={[styles.sectionTitle, themedSectionTitle]}>
          {t('journey.recordEditorTitle', {
            mode: editingEntryId ? t('journey.modeEdit') : t('journey.modeCreate'),
          })}
        </Text>
      </View>

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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.templateRow}>
          {entryTemplates.map((template) => (
            <Pressable
              key={template.id}
              style={[styles.templateChip, themedTemplateChip]}
              onPress={() => onApplyTemplate(template)}
            >
              <Text style={[styles.templateChipText, themedTemplateChipText]}>
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

      <View style={styles.costSection}>
        <View style={styles.costSectionHeader}>
          <MaterialIcons name="payments" size={16} color={isDark ? '#94a3b8' : '#718078'} />
          <Text style={[styles.costLabel, themedMuted]}>{t('journey.cost.title')}</Text>
          <Text style={[styles.costOptional, themedMuted]}>{t('common.optional')}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.costModes}>
          {JOURNEY_COST_MODES.map((item) => {
            const selected = item === draftCostMode;
            return (
              <Pressable
                key={item}
                style={[styles.costChip, selected ? themedCostChipSelected : themedTemplateChip]}
                onPress={() => onDraftCostModeChange(item)}
              >
                <Text
                  style={[
                    styles.costChipText,
                    selected ? themedCostChipTextSelected : themedTemplateChipText,
                  ]}
                >
                  {t(`journey.costMode.${item}`)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[styles.costAmountRow, themedInput]}>
          <MaterialIcons name="currency-yen" size={17} color={isDark ? '#8da19f' : '#7b8d84'} />
          <TextInput
            value={draftCostAmount}
            onChangeText={onDraftCostAmountChange}
            placeholder={t('journey.cost.amountPlaceholder')}
            placeholderTextColor={themedPlaceholder}
            style={[styles.costAmountInput, { color: isDark ? '#e2e8f0' : '#0f172a' }]}
            keyboardType="decimal-pad"
          />
          {draftCostAmount ? (
            <Pressable
              onPress={() => onDraftCostAmountChange('')}
              accessibilityRole="button"
              accessibilityLabel={t('common.remove')}
            >
              <MaterialIcons name="close" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.locationPanel, themedLocationPanel]}>
        <MaterialIcons name="place" size={18} color={isDark ? '#5eead4' : '#0f766e'} />
        <View style={styles.locationTextContainer}>
          <Text style={[styles.locationLabel, themedMuted]}>{t('journey.locationLabel')}</Text>
          <Text style={[styles.locationText, themedLocationText]} numberOfLines={2}>
            {draftLocation
              ? `${draftLocation.placeName ? `${draftLocation.placeName} · ` : ''}${draftLocation.latitude.toFixed(5)}, ${draftLocation.longitude.toFixed(5)}`
              : t('common.notAdded')}
          </Text>
        </View>
        {draftLocation ? (
          <Pressable style={styles.inlineAction} onPress={onRemoveDraftLocation}>
            <Text style={styles.linkText}>{t('journey.removeLocation')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Draft media */}
      {draftMedia.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
          {draftMedia.map((item) =>
            item.type === 'audio' ? (
              <View key={item.id} style={[styles.mediaPreviewBox, themedMediaBox]}>
                <AudioPlayer uri={item.uri} label={t('journey.audioBadge')} />
                <View style={[styles.mediaFooter, themedMediaFooter]}>
                  <Text style={[styles.mediaBadge, themedBadge]}>{t('journey.audioBadge')}</Text>
                  <Pressable onPress={() => onRemoveDraftMedia(item.id)}>
                    <Text style={styles.linkText}>{t('common.delete')}</Text>
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
                    <Text style={[styles.mediaPlaceholderText, { color: '#ffffff' }]}>
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
                  <Pressable onPress={() => onRemoveDraftMedia(item.id)}>
                    <Text style={styles.linkText}>{t('common.delete')}</Text>
                  </Pressable>
                </View>
              </View>
            ),
          )}
        </ScrollView>
      ) : null}

      {/* Media & location toolbar */}
      <View style={styles.toolRow}>
        <Pressable
          style={[styles.toolButton, themedSecondaryButton]}
          onPress={onOpenLocationPicker}
          disabled={openingLocationPicker}
        >
          <MaterialIcons name="place" size={22} color={isDark ? '#5eead4' : '#0f766e'} />
          <Text style={[styles.toolButtonLabel, themedSecondaryButtonText]} numberOfLines={2}>
            {openingLocationPicker ? t('journey.openingMap') : t('journey.addLocation')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toolButton, themedSecondaryButton]}
          onPress={onPickMediaFromLibrary}
          disabled={pickingMedia}
        >
          <MaterialIcons name="photo-library" size={22} color={isDark ? '#5eead4' : '#0f766e'} />
          <Text style={[styles.toolButtonLabel, themedSecondaryButtonText]} numberOfLines={2}>
            {pickingMedia ? t('journey.readingAlbum') : t('journey.addFromAlbum')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toolButton, themedSecondaryButton]}
          onPress={onCapturePhoto}
          disabled={pickingMedia}
        >
          <MaterialIcons name="photo-camera" size={22} color={isDark ? '#5eead4' : '#0f766e'} />
          <Text style={[styles.toolButtonLabel, themedSecondaryButtonText]} numberOfLines={2}>
            {pickingMedia ? t('journey.processingMedia') : t('journey.takePhoto')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toolButton, themedSecondaryButton]}
          onPress={onCaptureVideo}
          disabled={pickingMedia}
        >
          <MaterialIcons name="videocam" size={22} color={isDark ? '#5eead4' : '#0f766e'} />
          <Text style={[styles.toolButtonLabel, themedSecondaryButtonText]} numberOfLines={2}>
            {pickingMedia ? t('journey.processingMedia') : t('journey.takeVideo')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.toolButton,
            themedSecondaryButton,
            isRecording && {
              backgroundColor: isDark ? '#7f1d1d' : '#fee2e2',
            },
          ]}
          onPress={isRecording ? onStopRecording : onStartRecording}
          disabled={pickingMedia}
        >
          <MaterialIcons
            name={isRecording ? 'stop' : 'mic'}
            size={22}
            color={isRecording ? (isDark ? '#f87171' : '#dc2626') : isDark ? '#5eead4' : '#0f766e'}
          />
          <Text
            style={[
              styles.toolButtonLabel,
              themedSecondaryButtonText,
              isRecording && {
                color: isDark ? '#f87171' : '#dc2626',
                fontWeight: '700',
              },
            ]}
            numberOfLines={2}
          >
            {isRecording ? t('journey.stopRecording') : t('journey.recordAudio')}
          </Text>
        </Pressable>
      </View>

      {/* Save / Cancel */}
      <Pressable style={styles.primaryButton} onPress={onSaveEntry} disabled={savingEntry}>
        <Text style={styles.primaryButtonText}>
          {savingEntry
            ? t('journey.savingEntry')
            : editingEntryId
              ? t('journey.updateEntry')
              : t('journey.saveEntry')}
        </Text>
      </Pressable>
      {editingEntryId ? (
        <Pressable style={[styles.cancelButton, themedCancelButton]} onPress={onResetDraft}>
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
    borderRadius: 22,
    padding: 17,
    borderWidth: 1,
    borderColor: '#e3e9e5',
    gap: 12,
    shadowColor: '#1a382f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 7,
    elevation: 1,
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
    gap: 4,
  },
  journeyMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  kindBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10231f',
  },
  mutedText: {
    color: '#718078',
    fontSize: 11,
  },
  ghostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  ghostButtonText: {
    fontWeight: '700',
    fontSize: 11,
  },
  trackingPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 7,
  },
  trackingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  trackingCopy: {
    flex: 1,
    gap: 2,
  },
  trackingLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  trackingHint: {
    fontSize: 10,
  },
  sectionDivider: {
    height: 1,
    marginVertical: 1,
  },
  editorHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editorIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
  costSection: {
    gap: 8,
  },
  costSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  costLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  costOptional: {
    fontSize: 10,
    marginLeft: 'auto',
  },
  costModes: {
    flexGrow: 0,
    minHeight: 34,
  },
  costChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
    marginRight: 6,
  },
  costChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  costAmountRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#e1e8e3',
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  costAmountInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 9,
    fontSize: 13,
  },
  locationPanel: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  locationTextContainer: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  locationText: {
    color: '#334155',
    fontSize: 12,
    flexShrink: 1,
  },
  inlineAction: {
    flexShrink: 0,
    paddingTop: 1,
  },
  linkText: {
    color: '#0f766e',
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
  toolRow: {
    flexDirection: 'row',
    gap: 6,
  },
  toolButton: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
  },
  toolButtonLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 14,
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
