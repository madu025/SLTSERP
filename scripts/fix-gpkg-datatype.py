#!/usr/bin/env python3
"""Fix gpkg_contents data_type from 'attributes' to 'features'."""
import sqlite3
import glob

for f in glob.glob('QGIS Project Template/GeoPackage/SLT_*.gpkg'):
    conn = sqlite3.connect(f)
    cur = conn.cursor()
    cur.execute("SELECT table_name, data_type FROM gpkg_contents")
    rows = cur.fetchall()
    for row in rows:
        if row[1] != 'features':
            cur.execute(f"UPDATE gpkg_contents SET data_type='features' WHERE table_name='{row[0]}'")
            conn.commit()
            print(f'Fixed: {f} -> {row[0]} (was {row[1]})')
        else:
            print(f'OK: {f} -> {row[0]}')
    conn.close()

print('Done!')