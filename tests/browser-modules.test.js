const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const { loadBrowserScript } = require("./helpers/load-browser-script");

const repoRoot = path.resolve(__dirname, "..");
const storageStub = {
  clone(value) {
    return JSON.parse(JSON.stringify(value));
  },
  makeId(prefix) {
    return `${prefix}-id`;
  },
  normalizeProfileMap(profileMap) {
    const source = profileMap || {};
    return Object.keys(source).reduce((result, key) => {
      result[key] = Array.from(new Set(source[key] || []));
      return result;
    }, {});
  },
  uniqueArray(items) {
    return Array.from(new Set(items || []));
  }
};

function loadModule(relativePath, extraGlobals = {}) {
  return loadBrowserScript(path.join(repoRoot, relativePath), {
    self: {
      ExtensityStorage: storageStub,
      ...extraGlobals
    }
  });
}

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

test("import/export builds a versioned backup envelope", () => {
  const root = loadModule("js/import-export.js");
  const envelope = root.ExtensityImportExport.buildBackupEnvelope({
    extensions: [
      { enabled: true, id: "enabled-ext", isApp: false, mayDisable: true },
      { enabled: false, id: "disabled-ext", isApp: false, mayDisable: true },
      { enabled: true, id: "app-item", isApp: true, mayDisable: true },
      { enabled: true, id: "fixed-item", isApp: false, mayDisable: false }
    ],
    localState: {
      aliases: { "enabled-ext": "Alias" },
      eventHistory: [{ id: "history-1" }],
      groupOrder: ["group-1"],
      groups: { "group-1": { id: "group-1", name: "Core" } },
      reminderQueue: [{ extensionId: "enabled-ext" }],
      recentlyUsed: ["enabled-ext"],
      undoStack: [{ action: "toggle" }],
      urlRules: [{ id: "rule-1" }],
      usageCounters: { "enabled-ext": 3 }
    },
    options: {
      activeProfile: "Work",
      viewMode: "grid"
    },
    profiles: {
      map: {
        Work: ["enabled-ext"],
        __always_on: ["enabled-ext"]
      }
    }
  });

  assert.equal(envelope.version, "2.0.0");
  assert.equal(envelope.settings.viewMode, "grid");
  assert.deepEqual(normalize(envelope.localState.extensionStates), {
    "disabled-ext": false,
    "enabled-ext": true
  });
});

test("import/export validates backups and rejects unsupported versions", () => {
  const root = loadModule("js/import-export.js");

  assert.throws(() => {
    root.ExtensityImportExport.validateBackupEnvelope({
      version: "1.0.0"
    });
  }, /Unsupported backup version/);

  const valid = root.ExtensityImportExport.validateBackupEnvelope({
    version: "2.0.0",
    settings: { sortMode: "alpha" },
    profiles: { Work: ["a", "a"] },
    aliases: { a: "Alias" },
    localState: {
      extensionStates: { a: true }
    }
  });

  assert.deepEqual(normalize(valid.profiles), { Work: ["a"] });
  assert.deepEqual(normalize(valid.aliases), { a: "Alias" });
});

test("import/export builds CSV rows with escaped content", () => {
  const root = loadModule("js/import-export.js");
  const csv = root.ExtensityImportExport.buildExtensionsCsv([
    {
      alias: 'Alias "One"',
      enabled: true,
      groupIds: ["alpha", "beta"],
      id: "ext-1",
      lastUsed: 7,
      name: "Example",
      type: "extension",
      usageCount: 4
    }
  ]);

  assert.match(csv, /^id,name,alias,enabled,type,usageCount,lastUsed,groups/m);
  assert.match(csv, /"Alias ""One"""/);
  assert.match(csv, /"alpha\|beta"/);
});

test("url rules support wildcard, regex, and later-rule precedence", () => {
  const root = loadModule("js/url-rules.js");

  assert.equal(root.ExtensityUrlRules.isSupportedUrl("https://github.com/openai"), true);
  assert.equal(root.ExtensityUrlRules.isSupportedUrl("chrome://extensions"), false);
  assert.equal(root.ExtensityUrlRules.matchUrl("https://github.com/openai", "*://github.com/*", "wildcard"), true);
  assert.equal(root.ExtensityUrlRules.matchUrl("https://github.com/openai", "^https://github\\.com/.+$", "regex"), true);
  assert.equal(root.ExtensityUrlRules.matchUrl("https://github.com/openai", "[", "regex"), false);

  const changes = root.ExtensityUrlRules.resolveChanges("https://github.com/openai", [
    {
      active: true,
      disableIds: [],
      enableIds: ["ext-1"],
      id: "rule-1",
      matchMethod: "wildcard",
      name: "Enable GitHub helper",
      urlPattern: "*://github.com/*"
    },
    {
      active: true,
      disableIds: ["ext-1"],
      enableIds: [],
      id: "rule-2",
      matchMethod: "regex",
      name: "Disable helper on all GitHub pages",
      urlPattern: "^https://github\\.com/.+$"
    }
  ]);

  assert.deepEqual(normalize(changes), {
    "ext-1": {
      enabled: false,
      ruleId: "rule-2"
    }
  });
});

test("history records preserve source metadata and cap record count", () => {
  const root = loadModule("js/history-logger.js");
  const records = root.ExtensityHistory.createRecords([
    {
      enabled: true,
      id: "ext-1",
      name: "Example",
      profileId: "Work",
      ruleId: "rule-1"
    }
  ], {
    profileId: "Work",
    ruleId: "rule-1",
    source: "rule"
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].triggeredBy, "rule");
  assert.equal(records[0].profileId, "Work");
  assert.equal(records[0].ruleId, "rule-1");

  const appended = root.ExtensityHistory.appendHistory(
    Array.from({ length: 499 }, (_, index) => ({ id: `existing-${index}` })),
    Array.from({ length: 5 }, (_, index) => ({ id: `new-${index}` }))
  );

  assert.equal(appended.length, 500);
  assert.equal(appended[0].id, "existing-4");
  assert.equal(appended[499].id, "new-4");
});
