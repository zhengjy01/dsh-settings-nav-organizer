# dsh-settings-nav-organizer

> **English** | [**中文**](README.zh.md)

Declutter the DeepSeek Harness settings panel: with more plugins installed, the settings sidebar grows one entry per plugin. This plugin folds every plugin/extension entry into a single collapsible **Plugin entries** group row, lets you organize entries into **bookmark-style named groups**, and adds a **fold toggle** in General settings.

![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)

## Features

- **One group row, right under the system settings** — `通用设置 / Models / Plugins / Agent presets` stay flat at the top; everything else (plugins, extensions, extra pages) folds under `Plugin entries (N) ▾`.
- **Instant search** — a search box pinned at the top of the settings nav filters every entry by name (and plugin id) as you type; matches are highlighted and their groups are auto-expanded, and clearing the search restores the previous fold/group layout.

- **Scrollable nav** — when there are many entries, the settings sidebar scrolls instead of clipping entries with no scrollbar.
- **Fold toggle** — a switch at the top of the **Groups** page (`折叠第三方插件入口`) turns the whole folding behavior on/off: off restores the plain native nav with every entry flat.
- **Bookmark-style custom groups** — create named groups (like bookmark folders), move any settings entry into a group, and expand/collapse each group in the nav independently. A **Groups** page in the Settings panel manages everything: create, rename, delete groups, and move entries in/out.
- **One-click expand/collapse** — click a group row to unfold its entries below it; click again to fold them back. Ungrouped entries stay under the `Plugin entries (N) ▾` row.
- **Persistent** — group configuration and the fold toggle are stored in `localStorage` (`dsh.settingsNavFold.v1`), survives restarts.
- **Auto-updating** — counts and fold positions are recomputed from the live `settings.section` ledger, so entries appear/disappear as plugins register or unregister their settings pages. No configuration.
- **Current section never disappears** — the active plugin page stays visible even while folded.
- **Auto classification** — a mode switch (AI auto / manual): with AI mode on, newly installed plugins are grouped automatically through three fallback layers — **third-party market categories → local name-based heuristic rules → your AI model** — so plugins are grouped even when the market misses them and no AI is configured.
- **AI model config made easy** — model dropdown with presets (DeepSeek / OpenAI / Qwen / GLM / Kimi / Doubao): picking a preset model auto-fills its provider API URL, the URL+key auto-fetch the models available on your account, a **Test config** button verifies the whole setup with one request, and everything is **saved automatically on input** (no save button required).
- **Idle plugin auto-pruner** — a new switch on the **Groups** page scans each plugin's tool-call history, flags plugins unused beyond an idle threshold (default 30 days), and lets you **preview and one-click clean** them (with a confirmation step). Core DSH, this plugin and the core UI bundle are auto-protected and never listed; plugins without detectable tools can still be checked manually.
- **Localized** — follows the UI locale (中文 / English).

## Install

1. Add the plugin to your profile:

   ```sh
   # from npm (recommended — more stable from mainland networks)
   dsh plugin --profile web add dsh-settings-nav-organizer

   # or from GitHub
   dsh plugin --profile web add github:zhengjy01/dsh-settings-nav-organizer
   ```

   Expected: the command prints the resolved package and records it in that
   profile's `dsh.profile.bundles`.

   > **Screenshot slot 1 — install output.** Capture the terminal right after the
   > command, last ~10 lines (package + profile). Redact your username / home
   > path. Save as `docs/images/dsh-settings-nav-organizer-1-install.png`, then
   > replace this block with
   > `![Install output](docs/images/dsh-settings-nav-organizer-1-install.png)`.

2. Restart `dsh` (the host half must load), then refresh the browser page.

   Expected: the sidebar nav still lists the official entries, now followed by
   the group rows.

3. Open Settings (gear icon at the sidebar foot) → **Groups** (`分组管理`).

   Expected: the fold toggle and the group management UI are there.

   > **Screenshot slot 2 — folded nav + Groups page.** Capture the sidebar with
   > plugin entries folded under `Plugin entries (N) ▾`, plus the Groups page
   > header. Redact plugin names you consider private. Save as
   > `docs/images/dsh-settings-nav-organizer-2-folded-nav.png`.

## Usage

Everything lives in the Settings panel (`设置`):

1. **Fold toggle** — open **Groups** (`分组管理`), the switch at the top is `折叠第三方插件入口 / Fold third-party plugin entries`. On (default): plugin entries fold under the group rows; off: the nav goes back to plain native with every entry flat. The switch state is remembered across restarts.

   > **Screenshot slot 3 — the toggle, both states.** Capture the nav with the
   > toggle on and off. Save as
   > `docs/images/dsh-settings-nav-organizer-3-toggle.png`.

2. **Group rows in the nav** — with the toggle on, the nav keeps the official entries (`通用设置 / Models / Plugins / Agent presets`, plus the **Plugin manager** page) flat at the top, followed by the **Groups** page, then a `Plugin entries (N) ▾` row (and any custom group rows). Click a row to expand/collapse its entries below it.

3. **Auto classification** — in the **Groups** page, turn on the **Auto classify** switch (AI auto / manual), then configure your AI model:
   - pick a preset model from the dropdown (the provider API URL is filled in automatically), enter your API key, confirm the URL, and hit **Test config** to verify;
   - click **Classify ungrouped plugins now** — market tags are used first, then name-based rules, then your AI model;
   - everything is saved automatically as you type.

   > **Screenshot slot 4 — auto classification result.** Capture the Groups page
   > right after clicking **Classify ungrouped plugins now** (entries moved into
   > groups). Save as
   > `docs/images/dsh-settings-nav-organizer-4-classify.png`.

4. **Bookmark-style groups** — in the **Groups** page:
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

### Screenshots to add

| # | Where | What it shows | How to capture | Suggested filename |
| --- | --- | --- | --- | --- |
| 1 | Install | Install output (package + profile) | Terminal right after step 1, last ~10 lines; redact home path | `docs/images/dsh-settings-nav-organizer-1-install.png` |
| 2 | Install | Folded nav + Groups page | Sidebar with entries folded under `Plugin entries (N) ▾`, plus the Groups page header | `docs/images/dsh-settings-nav-organizer-2-folded-nav.png` |
| 3 | Usage | Fold toggle on/off | Same nav with the toggle on and off | `docs/images/dsh-settings-nav-organizer-3-toggle.png` |
| 4 | Usage | Auto classification result | Groups page right after "Classify ungrouped plugins now" | `docs/images/dsh-settings-nav-organizer-4-classify.png` |

After adding the images, re-run `npm pack --dry-run` and the portability gate
(`npm run verify`) — the README is part of the published tarball.

## Uninstall

```sh
dsh plugin --profile web remove dsh-settings-nav-organizer
```

This stops the plugin, removes its row from `cordis.patch.yml` and its dependency from the profile `package.json`.

## License

[MIT](LICENSE)
