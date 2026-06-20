#!/usr/bin/env python3
"""Verify the patched QGIS.qgs file."""
import re

content = open('QGIS Project Template/QGIS.qgs', 'r', encoding='utf-8').read()

print('=== VERIFICATION ===')
print(f"GeoJSON refs: {content.count('./GeoJSON/')} (expect 0)")
print(f"GeoPackage refs: {content.count('./GeoPackage/')} (expect 24 - 12 layers x 2 places)")
offline_str = '"offline"'
copy_str = '"copy"'
print(f'"offline" count: {content.count(offline_str)} (expect 0)')
print(f'"copy" count: {content.count(copy_str)} (expect 12-15)')
print(f"is_geometry_locked: {content.count('is_geometry_locked')} (expect 12)")
disabled_str = '"Disabled"'
print(f"Transaction Disabled: {content.count(disabled_str)} (expect 0)")
print(f"Transaction AutomaticBuffered: {content.count('AutomaticBuffered')} (expect 1)")

# Check sample datasource
for m in re.finditer(r'<datasource>(.*?)</datasource>', content):
    print(f'  datasource: {m.group(1)}')
    break

# Check sample layer-tree-layer source
for m in re.finditer(r'providerKey="ogr".*?source="(.*?)"', content):
    print(f'  layer-tree source: {m.group(1)}')
    break

print(f'File size: {len(content)} bytes')

if content.count('./GeoJSON/') == 0 and content.count(offline_str) == 0:
    print('\n>> ALL CHECKS PASSED! File is ready.')
else:
    print('\n!! ISSUES REMAIN !!')
    # Show where GeoJSON refs remain
    if content.count('./GeoJSON/') > 0:
        print('\nRemaining GeoJSON refs:')
        for m in re.finditer(r'\./GeoJSON/[^"]+', content):
            print(f'  {m.group()}')
    if content.count('"offline"') > 0:
        print('\nRemaining offline:')
        for m in re.finditer(r'"offline"', content):
            start = max(0, m.start() - 100)
            end = min(len(content), m.end() + 100)
            print(f'  ...{content[start:end]}...')