import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/locale-preference';

export function DataLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>
        {t('dataLoadError.title')}
      </Text>
      <Text style={[styles.body, { color: isDark ? '#94a3b8' : '#475569' }]}>
        {t('dataLoadError.body')}
      </Text>
      <TouchableOpacity
        style={[styles.retryButton, isDark && styles.retryButtonDark]}
        onPress={onRetry}
      >
        <Text style={styles.retryText}>{t('dataLoadError.retry')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
  },
  retryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 32,
    marginTop: 4,
  },
  retryButtonDark: {
    backgroundColor: '#14b8a6',
  },
  retryText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
