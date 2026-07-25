# 排错顺序

## 先查什么

1. 包是否装对了。
2. `app.json` / `app.config.*` 是否写了正确的 plugin。
3. 改完后有没有执行 `npx expo prebuild`。
4. App ID / Bundle ID 是否和 AMap 控制台里登记的一致。
5. 是否先做了隐私授权。

## 常见问题

- 地图不显示
  - 先看 API Key
  - 再看是否重建
  - 再看 bundle id / package name 是否匹配

- 权限没生效
  - 看是否走了 Config Plugin
  - 看原生权限声明是否已经写入

- 初始化失败
  - 看是否先调用了隐私配置
  - 看 `androidKey` / `iosKey` 是否缺失
  - 看是否误把导航包和核心包一起装了
  - 看 JS 里是否错误调用了 `initSDK({ androidKey, iosKey })`

- Web API 不可用
  - 看是否传了 `webKey`
  - 看是否只调用了原生初始化，没有补 Web API key

## 排查原则

先查配置，再查构建，再查运行时初始化，最后查业务代码。

## 配置文件误用

如果项目已有 `app.json`，却额外出现了新建的 `app.config.js` / `app.config.ts`，优先怀疑接入过程走错了。应当把 plugin 合并回 `app.json`，除非用户明确需要动态配置。

## 先跑体检脚本

如果仓库里有 `scripts/integration_doctor.sh`，先跑一遍再动代码。
它适合快速确认：

- 包有没有装对
- plugin 有没有写进配置
- 原生工程有没有重建
- 有没有误装互斥包
