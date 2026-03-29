const fs = require('fs');

const content = fs.readFileSync('tests/browser-modules.test.js', 'utf8');

const target = `function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

test("storage sync defaults expose popup and profile display settings", () => {`;

const replacement = `function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

test("isObject identifies objects and rejects other types", () => {
  const root = loadModule("js/storage.js");
  const isObject = root.ExtensityStorage.isObject;

  assert.equal(isObject({}), true);
  assert.equal(isObject({ a: 1 }), true);
  assert.equal(isObject(Object.create(null)), true);
  assert.equal(isObject(new Object()), true);

  assert.equal(isObject(null), false);
  assert.equal(isObject(undefined), false);
  assert.equal(isObject([]), false);
  assert.equal(isObject([1, 2, 3]), false);
  assert.equal(isObject(""), false);
  assert.equal(isObject("string"), false);
  assert.equal(isObject(0), false);
  assert.equal(isObject(1), false);
  assert.equal(isObject(true), false);
  assert.equal(isObject(false), false);
  assert.equal(isObject(function() {}), false);
  assert.equal(isObject(() => {}), false);
  assert.equal(isObject(new Date()), false);
  assert.equal(isObject(/regex/), false);
});

test("storage sync defaults expose popup and profile display settings", () => {`;

const newContent = content.replace(target, replacement);

fs.writeFileSync('tests/browser-modules.test.js', newContent);
