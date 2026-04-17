import os

with open('profiles.html', 'rb') as f:
    content = f.read().decode('utf-8')

replacements = [
    (
        '<button type="button" class="compact-action-button" data-sbind="click: toggleFn, clickBubble: false, css:{active: active}">\r\n                    <i class="fa" data-sbind="attr:{class: \'fa \' + icon}"></i> <span data-sbind="text: label"></span>\r\n                  </button>',
        '<button type="button" class="compact-action-button" data-sbind="click: toggleFn, clickBubble: false, css:{active: active}">\r\n                    <i class="fa" data-sbind="attr:{class: \'fa \' + icon}" aria-hidden="true"></i> <span data-sbind="text: label"></span>\r\n                  </button>'
    ),
    (
        '<i class="fa fa-chevron-right extension-chevron" data-sbind="css:{expanded: $parent.expandedExtensionId() == id()}"></i>',
        '<i class="fa fa-chevron-right extension-chevron" data-sbind="css:{expanded: $parent.expandedExtensionId() == id()}" aria-hidden="true"></i>'
    )
]

for search, replace in replacements:
    if search in content:
        content = content.replace(search, replace)
    elif search.replace('\r\n', '\n') in content:
        content = content.replace(search.replace('\r\n', '\n'), replace.replace('\r\n', '\n'))
    else:
        print(f"Could not find:\n{search}")

with open('profiles.html', 'wb') as f:
    f.write(content.encode('utf-8'))
