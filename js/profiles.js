document.addEventListener("DOMContentLoaded", function() {
  function ProfilesViewModel() {
    var self = this;
    self.loading = ko.observable(true);
    self.busy = ko.observable(false);
    self.error = ko.observable("");
    self.opts = new OptionsCollection();
    self.ext = new ExtensionCollectionModel();
    self.profiles = new ProfileCollectionModel();
    self.current_profile = ko.observable(null);
    self.add_name = ko.observable("");

    self.current_name = ko.pureComputed(function() {
      return self.current_profile() ? self.current_profile().name() : null;
    });

    self.editable = ko.pureComputed(function() {
      return !!self.current_profile();
    });

    self.layoutClass = ko.pureComputed(function() {
      return self.opts.profileDisplay() === "portrait" ? "profiles-portrait" : "profiles-landscape";
    });

    self.selectedCount = ko.pureComputed(function() {
      return self.profiles.items().filter(function(profile) {
        return profile.selected() && !profile.reserved();
      }).length;
    });

    self.applyState = function(state) {
      var currentName = self.current_name();
      self.opts.apply(state.options);
      self.ext.applyState(state.extensions);
      self.profiles.applyState(state.profiles);

      if (currentName && self.profiles.find(currentName)) {
        self.selectByName(currentName);
      } else if (self.profiles.items().length > 0) {
        self.current_profile(self.profiles.items()[0]);
      }

      document.body.className = self.layoutClass();
      self.loading(false);
      self.error("");
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
