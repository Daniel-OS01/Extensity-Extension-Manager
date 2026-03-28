importScripts(
  "storage.js",
  "migration.js",
  "import-export.js",
  "url-rules.js",
  "history-logger.js",
  "reminders.js",
  "drive-sync.js"
);

(function(root) {
  var storage = root.ExtensityStorage;
  var migrations = root.ExtensityMigrations;
  var importExport = root.ExtensityImportExport;
  var urlRules = root.ExtensityUrlRules;
  var history = root.ExtensityHistory;
  var reminders = root.ExtensityReminders;
  var driveSync = root.ExtensityDriveSync;
  var urlEvaluationTimers = {};
  var metadataCacheTtlMs = 7 * 24 * 60 * 60 * 1000;

  function chromeCall(target, method, args) {
    return new Promise(function(resolve, reject) {
      var finalArgs = (args || []).slice();
      finalArgs.push(function(result) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result);
      });
      target[method].apply(target, finalArgs);
    });
  }

  function isAppType(type) {
    return ["hosted_app", "legacy_packaged_app", "packaged_app"].indexOf(type) !== -1;
  }

  function smallestIcon(icons) {
    var list = Array.isArray(icons) ? icons : [];
    if (!list.length) {
      return "";
    }

    return list.slice().sort(function(left, right) {
      return left.size - right.size;
    })[0].url || "";
  }

  function filterManagedItems(items) {
    return items.filter(function(item) {
      return item.id !== chrome.runtime.id && item.type !== "theme";
    });
  }

  function buildSnapshot(items) {
    return items.reduce(function(result, item) {
      if (item.type === "extension" && item.mayDisable) {
        result[item.id] = !!item.enabled;
      }
      return result;
    }, {});
  }

  function pushUndoEntry(undoStack, action, snapshot) {
    var stack = Array.isArray(undoStack) ? undoStack.slice() : [];
    stack.push({
      action: action,
      snapshot: snapshot,
      timestamp: Date.now()
    });
    return stack.slice(-20);
  }

  function applyUsageMetrics(localState, changes, context) {
    var usageCounters = storage.clone(localState.usageCounters || {});
    var recentlyUsed = Array.isArray(localState.recentlyUsed) ? localState.recentlyUsed.slice() : [];
    var shouldCount = ["bulk", "manual", "profile", "rule"].indexOf(context.source) !== -1;

    if (!shouldCount) {
      return {
        recentlyUsed: recentlyUsed,
        usageCounters: usageCounters
      };
    }

    changes.forEach(function(change) {
      usageCounters[change.id] = (usageCounters[change.id] || 0) + 1;
      recentlyUsed = [change.id].concat(recentlyUsed.filter(function(id) {
        return id !== change.id;
      }));
    });

    return {
      recentlyUsed: recentlyUsed.slice(0, 50),
      usageCounters: usageCounters
    };
  }

  function buildGroupLookup(groups) {
    return Object.keys(groups || {}).reduce(function(result, groupId) {
      var group = groups[groupId];
      var extensionIds = storage.uniqueArray(group && group.extensionIds ? group.extensionIds : []);
      extensionIds.forEach(function(extensionId) {
        if (!result[extensionId]) {
          result[extensionId] = [];
        }
        result[extensionId].push(groupId);
      });
      return result;
    }, {});
  }

  function normalizeGroup(group) {
    return {
      color: group.color || "#516C97",
      extensionIds: storage.uniqueArray(group.extensionIds || []),
      fixed: !!group.fixed,
      id: group.id || storage.makeId("group"),
      name: (group.name || "").trim() || "Untitled Group"
    };
  }

  function normalizeGroups(groups) {
    var normalized = {};
    var order = [];

    Object.keys(groups || {}).forEach(function(groupId) {
      var group = normalizeGroup(groups[groupId]);
      normalized[group.id] = group;
      order.push(group.id);
    });

    return {
      groupOrder: order,
      groups: normalized
    };
  }

  function firstDescriptionLine(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map(function(line) {
        return line.trim();
      })
      .filter(Boolean)[0] || "";
  }

  function defaultCategoryForInstallType(installType) {
    return installType === "development" ? "Developer" : "Uncategorized";
  }

  function decodeHtmlEntities(value) {
    return String(value || "")
      .replace(/&quot;/g, "\"")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#(\d+);/g, function(match, code) {
        var parsed = parseInt(code, 10);
        return isFinite(parsed) ? String.fromCharCode(parsed) : match;
      });
  }

  function buildGenericStoreUrl(extensionId) {
    return "https://chromewebstore.google.com/detail/extension/" + extensionId;
  }

  function normalizeStoreUrl(value) {
    if (!value) {
      return "";
    }
    if (/^https:\/\/chromewebstore\.google\.com\//i.test(value)) {
      return value;
    }
    if (/^https:\/\/chrome\.google\.com\/webstore\//i.test(value)) {
      return value.replace("https://chrome.google.com/webstore/", "https://chromewebstore.google.com/");
    }
    return "";
  }

  function isFreshMetadata(entry) {
    return !!entry && !!entry.fetchedAt && (Date.now() - entry.fetchedAt) < metadataCacheTtlMs;
  }

  function buildFallbackMetadata(item) {
    return {
      category: defaultCategoryForInstallType(item.installType),
      descriptionLine: firstDescriptionLine(item.description || ""),
      fetchedAt: Date.now(),
      source: "fallback",
      storeUrl: normalizeStoreUrl(item.homepageUrl || "")
    };
  }

  function parseChromeWebStoreHtml(html, requestUrl) {
    var canonicalMatch = html.match(/<link rel="canonical" href="([^"]+)"/i);
    var descriptionMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)
      || html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);
    var categoryMatch = html.match(/href="\.\/category\/extensions"[^>]*>[^<]+<\/a>\s*<a[^>]+href="\.\/category\/extensions\/[^"]+"[^>]*>([^<]+)<\/a>\s*[\d,.]+\s*users/i)
      || html.match(/href="\.\/category\/[^"]+\/[^"]+"[^>]*>([^<]+)<\/a>\s*[\d,.]+\s*users/i);

    return {
      category: decodeHtmlEntities(categoryMatch ? categoryMatch[1].trim() : ""),
      descriptionLine: firstDescriptionLine(decodeHtmlEntities(descriptionMatch ? descriptionMatch[1] : "")),
      fetchedAt: Date.now(),
      source: "store",
      storeUrl: normalizeStoreUrl(canonicalMatch ? canonicalMatch[1] : requestUrl)
    };
  }

  async function fetchChromeWebStoreMetadata(item) {
    var requestUrl = buildGenericStoreUrl(item.id);
    var response = await fetch(requestUrl);
    if (!response.ok) {
      throw new Error("Store metadata fetch failed: " + response.status);
    }

    var html = await response.text();
    var parsed = parseChromeWebStoreHtml(html, requestUrl);
    if (!parsed.descriptionLine && !parsed.category && !parsed.storeUrl) {
      throw new Error("Store metadata parse failed.");
    }
    return parsed;
  }

  async function loadExtensionMetadata(extensionIds) {
    var requestedIds = storage.uniqueArray(extensionIds || []);
    if (!requestedIds.length) {
      return {};
    }

    var localState = await storage.loadLocalState();
    var cache = storage.clone(localState.webStoreMetadata || {});
    var items = await getAllManagementItems();
    var itemMap = items.reduce(function(result, item) {
      result[item.id] = item;
      return result;
    }, {});
    var metadataMap = {};
    var cacheUpdated = false;

    for (var index = 0; index < requestedIds.length; index += 1) {
      var extensionId = requestedIds[index];
      var item = itemMap[extensionId];
      if (!item) {
        continue;
      }

      var fallback = buildFallbackMetadata(item);
      var cached = cache[extensionId];
      if (isFreshMetadata(cached)) {
        metadataMap[extensionId] = {
          category: cached.category || fallback.category,
          descriptionLine: cached.descriptionLine || fallback.descriptionLine,
          fetchedAt: cached.fetchedAt,
          source: cached.source || "fallback",
          storeUrl: cached.storeUrl || fallback.storeUrl
        };
        continue;
      }

      var nextMetadata;
      if (item.installType === "development" || item.type !== "extension") {
        nextMetadata = fallback;
      } else {
        try {
          nextMetadata = fetchChromeWebStoreMetadata(item).then(function(parsed) {
            return {
              category: parsed.category || fallback.category,
              descriptionLine: parsed.descriptionLine || fallback.descriptionLine,
              fetchedAt: parsed.fetchedAt,
              source: parsed.source,
              storeUrl: parsed.storeUrl || fallback.storeUrl
            };
          });
          nextMetadata = await nextMetadata;
        } catch (error) {
          nextMetadata = fallback;
        }
      }

      cache[extensionId] = nextMetadata;
      metadataMap[extensionId] = nextMetadata;
      cacheUpdated = true;
    }

    if (cacheUpdated) {
      await storage.saveLocalState({ webStoreMetadata: cache });
    }

    return metadataMap;
  }

  async function getAllManagementItems() {
    var items = await chromeCall(chrome.management, "getAll", []);
    return filterManagedItems(items);
  }

  async function setExtensionEnabled(extensionId, enabled) {
    await chromeCall(chrome.management, "setEnabled", [extensionId, enabled]);
  }

  async function uninstallExtension(extensionId) {
    await chromeCall(chrome.management, "uninstall", [extensionId]);
  }

  async function createTab(url) {
    var targetUrl = /^[a-z]+:\/\//i.test(url) ? url : chrome.runtime.getURL(String(url).replace(/^\//, ""));
    return chromeCall(chrome.tabs, "create", [{ active: true, url: targetUrl }]);
  }

  async function getTab(tabId) {
    return chromeCall(chrome.tabs, "get", [tabId]);
  }

  async function clearAlarm(alarmName) {
    return chromeCall(chrome.alarms, "clear", [alarmName]);
  }

  async function loadContext() {
    var results = await Promise.all([
      storage.loadSyncOptions(),
      storage.loadLocalState(),
      storage.loadProfiles(),
      getAllManagementItems()
    ]);

    return {
      items: results[3],
      localState: results[1],
      options: results[0],
      profiles: results[2]
    };
  }

  function normalizeExtensions(items, state) {
    var aliases = state.localState.aliases || {};
    var counters = state.localState.usageCounters || {};
    var recentList = Array.isArray(state.localState.recentlyUsed) ? state.localState.recentlyUsed : [];
    var groups = state.localState.groups || {};
    var groupLookup = buildGroupLookup(groups);
    var alwaysOn = state.profiles.map.__always_on || [];
    var favorites = state.profiles.map.__favorites || [];

    return items.slice().sort(function(left, right) {
      return left.name.toUpperCase().localeCompare(right.name.toUpperCase());
    }).map(function(item) {
      var extensionGroups = (groupLookup[item.id] || []).map(function(groupId) {
        var group = groups[groupId];
        return {
          color: group.color || "#516C97",
          id: groupId,
          name: group.name || "Group"
        };
      });

      return {
        alias: aliases[item.id] || "",
        alwaysOn: alwaysOn.indexOf(item.id) !== -1,
        description: item.description || "",
        displayName: aliases[item.id] || item.name,
        enabled: !!item.enabled,
        favorite: favorites.indexOf(item.id) !== -1,
        groupBadges: extensionGroups,
        groupIds: groupLookup[item.id] || [],
        homepageUrl: item.homepageUrl || "",
        icon: smallestIcon(item.icons),
        id: item.id,
        installType: item.installType,
        isApp: isAppType(item.type),
        lastUsed: recentList.indexOf(item.id) === -1 ? 0 : (recentList.length - recentList.indexOf(item.id)),
        mayDisable: !!item.mayDisable,
        name: item.name,
        optionsUrl: item.optionsUrl || "",
        type: item.type,
        usageCount: counters[item.id] || 0,
        version: item.version || ""
      };
    });
  }

  function buildPublicLocalState(localState) {
    var nextState = storage.clone(localState || {});
    delete nextState.webStoreMetadata;
    return nextState;
  }

  async function buildState() {
    var context = await loadContext();
    return {
      extensions: normalizeExtensions(context.items, context),
      localState: buildPublicLocalState(context.localState),
      metadata: {
        version: chrome.runtime.getManifest().version
      },
      options: context.options,
      profiles: context.profiles
    };
  }

  async function applyExtensionChanges(desiredChanges, context, config) {
    var options = config || {};
    var current = await loadContext();
    var itemMap = current.items.reduce(function(result, item) {
      result[item.id] = item;
      return result;
    }, {});
    var changes = [];

    (Array.isArray(desiredChanges) ? desiredChanges : []).forEach(function(entry) {
      var extensionId = entry.id || entry.extensionId;
      var item = itemMap[extensionId];
      if (!item || item.type !== "extension" || !item.mayDisable) {
        return;
      }

      if (!!item.enabled === !!entry.enabled) {
        return;
      }

      changes.push({
        enabled: !!entry.enabled,
        id: extensionId,
        name: item.name,
        profileId: entry.profileId || null,
        ruleId: entry.ruleId || null
      });
    });

    if (!changes.length) {
      if (options.localPatch) {
        await storage.saveLocalState(options.localPatch);
      }
      if (options.syncPatch) {
        await storage.saveSyncOptions(options.syncPatch);
      }
      return buildState();
    }

    var localPatch = {
      eventHistory: history.appendHistory(
        current.localState.eventHistory,
        history.createRecords(changes, context)
      )
    };

    var usage = applyUsageMetrics(current.localState, changes, context);
    localPatch.recentlyUsed = usage.recentlyUsed;
    localPatch.usageCounters = usage.usageCounters;

    if (options.pushUndo !== false) {
      localPatch.undoStack = pushUndoEntry(
        current.localState.undoStack,
        options.action || context.source,
        buildSnapshot(current.items)
      );
    }

    for (var index = 0; index < changes.length; index += 1) {
      await setExtensionEnabled(changes[index].id, changes[index].enabled);
    }

    localPatch.reminderQueue = await reminders.syncReminderQueue(
      current.localState.reminderQueue,
      changes,
      current.options,
      context
    );

    if (options.localPatch) {
      Object.keys(options.localPatch).forEach(function(key) {
        localPatch[key] = options.localPatch[key];
      });
    }

    await storage.saveLocalState(localPatch);
    if (options.syncPatch) {
      await storage.saveSyncOptions(options.syncPatch);
    }
    return buildState();
  }

  async function runToggleAll() {
    var current = await loadContext();
    var restoreIds = Array.isArray(current.localState.bulkToggleRestore) ? current.localState.bulkToggleRestore.slice() : [];

    if (restoreIds.length > 0) {
      return applyExtensionChanges(
        restoreIds.map(function(extensionId) {
          return { enabled: true, id: extensionId };
        }),
        { source: "bulk" },
        {
          action: "toggle_all_restore",
          localPatch: { bulkToggleRestore: [] },
          syncPatch: { activeProfile: null }
        }
      );
    }

    var alwaysOn = current.profiles.map.__always_on || [];
    var enabledIds = current.items.filter(function(item) {
      return item.type === "extension" && item.mayDisable && item.enabled;
    }).map(function(item) {
      return item.id;
    });

    var disableIds = enabledIds.filter(function(extensionId) {
      if (!current.options.keepAlwaysOn) {
        return true;
      }
      return alwaysOn.indexOf(extensionId) === -1;
    });

    return applyExtensionChanges(
      disableIds.map(function(extensionId) {
        return { enabled: false, id: extensionId };
      }),
      { source: "bulk" },
      {
        action: "toggle_all_disable",
        localPatch: { bulkToggleRestore: enabledIds },
        syncPatch: { activeProfile: null }
      }
    );
  }

  async function runApplyProfile(profileName) {
    var current = await loadContext();
    var targetProfile = current.profiles.map[profileName];

    if (!targetProfile) {
      throw new Error("Unknown profile: " + profileName);
    }

    var alwaysOn = current.profiles.map.__always_on || [];
    var desiredIds = storage.uniqueArray(targetProfile.concat(alwaysOn));
    var changes = current.items.filter(function(item) {
      return item.type === "extension" && item.mayDisable;
    }).map(function(item) {
      return {
        enabled: desiredIds.indexOf(item.id) !== -1,
        id: item.id,
        profileId: profileName
      };
    });

    return applyExtensionChanges(
      changes,
      { profileId: profileName, source: "profile" },
      {
        action: "apply_profile",
        syncPatch: { activeProfile: profileName }
      }
    );
  }

  async function runUndo() {
    var localState = await storage.loadLocalState();
    var undoStack = Array.isArray(localState.undoStack) ? localState.undoStack.slice() : [];
    var lastEntry = undoStack.pop();

    if (!lastEntry) {
      return buildState();
    }

    var changes = Object.keys(lastEntry.snapshot || {}).map(function(extensionId) {
      return {
        enabled: !!lastEntry.snapshot[extensionId],
        id: extensionId
      };
    });

    return applyExtensionChanges(
      changes,
      { source: "undo" },
      {
        action: "undo_last",
        localPatch: {
          bulkToggleRestore: [],
          undoStack: undoStack
        },
        pushUndo: false,
        syncPatch: { activeProfile: null }
      }
    );
  }

  async function saveAliases(payload) {
    var localState = await storage.loadLocalState();
    var aliases = storage.clone(localState.aliases || {});

    if (payload.aliases) {
      aliases = storage.clone(payload.aliases);
    } else if (payload.extensionId) {
      aliases[payload.extensionId] = (payload.alias || "").trim();
      if (!aliases[payload.extensionId]) {
        delete aliases[payload.extensionId];
      }
    }

    await storage.saveLocalState({ aliases: aliases });
    return buildState();
  }

  async function saveGroups(payload) {
    var normalized = normalizeGroups(payload.groups || {});
    if (Array.isArray(payload.groupOrder) && payload.groupOrder.length > 0) {
      normalized.groupOrder = payload.groupOrder.filter(function(groupId) {
        return Object.prototype.hasOwnProperty.call(normalized.groups, groupId);
      });
    }

    await storage.saveLocalState(normalized);
    return buildState();
  }

  async function saveUrlRules(payload) {
    await storage.saveLocalState({
      urlRules: urlRules.normalizeRules(payload.urlRules || [])
    });
    return buildState();
  }

  async function saveOptions(payload) {
    var nextOptions = await storage.saveSyncOptions(payload.options || {});
    if (!nextOptions.enableReminders) {
      var localState = await storage.loadLocalState();
      for (var index = 0; index < localState.reminderQueue.length; index += 1) {
        await clearAlarm(localState.reminderQueue[index].alarmName);
      }
      await storage.saveLocalState({ reminderQueue: [] });
    }
    return buildState();
  }

  async function importBackup(payload) {
    var envelope = importExport.validateBackupEnvelope(payload.envelope);
    var currentLocalState = await storage.loadLocalState();

    for (var index = 0; index < currentLocalState.reminderQueue.length; index += 1) {
      await clearAlarm(currentLocalState.reminderQueue[index].alarmName);
    }

    await storage.saveSyncOptions(envelope.settings);
    await storage.saveProfiles(envelope.profiles);
    await storage.saveLocalState({
      aliases: envelope.aliases,
      bulkToggleRestore: [],
      eventHistory: Array.isArray(envelope.localState.eventHistory) ? envelope.localState.eventHistory : [],
      groupOrder: envelope.groupOrder,
      groups: envelope.groups,
      recentlyUsed: Array.isArray(envelope.localState.recentlyUsed) ? envelope.localState.recentlyUsed : [],
      reminderQueue: [],
      undoStack: Array.isArray(envelope.localState.undoStack) ? envelope.localState.undoStack : [],
      urlRules: Array.isArray(envelope.urlRules) ? envelope.urlRules : [],
      usageCounters: envelope.localState.usageCounters || {}
    });

    var extensionStateMap = envelope.localState.extensionStates || {};
    var changes = Object.keys(extensionStateMap).map(function(extensionId) {
      return {
        enabled: !!extensionStateMap[extensionId],
        id: extensionId
      };
    });

    return applyExtensionChanges(
      changes,
      { source: "import" },
      {
        action: "import_backup",
        localPatch: { bulkToggleRestore: [] },
        pushUndo: false,
        syncPatch: { activeProfile: envelope.localState.activeProfile || envelope.settings.activeProfile || null }
      }
    );
  }

  async function exportBackup() {
    var state = await buildState();
    return {
      envelope: importExport.buildBackupEnvelope(state)
    };
  }

  async function getExtensionMetadataPayload(payload) {
    return {
      metadata: await loadExtensionMetadata(payload.extensionIds || [])
    };
  }

  async function runUninstallExtension(extensionId) {
    await uninstallExtension(extensionId);
    return buildState();
  }

  async function syncDriveNow() {
    return {
      result: await driveSync.syncDrive()
    };
  }

  async function openDashboard() {
    await createTab("dashboard.html");
    return { opened: true };
  }

  async function cycleProfiles(step) {
    var state = await buildState();
    var names = state.profiles.items.filter(function(profile) {
      return profile.name.indexOf("__") !== 0;
    }).map(function(profile) {
      return profile.name;
    });

    if (!names.length) {
      return buildState();
    }

    var currentIndex = names.indexOf(state.options.activeProfile);
    var nextIndex = currentIndex === -1
      ? (step > 0 ? 0 : names.length - 1)
      : (currentIndex + step + names.length) % names.length;

    return runApplyProfile(names[nextIndex]);
  }

  async function evaluateRulesForUrl(url) {
    var current = await loadContext();
    var desired = urlRules.resolveChanges(url, current.localState.urlRules);
    var changes = Object.keys(desired).map(function(extensionId) {
      return {
        enabled: desired[extensionId].enabled,
        id: extensionId,
        ruleId: desired[extensionId].ruleId
      };
    });

    if (!changes.length) {
      return buildState();
    }

    return applyExtensionChanges(
      changes,
      { source: "rule" },
      {
        action: "url_rule",
        pushUndo: false,
        syncPatch: { activeProfile: null }
      }
    );
  }

  function scheduleRuleEvaluation(tabId, url) {
    if (!urlRules.isSupportedUrl(url)) {
      return;
    }

    if (urlEvaluationTimers[tabId]) {
      clearTimeout(urlEvaluationTimers[tabId]);
    }

    urlEvaluationTimers[tabId] = setTimeout(function() {
      delete urlEvaluationTimers[tabId];
      evaluateRulesForUrl(url).catch(function(error) {
        console.error("url_rule_failed", error);
      });
    }, 300);
  }

  async function handleMessage(message) {
    switch (message.type) {
      case "APPLY_PROFILE":
        return { state: await runApplyProfile(message.profileName) };
      case "EXPORT_BACKUP":
        return await exportBackup();
      case "GET_EXTENSION_METADATA":
        return await getExtensionMetadataPayload(message);
      case "GET_STATE":
        return { state: await buildState() };
      case "IMPORT_BACKUP":
        return { state: await importBackup(message) };
      case "OPEN_DASHBOARD":
        return await openDashboard();
      case "SAVE_ALIAS":
        return { state: await saveAliases(message) };
      case "SAVE_GROUPS":
        return { state: await saveGroups(message) };
      case "SAVE_OPTIONS":
        return { state: await saveOptions(message) };
      case "SAVE_URL_RULES":
        return { state: await saveUrlRules(message) };
      case "SET_EXTENSION_STATE":
        return {
          state: await applyExtensionChanges(
            [{ enabled: !!message.enabled, id: message.extensionId }],
            message.context || { source: "manual" },
            {
              action: "set_extension_state",
              syncPatch: { activeProfile: null }
            }
          )
        };
      case "SYNC_DRIVE":
        return await syncDriveNow();
      case "TOGGLE_ALL":
        return { state: await runToggleAll() };
      case "UNDO_LAST":
        return { state: await runUndo() };
      case "UNINSTALL_EXTENSION":
        return { state: await runUninstallExtension(message.extensionId) };
      default:
        throw new Error("Unsupported message type: " + message.type);
    }
  }

  async function runMigrations() {
    try {
      await migrations.migrateLegacyLocalStorage();
    } catch (error) {
      console.warn("legacy_migration_skipped", error.message);
    }
    await migrations.migrateTo2_0_0();
    if (migrations.migratePopupListStyle) {
      await migrations.migratePopupListStyle();
    }
  }

  chrome.runtime.onInstalled.addListener(function() {
    runMigrations().catch(function(error) {
      console.error("migration_failed", error);
    });
  });

  chrome.runtime.onStartup.addListener(function() {
    runMigrations().catch(function(error) {
      console.error("startup_migration_failed", error);
    });
  });

  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    handleMessage(message).then(function(payload) {
      sendResponse({ ok: true, payload: payload });
    }).catch(function(error) {
      sendResponse({
        error: error.message,
        ok: false
      });
    });
    return true;
  });

  chrome.commands.onCommand.addListener(function(command) {
    if (command === "toggle-all-extensions") {
      runToggleAll().catch(function(error) {
        console.error("toggle_all_command_failed", error);
      });
      return;
    }

    if (command === "cycle-next-profile") {
      cycleProfiles(1).catch(function(error) {
        console.error("cycle_next_profile_failed", error);
      });
      return;
    }

    if (command === "cycle-previous-profile") {
      cycleProfiles(-1).catch(function(error) {
        console.error("cycle_previous_profile_failed", error);
      });
    }
  });

  chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    var url = changeInfo.url || tab.url;
    if (!url) {
      return;
    }
    if (changeInfo.status === "complete" || changeInfo.url) {
      scheduleRuleEvaluation(tabId, url);
    }
  });

  chrome.tabs.onActivated.addListener(function(activeInfo) {
    getTab(activeInfo.tabId).then(function(tab) {
      if (tab && tab.url) {
        scheduleRuleEvaluation(tab.id, tab.url);
      }
    }).catch(function(error) {
      console.error("tab_activation_failed", error);
    });
  });

  chrome.webNavigation.onHistoryStateUpdated.addListener(function(details) {
    scheduleRuleEvaluation(details.tabId, details.url);
  });

  chrome.alarms.onAlarm.addListener(function(alarm) {
    if (!reminders.isReminderAlarm(alarm.name)) {
      return;
    }
    reminders.handleAlarm(alarm.name).catch(function(error) {
      console.error("reminder_alarm_failed", error);
    });
  });

  runMigrations().catch(function(error) {
    console.error("initial_migration_failed", error);
  });

  root.ExtensityBackground = {
    buildFallbackMetadata: buildFallbackMetadata,
    buildGenericStoreUrl: buildGenericStoreUrl,
    defaultCategoryForInstallType: defaultCategoryForInstallType,
    firstDescriptionLine: firstDescriptionLine,
    loadExtensionMetadata: loadExtensionMetadata,
    normalizeExtensions: normalizeExtensions,
    normalizeStoreUrl: normalizeStoreUrl,
    parseChromeWebStoreHtml: parseChromeWebStoreHtml
  };
})(self);
