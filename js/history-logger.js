(function(root) {
  var storage = root.ExtensityStorage;
  var maxRecords = 500;

  function createRecords(changes, context) {
    var source = context && context.source ? context.source : "manual";
    return changes.map(function(change) {
      return {
        event: change.enabled ? "enabled" : "disabled",
        extensionId: change.id,
        extensionName: change.name,
        id: storage.makeId("history"),
        profileId: change.profileId || (context && context.profileId) || null,
        ruleId: change.ruleId || (context && context.ruleId) || null,
        timestamp: Date.now(),
        triggeredBy: source
      };
    });
  }

  function appendHistory(existing, records) {
    var list = Array.isArray(existing) ? existing.slice() : [];
    return list.concat(records).slice(-maxRecords);
  }

  root.ExtensityHistory = {
    appendHistory: appendHistory,
    createRecords: createRecords
  };
})(typeof window !== "undefined" ? window : self);
