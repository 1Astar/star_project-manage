import assert from "node:assert/strict";
import {
  packSecretsWithPassphrase,
  secretsToEnvText,
  unpackSecretsWithPassphrase,
} from "./pack";

const items = [
  { name: "FOO", value: "bar" },
  { name: "QUOTED", value: 'a b "c"' },
];

const pack = packSecretsWithPassphrase(items, "secret-pass", {
  projectId: "proj-x",
  projectTitle: "Demo",
});
assert.match(pack, /^STARPM_SECRETS_V1\./);
assert.doesNotMatch(pack, /FOO|bar|Demo/);

const opened = unpackSecretsWithPassphrase(pack, "secret-pass");
assert.equal(opened.projectId, "proj-x");
assert.equal(opened.secrets.length, 2);
assert.equal(opened.secrets[0]?.value, "bar");

assert.throws(() => unpackSecretsWithPassphrase(pack, "wrong-pass"), /口令/);

const env = secretsToEnvText(items);
assert.match(env, /^FOO=bar$/m);
assert.match(env, /QUOTED="/);

console.log("secrets pack ok");
