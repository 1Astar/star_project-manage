import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractJsonRpcMethods,
  mcpMethodsNeedTools,
} from "@/lib/mcp/web-streamable-handler";

test("extractJsonRpcMethods: single + batch", () => {
  assert.deepEqual(extractJsonRpcMethods({ method: "initialize" }), [
    "initialize",
  ]);
  assert.deepEqual(
    extractJsonRpcMethods([{ method: "initialize" }, { method: "tools/list" }]),
    ["initialize", "tools/list"]
  );
});

test("mcpMethodsNeedTools: initialize/ping skip; tools need", () => {
  assert.equal(mcpMethodsNeedTools(["initialize"]), false);
  assert.equal(mcpMethodsNeedTools(["notifications/initialized"]), false);
  assert.equal(mcpMethodsNeedTools(["ping"]), false);
  assert.equal(mcpMethodsNeedTools(["tools/list"]), true);
  assert.equal(mcpMethodsNeedTools(["tools/call"]), true);
  assert.equal(mcpMethodsNeedTools(["initialize", "tools/list"]), true);
});
