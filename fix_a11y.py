import os

with open('index.html', 'rb') as f:
    content = f.read().decode('utf-8')

replacements = [
    (
        '<button type="button" class="table-row-chevron" title="Show extension actions" data-sbind="click: toggleTableRowAction, clickBubble: false, css:{expanded: rowExpanded}">\r\n        <i class="fa fa-chevron-left"></i>\r\n      </button>',
        '<button type="button" class="table-row-chevron" title="Show extension actions" aria-label="Show extension actions" data-sbind="click: toggleTableRowAction, clickBubble: false, css:{expanded: rowExpanded}">\r\n        <i class="fa fa-chevron-left" aria-hidden="true"></i>\r\n      </button>'
    ),
    (
        '<button type="button" class="action-icon-button" title="Toggle enable/disable" data-sbind="click: toggleCompactAction, clickBubble: false">\r\n            <i class="fa" data-sbind="css: toggleIconClass"></i>\r\n          </button>',
        '<button type="button" class="action-icon-button" title="Toggle enable/disable" aria-label="Toggle enable/disable" data-sbind="click: toggleCompactAction, clickBubble: false">\r\n            <i class="fa" data-sbind="css: toggleIconClass" aria-hidden="true"></i>\r\n          </button>'
    ),
    (
        '<button type="button" class="compact-row-chevron" title="Show extension actions" data-sbind="click: toggleCompactRowAction, clickBubble: false, css:{expanded: rowExpanded}">\r\n          <i class="fa fa-chevron-down"></i>\r\n        </button>',
        '<button type="button" class="compact-row-chevron" title="Show extension actions" aria-label="Show extension actions" data-sbind="click: toggleCompactRowAction, clickBubble: false, css:{expanded: rowExpanded}">\r\n          <i class="fa fa-chevron-down" aria-hidden="true"></i>\r\n        </button>'
    )
]

for search, replace in replacements:
    if search in content:
        content = content.replace(search, replace)
    elif search.replace('\r\n', '\n') in content:
        content = content.replace(search.replace('\r\n', '\n'), replace.replace('\r\n', '\n'))
    else:
        print(f"Could not find:\n{search}")

with open('index.html', 'wb') as f:
    f.write(content.encode('utf-8'))
