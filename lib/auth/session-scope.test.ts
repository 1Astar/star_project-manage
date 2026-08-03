import assert from "node:assert/strict";
import { allowOpenAdminWithoutLogin } from "@/lib/auth/session";

const prev = { ...process.env };

function resetEnv() {
  for (const k of Object.keys(process.env)) {
    if (!(k in prev)) delete process.env[k];
  }
  Object.assign(process.env, prev);
}

{
  resetEnv();
  delete process.env.VERCEL;
  delete process.env.NEXT_PUBLIC_EDGEONE;
  delete process.env.EDGEONE;
  delete process.env.CF_PAGES;
  delete process.env.NEXT_PUBLIC_CF_WORKER;
  process.env.REQUIRE_AUTH = "false";
  assert.equal(allowOpenAdminWithoutLogin(), true);
}

{
  resetEnv();
  process.env.VERCEL = "1";
  process.env.REQUIRE_AUTH = "false";
  assert.equal(allowOpenAdminWithoutLogin(), false);
}

{
  resetEnv();
  process.env.NEXT_PUBLIC_EDGEONE = "1";
  process.env.REQUIRE_AUTH = "false";
  assert.equal(allowOpenAdminWithoutLogin(), false);
}

resetEnv();
console.log("lib/auth/session-scope.test.ts ok");
