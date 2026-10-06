import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** 「加载中」+ icon 呼吸动画占位。AMap 并发实例有配额，排队等渲染的地图用
 *  这个等高占位顶住，避免布局跳动。 */
export function MapPlaceholder({ height = 180 }: { height?: number }) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.wrap, { height }, isDark ? styles.wrapDark : null]}>
      <Animated.View style={{ opacity: pulse, alignItems: 'center', gap: 6 }}>
        <MaterialIcons name="map" size={28} color={isDark ? '#5eead4' : '#0f766e'} />
        <Text style={[styles.label, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          {t('common.loading')}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapDark: {
    backgroundColor: '#0f172a',
    borderColor: '#334155',
  },
  label: {
    fontSize: 12,
  },
});
