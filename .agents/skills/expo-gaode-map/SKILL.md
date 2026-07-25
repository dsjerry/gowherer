---
name: expo-gaode-map
description: Integrate expo-gaode-map, expo-gaode-map-navigation, and expo-gaode-map-web-api into Expo or React Native apps. Must prefer existing app.json over creating app.config, write config-plugin key placeholders when keys are missing, run npx expo prebuild after config changes, and avoid initSDK in basic map code unless Web API or no native key config is used.
---

# expo-gaode-map

当用户要在当前项目中接入、迁移或排查 `expo-gaode-map` 相关能力时使用本技能。

## 先判断场景

1. 先看项目的 `package.json`、`app.json` / `app.config.*`、锁文件，确认包管理器、Expo SDK、以及是否是 Expo managed 还是 bare React Native。
2. 看现有依赖里是否已经有 `expo-gaode-map`、`expo-gaode-map-navigation`、`expo-gaode-map-web-api`、`react-native-maps`、`react-native-amap3d` 等。
3. 先确认用户真正需要哪类能力：
   - 地图、定位、覆盖物、离线地图、内置搜索 -> `expo-gaode-map`
   - 路径规划、导航 UI -> `expo-gaode-map-navigation`
   - 纯 JS Web API -> `expo-gaode-map-web-api`

## 参考文件

- [package-choice.md](references/package-choice.md)：先选哪个包，哪些不能混装
- [setup.md](references/setup.md)：安装、Config Plugin、重建流程
- [initialization.md](references/initialization.md)：隐私、`initSDK`、`webKey`
- [basic-integration.md](references/basic-integration.md)：最小可跑示例
- [troubleshooting.md](references/troubleshooting.md)：常见报错和排查顺序

## 默认目标

如果用户明确说“在当前项目中接入 expo-gaode-map”，默认目标不是只安装依赖，而是把项目推进到下面这个状态：

1. 依赖已安装。
2. Config Plugin 已配置。
3. 已执行或至少尝试执行 `npx expo prebuild`。
4. 首次隐私流程已接好。
5. 代码里已有一个最小可运行的地图页面。
6. 如用户需要，再补定位、覆盖物、搜索或导航。

## 硬规则

- 如果项目已有 `app.json`，必须优先直接修改 `app.json` 的 `expo.plugins`，不要新建 `app.config.js` / `app.config.ts`。
- 只有项目已经使用 `app.config.*`，或用户明确要求用环境变量/动态配置时，才修改或创建 `app.config.*`。
- 用户没有提供 `androidKey` / `iosKey` 时，也要在 Config Plugin 中写入占位值，给用户留下位置，例如 `"your-android-key"`、`"your-ios-key"`。
- 配置 Config Plugin 后，必须尝试执行 `npx expo prebuild`。如果命令因为权限、依赖、网络或用户环境失败，说明失败原因和下一步。
- 基础地图接入代码里不要调用 `ExpoGaodeMapModule.initSDK({ androidKey, iosKey })`。
- 只有使用 `expo-gaode-map-web-api` 需要 `webKey`，或项目没有 Config Plugin/原生 key 配置时，才考虑 `initSDK`。

## 接入顺序

1. 用项目现有包管理器安装最小必要包。
2. 在现有 Expo 配置文件中加 Config Plugin；有 `app.json` 就直接改 `app.json`，不要另建 `app.config.*`。
3. 如用户要“直接可用”，顺手生成一个最小地图页面，并保留现有导航和状态管理结构。
4. 重新构建原生工程。Expo 项目必须先尝试 `npx expo prebuild`，再按需要 `npx expo run:*` 或 EAS build；bare RN 按原生流程重建。
5. 运行时先完成隐私同意，再调用地图能力。
6. 只有在没有通过 Config Plugin 或原生侧配置 Key 时，才手动调用 `ExpoGaodeMapModule.initSDK({ androidKey, iosKey })`。
7. 只有使用 Web API 时，才额外传 `webKey`。

## 关键约束

- 新项目优先用 Config Plugin，不要默认把 Key 写进 JS。
- 如果只需要地图和定位，不要顺手装导航包。
- 如果用户同时要地图和导航，优先推荐导航包，但不要把 `expo-gaode-map` 和 `expo-gaode-map-navigation` 一起装。
- 新安装首次使用前先做隐私授权，再做 SDK 初始化。
- 修改 `app.json` / 原生配置后，要提醒用户重新构建，否则改动不会生效。
- 如果用户要“自动实现基础功能”，优先补一个最小地图页，再按需加定位、Marker、Polyline、搜索。

## 产出风格

- 直接给出可粘贴的 `app.json`、`app.config.ts`、`package.json`、`App.tsx` 片段。
- 如果用户要迁移现有项目，优先保留他们现有结构，只补最少改动。
- 如果用户卡在某个平台报错，先检查 Key、权限、重建、包冲突、隐私流程。
