import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { analyzeJourney } from '@/lib/ai-review';
import { isAiConfigured, loadAiSettings } from '@/lib/ai-settings';
import { saveJourneyAiReview } from '@/lib/journey-repository';
import { formatDateTime } from '@/lib/journey-stats';
import { logLocalError } from '@/lib/local-log';
import { Journey } from '@/types/journey';

type AiReviewSheetProps = {
  visible: boolean;
  onClose: () => void;
  journey: Journey;
  /** 分析结果持久化后回调，父级用返回的旅程更新页面状态 */
  onSaved: (journey: Journey) => void;
};

/** 回顾详情页的 AI 分析弹层：把当前旅程交给配置好的模型分析，结果存回旅程 */
export function AiReviewSheet({ visible, onClose, journey, onSaved }: AiReviewSheetProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t, locale } = useI18n();

  const [analyzing, setAnalyzing] = useState(false);
  const [needConfig, setNeedConfig] = useState(false);

  useEffect(() => {
    if (visible) {
      setNeedConfig(false);
    }
  }, [visible]);

  const savedReview = journey.aiReview;

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
      const result = await analyzeJourney(journey, settings, locale);
      const journeys = await saveJourneyAiReview(journey.id, {
        content: result.content,
        model: result.model,
        createdAt: new Date().toISOString(),
      });
      onSaved(journeys.find((item) => item.id === journey.id) ?? journey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      void logLocalError('ai-review', error);
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
    muted: { color: isDark ? '#94a3b8' : '#64748b' },
    hint: { color: isDark ? '#64748b' : '#94a3b8' },
    contentBox: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    button: { backgroundColor: isDark ? '#134e4a' : '#ccfbf1' },
    buttonText: { color: isDark ? '#5eead4' : '#0f766e' },
  };

  let body: React.ReactNode;
  if (needConfig) {
    body = (
      <>
        <Text style={[styles.hintText, theme.hint]}>{t('review.aiNeedConfigBody')}</Text>
        <Pressable style={[styles.primaryButton, theme.button]} onPress={handleGoSettings}>
          <Text style={[styles.primaryButtonText, theme.buttonText]}>
            {t('review.aiGoSettings')}
          </Text>
        </Pressable>
      </>
    );
  } else if (analyzing) {
    body = (
      <View style={styles.analyzingWrap}>
        <ActivityIndicator />
        <Text style={[styles.hintText, theme.hint]}>{t('review.aiAnalyzing')}</Text>
      </View>
    );
  } else if (savedReview) {
    body = (
      <>
        <Text style={[styles.reviewMeta, theme.hint]}>
          {t('review.aiSavedMeta', {
            model: savedReview.model,
            time: formatDateTime(savedReview.createdAt),
          })}
        </Text>
        <ScrollView
          style={[styles.contentBox, theme.contentBox]}
          contentContainerStyle={styles.contentBoxContent}
          nestedScrollEnabled
        >
          <MarkdownText content={savedReview.content} style={[styles.reviewContent, theme.text]} />
        </ScrollView>
        <Pressable style={[styles.primaryButton, theme.button]} onPress={() => void runAnalysis()}>
          <Text style={[styles.primaryButtonText, theme.buttonText]}>
            {t('review.aiRegenerate')}
          </Text>
        </Pressable>
      </>
    );
  } else {
    body = (
      <>
        <Text style={[styles.hintText, theme.hint]}>{t('review.aiIntro')}</Text>
        <Pressable style={[styles.primaryButton, theme.button]} onPress={() => void runAnalysis()}>
          <Text style={[styles.primaryButtonText, theme.buttonText]}>{t('review.aiStart')}</Text>
        </Pressable>
      </>
    );
  }

  return (
    <BottomSheetModal visible={visible} onClose={onClose} title={t('review.aiSheetTitle')}>
      <View style={styles.body}>{body}</View>
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
    paddingVertical: 24,
  },
  reviewMeta: {
    fontSize: 11,
  },
  contentBox: {
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 320,
  },
  contentBoxContent: {
    padding: 12,
    paddingBottom: 28,
  },
  reviewContent: {
    fontSize: 14,
    lineHeight: 22,
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
