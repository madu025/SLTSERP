import os
import sqlite3
import zipfile
import shutil
import xml.etree.ElementTree as ET
import json

gpkg_renames_path = 'scratch/all_gpkg_renames.json'
template_dir = 'QGIS Project Template'
qgz_path = os.path.join(template_dir, 'QGIS.qgz')

if not os.path.exists(gpkg_renames_path):
    print(f"Error: {gpkg_renames_path} not found. Run generate_all_snakecase_mappings.py first.")
    exit(1)

with open(gpkg_renames_path, 'r', encoding='utf-8') as f:
    renames_config = json.load(f)

# 1. Migrate all GPKGs
print("=== Phase 1: Migrating GPKG Databases ===")
for gpkg_file, tables in renames_config.items():
    gpkg_path = os.path.join(template_dir, gpkg_file)
    if not os.path.exists(gpkg_path):
        print(f"Warning: {gpkg_path} not found. Skipping database migration for this file.")
        continue
        
    print(f"Migrating GeoPackage: {gpkg_file}")
    conn = sqlite3.connect(gpkg_path)
    cur = conn.cursor()
    
    for table_name, field_map in tables.items():
        # Get current columns
        cur.execute(f'PRAGMA table_info("{table_name}")')
        current_cols = [c[1] for c in cur.fetchall()]
        
        for old_col, new_col in field_map.items():
            if old_col in current_cols and new_col not in current_cols:
                try:
                    cur.execute(f'ALTER TABLE "{table_name}" RENAME COLUMN "{old_col}" TO "{new_col}"')
                    print(f"  ✅ Renamed '{table_name}'.'{old_col}' -> '{new_col}'")
                except Exception as e:
                    print(f"  ❌ Failed to rename '{table_name}'.'{old_col}': {e}")
            elif old_col not in current_cols and new_col in current_cols:
                print(f"  ℹ️ '{table_name}'.'{old_col}' already renamed to '{new_col}'")
                
    conn.commit()
    conn.close()

# 2. Migrate QGIS.qgz
print("\n=== Phase 2: Migrating QGIS Project File ===")
if os.path.exists(qgz_path):
    temp_dir = qgz_path + '_migrate_all_temp'
    os.makedirs(temp_dir, exist_ok=True)
    
    try:
        with zipfile.ZipFile(qgz_path, 'r') as z:
            z.extractall(temp_dir)
            
        qgs_files = [f for f in os.listdir(temp_dir) if f.endswith('.qgs')]
        if not qgs_files:
            print("Error: No .qgs file found inside QGIS.qgz.")
            exit(1)
            
        qgs_file_path = os.path.join(temp_dir, qgs_files[0])
        tree = ET.parse(qgs_file_path)
        root = tree.getroot()
        
        # Flatten the renames config by table/layer name for easier lookup
        layer_renames = {}
        for gpkg_file, tables in renames_config.items():
            for table_name, field_map in tables.items():
                layer_renames[table_name] = field_map
                
        # Traverse maplayers
        for layer in root.findall('.//maplayer'):
            name_elem = layer.find('layername')
            if name_elem is None or name_elem.text not in layer_renames:
                continue
                
            layer_name = name_elem.text
            field_map = layer_renames[layer_name]
            print(f"Updating XML references for layer: {layer_name}")
            
            # Helper to recursively update element attributes and text
            def update_layer_elements(elem):
                # Update attributes
                for attr, val in list(elem.attrib.items()):
                    if val in field_map:
                        elem.set(attr, field_map[val])
                    else:
                        new_val = val
                        for old_f, new_f in field_map.items():
                            new_val = new_val.replace(f'"{old_f}"', f'"{new_f}"')
                            new_val = new_val.replace(f"'{old_f}'", f"'{new_f}'")
                            new_val = new_val.replace(f'&quot;{old_f}&quot;', f'&quot;{new_f}&quot;')
                        if new_val != val:
                            elem.set(attr, new_val)
                            
                # Update text
                if elem.text:
                    orig_text = elem.text
                    new_text = orig_text
                    if orig_text in field_map:
                        new_text = field_map[orig_text]
                    else:
                        for old_f, new_f in field_map.items():
                            new_text = new_text.replace(f'"{old_f}"', f'"{new_f}"')
                            new_text = new_text.replace(f"'{old_f}'", f"'{new_f}'")
                            new_text = new_text.replace(f'&quot;{old_f}&quot;', f'&quot;{new_f}&quot;')
                            # Replace standalone strings in text node if it matches specific key fields
                            if len(old_f) > 3 and old_f in orig_text:
                                new_text = new_text.replace(old_f, new_f)
                    if new_text != orig_text:
                        elem.text = new_text
                        
                for child in elem:
                    update_layer_elements(child)
                    
            update_layer_elements(layer)
            
        # Write XML back
        tree.write(qgs_file_path, encoding='utf-8', xml_declaration=True)
        print("Successfully updated QGIS.qgs XML layer properties for all layers.")
        
        # Repackage QGIS.qgz
        with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as z:
            for root_dir, _, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root_dir, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    z.write(file_path, arcname)
        print(f"Successfully repackaged {qgz_path}")
        
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
else:
    print(f"Error: {qgz_path} not found.")
