/**
 * Host loader entry for the dsh-settings-nav-organizer plugin.
 *
 * Provides loopback HTTP routes (`/api/dsh-settings-nav-organizer/*`) so the
 * browser UI can disable / enable / uninstall profile-patch plugins, look up
 * market categories, classify plugins with the user-configured AI model, and
 * list models. Bundle-owned rows are reported read-only (`manageable: false`).
 *
 * Why HTTP routes instead of a Remote service: plugin-registered Remote
 * services are not mounted into the browser `remote` namespace (api-remotes
 * only mounts compile-time generated contributions), so the browser must call
 * the host through the loopback webserver — the same pattern dsh-ticktick uses.
 *
 * Persistence is file-based on the profile layer:
 *  - disable/enable rewrite the entry's block in `cordis.patch.yml`;
 *  - uninstall additionally drops the dependency from the profile
 *    `package.json` and stops the running entry.
 * Runtime effect (fiber stop/start) goes through the Loader entry.
 */
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Normalize execFile output across callback wrappers and test doubles. */
function execStdoutText(result) {
	return typeof result === "string" ? result : result.stdout;
}

/** Mirror of the Cordis FiberState const enum (values must match). */
const FIBER_STATE = { PENDING: 0, LOADING: 1, ACTIVE: 2, FAILED: 3, DISPOSED: 4, UNLOADING: 5 };

/** Public projection of Cordis Fiber states. */
const FIBER_PHASE = {
	[FIBER_STATE.PENDING]: "pending",
	[FIBER_STATE.LOADING]: "loading",
	[FIBER_STATE.ACTIVE]: "active",
	[FIBER_STATE.FAILED]: "failed",
	[FIBER_STATE.DISPOSED]: null,
	[FIBER_STATE.UNLOADING]: "unloading"
};

function success(value) {
	return Object.freeze({ ok: true, value: Object.freeze(value) });
}
function rejected(error) {
	return Object.freeze({ ok: false, error: Object.freeze(error) });
}

/** Cap on JSON request bodies. */
const MAX_JSON_BODY_BYTES = 256 * 1024;

/** Services required by the host half (loader for entry state, webServer for routes). */
const inject = ["loader", "webServer"];

/** Strict loopback fence (same policy as dsh-ticktick). */
function isLoopbackRequest(request) {
	const address = request.socket.remoteAddress;
	if (address !== "127.0.0.1" && address !== "::1" && address !== "::ffff:127.0.0.1") return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL(`http://${host}`);
	} catch {
		return false;
	}
	if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === undefined) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}

/** One JSON response. */
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(payload);
}

/** Read a JSON request body (undefined when too large or unparseable). */
async function readJsonBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		size += chunk.length;
		if (size > MAX_JSON_BODY_BYTES) return undefined;
		chunks.push(chunk);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text === "") return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

/**
 * Locate one entry block in a loader patch YAML text by its `id`.
 * Returns [startLine, endLineExclusive] of the block (the `- id: x` line and
 * every following more-indented line), or null when the id is absent.
 */
function patchBlockRange(lines, id) {
	let start = -1;
	let indent = 0;
	for (let i = 0; i < lines.length; i++) {
		const m = /^(\s*)- id:\s*(\S+)\s*$/.exec(lines[i]);
		if (m !== null && m[2] === id) {
			start = i;
			indent = m[1].length;
			break;
		}
	}
	if (start < 0) return null;
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "") continue;
		const sibling = /^(\s*)- /.exec(line);
		if (sibling !== null && sibling[1].length <= indent) {
			end = i;
			break;
		}
		const key = /^(\s*)\S/.exec(line);
		if (key !== null && key[1].length < indent) {
			end = i;
			break;
		}
	}
	return [start, end];
}

/**
 * Set (or clear) `disabled:` on an entry block by id. Returns the new text,
 * or null when the id is not present in the patch.
 */
