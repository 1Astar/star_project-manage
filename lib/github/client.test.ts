import assert from "node:assert/strict";
import { normalizeGithubRepoFullName, parseRepoFullName } from "./client";

assert.equal(
  normalizeGithubRepoFullName("https://github.com/1Astar/chris-phone"),
  "1Astar/chris-phone"
);
assert.equal(
  normalizeGithubRepoFullName("https://github.com/1Astar/chris-phone.git"),
  "1Astar/chris-phone"
);
assert.equal(
  normalizeGithubRepoFullName("git@github.com:1Astar/chris-phone.git"),
  "1Astar/chris-phone"
);
assert.equal(normalizeGithubRepoFullName("1Astar/chris-phone"), "1Astar/chris-phone");
assert.equal(
  normalizeGithubRepoFullName("https://github.com/1Astar/chris-phone/tree/main"),
  "1Astar/chris-phone"
);

assert.deepEqual(parseRepoFullName("https://github.com/1Astar/chris-phone"), {
  owner: "1Astar",
  repo: "chris-phone",
});

console.log("github/client normalize ok");
