const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

function readPopupFiles() {
  return {
    html: fs.readFileSync(path.join(repoRoot, "index.html"), "utf8"),
    indexScript: fs.readFileSync(path.join(repoRoot, "js/index.js"), "utf8")
  };
}

test("popup header is provided through a mount point and template", () => {
  const files = readPopupFiles();

  assert.match(files.html, /<div id="popup-header-mount"><\/div>/);
  assert.match(files.html, /<template id="popup-header-template">[\s\S]*<section id="header" class="main">/);
  assert.doesNotMatch(files.html, /<section id="header" class="main" data-sbind="visible: opts\.showHeader">/);

  assert.match(files.indexScript, /function mountPopupHeaderIfEnabled\(state, viewModel\)/);
  assert.match(files.indexScript, /syncTemplateMount\("popup-header-mount",/);
});

test("popup sort toolbar is provided through mount and fallback templates", () => {
  const files = readPopupFiles();

  assert.match(files.html, /<div id="popup-sort-toolbar-mount"><\/div>/);
  assert.match(files.html, /<template id="popup-sort-toolbar-template">[\s\S]*<section id="toolbar" class="main">/);
  assert.match(files.html, /<template id="popup-sort-toolbar-error-template">[\s\S]*<section id="toolbar-error" class="main">/);
  assert.doesNotMatch(files.html, /<section id="toolbar" class="main" data-sbind="visible: opts\.showPopupSort">/);

  assert.match(files.indexScript, /function mountPopupSortToolbar\(state, viewModel\)/);
  assert.match(files.indexScript, /syncTemplateMount\("popup-sort-toolbar-mount",/);
});

test("popup mount helpers exist and guard duplicate work", () => {
  const files = readPopupFiles();

  assert.match(files.indexScript, /function normalizePopupOptions\(state\)/);
  assert.match(files.indexScript, /function syncTemplateMount\(mountId, templateId, viewModel\)/);
  assert.match(files.indexScript, /currentTemplateId === nextTemplateId/);
  assert.match(files.indexScript, /mountNode\.setAttribute\("data-template-id",/);
});

test("popup files contain no unresolved merge markers", () => {
  const files = readPopupFiles();

  assert.doesNotMatch(files.html, /^<<<<<<<|^=======|^>>>>>>>/m);
  assert.doesNotMatch(files.indexScript, /^<<<<<<<|^=======|^>>>>>>>/m);
});
