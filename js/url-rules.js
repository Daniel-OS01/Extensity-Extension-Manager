(function(root) {
  var storage = root.ExtensityStorage;

  function wildcardToRegExp(pattern) {
    var escaped = String(pattern)
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp("^" + escaped + "$");
  }

  function uniqueIds(ids) {
    return storage.uniqueArray(ids || []);
  }

  function isSupportedUrl(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  function matchUrl(url, pattern, method) {
    if (!pattern) {
      return false;
    }

    if (method === "regex") {
      try {
        return new RegExp(pattern).test(url);
      } catch (error) {
        return false;
      }
    }

    return wildcardToRegExp(pattern).test(url);
  }

  function normalizeRule(rule) {
    return {
      active: rule.active !== false,
      disableIds: uniqueIds(rule.disableIds),
      enableIds: uniqueIds(rule.enableIds),
      id: rule.id || storage.makeId("rule"),
      matchMethod: rule.matchMethod === "regex" ? "regex" : "wildcard",
      name: (rule.name || "").trim() || "Untitled Rule",
      urlPattern: (rule.urlPattern || "").trim()
    };
  }

  function normalizeRules(rules) {
    return (Array.isArray(rules) ? rules : []).map(normalizeRule);
  }

  function resolveChanges(url, rules) {
    var desired = {};

    if (!isSupportedUrl(url)) {
      return desired;
    }

    normalizeRules(rules).forEach(function(rule) {
      if (!rule.active || !matchUrl(url, rule.urlPattern, rule.matchMethod)) {
        return;
      }

      rule.enableIds.forEach(function(extensionId) {
        desired[extensionId] = { enabled: true, ruleId: rule.id };
      });

      rule.disableIds.forEach(function(extensionId) {
        desired[extensionId] = { enabled: false, ruleId: rule.id };
      });
    });

    return desired;
  }

  root.ExtensityUrlRules = {
    isSupportedUrl: isSupportedUrl,
    matchUrl: matchUrl,
    normalizeRule: normalizeRule,
    normalizeRules: normalizeRules,
    resolveChanges: resolveChanges
  };
})(typeof window !== "undefined" ? window : self);
