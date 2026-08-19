import assert from "node:assert/strict";
import { emptyPmSnapshot } from "@/lib/db/empty-snapshot";

async function main() {
  const empty = emptyPmSnapshot();
  assert.equal(empty.projects.length, 0);
  assert.equal(empty.requirements.length, 0);
  assert.equal(empty.bugs.length, 0);

  const partial = emptyPmSnapshot({
    projects: [{ id: "p1" } as (typeof empty.projects)[number]],
    bugs: [{ id: "b1", status: "pending" } as (typeof empty.bugs)[number]],
  });
  assert.equal(partial.projects.length, 1);
  assert.equal(partial.bugs.length, 1);
  assert.equal(partial.modules.length, 0);

  console.log("empty-snapshot ok");
}

main();
