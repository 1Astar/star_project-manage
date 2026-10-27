import assert from "node:assert/strict";
import { parseNotionPageIdFromInput } from "./page-id";

const id = "a1b2c3d4e5f6478990ab1c2d3e4f5678";
const uuid = "a1b2c3d4-e5f6-4789-90ab-1c2d3e4f5678";

assert.equal(parseNotionPageIdFromInput(uuid), uuid);
assert.equal(parseNotionPageIdFromInput(id), uuid);
assert.equal(
  parseNotionPageIdFromInput(`https://www.notion.so/My-Page-${id}`),
  uuid
);
assert.equal(
  parseNotionPageIdFromInput(`https://www.notion.so/${id}?v=abc`),
  uuid
);
assert.equal(parseNotionPageIdFromInput(""), null);
assert.equal(parseNotionPageIdFromInput("not-a-page"), null);

console.log("page-id.test.ts ok");
