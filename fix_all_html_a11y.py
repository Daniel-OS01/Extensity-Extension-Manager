import os
import re

files = ['index.html', 'profiles.html', 'dashboard.html', 'options.html']

for filename in files:
    if not os.path.exists(filename):
        continue
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()

    # Simple regex replacing to ensure all <i class="fa ..."> tags have aria-hidden="true"
    # except when they already have it.

    def add_aria_hidden(match):
        tag = match.group(0)
        if 'aria-hidden' not in tag:
            # We want to add aria-hidden="true" just before the closing >
            return tag[:-1] + ' aria-hidden="true">'
        return tag

    new_content = re.sub(r'<i\s+[^>]*class="fa[^>]*>', add_aria_hidden, content)

    if content != new_content:
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filename}")
