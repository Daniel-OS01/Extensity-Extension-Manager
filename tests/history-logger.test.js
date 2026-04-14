const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { loadBrowserScript } = require("./helpers/load-browser-script.js");

test("ExtensityHistory.createRecords", async (t) => {
  const mockStorage = {
    makeId: (prefix) => prefix + "-mock"
  };

  const env = loadBrowserScript(path.join(__dirname, "../js/history-logger.js"), {
    ExtensityStorage: mockStorage,
    self: { ExtensityStorage: mockStorage }
  });

  const { createRecords } = env.ExtensityHistory;
  const originalDateNow = Date.now;

  t.afterEach(() => {
    Date.now = originalDateNow;
  });

  await t.test("uses default values when no context is provided", () => {
    Date.now = () => 1000;

    const changes = [{
      id: "ext-1",
      name: "Extension 1",
      enabled: true,
      previousEnabled: false,
    }];

    const records = createRecords(changes);
    const normalized = JSON.parse(JSON.stringify(records));

    assert.strictEqual(normalized.length, 1);

    const r = normalized[0];
    assert.strictEqual(r.action, "manual");
    assert.strictEqual(r.debug, "");
    assert.strictEqual(r.event, "enabled");
    assert.strictEqual(r.extensionId, "ext-1");
    assert.strictEqual(r.extensionName, "Extension 1");
    assert.strictEqual(r.nextEnabled, true);
    assert.strictEqual(r.previousEnabled, false);
    assert.strictEqual(r.profileId, null);
    assert.strictEqual(r.result, "state_changed_on");
    assert.strictEqual(r.ruleId, null);
    assert.strictEqual(r.ruleName, null);
    assert.strictEqual(r.tabId, null);
    assert.strictEqual(r.timestamp, 1000);
    assert.strictEqual(r.triggeredBy, "manual");
    assert.strictEqual(r.url, "");
    assert.strictEqual(r.id, "history-mock");
  });

  await t.test("uses context overrides", () => {
    Date.now = () => 2000;

    const changes = [{
      id: "ext-2",
      name: "Extension 2",
      enabled: false,
      previousEnabled: true,
    }];

    const context = {
      source: "rule",
      action: "apply_rule",
      ruleId: "rule-1",
      ruleName: "Rule 1",
      tabId: 42,
      url: "https://example.com",
      profileId: "prof-1",
      debugVerbose: false
    };

    const records = createRecords(changes, context);
    const normalized = JSON.parse(JSON.stringify(records));

    assert.strictEqual(normalized.length, 1);

    const r = normalized[0];
    assert.strictEqual(r.action, "apply_rule");
    assert.strictEqual(r.event, "disabled");
    assert.strictEqual(r.result, "state_changed_off");
    assert.strictEqual(r.triggeredBy, "rule");
    assert.strictEqual(r.ruleId, "rule-1");
    assert.strictEqual(r.ruleName, "Rule 1");
    assert.strictEqual(r.tabId, 42);
    assert.strictEqual(r.url, "https://example.com");
    assert.strictEqual(r.profileId, "prof-1");
  });

  await t.test("change values override context values", () => {
    const changes = [{
      id: "ext-3",
      name: "Extension 3",
      enabled: true,
      previousEnabled: false,
      tabId: 99,
      url: "https://specific.com",
      ruleId: "rule-specific",
      ruleName: "Specific Rule",
      profileId: "prof-specific"
    }];

    const context = {
      tabId: 42,
      url: "https://general.com",
      ruleId: "rule-general",
      ruleName: "General Rule",
      profileId: "prof-general"
    };

    const records = createRecords(changes, context);
    const normalized = JSON.parse(JSON.stringify(records));

    const r = normalized[0];
    assert.strictEqual(r.tabId, 99);
    assert.strictEqual(r.url, "https://specific.com");
    assert.strictEqual(r.ruleId, "rule-specific");
    assert.strictEqual(r.ruleName, "Specific Rule");
    assert.strictEqual(r.profileId, "prof-specific");
  });

  await t.test("handles debugVerbose=true", () => {
    const changes = [{
      id: "ext-4",
      name: "Extension 4",
      enabled: true,
      previousEnabled: false,
      tabId: 99,
      url: "https://specific.com"
    }];

    const context = {
      source: "rule",
      action: "apply_rule",
      ruleId: "rule-1",
      ruleName: "Rule 1",
      tabId: 42,
      url: "https://example.com",
      debugVerbose: true
    };

    const records = createRecords(changes, context);
    const normalized = JSON.parse(JSON.stringify(records));

    const r = normalized[0];
    assert.notStrictEqual(r.debug, "");

    const debugObj = JSON.parse(r.debug);
    assert.deepStrictEqual(debugObj, {
      action: "apply_rule",
      contextRuleId: "rule-1",
      previousEnabled: false,
      ruleName: "Rule 1",
      source: "rule",
      tabId: 99,
      url: "https://specific.com"
    });
  });

  await t.test("handles multiple changes", () => {
    const changes = [
      { id: "ext-1", name: "Ext 1", enabled: true, previousEnabled: false },
      { id: "ext-2", name: "Ext 2", enabled: false, previousEnabled: true }
    ];

    const records = createRecords(changes);
    const normalized = JSON.parse(JSON.stringify(records));

    assert.strictEqual(normalized.length, 2);
    assert.strictEqual(normalized[0].extensionId, "ext-1");
    assert.strictEqual(normalized[0].event, "enabled");
    assert.strictEqual(normalized[1].extensionId, "ext-2");
    assert.strictEqual(normalized[1].event, "disabled");
  });
});
