import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";

/**
 * Dedup expensive Supabase snapshot reads.
 * - Inside `runWithDurableReadMemo` (Cloudflare Worker fetch): keep result for the whole request.
 * - Concurrent callers always coalesce (in-flight).
 * - Next.js RSC: React `cache` is per-request; `generation` lets writes bust it.
 * Writes MUST call `bumpDurableReadGeneration()`.
 */

type RequestStore = {
  values: Map<string, Promise<unknown>>;
};

const als = new AsyncLocalStorage<RequestStore>();
let generation = 0;
const inflight = new Map<string, Promise<unknown>>();
const loaders = new Map<string, () => Promise<unknown>>();

export function runWithDurableReadMemo<T>(fn: () => Promise<T>): Promise<T> {
  if (als.getStore()) return fn();
  return als.run({ values: new Map() }, fn);
}

export function bumpDurableReadGeneration(): void {
  generation += 1;
  inflight.clear();
  als.getStore()?.values.clear();
}

const reactMemo = cache(async (slot: string, gen: number): Promise<unknown> => {
  void gen;
  const loader = loaders.get(slot);
  if (!loader) {
    throw new Error(`durable-read-memo: missing loader ${slot}`);
  }
  return loader();
});

export function memoizeDurableRead<T>(slot: string, loader: () => Promise<T>): Promise<T> {
  loaders.set(slot, loader as () => Promise<unknown>);
  const store = als.getStore();
  if (store) {
    const hit = store.values.get(slot);
    if (hit) return hit as Promise<T>;
    const p = loader();
    store.values.set(slot, p);
    return p;
  }

  const key = `${slot}#${generation}`;
  const flying = inflight.get(key);
  if (flying) return flying as Promise<T>;

  const p = Promise.resolve()
    .then(() => reactMemo(slot, generation) as Promise<T>)
    .catch(() => loader())
    .finally(() => {
      // React cache covers sequential reads in RSC. Drop in-flight so warm
      // Worker isolates do not pin a snapshot across HTTP requests.
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}
