import { MaterialIcons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useI18n } from '@/hooks/locale-preference';

const STATUS_GRANTED = 'granted';
const STATUS_DENIED = 'denied';
const STATUS_UNKNOWN = 'unknown';

type PermissionStatusKey = typeof STATUS_GRANTED | typeof STATUS_DENIED | typeof STATUS_UNKNOWN;

type PermissionStatus = {
  location: PermissionStatusKey;
  backgroundLocation: PermissionStatusKey;
  media: PermissionStatusKey;
  camera: PermissionStatusKey;
};

export default function PermissionsScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();
  const [status, setStatus] = useState<PermissionStatus>({
    location: STATUS_UNKNOWN,
    backgroundLocation: STATUS_UNKNOWN,
    media: STATUS_UNKNOWN,
    camera: STATUS_UNKNOWN,
  });

  useEffect(() => {
    let active = true;
    const refreshPermissions = async () => {
      try {
        const [location, backgroundLocation, media, camera] = await Promise.all([
          Location.getForegroundPermissionsAsync(),
          Location.getBackgroundPermissionsAsync(),
          ImagePicker.getMediaLibraryPermissionsAsync(),
          ImagePicker.getCameraPermissionsAsync(),
        ]);
        if (!active) {
          return;
        }
        const resolveStatus = (value: string | undefined): PermissionStatusKey => {
          if (value === STATUS_GRANTED) {
            return STATUS_GRANTED;
          }
          if (value === STATUS_DENIED) {
            return STATUS_DENIED;
          }
          return STATUS_UNKNOWN;
        };
        setStatus({
          location: resolveStatus(location.status),
          backgroundLocation: resolveStatus(backgroundLocation.status),
          media: resolveStatus(media.status),
          camera: resolveStatus(camera.status),
        });
      } catch {
        if (active) {
          setStatus({
            location: STATUS_UNKNOWN,
            backgroundLocation: STATUS_UNKNOWN,
            media: STATUS_UNKNOWN,
            camera: STATUS_UNKNOWN,
          });
        }
      }
    };

    void refreshPermissions();
    return () => {
      active = false;
    };
  }, []);

  const theme = useMemo(
    () => ({
      page: { backgroundColor: isDark ? '#0f172a' : '#f8fafc' },
      card: {
        backgroundColor: isDark ? '#1e293b' : '#ffffff',
        borderColor: isDark ? '#334155' : '#e2e8f0',
      },
      title: { color: isDark ? '#e2e8f0' : '#0f172a' },
      muted: { color: isDark ? '#94a3b8' : '#475569' },
      text: { color: isDark ? '#e2e8f0' : '#0f172a' },
      divider: { borderColor: isDark ? '#334155' : '#e2e8f0' },
    }),
    [isDark]
  );

  const resolveLabel = (value: PermissionStatusKey) => {
    if (value === STATUS_GRANTED) {
      return t('settings.permissionGranted');
    }
    if (value === STATUS_DENIED) {
      return t('settings.permissionDenied');
    }
    return t('settings.permissionUnknown');
  };

  return (
    <View style={[styles.page, theme.page, { paddingTop: insets.top + 12 }]}>
      <Stack.Screen options={{ title: t('settings.permissionsTitle') }} />
      <View style={[styles.card, theme.card]}>
        <Text style={[styles.sectionTitle, theme.title]}>{t('settings.permissionsTitle')}</Text>
        <Text style={[styles.sectionHint, theme.muted]}>{t('settings.permissionsHint')}</Text>
        <View style={styles.permissionList}>
          <View style={styles.permissionRow}>
            <Text style={[styles.permissionLabel, theme.text]}>{t('settings.permissionLocation')}</Text>
            <View style={[styles.permissionBadge, styles.permissionBadgeBase, theme.divider]}>
              <Text style={[styles.permissionBadgeText, theme.muted]}>{resolveLabel(status.location)}</Text>
            </View>
          </View>
          <View style={styles.permissionRow}>
            <Text style={[styles.permissionLabel, theme.text]}>
              {t('settings.permissionBackgroundLocation')}
            </Text>
            <View style={[styles.permissionBadge, styles.permissionBadgeBase, theme.divider]}>
              <Text style={[styles.permissionBadgeText, theme.muted]}>
                {resolveLabel(status.backgroundLocation)}
              </Text>
            </View>
          </View>
          <View style={styles.permissionRow}>
            <Text style={[styles.permissionLabel, theme.text]}>{t('settings.permissionMedia')}</Text>
            <View style={[styles.permissionBadge, styles.permissionBadgeBase, theme.divider]}>
              <Text style={[styles.permissionBadgeText, theme.muted]}>{resolveLabel(status.media)}</Text>
            </View>
          </View>
          <View style={styles.permissionRow}>
            <Text style={[styles.permissionLabel, theme.text]}>{t('settings.permissionCamera')}</Text>
            <View style={[styles.permissionBadge, styles.permissionBadgeBase, theme.divider]}>
              <Text style={[styles.permissionBadgeText, theme.muted]}>{resolveLabel(status.camera)}</Text>
            </View>
          </View>
        </View>
        <Pressable style={styles.settingsButton} onPress={() => Linking.openSettings()}>
          <MaterialIcons name="settings" size={16} color="#ffffff" />
          <Text style={styles.settingsButtonText}>{t('settings.permissionOpenSettings')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
  },
  permissionList: {
    gap: 10,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  permissionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  permissionBadgeBase: {
    borderWidth: 1,
    borderRadius: 999,
  },
  permissionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  permissionBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  settingsButton: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f766e',
    borderRadius: 999,
    paddingVertical: 10,
  },
  settingsButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
