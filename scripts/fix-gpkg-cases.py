#!/usr/bin/env python3
"""
Align QGIS layer names in the datasource attributes with the actual physical table names in the GeoPackages.
Specifically, if SLT_TP.gpkg has table name slt_tp, replace layername=SLT_TP with layername=slt_tp.
"""
import sqlite3
import glob
import os
import re

def main():
    qgs_path = 'QGIS Project Template/QGIS.qgs'
    gpkg_dir = 'QGIS Project Template/GeoPackage'
    
    if not os.path.exists(qgs_path):
        print(f"Error: {qgs_path} does not exist.")
        return

    print("Checking GeoPackages for actual table names...")
    mappings = {}
    for path in glob.glob(os.path.join(gpkg_dir, 'SLT_*.gpkg')):
        filename = os.path.basename(path)
        base_name = os.path.splitext(filename)[0] # e.g. SLT_TP or SLT_Cables
        
        conn = sqlite3.connect(path)
        cur = conn.cursor()
        try:
            cur.execute("SELECT table_name FROM gpkg_contents")
            rows = cur.fetchall()
            if rows:
                actual_table = rows[0][0]
                mappings[base_name] = actual_table
                print(f"  {base_name}.gpkg -> table: {actual_table}")
            else:
                print(f"  Warning: No layers in gpkg_contents for {filename}")
        except Exception as e:
            print(f"  Error reading {filename}: {e}")
        finally:
            conn.close()
            
    print("\nReading QGIS.qgs...")
    with open(qgs_path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    print("\nReplacing layer names in QGIS.qgs...")
    replacements_made = 0
    for base_name, actual_table in mappings.items():
        # Look for e.g. SLT_TP.gpkg|layername=SLT_TP and replace with SLT_TP.gpkg|layername=slt_tp
        # We need to find both source="..." and <datasource>...</datasource>
        
        # Escape for regex safety
        pattern_str = re.escape(base_name) + r'\.gpkg\|layername=' + r'[^"|<]+'
        pattern = re.compile(pattern_str, re.IGNORECASE)
        
        # Let's find all occurrences
        matches = pattern.findall(content)
        if matches:
            print(f"  Found matches for {base_name}: {matches}")
            
        # Perform replacement
        # Target format: BaseName.gpkg|layername=actual_table
        target_str = f"{base_name}.gpkg|layername={actual_table}"
        
        # Define replace function or use sub
        new_content, count = re.subn(
            re.escape(base_name) + r'\.gpkg\|layername=[^"|<]+',
            target_str,
            content,
            flags=re.IGNORECASE
        )
        if count > 0:
            content = new_content
            replacements_made += count
            print(f"    Replaced {count} occurrences with '{target_str}'")

    if replacements_made > 0:
        print(f"\nWriting updated QGIS.qgs (Total replacements: {replacements_made})...")
        with open(qgs_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Done!")
    else:
        print("\nNo replacements were needed.")

if __name__ == '__main__':
    main()