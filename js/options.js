document.addEventListener("DOMContentLoaded", function() {
  function formatTimestamp(timestamp) {
    if (!timestamp) {
      return "Not synced yet";
    }
    return new Date(timestamp).toLocaleString();
  }

  function OptionsViewModel() {
    var self = this;
    self.loading = ko.observable(true);
    self.busy = ko.observable(false);
    self.error = ko.observable("");
    self.message = ko.observable("");
    self.options = new OptionsCollection();

    self.lastDriveSyncLabel = ko.pureComputed(function() {
      return formatTimestamp(self.options.lastDriveSync());
    });

    self.applyState = function(state) {
      self.options.apply(state.options);
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

    self.save = function() {
      self.performAction(ExtensityApi.saveOptions(self.options.toJS())).then(function() {
        self.message("Saved!");
        fadeOutMessage("save-result");
      });
    };

    self.close = function() {
      window.close();
    };

    self.openDashboard = function() {
      self.performAction(ExtensityApi.openDashboard());
    };

    self.openShortcutSettings = function() {
      chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
    };

    self.exportJson = function() {
      self.performAction(ExtensityApi.exportBackup()).then(function(payload) {
        ExtensityIO.downloadText(
          "extensity-backup.json",
          JSON.stringify(payload.envelope, null, 2),
          "application/json;charset=utf-8"
        );
      });
    };

    self.exportCsv = function() {
      self.performAction(ExtensityApi.getState()).then(function(payload) {
        var csv = ExtensityImportExport.buildExtensionsCsv(payload.state.extensions);
        ExtensityIO.downloadText("extensity-extensions.csv", csv, "text/csv;charset=utf-8");
      });
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
        fadeOutMessage("save-result");
      }).catch(function(error) {
        self.error(error.message);
      }).finally(function() {
        self.busy(false);
        event.target.value = "";
      });
    };

    self.syncDrive = function() {
      self.performAction(ExtensityApi.syncDrive()).then(function() {
        self.message("Drive sync completed.");
      }).catch(function() {});
    };
  }

  _.defer(function() {
    var vm = new OptionsViewModel();
    ko.bindingProvider.instance = new ko.secureBindingsProvider({});
    ko.applyBindings(vm, document.getElementById("options-page"));
    vm.refresh();
  });
});
