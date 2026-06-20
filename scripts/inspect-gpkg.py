#!/usr/bin/env python3
"""Inspect a GeoPackage file for editable layer requirements."""
import sqlite3
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'QGIS Project Template/GeoPackage/SLT_Poles.gpkg'
conn = sqlite3.connect(path)
cur = conn.cursor()

print(f"=== Analyzing GeoPackage: {path} ===\n")

# List all tables
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("TABLES:", tables)

# Check user data tables
for t in tables:
    if t.startswith('gpkg_') or t == 'sqlite_sequence':
        continue
    cur.execute(f'PRAGMA table_info("{t}")')
    cols = cur.fetchall()
    pk_cols = [c[1] for c in cols if c[5] == 1]
    print(f'\n--- Table: {t} ---')
    print(f'  Primary Key(s): {pk_cols if pk_cols else "*** NONE *** - THIS WILL CAUSE READ-ONLY!"}')
    for c in cols:
        print(f'  Column: {c[1]}, Type: {c[2]}, NotNull: {c[3]}, PK: {c[5]}')

# Geometry columns
cur.execute("SELECT * FROM gpkg_geometry_columns")
print('\n\n--- gpkg_geometry_columns ---')
for r in cur.fetchall():
    print(f'  {r}')

# Spatial index check
cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_geom_idx%'")
spatial_idx = cur.fetchall()
print(f'\n--- Spatial Index Tables: {[r[0] for r in spatial_idx]}')

cur.execute("SELECT * FROM gpkg_extensions")
ext = cur.fetchall()
print(f'\n--- gpkg_extensions: {ext}')

# Data counts
for t in tables:
    if not t.startswith('gpkg_') and t != 'sqlite_sequence':
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        cnt = cur.fetchone()[0]
        print(f'  {t}: {cnt} rows')

conn.close()