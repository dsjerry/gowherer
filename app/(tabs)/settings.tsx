import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemeToggle } from '@/components/theme-toggle';
import { useI18n } from '@/hooks/locale-preference';
import { useThemePreference } from '@/hooks/theme-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  buildAppBackup,
  importBackup,
  parseBackupString,
  serializeBackup,
  writeBackupToFile,
} from '@/lib/data-backup';
import { LocalePreference } from '@/lib/i18n';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t, preference, setPreference } = useI18n();
  const { setPreference: setThemePreference } = useThemePreference();
  const appVersion = Constants.expoConfig?.version ?? '0.0.0';
  const [exportingData, setExportingData] = useState(false);
  const [importingData, setImportingData] = useState(false);

  const theme = useMemo(
    () => ({
      page: { backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
      card: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
      },
      title: { color: isDark ? '#e2e8f0' : '#0f172a' },
      muted: { color: isDark ? '#94a3b8' : '#475569' },
      rowText: { color: isDark ? '#e2e8f0' : '#0f172a' },
      rowHint: { color: isDark ? '#94a3b8' : '#64748b' },
      divider: { borderColor: isDark ? '#334155' : '#e2e8f0' },
      accent: { color: '#0f766e' },
    }),
    [isDark]
  );

  const options: { value: LocalePreference; label: string }[] = [
    { value: 'system', label: t('settings.optionSystem') },
    { value: 'zh', label: t('settings.optionChinese') },
    { value: 'en', label: t('settings.optionEnglish') },
  ];

  async function handleExportData() {
    setExportingData(true);
    try {
      const backup = await buildAppBackup(appVersion);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `gowherer-backup-${backup.exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
        link.click();
        URL.revokeObjectURL(href);
        Alert.alert(t('settings.dataExportSuccessTitle'), t('settings.dataExportSuccessBodyWeb'));
        return;
      }

      const file = await writeBackupToFile(backup);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: file.fileName,
          UTI: 'public.json',
        });
      } else {
        Alert.alert(
          t('settings.dataExportSuccessTitle'),
          t('settings.dataExportSuccessBody', { fileName: file.fileName }),
        );
      }
    } catch {
      Alert.alert(t('settings.dataExportFailedTitle'), t('settings.dataExportFailedBody'));
    } finally {
      setExportingData(false);
    }
  }

  function handleImportData() {
    Alert.alert(t('settings.dataImportConfirmTitle'), t('settings.dataImportConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: () => {
          void confirmImportData();
        },
      },
    ]);
  }

  async function confirmImportData() {
    setImportingData(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/json', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) {
        return;
      }

      const asset = result.assets[0];
      const raw = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const backup = parseBackupString(raw);
      const imported = await importBackup(backup);
      setPreference(imported.localePreference);
      setThemePreference(imported.themePreference);
      Alert.alert(t('settings.dataImportSuccessTitle'), t('settings.dataImportSuccessBody'));
    } catch {
      Alert.alert(t('settings.dataImportFailedTitle'), t('settings.dataImportFailedBody'));
    } finally {
      setImportingData(false);
    }
  }

  return (
    <ScrollView
      style={theme.page}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
      <Text style={[styles.title, theme.title]}>{t('settings.title')}</Text>
      <View style={[styles.card, theme.card]}>
        <View style={styles.row}>
          <View style={styles.rowTextWrap}>
            <Text style={[styles.rowTitle, theme.rowText]}>{t('settings.theme')}</Text>
            <Text style={[styles.rowHint, theme.rowHint]}>{t('settings.themeHint')}</Text>
          </View>
          <ThemeToggle />
        </View>
      </View>

      <View style={[styles.card, theme.card]}>
        <Text style={[styles.sectionTitle, theme.title]}>{t('settings.language')}</Text>
        <Text style={[styles.sectionHint, theme.muted]}>{t('settings.languageHint')}</Text>
        <View style={[styles.list, theme.divider]}>
          {options.map((option, index) => {
            const isActive = preference === option.value;
            return (
              <Pressable
                key={option.value}
                style={[
                  styles.listItem,
                  index < options.length - 1 && styles.listItemBorder,
                  index < options.length - 1 && theme.divider,
                ]}
                onPress={() => setPreference(option.value)}>
                <Text style={[styles.listItemText, theme.rowText]}>{option.label}</Text>
                {isActive ? (
                  <MaterialIcons name="check" size={20} color={theme.accent.color} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, theme.card]}>
        <Text style={[styles.sectionTitle, theme.title]}>{t('settings.dataTitle')}</Text>
        <Text style={[styles.sectionHint, theme.muted]}>{t('settings.dataHint')}</Text>
        <View style={[styles.list, theme.divider]}>
          <Pressable
            style={[styles.listRowButton, styles.listItem, styles.listItemBorder, theme.divider]}
            onPress={() => void handleExportData()}
            disabled={exportingData || importingData}>
            <View style={styles.rowTextWrap}>
              <Text style={[styles.listItemText, theme.rowText]}>{t('settings.dataExportTitle')}</Text>
              <Text style={[styles.rowHint, theme.rowHint]}>
                {exportingData ? t('settings.dataBusyExporting') : t('settings.dataExportHint')}
              </Text>
            </View>
            <MaterialIcons name="ios-share" size={20} color={theme.muted.color} />
          </Pressable>
          <Pressable
            style={[styles.listRowButton, styles.listItem]}
            onPress={handleImportData}
            disabled={exportingData || importingData}>
            <View style={styles.rowTextWrap}>
              <Text style={[styles.listItemText, theme.rowText]}>{t('settings.dataImportTitle')}</Text>
              <Text style={[styles.rowHint, theme.rowHint]}>
                {importingData ? t('settings.dataBusyImporting') : t('settings.dataImportHint')}
              </Text>
            </View>
            <MaterialIcons name="file-upload" size={20} color={theme.muted.color} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, theme.card, styles.aboutCard]}>
        <Text style={[styles.sectionTitle, theme.title]}>{t('settings.aboutTitle')}</Text>
        <View style={styles.aboutIntro}>
          <Text style={[styles.aboutIntroText, theme.muted]}>
            {t('settings.aboutIntro')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, theme.muted]}>{t('settings.aboutSource')}</Text>
          <ExternalLink href="https://github.com/dsjerry/gowherer.git">
            <Text style={[styles.infoLink, theme.accent]} numberOfLines={1}>
              github
            </Text>
          </ExternalLink>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, theme.muted]}>{t('settings.aboutRelease')}</Text>
          <ExternalLink href="https://gowherer.smalljerry.cn/">
            <Text style={[styles.infoLink, theme.accent]} numberOfLines={1}>
              gowherer.smalljerry.cn
            </Text>
          </ExternalLink>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, theme.muted]}>{t('settings.aboutVersion')}</Text>
          <Text style={[styles.infoValue, theme.rowText]}>{appVersion}</Text>
        </View>
        <Pressable
          style={styles.infoRowButton}
          onPress={() => router.push('/permissions' as never)}>
          <Text style={[styles.infoLabel, theme.muted]}>{t('settings.permissionsTitle')}</Text>
          <MaterialIcons name="chevron-right" size={20} color={theme.muted.color} />
        </Pressable>
        <Pressable
          style={styles.infoRowButton}
          onPress={() => router.push('/licenses' as never)}>
          <Text style={[styles.infoLabel, theme.muted]}>{t('settings.licensesTitle')}</Text>
          <MaterialIcons name="chevron-right" size={20} color={theme.muted.color} />
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 16,
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowHint: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
  },
  list: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  listRowButton: {
    gap: 12,
  },
  listItemBorder: {
    borderBottomWidth: 1,
  },
  listItemText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoRowButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  infoLink: {
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  aboutCard: {
    gap: 12,
  },
  aboutIntro: {
    paddingVertical: 4,
  },
  aboutIntroText: {
    fontSize: 13,
    lineHeight: 20,
  },
});
