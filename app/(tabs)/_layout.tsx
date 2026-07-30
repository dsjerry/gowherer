import { Tabs } from "expo-router";
import React from "react";
import { View } from "react-native";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors } from "@/constants/theme";
import { useI18n } from "@/hooks/locale-preference";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useI18n();
  const colors = colorScheme === "dark" ? Colors.dark : Colors.light;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.fg,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          height: 80,
          paddingBottom: 12,
          paddingTop: 8,
          backgroundColor: colors.tabBg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          gap: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.journey"),
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                width: 64,
                height: 30,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? colors.fg : "transparent",
              }}
            >
              <IconSymbol
                size={20}
                name="map.fill"
                color={focused ? colors.fgOn : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t("tabs.explore"),
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                width: 64,
                height: 30,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? colors.fg : "transparent",
              }}
            >
              <IconSymbol
                size={20}
                name="paperplane.fill"
                color={focused ? colors.fgOn : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabs.settings"),
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                width: 64,
                height: 30,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? colors.fg : "transparent",
              }}
            >
              <IconSymbol
                size={20}
                name="gearshape.fill"
                color={focused ? colors.fgOn : color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
