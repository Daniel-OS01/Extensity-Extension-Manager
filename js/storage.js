(function(root) {
  var syncDefaults = {
    activeProfile: null,
    appsFirst: false,
    contrastMode: "normal",
    driveSync: false,
    enabledFirst: false,
    enableReminders: false,
    groupApps: true,
    keepAlwaysOn: false,
    lastDriveSync: null,
    localProfiles: false,
    migration: "1.4.0",
    migration_2_0_0: null,
    profileDisplay: "landscape",
    reminderDelayMinutes: 60,
    searchBox: true,
    showAlwaysOnBadge: true,
    showHeader: true,
    showOptions: true,
    showReserved: false,
    sortMode: "alpha",
    viewMode: "list"
  };

  var localDefaults = {
    aliases: {},
    bulkToggleRestore: [],
    eventHistory: [],
    groupOrder: [],
    groups: {},
    lastSyncError: null,
    reminderQueue: [],
    recentlyUsed: [],
    undoStack: [],
    urlRules: [],
    usageCounters: {}
  };

  var profileNames = ["__always_on", "__favorites"];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isObject(value) {
    return !!value && Object.prototype.toString.call(value) === "[object Object]";
  }

  function mergeDefaults(defaults, value) {
    var merged = clone(defaults);
    var data = isObject(value) ? value : {};
    Object.keys(data).forEach(function(key) {
      if (isObject(data[key]) && isObject(merged[key])) {
        merged[key] = mergeDefaults(merged[key], data[key]);
        return;
      }
      merged[key] = data[key];
    });
    return merged;
  }

  function callArea(area, method, payload) {
    return new Promise(function(resolve, reject) {
      chrome.storage[area][method](payload, function(result) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
    });
  }

  function getArea(area, keys) {
    return callArea(area, "get", keys);
  }

  function setArea(area, values) {
    return callArea(area, "set", values);
  }

  function removeArea(area, keys) {
    return callArea(area, "remove", keys);
  }

  function uniqueArray(items) {
    var seen = {};
    return (Array.isArray(items) ? items : []).filter(function(item) {
      if (!item || seen[item]) {
        return false;
      }
      seen[item] = true;
      return true;
    });
  }

  function sortProfileName(name) {
    return (name.indexOf("__") === 0 ? " " : "") + name.toUpperCase();
  }

  function normalizeProfileMap(profileMap) {
    var result = {};
    var source = isObject(profileMap) ? profileMap : {};
    Object.keys(source).forEach(function(name) {
      if (!name) {
        return;
      }
      result[name] = uniqueArray(source[name]);
    });
    profileNames.forEach(function(name) {
      if (!result[name]) {
        result[name] = [];
      }
    });
    return result;
  }

  function profileMapToItems(profileMap) {
    var normalized = normalizeProfileMap(profileMap);
    return Object.keys(normalized).sort(function(left, right) {
      return sortProfileName(left).localeCompare(sortProfileName(right));
    }).map(function(name) {
      return { name: name, items: normalized[name] };
    });
  }

  async function loadSyncOptions() {
    var result = await getArea("sync", Object.keys(syncDefaults));
    return mergeDefaults(syncDefaults, result);
  }

  async function saveSyncOptions(values) {
    var allowed = {};
    Object.keys(syncDefaults).forEach(function(key) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        allowed[key] = values[key];
      }
    });
    await setArea("sync", allowed);
    return loadSyncOptions();
  }

  async function loadLocalState() {
    var result = await getArea("local", Object.keys(localDefaults));
    return mergeDefaults(localDefaults, result);
  }

  async function saveLocalState(values) {
    await setArea("local", values);
    return loadLocalState();
  }

  async function ensureAreaDefaults(area, defaults) {
    var keys = Object.keys(defaults);
    var current = await getArea(area, keys);
    var missing = {};
    keys.forEach(function(key) {
      if (typeof current[key] === "undefined") {
        missing[key] = clone(defaults[key]);
      }
    });
    if (Object.keys(missing).length > 0) {
      await setArea(area, missing);
    }
  }

  async function ensureSyncDefaults() {
    await ensureAreaDefaults("sync", syncDefaults);
  }

  async function ensureLocalDefaults() {
    await ensureAreaDefaults("local", localDefaults);
  }

  async function loadProfiles() {
    var syncState = await getArea("sync", { localProfiles: false });
    var area = syncState.localProfiles ? "local" : "sync";
    var payload = await getArea(area, { profiles: {} });
    var map = normalizeProfileMap(payload.profiles);
    return {
      items: profileMapToItems(map),
      localProfiles: !!syncState.localProfiles,
      map: map
    };
  }

  async function saveProfiles(profileMap) {
    var normalized = normalizeProfileMap(profileMap);
    try {
      await setArea("sync", { localProfiles: false, profiles: normalized });
      return {
        items: profileMapToItems(normalized),
        localProfiles: false,
        map: normalized
      };
    } catch (error) {
      await setArea("local", { profiles: normalized });
      await setArea("sync", { localProfiles: true });
      return {
        items: profileMapToItems(normalized),
        localProfiles: true,
        map: normalized
      };
    }
  }

  function makeId(prefix) {
    return [prefix, Date.now().toString(36), Math.random().toString(36).slice(2, 8)].join("-");
  }

  root.ExtensityStorage = {
    clone: clone,
    ensureLocalDefaults: ensureLocalDefaults,
    ensureSyncDefaults: ensureSyncDefaults,
    getArea: getArea,
    getLocalDefaults: function() { return clone(localDefaults); },
    getSyncDefaults: function() { return clone(syncDefaults); },
    loadLocalState: loadLocalState,
    loadProfiles: loadProfiles,
    loadSyncOptions: loadSyncOptions,
    makeId: makeId,
    mergeDefaults: mergeDefaults,
    normalizeProfileMap: normalizeProfileMap,
    profileMapToItems: profileMapToItems,
    removeArea: removeArea,
    saveLocalState: saveLocalState,
    saveProfiles: saveProfiles,
    saveSyncOptions: saveSyncOptions,
    setArea: setArea,
    uniqueArray: uniqueArray
  };
})(typeof window !== "undefined" ? window : self);
