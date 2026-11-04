import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getCityWalkErrorI18nKey } from '@/lib/city-walk-error';
import { CityWalkErrorInfo, CityWalkGenerationStage } from '@/types/city-walk';

type Props = {
  stage: CityWalkGenerationStage | null;
  legProgress: { completed: number; total: number } | null;
  error: CityWalkErrorInfo | null;
  onCancel: () => void;
  onRetry: () => void;
  onBackToConfig: () => void;
  /** AI 未配置时直接跳到设置页配置模型 */
  onOpenSettings: () => void;
};

const STAGE_ORDER: CityWalkGenerationStage[] = ['candidates', 'planning', 'routing'];

export function CityWalkStatusCard({
  stage,
  legProgress,
  error,
  onCancel,
  onRetry,
  onBackToConfig,
  onOpenSettings,
}: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const cardStyle = {
    backgroundColor: isDark ? '#17232b' : '#ffffff',
    borderColor: isDark ? '#293b42' : '#e3e9e5',
  };
  const titleStyle = { color: isDark ? '#e2e8f0' : '#10231f' };
  const hintStyle = { color: isDark ? '#94a3b8' : '#75827d' };

  if (error) {
    return (
      <View style={[styles.card, cardStyle]}>
        <View style={styles.headerRow}>
          <MaterialIcons name="error-outline" size={20} color={isDark ? '#fca5a5' : '#dc2626'} />
          <Text style={[styles.title, titleStyle]}>{t('cityWalk.errorTitle')}</Text>
        </View>
        <Text style={[styles.hint, hintStyle]}>{t(getCityWalkErrorI18nKey(error.code))}</Text>
        {error.code === 'ai-not-configured' ? (
          <Text style={[styles.hint, hintStyle]}>{t('cityWalk.error.aiNotConfiguredHint')}</Text>
        ) : null}
        {error.detail ? (
          <Text style={[styles.detail, hintStyle]} numberOfLines={3}>
            {error.detail}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: isDark ? '#32444a' : '#e0e7e2' }]}
            onPress={onBackToConfig}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryButtonText, titleStyle]}>
              {t('cityWalk.backToConfig')}
            </Text>
          </Pressable>
          {error.code === 'ai-not-configured' ? (
            <Pressable
              style={[styles.secondaryButton, { borderColor: isDark ? '#32444a' : '#e0e7e2' }]}
              onPress={onOpenSettings}
              accessibilityRole="button"
            >
              <Text style={[styles.secondaryButtonText, titleStyle]}>
                {t('cityWalk.openSettings')}
              </Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryButton} onPress={onRetry} accessibilityRole="button">
              <MaterialIcons name="refresh" size={17} color="#ffffff" />
              <Text style={styles.primaryButtonText}>{t('cityWalk.retry')}</Text>
            </Pressable>
          )}
        </View>
        {error.code === 'ai-not-configured' ? (
          <Pressable style={styles.primaryButton} onPress={onRetry} accessibilityRole="button">
            <MaterialIcons name="refresh" size={17} color="#ffffff" />
            <Text style={styles.primaryButtonText}>{t('cityWalk.retry')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  const currentIndex = stage ? STAGE_ORDER.indexOf(stage) : 0;

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.headerRow}>
        <ActivityIndicator size="small" />
        <Text style={[styles.title, titleStyle]}>{t('cityWalk.generatingLabel')}</Text>
      </View>
      {STAGE_ORDER.map((item, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <View key={item} style={styles.stageRow}>
            <MaterialIcons
              name={done ? 'check-circle' : active ? 'radio-button-checked' : 'radio-button-off'}
              size={16}
              color={
                done || active ? (isDark ? '#5eead4' : '#0f766e') : isDark ? '#475569' : '#cbd5e1'
              }
            />
            <Text
              style={[
                styles.stageText,
                done || active ? titleStyle : hintStyle,
                active && styles.stageTextActive,
              ]}
            >
              {t(`cityWalk.generating.${item}`)}
              {item === 'routing' && active && legProgress
                ? ` (${legProgress.completed}/${legProgress.total})`
                : ''}
            </Text>
          </View>
        );
      })}
      <Text style={[styles.hint, hintStyle]}>{t('cityWalk.generatingHint')}</Text>
      <Pressable
        style={[styles.secondaryButton, { borderColor: isDark ? '#32444a' : '#e0e7e2' }]}
        onPress={onCancel}
        accessibilityRole="button"
      >
        <Text style={[styles.secondaryButtonText, titleStyle]}>{t('cityWalk.cancel')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    gap: 13,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
  },
  detail: {
    fontSize: 11,
    lineHeight: 16,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 26,
  },
  stageText: {
    fontSize: 13,
  },
  stageTextActive: {
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 15,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f766e',
    borderRadius: 15,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
