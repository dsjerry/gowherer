import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { useI18n } from "@/hooks/locale-preference";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useMaterialTheme } from "@/hooks/use-material-theme";
import { JourneyKind } from "@/types/journey";

interface Props {
  journeyTitle: string;
  onChangeTitle: (text: string) => void;
  journeyTagsInput: string;
  onChangeTagsInput: (text: string) => void;
  journeyKind: JourneyKind;
  onChangeKind: (kind: JourneyKind) => void;
  creating: boolean;
  onCreateJourney: () => void;
}

export function JourneyCreateCard({
  journeyTitle,
  onChangeTitle,
  journeyTagsInput,
  onChangeTagsInput,
  journeyKind,
  onChangeKind,
  creating,
  onCreateJourney,
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
  const themedKindButton = {
    backgroundColor: c.bg,
    borderColor: c.border,
  };
  const themedKindButtonText = { color: c.textSecondary };
  const themedInput = {
    backgroundColor: "transparent",
    borderColor: c.border,
    color: c.textPrimary,
  };
  const themedPlaceholder = c.textTertiary;

  return (
    <View style={[styles.card, themedCard]}>
      {/* Hero section */}
      <View style={[styles.hero, { backgroundColor: c.surface }]}>
        <Text style={[styles.eyebrow, { color: c.fg }]}>
          {t("journey.startNew")}
        </Text>
        <Text style={[styles.heroTitle, { color: c.textSecondary }]}>
          {journeyKind === "travel"
            ? "把下一段路程整理成清晰时间线"
            : "记录每一次通勤的路线与耗时"}
        </Text>
        <Text style={[styles.heroSub, { color: c.textTertiary }]}>
          GoWherer 会把照片、位置和文字记录收进同一条旅程。
        </Text>
      </View>

      {/* Kind selector */}
      <View style={styles.kindRow}>
        <Pressable
          style={[
            styles.kindButton,
            themedKindButton,
            journeyKind === "travel" && {
              backgroundColor: c.fg,
              borderColor: c.fg,
            },
          ]}
          onPress={() => onChangeKind("travel")}
        >
          <MaterialIcons
            name="map"
            size={18}
            color={journeyKind === "travel" ? c.fgOn : c.fg}
          />
          <Text
            style={[
              styles.kindButtonText,
              themedKindButtonText,
              journeyKind === "travel" && { color: c.fgOn },
            ]}
          >
            {t("journey.kind.travel")}
          </Text>
          {journeyKind === "travel" && (
            <MaterialIcons name="check" size={14} color={c.fgOn} />
          )}
        </Pressable>
        <Pressable
          style={[
            styles.kindButton,
            themedKindButton,
            journeyKind === "commute" && {
              backgroundColor: c.accentSecondary,
              borderColor: c.accentSecondary,
            },
          ]}
          onPress={() => onChangeKind("commute")}
        >
          <MaterialIcons
            name="alt-route"
            size={18}
            color={journeyKind === "commute" ? c.fgOn : c.accentSecondary}
          />
          <Text
            style={[
              styles.kindButtonText,
              themedKindButtonText,
              journeyKind === "commute" && { color: c.fgOn },
            ]}
          >
            {t("journey.kind.commute")}
          </Text>
          {journeyKind === "commute" && (
            <MaterialIcons name="check" size={14} color={c.fgOn} />
          )}
        </Pressable>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: c.textSecondary }]}>
            旅程名称
          </Text>
          <TextInput
            value={journeyTitle}
            onChangeText={onChangeTitle}
            placeholder={
              journeyKind === "travel"
                ? "例如：西湖环线骑行"
                : "例如：早高峰到城西银泰"
            }
            placeholderTextColor={themedPlaceholder}
            style={[styles.input, themedInput]}
          />
        </View>
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, { color: c.textSecondary }]}>
            标签（用逗号分隔）
          </Text>
          <TextInput
            value={journeyTagsInput}
            onChangeText={onChangeTagsInput}
            placeholder={
              journeyKind === "travel"
                ? "骑行, 杭州, 周末"
                : "通勤, 地铁, 工作日"
            }
            placeholderTextColor={themedPlaceholder}
            style={[styles.input, themedInput]}
          />
        </View>

        {/* Quick tags */}
        <View style={styles.quickTagSection}>
          <Text style={[styles.quickTagLabel, { color: c.textTertiary }]}>
            快速添加
          </Text>
          <View style={styles.quickTagRow}>
            {(journeyKind === "travel"
              ? ["周末", "徒步", "美食", "风景"]
              : ["通勤", "地铁", "拥堵", "工作日"]
            ).map((tag) => (
              <Pressable
                key={tag}
                style={[
                  styles.quickTag,
                  { borderColor: c.border, backgroundColor: c.bg },
                ]}
                onPress={() => {
                  const tags = journeyTagsInput
                    .split(/[,，、]/)
                    .map((t) => t.trim())
                    .filter(Boolean);
                  if (!tags.includes(tag)) {
                    onChangeTagsInput([...tags, tag].join(", "));
                  }
                }}
              >
                <Text style={[styles.quickTagText, { color: c.textSecondary }]}>
                  #{tag}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: journeyTitle.trim() ? c.fg : c.border },
          ]}
          onPress={onCreateJourney}
          disabled={creating || !journeyTitle.trim()}
        >
          <MaterialIcons
            name="add"
            size={18}
            color={journeyTitle.trim() ? c.fgOn : c.textTertiary}
          />
          <Text
            style={[
              styles.primaryButtonText,
              {
                color: journeyTitle.trim() ? c.fgOn : c.textTertiary,
              },
            ]}
          >
            {creating ? t("journey.creatingJourney") : "开始旅程"}
          </Text>
        </Pressable>

        <View style={[styles.hint, { borderColor: c.border, backgroundColor: c.bg }]}>
          <MaterialIcons name="check-circle" size={16} color={c.accentSecondary} />
          <Text style={[styles.hintText, { color: c.textTertiary }]}>
            开始后会自动建立空时间线，你可以继续添加文字、照片、位置和标签。
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    gap: 0,
  },
  hero: {
    padding: 18,
    borderBottomWidth: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.08,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.02,
  },
  heroSub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
  },
  kindRow: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    paddingBottom: 0,
  },
  kindButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  kindButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  form: {
    padding: 16,
    gap: 12,
  },
  inputContainer: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 2,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  quickTagSection: {
    gap: 8,
  },
  quickTagLabel: {
    fontSize: 12,
  },
  quickTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickTag: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quickTagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    paddingVertical: 14,
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.02,
  },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
