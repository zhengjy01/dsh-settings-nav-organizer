/**
 * Host loader entry for the settings-nav-fold plugin.
 *
 * Provides the `settingsNavManage` Remote service so the browser UI can
 * disable / enable / uninstall profile-patch plugins (rows written in the
 * profile's `cordis.patch.yml`, i.e. user-managed plugins like this one).
 * Bundle-owned rows are reported read-only (`manageable: false`).
 *
 * Persistence is file-based on the profile layer:
 *  - disable/enable rewrite the entry's block in `cordis.patch.yml`;
 *  - uninstall additionally drops the dependency from the profile
 *    `package.json` and stops the running entry.
 * Runtime effect (fiber stop/start) goes through the Loader entry.
 */
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

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
	// find the nearest enclosing `- insert:` line before the block
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
		// does any other `- id:` survive inside the wrapper before the next
		// sibling (same-or-less indentation) or EOF? (empty lines and
		// comments do not end the wrapper)
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
			if (k !== null && k[1].length <= insertIndent) break; // next sibling/key ends the wrapper
		}
		if (orphan) {
			// drop the wrapper line (and any immediately following blank line)
			const idx = kept.indexOf(lines[insertAt]);
			if (idx >= 0) {
				kept.splice(idx, 1);
				if (kept[idx] !== undefined && kept[idx].trim() === "") kept.splice(idx, 1);
			}
		}
	}
	return kept.join("\n");
}

/** Remote service backing the browser plugin-management UI. */
class SettingsNavManageService extends TypertRemoteService {
	static inject = ["loader"];
	constructor(ctx) {
		super(ctx, "settingsNavManage");
	}
	/** Profile user patch layer path (the only writable plugin surface). */
	patchPath() {
		return join(this.ctx.baseUrl ?? "", "cordis.patch.yml");
	}
	/** Read the ids+names currently written in the profile patch. */
	patchEntries() {
		try {
			const text = readFileSync(this.patchPath(), "utf8");
			const names = new Set();
			for (const m of text.matchAll(/^(\s*)- id:\s*(\S+)\s*$/gm)) {
				// the sibling `name:` line right below the id
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
	}
	findEntry(moduleName) {
		for (const entry of this.ctx.loader.entries()) {
			if (entry.options.name === moduleName && !entry.options.group) return entry;
		}
		return undefined;
	}
	/**
	 * List every loader entry with its runtime state and whether it is
	 * manageable from the profile patch layer.
	 */
	list() {
		const entries = [];
		const patchNames = this.patchEntries();
		for (const entry of this.ctx.loader.entries()) {
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
	}
	/** Disable or enable one profile-patch plugin (persisted + runtime effect). */
	async setEnabled(request) {
		const moduleName = typeof request?.moduleName === "string" ? request.moduleName : "";
		const enabled = request?.enabled === true;
		if (moduleName === "") return rejected({ code: "bad-request", message: "moduleName required" });
		const entry = this.findEntry(moduleName);
		if (entry === undefined) return rejected({ code: "not-found", message: `no loader entry named ${moduleName}` });
		if (entry.disabled === !enabled) return success({ changed: false });
		const next = setPatchDisabled(readFileSync(this.patchPath(), "utf8"), entry.id, !enabled);
		if (next === null) return rejected({ code: "not-manageable", message: `${moduleName} is not a profile-patch entry` });
		try {
			await entry.update({ disabled: !enabled }, false, true);
			writeFileSync(this.patchPath(), next, "utf8");
			return success({ changed: true });
		} catch (error) {
			return rejected({ code: "update-failed", message: error instanceof Error ? error.message : String(error) });
		}
	}
	/** Uninstall one profile-patch plugin: stop it, drop its patch row and dependency. */
	async uninstall(request) {
		const moduleName = typeof request?.moduleName === "string" ? request.moduleName : "";
		if (moduleName === "") return rejected({ code: "bad-request", message: "moduleName required" });
		const entry = this.findEntry(moduleName);
		if (entry === undefined) return rejected({ code: "not-found", message: `no loader entry named ${moduleName}` });
		const patch = this.patchPath();
		const next = removePatchEntry(readFileSync(patch, "utf8"), entry.id);
		if (next === null) return rejected({ code: "not-manageable", message: `${moduleName} is not a profile-patch entry` });
		try {
			if (!entry.disabled) await entry.update({ disabled: true }, false, true);
		} catch (_ignored) {
			/* best effort: the row is gone from the patch, restart will not load it */
		}
		try {
			writeFileSync(patch, next, "utf8");
			const pkgPath = join(this.ctx.baseUrl ?? "", "package.json");
			const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
			if (pkg.dependencies !== undefined && moduleName in pkg.dependencies) {
				delete pkg.dependencies[moduleName];
				writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
			}
		} catch (error) {
			return rejected({ code: "uninstall-failed", message: error instanceof Error ? error.message : String(error) });
		}
		return success({ removed: true });
	}
	/**
	 * Load the plugin-market registry: the local dshmarket snapshot first
	 * (offline, always available), falling back to the network aggregation
	 * site. Each item carries a `category` tag (ui/theme/models/sessions/
	 * memory/tools/skills/workflow/notifications/development/market/fun).
	 */
	async loadRegistry() {
		try {
			const local = join(this.ctx.baseUrl ?? "", "node_modules/dshmarket/data/registry-snapshot.json");
			return JSON.parse(readFileSync(local, "utf8"));
		} catch (_localMissing) {
			try {
				const res = await fetch("https://awesome-dsh-plugin.com/plugins.json", { signal: AbortSignal.timeout(8000) });
				if (!res.ok) return [];
				const data = await res.json();
				return Array.isArray(data) ? data : (Array.isArray(data?.plugins) ? data.plugins : []);
			} catch (_networkDown) {
				return [];
			}
		}
	}
	/** Look up market categories for plugin names (name → category | null). */
	async lookupCategories(request) {
		const names = Array.isArray(request?.names) ? request.names.filter((n) => typeof n === "string") : [];
		if (names.length === 0) return success({ categories: {} });
		const registry = await this.loadRegistry();
		return success({ categories: matchCategories(registry, names) });
	}
	/** List models available on the user-configured OpenAI-compatible API. */
	async listModels(request) {
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
	}
	/** Classify plugin names into group names with the user-configured AI model. */
	async classifyAI(request) {
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
			const text = data?.choices?.[0]?.message?.content ?? "";
			const groups = parseAIGroups(text, names);
			if (groups === null) return rejected({ code: "ai-parse", message: "AI response is not JSON" });
			return success({ groups });
		} catch (error) {
			return rejected({ code: "ai-failed", message: error instanceof Error ? error.message : String(error) });
		}
	}
}

/** Provides no host-side behavior beyond the manage service. */
function apply(ctx) {
	new SettingsNavManageService(ctx);
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

export { apply, matchCategories, parseAIGroups, patchBlockRange, setPatchDisabled, removePatchEntry };
