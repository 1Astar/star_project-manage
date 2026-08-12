import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  addMcpToolToDisk,
  assertValidToolName,
  disableMcpToolOnDisk,
  DYNAMIC_MCP_DEFER_SCOPE,
  jsonSchemaLiteToZod,
  listDynamicMcpToolsFromDisk,
  readDynamicRegistry,
} from "@/lib/mcp/dynamic-tools";

assert.equal(assertValidToolName("foo_bar"), "foo_bar");
assert.throws(() => assertValidToolName("capture_idea"), /内置/);
assert.throws(() => assertValidToolName("Foo"), /snake_case/);

{
  const shape = jsonSchemaLiteToZod({
    type: "object",
    properties: {
      q: { type: "string", description: "query" },
      n: { type: "number" },
    },
    required: ["q"],
  });
  assert.ok(shape.q);
  assert.ok(shape.n);
}

const tmpName = `test_dyn_${Date.now().toString(36)}`;
const added = addMcpToolToDisk({
  name: tmpName,
  title: "测试动态工具",
  description: "单测用",
  handlerSketch: "返回 ok",
  inputSchema: {
    type: "object",
    properties: { x: { type: "string" } },
    required: ["x"],
  },
  module: "MCP·动态工具",
});

assert.ok(fs.existsSync(added.paths.handler));
assert.ok(fs.existsSync(added.paths.toolJson));
assert.ok(listDynamicMcpToolsFromDisk().some((t) => t.name === tmpName));

const disabled = disableMcpToolOnDisk(tmpName, false);
assert.equal(disabled.enabled, false);

assert.equal(DYNAMIC_MCP_DEFER_SCOPE.deferred.length, 3);
for (const d of DYNAMIC_MCP_DEFER_SCOPE.deferred) {
  assert.match(d.card, /【是什么】/);
  assert.match(d.card, /【为什么本期不做】/);
  assert.match(d.card, /【后期怎么做】/);
  assert.match(d.card, /【同批兄弟】/);
}

// cleanup
const dir = path.dirname(added.paths.handler);
fs.rmSync(dir, { recursive: true, force: true });
const reg = readDynamicRegistry();
reg.tools = reg.tools.filter((t) => t.name !== tmpName);
fs.writeFileSync(
  path.join(process.cwd(), "lib", "mcp", "dynamic-tools", "registry.json"),
  JSON.stringify(reg, null, 2),
  "utf8"
);

console.log("lib/mcp/dynamic-tools.test.ts ok");
