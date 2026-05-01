import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { JourneyKind } from '@/types/journey';
import { EntryTemplate } from '@/types/template';

interface Props {
  visible: boolean;
  onClose: () => void;
  templateKind: JourneyKind;
  entryTemplates: EntryTemplate[];
  onSave: (
    label: string,
    text: string,
    tags: string[],
    editingId: string | null
  ) => void;
  onRemove: (templateId: string) => void;
  onReset: () => void;
}

export function TemplateModal({
  visible,
  onClose,
  templateKind,
  entryTemplates,
  onSave,
  onRemove,
  onReset,
}: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [editingId, setEditingId] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  function kindLabel(kind: JourneyKind) {
    return t(
      kind === 'travel' ? 'journey.kind.travel' : 'journey.kind.commute'
    );
  }

  function resetEditor() {
    setEditingId(null);
    setLabelInput('');
    setTextInput('');
    setTagsInput('');
  }

  function startEdit(template: EntryTemplate) {
    setEditingId(template.id);
    setLabelInput(template.label);
    setTextInput(template.text);
    setTagsInput(template.tags.join(', '));
  }

  function handleClose() {
    resetEditor();
    onClose();
  }

  function handleSave() {
    const label = labelInput.trim();
    const text = textInput.trim();
    const tags = Array.from(
      new Set(
        tagsInput
          .split(/[,，、]/)
          .map((item) => item.trim())
          .filter(Boolean)
      )
    );

    if (!label || !text) {
      Alert.alert(
        t('journey.alertTemplateIncompleteTitle'),
        t('journey.alertTemplateIncompleteBody')
      );
      return;
    }

    onSave(label, text, tags, editingId);
    resetEditor();
  }

  function handleRemove(templateId: string) {
    if (entryTemplates.length <= 1) {
      Alert.alert(
        t('journey.alertTemplateMinimumTitle'),
        t('journey.alertTemplateMinimumBody')
      );
      return;
    }
    onRemove(templateId);
    if (editingId === templateId) {
      resetEditor();
    }
  }

  function handleReset() {
    Alert.alert(
      t('journey.alertResetTemplatesTitle'),
      t('journey.alertResetTemplatesBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: () => {
            onReset();
            resetEditor();
          },
        },
      ]
    );
  }

  const themedCard = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
  };
  const themedTitle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const themedItem = {
    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    borderColor: isDark ? '#334155' : '#e2e8f0',
  };
  const themedItemTitle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const themedItemText = { color: isDark ? '#cbd5e1' : '#334155' };
  const themedLabel = { color: isDark ? '#cbd5e1' : '#334155' };
  const themedInput = {
    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    borderColor: isDark ? '#334155' : '#cbd5e1',
    color: isDark ? '#e2e8f0' : '#0f172a',
  };
  const themedPlaceholder = isDark ? '#94a3b8' : '#64748b';
  const themedMuted = { color: isDark ? '#94a3b8' : '#64748b' };
  const themedCancelButton = {
    borderColor: isDark ? '#334155' : '#cbd5e1',
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
  };
  const themedCancelButtonText = { color: isDark ? '#cbd5e1' : '#334155' };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.card, themedCard]}>
          <View style={styles.header}>
            <Text style={[styles.title, themedTitle]}>
              {t('journey.templateManagerTitle', {
                kind: kindLabel(templateKind),
              })}
            </Text>
            <Pressable onPress={handleClose}>
              <Text style={styles.linkText}>{t('common.close')}</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.templateList}>
            {entryTemplates.map((template) => (
              <View
                key={template.id}
                style={[styles.templateItem, themedItem]}
              >
                <Text style={[styles.templateItemTitle, themedItemTitle]}>
                  {template.label}
                </Text>
                <Text style={[styles.templateItemText, themedItemText]}>
                  {template.text}
                </Text>
                {template.tags.length > 0 ? (
                  <Text style={[styles.templateItemText, themedItemText]}>
                    {t('common.tags')}：
                    {template.tags.map((tag) => `#${tag}`).join(' ')}
                  </Text>
                ) : null}
                <View style={styles.inlineRow}>
                  <Pressable onPress={() => startEdit(template)}>
                    <Text style={styles.linkText}>{t('common.edit')}</Text>
                  </Pressable>
                  <Text style={[styles.mutedText, themedMuted]}> · </Text>
                  <Pressable
                    onPress={() =>
                      Alert.alert(
                        t('journey.alertDeleteTemplateTitle'),
                        t('journey.alertDeleteTemplateBody'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          {
                            text: t('common.delete'),
                            style: 'destructive',
                            onPress: () => handleRemove(template.id),
                          },
                        ]
                      )
                    }
                  >
                    <Text style={styles.deleteText}>
                      {t('common.delete')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.editorSection}>
            <Text style={[styles.editorLabel, themedLabel]}>
              {t('journey.templateEditorTitle', {
                mode: editingId
                  ? t('journey.templateModeEdit')
                  : t('journey.templateModeCreate'),
              })}
            </Text>
            <TextInput
              value={labelInput}
              onChangeText={setLabelInput}
              placeholder={t('journey.templateNamePlaceholder')}
              placeholderTextColor={themedPlaceholder}
              style={[styles.input, themedInput]}
            />
            <TextInput
              value={textInput}
              onChangeText={setTextInput}
              placeholder={t('journey.templateTextPlaceholder')}
              placeholderTextColor={themedPlaceholder}
              style={[styles.input, styles.textArea, themedInput]}
              multiline
            />
            <TextInput
              value={tagsInput}
              onChangeText={setTagsInput}
              placeholder={t('journey.templateTagsPlaceholder')}
              placeholderTextColor={themedPlaceholder}
              style={[styles.input, themedInput]}
            />
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.primaryButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.primaryButtonText}>
                  {editingId
                    ? t('journey.updateTemplate')
                    : t('journey.saveTemplate')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.cancelButton,
                  themedCancelButton,
                  styles.resetButton,
                ]}
                onPress={resetEditor}
              >
                <Text
                  style={[
                    styles.cancelButtonText,
                    themedCancelButtonText,
                  ]}
                >
                  {t('journey.clearTemplateEdit')}
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.cancelButton, themedCancelButton]}
              onPress={handleReset}
            >
              <Text
                style={[styles.cancelButtonText, themedCancelButtonText]}
              >
                {t('journey.resetTemplates')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxHeight: '86%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 12,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  linkText: {
    color: '#0369a1',
    fontSize: 12,
    fontWeight: '600',
  },
  templateList: {
    maxHeight: 220,
  },
  templateItem: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    padding: 10,
    gap: 6,
    marginBottom: 8,
  },
  templateItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  templateItemText: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 18,
  },
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  mutedText: {
    color: '#64748b',
    fontSize: 12,
  },
  deleteText: {
    color: '#b91c1c',
    fontSize: 12,
    fontWeight: '600',
  },
  editorSection: {
    gap: 8,
  },
  editorLabel: {
    color: '#334155',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#f8fafc',
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
  },
  cancelButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#334155',
    fontWeight: '600',
  },
  resetButton: {
    flex: 1,
  },
});
