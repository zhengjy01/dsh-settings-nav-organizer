// dsh-settings-nav-organizer — 设置面板导航整理（浏览器端插件包）
// 1) 折叠：把插件/扩展的设置入口折叠为一个可展开的「插件入口」分组行；
// 2) 书签式自定义分组：可创建命名分组，把任意设置入口归入分组，
//    导航中每个分组像书签文件夹一样可展开/收起（localStorage 持久化），
//    并提供「分组管理」页（设置面板条目）进行书签式管理。
window.__ModuleLoader__.load({
	id: "dsh-settings-nav-organizer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		var React = require("react");

		const STORAGE_KEY = "dsh.settingsNavFold.v1";

		/** Services required by the settings-nav-fold plugin. */
		const inject = ["slots", "locale"];

		// 单实例守卫：同一页面重复激活（异常路径）会让两套观察器/注入行互相
		// 打架并形成 DOM 风暴，直接忽略后续激活。
		var ACTIVE = false;

		/**
		 * Apply the settings nav folding + bookmark-style custom groups.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			if (ACTIVE) {
				console.warn("[settings-nav-organizer] already active — ignoring duplicate apply");
				return;
			}
			ACTIVE = true;
			ctx.effect(() => () => {
				ACTIVE = false;
			}, "settings-nav: single-instance guard");
			const NS = "settings-nav";
			console.log("[settings-nav-organizer] v1.6.1 loaded");
			// 始终平铺的内置项：核心设置页 + 本插件的「分组管理」与「插件管理」页
			const CORE = new Set(["general", "models", "plugins", "agent-presets", "settings-nav-groups", "settings-nav-manage"]);

			ctx.effect(() => ctx.locale.register(NS, "zh", {
				plugins: "插件入口",
				expand: "展开",
				collapse: "收起",
				groups: "分组管理",
				newGroup: "新建分组",
				groupName: "分组名称",
				rename: "重命名",
				delete: "删除",
				remove: "移出",
				addToGroup: "移入分组",
				ungrouped: "未分组",
				noGroups: "还没有分组——在下方输入名称新建一个，然后像管理书签一样把设置入口拖进分组。",
				empty: "（空）",
				manage: "插件管理",
				manageDesc: "在这里禁用、启动或卸载插件。仅「用户补丁层」安装的插件可操作；来自 bundle 的插件为只读。",
				enabled: "已启用",
				disabledTag: "已禁用",
				phaseActive: "运行中",
				phaseFailed: "异常",
				phaseLoading: "加载中",
				phasePending: "等待中",
				bundleOnly: "来自 bundle",
				manageable: "可管理",
				disable: "禁用",
				enable: "启动",
				uninstall: "卸载",
				uninstallConfirm: "确认卸载",
				cancel: "取消",
				loading: "加载中…",
				opOk: "操作成功",
				selfHint: "提示：禁用或卸载本插件后，本页会在刷新页面后消失（修改已生效）。",
				manageUnavailable: "宿主端管理服务尚未就绪——请重启 DSH 后刷新页面再试。",
				aiClassify: "自动分类",
				aiClassifyDesc: "开启后，新安装的插件会自动归入合适的分组：优先使用第三方聚合市场的分类标签；标签未收录的插件用你配置的 AI 模型分类。",
				aiModeLabel: "AI 自动分类",
				manualModeLabel: "手动分组",
				aiConfig: "AI 模型配置",
				aiBaseUrl: "API 地址（OpenAI 兼容，如 https://api.deepseek.com/v1）",
				aiApiKey: "API Key",
				aiModel: "模型名（如 deepseek-chat）",
				aiSave: "保存配置",
				aiSaved: "已保存",
				aiRunNow: "立即分类未分组插件",
				aiModelPlaceholder: "选择模型…",
				aiMyModels: "我的 API 模型",
				aiCurrent: "当前模型",
				aiRefreshModels: "刷新模型列表",
				aiModelsFetched: "已获取 {n} 个模型",
				aiModelsEmpty: "该 API 未返回模型列表",
				aiModelsHint: "预设常用模型可直接选；填好 API 地址与 Key 后可点「刷新模型列表」拉取你账号实际可用的模型。",
				aiRunning: "分类中…",
				aiAssigned: "已自动归组 {n} 个插件",
				aiEmpty: "没有需要分类的插件",
				aiAllGrouped: "已全部归组（共 {n} 个，本次无新增）",
				aiNoEntries: "当前没有可分类的设置入口（已安装的插件可能都没有设置页）",
				aiFailedHint: "有 {n} 个插件未能自动分类（市场未收录且未配置 AI 或分类失败），可在下方手动归组",
				aiHostOffline: "宿主端服务未就绪（请重启 DSH）",
				foldToggle: "折叠第三方插件入口",
				foldToggleDesc: "开启后，设置面板侧边栏将插件/扩展的设置入口折叠为「插件入口」分组（默认开启）。",
			}), "settings-nav: zh dictionary");
			ctx.effect(() => ctx.locale.register(NS, "en", {
				plugins: "Plugin entries",
				expand: "Expand",
				collapse: "Collapse",
				groups: "Groups",
				newGroup: "New group",
				groupName: "Group name",
				rename: "Rename",
				delete: "Delete",
				remove: "Remove",
				addToGroup: "Move to group",
				ungrouped: "Ungrouped",
				noGroups: "No groups yet — create one below, then organize entries like bookmarks.",
				empty: "(empty)",
				manage: "Plugin manager",
				manageDesc: "Disable, enable or uninstall plugins here. Only profile-patch (user-installed) plugins are manageable; bundle rows are read-only.",
				enabled: "Enabled",
				disabledTag: "Disabled",
				phaseActive: "active",
				phaseFailed: "failed",
				phaseLoading: "loading",
				phasePending: "pending",
				bundleOnly: "from bundle",
				manageable: "manageable",
				disable: "Disable",
				enable: "Enable",
				uninstall: "Uninstall",
				uninstallConfirm: "Confirm uninstall",
				cancel: "Cancel",
				loading: "Loading…",
				opOk: "Done",
				selfHint: "Note: after disabling or uninstalling this plugin, this page disappears on refresh (the change is already applied).",
				manageUnavailable: "The host management service is not ready yet — restart DSH and refresh the page.",
				aiClassify: "Auto classify",
				aiClassifyDesc: "When on, newly installed plugins are grouped automatically: market categories first, then your AI model for plugins the market does not cover.",
				aiModeLabel: "AI auto grouping",
				manualModeLabel: "Manual grouping",
				aiConfig: "AI model config",
				aiBaseUrl: "API base URL (OpenAI-compatible, e.g. https://api.deepseek.com/v1)",
				aiApiKey: "API Key",
				aiModel: "Model (e.g. deepseek-chat)",
				aiSave: "Save config",
				aiSaved: "Saved",
				aiRunNow: "Classify ungrouped plugins now",
				aiModelPlaceholder: "Select a model…",
				aiMyModels: "My API models",
				aiCurrent: "Current model",
				aiRefreshModels: "Refresh model list",
				aiModelsFetched: "Fetched {n} models",
				aiModelsEmpty: "This API returned no models",
				aiModelsHint: "Preset common models are selectable directly; after filling in the API URL and key you can click “Refresh model list” to fetch the models available on your account.",
				aiRunning: "Classifying…",
				aiAssigned: "Auto-grouped {n} plugins",
				aiEmpty: "Nothing to classify",
				aiAllGrouped: "All {n} plugins are already grouped (nothing new)",
				aiNoEntries: "No settings entries to classify (installed plugins may not have settings pages)",
				aiFailedHint: "{n} plugins could not be auto-classified (not in the market and no AI configured, or classification failed) — group them manually below",
				aiHostOffline: "Host service not ready (restart DSH)",
				foldToggle: "Fold third-party plugin entries",
				foldToggleDesc: "When on, plugin/extension settings entries fold under a collapsible group row in the settings nav (on by default).",
			}), "settings-nav: en dictionary");
			const t = ctx.locale.bind(NS);

			// 宿主端回环 API（webServer 路由，dsh-ticktick 同款模式）。
			// 注意：插件运行时注册的 Remote 服务不会挂载进浏览器 remote 命名空间
			// （api-remotes 只挂载编译期生成的贡献），必须走 HTTP 路由。
			const API_BASE = "/api/dsh-settings-nav-organizer";
			const api = async (path, body) => {
				try {
					const res = await fetch(body === undefined ? path : path, {
						method: body === undefined ? "GET" : "POST",
						headers: body === undefined ? undefined : { "content-type": "application/json" },
						body: body === undefined ? undefined : JSON.stringify(body),
					});
					const data = await res.json().catch(() => null);
					return data ?? { ok: false, error: { code: "bad-response", message: "invalid response" } };
				} catch (e) {
					return { ok: false, error: { code: "network", message: String(e) } };
				}
			};

			// ---- 持久化配置（localStorage）：自定义分组 + 第三方插件折叠开关 ----
			const loadPersisted = () => {
				let groups = [];
				let foldThirdParty = true;
				let groupingMode = "manual";
				let ai = { baseUrl: "", apiKey: "", model: "" };
				try {
					const raw = localStorage.getItem(STORAGE_KEY);
					if (raw !== null) {
						const data = JSON.parse(raw);
						if (Array.isArray(data.groups)) {
							groups = data.groups
								.filter((g) => g && typeof g.id === "string" && typeof g.name === "string" && Array.isArray(g.entries))
								.map((g) => ({ id: g.id, name: g.name, entries: g.entries.filter((x) => typeof x === "string") }));
						}
						if (typeof data.foldThirdParty === "boolean") foldThirdParty = data.foldThirdParty;
						if (data.groupingMode === "ai" || data.groupingMode === "manual") groupingMode = data.groupingMode;
						if (data.ai !== null && typeof data.ai === "object") {
							ai = {
								baseUrl: typeof data.ai.baseUrl === "string" ? data.ai.baseUrl : "",
								apiKey: typeof data.ai.apiKey === "string" ? data.ai.apiKey : "",
								model: typeof data.ai.model === "string" ? data.ai.model : ""
							};
						}
					}
				} catch (_ignored) {
					/* keep defaults */
				}
				return { groups, foldThirdParty, groupingMode, ai };
			};
			const savePersisted = () => {
				try {
					localStorage.setItem(STORAGE_KEY, JSON.stringify({
						groups: state.groups,
						foldThirdParty: state.foldThirdParty,
						groupingMode: state.groupingMode,
						ai: state.ai,
					}));
				} catch (_ignored) {
					/* storage unavailable: keep in-memory only */
				}
			};

			// 运行状态：folded=未分组入口是否折叠；groups=自定义分组；
			// open=各分组展开态（会话内）；foldThirdParty=第三方插件折叠总开关
			const persisted = loadPersisted();
			const state = {
				folded: true,
				count: 0,
				groups: persisted.groups,
				open: {},
				foldThirdParty: persisted.foldThirdParty,
				groupingMode: persisted.groupingMode,
				ai: persisted.ai,
			};
			let rows = []; // {id, order, label}
			let nextGroupId = 1;
			for (const g of state.groups) nextGroupId = Math.max(nextGroupId, Number(g.id) + 1);

			const resolveLabel = (l) => (typeof l === "function" ? l() : (l ?? ""));
			const groupOf = (entryId) => {
				for (const g of state.groups) if (g.entries.includes(entryId)) return g.id;
				return undefined;
			};

			// ---- 样式表（动态重建：未分组折叠规则 + 每个自定义分组一条显隐规则）----
			const tag = document.createElement("style");
			tag.dataset.settingsNavFold = "1";
			const FOLD_SEL = '[role="dialog"][aria-modal="true"] > nav > div:last-child';
			const applyRules = () => {
				const parts = [
					`${FOLD_SEL}[data-snav-folded="1"] > button[data-snav-plugin="1"]{display:none}`,
					`${FOLD_SEL}[data-snav-folded="1"] > button[data-snav-plugin="1"][aria-current="true"]{display:flex}`,
					".dsh-snav-chip{display:flex;align-items:center;justify-content:space-between;gap:8px;box-sizing:border-box;width:100%;height:40px;padding:9px 16px 9px 12px;border:none;border-radius:12px;background:transparent;color:var(--dsw-alias-label-secondary,#999);font-family:inherit;font-size:14px;line-height:22px;cursor:pointer;text-align:left}",
					".dsh-snav-chip:hover{background:var(--dsw-specific-sidebar-nav-item-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,#333)}",
					".dsh-snav-chevron{flex:none;font-size:10px;opacity:.75}",
					".dsh-snav-page{display:flex;flex-direction:column;gap:14px;width:100%;max-width:560px}",
					".dsh-snav-new{display:flex;gap:8px;align-items:center}",
					".dsh-snav-input{flex:1;min-width:0;height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#444);background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,#eee);font-family:inherit;font-size:13px}",
					".dsh-snav-btn{height:32px;padding:0 12px;border:none;border-radius:8px;background:var(--dsw-specific-sidebar-nav-item-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,#eee);font-family:inherit;font-size:13px;cursor:pointer}",
					".dsh-snav-btn:hover{filter:brightness(1.12)}",
					".dsh-snav-mini{height:24px;padding:0 8px;font-size:12px}",
					".dsh-snav-danger{color:var(--dsw-alias-state-error-primary,#e5484d)}",
					".dsh-snav-gcard{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:12px;background:var(--dsw-alias-bg-layer-1,transparent);border:1px solid var(--dsw-alias-border-l1,transparent)}",
					".dsh-snav-ghead{display:flex;align-items:center;gap:8px}",
					".dsh-snav-gname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:500;color:var(--dsw-alias-label-primary,#eee)}",
					".dsh-snav-gitems{display:flex;flex-direction:column;gap:4px;padding-left:4px}",
					".dsh-snav-item{display:flex;align-items:center;gap:8px;padding:4px 8px;border-radius:8px}",
					".dsh-snav-item:hover{background:var(--dsw-specific-sidebar-nav-item-hover,rgba(127,127,127,.1))}",
					".dsh-snav-itemname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:var(--dsw-alias-label-primary,#eee)}",
					".dsh-snav-select{height:26px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1,#444);background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-primary,#eee);font-family:inherit;font-size:12px}",
					".dsh-snav-hint{color:var(--dsw-alias-label-secondary,#999);font-size:12px}",
					".dsh-snav-ok{color:var(--dsw-alias-state-success-primary,#46a758);font-size:12px;margin:0}",
					".dsh-snav-err{color:var(--dsw-alias-state-error-primary,#e5484d);font-size:12px;margin:0}",
					".dsh-snav-warn{color:var(--dsw-alias-state-warn-primary,#f5a524);font-size:12px;margin:0}",
					".dsh-snav-state{margin-left:8px;font-size:11px;line-height:16px;border-radius:5px;padding:1px 6px;background:var(--dsw-alias-bg-layer-1,transparent);color:var(--dsw-alias-label-secondary,#999)}",
					".dsh-snav-state[data-enabled=true]{background:color-mix(in srgb,var(--dsw-alias-state-success-primary,#46a758) 12%,transparent);color:var(--dsw-alias-state-success-primary,#46a758)}",
					".dsh-snav-state[data-enabled=false]{background:color-mix(in srgb,var(--dsw-alias-label-tertiary,#666) 12%,transparent);color:var(--dsw-alias-label-secondary,#999)}",
					".dsh-snav-toggle-row{display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;padding:4px 0}",
					".dsh-snav-toggle-text{display:flex;flex-direction:column;gap:2px;min-width:0}",
					".dsh-snav-toggle-title{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary,#eee)}",
					".dsh-snav-toggle-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#999)}",
					".dsh-snav-switch{flex:none;position:relative;width:34px;height:20px;border-radius:999px;border:none;background:var(--dsw-alias-label-tertiary,#555);cursor:pointer;padding:0;transition:background .15s}",
					".dsh-snav-switch-on{background:var(--dsw-alias-state-success-primary,#46a758)}",
					".dsh-snav-switch-knob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .15s}",
					".dsh-snav-switch-on .dsh-snav-switch-knob{transform:translateX(14px)}",
					".dsh-snav-ung{display:flex;flex-direction:column;gap:6px;padding:10px 12px;border-radius:12px;border:1px dashed var(--dsw-alias-border-l2,transparent)}",
				];
				for (const g of state.groups) {
					parts.push(`${FOLD_SEL} > button[data-snav-group="${g.id}"]{display:none}`);
					parts.push(`${FOLD_SEL}[data-snav-open-${g.id}="1"] > button[data-snav-group="${g.id}"]{display:flex}`);
				}
				parts.push(`${FOLD_SEL} > button[data-snav-group][aria-current="true"]{display:flex}`);
				const css = parts.join("\n");
				if (tag.textContent !== css) tag.textContent = css;
			};
			ctx.effect(() => {
				document.head.appendChild(tag);
				return () => {
					tag.remove();
				};
			}, "settings-nav: fold rules");

			const findNavList = () => document.querySelector(FOLD_SEL);
			// 只在实际内容变化时才写 textContent，避免自身 MutationObserver 反馈循环
			const setText = (el, value) => {
				if (el.textContent !== value) el.textContent = value;
			};

			// ---- 注入行：每个自定义分组一行 + 未分组「插件入口」一行 ----
			const groupRows = new Map(); // gid -> element
			let pluginsRow = null;

			const makeRow = (kind, gid) => {
				const el = document.createElement("button");
				el.type = "button";
				el.className = "dsh-snav-chip";
				el.dataset.snavRow = kind;
				if (gid !== undefined) el.dataset.snavGid = gid;
				const label = document.createElement("span");
				const chevron = document.createElement("span");
				chevron.className = "dsh-snav-chevron";
				el.appendChild(label);
				el.appendChild(chevron);
				el.addEventListener("click", () => {
					if (kind === "group") state.open[gid] = !state.open[gid];
					else state.folded = !state.folded;
					sync();
				});
				return el;
			};

			const updateRow = (el, kind, gid) => {
				if (el === null) return;
				const group = kind === "group" ? state.groups.find((g) => g.id === gid) : undefined;
				const isOpen = kind === "group" ? state.open[gid] === true : !state.folded;
				const name = kind === "group" ? (group?.name ?? "") : t("plugins");
				const count = kind === "group"
					? (group?.entries.filter((id) => rows.some((r) => r.id === id)).length ?? 0)
					: state.count;
				setText(el.firstChild, `${name} (${count})`);
				setText(el.lastChild, isOpen ? "▴" : "▾");
				el.title = isOpen ? t("collapse") : t("expand");
				el.setAttribute("aria-expanded", String(isOpen));
				el.style.display = count > 0 ? "" : "none";
			};

			// 重入防护：sync() 执行期间忽略后续观察器回调，避免反馈循环
			let inSync = false;

			// 稳定按钮引用表：entryId → 原生按钮元素。
			// 布局会移动按钮，DOM 顺序与台账顺序不再一致，标记/布局必须
			// 基于该引用表而不是“第 N 个按钮”，否则每次 sync 都会错位重排。
			const buttonRefs = new Map();

			// 标记原生按钮 + 对齐注入行；幂等，位置正确时不改动 DOM
			const sync = () => {
				if (inSync) return;
				inSync = true;
				try {
					const navList = findNavList();
					if (navList === null) return;
					// 折叠总开关关闭：恢复原生导航——清除标记、移除全部注入行
					if (!state.foldThirdParty) {
						for (const child of navList.children) {
							if (child.tagName !== "BUTTON") continue;
							if (child.dataset.snavPlugin !== undefined) delete child.dataset.snavPlugin;
							if (child.dataset.snavGroup !== undefined) delete child.dataset.snavGroup;
						}
						if (navList.dataset.snavFolded !== undefined) delete navList.dataset.snavFolded;
						for (const g of state.groups) {
							navList.removeAttribute(`data-snav-open-${g.id}`);
						}
						for (const [, el] of groupRows) el.remove();
						groupRows.clear();
						if (pluginsRow !== null && pluginsRow.parentNode !== null) pluginsRow.remove();
						return;
					}
					// 未分组（插件入口兜底）计数随分组配置实时重算
					state.count = rows.filter((r) => !CORE.has(r.id) && groupOf(r.id) === undefined).length;
					const injected = new Set([...groupRows.values(), pluginsRow].filter(Boolean));
					// 1) 同步按钮引用表：清理失效引用，按 DOM 顺序把新按钮（未被
					//    引用的按钮，例如 React 重建）匹配到尚未被引用的台账条目
					const alive = new Set();
					for (const child of navList.children) {
						if (injected.has(child) || child.tagName !== "BUTTON") continue;
						alive.add(child);
					}
					for (const [id, el] of [...buttonRefs]) {
						if (!alive.has(el)) buttonRefs.delete(id);
					}
					const taken = new Set(buttonRefs.values());
					let bi = 0;
					for (const child of navList.children) {
						if (injected.has(child) || child.tagName !== "BUTTON") continue;
						if (taken.has(child)) continue;
						while (bi < rows.length && buttonRefs.has(rows[bi].id)) bi += 1;
						if (bi < rows.length) buttonRefs.set(rows[bi].id, child);
					}
					// 2) 给每个原生按钮打标记：CORE=无 / 有分组=组 id / 未分组=插件入口
					const coreEls = [];
					for (const [id, btn] of buttonRefs) {
						if (!alive.has(btn)) continue;
						const gid = groupOf(id);
						if (CORE.has(id)) {
							delete btn.dataset.snavPlugin;
							delete btn.dataset.snavGroup;
							coreEls.push(btn);
						} else if (gid !== undefined) {
							btn.dataset.snavGroup = gid;
							delete btn.dataset.snavPlugin;
						} else {
							btn.dataset.snavPlugin = "1";
							delete btn.dataset.snavGroup;
						}
					}
					// 3) 折叠标记
					if (state.folded) navList.dataset.snavFolded = "1";
					else delete navList.dataset.snavFolded;
					// 注意：不能用 dataset（`snavOpen${id}` 会转成 data-snav-open1，
					// 与 CSS 的 data-snav-open-1 不匹配），必须显式 setAttribute
					for (const g of state.groups) {
						if (state.open[g.id]) navList.setAttribute(`data-snav-open-${g.id}`, "1");
						else navList.removeAttribute(`data-snav-open-${g.id}`);
					}
					// 4) 注入行对齐：分组行（按配置顺序）+ 插件入口行（未分组>0 时），
					//    统一排在最后一个核心项之后
					const wantedGids = state.groups.map((g) => g.id);
					for (const [gid, el] of [...groupRows]) {
						if (!wantedGids.includes(gid)) {
							el.remove();
							groupRows.delete(gid);
						}
					}
					for (const g of state.groups) {
						if (!groupRows.has(g.id)) groupRows.set(g.id, makeRow("group", g.id));
					}
					if (pluginsRow === null) pluginsRow = makeRow("plugins");
					// 5) 一次性目标序列布局（取代“行对齐 + 归位”两步，避免两者
					//    互相拆台造成往返移动死循环）：
					//    核心项 → (分组行 + 组内条目)* → 插件入口行 → 未分组条目
					//    条目顺序按台账顺序（基于 buttonRefs，与 DOM 顺序无关）
					const seq = [];
					for (const el of coreEls) seq.push(el);
					for (const g of state.groups) {
						const row = groupRows.get(g.id);
						if (row === undefined) continue;
						seq.push(row);
						for (const r of rows) {
							if (CORE.has(r.id) || groupOf(r.id) !== g.id) continue;
							const btn = buttonRefs.get(r.id);
							if (btn !== undefined) seq.push(btn);
						}
					}
					if (state.count > 0) seq.push(pluginsRow);
					else if (pluginsRow.parentNode !== null) pluginsRow.remove();
					for (const r of rows) {
						if (CORE.has(r.id) || groupOf(r.id) !== undefined) continue;
						const btn = buttonRefs.get(r.id);
						if (btn !== undefined) seq.push(btn);
					}
					let seqAnchor = null;
					for (const el of seq) {
						const expected = seqAnchor === null ? navList.firstChild : seqAnchor.nextSibling;
						const placed = el.parentNode === navList && (expected === null ? el === navList.lastChild : el === expected);
						if (!placed) navList.insertBefore(el, expected);
						seqAnchor = el;
					}
					// 4) 更新所有注入行文本
					for (const g of state.groups) updateRow(groupRows.get(g.id), "group", g.id);
					updateRow(pluginsRow, "plugins");
				} finally {
					inSync = false;
				}
			};

			// ---- 管理页的刷新通道（分组/条目变化或语言变化时通知页面重渲染）----
			const pageListeners = new Set();
			const notifyPage = () => {
				for (const fn of [...pageListeners]) fn();
			};

			// ---- 自动分类（市场标签 → AI 兜底）----
			const CATEGORY_GROUPS = {
				ui: { zh: "界面增强", en: "UI Enhancements" },
				theme: { zh: "主题外观", en: "Themes" },
				models: { zh: "模型接入", en: "Models" },
				sessions: { zh: "会话消息", en: "Sessions" },
				memory: { zh: "记忆", en: "Memory" },
				tools: { zh: "工具能力", en: "Tools" },
				skills: { zh: "技能包", en: "Skills" },
				workflow: { zh: "工作流", en: "Workflow" },
				notify: { zh: "通知集成", en: "Notifications" },
				notifications: { zh: "通知集成", en: "Notifications" },
				development: { zh: "开发运行时", en: "Development" },
				market: { zh: "插件市场", en: "Markets" },
				fun: { zh: "娱乐", en: "Fun" }
			};
			// 预设常用模型（OpenAI 兼容 API；下拉可直接选，也可点「刷新模型列表」
			// 从用户填写的 API 拉取实际可用的模型）
			const PRESET_MODELS = [
				{ group: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
				{ group: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano"] },
				{ group: "通义千问 Qwen", models: ["qwen-max", "qwen-plus", "qwen-turbo"] },
				{ group: "智谱 GLM", models: ["glm-4-plus", "glm-4-air", "glm-4-flash"] },
				{ group: "Kimi", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-auto"] },
				{ group: "豆包 Doubao", models: ["doubao-pro-32k", "doubao-lite-32k"] }
			];
			const localeId = () => {
				try {
					return ctx.locale.getSnapshot().id;
				} catch (_ignored) {
					return "en";
				}
			};
			const groupNameOfCategory = (cat) => {
				const c = CATEGORY_GROUPS[cat];
				return c === undefined ? null : (localeId() === "zh" ? c.zh : c.en);
			};
			const ensureGroup = (name) => {
				let g = state.groups.find((x) => x.name === name);
				if (g === undefined) {
					g = { id: String(nextGroupId++), name, entries: [] };
					state.groups.push(g);
				}
				return g;
			};
			const assignToGroup = (entryId, groupName) => {
				const g = ensureGroup(groupName);
				if (!g.entries.includes(entryId)) g.entries.push(entryId);
			};
			const aiConfigured = () => state.ai.baseUrl !== "" && state.ai.apiKey !== "" && state.ai.model !== "";
			const autoSeen = new Set();
			const autoClassify = async () => {
				if (state.groupingMode !== "ai") return { assigned: 0 };
				const candidates = rows.filter((r) => !CORE.has(r.id));
				const fresh = candidates.filter((r) => groupOf(r.id) === undefined && !autoSeen.has(r.id));
				if (fresh.length === 0) return { assigned: 0, total: candidates.length, grouped: candidates.length - fresh.length };
				for (const r of fresh) autoSeen.add(r.id);
				let assigned = 0;
				try {
					const unknown = [];
					const res = await api(`${API_BASE}/lookupCategories`, { names: fresh.map((r) => r.id) });
					if (res.ok) {
						for (const r of fresh) {
							const gname = groupNameOfCategory(res.value.categories[r.id]);
							if (gname !== null) {
								assignToGroup(r.id, gname);
								assigned += 1;
							} else {
								unknown.push(r.id);
							}
						}
					} else {
						unknown.push(...fresh.map((r) => r.id));
					}
					if (unknown.length > 0 && aiConfigured()) {
						const ai = await api(`${API_BASE}/classifyAI`, { names: unknown, config: state.ai });
						if (ai.ok) {
							for (const [name, gname] of Object.entries(ai.value.groups)) {
								if (typeof gname === "string" && gname !== "" && name !== undefined) {
									assignToGroup(name, gname);
									assigned += 1;
								}
							}
						}
					}
				} catch (_ignored) {
					/* host call failed: keep manual */
				}
				if (assigned > 0) {
					savePersisted();
					applyRules();
					sync();
					notifyPage();
				}
				return { assigned, total: candidates.length, grouped: candidates.length - fresh.length + assigned, failed: fresh.length - assigned };
			};

			// ---- 台账变化（插件增删设置页）→ 重算分组并同步 ----
			const refresh = () => {
				rows = ctx.slots.entries("settings.section")
					.map((e) => ({ id: e.options.id ?? "", order: e.options.order ?? 0, label: resolveLabel(e.options.label) }))
					.sort((a, b) => a.order - b.order);
				state.count = rows.filter((r) => !CORE.has(r.id) && groupOf(r.id) === undefined).length;
				applyRules();
				sync();
				notifyPage();
				autoClassify();
			};
			ctx.effect(() => ctx.slots.subscribe("settings.section", refresh), "settings-nav: section ledger watch");
			ctx.effect(() => ctx.locale.subscribe(() => {
				refresh();
			}), "settings-nav: locale watch");

			// ---- 「分组管理」设置页（书签管理器）----
			function GroupsPage(props) {
				const tPage = props.t ?? ((k) => k);
				const [, setTick] = React.useState(0);
				// 函数式更新：setTick(v => v+1) 每次都是新值，保证订阅方调用时必定
				// 触发重渲染（无参 setState 在第二次调用起会被 React 跳过）
				const force = () => setTick((v) => v + 1);
				const [draft, setDraft] = React.useState("");
				const [renaming, setRenaming] = React.useState(null);
				const [renameDraft, setRenameDraft] = React.useState("");
				const [aiDraft, setAiDraft] = React.useState({ baseUrl: state.ai.baseUrl, apiKey: state.ai.apiKey, model: state.ai.model });
				const [aiNotice, setAiNotice] = React.useState(null);
				const [aiBusy, setAiBusy] = React.useState(false);
				const [remoteModels, setRemoteModels] = React.useState([]);
				const [refreshingModels, setRefreshingModels] = React.useState(false);
				React.useEffect(() => {
					pageListeners.add(force);
					return () => {
						pageListeners.delete(force);
					};
				}, []);
				const list = rows.filter((r) => !CORE.has(r.id));
				const mutate = (fn) => {
					fn();
					savePersisted();
					applyRules();
					sync();
					notifyPage();
				};
				const createGroup = () => {
					const name = draft.trim();
					if (name === "") return;
					mutate(() => {
						state.groups.push({ id: String(nextGroupId++), name, entries: [] });
					});
					setDraft("");
				};
				const moveToGroup = (entryId, gid) => {
					if (gid === "") return;
					mutate(() => {
						for (const g of state.groups) g.entries = g.entries.filter((id) => id !== entryId);
						const target = state.groups.find((g) => g.id === gid);
						if (target !== undefined && !target.entries.includes(entryId)) target.entries.push(entryId);
					});
				};
				const removeFromGroup = (entryId, gid) => {
					mutate(() => {
						const g = state.groups.find((x) => x.id === gid);
						if (g !== undefined) g.entries = g.entries.filter((id) => id !== entryId);
					});
				};
				const deleteGroup = (gid) => {
					mutate(() => {
						state.groups = state.groups.filter((g) => g.id !== gid);
						delete state.open[gid];
					});
				};
				const startRename = (g) => {
					setRenaming(g.id);
					setRenameDraft(g.name);
				};
				const commitRename = (gid) => {
					const name = renameDraft.trim();
					if (name !== "") {
						mutate(() => {
							const g = state.groups.find((x) => x.id === gid);
							if (g !== undefined) g.name = name;
						});
					}
					setRenaming(null);
				};

				const membership = new Map();
				for (const g of state.groups) for (const id of g.entries) if (list.some((r) => r.id === id)) membership.set(id, g.id);
				const ungrouped = list.filter((r) => !membership.has(r.id));
				const inGroup = (id) => list.some((r) => r.id === id);

				const toggleMode = () => {
					state.groupingMode = state.groupingMode === "ai" ? "manual" : "ai";
					savePersisted();
					notifyPage();
				};
				const saveAi = () => {
					state.ai = { baseUrl: aiDraft.baseUrl.trim(), apiKey: aiDraft.apiKey.trim(), model: aiDraft.model.trim() };
					savePersisted();
					setAiNotice({ kind: "ok", text: tPage("aiSaved") });
				};
				const runNow = async () => {
					setAiBusy(true);
					setAiNotice(null);
					try {
						autoSeen.clear();
						const r = await autoClassify();
						if (r.assigned > 0) setAiNotice({ kind: "ok", text: tPage("aiAssigned").replace("{n}", String(r.assigned)) });
						else if (r.total === 0) setAiNotice({ kind: "ok", text: tPage("aiNoEntries") });
						else if (r.failed === 0) setAiNotice({ kind: "ok", text: tPage("aiAllGrouped").replace("{n}", String(r.total)) });
						else setAiNotice({ kind: "warn", text: tPage("aiFailedHint").replace("{n}", String(r.failed)) });
					} catch (e) {
						setAiNotice({ kind: "error", text: String(e) });
					}
					setAiBusy(false);
				};
				const refreshModels = async () => {
					setRefreshingModels(true);
					setAiNotice(null);
					try {
						const res = await api(`${API_BASE}/listModels`, { config: { baseUrl: aiDraft.baseUrl.trim(), apiKey: aiDraft.apiKey.trim() } });
						if (res.ok) {
							setRemoteModels(res.value.models);
							setAiNotice({ kind: "ok", text: res.value.models.length > 0 ? tPage("aiModelsFetched").replace("{n}", String(res.value.models.length)) : tPage("aiModelsEmpty") });
						} else {
							setAiNotice({ kind: "error", text: `${res.error?.code}: ${res.error?.message}` });
						}
					} catch (e) {
						setAiNotice({ kind: "error", text: String(e) });
					}
					setRefreshingModels(false);
				};
				// 下拉选项：预设分组 + 远程模型 + 已保存模型兜底
				const modelGroups = [];
				for (const pg of PRESET_MODELS) modelGroups.push({ label: pg.group, items: pg.models });
				if (remoteModels.length > 0) modelGroups.push({ label: tPage("aiMyModels"), items: remoteModels });
				const known = new Set(modelGroups.flatMap((g) => g.items));
				if (aiDraft.model !== "" && !known.has(aiDraft.model)) modelGroups.push({ label: tPage("aiCurrent"), items: [aiDraft.model] });
				const aiOn = state.groupingMode === "ai";
				return React.createElement("div", { className: "dsh-snav-page" },
					React.createElement("div", { className: "dsh-snav-gcard" },
						React.createElement("div", { className: "dsh-snav-ghead" },
							React.createElement("span", { className: "dsh-snav-gname" }, tPage("aiClassify")),
							React.createElement("button", {
								type: "button",
								role: "switch",
								"aria-checked": aiOn,
								className: "dsh-snav-switch" + (aiOn ? " dsh-snav-switch-on" : ""),
								onClick: toggleMode,
							},
								React.createElement("span", { className: "dsh-snav-switch-knob" }),
							),
						),
						React.createElement("span", { className: "dsh-snav-hint" }, tPage("aiClassifyDesc")),
						React.createElement("span", { className: "dsh-snav-hint" }, aiOn ? tPage("aiModeLabel") : tPage("manualModeLabel")),
						aiOn
							? React.createElement(React.Fragment, null,
								React.createElement("div", { className: "dsh-snav-gitems" },
									React.createElement("input", { className: "dsh-snav-input", placeholder: tPage("aiBaseUrl"), value: aiDraft.baseUrl, onChange: (e) => setAiDraft({ ...aiDraft, baseUrl: e.target.value }) }),
									React.createElement("input", { className: "dsh-snav-input", type: "password", placeholder: tPage("aiApiKey"), value: aiDraft.apiKey, onChange: (e) => setAiDraft({ ...aiDraft, apiKey: e.target.value }) }),
									React.createElement("select", {
										className: "dsh-snav-select",
										style: { width: "100%", height: 32 },
										value: aiDraft.model,
										onChange: (e) => setAiDraft({ ...aiDraft, model: e.target.value }),
									},
										React.createElement("option", { value: "" }, tPage("aiModelPlaceholder")),
										modelGroups.map((g) =>
											React.createElement("optgroup", { key: g.label, label: g.label },
												g.items.map((m) => React.createElement("option", { key: m, value: m }, m)),
											),
										),
									),
									React.createElement("span", { className: "dsh-snav-hint" }, tPage("aiModelsHint")),
									React.createElement("div", { className: "dsh-snav-ghead" },
										React.createElement("button", { className: "dsh-snav-btn", onClick: refreshModels, disabled: refreshingModels }, refreshingModels ? tPage("aiRunning") : tPage("aiRefreshModels")),
									),
									React.createElement("div", { className: "dsh-snav-ghead" },
										React.createElement("button", { className: "dsh-snav-btn", onClick: saveAi }, tPage("aiSave")),
										React.createElement("button", { className: "dsh-snav-btn", onClick: runNow, disabled: aiBusy }, aiBusy ? tPage("aiRunning") : tPage("aiRunNow")),
									),
								),
							)
							: null,
						aiNotice !== null
							? React.createElement("p", { className: aiNotice.kind === "ok" ? "dsh-snav-ok" : aiNotice.kind === "warn" ? "dsh-snav-warn" : "dsh-snav-err" }, aiNotice.text)
							: null,
					),
					React.createElement("div", { className: "dsh-snav-new" },
						React.createElement("input", {
							className: "dsh-snav-input",
							placeholder: tPage("groupName"),
							value: draft,
							onChange: (e) => setDraft(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") createGroup();
							},
						}),
						React.createElement("button", { className: "dsh-snav-btn", onClick: createGroup }, tPage("newGroup")),
					),
					state.groups.length === 0
						? React.createElement("p", { className: "dsh-snav-hint" }, tPage("noGroups"))
						: state.groups.map((g) => {
							const items = g.entries.filter(inGroup);
							return React.createElement("div", { key: g.id, className: "dsh-snav-gcard" },
								React.createElement("div", { className: "dsh-snav-ghead" },
									renaming === g.id
										? React.createElement(React.Fragment, null,
											React.createElement("input", {
												className: "dsh-snav-input",
												value: renameDraft,
												onChange: (e) => setRenameDraft(e.target.value),
												onKeyDown: (e) => {
													if (e.key === "Enter") commitRename(g.id);
													if (e.key === "Escape") setRenaming(null);
												},
											}),
											React.createElement("button", { className: "dsh-snav-btn", onClick: () => commitRename(g.id) }, tPage("rename")),
										)
										: React.createElement(React.Fragment, null,
											React.createElement("span", { className: "dsh-snav-gname" }, `${g.name} (${items.length})`),
											React.createElement("button", { className: "dsh-snav-btn dsh-snav-mini", onClick: () => startRename(g) }, tPage("rename")),
											React.createElement("button", { className: "dsh-snav-btn dsh-snav-mini dsh-snav-danger", onClick: () => deleteGroup(g.id) }, tPage("delete")),
										),
								),
								React.createElement("div", { className: "dsh-snav-gitems" },
									items.length === 0
										? React.createElement("span", { className: "dsh-snav-hint" }, tPage("empty"))
										: items.map((id) => {
											const row = list.find((r) => r.id === id);
											return React.createElement("div", { key: id, className: "dsh-snav-item" },
												React.createElement("span", { className: "dsh-snav-itemname" }, row.label || id),
												React.createElement("button", { className: "dsh-snav-btn dsh-snav-mini", onClick: () => removeFromGroup(id, g.id) }, tPage("remove")),
											);
										}),
								),
							);
						}),
					React.createElement("div", { className: "dsh-snav-ung" },
						React.createElement("div", { className: "dsh-snav-ghead" },
							React.createElement("span", { className: "dsh-snav-gname" }, `${tPage("ungrouped")} (${ungrouped.length})`),
						),
						ungrouped.length === 0
							? React.createElement("span", { className: "dsh-snav-hint" }, tPage("empty"))
							: ungrouped.map((r) =>
								React.createElement("div", { key: r.id, className: "dsh-snav-item" },
									React.createElement("span", { className: "dsh-snav-itemname" }, r.label || r.id),
									React.createElement("select", {
										className: "dsh-snav-select",
										value: "",
										onChange: (e) => {
											if (e.target.value !== "") moveToGroup(r.id, e.target.value);
										},
									},
										React.createElement("option", { value: "" }, tPage("addToGroup")),
										state.groups.map((g) => React.createElement("option", { key: g.id, value: g.id }, g.name)),
									),
								),
							),
					),
				);
			}

			// ---- 「插件管理」设置页（禁用 / 启动 / 卸载）----
			function ManagePage(props) {
				const tPage = props.t ?? ((k) => k);
				const [items, setItems] = React.useState(null); // null = 加载中
				const [busy, setBusy] = React.useState(null);
				const [confirmId, setConfirmId] = React.useState(null);
				const [notice, setNotice] = React.useState(null);
				// 宿主端能力经回环 HTTP 路由调用（Remote 命名空间不会挂载到浏览器）
				const load = () => {
					api(`${API_BASE}/list`)
						.then((res) => {
							setItems(res.ok ? res.value.entries : []);
							if (!res.ok) setNotice({ kind: "error", text: `${res.error?.code}: ${res.error?.message}` });
						})
						.catch((e) => {
							setItems([]);
							setNotice({ kind: "error", text: String(e) });
						});
				};
				React.useEffect(() => {
					load();
				}, []);
				const act = (moduleName, path, body, okText) => {
					setBusy(moduleName);
					api(path, body)
						.then((res) => {
							setNotice(res.ok ? { kind: "ok", text: okText } : { kind: "error", text: `${res.error?.code}: ${res.error?.message}` });
							setConfirmId(null);
							load();
						})
						.catch((e) => setNotice({ kind: "error", text: String(e) }))
						.finally(() => setBusy(null));
				};
				const phaseText = (phase) => {
					if (phase === "active") return tPage("phaseActive");
					if (phase === "failed") return tPage("phaseFailed");
					if (phase === "loading") return tPage("phaseLoading");
					return tPage("phasePending");
				};
				const list = items ?? [];
				return React.createElement("div", { className: "dsh-snav-page" },
					React.createElement("p", { className: "dsh-snav-hint" }, tPage("manageDesc")),
					notice !== null
						? React.createElement("p", { className: notice.kind === "ok" ? "dsh-snav-ok" : "dsh-snav-err" }, notice.text)
						: null,
					items === null
						? React.createElement("p", { className: "dsh-snav-hint" }, tPage("loading"))
						: list.length === 0
							? React.createElement("p", { className: "dsh-snav-hint" }, tPage("empty"))
							: React.createElement("div", { className: "dsh-snav-gitems" },
								list.map((it) =>
									React.createElement("div", { key: it.entryId, className: "dsh-snav-gcard" },
										React.createElement("div", { className: "dsh-snav-ghead" },
											React.createElement("span", { className: "dsh-snav-gname" },
												it.moduleName,
												React.createElement("span", {
													className: "dsh-snav-state",
													"data-enabled": it.enabled ? "true" : "false",
												}, it.enabled ? tPage("enabled") : tPage("disabledTag")),
												it.enabled ? React.createElement("span", { className: "dsh-snav-hint" }, phaseText(it.fiberPhase)) : null,
												it.manageable ? null : React.createElement("span", { className: "dsh-snav-hint" }, tPage("bundleOnly")),
											),
											it.manageable
												? React.createElement(React.Fragment, null,
													busy === it.moduleName
														? React.createElement("span", { className: "dsh-snav-hint" }, "…")
														: it.enabled
															? React.createElement("button", { className: "dsh-snav-btn dsh-snav-mini", onClick: () => act(it.moduleName, `${API_BASE}/setEnabled`, { moduleName: it.moduleName, enabled: !it.enabled }, tPage("opOk")) }, tPage("disable"))
															: React.createElement("button", { className: "dsh-snav-btn dsh-snav-mini", onClick: () => act(it.moduleName, `${API_BASE}/setEnabled`, { moduleName: it.moduleName, enabled: !it.enabled }, tPage("opOk")) }, tPage("enable")),
													confirmId === it.moduleName
														? React.createElement(React.Fragment, null,
															React.createElement("button", { className: "dsh-snav-btn dsh-snav-mini dsh-snav-danger", onClick: () => act(it.moduleName, `${API_BASE}/uninstall`, { moduleName: it.moduleName }, tPage("opOk")) }, tPage("uninstallConfirm")),
															React.createElement("button", { className: "dsh-snav-btn dsh-snav-mini", onClick: () => setConfirmId(null) }, tPage("cancel")),
														)
														: React.createElement("button", { className: "dsh-snav-btn dsh-snav-mini dsh-snav-danger", onClick: () => setConfirmId(it.moduleName) }, tPage("uninstall")),
												)
												: null,
										),
									),
								),
							),
					React.createElement("p", { className: "dsh-snav-hint" }, tPage("selfHint")),
				);
			}

			// ---- 「通用设置」区的折叠总开关 ----
			function FoldToggleRow(props) {
				const tRow = props.t ?? ((k) => k);
				const [, setTick] = React.useState(0);
				// 函数式更新：setTick(v => v+1) 每次都是新值，保证订阅方调用时必定
				// 触发重渲染（无参 setState 在第二次调用起会被 React 跳过）
				const force = () => setTick((v) => v + 1);
				React.useEffect(() => {
					pageListeners.add(force);
					return () => {
						pageListeners.delete(force);
					};
				}, []);
				const on = state.foldThirdParty;
				return React.createElement("div", { className: "dsh-snav-toggle-row" },
					React.createElement("div", { className: "dsh-snav-toggle-text" },
						React.createElement("span", { className: "dsh-snav-toggle-title" }, tRow("foldToggle")),
						React.createElement("span", { className: "dsh-snav-toggle-desc" }, tRow("foldToggleDesc")),
					),
					React.createElement("button", {
						type: "button",
						role: "switch",
						"aria-checked": on,
						className: "dsh-snav-switch" + (on ? " dsh-snav-switch-on" : ""),
						onClick: () => {
							state.foldThirdParty = !state.foldThirdParty;
							savePersisted();
							sync();
							notifyPage();
						},
					},
						React.createElement("span", { className: "dsh-snav-switch-knob" }),
					),
				);
			}

			ctx.slots.inject("settings.general.item", () => ctx.slots.register(
				{ name: "settings.general.item", id: "settings-nav-fold-toggle", order: 100, locale: NS },
				FoldToggleRow,
			));

			ctx.slots.inject("settings.section", () => ctx.slots.register(
				{ name: "settings.section", id: "settings-nav-groups", order: 25, label: () => t("groups"), locale: NS },
				GroupsPage,
			));
			ctx.slots.inject("settings.section", () => ctx.slots.register(
				{ name: "settings.section", id: "settings-nav-manage", order: 26, label: () => t("manage"), locale: NS },
				ManagePage,
			));

			// 面板打开 / React 重渲染导航列表时重新注入行与标记。
			// 只响应两类变化：body 直接子级（设置面板挂载/卸载）与导航列表子树
			// （React 重渲染按钮）；其余区域的 DOM 变化一律忽略，避免误触发。
			// 附加风暴看门狗：异常时挂起观察 2 秒并告警，页面不会被永久卡死。
			let syncCount = 0;
			let stormBase = 0;
			let observerSuspended = false;
			let stormTimer = null;
			const observer = new MutationObserver((mutations) => {
				if (observerSuspended) return;
				let needSync = false;
				for (const m of mutations) {
					if (m.type !== "childList") continue;
					const target = m.target;
					if (!(target instanceof Element)) continue;
					if (target.closest?.(".dsh-snav-chip")) continue;
					if (target === document.body || target.closest?.(FOLD_SEL) !== null) {
						needSync = true;
						break;
					}
				}
				if (!needSync) return;
				const now = Date.now();
				if (now - stormBase > 1000) {
					syncCount = 0;
					stormBase = now;
				}
				syncCount += 1;
				if (syncCount > 20) {
					console.warn("[settings-nav-organizer] mutation storm — suspending observer for 2s");
					observerSuspended = true;
					observer.disconnect();
					stormTimer = setTimeout(() => {
						stormTimer = null;
						observerSuspended = false;
						observer.observe(document.body, { childList: true, subtree: true });
						sync();
					}, 2000);
					return;
				}
				sync();
			});
			observer.observe(document.body, { childList: true, subtree: true });
			ctx.effect(() => () => {
				observer.disconnect();
				if (stormTimer !== null) clearTimeout(stormTimer);
				for (const [, el] of groupRows) el.remove();
				if (pluginsRow !== null) pluginsRow.remove();
			}, "settings-nav: dom observer cleanup");

			refresh();
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
