import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BottomSheetModal } from '@/components/bottom-sheet-modal';
import { useI18n } from '@/hooks/locale-preference';
import { useAiSettings } from '@/hooks/use-ai-settings';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AI_PROVIDER_PRESETS, getAiProviderPreset } from '@/lib/ai-providers';
import { fetchAiModels, testAiConnection } from '@/lib/ai-review';
import { AiSettings } from '@/lib/ai-settings';

/** 设置页的 AI 模块：供应商选择 + 地址/密钥/模型配置 + 连接测试 */
export function AiSettingsCard() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();
  const { settings, update } = useAiSettings();

  const [draft, setDraft] = useState<AiSettings | null>(null);
  const [providerSheetVisible, setProviderSheetVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchedModels, setFetchedModels] = useState<string[] | null>(null);
  const [modelSheetVisible, setModelSheetVisible] = useState(false);

  useEffect(() => {
    if (settings && !draft) {
      setDraft(settings);
    }
  }, [settings, draft]);

  const theme = {
    card: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
    },
    title: { color: isDark ? '#e2e8f0' : '#0f172a' },
    muted: { color: isDark ? '#94a3b8' : '#475569' },
    rowText: { color: isDark ? '#e2e8f0' : '#0f172a' },
    hint: { color: isDark ? '#64748b' : '#94a3b8' },
    input: {
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
      borderColor: isDark ? '#334155' : '#cbd5e1',
      color: isDark ? '#e2e8f0' : '#0f172a',
    },
    list: { borderColor: isDark ? '#334155' : '#e2e8f0' },
    listItemBorder: { borderBottomColor: isDark ? '#334155' : '#e2e8f0' },
    accent: { color: '#0f766e' },
    button: { backgroundColor: isDark ? '#134e4a' : '#ccfbf1' },
    buttonText: { color: isDark ? '#5eead4' : '#0f766e' },
    modelItemActive: { backgroundColor: isDark ? '#134e4a' : '#ccfbf1' },
  };

  if (!draft) {
    return null;
  }

  const preset = getAiProviderPreset(draft.providerId);

  function patch(next: Partial<AiSettings>) {
    setDraft((current) => (current ? { ...current, ...next } : current));
  }

  function handleProviderSelect(id: string) {
    const nextPreset = getAiProviderPreset(id);
    setProviderSheetVisible(false);
    patch({ providerId: id, baseUrl: nextPreset.baseUrl, model: nextPreset.models[0] ?? '' });
  }

  async function handleSave() {
    if (!draft) {
      return;
    }
    const normalized: AiSettings = {
      ...draft,
      baseUrl: draft.baseUrl.trim(),
      apiKey: draft.apiKey.trim(),
      model: draft.model.trim(),
    };
    await update(normalized);
    setDraft(normalized);
    Alert.alert(t('settings.aiTitle'), t('settings.aiSaved'));
  }

  async function handleTest() {
    if (!draft || testing) {
      return;
    }
    setTesting(true);
    try {
      await testAiConnection({
        ...draft,
        baseUrl: draft.baseUrl.trim(),
        apiKey: draft.apiKey.trim(),
        model: draft.model.trim(),
      });
      Alert.alert(t('settings.aiTestSuccessTitle'), t('settings.aiTestSuccessBody'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(t('settings.aiTestFailedTitle'), t('settings.aiTestFailedBody', { message }));
    } finally {
      setTesting(false);
    }
  }

  async function handleFetchModels() {
    if (!draft || fetchingModels) {
      return;
    }
    setFetchingModels(true);
    try {
      const models = await fetchAiModels({
        ...draft,
        baseUrl: draft.baseUrl.trim(),
        apiKey: draft.apiKey.trim(),
      });
      setFetchedModels(models);
      setModelSheetVisible(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Alert.alert(t('settings.aiFetchFailedTitle'), t('settings.aiFetchFailedBody', { message }));
    } finally {
      setFetchingModels(false);
    }
  }

  return (
    <View style={[styles.card, theme.card]}>
      <Text style={[styles.sectionTitle, theme.title]}>{t('settings.aiTitle')}</Text>
      <Text style={[styles.sectionHint, theme.muted]}>{t('settings.aiHint')}</Text>

      <Pressable
        style={[styles.providerRow, styles.input, theme.input]}
        onPress={() => setProviderSheetVisible(true)}
      >
        <View style={styles.rowTextWrap}>
          <Text style={[styles.fieldLabel, theme.hint]}>{t('settings.aiProvider')}</Text>
          <Text style={[styles.providerValue, theme.rowText]}>{preset.label}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={theme.muted.color} />
      </Pressable>

      <Text style={[styles.fieldLabel, theme.hint]}>{t('settings.aiModel')}</Text>
      <View style={styles.modelRow}>
        <TextInput
          style={[styles.input, styles.modelInput, theme.input]}
          value={draft.model}
          onChangeText={(model) => patch({ model })}
          placeholder="deepseek-chat"
          placeholderTextColor={theme.hint.color}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Pressable
          style={[styles.fetchButton, theme.button]}
          onPress={() => void handleFetchModels()}
          disabled={fetchingModels || !draft.baseUrl.trim()}
        >
          {fetchingModels ? (
            <ActivityIndicator size={16} color={theme.buttonText.color} />
          ) : (
            <MaterialIcons name="cloud-download" size={18} color={theme.buttonText.color} />
          )}
        </Pressable>
      </View>

      <Text style={[styles.fieldLabel, theme.hint]}>{t('settings.aiBaseUrl')}</Text>
      <TextInput
        style={[styles.input, theme.input]}
        value={draft.baseUrl}
        onChangeText={(baseUrl) => patch({ baseUrl })}
        placeholder="https://api.example.com/v1"
        placeholderTextColor={theme.hint.color}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />

      <Text style={[styles.fieldLabel, theme.hint]}>{t('settings.aiApiKey')}</Text>
      <TextInput
        style={[styles.input, theme.input]}
        value={draft.apiKey}
        onChangeText={(apiKey) => patch({ apiKey })}
        placeholder={
          preset.requiresApiKey
            ? (preset.apiKeyPlaceholder ?? 'sk-...')
            : t('settings.aiApiKeyOptional')
        }
        placeholderTextColor={theme.hint.color}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Text style={[styles.fieldHint, theme.hint]}>{t('settings.aiApiKeyHint')}</Text>

      <View style={styles.buttonRow}>
        <Pressable
          style={[styles.button, theme.button]}
          onPress={() => void handleTest()}
          disabled={testing}
        >
          <Text style={[styles.buttonText, theme.buttonText]}>
            {testing ? t('settings.aiTesting') : t('settings.aiTest')}
          </Text>
        </Pressable>
        <Pressable style={[styles.button, theme.button]} onPress={() => void handleSave()}>
          <Text style={[styles.buttonText, theme.buttonText]}>{t('common.save')}</Text>
        </Pressable>
      </View>

      <BottomSheetModal
        visible={providerSheetVisible}
        onClose={() => setProviderSheetVisible(false)}
        title={t('settings.aiProvider')}
      >
        <ScrollView style={[styles.providerList, theme.list]} nestedScrollEnabled>
          {AI_PROVIDER_PRESETS.map((item, index) => {
            const isActive = draft.providerId === item.id;
            return (
              <Pressable
                key={item.id}
                style={[
                  styles.providerItem,
                  index < AI_PROVIDER_PRESETS.length - 1 && styles.providerItemBorder,
                  index < AI_PROVIDER_PRESETS.length - 1 && theme.listItemBorder,
                ]}
                onPress={() => handleProviderSelect(item.id)}
              >
                <View style={styles.rowTextWrap}>
                  <Text style={[styles.providerItemLabel, theme.rowText]}>{item.label}</Text>
                  <Text style={[styles.providerItemHint, theme.hint]} numberOfLines={1}>
                    {item.baseUrl || t('settings.aiCustomProviderHint')}
                  </Text>
                </View>
                {isActive ? (
                  <MaterialIcons name="check" size={20} color={theme.accent.color} />
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </BottomSheetModal>

      <BottomSheetModal
        visible={modelSheetVisible}
        onClose={() => setModelSheetVisible(false)}
        title={t('settings.aiModelListTitle')}
      >
        {fetchedModels && fetchedModels.length > 0 ? (
          <ScrollView style={styles.modelList} nestedScrollEnabled>
            {fetchedModels.map((id) => {
              const isActive = draft.model === id;
              return (
                <Pressable
                  key={id}
                  style={[
                    styles.modelItem,
                    isActive && styles.modelItemActive,
                    isActive && theme.modelItemActive,
                  ]}
                  onPress={() => {
                    patch({ model: id });
                    setModelSheetVisible(false);
                  }}
                >
                  <Text style={[styles.modelItemText, theme.rowText]} numberOfLines={1}>
                    {id}
                  </Text>
                  {isActive ? (
                    <MaterialIcons name="check" size={20} color={theme.accent.color} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        ) : (
          <Text style={[styles.hintText, theme.hint]}>{t('settings.aiModelsEmpty')}</Text>
        )}
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  providerValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldHint: {
    fontSize: 11,
    marginTop: -4,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  providerList: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 420,
  },
  providerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  providerItemBorder: {
    borderBottomWidth: 1,
  },
  providerItemLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  providerItemHint: {
    fontSize: 11,
    marginTop: 2,
  },
  modelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modelInput: {
    flex: 1,
  },
  fetchButton: {
    borderRadius: 12,
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modelList: {
    maxHeight: 320,
  },
  modelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modelItemActive: {},
  modelItemText: {
    fontSize: 13,
    flex: 1,
  },
  hintText: {
    fontSize: 13,
    paddingVertical: 8,
  },
});
