# Changelog

> `dsh-settings-nav-organizer` 的全部版本变更。本文件由 `scripts/release.mjs` 在发布时自动补写。
> 格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。
> 说明：1.6.15 及更早的版本未逐条回填，历史见 git 提交与 npm 发布时间线。

## [Unreleased]

## [1.7.3] - 2026-09-29

### 兼容性

- 声明兼容 **DSH 0.2.0-rc.2**：`peerDependencies` 中官方 DSH 包的版本范围追加 `^0.2.0-rc.2`。功能与行为无变化，仅解除新版 DSH 下的兼容告警。


<!-- 日常提交的内容会累积到这里；发布时脚本会在本行下方插入新版本段落 -->

## [1.7.2] - 2026-09-27

### 修复 (Fixed)

- **闲置插件扫描判据漏 v3/v4，约 60% 会话日志被静默跳过**：`lib/index.js` 的会话遍历用字面量 `e.name === "session.jsonl.zstd"`，而 DSH 现网写入 `session.v3.jsonl.zstd`（0.1.5）/ `session.v4.jsonl.zstd`（0.1.7）——本机 945 个日志里 v3 501 + v4 75 被跳过（≈61%），「闲置 30 天」的使用统计因此**低估插件使用、误判闲置**（可能把在用的插件列为可弃）。判据改为与核心 `@deepseek-ai/dsh-session-format` 同源的 `/^session(?:\.v([1-9][0-9]*))?\.jsonl(\.zstd)?$/`，v0/v3/v4… 通吃。
- **桌面端最小 PATH 下 `zstd` spawn ENOENT**：Finder 启动的 Electron 宿主继承 launchd 的 `/usr/bin:/bin:/usr/sbin:/sbin`，裸调 `zstd` 会失败并被逐文件 catch 静默吞掉（该文件只是「不算」，不报错）。改为 `resolveExecutable()` 解析绝对路径（PATH + `DSH_EXTRA_BIN_DIRS` + `/opt/homebrew/bin` / `/usr/local/bin` / `~/.local/bin`）；裸 `.jsonl` 直接读。

### 其它 (Changed)

- 补齐生态元数据：`dsh.engines.dsh = ">=0.1.5-rc.1"`、`engines.node = "^22.19.0 || >=24.0.0"`、`peerDependencies`（`@deepseek-ai/dsh-host-webserver` + `react`）；`files` 的 `lib/` 修正为 `lib`。
- 接入发布前门禁：`scripts/portability.mjs` + `PORTABILITY-SOP.md`，`package.json` 新增 `verify` / `verify:full` / `verify:quick`（健康路由 `/api/dsh-settings-nav-organizer/list`）与 `release` 脚本；新增本 CHANGELOG（回填 1.6.15–1.7.1）。

### 兼容性 (Compatibility)

- DSH：`>=0.1.5-rc.1`
- Node：`^22.19.0 || >=24.0.0`
- peer：`@deepseek-ai/dsh-host-webserver@^0.1.0-rc.6 || ^0.1.1-rc.1 || ^0.1.2-alpha.1 || ^0.1.5-rc.1`、`react@^18.2.0`
- 发布前可移植性验证：✅ 通过（隔离 `DSH_HOME` + tarball 安装 + 15s 稳定性观察）

## [1.7.1] - 2026-08-30

### 新增 (Added)

- 设置侧栏顶部新增**即时搜索框**：按名称 / id 模糊过滤（DOM 遍历匹配 + 独立刷新观察器，React 重建后结果依然可靠）。

## [1.7.0] - 2026-08-29

### 新增 (Added)

- **闲置插件自动清理**：按会话日志里的 `tool/call` 统计每个插件的最后使用时间，超过阈值（默认 30 天）判定闲置，可在面板里一键卸载。

## [1.6.19] - 2026-08-26

### 其它 (Changed)

- 「Groups」页移到 Plugin manager 之后（原生条目末尾 / 折叠分组之首）。

## [1.6.18] - 2026-08-26

### 其它 (Changed)

- Plugin manager 页移到最前（与官方条目同级），仅 Groups 保留在末尾。

## [1.6.17] - 2026-08-26

### 修复 (Fixed)

- 撤回核心分组行：官方 DSH 设置保持平铺在顶部，保留可滚动导航与基于文本的按钮匹配。

## [1.6.16] - 2026-08-26

### 新增 (Added)

- 官方 DSH 设置固定到顶部「DeepSeek Harness 设置」分组行；导航改为可滚动 + 文本匹配按钮。

## [1.6.15] - 2026-08-26

### 修复 (Fixed)

- 修复展开 / 折叠竞态：点击立即更新 `dataset`，并排队补一次同步。
