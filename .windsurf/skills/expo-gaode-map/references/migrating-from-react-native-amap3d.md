# 从 react-native-amap3d 迁移到 expo-gaode-map

## 迁移前先选包

- `expo-gaode-map` — 地图、定位、覆盖物、离线地图、内置搜索
- `expo-gaode-map-navigation` — 导航 UI、路径规划（含地图能力）
- `expo-gaode-map-web-api` — 纯 JS Web API 服务

> `expo-gaode-map` 与 `expo-gaode-map-navigation` **不能同时安装**。导航包已包含地图能力。

## 1. 移除旧包并安装新包

```bash
# 只需要地图能力
npm uninstall react-native-amap3d
npm install expo-gaode-map

# 需要导航能力
npm uninstall react-native-amap3d
npm install expo-gaode-map-navigation
```

纯 RN 项目需先接入 Expo Modules：`npx install-expo-modules@latest`

## 2. 配置 Config Plugin

在 `app.json` 中配置（已有 `app.config.ts` 也可在其中加）：

```json
{
  "expo": {
    "plugins": [
      [
        "expo-gaode-map",
        {
          "androidKey": "your-android-key",
          "iosKey": "your-ios-key",
          "enableLocation": true,
          "enableBackgroundLocation": false,
          "locationDescription": "我们需要访问您的位置信息以提供地图服务"
        }
      ]
    ]
  }
}
```

使用导航包时，插件名改为 `expo-gaode-map-navigation`。

## 3. 重新生成或构建原生项目

```bash
npx expo prebuild --clean
npx expo run:android
npx expo run:ios
```

也可以使用 EAS Build：

```bash
eas build --platform android
eas build --platform ios
```

## 4. 先接隐私合规流程

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

导航包从 `expo-gaode-map-navigation` 导入同一模块。

Config Plugin 已写入原生 Key 时，不需要再调 `initSDK({ androidKey, iosKey })`。只有用 Web API 时才需传 `webKey`：

```ts
ExpoGaodeMapModule.initSDK({ webKey: 'your-web-api-key' });
```

## 5. 替换最小地图

```tsx
import { MapView } from 'expo-gaode-map';

export function BasicMapScreen() {
  return (
    <MapView
      style={{ flex: 1 }}
      initialCameraPosition={{
        target: { latitude: 39.908823, longitude: 116.39747 },
        zoom: 12,
      }}
      myLocationEnabled
    />
  );
}
```

导航包：`import { MapView } from 'expo-gaode-map-navigation';`

## 6. 迁移常见 API

覆盖物示例：

```tsx
import { MapView, Marker, Polyline } from 'expo-gaode-map';

export function OverlayScreen() {
  return (
    <MapView style={{ flex: 1 }}>
      <Marker position={{ latitude: 39.908823, longitude: 116.39747 }} />
      <Polyline
        points={[
          { latitude: 39.908823, longitude: 116.39747 },
          { latitude: 39.918823, longitude: 116.40747 },
        ]}
        width={6}
        color="#1677ff"
      />
    </MapView>
  );
}
```

可迁移的 API：`MapView`、`Marker`、`Polyline`、`Polygon`、`Circle`、`MapViewRef`、`checkLocationPermission()`、`requestLocationPermission()`、`useLocationPermissions()`、`getCurrentLocation()`、`searchPOI`、`searchNearby`、`getInputTips`。导航包还提供 `ExpoGaodeMapNaviView`。

## 7. 分阶段迁移建议

1. 先迁移安装、Config Plugin、隐私流程和最小 MapView。
2. 再迁移 Marker、Polyline、Polygon、Circle 等覆盖物。
3. 然后迁移定位权限和当前位置逻辑。
4. 如果旧项目自己拼了搜索服务，评估改用内置原生搜索或 `expo-gaode-map-web-api`。
5. 如果需要导航，迁移到 `expo-gaode-map-navigation`，不要在同一 App 同时保留 core 包。

## 排查清单

- 不能在 Expo Go 中测试，需要 development build、EAS Build 或本地原生构建
- 修改 Config Plugin 后要重新 prebuild 或重新云构建
- Android / iOS 高德 Key 要分别创建，并匹配包名、签名、Bundle ID
- 首次安装必须先完成隐私同意，再渲染 MapView
- `expo-gaode-map` 与 `expo-gaode-map-navigation` 不能同时安装
- 使用 Web API 时需要额外配置 `webKey`
