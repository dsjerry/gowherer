import type {
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
} from '@react-navigation/material-top-tabs';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { withLayoutContext } from 'expo-router';
import React from 'react';

import { SwipeTabBar } from '@/components/swipe-tab-bar';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useI18n } from '@/hooks/locale-preference';

const { Navigator } = createMaterialTopTabNavigator();

/**
 * Swipeable tabs. Expo Router's `Tabs` (React Navigation bottom tabs) has no
 * swipe gesture, so the swipeable navigator is React Navigation's material top
 * tabs placed at the bottom with a custom tab bar.
 */
const SwipeTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function TabLayout() {
  const { t } = useI18n();

  return (
    <SwipeTabs
      tabBarPosition="bottom"
      tabBar={(props) => <SwipeTabBar {...props} />}
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        // Defer mounting a tab until it is adjacent to the focused one, so a
        // cold start stays light while neighbours are ready before a swipe.
        lazy: true,
        lazyPreloadDistance: 1,
      }}
    >
      <SwipeTabs.Screen
        name="index"
        options={{
          title: t('tabs.journey'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="map.fill" color={color} />,
        }}
      />
      <SwipeTabs.Screen
        name="explore"
        options={{
          title: t('tabs.explore'),
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="clock.arrow.circlepath" color={color} />
          ),
        }}
      />
      <SwipeTabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </SwipeTabs>
  );
}
