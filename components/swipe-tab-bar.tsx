import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { CommonActions } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ICON_SIZE = 28;

/**
 * Bottom tab bar for the swipeable tab navigator. Mirrors react-native-tab-view's
 * own TabBarItem: the `position` animation value drives a cross-fade between an
 * inactive and an active layer for both icon and label, so the bar tracks the
 * finger while swiping.
 */
export function SwipeTabBar({ state, descriptors, navigation, position }: MaterialTopTabBarProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const palette = isDark ? Colors.dark : Colors.light;

  const inputRange =
    state.routes.length > 1 ? state.routes.map((_, index) => index) : [0, 1];

  const crossFade = (index: number, visible: number) =>
    position.interpolate({
      inputRange,
      outputRange: inputRange.map((i) => (i === index ? visible : 1 - visible)),
    });

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: palette.background,
          borderTopColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
          paddingBottom: insets.bottom,
        },
      ]}
    >
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
                {options.tabBarIcon?.({ focused: false, color: palette.tabIconDefault })}
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: activeOpacity }]}>
                {options.tabBarIcon?.({ focused: true, color: palette.tint })}
              </Animated.View>
            </View>
            <View style={styles.labelBox}>
              <Animated.Text
                numberOfLines={1}
                style={[styles.label, { color: palette.tabIconDefault, opacity: inactiveOpacity }]}
              >
                {label}
              </Animated.Text>
              <Animated.Text
                numberOfLines={1}
                style={[styles.label, styles.labelOverlay, { color: palette.tint, opacity: activeOpacity }]}
              >
                {label}
              </Animated.Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBox: {
    marginTop: 2,
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  labelOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