function setPatchDisabled(text, id, disabled) {
	const lines = text.split("\n");
	const range = patchBlockRange(lines, id);
	if (range === null) return null;
	const block = lines.slice(range[0], range[1]);
	const childIndent = /^(\s*)- id:/.exec(block[0])[1].length + 2;
	const has = block.findIndex((l) => /^\s*disabled:/.test(l));
	if (disabled && has < 0) block.splice(1, 0, `${" ".repeat(childIndent)}disabled: true`);
	else if (!disabled && has >= 0) block.splice(has, 1);
	else return text;
	return [...lines.slice(0, range[0]), ...block, ...lines.slice(range[1])].join("\n");
}

/**
 * Remove an entry block by id, plus its parent `- insert:` wrapper when the
 * wrapper would become empty. Returns the new text, or null when absent.
 */
function removePatchEntry(text, id) {
	const lines = text.split("\n");
	const range = patchBlockRange(lines, id);
	if (range === null) return null;
	let insertAt = -1;
	let insertIndent = -1;
	for (let i = range[0] - 1; i >= 0; i--) {
		const m = /^(\s*)- insert:/.exec(lines[i]);
		if (m !== null) {
			insertAt = i;
			insertIndent = m[1].length;
			break;
		}
	}
	const rest = lines.slice(range[1]);
	const kept = [...lines.slice(0, range[0]), ...rest];
	if (insertAt >= 0) {
		const tail = kept.slice(insertAt + 1);
		let orphan = true;
		for (const l of tail) {
			if (l.trim() === "" || l.trim().startsWith("#")) continue;
			const s = /^(\s*)- id:/.exec(l);
			if (s !== null && s[1].length > insertIndent) {
				orphan = false;
				break;
			}
			const k = /^(\s*)\S/.exec(l);
			if (k !== null && k[1].length <= insertIndent) break;
		}
		if (orphan) {
			const idx = kept.indexOf(lines[insertAt]);
			if (idx >= 0) {
				kept.splice(idx, 1);
				if (kept[idx] !== undefined && kept[idx].trim() === "") kept.splice(idx, 1);
			}
		}
	}
	return kept.join("\n");
}

/**
 * Match registry categories to plugin names. Registry entries carry
 * `name` (e.g. "dsh-at-file") and `category`; scoped module names match on
 * their last segment too.
 * @returns {Record<string, string|null>} name → category or null.
 */
function matchCategories(registry, names) {
	const byName = new Map();
	for (const it of registry) {
		if (it && typeof it.name === "string" && typeof it.category === "string") {
			byName.set(it.name.toLowerCase(), it.category);
		}
	}
	const categories = {};
	for (const name of names) {
		const base = name.split("/").pop().toLowerCase();
		categories[name] = byName.get(name.toLowerCase()) ?? byName.get(base) ?? null;
	}
	return categories;
}

/**
 * Parse an AI chat response (JSON object `{"<name>":"<group>"}`) into a
 * name → group map, ignoring unknown keys.
 * @returns {Record<string, string|null>} name → group or null.
 */
function parseAIGroups(text, names) {
	const match = /\{[\s\S]*\}/.exec(text ?? "");
	if (match === null) return null;
	const parsed = JSON.parse(match[0]);
	const groups = {};
	for (const name of names) {
		groups[name] = typeof parsed[name] === "string" && parsed[name] !== "" ? parsed[name] : null;
	}
	return groups;
}

/* ============================================================
 * 闲置插件自动清理（idle plugin auto-pruner）
 *
 * 数据源：DSH 会话日志（$DSH_HOME/sessions 下各 workspace 的 session.jsonl.zstd），其中每条
 * `tool/call` 记录带工具名与时间戳。插件通过其工具名被「使用」，因此把
 * 工具名前缀归属到插件模块名即可计算出每个插件最后一次被使用距今的天数。
 *
 * 扫描结果合并进一个持久化「流水账」缓存（~/.dsh/cache/...-usage.json），
 * 并记录已扫描文件 mtime，之后只增量扫描新增/变更的会话文件，避免重复解压。
 * ============================================================ */

