document.addEventListener("DOMContentLoaded", function() {
  function ProfilesViewModel() {
    var self = this;

    function compareExtensionsByName(left, right) {
      return left.displayName().toUpperCase().localeCompare(right.displayName().toUpperCase());
    }

    self.loading = ko.observable(true);
    self.busy = ko.observable(false);
    self.error = ko.observable("");
    self.opts = new OptionsCollection();
    self.ext = new ExtensionCollectionModel();
    self.profiles = new ProfileCollectionModel();
    self.current_profile = ko.observable(null);
    self.add_name = ko.observable("");
    self.extSortMode = ko.observable("alpha");
    self.profileCountMap = ko.observable({});

    self.current_name = ko.pureComputed(function() {
      return self.current_profile() ? self.current_profile().name() : null;
    });

    self.editable = ko.pureComputed(function() {
      return !!self.current_profile();
    });

    self.layoutClass = ko.pureComputed(function() {
      return self.opts.profileDisplay() === "portrait" ? "profiles-portrait" : "profiles-landscape";
    });

    self.layoutIsLandscape = ko.pureComputed(function() {
      return self.opts.profileDisplay() === "landscape";
    });

    self.layoutIsPortrait = ko.pureComputed(function() {
      return self.opts.profileDisplay() === "portrait";
    });

    self.shouldShowProfilesExtensionMetadata = ko.pureComputed(function() {
      return !!self.opts.showProfilesExtensionMetadata();
    });

    self.resolvedProfileDirection = ko.pureComputed(function() {
      var dir = self.opts.profileNameDirection();
      if (dir === "ltr" || dir === "rtl") {
        return dir;
      }

      var documentDir = document.documentElement.getAttribute("dir");
      if (documentDir === "ltr" || documentDir === "rtl") {
        return documentDir;
      }

      var bodyDir = document.body.getAttribute("dir");
      if (bodyDir === "ltr" || bodyDir === "rtl") {
        return bodyDir;
      }

      return "ltr";
    });

    self.profileNameDir = ko.pureComputed(function() {
      var dir = self.opts.profileNameDirection();
      if (dir === "ltr" || dir === "rtl") {
        return dir;
      }
      return "auto";
    });

    self.currentProfileNameDir = ko.pureComputed(function() {
      var profile = self.current_profile();
      if (profile && profile.reserved()) {
        return "ltr";
      }
      return self.profileNameDir();
    });

    self.bodyClass = ko.pureComputed(function() {
      var classes = [self.layoutClass(), "profiles-dir-" + self.resolvedProfileDirection()];
      var scheme = self.opts.colorScheme();
      if (scheme === "dark") { classes.push("dark-mode"); }
      if (scheme === "light") { classes.push("light-mode"); }
      return classes.join(" ");
    });

    self.selectedCount = ko.pureComputed(function() {
      return self.profiles.items().filter(function(profile) {
        return profile.selected() && !profile.reserved();
      }).length;
    });

    self.sortedExtensions = ko.pureComputed(function() {
      var countMap = self.profileCountMap();
      var items = self.ext.extensions().slice();
      var mode = self.extSortMode();

      if (mode === "popular") {
        return items.sort(function(left, right) {
          if (right.usageCount() !== left.usageCount()) {
            return right.usageCount() - left.usageCount();
          }
          return compareExtensionsByName(left, right);
        });
      }

      if (mode === "recent") {
        return items.sort(function(left, right) {
          if (right.lastUsed() !== left.lastUsed()) {
            return right.lastUsed() - left.lastUsed();
          }
          return compareExtensionsByName(left, right);
        });
      }

      if (mode === "profileCount") {
        return items.sort(function(left, right) {
          var leftCount = countMap[left.id()] || 0;
          var rightCount = countMap[right.id()] || 0;
          if (rightCount !== leftCount) {
            return rightCount - leftCount;
          }
          return compareExtensionsByName(left, right);
        });
      }

      return items.sort(compareExtensionsByName);
    });

    self.sortIsAlpha = ko.pureComputed(function() {
      return self.extSortMode() === "alpha";
    });

    self.sortIsPopular = ko.pureComputed(function() {
      return self.extSortMode() === "popular";
    });

    self.sortIsRecent = ko.pureComputed(function() {
      return self.extSortMode() === "recent";
    });

    self.sortIsProfileCount = ko.pureComputed(function() {
      return self.extSortMode() === "profileCount";
    });

    self.setSortAlpha = function() {
      self.extSortMode("alpha");
    };

    self.setSortPopular = function() {
      self.extSortMode("popular");
    };

    self.setSortRecent = function() {
      self.extSortMode("recent");
    };

    self.setSortProfileCount = function() {
      self.extSortMode("profileCount");
    };

    self.applyState = function(state) {
      var countMap = {};
      var currentName = self.current_name();
      self.opts.apply(state.options);
      self.ext.applyState(state.extensions);
      self.profiles.applyState(state.profiles);

      self.profiles.items().forEach(function(profile) {
        if (profile.reserved()) {
          return;
        }

        profile.items().forEach(function(extensionId) {
          countMap[extensionId] = (countMap[extensionId] || 0) + 1;
        });
      });

      if (currentName && self.profiles.find(currentName)) {
        self.selectByName(currentName);
      } else if (self.profiles.items().length > 0) {
        self.current_profile(self.profiles.items()[0]);
      }

      self.profileCountMap(countMap);
      document.body.className = self.bodyClass();
      self.loading(false);
      self.error("");

      self.refreshExtensionMetadata();
    };

    self.refreshExtensionMetadata = function() {
      var extensionIds;

      if (!self.shouldShowProfilesExtensionMetadata()) {
        return Promise.resolve();
      }

      extensionIds = self.ext.extensions().map(function(extension) {
        return extension.id();
      });

      if (!extensionIds.length) {
        return Promise.resolve();
      }

      return ExtensityApi.getExtensionMetadata(extensionIds).then(function(payload) {
        var metadata = payload.metadata || {};
        self.ext.extensions().forEach(function(extension) {
          if (metadata[extension.id()]) {
            extension.applyMetadata(metadata[extension.id()]);
          }
        });
      }).catch(function() {
        return null;
      });
    };

    self.refresh = function() {
      self.loading(true);
      self.busy(true);
      return ExtensityApi.getState().then(function(payload) {
        self.applyState(payload.state);
      }).catch(function(error) {
        self.error(error.message);
      }).finally(function() {
        self.busy(false);
      });
    };

    self.saveOptionPatch = function(patch) {
      var nextOptions = self.opts.toJS();
      Object.keys(patch || {}).forEach(function(key) {
        nextOptions[key] = patch[key];
      });

      self.busy(true);
      self.error("");
      return ExtensityApi.saveOptions(nextOptions).then(function(payload) {
        self.applyState(payload.state);
        return payload;
      }).catch(function(error) {
        self.error(error.message);
        throw error;
      }).finally(function() {
        self.busy(false);
      });
    };

    self.setLayoutLandscape = function() {
      if (self.layoutIsLandscape()) {
        return Promise.resolve();
      }
      return self.saveOptionPatch({ profileDisplay: "landscape" });
    };

    self.setLayoutPortrait = function() {
      if (self.layoutIsPortrait()) {
        return Promise.resolve();
      }
      return self.saveOptionPatch({ profileDisplay: "portrait" });
    };

    self.select = function(profile) {
      self.current_profile(profile);
    };

    self.selectByName = function(name) {
      var profile = self.profiles.find(name);
      if (profile) {
        self.current_profile(profile);
      }
    };

    self.selectAlwaysOn = function() {
      self.selectByName("__always_on");
    };

    self.selectFavorites = function() {
      self.selectByName("__favorites");
    };

    self.add = function() {
      var name = (self.add_name() || "").trim();
      if (!name) {
        return;
      }

      var existing = self.profiles.find(name);
      if (existing) {
        self.current_profile(existing);
        self.add_name("");
        return;
      }

      var enabledIds = self.ext.enabled().map(function(extension) {
        return extension.id();
      });
      var profile = self.profiles.add(name, enabledIds);
      self.current_profile(profile);
      self.add_name("");
    };

    self.remove = function(profile) {
      var isCurrent = profile === self.current_profile();
      if (!window.confirm("Are you sure you want to remove this profile?")) {
        return;
      }

      self.profiles.remove(profile);
      if (isCurrent) {
        self.current_profile(self.profiles.items()[0] || null);
      }
    };

    self.bulkDelete = function() {
      if (!self.selectedCount()) {
        return;
      }

      if (!window.confirm("Delete the selected profiles?")) {
        return;
      }

      var currentName = self.current_name();
      self.profiles.items.remove(function(profile) {
        return profile.selected() && !profile.reserved();
      });

      if (!self.profiles.find(currentName)) {
        self.current_profile(self.profiles.items()[0] || null);
      }
    };

    self.toggleAll = function() {
      if (!self.current_profile()) {
        return;
      }

      self.current_profile().items(self.ext.extensions().map(function(extension) {
        return extension.id();
      }));
    };

    self.toggleNone = function() {
      if (!self.current_profile()) {
        return;
      }

      self.current_profile().items([]);
    };

    self.save = function() {
      self.busy(true);
      ExtensityStorage.saveProfiles(self.profiles.toMap()).then(function() {
        fadeOutMessage("save-result");
        return self.refresh();
      }).catch(function(error) {
        self.error(error.message);
      }).finally(function() {
        self.busy(false);
      });
    };

    self.close = function() {
      window.close();
    };
  }

  _.defer(function() {
    var vm = new ProfilesViewModel();
    ko.bindingProvider.instance = new ko.secureBindingsProvider({});
    ko.applyBindings(vm, document.getElementById("profiles-page"));
    (new DismissalsCollection()).dismiss("profile_page_viewed");
    vm.refresh();
  });
});
