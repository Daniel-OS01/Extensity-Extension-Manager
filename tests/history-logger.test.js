const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { loadBrowserScript } = require("./helpers/load-browser-script");

const repoRoot = path.resolve(__dirname, "..");

const storageStub = {
  makeId(prefix) {
    return `${prefix}-id-123`;
  }
};

function loadModule() {
  return loadBrowserScript(path.join(repoRoot, "js/history-logger.js"), {
    self: {
      ExtensityStorage: storageStub
    }
  });
}

test("history-logger safeJson correctly serializes standard JSON objects", () => {
  const root = loadModule();
  const testObj = { a: 1, b: "two", c: true, d: null, e: [1, 2, 3] };
  const record = root.ExtensityHistory.createEventRecord({
    debug: testObj
  });
  assert.equal(record.debug, JSON.stringify(testObj));
});

test("history-logger safeJson gracefully handles circular references", () => {
  const root = loadModule();
  const circular = {};
  circular.self = circular;

  const record = root.ExtensityHistory.createEventRecord({
    debug: circular
  });
  assert.equal(record.debug, "");
});

test("history-logger safeJson gracefully handles BigInt", () => {
  const root = loadModule();
  const objWithBigInt = { val: 10n };

  const record = root.ExtensityHistory.createEventRecord({
    debug: objWithBigInt
  });
  // JSON.stringify throws TypeError on BigInt
  assert.equal(record.debug, "");
});

test("history-logger safeJson returns string representation for strings and numbers", () => {
  const root = loadModule();

  const recordStr = root.ExtensityHistory.createEventRecord({
    debug: "just a string"
  });
  assert.equal(recordStr.debug, '"just a string"');

  const recordNum = root.ExtensityHistory.createEventRecord({
    debug: 42
  });
  assert.equal(recordNum.debug, '42');
});
