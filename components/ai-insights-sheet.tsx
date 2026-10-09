import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BottomSheetModal } from '@/components/bottom-sheet-modal';
import { MarkdownText } from '@/components/markdown-text';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AiInsight, addAiInsight, loadAiInsights } from '@/lib/ai-insights';
import { analyzeAllJourneys } from '@/lib/ai-review';
import { isAiConfigured, loadAiSettings } from '@/lib/ai-settings';
import { formatDateTime } from '@/lib/journey-stats';
import { loadJourneys } from '@/lib/journey-storage';
import { logLocalError } from '@/lib/local-log';

type AiInsightsSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/** 回顾页的全局 AI 分析弹层：以全部旅程为资料分析，结果以列表保存（时间降序） */
export function AiInsightsSheet({ visible, onClose }: AiInsightsSheetProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t, locale } = useI18n();

  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [needConfig, setNeedConfig] = useState(false);

  const reloadInsights = useCallback(async () => {
    const list = await loadAiInsights();
    setInsights(list);
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }
    let active = true;
    (async () => {
      await reloadInsights();
      if (!active) {
        return;
      }
      setNeedConfig(false);
    })();
    return () => {
      active = false;
    };
  }, [visible, reloadInsights]);

  async function runAnalysis() {
    if (analyzing) {
      return;
    }
    setAnalyzing(true);
    try {
      const settings = await loadAiSettings();
      if (!isAiConfigured(settings)) {
        setNeedConfig(true);
        return;
      }
      const journeys = await loadJourneys();
      const result = await analyzeAllJourneys(journeys, settings, locale);
      await addAiInsight({
        content: result.content,
        model: result.model,
        journeyCount: journeys.length,
      });
      await reloadInsights();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logLocalError('ai-insights', error);
      Alert.alert(t('review.aiFailedTitle'), t('review.aiFailedBody', { message }));
    } finally {
      setAnalyzing(false);
    }
  }

  function handleGoSettings() {
    onClose();
    router.push('/(tabs)/settings' as never);
  }

  const theme = {
    text: { color: isDark ? '#e2e8f0' : '#0f172a' },
    hint: { color: isDark ? '#64748b' : '#94a3b8' },
    item: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    button: { backgroundColor: isDark ? '#134e4a' : '#ccfbf1' },
    buttonText: { color: isDark ? '#5eead4' : '#0f766e' },
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('review.aiInsightsTitle')}>
      <View style={styles.body}>
        {needConfig ? (
          <>
            <Text style={[styles.hintText, theme.hint]}>{t('review.aiNeedConfigBody')}</Text>
            <Pressable style={[styles.primaryButton, theme.button]} onPress={handleGoSettings}>
              <Text style={[styles.primaryButtonText, theme.buttonText]}>
                {t('review.aiGoSettings')}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.primaryButton, theme.button]}
              onPress={() => void runAnalysis()}
              disabled={analyzing}
            >
              <Text style={[styles.primaryButtonText, theme.buttonText]}>
                {analyzing ? t('review.aiInsightsAnalyzing') : t('review.aiInsightsStart')}
              </Text>
            </Pressable>

            {analyzing ? (
              <View style={styles.analyzingWrap}>
                <ActivityIndicator />
                <Text style={[styles.hintText, theme.hint]}>{t('review.aiAnalyzing')}</Text>
              </View>
            ) : !hasLoaded ? null : insights.length === 0 ? (
              <Text style={[styles.hintText, theme.hint]}>{t('review.aiInsightsEmpty')}</Text>
            ) : (
              <ScrollView style={styles.list} nestedScrollEnabled>
                {insights.map((insight) => (
                  <View key={insight.id} style={[styles.item, theme.item]}>
                    <Text style={[styles.itemMeta, theme.hint]}>
                      {t('review.aiInsightsMeta', {
                        model: insight.model,
                        time: formatDateTime(insight.createdAt),
                        count: insight.journeyCount,
                      })}
                    </Text>
                    <MarkdownText
                      content={insight.content}
                      style={[styles.itemContent, theme.text]}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
          </>
        )}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: 12,
    paddingBottom: 8,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 20,
  },
  analyzingWrap: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 20,
  },
  list: {
    maxHeight: 380,
  },
  item: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    paddingBottom: 20,
    gap: 6,
    marginBottom: 10,
  },
  itemMeta: {
    fontSize: 11,
  },
  itemContent: {
    fontSize: 13,
    lineHeight: 21,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
