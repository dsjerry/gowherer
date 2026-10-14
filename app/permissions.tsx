import { MaterialIcons } from '@expo/vector-icons';
import { ExpoGaodeMapModule } from 'expo-gaode-map';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';

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
        const [locationPermission, media, camera] = await Promise.all([
          ExpoGaodeMapModule.checkLocationPermission(),
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
        const resolveExpoStatus = (granted: boolean | undefined): PermissionStatusKey => {
          if (granted === true) return STATUS_GRANTED;
          if (granted === false) return STATUS_DENIED;
          return STATUS_UNKNOWN;
        };
        setStatus({
          location: resolveExpoStatus(locationPermission.granted),
          backgroundLocation: resolveExpoStatus(locationPermission.backgroundLocation),
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
      page: { backgroundColor: isDark ? '#0b1220' : '#f3f5f3' },
      card: {
        backgroundColor: isDark ? '#17232b' : '#ffffff',
        borderColor: isDark ? '#293b42' : '#e3e9e5',
      },
      title: { color: isDark ? '#e2e8f0' : '#0f172a' },
      muted: { color: isDark ? '#94a3b8' : '#475569' },
      text: { color: isDark ? '#e2e8f0' : '#0f172a' },
      divider: { borderColor: isDark ? '#334155' : '#e2e8f0' },
    }),
    [isDark],
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

  const resolveBadgeTheme = (value: PermissionStatusKey) => {
    if (value === STATUS_GRANTED) {
      return {
        backgroundColor: isDark ? '#143a34' : '#e5f2eb',
        borderColor: isDark ? '#276153' : '#cfe5d7',
        color: isDark ? '#78d3b0' : '#31755d',
      };
    }
    if (value === STATUS_DENIED) {
      return {
        backgroundColor: isDark ? '#3a2528' : '#fbefec',
        borderColor: isDark ? '#684044' : '#f0d6cf',
        color: isDark ? '#f0a69c' : '#a84f43',
      };
    }
    return {
      backgroundColor: isDark ? '#26333a' : '#f0f3f1',
      borderColor: isDark ? '#3b4a50' : '#dfe6e1',
      color: isDark ? '#a6b5b5' : '#718078',
    };
  };

  return (
    <View style={[styles.page, theme.page, { paddingTop: 12 }]}>
      <Stack.Screen options={{ title: t('settings.permissionsTitle') }} />
      <View style={[styles.card, theme.card]}>
        <Text style={[styles.sectionTitle, theme.title]}>{t('settings.permissionsTitle')}</Text>
        <Text style={[styles.sectionHint, theme.muted]}>{t('settings.permissionsHint')}</Text>
        <View style={styles.permissionList}>
          <View style={styles.permissionRow}>
            <Text style={[styles.permissionLabel, theme.text]}>
              {t('settings.permissionLocation')}
            </Text>
            <View
              style={[
                styles.permissionBadge,
                styles.permissionBadgeBase,
                resolveBadgeTheme(status.location),
              ]}
            >
              <Text
                style={[
                  styles.permissionBadgeText,
                  { color: resolveBadgeTheme(status.location).color },
                ]}
              >
                {resolveLabel(status.location)}
              </Text>
            </View>
          </View>
          <View style={styles.permissionRow}>
            <Text style={[styles.permissionLabel, theme.text]}>
              {t('settings.permissionBackgroundLocation')}
            </Text>
            <View
              style={[
                styles.permissionBadge,
                styles.permissionBadgeBase,
                resolveBadgeTheme(status.backgroundLocation),
              ]}
            >
              <Text
                style={[
                  styles.permissionBadgeText,
                  { color: resolveBadgeTheme(status.backgroundLocation).color },
                ]}
              >
                {resolveLabel(status.backgroundLocation)}
              </Text>
            </View>
          </View>
          <View style={styles.permissionRow}>
            <Text style={[styles.permissionLabel, theme.text]}>
              {t('settings.permissionMedia')}
            </Text>
            <View
              style={[
                styles.permissionBadge,
                styles.permissionBadgeBase,
                resolveBadgeTheme(status.media),
              ]}
            >
              <Text
                style={[
                  styles.permissionBadgeText,
                  { color: resolveBadgeTheme(status.media).color },
                ]}
              >
                {resolveLabel(status.media)}
              </Text>
            </View>
          </View>
          <View style={styles.permissionRow}>
            <Text style={[styles.permissionLabel, theme.text]}>
              {t('settings.permissionCamera')}
            </Text>
            <View
              style={[
                styles.permissionBadge,
                styles.permissionBadgeBase,
                resolveBadgeTheme(status.camera),
              ]}
            >
              <Text
                style={[
                  styles.permissionBadgeText,
                  { color: resolveBadgeTheme(status.camera).color },
                ]}
              >
                {resolveLabel(status.camera)}
              </Text>
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
    paddingHorizontal: 18,
    gap: 14,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 13,
    shadowColor: '#1a382f',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
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
    borderRadius: 14,
    paddingVertical: 12,
  },
  settingsButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
