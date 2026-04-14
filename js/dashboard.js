document.addEventListener("DOMContentLoaded", function() {
  function numericOption(value, fallback) {
    return typeof value === "number" && isFinite(value) ? value : fallback;
  }

  function exportFilename(prefix, ext) {
    var d = new Date();
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    var yyyy = d.getFullYear();
    return prefix + "-" + dd + "-" + mm + "-" + yyyy + "." + ext;
  }

  function applyThemeClasses(options) {
    document.body.classList.toggle("dark-mode", options.colorScheme === "dark");
    document.body.classList.toggle("light-mode", options.colorScheme === "light");
  }

  function applyCssVars(options) {
    var style = document.documentElement.style;
    style.setProperty("--font-size", numericOption(options.fontSizePx, 12) + "px");
    style.setProperty("--item-padding-v", numericOption(options.itemPaddingPx, 10) + "px");
    style.setProperty("--item-spacing", numericOption(options.itemSpacingPx, 8) + "px");
    style.setProperty("--popup-width", numericOption(options.popupWidthPx, 380) + "px");
  }

  function GroupEditor(group) {
    var self = this;
    self.id = ko.observable(group.id || ExtensityStorage.makeId("group"));
    self.name = ko.observable(group.name || "");
    self.color = ko.observable(group.color || "#516C97");
    self.fixed = ko.observable(!!group.fixed);
    self.extensionIds = ko.observableArray(group.extensionIds || []);

    self.toJS = function() {
      return {
        color: self.color(),
        extensionIds: ExtensityStorage.uniqueArray(self.extensionIds()),
        fixed: self.fixed(),
        id: self.id(),
        name: (self.name() || "").trim() || "Untitled Group"
      };
    };
  }

  function RuleEditor(rule) {
    var self = this;
    self.id = ko.observable(rule.id || ExtensityStorage.makeId("rule"));
    self.name = ko.observable(rule.name || "");
    self.urlPattern = ko.observable(rule.urlPattern || "");
    self.matchMethod = ko.observable(rule.matchMethod || "wildcard");
    self.active = ko.observable(rule.active !== false);
    self.enableIds = ko.observableArray(rule.enableIds || []);
    self.disableIds = ko.observableArray(rule.disableIds || []);

    self.toJS = function() {
      return {
        active: self.active(),
        disableIds: ExtensityStorage.uniqueArray(self.disableIds()),
        enableIds: ExtensityStorage.uniqueArray(self.enableIds()),
        id: self.id(),
        matchMethod: self.matchMethod(),
        name: (self.name() || "").trim() || "Untitled Rule",
        urlPattern: (self.urlPattern() || "").trim()
      };
    };
  }

  function AliasEditor(extension) {
    this.alias = ko.observable(extension.alias || "");
    this.id = extension.id;
    this.name = extension.name;
  }

  function DashboardViewModel() {
    var self = this;
    self.loading = ko.observable(true);
    self.busy = ko.observable(false);
    self.error = ko.observable("");
    self.message = ko.observable("");
    self.activeTab = ko.observable("history");
    self.historyTab = ko.pureComputed(function() { return self.activeTab() === "history"; });
    self.groupsTab = ko.pureComputed(function() { return self.activeTab() === "groups"; });
    self.rulesTab = ko.pureComputed(function() { return self.activeTab() === "rules"; });
    self.aliasesTab = ko.pureComputed(function() { return self.activeTab() === "aliases"; });
    self.dataTab = ko.pureComputed(function() { return self.activeTab() === "data"; });
    self.showTabHistory = function() { self.activeTab("history"); };
    self.showTabGroups = function() { self.activeTab("groups"); };
    self.showTabRules = function() { self.activeTab("rules"); };
    self.showTabAliases = function() { self.activeTab("aliases"); };
    self.showTabData = function() { self.activeTab("data"); };
    self.options = new OptionsCollection();
    self.extensions = ko.observableArray([]);
    self.aliasRows = ko.observableArray([]);
    self.groups = ko.observableArray([]);
    self.rules = ko.observableArray([]);
    self.historyRows = ko.observableArray([]);

    self.applyState = function(state) {
      var groupOrder = state.localState.groupOrder || [];
      var groups = state.localState.groups || {};
      self.options.apply(state.options);
      applyThemeClasses(state.options);
      applyCssVars(state.options);
      self.extensions(state.extensions.filter(function(extension) {
        return !extension.isApp;
      }));
      self.aliasRows(self.extensions().map(function(extension) {
        return new AliasEditor(extension);
      }));
      self.groups(groupOrder.filter(function(groupId) {
        return Object.prototype.hasOwnProperty.call(groups, groupId);
      }).map(function(groupId) {
        return new GroupEditor(groups[groupId]);
      }));
      self.rules((state.localState.urlRules || []).map(function(rule) {
        return new RuleEditor(rule);
      }));
      self.historyRows((state.localState.eventHistory || []).slice().reverse());
      self.loading(false);
      self.error("");
    };

    self.performAction = function(request) {
      self.busy(true);
      self.error("");

      return request.then(function(payload) {
        if (payload.state) {
          self.applyState(payload.state);
        }
        return payload;
      }).catch(function(error) {
        self.error(error.message);
        throw error;
      }).finally(function() {
        self.busy(false);
      });
    };

    self.refresh = function() {
      self.loading(true);
      return self.performAction(ExtensityApi.getState());
    };

    self.isTab = function(tab) {
      return self.activeTab() === tab;
    };

    self.eventBadgeClass = function(event) {
      return "event-badge event-" + (event || "unknown");
    };

    self.saveAliases = function() {
      var aliases = self.aliasRows().reduce(function(result, row) {
        if ((row.alias() || "").trim()) {
          result[row.id] = row.alias().trim();
        }
        return result;
      }, {});

      self.performAction(ExtensityApi.saveAliases(aliases)).then(function() {
        self.message("Aliases saved.");
      }).catch(function() {});
    };

    self.addGroup = function() {
      self.groups.push(new GroupEditor({}));
    };

    self.removeGroup = function(group) {
      self.groups.remove(group);
    };

    self.saveGroups = function() {
      var groups = {};
      var order = self.groups().map(function(group) {
        var data = group.toJS();
        groups[data.id] = data;
        return data.id;
      });

      self.performAction(ExtensityApi.saveGroups(groups, order)).then(function() {
        self.message("Groups saved.");
      }).catch(function() {});
    };

    self.addRule = function() {
      self.rules.push(new RuleEditor({}));
    };

    self.removeRule = function(rule) {
      self.rules.remove(rule);
    };

    self.saveRules = function() {
      var rules = self.rules().map(function(rule) {
        return rule.toJS();
      });

      self.performAction(ExtensityApi.saveUrlRules(rules)).then(function() {
        self.message("URL rules saved.");
      }).catch(function() {});
    };

    self.exportJson = function() {
      self.performAction(ExtensityApi.exportBackup()).then(function(payload) {
        ExtensityIO.downloadText(
          exportFilename("extensity-plus-backup", "json"),
          JSON.stringify(payload.envelope, null, 2),
          "application/json;charset=utf-8"
        );
      }).catch(function() {});
    };

    self.exportCsv = function() {
      self.performAction(ExtensityApi.getState()).then(function(payload) {
        var csv = ExtensityImportExport.buildExtensionsCsv(payload.state.extensions);
        ExtensityIO.downloadText(exportFilename("extensity-extensions", "csv"), csv, "text/csv;charset=utf-8");
      }).catch(function() {});
    };

    self.importJson = function(viewModel, event) {
      var file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }

      self.busy(true);
      ExtensityIO.readFileAsText(file).then(function(content) {
        return JSON.parse(content);
      }).then(function(envelope) {
        return ExtensityApi.importBackup(envelope);
      }).then(function(payload) {
        self.applyState(payload.state);
        self.message("Backup imported.");
      }).catch(function(error) {
        self.error(error.message);
      }).finally(function() {
        self.busy(false);
        event.target.value = "";
      });
    };

    self.formatHistoryDate = function(timestamp) {
      return new Date(timestamp).toLocaleString();
    };

    self.syncDrive = function() {
      self.performAction(ExtensityApi.syncDrive()).then(function() {
        self.message("Drive sync completed.");
      }).catch(function() {});
    };
  }

  _.defer(function() {
    var vm = new DashboardViewModel();
    ko.bindingProvider.instance = new ko.secureBindingsProvider({});
    ko.applyBindings(vm, document.getElementById("dashboard-page"));
    vm.refresh();
  });
});
