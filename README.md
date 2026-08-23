# dsh-settings-nav-organizer

> **English** | [**中文**](README.zh.md)

Declutter the DeepSeek Harness settings panel: with more plugins installed, the settings sidebar grows one entry per plugin. This plugin folds every plugin/extension entry into a single collapsible **Plugin entries** group row, lets you organize entries into **bookmark-style named groups**, and adds a **fold toggle** in General settings.

![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)

## Features

- **One group row, right under the system settings** — `通用设置 / Models / Plugins / Agent presets` stay flat; everything else (plugins, extensions, extra pages) folds under `Plugin entries (N) ▾`.
- **Fold toggle** — a switch in **Settings → General** (`折叠第三方插件入口`) turns the whole folding behavior on/off: off restores the plain native nav with every entry flat.
- **Bookmark-style custom groups** — create named groups (like bookmark folders), move any settings entry into a group, and expand/collapse each group in the nav independently. A **Groups** page in the Settings panel manages everything: create, rename, delete groups, and move entries in/out.
- **One-click expand/collapse** — click a group row to unfold its entries below it; click again to fold them back. Ungrouped entries stay under the `Plugin entries (N) ▾` row.
- **Persistent** — group configuration and the fold toggle are stored in `localStorage` (`dsh.settingsNavFold.v1`), survives restarts.
- **Auto-updating** — counts and fold positions are recomputed from the live `settings.section` ledger, so entries appear/disappear as plugins register or unregister their settings pages. No configuration.
- **Current section never disappears** — the active plugin page stays visible even while folded.
- **Auto classification** — a mode switch (AI auto / manual) plus an optional AI model config (OpenAI-compatible base URL, API key, model): with AI mode on, newly installed plugins are grouped automatically using third-party market categories first, then your AI model for plugins the market does not cover.
- **Localized** — follows the UI locale (中文 / English).

## Install

```sh
# 方式一：npm 包（推荐，国内网络更稳定）
dsh plugin --profile web add dsh-settings-nav-organizer

# 方式二：GitHub 仓库
dsh plugin --profile web add github:zhengjy01/dsh-settings-nav-organizer
```

Restart `dsh` (the host half must load), then refresh the browser page. Open the Settings panel (gear icon at the sidebar foot).

## Usage

Everything lives in the Settings panel (`设置`):

1. **Fold toggle** — open **General** (`通用设置`), the first row is `折叠第三方插件入口 / Fold third-party plugin entries`. On (default): plugin entries fold under the group rows; off: the nav goes back to plain native with every entry flat. The switch state is remembered across restarts.

2. **Group rows in the nav** — with the toggle on, the nav shows the core entries, then a `Plugin entries (N) ▾` row (and any custom group rows). Click a row to expand/collapse its entries below it.

3. **Bookmark-style groups** — open **Groups** (`分组管理`) in the nav:
   - type a name and hit **New group** to create a group;
   - in the **Ungrouped** section, pick a group from each entry's dropdown to move it in;
   - inside a group card, use **Rename** / **Delete** / **Remove** to manage it (deleting a group moves its entries back to Ungrouped).

## How it works

The settings nav list is rendered by the shipped panel and is not a slot, so the plugin:

1. reads the `settings.section` slot ledger (`ctx.slots.entries`) and sorts it exactly like the panel does;
2. injects the group rows into the nav list DOM right after the last core entry (idempotent — no DOM change when already placed);
3. marks plugin buttons with `data-snav-plugin` / `data-snav-group` and drives visibility via a small stylesheet (the active `aria-current` row stays visible);
4. follows the ledger and panel re-renders with a scoped `MutationObserver` (with a storm watchdog), so the group stays correct as plugins come and go;
Everything is owned by the plugin fiber: styles, subscriptions, the observer, and the injected rows are removed when the plugin is stopped or uninstalled.

## Uninstall

```sh
dsh plugin --profile web remove dsh-settings-nav-organizer
```

This stops the plugin, removes its row from `cordis.patch.yml` and its dependency from the profile `package.json`.

## License

[MIT](LICENSE)
