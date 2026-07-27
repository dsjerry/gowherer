# 初始化顺序

## 正确顺序

1. 先让用户完成隐私授权。
2. 再写入隐私状态。
3. 如果已通过 Config Plugin 写入原生 key，并执行了 prebuild，不要在 JS 里主动传 `androidKey` / `iosKey` 调用 `initSDK`。
4. 最后再调用地图、定位、搜索或导航能力。

## 隐私

首次安装后，不能默认跳过隐私同意。
应该先调用：

```ts
ExpoGaodeMapModule.setPrivacyConfig({
  hasShow: true,
  hasContainsPrivacy: true,
  hasAgree: true,
  privacyVersion: '2026-03-13',
});
```

## initSDK

- 如果已经通过 Config Plugin 或原生侧配置了 `androidKey` / `iosKey`，不要在 JS 里传这两个 key。
- 如果只用地图、定位、导航且原生 key 已配置，通常只在需要 Web API 时才传 `webKey`。
- 如果没有通过 Config Plugin，也没有手动写入原生 key，就必须显式调用：

```ts
ExpoGaodeMapModule.initSDK({
  androidKey: 'your-android-key',
  iosKey: 'your-ios-key',
});
```

## 禁止模式

基础地图接入时不要生成下面这种代码：

```ts
ExpoGaodeMapModule.initSDK({
  androidKey: 'your-android-key',
  iosKey: 'your-ios-key',
});
```

正确做法是把 key 放到 Config Plugin，然后执行 `npx expo prebuild`。

## 搜索

- 新项目不要默认再找独立 search 包。
- 现在搜索能力主要跟 core / navigation 一起走。