/** 顶层第三方插件里「不能碰」的模块：核心 WEB UI bundle 与本插件自身。 */
const PRUNE_PROTECT = new Set(["@linxin666/dsh-web-ui-all", "dsh-settings-nav-organizer"]);
/** 核心 DSH / 非插件模块前缀（不进入清理候选）。 */
const CORE_MODULE_RE = /^(cordis:|@deepseek-ai\/)/;

/** 工具名前缀 → 插件模块名（与 profile package.json dependencies 的键一致）。 */
const TOOL_MODULES = {
	hindsight_: "@vectorize-io/hindsight-coding-agents",
	mnemon_: "dsh-mnemon",
	agent_teams_: "@nanmicoder/dsh-agent-teams",
	vision_: "@dsh-external/dsh-vision-toolkit",
	modlens_: "@liustack/modlens",
	browser_: "@liustack/modlens",
	find_dsh_plugin: "dsh-find-plugin",
	flomo_: "dsh-flomo",
	ticktick_: "dsh-ticktick",
	dispatcher_: "dsh-task-dispatcher",
	cubox_: "dsh-cubox",
	weread_: "weread-export",
	npm_: "dsh-npm",
	cloudflare_mcp_: "dsh-cloudflare-mcp",
	notion_: "dsh-notion-connector",
	dshbackup_: "dsh-backup-migrator",
	skillmgr_: "dsh-skill-studio",
};

/** 归属一个工具名到插件模块（按前缀），找不到返回 null。 */
function toolOwner(tool) {
	for (const [prefix, mod] of Object.entries(TOOL_MODULES)) {
		if (tool.startsWith(prefix)) return mod;
	}
	return null;
}

/** DSH 主目录（会话/缓存的根）。 */
function homeBase() {
	return process.env.DSH_HOME ?? join(homedir(), ".dsh");
}
function usageCachePath() {
	return join(homeBase(), "cache", "dsh-settings-nav-organizer-usage.json");
}
function sessionsRoot() {
	return join(homeBase(), "sessions");
}

/** 读取持久化流水账；不存在或损坏时返回空结构。 */
function loadUsageLedger() {
	try {
		return JSON.parse(readFileSync(usageCachePath(), "utf8"));
	} catch (_ignored) {
		return { tools: {}, scanned: {} };
	}
}
function saveUsageLedger(ledger) {
	try {
		mkdirSync(dirname(usageCachePath()), { recursive: true });
		writeFileSync(usageCachePath(), JSON.stringify(ledger), "utf8");
	} catch (_ignored) {
		/* best effort */
	}
}

/** 受限并发地跑每个文件，避免一次性解压大量会话阻塞事件循环。 */
async function runPool(items, limit, worker) {
	let index = 0;
	const workers = new Array(Math.max(1, Math.min(limit, items.length)))
		.fill(null)
		.map(async () => {
			while (index < items.length) {
				const i = index;
				index += 1;
				await worker(items[i], i);
			}
		});
	await Promise.all(workers);
}

/**
 * 扫描会话目录，把 tool/call 合并进流水账；已扫描且未变的文件跳过。
 * @returns {Promise<{scannedFiles:number}>}
 */
