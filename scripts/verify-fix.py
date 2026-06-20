"""Verify fixes applied to GeoPackage files and QGIS project"""
import sqlite3, os, zipfile, xml.etree.ElementTree as ET

print("=" * 60)
print("FINAL VERIFICATION REPORT")
print("=" * 60)

# 1. Check .env port
print("\n--- .env PORT CHECK ---")
with open('.env', 'r') as f:
    for line in f:
        if 'QFIELD' in line and ('8011' in line or '8100' in line):
            port = '8011' if '8011' in line else '8100'
            status = '✅' if port == '8100' else '❌'
            print(f"  {status} {line.strip()}")

# 2. Check QGZ datasource paths
print("\n--- QGZ DATASOURCE CHECK ---")
with zipfile.ZipFile('QGIS Project Template/QGIS.qgz', 'r') as z:
    z.extract('QGIS.qgs', 'tmp_verify_qgz/')
tree = ET.parse('tmp_verify_qgz/QGIS.qgs')
root = tree.getroot()
issues = 0
for l in root.findall('.//maplayer'):
    if l.get('type') != 'vector':
        continue
    nm = l.find('layername').text
    ds = l.find('datasource')
    src = ds.text or ''
    if 'GeoJSON' in src:
        print(f"  ❌ {nm}: STILL GeoJSON! {src[:70]}")
        issues += 1
    elif 'slt_tp' in src:
        print(f"  ❌ {nm}: lowercase slt_tp in datasource!")
        issues += 1
    elif '.gpkg' in src and nm in src:
        print(f"  ✅ {nm}: {src[:65]}")
    else:
        print(f"  ⚠️  {nm}: {src[:65]}")

# Check project CRS
proj_crs = root.find('projectCrs')
if proj_crs is not None:
    srs = proj_crs.find('spatialrefsys')
    if srs is not None:
        authid = srs.find('authid')
        crs_text = authid.text if authid is not None else 'EMPTY'
        print(f"\n  Project CRS: {'✅ EPSG:4326' if crs_text == 'EPSG:4326' else '❌ EMPTY!'}")

# Check transaction mode
trans = root.find('transaction')
if trans is not None:
    mode = trans.get('mode', 'Disabled')
    print(f"  Transaction Mode: {'✅ ' + mode if mode == 'AutomaticBuffered' else '❌ ' + mode}")

# Clean
import shutil
shutil.rmtree('tmp_verify_qgz/', ignore_errors=True)

# 3. Check GeoPackage files
print("\n--- GeoPackage SCHEMA CHECK ---")
for f in sorted(os.listdir('QGIS Project Template')):
    if not f.endswith('.gpkg'):
        continue
    path = os.path.join('QGIS Project Template', f)
    conn = sqlite3.connect(path)
    cur = conn.cursor()
    
    # Get feature table name
    cur.execute("SELECT table_name FROM gpkg_contents WHERE data_type='features'")
    row = cur.fetchone()
    if not row:
        print(f"  ❌ {f}: No gpkg_contents entry!")
        conn.close()
        continue
    tn = row[0]
    
    # Count columns in feature table
    cur.execute(f'PRAGMA table_info("{tn}")')
    cols = [r[1] for r in cur.fetchall()]
    
    # Count rows
    cur.execute(f'SELECT count(*) FROM "{tn}"')
    row_count = cur.fetchone()[0]
    
    # Check geometry columns
    cur.execute('SELECT count(*) FROM gpkg_geometry_columns')
    geom_cols = cur.fetchone()[0]
    
    # Check spatial index (rtree)
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rtree_%'")
    rtree_tables = cur.fetchall()
    has_rtree = len(rtree_tables) > 0
    
    # Check data_type in gpkg_contents
    cur.execute('SELECT data_type FROM gpkg_contents')
    dt = cur.fetchone()[0]
    
    # Case sensitivity check
    case_ok = (tn == f.replace('.gpkg', ''))
    
    status_parts = []
    if geom_cols >= 1:
        status_parts.append('✅geom')
    else:
        status_parts.append('❌NO_GEOM')
    if has_rtree:
        status_parts.append('✅rtree')
    else:
        status_parts.append('⚠️NO_RTREE')
    if dt == 'features':
        status_parts.append('✅type')
    else:
        status_parts.append(f'❌{dt}')
    if case_ok:
        status_parts.append('✅case')
    else:
        status_parts.append(f'⚠️{table_case}')
    
    status = ' '.join(status_parts)
    print(f"  {f}: table='{tn}', cols={len(cols)}, rows={row_count} | {status}")
    conn.close()

print("\n" + "=" * 60)
print("VERIFICATION COMPLETE")
print("=" * 60)