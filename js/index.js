document.addEventListener("DOMContentLoaded", function() {
  function levenshteinWithin(source, query, limit) {
    var left = source.toLowerCase();
    var right = query.toLowerCase();

    if (Math.abs(left.length - right.length) > limit) {
      return false;
    }

    var previous = [];
    for (var index = 0; index <= right.length; index += 1) {
      previous[index] = index;
    }

    for (var row = 1; row <= left.length; row += 1) {
      var current = [row];
      var rowMin = current[0];

      for (var column = 1; column <= right.length; column += 1) {
        var cost = left[row - 1] === right[column - 1] ? 0 : 1;
        current[column] = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + cost
        );
        rowMin = Math.min(rowMin, current[column]);
      }

      if (rowMin > limit) {
        return false;
      }
      previous = current;
    }

    return previous[right.length] <= limit;
  }

  function focusSiblingRow(target, direction) {
    var rows = Array.prototype.slice.call(document.querySelectorAll(".keyboard-row"));
    var index = rows.indexOf(target);
    if (index === -1) {
      return;
    }

    var next = rows[index + direction];
    if (next) {
      next.focus();
    }
  }

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

  function openTab(url) {
    return chromeCall(chrome.tabs, "create", [{ active: true, url: url }]);
  }

  function buildManageExtensionUrl(extensionId) {
    return "chrome://extensions/?id=" + encodeURIComponent(extensionId);
  }

  function buildPermissionsPageUrl(extensionId) {
    return buildManageExtensionUrl(extensionId) + "#permissions";
  }

  function copyText(value) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(value);
    }

    return new Promise(function(resolve, reject) {
      var input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "readonly");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      try {
        if (!document.execCommand("copy")) {
          throw new Error("Copy command failed.");
        }
        resolve();
      } catch (error) {
        reject(error);
      } finally {
        document.body.removeChild(input);
      }
    });
  }

  function SearchViewModel() {
    var self = this;
    self.q = ko.observable("");

    self.matchesExtension = function(extension) {
      var query = (self.q() || "").trim().toLowerCase();
      if (!query) {
        return true;
      }

      var haystacks = [
        extension.alias(),
        extension.name(),
        extension.description()
      ].filter(Boolean).map(function(item) {
        return item.toLowerCase();
      });

      if (haystacks.some(function(item) {
        return item.indexOf(query) !== -1;
      })) {
        return true;
      }

      if (query.length < 3) {
        return false;
      }

      return haystacks.some(function(item) {
        return item.split(/\s+/).some(function(word) {
          return levenshteinWithin(word, query, 2);
        });
      });
    };
  }

  function SwitchViewModel(owner) {
    var self = this;
    self.owner = owner;
    self.restoreList = ko.observableArray([]);

    self.any = ko.computed(function() {
      return self.restoreList().length > 0;
    });

    self.toggleStyle = ko.pureComputed(function() {
      return self.any() ? "fa-toggle-off" : "fa-toggle-on";
    });

    self.flip = function() {
      self.owner.performAction(ExtensityApi.toggleAll());
    };

    self.undo = function() {
      self.owner.performAction(ExtensityApi.undoLast());
    };
  }

  function ExtensityViewModel() {
    var self = this;
    self.loading = ko.observable(true);
    self.error = ko.observable("");
    self.busy = ko.observable(false);
    self.opts = new OptionsCollection();
    self.profiles = new ProfileCollectionModel();
    self.exts = new ExtensionCollectionModel();
    self.dismissals = new DismissalsCollection();
    self.search = new SearchViewModel();
    self.switch = new SwitchViewModel(self);
    self.activeProfile = ko.observable(null);
    self.expandedExtensionId = ko.observable(null);
    self.undoDepth = ko.observable(0);

    self.bodyClass = ko.pureComputed(function() {
      var classes = [];
      classes.push(self.opts.viewMode() === "grid" ? "grid-view" : "list-view");
      if (self.opts.viewMode() === "list") {
        classes.push("popup-list-style-" + self.opts.popupListStyle());
      }
      if (self.opts.contrastMode() === "high") {
        classes.push("high-contrast");
      }
      var scheme = self.opts.colorScheme();
      if (scheme === "dark") { classes.push("dark-mode"); }
      if (scheme === "light") { classes.push("light-mode"); }
      return classes.join(" ");
    });

    self.isCompactPopupList = ko.pureComputed(function() {
      return self.opts.viewMode() === "list" && self.opts.popupListStyle() === "compact";
    });

    ko.computed(function() {
      var style = document.documentElement.style;
      style.setProperty("--font-size", self.opts.fontSizePx() + "px");
      style.setProperty("--item-padding-v", self.opts.itemPaddingPx() + "px");
      style.setProperty("--item-padding-x", self.opts.itemPaddingXPx() + "px");
      style.setProperty("--item-name-gap", self.opts.itemNameGapPx() + "px");
      style.setProperty("--item-spacing", self.opts.itemSpacingPx() + "px");
      style.setProperty("--popup-width", self.opts.popupWidthPx() + "px");
    });

    self.canUndo = ko.pureComputed(function() {
      return self.undoDepth() > 0;
    });

    self.viewToggleIcon = ko.pureComputed(function() {
      return self.opts.viewMode() === "grid" ? "fa-list" : "fa-th-large";
    });

    self.applyState = function(state) {
      self.opts.apply(state.options);
      self.activeProfile(state.options.activeProfile);
      self.profiles.applyState(state.profiles);
      self.exts.applyState(state.extensions);
      self.switch.restoreList(state.localState.bulkToggleRestore || []);
      self.undoDepth((state.localState.undoStack || []).length);

      // Mark active profile pill
      self.profiles.items().forEach(function(profile) {
        profile.isActive(profile.name() === state.options.activeProfile);
      });

      // Compute profile membership badges for each extension
      var profileMap = {};
      var colorIndex = 0;
      var badgeMode = self.opts.popupProfileBadgeTextMode();
      var singleWordChars = self.opts.popupProfileBadgeSingleWordChars();
      self.profiles.items().forEach(function(profile) {
        if (!profile.reserved()) {
          var colorClass = "profile-color-" + (colorIndex % 5);
          colorIndex += 1;
          profile.items().forEach(function(extId) {
            if (!profileMap[extId]) { profileMap[extId] = []; }
            profileMap[extId].push({
              colorClass: colorClass,
              name: ExtensityPopupLabels.formatProfileBadgeLabel(profile.name(), badgeMode, singleWordChars)
            });
          });
        }
      });
      self.exts.items().forEach(function(ext) {
        var badges = (profileMap[ext.id()] || []).slice();
        if (self.opts.showAlwaysOnBadge() && ext.alwaysOn()) {
          badges.unshift({
            colorClass: "always-on-badge",
            name: ExtensityPopupLabels.formatProfileBadgeLabel("__always_on", badgeMode, singleWordChars)
          });
        }
        ext.profileBadges(badges);
      });

      if (self.expandedExtensionId() && !self.exts.find(self.expandedExtensionId())) {
        self.expandedExtensionId(null);
      }

      document.body.className = self.bodyClass();
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
      }).catch(function(error) {
        self.error(error.message);
      }).finally(function() {
        self.busy(false);
      });
    };

    self.refresh = function() {
      self.loading(true);
      return self.performAction(ExtensityApi.getState());
    };

    self.openChromeExtensions = function() {
      chrome.tabs.create({ url: "chrome://extensions" });
      window.close();
    };

    self.openDashboard = function() {
      self.performAction(ExtensityApi.openDashboard()).finally(function() {
        window.close();
      });
    };

    self.launchApp = function(app) {
      chrome.management.launchApp(app.id());
    };

    self.launchOptions = function(extension) {
      return openTab(extension.optionsUrl());
    };

    self.isRowExpanded = function(extensionId) {
      return self.expandedExtensionId() === extensionId;
    };

    self.ensureExtensionMetadata = function(extension) {
      if (extension.metadataLoading() || extension.metadataFetchedAt()) {
        return Promise.resolve();
      }

      extension.metadataLoading(true);
      return ExtensityApi.getExtensionMetadata([extension.id()]).then(function(payload) {
        var metadata = payload.metadata && payload.metadata[extension.id()];
        if (metadata) {
          extension.applyMetadata(metadata);
          return;
        }
        extension.metadataLoading(false);
      }).catch(function(error) {
        extension.metadataLoading(false);
        throw error;
      });
    };

    self.toggleCompactRow = function(extension) {
      var nextId = self.isRowExpanded(extension.id()) ? null : extension.id();
      self.expandedExtensionId(nextId);
      if (nextId) {
        self.ensureExtensionMetadata(extension).catch(function(error) {
          self.error(error.message);
        });
      }
    };

    self.toggleCompactExtension = function(extension) {
      self.performAction(ExtensityApi.setExtensionState(extension.id(), !extension.status(), {
        source: "manual"
      }));
    };

    self.toggleCompactCheckbox = function(extension) {
      self.toggleCompactExtension(extension);
      return false;
    };

    self.openManagePage = function(extension) {
      return openTab(buildManageExtensionUrl(extension.id())).catch(function(error) {
        self.error(error.message);
      });
    };

    self.openPermissionsPage = function(extension) {
      return openTab(buildPermissionsPageUrl(extension.id())).catch(function() {
        return openTab(buildManageExtensionUrl(extension.id()));
      }).catch(function(error) {
        self.error(error.message);
      });
    };

    self.canCopyLink = function(extension) {
      return !!extension.copyLinkUrl();
    };

    self.copyExtensionLink = function(extension) {
      if (!self.canCopyLink(extension)) {
        return;
      }
      copyText(extension.copyLinkUrl()).catch(function(error) {
        self.error(error.message);
      });
    };

    self.openChromeWebStore = function(extension) {
      if (!extension.storeLinkAvailable()) {
        return;
      }
      openTab(extension.storeUrl()).catch(function(error) {
        self.error(error.message);
      });
    };

    self.canRemoveExtension = function(extension) {
      return extension.installType() !== "admin";
    };

    self.removeExtension = function(extension) {
      if (!self.canRemoveExtension(extension)) {
        return;
      }
      self.performAction(ExtensityApi.uninstallExtension(extension.id()));
    };

    self.toggleViewMode = function() {
      var nextOptions = self.opts.toJS();
      nextOptions.viewMode = self.opts.viewMode() === "grid" ? "list" : "grid";
      self.performAction(ExtensityApi.saveOptions(nextOptions));
    };

    self.setSortMode = function(mode) {
      var nextOptions = self.opts.toJS();
      nextOptions.sortMode = mode;
      self.performAction(ExtensityApi.saveOptions(nextOptions));
    };

    self.setSortAlpha = function() { self.setSortMode("alpha"); };
    self.setSortFrequency = function() { self.setSortMode("frequency"); };
    self.setSortRecent = function() { self.setSortMode("recent"); };

    self.setProfile = function(profile) {
      self.performAction(ExtensityApi.applyProfile(profile.name()));
    };

    self.toggleExtension = function(extension) {
      self.performAction(ExtensityApi.setExtensionState(extension.id(), !extension.status(), {
        source: "manual"
      }));
    };

    self.handleRowKeydown = function(item, event) {
      if (event.key === "ArrowDown") {
        focusSiblingRow(event.currentTarget, 1);
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowUp") {
        focusSiblingRow(event.currentTarget, -1);
        event.preventDefault();
        return;
      }

      if (event.key !== " " && event.key !== "Enter") {
        return;
      }

      if (item.isApp && item.isApp()) {
        self.launchApp(item);
      } else {
        self.toggleExtension(item);
      }
      event.preventDefault();
    };

    self.handleCompactRowKeydown = function(item, event) {
      if (event.key === "ArrowDown") {
        focusSiblingRow(event.currentTarget, 1);
        event.preventDefault();
        return;
      }

      if (event.key === "ArrowUp") {
        focusSiblingRow(event.currentTarget, -1);
        event.preventDefault();
      }
    };

    self.filterProfile = function(profile) {
      if (!profile.reserved()) {
        return true;
      }
      return self.opts.showReserved() && profile.hasItems();
    };

    self.sortExtensions = function(items) {
      return items.slice().sort(function(left, right) {
        if (self.opts.enabledFirst() && left.status() !== right.status()) {
          return left.status() ? -1 : 1;
        }

        if (self.opts.sortMode() === "frequency" && left.usageCount() !== right.usageCount()) {
          return right.usageCount() - left.usageCount();
        }

        if (self.opts.sortMode() === "recent" && left.lastUsed() !== right.lastUsed()) {
          return right.lastUsed() - left.lastUsed();
        }

        return left.displayName().toUpperCase().localeCompare(right.displayName().toUpperCase());
      });
    };

    self.listedExtensions = ko.computed(function() {
      return self.sortExtensions(self.exts.extensions().filter(function(extension) {
        return self.search.matchesExtension(extension);
      }));
    }).extend({ countable: null });

    self.listedApps = ko.computed(function() {
      return self.exts.apps().filter(function(app) {
        return self.search.matchesExtension(app);
      }).sort(function(left, right) {
        return left.displayName().toUpperCase().localeCompare(right.displayName().toUpperCase());
      });
    }).extend({ countable: null });

    self.listedItems = ko.computed(function() {
      return self.exts.items().filter(function(item) {
        return self.search.matchesExtension(item);
      }).sort(function(left, right) {
        return left.displayName().toUpperCase().localeCompare(right.displayName().toUpperCase());
      });
    }).extend({ countable: null });

    self.listedProfiles = ko.computed(function() {
      return self.profiles.items().filter(self.filterProfile);
    }).extend({ countable: null });

    self.listedFavorites = ko.computed(function() {
      return self.sortExtensions(self.exts.extensions().filter(function(extension) {
        return extension.favorite() && self.search.matchesExtension(extension);
      }));
    }).extend({ countable: null });

    self.emptyItems = ko.pureComputed(function() {
      if (self.opts.groupApps()) {
        return self.listedApps.none() && self.listedExtensions.none();
      }
      return self.listedItems.none();
    });
  }

  _.defer(function() {
    var vm = new ExtensityViewModel();
    ko.bindingProvider.instance = new ko.secureBindingsProvider({});
    ko.applyBindings(vm, document.body);
    vm.refresh();
  });
});
