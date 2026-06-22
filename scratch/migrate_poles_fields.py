import os
import sqlite3
import zipfile
import shutil
import xml.etree.ElementTree as ET
import re

gpkg_path = 'QGIS Project Template/SLT_Poles.gpkg'
qgz_path = 'QGIS Project Template/QGIS.qgz'

field_renames = {
    "PL_Number": "pl_number",
    "LEA": "lea",
    "POLE TYPE": "pole_type",
    "POLE MAKE": "pole_make",
    "ROAD NAME": "road_name",
    "SIDE": "side",
    "DP COUNT": "dp_count",
    "FDP COUNT": "fdp_count",
    "NUMBER OF RISERS": "number_of_risers",
    "NO OF DROP WIRES(COPPER)": "drop_wires_copper",
    "NO OF DROP WIRES(FIBER)": "drop_wires_fiber",
    "ADJACENT PREVIOUS": "adjacent_previous",
    "POWER ENCLOSURE": "power_enclosure",
    "MOUNTED MSAN": "mounted_msan",
    "RISER PIPE": "riser_pipe",
    "STAYS": "stays",
    "STRUT": "strut",
    "OVERHEAD GUY": "overhead_guy",
    "BARBED": "barbed",
    "POLE HEIGHT": "pole_height",
    "REMARK": "remark",
    "JOINT": "joint",
    "LAC": "lac",
    "Exist_New": "exist_new",
    "Longitute": "longitude",
    "Latitude": "latitude",
    "Photo": "photo",
    "CONDITION": "condition",
    "DAMAGE_DESC": "damage_desc"
}

# 1. Migrate GPKG Database columns
print(f"Migrating GeoPackage database: {gpkg_path}")
if os.path.exists(gpkg_path):
    conn = sqlite3.connect(gpkg_path)
    cur = conn.cursor()
    
    # Check current columns in SLT_Poles
    cur.execute('PRAGMA table_info("SLT_Poles")')
    current_cols = [c[1] for c in cur.fetchall()]
    print(f"Current columns in SLT_Poles: {current_cols}")
    
    for old_name, new_name in field_renames.items():
        if old_name in current_cols and new_name not in current_cols:
            try:
                cur.execute(f'ALTER TABLE SLT_Poles RENAME COLUMN "{old_name}" TO "{new_name}"')
                print(f"  ✅ Renamed column '{old_name}' to '{new_name}' in SLT_Poles table.")
            except Exception as e:
                print(f"  ❌ Error renaming '{old_name}': {e}")
        elif old_name not in current_cols:
            print(f"  ℹ️ Column '{old_name}' not found (already renamed or doesn't exist).")
            
    conn.commit()
    conn.close()
else:
    print(f"Warning: {gpkg_path} does not exist!")

# 2. Migrate QGIS project configuration
print(f"\nMigrating QGIS project: {qgz_path}")
if os.path.exists(qgz_path):
    temp_dir = qgz_path + '_migrate_temp'
    os.makedirs(temp_dir, exist_ok=True)
    
    try:
        with zipfile.ZipFile(qgz_path, 'r') as z:
            z.extractall(temp_dir)
            
        qgs_files = [f for f in os.listdir(temp_dir) if f.endswith('.qgs')]
        if not qgs_files:
            print("Error: No .qgs file found inside .qgz archive.")
            exit(1)
            
        qgs_file_path = os.path.join(temp_dir, qgs_files[0])
        
        # Parse XML
        tree = ET.parse(qgs_file_path)
        root = tree.getroot()
        
        # Find maplayer with layername SLT_Poles
        slt_poles_layer = None
        for layer in root.findall('.//maplayer'):
            name_elem = layer.find('layername')
            if name_elem is not None and name_elem.text == 'SLT_Poles':
                slt_poles_layer = layer
                break
                
        if slt_poles_layer is not None:
            print("Found 'SLT_Poles' layer in QGIS project. Renaming XML attributes and references...")
            
            # Helper to recursively update element attributes and text
            def update_element(elem):
                # Update attributes
                for attr, val in list(elem.attrib.items()):
                    # Exact matches
                    if val in field_renames:
                        elem.set(attr, field_renames[val])
                    else:
                        # Partial matches in expressions (e.g. "PL_Number" -> "pl_number")
                        # Handle quoted field names like "ROAD NAME" -> "road_name"
                        new_val = val
                        for old_f, new_f in field_renames.items():
                            # Replace occurrences wrapped in quotes or brackets or as standalones
                            new_val = new_val.replace(f'"{old_f}"', f'"{new_f}"')
                            new_val = new_val.replace(f"'{old_f}'", f"'{new_f}'")
                            # QGIS XML entity quotes
                            new_val = new_val.replace(f'&quot;{old_f}&quot;', f'&quot;{new_f}&quot;')
                            
                        if new_val != val:
                            elem.set(attr, new_val)
                            
                # Update text
                if elem.text:
                    orig_text = elem.text
                    new_text = orig_text
                    # Check exact match
                    if orig_text in field_renames:
                        new_text = field_renames[orig_text]
                    else:
                        for old_f, new_f in field_renames.items():
                            new_text = new_text.replace(f'"{old_f}"', f'"{new_f}"')
                            new_text = new_text.replace(f"'{old_f}'", f"'{new_f}'")
                            new_text = new_text.replace(f'&quot;{old_f}&quot;', f'&quot;{new_f}&quot;')
                            # Standalone replacements in text (safely for specific long text fields)
                            if old_f in ["POLE TYPE", "POLE MAKE", "ROAD NAME", "DP COUNT", "FDP COUNT", "NUMBER OF RISERS", "NO OF DROP WIRES(COPPER)", "NO OF DROP WIRES(FIBER)", "POLE HEIGHT", "ADJACENT PREVIOUS", "POWER ENCLOSURE", "MOUNTED MSAN", "RISER PIPE", "OVERHEAD GUY"]:
                                new_text = new_text.replace(old_f, new_f)
                                
                    if new_text != orig_text:
                        elem.text = new_text
                        
                # Recurse
                for child in elem:
                    update_element(child)
                    
            update_element(slt_poles_layer)
            
            # Write XML back
            tree.write(qgs_file_path, encoding='utf-8', xml_declaration=True)
            print("Successfully updated QGIS.qgs XML layer properties.")
            
            # Repackage into QGIS.qgz
            with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as z:
                for root_dir, _, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root_dir, file)
                        arcname = os.path.relpath(file_path, temp_dir)
                        z.write(file_path, arcname)
            print(f"Successfully repackaged {qgz_path}")
            
        else:
            print("Error: 'SLT_Poles' layer not found in QGIS project XML!")
            
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
else:
    print(f"Warning: {qgz_path} does not exist!")
