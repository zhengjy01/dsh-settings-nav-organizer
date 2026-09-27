# Changelog

> `dsh-settings-nav-organizer` 的全部版本变更。本文件由 `scripts/release.mjs` 在发布时自动补写。
> 格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。
> 说明：1.6.15 及更早的版本未逐条回填，历史见 git 提交与 npm 发布时间线。

## [Unreleased]

<!-- 日常提交的内容会累积到这里；发布时脚本会在本行下方插入新版本段落 -->

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
