#!/usr/bin/env python3
"""Create spatial indexes on all GeoPackage files for QField compatibility."""
import sqlite3
import os
import glob

gpkg_dir = 'QGIS Project Template/GeoPackage'
gpkg_files = glob.glob(os.path.join(gpkg_dir, 'SLT_*.gpkg'))

print(f'Found {len(gpkg_files)} GeoPackage files')

for gpkg_path in gpkg_files:
    name = os.path.basename(gpkg_path)
    print(f'\n--- Processing: {name} ---')
    
    conn = sqlite3.connect(gpkg_path)
    cur = conn.cursor()
    
    # Check if gpkg_extensions table exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='gpkg_extensions'")
    has_ext = cur.fetchone()
    
    if not has_ext:
        print('  Creating gpkg_extensions table...')
        cur.execute('''
            CREATE TABLE IF NOT EXISTS gpkg_extensions (
                table_name TEXT,
                column_name TEXT,
                extension_name TEXT NOT NULL,
                definition TEXT NOT NULL,
                scope TEXT NOT NULL
            )
        ''')
    
    # Get user data table names
    cur.execute("SELECT table_name FROM gpkg_contents WHERE data_type = 'features'")
    tables = [r[0] for r in cur.fetchall()]
    
    for table_name in tables:
        print(f'  Table: {table_name}')
        
        # Check if spatial index already exists
        idx_table = f'rtree_{table_name}_geom'
        cur.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{idx_table}'")
        if cur.fetchone():
            print(f'    Spatial index {idx_table} already exists')
        else:
            # Get geometry column name
            cur.execute(f"SELECT column_name FROM gpkg_geometry_columns WHERE table_name = '{table_name}'")
            geom_col = cur.fetchone()
            if geom_col:
                geom_col = geom_col[0]
                print(f'    Creating spatial index on {geom_col}...')
                cur.execute(f'''
                    CREATE VIRTUAL TABLE "{idx_table}" USING rtree(id, minx, maxx, miny, maxy)
                ''')
                conn.commit()
                print(f'    Created {idx_table}')
        
        # Register extension
        ext_name = f'gpkg_rtree_index'
        cur.execute(f"""
            INSERT OR REPLACE INTO gpkg_extensions (table_name, column_name, extension_name, definition, scope)
            VALUES ('{table_name}', 'geom', '{ext_name}', 'http://www.geopackage.org/spec121/index.html#extension_rtree', 'write-only')
        """)
        conn.commit()
        print(f'    Registered rtree index extension')
    
    conn.close()

print('\n=== DONE ===')
print(f'All {len(gpkg_files)} GeoPackage files have spatial indexes.')