# expo-gaode-map-skill

这是一个面向 AI coding agent 的 `expo-gaode-map` 接入规则包，适用于 Expo / React Native 项目里的高德地图集成场景。

它的目标不是只告诉 AI “应该怎么做”，而是让 AI 在项目里自动完成更具体的接入动作：安装依赖、修改 Expo 配置、补基础地图页面、执行或提示 `prebuild`、并规避常见错误。

仓库同时提供 Codex Skill 格式、通用 `AGENTS.md`、参考文档和诊断脚本。Codex 可以直接作为 skill 安装，其他支持读取 `AGENTS.md` 或项目规则文件的 AI 工具也可以使用其中的规则。

## 能协助什么

- 判断应该使用 `expo-gaode-map`、`expo-gaode-map-navigation` 还是 `expo-gaode-map-web-api`。
- 安装当前场景需要的依赖。
- 修改已有的 Expo 配置文件。
- 在用户没有提供高德 Android / iOS Key 时，仍然写入 Config Plugin，并留下占位值。
- 在配置变更后执行或提示 `npx expo prebuild`。
- 生成一个最小可运行的地图页面。
- 避免在基础地图代码里错误调用 `initSDK({ androidKey, iosKey })`。
- 使用内置诊断脚本排查常见接入问题。

## 使用方式

### Codex 安装

Codex 用户可以通过下面的方式安装：

```bash
npx skills add TomWq/expo-gaode-map-skill
```

安装后需要重启 Codex，让新 skill 生效。

### 通用 Agent 使用

对于 Claude Code、Cursor、Windsurf、Cline、Roo Code 等工具，可以让 agent 读取仓库里的 `AGENTS.md`，或把 `AGENTS.md` / `references/` 中的规则复制到对应工具的 rules 文件中。

不同工具的规则文件名称可能不同，例如：

- `AGENTS.md`
- `.cursorrules`
- `.windsurfrules`
- `.clinerules`
- `.roo/rules/`

### 本地 Codex 安装

本地测试时，可以直接安装打包后的 `.skill` 文件：

```bash
mkdir -p ~/.codex/skills
unzip expo-gaode-map.skill -d ~/.codex/skills
```

安装后同样需要重启 Codex。

## 示例提示词

```text
在当前 Expo 项目中接入 expo-gaode-map，保留现有导航结构，补一个最小可运行地图页。
```

```text
检查当前项目的 expo-gaode-map 接入是否正确，并修复配置问题。
```

```text
在当前项目中接入 expo-gaode-map-navigation，实现基础路径规划和导航页。
```

## 关键规则

这套规则会尽量约束 AI 避免常见误操作：

- 如果项目已有 `app.json`，优先直接修改 `app.json`。
- 不要为了添加 Config Plugin 而新建 `app.config.js`。
- 如果用户没有提供 Android / iOS Key，也要在 Config Plugin 中写入占位值。
- 添加 Config Plugin 后，要执行或尝试执行 `npx expo prebuild`。
- 如果 Key 已通过 Config Plugin 注入原生项目，基础地图代码不要调用 `ExpoGaodeMapModule.initSDK({ androidKey, iosKey })`。
- 只有使用 Web API 的 `webKey`，或项目完全没有原生 Key 配置时，才考虑 `initSDK`。

## 修改后重新打包

如果你手动修改了 `SKILL.md`、`references/`、`scripts/`、`agents/` 或 `assets/`，执行：

```bash
./scripts/package_skill.sh
```

它会重新生成：

```text
expo-gaode-map.skill
```

如果需要同步到本机 Codex：

```bash
unzip -oq expo-gaode-map.skill -d ~/.codex/skills
```

然后重启 Codex。

## 目录结构

```text
.
├── AGENTS.md
├── SKILL.md
├── agents/
│   └── openai.yaml
├── assets/
│   └── icon.svg
├── references/
│   ├── basic-integration.md
│   ├── initialization.md
│   ├── package-choice.md
│   ├── setup.md
│   └── troubleshooting.md
├── scripts/
│   ├── integration_doctor.sh
│   └── package_skill.sh
└── expo-gaode-map.skill
```

## 诊断脚本

可以对一个 App 项目运行诊断：

```bash
./scripts/integration_doctor.sh /path/to/app
```

它会检查依赖、Config Plugin、互斥包、以及“已有 `app.json` 却额外新建 `app.config.*`”这类接入问题。
