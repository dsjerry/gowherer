import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { AudioPlayer } from "@/components/audio-player";
import { MediaVideoCover } from "@/components/media-viewers";
import { useI18n } from "@/hooks/locale-preference";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMaterialTheme } from "@/hooks/use-material-theme";
import {
  Journey,
  JourneyKind,
  TimelineLocation,
  TimelineMedia,
} from "@/types/journey";
import { EntryTemplate } from "@/types/template";

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
  if (media.type === "video") return media.thumbnailUri;
  if (media.type === "audio") return undefined;
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
  const isDark = colorScheme === "dark";
  const { colors: c } = useMaterialTheme();

  function kindLabel(kind: JourneyKind) {
    return t(
      kind === "travel" ? "journey.kind.travel" : "journey.kind.commute",
    );
  }

  function formatDateTime(iso: string) {
    const date = new Date(iso);
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${mm}/${dd} ${hh}:${min}`;
  }

  const themedCard = {
    backgroundColor: c.surface,
    borderColor: c.border,
  };
  const themedSectionTitle = { color: c.textPrimary };
  const heroTitle = { color: c.fgOn };
  const heroMuted = { color: "rgba(255,255,255,0.76)" };
  const heroGhost = {
    borderColor: c.accent,
    backgroundColor: c.accent,
  };
  const heroGhostText = { color: c.fg };
  const themedMuted = { color: c.textTertiary };
  const themedInput = {
    backgroundColor: "transparent",
    borderColor: c.border,
    color: c.textPrimary,
  };
  const themedPlaceholder = c.textTertiary;
  const themedLocationText = { color: c.textSecondary };
  const themedSecondaryButton = {
    backgroundColor: c.surface,
    borderColor: c.border,
    borderWidth: 1,
  };
  const themedSecondaryButtonText = { color: c.textSecondary };
  const themedCancelButton = {
    borderColor: c.border,
    backgroundColor: "transparent",
    borderWidth: 1,
  };
  const themedCancelButtonText = { color: c.textSecondary };
  const themedTemplateChip = {
    borderColor: c.border,
    backgroundColor: c.surface,
    borderWidth: 1,
  };
  const themedTemplateChipText = { color: c.textSecondary };
  const themedMediaBox = {
    borderColor: c.border,
    backgroundColor: c.bg,
    borderWidth: 1,
  };
  const themedMediaFooter = { backgroundColor: c.surface };
  const themedBadge = { color: c.textPrimary };

  return (
    <View style={styles.stack}>
      <View
        style={[
          styles.activeHero,
          { backgroundColor: c.fg, borderColor: c.fg },
        ]}
      >
        {/* Card header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerInfo}>
            <Text style={[styles.sectionTitle, heroTitle]}>
              {activeJourney.title}
            </Text>
            <Text style={[styles.mutedText, heroMuted]}>
              {t("journey.currentJourneyMeta", {
                kind: kindLabel(activeJourney.kind),
                date: formatDateTime(activeJourney.createdAt),
                count: activeJourney.entries.length,
              })}
            </Text>
          </View>
          <Pressable
            style={[styles.ghostButton, heroGhost]}
            onPress={onEndJourney}
          >
            <Text style={[styles.ghostButtonText, heroGhostText]}>
              {t("journey.endJourney")}
            </Text>
          </Pressable>
        </View>

        {/* Location tracking */}
        <View style={styles.trackingRow}>
          <Text style={[styles.trackingLabel, heroTitle]}>
            {t("journey.locationTracking")}
          </Text>
          <Switch
            value={locationTracking}
            onValueChange={onLocationTrackingChange}
            disabled={trackingBusy}
            trackColor={{ false: c.muted, true: c.fg }}
            thumbColor="#ffffff"
          />
        </View>
        {locationTracking && activeJourney.trackLocations.length > 0 ? (
          <Text style={[styles.mutedText, heroMuted]}>
            {t("journey.trackingPoints", {
              count: activeJourney.trackLocations.length,
            })}
          </Text>
        ) : null}
      </View>

      <View style={[styles.card, themedCard]}>
        {/* Entry editor */}
        <Text style={[styles.sectionTitle, themedSectionTitle]}>
          {t("journey.recordEditorTitle", {
            mode: editingEntryId
              ? t("journey.modeEdit")
              : t("journey.modeCreate"),
          })}
        </Text>

        {/* Template shortcuts */}
        <View style={styles.templateWrap}>
          <View style={styles.templateHeaderRow}>
            <Text style={[styles.mutedText, themedMuted]}>
              {t("journey.templateShortcuts", {
                kind: kindLabel(activeJourney.kind),
              })}
            </Text>
            <Pressable onPress={onOpenTemplateModal}>
              <Text style={styles.linkText}>
                {t("journey.manageTemplates")}
              </Text>
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
          placeholder={t("journey.entryTextPlaceholder")}
          placeholderTextColor={themedPlaceholder}
          style={[styles.input, styles.textArea, themedInput]}
          multiline
        />
        <TextInput
          value={entryTagsInput}
          onChangeText={onEntryTagsInputChange}
          placeholder={t("journey.entryTagsPlaceholder")}
          placeholderTextColor={themedPlaceholder}
          style={[styles.input, themedInput]}
        />

        {/* Location display */}
        <View style={styles.actionRow}>
          <View style={styles.locationTextContainer}>
            <Text style={[styles.locationText, themedLocationText]}>
              {t("journey.locationLabel")}
              {draftLocation
                ? `${draftLocation.placeName ? `${draftLocation.placeName} · ` : ""}${draftLocation.latitude.toFixed(5)}, ${draftLocation.longitude.toFixed(5)}`
                : "-"}
            </Text>
          </View>
          {draftLocation ? (
            <Pressable
              style={styles.inlineAction}
              onPress={onRemoveDraftLocation}
            >
              <Text style={styles.linkText}>{t("journey.removeLocation")}</Text>
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
              item.type === "audio" ? (
                <View
                  key={item.id}
                  style={[styles.mediaPreviewBox, themedMediaBox]}
                >
                  <AudioPlayer uri={item.uri} label={t("journey.audioBadge")} />
                  <View style={[styles.mediaFooter, themedMediaFooter]}>
                    <Text style={[styles.mediaBadge, themedBadge]}>
                      {t("journey.audioBadge")}
                    </Text>
                    <Pressable onPress={() => onRemoveDraftMedia(item.id)}>
                      <Text style={styles.linkText}>{t("common.delete")}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View
                  key={item.id}
                  style={[styles.mediaPreviewBox, themedMediaBox]}
                >
                  {mediaPreviewUri(item) ? (
                    <Image
                      source={{ uri: mediaPreviewUri(item) }}
                      style={styles.mediaPreview}
                      contentFit="cover"
                    />
                  ) : item.type === "video" ? (
                    <MediaVideoCover uri={item.uri} />
                  ) : (
                    <View
                      style={[
                        styles.mediaPlaceholder,
                        { backgroundColor: isDark ? "#334155" : "#0f172a" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.mediaPlaceholderText,
                          { color: "#ffffff" },
                        ]}
                      >
                        {t("journey.mediaBadgeVideo")}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.mediaFooter, themedMediaFooter]}>
                    <Text style={[styles.mediaBadge, themedBadge]}>
                      {item.type === "video"
                        ? t("journey.mediaBadgeVideo")
                        : t("journey.mediaBadgePhoto")}
                    </Text>
                    <Pressable onPress={() => onRemoveDraftMedia(item.id)}>
                      <Text style={styles.linkText}>{t("common.delete")}</Text>
                    </Pressable>
                  </View>
                </View>
              ),
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
            <MaterialIcons name="location-on" size={17} color={c.fg} />
            <Text
              style={[styles.secondaryButtonText, themedSecondaryButtonText]}
            >
              {openingLocationPicker
                ? t("journey.openingMap")
                : t("journey.addLocation")}
            </Text>
          </Pressable>
        </View>
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.secondaryButton, themedSecondaryButton]}
            onPress={onPickMediaFromLibrary}
            disabled={pickingMedia}
          >
            <MaterialIcons name="photo-library" size={17} color={c.fg} />
            <Text
              style={[styles.secondaryButtonText, themedSecondaryButtonText]}
            >
              {pickingMedia
                ? t("journey.readingAlbum")
                : t("journey.addFromAlbum")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, themedSecondaryButton]}
            onPress={onCapturePhoto}
            disabled={pickingMedia}
          >
            <MaterialIcons name="photo-camera" size={17} color={c.fg} />
            <Text
              style={[styles.secondaryButtonText, themedSecondaryButtonText]}
            >
              {pickingMedia
                ? t("journey.processingMedia")
                : t("journey.takePhoto")}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, themedSecondaryButton]}
            onPress={onCaptureVideo}
            disabled={pickingMedia}
          >
            <MaterialIcons name="videocam" size={17} color={c.fg} />
            <Text
              style={[styles.secondaryButtonText, themedSecondaryButtonText]}
            >
              {pickingMedia
                ? t("journey.processingMedia")
                : t("journey.takeVideo")}
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
            <MaterialIcons
              name={isRecording ? "stop" : "mic"}
              size={17}
              color={c.fg}
            />
            <Text
              style={[styles.secondaryButtonText, themedSecondaryButtonText]}
            >
              {isRecording
                ? t("journey.stopRecording")
                : t("journey.recordAudio")}
            </Text>
          </Pressable>
        </View>

        {/* Save / Cancel */}
        <Pressable
          style={[styles.primaryButton, { backgroundColor: c.accentSecondary }]}
          onPress={onSaveEntry}
          disabled={savingEntry}
        >
          <Text style={styles.primaryButtonText}>
            {savingEntry
              ? t("journey.savingEntry")
              : editingEntryId
                ? t("journey.updateEntry")
                : t("journey.saveEntry")}
          </Text>
        </Pressable>
        {editingEntryId ? (
          <Pressable
            style={[styles.cancelButton, themedCancelButton]}
            onPress={onResetDraft}
          >
            <Text style={[styles.cancelButtonText, themedCancelButtonText]}>
              {t("journey.cancelEdit")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
  activeHero: {
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  card: {
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerInfo: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  mutedText: {
    fontSize: 12,
  },
  ghostButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ghostButtonText: {
    fontWeight: "600",
    fontSize: 13,
  },
  trackingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  trackingLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  templateWrap: {
    gap: 6,
  },
  templateHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  templateRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 6,
  },
  templateChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  templateChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  locationTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  locationText: {
    fontSize: 13,
    flexShrink: 1,
  },
  inlineAction: {
    flexShrink: 0,
    paddingTop: 1,
  },
  linkText: {
    fontSize: 12,
    fontWeight: "600",
  },
  mediaRow: {
    maxHeight: 110,
  },
  mediaPreviewBox: {
    marginRight: 10,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    width: 110,
  },
  mediaPreview: {
    width: 110,
    height: 80,
  },
  mediaPlaceholder: {
    width: 110,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaPlaceholderText: {
    fontSize: 12,
    fontWeight: "700",
  },
  mediaFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  mediaBadge: {
    fontSize: 11,
    padding: 4,
  },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  primaryButton: {
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelButtonText: {
    fontWeight: "600",
  },
});
