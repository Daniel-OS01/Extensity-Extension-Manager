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
    self.undoDepth = ko.observable(0);

    self.bodyClass = ko.pureComputed(function() {
      var classes = [];
      classes.push(self.opts.viewMode() === "grid" ? "grid-view" : "list-view");
      if (self.opts.contrastMode() === "high") {
        classes.push("high-contrast");
      }
      var scheme = self.opts.colorScheme();
      if (scheme === "dark") { classes.push("dark-mode"); }
      if (scheme === "light") { classes.push("light-mode"); }
      return classes.join(" ");
    });

    ko.computed(function() {
      var style = document.documentElement.style;
      style.setProperty("--font-size", self.opts.fontSizePx() + "px");
      style.setProperty("--item-padding-v", self.opts.itemPaddingPx() + "px");
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
      self.profiles.items().forEach(function(profile) {
        if (!profile.reserved()) {
          var colorClass = "profile-color-" + (colorIndex % 5);
          colorIndex += 1;
          profile.items().forEach(function(extId) {
            if (!profileMap[extId]) { profileMap[extId] = []; }
            profileMap[extId].push({ name: profile.short_name(), colorClass: colorClass });
          });
        }
      });
      self.exts.items().forEach(function(ext) {
        ext.profileBadges(profileMap[ext.id()] || []);
      });

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
      chrome.tabs.create({ active: true, url: extension.optionsUrl() });
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
