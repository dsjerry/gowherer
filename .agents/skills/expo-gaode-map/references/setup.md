# 安装与配置

## Expo 项目

1. 先安装最小必要包。
2. 优先修改项目已有的 Expo 配置文件。
3. 重新构建原生工程。

## 配置文件选择

- 如果项目已有 `app.json`，直接修改 `app.json`。
- 如果项目已有 `app.config.js` / `app.config.ts`，修改现有动态配置。
- 不要因为用户没给 key 就新建 `app.config.*`。
- 只有用户明确要求环境变量、动态 key 或多环境配置时，才引入 `app.config.*`。

## app.json 示例

用户没有提供 key 时，也要写占位值，让用户自己替换。

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
          "locationDescription": "我们需要访问您的位置信息以提供地图服务"
         
        }
      ]
    ]
  }
}
```

```bash
npx expo prebuild
npx expo run:android
npx expo run:ios
```

`npx expo prebuild` 是接入步骤的一部分，不只是最终提示。AI 有执行工具时应当尝试运行它；失败时报告失败原因。

## bare React Native

1. 先确认项目已经接入 Expo Modules。
2. 再安装对应包。
3. 重新编译 iOS / Android 原生工程。

## 环境判断

- 如果用户说“装了但没生效”，第一反应是让他重建。
- 如果用户改了 `app.json`，但没重新 prebuild 或重新编译，改动通常不会生效。
- 如果用户在 Expo managed 里做接入，优先走 Config Plugin。