async function mergeUsageLedger(ledger) {
	const root = sessionsRoot();
	if (!existsSync(root)) return { scannedFiles: 0 };
	const files = [];
	const walk = (dir) => {
		let entries;
		try {
			entries = readdirSync(dir, { withFileTypes: true });
		} catch (_ignored) {
			return;
		}
		for (const e of entries) {
			const p = join(dir, e.name);
			if (e.isDirectory()) walk(p);
			else if (e.name === "session.jsonl.zstd") files.push(p);
		}
	};
	walk(root);
	let scannedFiles = 0;
	await runPool(files, 4, async (p) => {
		let st;
		try {
			st = statSync(p);
		} catch (_ignored) {
			return;
		}
		if (ledger.scanned[p] === st.mtimeMs) return;
		let out;
		try {
			out = execStdoutText(await execFileAsync("zstd", ["-d", "-c", p], { maxBuffer: 256 * 1024 * 1024 }));
		} catch (_ignored) {
			return;
		}
		for (const line of out.split("\n")) {
			if (!line.includes('"type":"tool/call"')) continue;
			let o;
			try {
				o = JSON.parse(line);
			} catch (_ignored) {
				continue;
			}
			const name = o?.data?.name;
			const ts = o?.time;
			if (typeof name !== "string" || name === "") continue;
			const rec = ledger.tools[name] ?? (ledger.tools[name] = { calls: 0, lastTs: 0 });
			rec.calls += 1;
			if (typeof ts === "number" && ts > rec.lastTs) rec.lastTs = ts;
		}
		ledger.scanned[p] = st.mtimeMs;
		scannedFiles += 1;
	});
	return { scannedFiles };
}

/**
 * Plugin management + AI classification host logic.
 * @param ctx - host plugin context (loader + webServer).
 */
