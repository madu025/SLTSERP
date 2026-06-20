#!/usr/bin/env python3
"""Inspect all GeoPackage files in the template directory to list their tables and structures."""
import sqlite3
import glob
import os

print("=== GPKG INSPECTION ===")
for path in glob.glob('QGIS Project Template/GeoPackage/SLT_*.gpkg'):
    name = os.path.basename(path)
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    
    # Get user tables registered in gpkg_contents
    cur.execute("SELECT table_name, data_type FROM gpkg_contents")
    contents = cur.fetchall()
    
    # Get physical tables
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    
    print(f"\nFile: {name}")
    print(f"  Physical tables: {tables}")
    print(f"  gpkg_contents: {contents}")
    
    # Check table structure for each registered layer
    for t_name, d_type in contents:
        cur.execute(f"PRAGMA table_info('{t_name}')")
        cols = [r[1] for r in cur.fetchall()]
        print(f"  Layer table: '{t_name}' | Columns: {cols}")
        
    conn.close()