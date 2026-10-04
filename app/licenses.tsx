import { Stack } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    FlatList,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LicenseDependencyRow } from "@/components/license-dependency-row";
import { useI18n } from "@/hooks/locale-preference";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
    licenseDependencies,
    LicenseDependency,
    licenseDirectCount,
    licenseGeneratedAt,
    licenseTransitiveCount,
    licenseTypes,
    matchesLicenseFilter,
} from "@/lib/license-catalog";

const appLicense = `MIT License

Copyright (c) 2026 dsjerry

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

type ListItem =
  | { kind: "section"; key: string; title: string; count: number }
  | { kind: "dependency"; key: string; dependency: LicenseDependency };

export default function LicensesScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [licenseFilter, setLicenseFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const chips = useMemo(
    () => [
      { type: null as string | null, count: licenseDependencies.length },
      ...licenseTypes,
    ],
    [],
  );

  const items = useMemo<ListItem[]>(() => {
    const filtered = licenseDependencies.filter((dependency) =>
      matchesLicenseFilter(dependency, { query, licenseType: licenseFilter }),
    );
    const sections: {
      id: string;
      title: string;
      entries: LicenseDependency[];
    }[] = [
      {
        id: "direct",
        title: t("settings.licensesDirectTitle"),
        entries: filtered.filter((dependency) => dependency.direct),
      },
      {
        id: "transitive",
        title: t("settings.licensesTransitiveTitle"),
        entries: filtered.filter((dependency) => !dependency.direct),
      },
    ];

    return sections.flatMap((section) =>
      section.entries.length === 0
        ? []
        : [
            {
              kind: "section" as const,
              key: `section:${section.id}`,
              title: section.title,
              count: section.entries.length,
            },
            ...section.entries.map((dependency) => ({
              kind: "dependency" as const,
              key: `${section.id}:${dependency.name}@${dependency.version}`,
              dependency,
            })),
          ],
    );
  }, [query, licenseFilter, t]);

  const toggleExpanded = useCallback((name: string) => {
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const theme = useMemo(
    () => ({
      page: { backgroundColor: isDark ? "#0f172a" : "#f8fafc" },
      card: {
        backgroundColor: isDark ? "#1e293b" : "#ffffff",
        borderColor: isDark ? "#334155" : "#e2e8f0",
      },
      title: { color: isDark ? "#e2e8f0" : "#0f172a" },
      muted: { color: isDark ? "#94a3b8" : "#475569" },
      text: { color: isDark ? "#e2e8f0" : "#0f172a" },
      input: {
        backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
        borderColor: isDark ? "#334155" : "#e2e8f0",
      },
      chip: {
        backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
        borderColor: isDark ? "#334155" : "#e2e8f0",
      },
      chipActive: {
        backgroundColor: isDark ? "#134e4a" : "#ccfbf1",
        borderColor: isDark ? "#5eead4" : "#0f766e",
      },
      chipTextActive: {
        color: isDark ? "#5eead4" : "#0f766e",
        fontWeight: "700" as const,
      },
    }),
    [isDark],
  );

  return (
    <View style={[styles.page, theme.page]}>
      <Stack.Screen options={{ title: t("settings.licensesTitle") }} />
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{
          paddingTop: 12,
          paddingBottom: insets.bottom + 24,
        }}
        initialNumToRender={20}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={[styles.card, theme.card]}>
              <Text style={[styles.sectionTitle, theme.title]}>
                {t("settings.licensesAppTitle")}
              </Text>
              <Text style={[styles.sectionHint, theme.muted]}>
                {t("settings.licensesHint")}
              </Text>
              <Text style={[styles.licenseText, theme.text]}>{appLicense}</Text>
            </View>

            <View style={[styles.card, theme.card]}>
              <Text style={[styles.sectionTitle, theme.title]}>
                {t("settings.licensesDependenciesTitle")}
              </Text>
              <Text style={[styles.sectionHint, theme.muted]}>
                {t("settings.licensesSummary", {
                  total: licenseDependencies.length,
                  direct: licenseDirectCount,
                  transitive: licenseTransitiveCount,
                })}
              </Text>
              {licenseGeneratedAt ? (
                <Text style={[styles.sectionHint, theme.muted]}>
                  {new Date(licenseGeneratedAt).toLocaleString()}
                </Text>
              ) : null}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {chips.map((chip) => {
                  const active = licenseFilter === chip.type;
                  return (
                    <Pressable
                      key={chip.type ?? "all"}
                      onPress={() =>
                        setLicenseFilter(active ? null : chip.type)
                      }
                      style={[
                        styles.chip,
                        theme.chip,
                        active && theme.chipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          active ? theme.chipTextActive : theme.muted,
                        ]}
                      >
                        {`${chip.type ?? t("settings.licensesFilterAll")} ${chip.count}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t("settings.licensesSearchPlaceholder")}
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.searchInput, theme.input, theme.text]}
              />
            </View>
          </View>
        }
        renderItem={({ item }) =>
          item.kind === "section" ? (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionHeaderText, theme.title]}>
                {`${item.title} · ${item.count}`}
              </Text>
            </View>
          ) : (
            <LicenseDependencyRow
              item={item.dependency}
              expanded={!!expanded[item.dependency.name]}
              onToggle={toggleExpanded}
            />
          )
        }
        ListEmptyComponent={
          <Text style={[styles.empty, theme.muted]}>
            {t("settings.licensesEmpty")}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 16,
  },
  separator: {
    height: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sectionHint: {
    fontSize: 12,
  },
  licenseText: {
    fontSize: 12,
    lineHeight: 18,
  },
  chipRow: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  sectionHeader: {
    paddingTop: 12,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "700",
  },
  empty: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 24,
  },
});
