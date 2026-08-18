import assert from "node:assert/strict";
import {
  bumpDurableReadGeneration,
  memoizeDurableRead,
  runWithDurableReadMemo,
} from "@/lib/runtime/durable-read-memo";

async function main() {
  let n = 0;
  const load = async () => {
    n += 1;
    await Promise.resolve();
    return n;
  };

  n = 0;
  const [a, b] = await Promise.all([
    memoizeDurableRead("t", load),
    memoizeDurableRead("t", load),
  ]);
  assert.equal(a, b);
  assert.equal(n, 1);

  n = 0;
  await runWithDurableReadMemo(async () => {
    const first = await memoizeDurableRead("seq", load);
    const second = await memoizeDurableRead("seq", load);
    assert.equal(first, second);
    assert.equal(n, 1);
    bumpDurableReadGeneration();
    const third = await memoizeDurableRead("seq", load);
    assert.equal(third, 2);
    assert.equal(n, 2);
  });

  console.log("durable-read-memo ok");
}

main();
