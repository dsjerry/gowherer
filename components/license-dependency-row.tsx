import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LicenseDependency } from '@/lib/license-catalog';

export const LicenseDependencyRow = memo(function LicenseDependencyRow({
  item,
  expanded,
  onToggle,
}: {
  item: LicenseDependency;
  expanded: boolean;
  onToggle: (name: string) => void;
}) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();

  return (
    <Pressable
      style={[styles.row, { borderColor: isDark ? '#334155' : '#e2e8f0' }]}
      onPress={() => onToggle(item.name)}
    >
      <View style={styles.header}>
        <View style={styles.nameWrap}>
          <Text
            style={[styles.name, { color: isDark ? '#e2e8f0' : '#0f172a' }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {item.name}
          </Text>
        </View>
        <Text style={[styles.version, { color: isDark ? '#94a3b8' : '#475569' }]}>
          {t('settings.licensesVersion', { version: item.version })}
        </Text>
      </View>
      {expanded ? (
        <View style={styles.detail}>
          <Text style={[styles.licenseType, { color: isDark ? '#5eead4' : '#0f766e' }]}>
            {item.licenseType}
          </Text>
          <Text style={[styles.licenseText, { color: isDark ? '#cbd5e1' : '#334155' }]}>
            {item.licenseText}
          </Text>
          {item.repository ? (
            <Text style={[styles.repository, { color: isDark ? '#94a3b8' : '#475569' }]}>
              {item.repository}
            </Text>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
  },
  version: {
    fontSize: 12,
    flexShrink: 0,
    marginLeft: 8,
  },
  detail: {
    gap: 6,
    paddingTop: 4,
  },
  licenseType: {
    fontSize: 12,
    fontWeight: '600',
  },
  licenseText: {
    fontSize: 12,
    lineHeight: 18,
  },
  repository: {
    fontSize: 11,
  },
});
