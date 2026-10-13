import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { CommonActions } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

const ICON_SIZE = 28;

/**
 * Floating capsule tab bar for the swipeable navigator. The navigator's animated
 * position drives both the sliding glass indicator and the icon/label cross-fade,
 * keeping the capsule in sync with taps and swipe gestures.
 */
export function SwipeTabBar({ state, descriptors, navigation, position }: MaterialTopTabBarProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const palette = {
    background: isDark ? '#17232b' : '#ffffff',
    border: isDark ? 'rgba(191,210,205,0.18)' : '#e5ece7',
    activeBackground: isDark ? 'rgba(47,112,94,0.94)' : 'rgba(226,243,234,0.97)',
    activeBorder: isDark ? 'rgba(180,232,211,0.42)' : 'rgba(255,255,255,0.98)',
    active: isDark ? '#a4e7ca' : '#0f766e',
    inactive: isDark ? '#84959b' : '#89948e',
  };
  const [barWidth, setBarWidth] = useState(0);

  const inputRange = state.routes.length > 1 ? state.routes.map((_, index) => index) : [0, 1];
  const tabSlotWidth =
    state.routes.length > 0 ? Math.max((barWidth - 14) / state.routes.length, 0) : 0;
  const indicatorWidth = Math.max(tabSlotWidth - 4, 0);
  const indicatorTranslateX = position.interpolate({
    inputRange,
    outputRange: inputRange.map((index) => index * tabSlotWidth),
  });

  const crossFade = (index: number, visible: number) =>
    position.interpolate({
      inputRange,
      outputRange: inputRange.map((i) => (i === index ? visible : 1 - visible)),
    });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.barBackdrop, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}
    >
      <View
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
        style={[styles.bar, { backgroundColor: palette.background, borderColor: palette.border }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            {
              left: 8,
              width: indicatorWidth,
              backgroundColor: palette.activeBackground,
              borderColor: palette.activeBorder,
              transform: [{ translateX: indicatorTranslateX }],
            },
          ]}
        />
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : (options.title ?? route.name);

          const activeOpacity = crossFade(index, 1);
          const inactiveOpacity = crossFade(index, 0);

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
              data: {
                behavior: {
                  scrollToTop:
                    isFocused && options.tabBarRepeatedPressBehavior?.scrollToTop !== false,
                  popToTop: isFocused && options.tabBarRepeatedPressBehavior?.popToTop !== false,
                },
              },
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.dispatch({
                ...CommonActions.navigate(route.name, route.params),
                target: state.key,
              });
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              onPressIn={() => {
                if (process.env.EXPO_OS === 'ios') {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
              }}
              style={styles.item}
            >
              <View style={styles.icon}>
                <Animated.View style={{ opacity: inactiveOpacity }}>
                  {options.tabBarIcon?.({ focused: false, color: palette.inactive })}
                </Animated.View>
                <Animated.View style={[StyleSheet.absoluteFill, { opacity: activeOpacity }]}>
                  {options.tabBarIcon?.({ focused: true, color: palette.active })}
                </Animated.View>
              </View>
              <View style={styles.labelBox}>
                <Animated.Text
                  numberOfLines={1}
                  style={[styles.label, { color: palette.inactive, opacity: inactiveOpacity }]}
                >
                  {label}
                </Animated.Text>
                <Animated.Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    styles.labelOverlay,
                    { color: palette.active, opacity: activeOpacity },
                  ]}
                >
                  {label}
                </Animated.Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barBackdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    width: '100%',
  },
  bar: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRadius: 28,
    borderWidth: 1,
    shadowColor: '#18382e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  activeIndicator: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    borderWidth: 1,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  item: {
    position: 'relative',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    marginHorizontal: 2,
    borderRadius: 22,
    paddingVertical: 5,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBox: {
    marginTop: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
