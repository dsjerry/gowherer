import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { JourneyKind } from '@/types/journey';

interface Props {
  journeyTitle: string;
  onChangeTitle: (text: string) => void;
  journeyTagsInput: string;
  onChangeTagsInput: (text: string) => void;
  journeyKind: JourneyKind;
  onChangeKind: (kind: JourneyKind) => void;
  creating: boolean;
  onCreateJourney: () => void;
}

export function JourneyCreateCard({
  journeyTitle,
  onChangeTitle,
  journeyTagsInput,
  onChangeTagsInput,
  journeyKind,
  onChangeKind,
  creating,
  onCreateJourney,
}: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const themedCard = {
    backgroundColor: isDark ? '#1e293b' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
  };
  const themedSectionTitle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const themedKindButton = {
    backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
    borderColor: isDark ? '#334155' : '#cbd5e1',
  };
  const themedKindButtonText = { color: isDark ? '#cbd5e1' : '#0f172a' };
  const themedInput = {
    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    borderColor: isDark ? '#334155' : '#cbd5e1',
    color: isDark ? '#e2e8f0' : '#0f172a',
  };
  const themedPlaceholder = isDark ? '#94a3b8' : '#64748b';

  return (
    <View style={[styles.card, themedCard]}>
      <Text style={[styles.sectionTitle, themedSectionTitle]}>
        {t('journey.startNew')}
      </Text>
      <View style={styles.kindRow}>
        <Pressable
          style={[
            styles.kindButton,
            themedKindButton,
            journeyKind === 'travel' && styles.kindButtonActive,
          ]}
          onPress={() => onChangeKind('travel')}
        >
          <Text
            style={[
              styles.kindButtonText,
              themedKindButtonText,
              journeyKind === 'travel' && styles.kindButtonTextActive,
            ]}
          >
            {t('journey.kind.travel')}
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.kindButton,
            themedKindButton,
            journeyKind === 'commute' && styles.kindButtonActive,
          ]}
          onPress={() => onChangeKind('commute')}
        >
          <Text
            style={[
              styles.kindButtonText,
              themedKindButtonText,
              journeyKind === 'commute' && styles.kindButtonTextActive,
            ]}
          >
            {t('journey.kind.commute')}
          </Text>
        </Pressable>
      </View>
      <TextInput
        value={journeyTitle}
        onChangeText={onChangeTitle}
        placeholder={t('journey.journeyTitlePlaceholder')}
        placeholderTextColor={themedPlaceholder}
        style={[styles.input, themedInput]}
      />
      <TextInput
        value={journeyTagsInput}
        onChangeText={onChangeTagsInput}
        placeholder={t('journey.journeyTagsPlaceholder')}
        placeholderTextColor={themedPlaceholder}
        style={[styles.input, themedInput]}
      />
      <Pressable
        style={styles.primaryButton}
        onPress={onCreateJourney}
        disabled={creating}
      >
        <Text style={styles.primaryButtonText}>
          {creating
            ? t('journey.creatingJourney')
            : t('journey.createJourney')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  kindRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kindButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  kindButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  kindButtonText: {
    color: '#0f172a',
    fontWeight: '600',
  },
  kindButtonTextActive: {
    color: '#ffffff',
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
});
