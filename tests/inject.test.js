import test from "node:test";
import assert from "node:assert/strict";

import * as plugin from "../lib/index.js";

const { inject } = plugin;

test("declares every Cordis service used by the host plugin", () => {
	assert.deepEqual(inject, ["loader", "webServer"]);
});

test("extracts text from promisified execFile results", () => {
	assert.equal(typeof plugin.execStdoutText, "function");
	assert.equal(plugin.execStdoutText({ stdout: "line one\n", stderr: "" }), "line one\n");
});
