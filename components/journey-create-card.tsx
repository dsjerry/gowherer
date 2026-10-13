import { MaterialIcons } from '@expo/vector-icons';
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

  const accent = isDark ? '#5eead4' : '#0f766e';
  const themedCard = {
    backgroundColor: isDark ? '#17232b' : '#ffffff',
    borderColor: isDark ? '#293b42' : '#e3e9e5',
  };
  const themedSectionTitle = { color: isDark ? '#e2e8f0' : '#10231f' };
  const themedHint = { color: isDark ? '#94a3b8' : '#75827d' };
  const themedSegment = {
    backgroundColor: isDark ? '#0f1920' : '#f1f4f2',
  };
  const themedKindButton = {
    backgroundColor: isDark ? '#1b2a31' : '#ffffff',
    borderColor: isDark ? '#32444a' : '#e0e7e2',
  };
  const themedKindButtonText = { color: isDark ? '#cbd5e1' : '#34453f' };
  const themedInput = {
    backgroundColor: isDark ? '#101b22' : '#f7f9f7',
    borderColor: isDark ? '#2b3d43' : '#e1e8e3',
  };
  const themedInputText = { color: isDark ? '#e2e8f0' : '#10231f' };
  const themedPlaceholder = isDark ? '#84959b' : '#87938e';

  return (
    <View style={[styles.card, themedCard]}>
      <View style={styles.cardIntro}>
        <View style={[styles.introIcon, { backgroundColor: isDark ? '#173c3a' : '#e4f2ec' }]}>
          <MaterialIcons name="explore" size={22} color={accent} />
        </View>
        <View style={styles.introCopy}>
          <Text style={[styles.sectionTitle, themedSectionTitle]}>{t('journey.startNew')}</Text>
          <Text style={[styles.sectionHint, themedHint]}>{t('journey.createJourneyHint')}</Text>
        </View>
      </View>

      <View style={[styles.kindSegment, themedSegment]}>
        <Pressable
          style={[
            styles.kindButton,
            themedKindButton,
            journeyKind === 'travel' && styles.kindButtonActive,
          ]}
          onPress={() => onChangeKind('travel')}
          accessibilityRole="button"
        >
          <MaterialIcons
            name="luggage"
            size={17}
            color={journeyKind === 'travel' ? '#ffffff' : isDark ? '#aab9bf' : '#65736d'}
          />
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
          accessibilityRole="button"
        >
          <MaterialIcons
            name="train"
            size={17}
            color={journeyKind === 'commute' ? '#ffffff' : isDark ? '#aab9bf' : '#65736d'}
          />
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

      <View style={[styles.inputShell, themedInput]}>
        <MaterialIcons name="edit-location-alt" size={18} color={isDark ? '#8da19f' : '#7b8d84'} />
        <TextInput
          value={journeyTitle}
          onChangeText={onChangeTitle}
          placeholder={t('journey.journeyTitlePlaceholder')}
          placeholderTextColor={themedPlaceholder}
          style={[styles.input, themedInputText]}
          returnKeyType="done"
        />
      </View>
      <View style={[styles.inputShell, themedInput]}>
        <MaterialIcons name="sell" size={18} color={isDark ? '#8da19f' : '#7b8d84'} />
        <TextInput
          value={journeyTagsInput}
          onChangeText={onChangeTagsInput}
          placeholder={t('journey.journeyTagsPlaceholder')}
          placeholderTextColor={themedPlaceholder}
          style={[styles.input, themedInputText]}
        />
      </View>
      <Pressable style={styles.primaryButton} onPress={onCreateJourney} disabled={creating}>
        <Text style={styles.primaryButtonText}>
          {creating ? t('journey.creatingJourney') : t('journey.createJourney')}
        </Text>
        {!creating ? <MaterialIcons name="arrow-forward" size={18} color="#ffffff" /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e3e9e5',
    gap: 13,
    shadowColor: '#1a382f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 7,
    elevation: 1,
  },
  cardIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  introIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: {
    flex: 1,
    gap: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10231f',
  },
  sectionHint: {
    fontSize: 11,
    lineHeight: 16,
  },
  kindSegment: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 14,
    padding: 4,
  },
  kindButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  kindButtonActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 2,
  },
  kindButtonText: {
    color: '#34453f',
    fontSize: 13,
    fontWeight: '700',
  },
  kindButtonTextActive: {
    color: '#ffffff',
  },
  inputShell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderWidth: 1,
    borderColor: '#e1e8e3',
    borderRadius: 13,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 11,
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.17,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
