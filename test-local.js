const fs = require('fs');

function fixStorageJS2() {
  const file = 'js/storage.js';
  let content = fs.readFileSync(file, 'utf8');

  content = content.replace(
    'return Object.keys(normalized).sort(function(left, right) {\n      return sortProfileName(left).localeCompare(sortProfileName(right));\n    })',
    'return Object.keys(normalized).sort(function(left, right) {\n      return sortProfileName(left).localeCompare(sortProfileName(right));\n    })'
  );

  fs.writeFileSync(file, content);
}

fixStorageJS2();
