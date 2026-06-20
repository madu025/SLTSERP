#!/usr/bin/env python3
"""Verify the patched QGIS.qgz archive content."""
import zipfile
import re

with zipfile.ZipFile('QGIS Project Template/QGIS.qgz', 'r') as zf:
    content = zf.read('QGIS.qgs').decode('utf-8')

offline_str = '"offline"'
copy_str = '"copy"'

print('=== PATCH VERIFICATION (from .qgz archive) ===')
print(f"GeoJSON refs: {content.count('./GeoJSON/')} (expect 0)")
print(f"GeoPackage refs: {content.count('./GeoPackage/')} (expect 24)")
print(f'"offline" count: {content.count(offline_str)} (expect 0)')
print(f'"copy" count: {content.count(copy_str)} (expect 12-15)')
print(f"is_geometry_locked: {content.count('is_geometry_locked')} (expect 12)")
print(f"AutomaticBuffered: {'YES' if 'AutomaticBuffered' in content else 'NO'} (expect YES)")

# Sample datasource from maplayer
for m in re.finditer(r'<datasource>(.*?)</datasource>', content):
    print(f'  datasource: {m.group(1)}')
    break

# Sample layer-tree source
for m in re.finditer(r'providerKey="ogr".*?source="(.*?)"', content):
    print(f'  layer-tree source: {m.group(1)}')
    break

# Transaction mode
m = re.search(r'<transaction mode="([^"]+)"', content)
print(f'  transaction mode: {m.group(1) if m else "NOT FOUND"}')

all_pass = True
if content.count('./GeoJSON/') != 0:
    print('\nFAIL: GeoJSON refs still present!')
    all_pass = False
if content.count(offline_str) != 0:
    print('\nFAIL: "offline" still present!')
    all_pass = False
if 'AutomaticBuffered' not in content:
    print('\nFAIL: Transaction mode not changed!')
    all_pass = False

if all_pass:
    print('\n>> ALL CHECKS PASSED! Project is ready for QField.')
    print('\nHow to test:')
    print('1. Open QGIS Desktop')
    print('2. Open QGIS Project Template/QGIS.qgz')
    print('3. Right-click any SLT_ layer -> Toggle Editing')
    print('4. Verify pencil icon appears (editable)')
    print('5. Upload to QFieldCloud and test in QField mobile app')