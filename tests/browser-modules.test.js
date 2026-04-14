const assert = require("node:assert/strict");
const fs = require("node:fs");
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

function createChromeBackgroundStub() {
  return {
    alarms: {
      clear() {},
      create() {},
      onAlarm: { addListener() {} }
    },
    commands: {
      onCommand: { addListener() {} }
    },
    contextMenus: {
      create() {},
      onClicked: { addListener() {} },
      removeAll() {}
    },
    management: {},
    notifications: {
      clear() {},
      create() {}
    },
    runtime: {
      getManifest() {
        return { version: "2.0.0" };
      },
      id: "runtime-extension",
      lastError: null,
      onInstalled: { addListener() {} },
      onMessage: { addListener() {} },
      onStartup: { addListener() {} }
    },
    tabs: {
      create() {},
      get() {},
      onActivated: { addListener() {} },
      onUpdated: { addListener() {} },
      query() {},
      sendMessage() {}
    },
    webNavigation: {
      onHistoryStateUpdated: { addListener() {} }
    }
  };
}

function loadBackgroundModule(extraSelf = {}) {
  return loadBrowserScript(path.join(repoRoot, "js/background.js"), {
    chrome: createChromeBackgroundStub(),
    fetch: async function() {
      throw new Error("Unexpected fetch in unit test.");
    },
    importScripts() {},
    self: {
      ExtensityDriveSync: {},
      ExtensityHistory: {},
      ExtensityImportExport: {},
      ExtensityMigrations: {
        migrateLegacyLocalStorage: async function() {
          return false;
        },
        migratePopupListStyle: async function() {
          return false;
        },
        migrateTo2_0_0: async function() {
          return false;
        }
      },
      ExtensityReminders: {},
      ExtensityStorage: {
        clone(value) {
          return JSON.parse(JSON.stringify(value));
        },
        uniqueArray(items) {
          return Array.from(new Set(items || []));
        },
        ...extraSelf.ExtensityStorage
      },
      ExtensityUrlRules: {},
      ...extraSelf
    }
  });
}

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

test("storage sync defaults expose popup and profile display settings", () => {
  const root = loadModule("js/storage.js");
  const defaults = root.ExtensityStorage.getSyncDefaults();
  const localDefaults = root.ExtensityStorage.getLocalDefaults();

  assert.equal(defaults.itemPaddingXPx, 12);
  assert.equal(defaults.itemNameGapPx, 10);
  assert.equal(defaults.popupListStyle, "card");
  assert.equal(defaults.profileDisplay, "landscape");
  assert.equal(defaults.profileNameDirection, "auto");
  assert.equal(defaults.popupProfileBadgeTextMode, "full");
  assert.equal(defaults.popupProfileBadgeSingleWordChars, 4);
  assert.equal(defaults.showPopupVersionChips, true);
  assert.equal(defaults.showProfilesExtensionMetadata, true);
  assert.deepEqual(normalize(localDefaults.webStoreMetadata), {});
});

test("popup profile badge labels support full and compact formatting", () => {
  const root = {};
  loadBrowserScript(path.join(repoRoot, "js/engine.js"), {
    ko: { extenders: {} },
    window: root
  });

  assert.equal(root.ExtensityPopupLabels.formatProfileBadgeLabel("__always_on", "compact", 4), "AO");
  assert.equal(root.ExtensityPopupLabels.formatProfileBadgeLabel("Bookmark Organization", "compact", 4), "BO");
  assert.equal(root.ExtensityPopupLabels.formatProfileBadgeLabel("Testing", "compact", 4), "Test");
  assert.equal(root.ExtensityPopupLabels.formatProfileBadgeLabel("Bookmark Organization", "full", 4), "Bookmark Organization");
});

test("popup list style migration maps legacy flatPopupList to popupListStyle", async () => {
  let removed = null;
  let savedPatch = null;

  const root = loadBrowserScript(path.join(repoRoot, "js/migration.js"), {
    self: {
      ExtensityStorage: {
        ensureSyncDefaults: async function() {},
        getArea: async function() {
          return {
            flatPopupList: true,
            migration_popupListStyle: null,
            popupListStyle: "card"
          };
        },
        removeArea: async function(area, keys) {
          removed = { area: area, keys: keys };
        },
        saveSyncOptions: async function(values) {
          savedPatch = values;
        }
      }
    }
  });

  const changed = await root.ExtensityMigrations.migratePopupListStyle();

  assert.equal(changed, true);
  assert.deepEqual(normalize(savedPatch), {
    migration_popupListStyle: "2.1.0",
    popupListStyle: "flat"
  });
  assert.deepEqual(normalize(removed), {
    area: "sync",
    keys: ["flatPopupList"]
  });
});

test("background parser extracts Web Store description, category, and canonical url", () => {
  const fixture = fs.readFileSync(path.join(repoRoot, "tests", "fixtures", "chrome-web-store-dark-reader.html"), "utf8");
  const root = loadBackgroundModule();
  const parsed = root.ExtensityBackground.parseChromeWebStoreHtml(
    fixture,
    "https://chromewebstore.google.com/detail/extension/eimadpbcbfnmbkopoojfekhnkhdbieeh"
  );

  assert.equal(parsed.descriptionLine, "Dark mode for every website. Take care of your eyes, use dark theme for night and daily browsing.");
  assert.equal(parsed.category, "Accessibility");
  assert.equal(parsed.storeUrl, "https://chromewebstore.google.com/detail/dark-reader/eimadpbcbfnmbkopoojfekhnkhdbieeh");
});

test("background normalization keeps managed extension version", () => {
  const root = loadBackgroundModule();
  const normalized = root.ExtensityBackground.normalizeExtensions([
    {
      description: "Sample description",
      enabled: true,
      homepageUrl: "",
      icons: [{ size: 16, url: "icon.png" }],
      id: "ext-1",
      installType: "normal",
      mayDisable: true,
      name: "Example Extension",
      optionsUrl: "",
      type: "extension",
      version: "4.9.121"
    }
  ], {
    localState: {
      aliases: {},
      groups: {},
      recentlyUsed: [],
      usageCounters: {}
    },
    profiles: {
      map: {
        __always_on: [],
        __favorites: []
      }
    }
  });

  assert.equal(normalized[0].version, "4.9.121");
});

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