function apply(ctx) {
	const base = "/api/dsh-settings-nav-organizer";
	/** Profile user patch layer path (the only writable plugin surface). */
	const patchPath = () => join(profileRoot(), "cordis.patch.yml");
	/** Read the ids+names currently written in the profile patch. */
	const patchEntries = () => {
		try {
			const text = readFileSync(patchPath(), "utf8");
			const names = new Set();
			for (const m of text.matchAll(/^(\s*)- id:\s*(\S+)\s*$/gm)) {
				const after = text.slice(m.index + m[0].length).split("\n", 4);
				for (const line of after) {
					const n = /^\s*name:\s*(\S+)\s*$/.exec(line);
					if (n !== null) {
						names.add(n[1]);
						break;
					}
					if (line.trim() !== "" && !/^\s*(#|disabled:|config:|inject:)/.test(line)) break;
				}
			}
			return names;
		} catch (_ignored) {
			return new Set();
		}
	};
	const findEntry = (moduleName) => {
		for (const entry of ctx.loader.entries()) {
			if (entry.options.name === moduleName && !entry.options.group) return entry;
		}
		return undefined;
	};
	// 宽松匹配：处理 scoped 包（@scope/x/dsh）与 moduleName 不完全一致的情况。
	const findEntryLoose = (moduleName) => {
		for (const entry of ctx.loader.entries()) {
			if (entry.options.group) continue;
			const n = entry.options.name;
			if (n === moduleName || n.startsWith(`${moduleName}/`)) return entry;
		}
		return undefined;
	};
	/** 读 JSON 文件，失败返回 null。 */
	const readPkgFile = (p) => {
		try {
			return JSON.parse(readFileSync(p, "utf8"));
		} catch (_ignored) {
			return null;
		}
	};
	/**
	 * 解析当前 profile 根目录。优先用 ctx.baseUrl（若它确实指向含 package.json 的
	 * profile 目录）；否则回退扫描 $DSH_HOME/profiles/* 里引用了本插件的那个 profile。
	 * 避免 ctx.baseUrl 在某些宿主环境下不是 profile 目录而导致读不到 profile 配置。
	 */
	const profileRoot = () => {
		const cand = ctx.baseUrl;
		if (typeof cand === "string" && cand !== "" && existsSync(join(cand, "package.json"))) {
			const p = readPkgFile(join(cand, "package.json"));
			if (p !== null && (p.dsh?.profile !== undefined || p.dependencies !== undefined)) return cand;
		}
		const profiles = join(homeBase(), "profiles");
		let names = [];
		try {
			names = readdirSync(profiles);
		} catch (_ignored) {
			names = [];
		}
		for (const name of names) {
			const pp = join(profiles, name, "package.json");
			if (!existsSync(pp)) continue;
			const p = readPkgFile(pp);
			if (p === null) continue;
			const bundles = p.dsh?.profile?.bundles ?? [];
			if (bundles.includes("dsh-settings-nav-organizer") || p.dependencies?.["dsh-settings-nav-organizer"] !== undefined) {
				return join(profiles, name);
			}
		}
		return typeof cand === "string" ? cand : "";
	};
	/** 读取 profile package.json（依赖与 bundle 清单）。 */
	const readProfilePackage = () => readPkgFile(join(profileRoot(), "package.json"));
	/** 顶层第三方插件（dependencies 中非核心/非保护项）；顺序与 deps 一致。 */
	const thirdPartyModules = () => {
		const pkg = readProfilePackage();
		if (pkg === null) return [];
		return Object.keys(pkg.dependencies ?? {}).filter(
			(n) => !CORE_MODULE_RE.test(n) && !PRUNE_PROTECT.has(n),
		);
	};
	/**
	 * Load the plugin-market registry: local dshmarket snapshot, then network
	 * (with a local cache so a later offline run still classifies), then cache.
	 */
	const registryCachePath = () => {
		const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
		return join(home, "cache", "dsh-settings-nav-organizer-registry.json");
	};
	const loadRegistry = async () => {
		try {
			const local = join(ctx.baseUrl ?? "", "node_modules/dshmarket/data/registry-snapshot.json");
			return JSON.parse(readFileSync(local, "utf8"));
		} catch (_localMissing) {
			/* fall through to network + cache */
		}
		try {
			const res = await fetch("https://awesome-dsh-plugin.com/plugins.json", { signal: AbortSignal.timeout(10000) });
			if (res.ok) {
				const data = await res.json();
				const list = Array.isArray(data) ? data : (Array.isArray(data?.plugins) ? data.plugins : []);
				if (list.length > 0) {
					try {
						mkdirSync(dirname(registryCachePath()), { recursive: true });
						writeFileSync(registryCachePath(), JSON.stringify(list), "utf8");
					} catch (_cacheWriteFailed) {
						/* cache best effort */
					}
				}
				return list;
			}
		} catch (_networkDown) {
			/* fall through to cache */
		}
		try {
			return JSON.parse(readFileSync(registryCachePath(), "utf8"));
		} catch (_noCache) {
			return [];
		}
	};
	/** List every loader entry with runtime state and manageability. */
	const handleList = () => {
		const entries = [];
		const patchNames = patchEntries();
		for (const entry of ctx.loader.entries()) {
			if (entry.options.group) continue;
			entries.push({
				entryId: entry.id,
				moduleName: entry.options.name,
				enabled: !entry.disabled,
				fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state] ?? null,
				manageable: patchNames.has(entry.options.name)
			});
		}
		return success({ entries });
	};
	/** Disable or enable one profile-patch plugin (persisted + runtime effect). */
	const handleSetEnabled = async (request) => {
		const moduleName = typeof request?.moduleName === "string" ? request.moduleName : "";
		const enabled = request?.enabled === true;
		if (moduleName === "") return rejected({ code: "bad-request", message: "moduleName required" });
		const entry = findEntry(moduleName);
		if (entry === undefined) return rejected({ code: "not-found", message: `no loader entry named ${moduleName}` });
		if (entry.disabled === !enabled) return success({ changed: false });
		const next = setPatchDisabled(readFileSync(patchPath(), "utf8"), entry.id, !enabled);
		if (next === null) return rejected({ code: "not-manageable", message: `${moduleName} is not a profile-patch entry` });
		try {
			await entry.update({ disabled: !enabled }, false, true);
			writeFileSync(patchPath(), next, "utf8");
			return success({ changed: true });
		} catch (error) {
			return rejected({ code: "update-failed", message: error instanceof Error ? error.message : String(error) });
		}
	};
	/** Uninstall one profile-patch plugin: stop it, drop its patch row and dependency. */
	const handleUninstall = async (request) => {
		const moduleName = typeof request?.moduleName === "string" ? request.moduleName : "";
		if (moduleName === "") return rejected({ code: "bad-request", message: "moduleName required" });
		const entry = findEntry(moduleName);
		if (entry === undefined) return rejected({ code: "not-found", message: `no loader entry named ${moduleName}` });
		const patch = patchPath();
		const next = removePatchEntry(readFileSync(patch, "utf8"), entry.id);
		if (next === null) return rejected({ code: "not-manageable", message: `${moduleName} is not a profile-patch entry` });
		try {
			if (!entry.disabled) await entry.update({ disabled: true }, false, true);
		} catch (_ignored) {
			/* best effort: the row is gone from the patch, restart will not load it */
		}
		try {
			writeFileSync(patch, next, "utf8");
			const pkgPath = join(ctx.baseUrl ?? "", "package.json");
			const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
			if (pkg.dependencies !== undefined && moduleName in pkg.dependencies) {
				delete pkg.dependencies[moduleName];
				writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
			}
		} catch (error) {
			return rejected({ code: "uninstall-failed", message: error instanceof Error ? error.message : String(error) });
		}
		return success({ removed: true });
	};
	/** 统计每个顶层第三方插件的使用情况（最后一次使用距今、累计调用数）。 */
	const handleUsage = async (request) => {
		const days = Number(request?.days);
		const windowMs = Math.max(0, Number.isFinite(days) ? days : 30) * 86400000;
		const modules = thirdPartyModules();
		const now = Date.now();
		const ledger = loadUsageLedger();
		const { scannedFiles } = await mergeUsageLedger(ledger);
		saveUsageLedger(ledger);

		const stats = [];
		for (const m of modules) {
			let lastTs = 0;
			let calls = 0;
			let toolCount = 0;
			for (const [tool, rec] of Object.entries(ledger.tools)) {
				if (toolOwner(tool) !== m) continue;
				if (rec.lastTs > lastTs) lastTs = rec.lastTs;
				calls += rec.calls;
				toolCount += 1;
			}
			// detectable = 已知该模块的工具命名前缀（静态可判）；否则属 UI/无法用工具调用检测的插件。
			const detectable = Object.values(TOOL_MODULES).includes(m);
			const tracked = toolCount > 0;
			const daysIdle = lastTs === 0 ? null : (now - lastTs) / 86400000;
			// idle 候选：可检测 且（从未记录到使用 或 超过窗口未用）
			const idle = detectable && (lastTs === 0 || (now - lastTs) > windowMs);
			const reason = !detectable ? "undetectable"
				: !tracked ? "never-used"
					: idle ? "idle" : "active";
			stats.push({
				module: m,
				detectable,
				tracked,
				idle,
				reason,
				recommend: idle, // 预览时默认勾选
				calls,
				toolCount,
				lastUsedAt: lastTs === 0 ? null : lastTs,
				daysIdle: daysIdle === null ? null : Math.round(daysIdle * 10) / 10,
			});
		}
		// 候选优先（idle 在前，按闲置时长降序），其次活跃，最后不可检测
		stats.sort((a, b) => {
			if (a.idle !== b.idle) return a.idle ? -1 : 1;
			if (a.reason === "active" && b.reason !== "active") return -1;
			if (b.reason === "active" && a.reason !== "active") return 1;
			return (b.daysIdle ?? 0) - (a.daysIdle ?? 0);
		});
		return success({ days, scannedFiles, scannedAt: now, plugins: stats, debug: { profileRoot: profileRoot(), moduleCount: modules.length } });
	};
	/** 一键卸除若干顶层第三方插件：从 bundle 清单 + dependencies + patch 移除并停止。 */
	const handlePrune = async (request) => {
		const names = Array.isArray(request?.names)
			? request.names.filter((n) => typeof n === "string" && n !== "")
			: [];
		if (names.length === 0) return rejected({ code: "bad-request", message: "names required" });
		const allowed = new Set(thirdPartyModules());
		const pkg = readProfilePackage();
		if (pkg === null) return rejected({ code: "package-missing", message: "cannot read profile package.json" });
		const results = [];
		for (const moduleName of names) {
			if (!allowed.has(moduleName)) {
				results.push({ moduleName, ok: false, error: "not-a-removable-third-party-plugin" });
				continue;
			}
			try {
				const entry = findEntryLoose(moduleName);
				let stopped = false;
				if (entry !== undefined && entry.disabled !== true) {
					try {
						await entry.update({ disabled: true }, false, true);
						stopped = true;
					} catch (_ignored) {
						/* best effort: 行已从清单移除，重启后不再加载 */
					}
				}
				// 从 cordis.patch.yml 移除该 entry 块（bundle 挂载时通常为空操作）
				try {
					const patch = patchPath();
					const id = entry?.id;
					if (typeof id === "string") {
						const next = removePatchEntry(readFileSync(patch, "utf8"), id);
						if (next !== null) writeFileSync(patch, next, "utf8");
					}
				} catch (_ignored) {
					/* best effort */
				}
				// 从 profile package.json 的 dependencies 与 dsh.profile.bundles 移除
				let changed = false;
				if (pkg.dependencies !== undefined && moduleName in pkg.dependencies) {
					delete pkg.dependencies[moduleName];
					changed = true;
				}
				const bundles = pkg.dsh?.profile?.bundles;
				if (Array.isArray(bundles)) {
					const idx = bundles.indexOf(moduleName);
					if (idx >= 0) {
						bundles.splice(idx, 1);
						changed = true;
					}
				}
				if (changed) {
					writeFileSync(join(profileRoot(), "package.json"), `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
				}
				results.push({ moduleName, ok: true, removed: true, stopped, changedPkg: changed });
			} catch (error) {
				results.push({ moduleName, ok: false, error: error instanceof Error ? error.message : String(error) });
			}
		}
		return success({ results });
	};
	/** Look up market categories for plugin names. */
	const handleLookupCategories = async (request) => {
		const names = Array.isArray(request?.names) ? request.names.filter((n) => typeof n === "string") : [];
		if (names.length === 0) return success({ categories: {} });
		const registry = await loadRegistry();
		return success({ categories: matchCategories(registry, names) });
	};
	/** Classify plugin names with the user-configured AI model. */
	const handleClassifyAI = async (request) => {
		const names = Array.isArray(request?.names) ? request.names.filter((n) => typeof n === "string") : [];
		const config = request?.config ?? {};
		const { baseUrl, apiKey, model } = config;
		if (names.length === 0) return rejected({ code: "bad-request", message: "names required" });
		if (typeof baseUrl !== "string" || baseUrl === "" || typeof apiKey !== "string" || apiKey === "" || typeof model !== "string" || model === "") {
			return rejected({ code: "ai-not-configured", message: "AI model config is incomplete" });
		}
		const prompt = `把以下 DeepSeek Harness 插件名归入合适的分类组，只允许使用这些组名（中文）：界面增强、主题外观、模型接入、会话消息、记忆、工具能力、技能包、工作流、通知集成、开发运行时、插件市场、娱乐、其他。\n插件：${names.join("、")}\n只输出 JSON 对象，格式：{"<插件名>":"<组名>"}，不要输出其他内容。`;
		try {
			const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model,
					messages: [{ role: "user", content: prompt }],
					temperature: 0.2
				}),
				signal: AbortSignal.timeout(30000)
			});
			if (!res.ok) return rejected({ code: "ai-http", message: `AI API responded ${res.status}` });
			const data = await res.json();
			const groups = parseAIGroups(data?.choices?.[0]?.message?.content ?? "", names);
			if (groups === null) return rejected({ code: "ai-parse", message: "AI response is not JSON" });
			return success({ groups });
		} catch (error) {
			return rejected({ code: "ai-failed", message: error instanceof Error ? error.message : String(error) });
		}
	};
	/** Verify the AI config with one minimal chat request. */
	const handleTestConfig = async (request) => {
		const config = request?.config ?? {};
		const { baseUrl, apiKey, model } = config;
		if (typeof baseUrl !== "string" || baseUrl === "" || typeof apiKey !== "string" || apiKey === "" || typeof model !== "string" || model === "") {
			return rejected({ code: "ai-not-configured", message: "AI model config is incomplete" });
		}
		try {
			const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model,
					messages: [{ role: "user", content: "ping" }],
					max_tokens: 8
				}),
				signal: AbortSignal.timeout(20000)
			});
			if (!res.ok) {
				const text = await res.text().catch(() => "");
				const hint = res.status === 401 ? "API key invalid or unauthorized"
					: res.status === 404 ? "model not found or wrong API path"
					: text.slice(0, 300) || `HTTP ${res.status}`;
				return rejected({ code: "ai-http", status: res.status, message: hint });
			}
			const data = await res.json();
			const reply = data?.choices?.[0]?.message?.content ?? "";
			return success({ reply: String(reply).slice(0, 120) });
		} catch (error) {
			return rejected({ code: "ai-failed", message: error instanceof Error ? error.message : String(error) });
		}
	};
	/** List models available on the user-configured OpenAI-compatible API. */
	const handleListModels = async (request) => {
		const config = request?.config ?? {};
		const { baseUrl, apiKey } = config;
		if (typeof baseUrl !== "string" || baseUrl === "" || typeof apiKey !== "string" || apiKey === "") {
			return rejected({ code: "ai-not-configured", message: "API base URL and key required" });
		}
		try {
			const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, {
				headers: { authorization: `Bearer ${apiKey}` },
				signal: AbortSignal.timeout(15000)
			});
			if (!res.ok) return rejected({ code: "ai-http", message: `models API responded ${res.status}` });
			const data = await res.json();
			const models = Array.isArray(data?.data)
				? data.data.map((m) => (m && typeof m.id === "string" ? m.id : null)).filter((x) => x !== null)
				: [];
			return success({ models });
		} catch (error) {
			return rejected({ code: "ai-failed", message: error instanceof Error ? error.message : String(error) });
		}
	};

	const routes = [
		{ kind: "exact", path: `${base}/list`, handler: async (req, res) => { writeJson(res, 200, handleList()); } },
		{ kind: "exact", path: `${base}/setEnabled`, handler: async (req, res) => { writeJson(res, 200, await handleSetEnabled(await readJsonBody(req))); } },
		{ kind: "exact", path: `${base}/uninstall`, handler: async (req, res) => { writeJson(res, 200, await handleUninstall(await readJsonBody(req))); } },
		{ kind: "exact", path: `${base}/usage`, handler: async (req, res) => { writeJson(res, 200, await handleUsage(await readJsonBody(req))); } },
		{ kind: "exact", path: `${base}/prune`, handler: async (req, res) => { writeJson(res, 200, await handlePrune(await readJsonBody(req))); } },
		{ kind: "exact", path: `${base}/lookupCategories`, handler: async (req, res) => { writeJson(res, 200, await handleLookupCategories(await readJsonBody(req))); } },
		{ kind: "exact", path: `${base}/classifyAI`, handler: async (req, res) => { writeJson(res, 200, await handleClassifyAI(await readJsonBody(req))); } },
		{ kind: "exact", path: `${base}/listModels`, handler: async (req, res) => { writeJson(res, 200, await handleListModels(await readJsonBody(req))); } },
		{ kind: "exact", path: `${base}/testConfig`, handler: async (req, res) => { writeJson(res, 200, await handleTestConfig(await readJsonBody(req))); } }
	];
	ctx.effect(() => {
		const disposers = routes.map((route) => ctx.webServer.register({
			kind: "exact",
			path: route.path,
			handler: (req, res) => {
				if (!isLoopbackRequest(req)) {
					writeJson(res, 403, { error: "forbidden: loopback-only" });
					return;
				}
				route.handler(req, res);
			}
		}));
		return () => {
			for (const dispose of disposers) dispose();
		};
	}, "settings-nav-organizer: api routes");
}

export { apply, inject, matchCategories, parseAIGroups, patchBlockRange, setPatchDisabled, removePatchEntry, execStdoutText };
