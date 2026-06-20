#!/usr/bin/env python3
"""Fix remaining customproperties blocks with 'offline' values."""
import re

content = open('QGIS Project Template/QGIS.qgs', 'r', encoding='utf-8').read()

# Fix: change "offline" to "copy" in all remaining places
content = content.replace(
    '<Option type="QString" name="QFieldSync/action" value="offline"/>',
    '<Option type="QString" name="QFieldSync/action" value="copy"/>'
)

# Also fix any plain property tags still with offline
content = content.replace(
    '<property key="QFieldSync/action" value="offline"/>',
    '<property key="QFieldSync/action" value="copy"/>'
)

# Add geometry_locked where missing (after QFieldSync/action property)
# Pattern: has QFieldSync/action but no is_geometry_locked
# We need to add is_geometry_locked after QFieldSync/action if not present
content = re.sub(
    r'(<property key="QFieldSync/action" value="copy"/>)\n(?!\s*<property key="QFieldSync/is_geometry_locked")',
    r'\1\n        <property key="QFieldSync/is_geometry_locked" value="0"/>',
    content
)

# Count final state
offline_count = content.count('"offline"')
copy_count = content.count('"copy"')
locked_count = content.count('is_geometry_locked')

print(f'Remaining "offline": {offline_count}')
print(f'"copy" count: {copy_count}')
print(f'is_geometry_locked count: {locked_count}')

with open('QGIS Project Template/QGIS.qgs', 'w', encoding='utf-8') as f:
    f.write(content)

print('File updated successfully.')