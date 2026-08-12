import assert from "node:assert/strict";
import {
  findPmProjectForStudio,
  getPmSlugForStudioProject,
  getStudioIdFromPmSlug,
} from "@/lib/project-bridge";

assert.equal(getPmSlugForStudioProject({ id: "proj-moonpie" }), "studio-proj-moonpie");
assert.equal(getStudioIdFromPmSlug("studio-proj-moonpie"), "proj-moonpie");
assert.equal(getStudioIdFromPmSlug("moonpie"), "proj-moonpie");
assert.equal(getStudioIdFromPmSlug("star-pm"), "proj-star-pm");

{
  const pm = [
    { id: "pm-1", slug: "studio-proj-moonpie" },
    { id: "pm-2", slug: "star-pm" },
  ];
  assert.equal(findPmProjectForStudio("proj-moonpie", pm)?.id, "pm-1");
}

{
  const legacy = [{ id: "pm-legacy", slug: "moonpie" }];
  assert.equal(findPmProjectForStudio("proj-moonpie", legacy)?.id, "pm-legacy");
}

console.log("lib/project-bridge.test.ts ok");
