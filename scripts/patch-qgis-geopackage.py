#!/usr/bin/env python3
"""
Patch QGIS.qgs to switch all layers from GeoJSON to GeoPackage.
This fixes the read-only lock issue in QField.
"""
import re
import sys
import os

def patch_qgs(input_path, output_path):
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Collect all layer name mappings from existing datasource tags
    layer_mappings = {}
    
    # Find all GeoJSON datasource references in maplayer sections
    datasource_pattern = re.compile(
        r'<datasource>\./GeoJSON/(SLT_\w+)\.geojson</datasource>'
    )
    for m in datasource_pattern.finditer(content):
        layer_name = m.group(1)
        layer_mappings[layer_name] = True
        print(f'  Found layer: {layer_name}')
    
    print(f'\nTotal layers to patch: {len(layer_mappings)}')
    
    # Patch 1: Change datasource in <maplayer> sections
    content = re.sub(
        r'<datasource>\./GeoJSON/(SLT_\w+)\.geojson</datasource>',
        r'<datasource>./GeoPackage/\1.gpkg|layername=\1</datasource>',
        content
    )
    
    # Patch 2: Change source in <layer-tree-layer> sections
    content = re.sub(
        r'source="\./GeoJSON/(SLT_\w+)\.geojson"',
        r'source="./GeoPackage/\1.gpkg|layername=\1"',
        content
    )
    
    # Patch 3: Change transaction mode from Disabled to AutomaticBuffered
    content = content.replace(
        '<transaction mode="Disabled"/>',
        '<transaction mode="AutomaticBuffered"/>'
    )
    
    # Patch 4: Update customproperties for each maplayer
    # Find all customproperties blocks within maplayer sections that have QFieldSync/action
    old_custom_props = '''<customproperties>
        <Option/>
        <property key="QFieldSync/action" value="offline"/>
      </customproperties>'''
    
    new_custom_props = '''<customproperties>
        <Option/>
        <property key="QFieldSync/action" value="copy"/>
        <property key="QFieldSync/is_geometry_locked" value="0"/>
      </customproperties>'''
    
    content = content.replace(old_custom_props, new_custom_props)
    
    # Also handle case where there might be no QFieldSync/action property at all
    # (some customproperties blocks only have <Option/>)
    # We need to find maplayer customproperties that only have <Option/> and add the properties
    
    # Count changes
    geojson_remaining = content.count('./GeoJSON/')
    geoPKG_count = content.count('./GeoPackage/')
    offline_remaining = content.count('"offline"')
    copy_count = content.count('"copy"')
    geometry_locked_count = content.count('is_geometry_locked')
    transaction_mode = 'AutomaticBuffered' if 'AutomaticBuffered' in content else 'Not changed'
    
    print(f'\nVerification:')
    print(f'  GeoJSON references remaining: {geojson_remaining} (should be 0)')
    print(f'  GeoPackage references found: {geoPKG_count}')
    print(f'  QFieldSync old "offline" remaining: {offline_remaining} (should be 0)')
    print(f'  QFieldSync "copy" count: {copy_count}')
    print(f'  geometry_locked count: {geometry_locked_count}')
    print(f'  Transaction mode: {transaction_mode}')
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'\nPatched file written to: {output_path}')

if __name__ == '__main__':
    input_file = sys.argv[1] if len(sys.argv) > 1 else 'QGIS Project Template/QGIS.qgs~'
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'QGIS Project Template/QGIS.qgs'
    patch_qgs(input_file, output_file)