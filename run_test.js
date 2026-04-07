const { loadBrowserScript } = require("./tests/helpers/load-browser-script");
const path = require("path");

const repoRoot = path.resolve(__dirname, ".");
const root = loadBrowserScript(path.join(repoRoot, "js/url-rules.js"), {
  self: {
    ExtensityStorage: {
      makeId(prefix) { return prefix + "-id"; },
      uniqueArray(items) {
        if (!Array.isArray(items)) {
          return [];
        }
        var seen = new Set();
        var result = [];
        var protoCheck = {};
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (item && typeof protoCheck[item] === "undefined" && !seen.has(item)) {
            seen.add(item);
            result.push(item);
          }
        }
        return result;
      }
    }
  }
});

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

console.log(changes);
