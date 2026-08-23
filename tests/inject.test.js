import test from "node:test";
import assert from "node:assert/strict";

import { inject } from "../lib/index.js";

test("declares every Cordis service used by the host plugin", () => {
	assert.deepEqual(inject, ["loader", "webServer"]);
});
