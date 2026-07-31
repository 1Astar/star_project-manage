import assert from "node:assert/strict";
import {
  prototypeObjectPath,
  resolvePrototypeUrl,
} from "./storage";

assert.match(prototypeObjectPath("star-pm", "upload.zip"), /^prototypes\/star-pm-\d+\/upload\.zip$/);
assert.match(prototypeObjectPath("x", "bad name!.zip"), /^prototypes\/x-\d+\/badname.zip$/);

assert.equal(
  resolvePrototypeUrl("https://example.supabase.co/storage/v1/object/public/studio-assets/prototypes/a.zip"),
  "https://example.supabase.co/storage/v1/object/public/studio-assets/prototypes/a.zip"
);
assert.equal(resolvePrototypeUrl("/prototypes/foo/upload.zip"), "/prototypes/foo/upload.zip");
assert.equal(resolvePrototypeUrl(null), "");
assert.equal(resolvePrototypeUrl(""), "");

const prev = process.env.NEXT_PUBLIC_SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proj.supabase.co";
assert.equal(
  resolvePrototypeUrl("prototypes/demo-1/upload.zip"),
  "https://proj.supabase.co/storage/v1/object/public/studio-assets/prototypes/demo-1/upload.zip"
);
if (prev === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
else process.env.NEXT_PUBLIC_SUPABASE_URL = prev;

console.log("lib/prototypes/storage.test.ts ok");
