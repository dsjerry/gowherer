import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { AudioPlayer } from "@/components/audio-player";
import { MediaVideoCover } from "@/components/media-viewers";
import { useI18n } from "@/hooks/locale-preference";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMaterialTheme } from "@/hooks/use-material-theme";
import { TimelineEntry, TimelineMedia } from "@/types/journey";

interface Props {
  entries: TimelineEntry[];
  onEditEntry: (entry: TimelineEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onPreviewMedia: (media: TimelineMedia) => void;
}

const TONE_COLORS = ["#6442d6", "#16a34a", "#f9ab00", "#0f766e"];

function formatDateTime(iso: string) {
  const date = new Date(iso);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${min}`;
}

function mediaPreviewUri(media: TimelineMedia) {
  if (media.type === "video") return media.thumbnailUri;
  if (media.type === "audio") return undefined;
  return media.uri;
}

export function TimelineList({
  entries,
  onEditEntry,
  onDeleteEntry,
  onPreviewMedia,
}: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { colors: c } = useMaterialTheme();

  const themedCard = {
    backgroundColor: c.surface,
    borderColor: c.border,
  };
  const themedSectionTitle = { color: c.textPrimary };
  const themedMuted = { color: c.textTertiary };
  const themedTime = { color: c.textTertiary };
  const themedText = { color: c.textPrimary };
  const themedTagChip = {
    backgroundColor: isDark ? "rgba(100,66,214,0.12)" : "rgba(100,66,214,0.06)",
    borderColor: isDark ? "rgba(100,66,214,0.24)" : "rgba(100,66,214,0.14)",
  };
  const themedTagChipText = { color: c.fg };
  const themedMediaBox = {
    borderColor: c.border,
    backgroundColor: c.bg,
  };
  const themedBadge = { color: c.textPrimary };

  return (
    <View style={[styles.card, themedCard]}>
      <Text style={[styles.sectionTitle, themedSectionTitle]}>
        {t("journey.timelineTitle")} · {entries.length} 条记录
      </Text>
      {entries.map((entry, index) => {
        const toneColor = TONE_COLORS[index % TONE_COLORS.length];
        return (
          <View key={entry.id} style={styles.timelineItem}>
            <View
              style={[
                styles.timelineDot,
                { backgroundColor: toneColor, borderColor: c.surface },
              ]}
            />
            <View style={styles.timelineContent}>
              <Text style={[styles.timelineTime, themedTime]}>
                {formatDateTime(entry.createdAt)}
              </Text>
              <View
                style={[
                  styles.timelineCard,
                  {
                    backgroundColor: isDark
                      ? `rgba(${hexToRgb(toneColor)},0.06)`
                      : `rgba(${hexToRgb(toneColor)},0.04)`,
                    borderColor: isDark
                      ? `rgba(${hexToRgb(toneColor)},0.12)`
                      : `rgba(${hexToRgb(toneColor)},0.12)`,
                  },
                ]}
              >
                {entry.text ? (
                  <Text style={[styles.timelineText, themedText]}>
                    {entry.text}
                  </Text>
                ) : null}
                {entry.tags.length > 0 ? (
                  <View style={styles.tagRow}>
                    {entry.tags.map((tag) => (
                      <View
                        key={tag}
                        style={[
                          styles.tagChip,
                          {
                            backgroundColor: isDark
                              ? `rgba(${hexToRgb(toneColor)},0.12)`
                              : `rgba(${hexToRgb(toneColor)},0.08)`,
                            borderColor: isDark
                              ? `rgba(${hexToRgb(toneColor)},0.2)`
                              : `rgba(${hexToRgb(toneColor)},0.16)`,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.tagChipText, { color: toneColor }]}
                        >
                          #{tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {entry.location ? (
                  <View style={styles.locationRow}>
                    <MaterialIcons
                      name="location-on"
                      size={15}
                      color={c.teal}
                    />
                    <Text
                      style={[styles.locationText, { color: c.textTertiary }]}
                    >
                      {entry.location.placeName
                        ? `${entry.location.placeName} · `
                        : ""}
                      {entry.location.latitude.toFixed(5)},{" "}
                      {entry.location.longitude.toFixed(5)}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Entry actions */}
              <View style={styles.entryActions}>
                <Pressable
                  style={[
                    styles.entryActionBtn,
                    { borderColor: c.border, backgroundColor: c.surface },
                  ]}
                  onPress={() => onEditEntry(entry)}
                >
                  <MaterialIcons name="edit" size={15} color={c.fg} />
                  <Text
                    style={[styles.entryActionText, { color: c.textSecondary }]}
                  >
                    {t("common.edit")}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.entryActionBtn,
                    { borderColor: c.border, backgroundColor: c.surface },
                  ]}
                  onPress={() =>
                    Alert.alert(
                      t("journey.alertDeleteEntryTitle"),
                      t("journey.alertDeleteEntryBody"),
                      [
                        { text: t("common.cancel"), style: "cancel" },
                        {
                          text: t("common.delete"),
                          style: "destructive",
                          onPress: () => onDeleteEntry(entry.id),
                        },
                      ],
                    )
                  }
                >
                  <MaterialIcons
                    name="delete-outline"
                    size={15}
                    color={c.danger}
                  />
                  <Text style={[styles.entryActionText, { color: c.danger }]}>
                    {t("common.delete")}
                  </Text>
                </Pressable>
              </View>

              {/* Media */}
              {entry.media.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {entry.media.map((media) =>
                    media.type === "audio" ? (
                      <View
                        key={media.id}
                        style={[styles.mediaPreviewBox, themedMediaBox]}
                      >
                        <AudioPlayer
                          uri={media.uri}
                          label={t("journey.audioBadge")}
                        />
                        <Text style={[styles.mediaBadge, themedBadge]}>
                          {t("journey.audioBadge")}
                        </Text>
                      </View>
                    ) : (
                      <Pressable
                        key={media.id}
                        style={[styles.mediaPreviewBox, themedMediaBox]}
                        onPress={() => onPreviewMedia(media)}
                      >
                        {mediaPreviewUri(media) ? (
                          <Image
                            source={{ uri: mediaPreviewUri(media) }}
                            style={styles.mediaPreview}
                            contentFit="cover"
                          />
                        ) : media.type === "video" ? (
                          <MediaVideoCover uri={media.uri} />
                        ) : (
                          <View
                            style={[
                              styles.mediaPlaceholder,
                              { backgroundColor: c.textPrimary },
                            ]}
                          >
                            <Text
                              style={[
                                styles.mediaPlaceholderText,
                                { color: c.bg },
                              ]}
                            >
                              {t("journey.mediaBadgeVideo")}
                            </Text>
                          </View>
                        )}
                        <Text style={[styles.mediaBadge, themedBadge]}>
                          {media.type === "video"
                            ? t("journey.mediaBadgeVideo")
                            : t("journey.mediaBadgePhoto")}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </ScrollView>
              ) : null}
            </View>
            {index < entries.length - 1 ? (
              <View
                style={[styles.timelineLine, { backgroundColor: c.border }]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Convert hex color to "r, g, b" string for rgba() usage */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.02,
  },
  timelineItem: {
    position: "relative",
    paddingLeft: 24,
    paddingBottom: 4,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: "absolute",
    left: 0,
    top: 18,
    borderWidth: 3,
  },
  timelineLine: {
    position: "absolute",
    left: 5,
    top: 32,
    bottom: -4,
    width: 2,
  },
  timelineContent: {
    gap: 6,
  },
  timelineTime: {
    fontSize: 12,
    fontWeight: "500",
  },
  timelineCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  timelineText: {
    fontSize: 14,
    lineHeight: 22,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: "500",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
  },
  entryActions: {
    flexDirection: "row",
    gap: 8,
  },
  entryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  entryActionText: {
    fontSize: 12,
    fontWeight: "500",
  },
  mutedText: {
    fontSize: 12,
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
  mediaBadge: {
    fontSize: 11,
    padding: 4,
  },
});
