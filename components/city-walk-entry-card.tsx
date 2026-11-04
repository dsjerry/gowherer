import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';

type Props = {
  onPress: () => void;
};

/** 旅程首页的 City Walk 入口，与「创建旅程」并列，不取代普通旅程创建 */
export function CityWalkEntryCard({ onPress }: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const accent = isDark ? '#5eead4' : '#0f766e';

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#17232b' : '#ffffff',
          borderColor: isDark ? '#293b42' : '#e3e9e5',
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.icon, { backgroundColor: isDark ? '#173c3a' : '#e4f2ec' }]}>
        <MaterialIcons name="directions-walk" size={22} color={accent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: isDark ? '#e2e8f0' : '#10231f' }]}>
          {t('cityWalk.entryTitle')}
        </Text>
        <Text style={[styles.hint, { color: isDark ? '#94a3b8' : '#75827d' }]}>
          {t('cityWalk.entryHint')}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={isDark ? '#64748b' : '#9aa8a2'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
  },
});
