import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';

const appLicense = `MIT License

Copyright (c) 2026 夏夜晚风

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

const licenseData = require('../assets/licenses.json') as {
  generatedAt?: string;
  entries?: Array<{
    name: string;
    version?: string;
    licenses?: string | string[];
    licenseText?: string;
    repository?: string;
    publisher?: string;
  }>;
};

export default function LicensesScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(40);

  const dependencies = useMemo(() => {
    const entries = licenseData.entries ?? [];
    return entries.map((entry) => ({
      name: entry.name,
      version: entry.version ?? '-',
      licenseText: entry.licenseText || entry.licenses || 'Unknown',
      repository: entry.repository || '',
    }));
  }, []);

  const visibleDependencies = useMemo(
    () => dependencies.slice(0, visibleCount),
    [dependencies, visibleCount]
  );

  const toggleExpanded = (name: string) => {
    setExpanded((prev) => ({
      ...prev,
      [name]: !prev[name],
    }));
  };

  const theme = useMemo(
    () => ({
      page: { backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
      card: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
      },
      title: { color: isDark ? '#e2e8f0' : '#0f172a' },
      muted: { color: isDark ? '#94a3b8' : '#475569' },
      text: { color: isDark ? '#e2e8f0' : '#0f172a' },
      divider: { borderColor: isDark ? '#334155' : '#e2e8f0' },
    }),
    [isDark]
  );

  return (
    <View style={[styles.page, theme.page]}>
      <Stack.Screen options={{ title: t('settings.licensesTitle') }} />
      <FlatList
        data={visibleDependencies}
        keyExtractor={(item) => `${item.name}@${item.version}`}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 24 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (visibleCount < dependencies.length) {
            setVisibleCount((prev) => Math.min(prev + 40, dependencies.length));
          }
        }}
        ListHeaderComponent={
          <View>
            <View style={[styles.card, theme.card]}>
              <Text style={[styles.sectionTitle, theme.title]}>{t('settings.licensesAppTitle')}</Text>
              <Text style={[styles.sectionHint, theme.muted]}>{t('settings.licensesHint')}</Text>
              <Text style={[styles.licenseText, theme.text]}>{appLicense}</Text>
            </View>

            <View style={[styles.card, theme.card]}>
              <Text style={[styles.sectionTitle, theme.title]}>
                {t('settings.licensesDependenciesTitle')}
              </Text>
              {licenseData.generatedAt ? (
                <Text style={[styles.sectionHint, theme.muted]}>
                  {new Date(licenseData.generatedAt).toLocaleString()}
                </Text>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isExpanded = !!expanded[item.name];
          return (
            <Pressable
              style={[styles.dependencyRow, theme.divider]}
              onPress={() => toggleExpanded(item.name)}>
              <View style={styles.dependencyHeader}>
                <View style={styles.dependencyNameWrap}>
                  <Text
                    style={[styles.dependencyName, theme.text]}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    {item.name}
                  </Text>
                </View>
                <Text style={[styles.dependencyVersion, theme.muted]}>
                  {t('settings.licensesVersion', { version: item.version })}
                </Text>
              </View>
              {isExpanded ? (
                <View style={styles.dependencyDetail}>
                  <Text style={[styles.dependencyLicense, theme.muted]}>
                    {typeof item.licenseText === 'string'
                      ? item.licenseText
                      : JSON.stringify(item.licenseText)}
                  </Text>
                  {item.repository ? (
                    <Text style={[styles.dependencyRepo, theme.muted]}>{item.repository}</Text>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 16,
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
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
  },
  licenseText: {
    fontSize: 12,
    lineHeight: 18,
  },
  dependencyList: {
    gap: 8,
  },
  dependencyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dependencyNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  dependencyRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  dependencyDetail: {
    gap: 6,
    paddingTop: 4,
  },
  dependencyName: {
    fontSize: 13,
    fontWeight: '600',
  },
  dependencyVersion: {
    fontSize: 12,
    flexShrink: 0,
    marginLeft: 8,
  },
  dependencyLicense: {
    fontSize: 12,
    lineHeight: 18,
  },
  dependencyRepo: {
    fontSize: 11,
  },
});
