import os
import sqlite3

template_dir = 'QGIS Project Template'
gpkgs = [f for f in os.listdir(template_dir) if f.endswith('.gpkg')]

for gpkg in gpkgs:
    path = os.path.join(template_dir, gpkg)
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cur.fetchall()]
    
    for t in tables:
        if t.startswith('gpkg_') or t == 'sqlite_sequence' or 'rtree_' in t:
            continue
        cur.execute(f'PRAGMA table_info("{t}")')
        cols = cur.fetchall()
        print(f"GPKG: {gpkg} | Table: {t}")
        for c in cols:
            print(f"  Column: {c[1]} ({c[2]})")
    conn.close()
