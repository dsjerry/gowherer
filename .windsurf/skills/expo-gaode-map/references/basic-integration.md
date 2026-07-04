# 最小接入示例

## 目标

让用户在当前项目里尽快看到一个可运行的地图页面，并保留原有导航、状态管理和页面结构。

## 推荐动作

1. 安装对应包。
2. 配置 Config Plugin。
3. 执行 `npx expo prebuild`。
4. 初始化隐私。
5. 加一个最小地图屏幕。

## 最小地图页

```tsx
import React from 'react';
import { View } from 'react-native';
import { MapView, Marker } from 'expo-gaode-map';

export default function MapScreen() {
  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        initialCameraPosition={{
          target: { latitude: 39.9087, longitude: 116.3975 },
          zoom: 13,
        }}
      >
        <Marker
          position={{ latitude: 39.9087, longitude: 116.3975 }}
          title="北京"
        />
      </MapView>
    </View>
  );
}
```

## 最小初始化

这里只处理隐私状态，不主动调用 `initSDK({ androidKey, iosKey })`。Config Plugin + prebuild 会把 key 注入到原生项目。

```ts
import { ExpoGaodeMapModule } from 'expo-gaode-map';

if (!ExpoGaodeMapModule.getPrivacyStatus().isReady) {
  ExpoGaodeMapModule.setPrivacyConfig({
    hasShow: true,
    hasContainsPrivacy: true,
    hasAgree: true,
    privacyVersion: '2026-03-13',
  });
}
```

## 常见补丁目标

- Expo Router：把地图页挂到现有 route 中。
- React Navigation：把地图页作为普通 screen 加入 navigator。
- Redux / Zustand / Jotai：保留现有状态层，不要为了接地图重做架构。
- 现有首页：仅替换或追加一个入口，不要全站重构。
