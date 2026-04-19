const test = require("node:test");
const assert = require("node:assert/strict");

const bumpVersionScript = require("../scripts/bump-version.js");

test("getBumpTypeFromArgv handles pnpm forwarded separator", () => {
  assert.equal(
    bumpVersionScript.getBumpTypeFromArgv(["--", "patch"]),
    "patch"
  );
});

test("getBumpTypeFromArgv returns direct bump argument", () => {
  assert.equal(
    bumpVersionScript.getBumpTypeFromArgv(["minor"]),
    "minor"
  );
});

test("bumpVersion increments semantic versions correctly", () => {
  assert.equal(bumpVersionScript.bumpVersion("2.0.2", "patch"), "2.0.3");
  assert.equal(bumpVersionScript.bumpVersion("2.0.2", "minor"), "2.1.0");
  assert.equal(bumpVersionScript.bumpVersion("2.0.2", "major"), "3.0.0");
});
