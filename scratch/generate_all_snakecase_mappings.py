import os
import sqlite3
import re
import json

template_dir = 'QGIS Project Template'
gpkgs = [f for f in os.listdir(template_dir) if f.endswith('.gpkg')]

def clean_name(name):
    if name.lower() in ['fid', 'geom']:
        return name
    # Replace spaces, hyphens, brackets, special chars with underscores
    s = re.sub(r'[\s\-()\\/\[\]]+', '_', name.strip())
    # Remove consecutive underscores
    s = re.sub(r'_+', '_', s)
    # Strip leading/trailing underscores
    s = s.strip('_')
    # Convert to lowercase
    s = s.lower()
    # Fix typo 'longitute' -> 'longitude'
    if s == 'longitute':
        s = 'longitude'
    return s

all_mappings = {}

for gpkg in gpkgs:
    path = os.path.join(template_dir, gpkg)
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    
    gpkg_mapping = {}
    
    for t in tables:
        if t.startswith('gpkg_') or t == 'sqlite_sequence' or 'rtree_' in t:
            continue
        cur.execute(f'PRAGMA table_info("{t}")')
        cols = cur.fetchall()
        
        table_mapping = {}
        for c in cols:
            col_name = c[1]
            cleaned = clean_name(col_name)
            if col_name != cleaned:
                table_mapping[col_name] = cleaned
                
        if table_mapping:
            gpkg_mapping[t] = table_mapping
            
    if gpkg_mapping:
        all_mappings[gpkg] = gpkg_mapping
    conn.close()

# Save mappings
output_file = 'scratch/all_gpkg_renames.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(all_mappings, f, indent=2)

print(f"Generated mappings for {len(all_mappings)} GeoPackages. Saved to {output_file}")
print("Sample of mappings:")
print(json.dumps(all_mappings, indent=2)[:1000] + "...\n(truncated)")
