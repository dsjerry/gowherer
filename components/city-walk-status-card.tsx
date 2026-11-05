import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getCityWalkTheme } from '@/components/city-walk-theme';
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

  const theme = getCityWalkTheme(isDark);
  const cardStyle = { backgroundColor: theme.surface, borderColor: theme.line };
  const titleStyle = { color: theme.text };
  const hintStyle = { color: theme.muted };

  if (error) {
    return (
      <View style={[styles.card, cardStyle]}>
        <View style={styles.headerRow}>
          <View style={[styles.headerIcon, { backgroundColor: isDark ? '#51332c' : '#fff0e9' }]}>
            <MaterialIcons name="error-outline" size={23} color={isDark ? '#ffb79a' : '#b95d37'} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.overline, { color: theme.accent }]}>CITY WALK</Text>
            <Text style={[styles.title, titleStyle]}>{t('cityWalk.errorTitle')}</Text>
          </View>
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
            style={[styles.secondaryButton, { borderColor: theme.line }]}
            onPress={onBackToConfig}
            accessibilityRole="button"
          >
            <Text style={[styles.secondaryButtonText, titleStyle]}>
              {t('cityWalk.backToConfig')}
            </Text>
          </Pressable>
          {error.code === 'ai-not-configured' ? (
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.line }]}
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
        <View style={[styles.headerIcon, { backgroundColor: theme.accentSoft }]}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.overline, { color: theme.accent }]}>PLANNING YOUR WALK</Text>
          <Text style={[styles.title, titleStyle]}>{t('cityWalk.generatingLabel')}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        {STAGE_ORDER.map((item, index) => (
          <View
            key={item}
            style={[
              styles.progressSegment,
              { backgroundColor: index <= currentIndex ? theme.accent : theme.line },
            ]}
          />
        ))}
      </View>
      {STAGE_ORDER.map((item, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <View key={item} style={styles.stageRow}>
            <View
              style={[
                styles.stageBadge,
                { backgroundColor: done || active ? theme.accentSoft : theme.subtle },
              ]}
            >
              {done ? (
                <MaterialIcons name="check" size={15} color={theme.accent} />
              ) : (
                <Text
                  style={[styles.stageNumber, { color: active ? theme.accent : theme.muted }]}
                >{`0${index + 1}`}</Text>
              )}
            </View>
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
        style={[styles.secondaryButton, { borderColor: theme.line }]}
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
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 5,
  },
  overline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 19,
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
    minHeight: 36,
  },
  progressTrack: {
    flexDirection: 'row',
    gap: 5,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  stageBadge: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageNumber: {
    fontSize: 10,
    fontWeight: '800',
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
    backgroundColor: '#176b58',
    borderRadius: 15,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
