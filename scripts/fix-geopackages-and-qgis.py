"""
Fix GeoPackage files and QGIS project for QField mobile survey.
1. Reads QGIS.qgs to get field definitions for each layer
2. Creates proper GeoPackage files with geometry columns, fields, and spatial indexes
3. Fixes the QGZ archive with proper datasource paths
"""
import zipfile
import sqlite3
import xml.etree.ElementTree as ET
import os
import shutil
import json

QGIS_QGZ = "QGIS Project Template/QGIS.qgz"
QGIS_QGS = "QGIS Project Template/QGIS.qgs"  # uncompressed backup
TEMP_DIR = "tmp_qgis_fix"

def clean_temp():
    if os.path.exists(TEMP_DIR):
        shutil.rmtree(TEMP_DIR)
    os.makedirs(TEMP_DIR)

def extract_qgz():
    """Extract QGIS.qgz to temp directory"""
    with zipfile.ZipFile(QGIS_QGZ, 'r') as z:
        z.extractall(TEMP_DIR)
    return os.path.join(TEMP_DIR, 'QGIS.qgs')

def parse_layer_fields(qgs_path):
    """Parse layer geometry types and field definitions from QGIS.qgs"""
    tree = ET.parse(qgs_path)
    root = tree.getroot()
    
    layers_info = {}
    for layer in root.findall('.//maplayer'):
        if layer.get('type') != 'vector':
            continue
        
        layername = layer.find('layername').text
        geometry = layer.get('geometry', 'Point')
        wkbType = layer.get('wkbType', 'Point')
        
        fields = []
        fc = layer.find('fieldConfiguration')
        if fc is not None:
            for field_elem in fc.findall('field'):
                fname = field_elem.get('name')
                ftype = 'TEXT'  # default
                ews = field_elem.find('editWidget')
                ewt = ews.get('type') if ews is not None else 'TextEdit'
                fields.append({'name': fname, 'widget_type': ewt})
        
        layers_info[layername] = {
            'geometry': geometry,
            'wkbType': wkbType,
            'fields': fields
        }
    
    return layers_info

def create_gpkg_with_schema(gpkg_path, table_name, geom_type, fields):
    """Create a GeoPackage with proper schema"""
    if os.path.exists(gpkg_path):
        os.remove(gpkg_path)
    
    conn = sqlite3.connect(gpkg_path)
    cur = conn.cursor()
    
    # Enable GeoPackage
    cur.execute("PRAGMA application_id = 0x47503130;")
    
    # Create required GeoPackage metadata tables
    cur.execute('''CREATE TABLE gpkg_spatial_ref_sys (
        srs_name TEXT NOT NULL,
        srs_id INTEGER NOT NULL PRIMARY KEY,
        organization TEXT NOT NULL,
        organization_coordsys_id INTEGER NOT NULL,
        definition TEXT NOT NULL,
        description TEXT
    )''')
    
    cur.execute('''CREATE TABLE gpkg_contents (
        table_name TEXT NOT NULL PRIMARY KEY,
        data_type TEXT NOT NULL,
        identifier TEXT,
        description TEXT DEFAULT '',
        last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        min_x DOUBLE,
        min_y DOUBLE,
        max_x DOUBLE,
        max_y DOUBLE,
        srs_id INTEGER,
        CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
    )''')
    
    cur.execute('''CREATE TABLE gpkg_ogr_contents (
        table_name TEXT NOT NULL PRIMARY KEY,
        feature_count INTEGER NOT NULL DEFAULT 0
    )''')
    
    cur.execute('''CREATE TABLE gpkg_geometry_columns (
        table_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        geometry_type_name TEXT NOT NULL,
        srs_id INTEGER NOT NULL,
        z TINYINT NOT NULL,
        m TINYINT NOT NULL,
        CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name),
        CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name),
        CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
    )''')
    
    cur.execute('''CREATE TABLE gpkg_tile_matrix_set (
        table_name TEXT NOT NULL PRIMARY KEY,
        srs_id INTEGER NOT NULL,
        min_x DOUBLE NOT NULL,
        min_y DOUBLE NOT NULL,
        max_x DOUBLE NOT NULL,
        max_y DOUBLE NOT NULL,
        CONSTRAINT fk_gtms_srs FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id),
        CONSTRAINT fk_gtms_ctn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name)
    )''')
    
    cur.execute('''CREATE TABLE gpkg_tile_matrix (
        table_name TEXT NOT NULL,
        zoom_level INTEGER NOT NULL,
        matrix_width INTEGER NOT NULL,
        matrix_height INTEGER NOT NULL,
        tile_width INTEGER NOT NULL,
        tile_height INTEGER NOT NULL,
        pixel_x_size DOUBLE NOT NULL,
        pixel_y_size DOUBLE NOT NULL,
        CONSTRAINT pk_ttm PRIMARY KEY (table_name, zoom_level),
        CONSTRAINT fk_tms FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name)
    )''')
    
    # Create the feature table with fid + geom + survey fields
    cols = ["fid INTEGER PRIMARY KEY AUTOINCREMENT", "geom BLOB"]
    for field in fields:
        fname = field['name']
        # Don't duplicate fid
        if fname.lower() == 'fid':
            continue
        cols.append(f'"{fname}" TEXT')
    
    col_str = ', '.join(cols)
    cur.execute(f'CREATE TABLE "{table_name}" ({col_str})')
    
    # Insert spatial ref sys (WGS 84 / EPSG:4326)
    cur.execute('''INSERT OR REPLACE INTO gpkg_spatial_ref_sys 
        (srs_name, srs_id, organization, organization_coordsys_id, definition, description)
        VALUES ('WGS 84 geodetic', 4326, 'EPSG', 4326,
        'GEOGCS["WGS 84",DATUM["World Geodetic System 1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]]',
        'WGS 84')''')
    
    # Register in gpkg_contents
    cur.execute('''INSERT INTO gpkg_contents 
        (table_name, data_type, identifier, srs_id) 
        VALUES (?, 'features', ?, 4326)''', (table_name, table_name))
    
    # Register geometry column
    cur.execute('''INSERT INTO gpkg_geometry_columns
        (table_name, column_name, geometry_type_name, srs_id, z, m)
        VALUES (?, 'geom', ?, 4326, 0, 0)''', (table_name, geom_type))
    
    # Register in ogr_contents
    cur.execute('''INSERT INTO gpkg_ogr_contents
        (table_name, feature_count) VALUES (?, 0)''', (table_name,))
    
    conn.commit()
    conn.close()
    
    # Now create spatial index using OGR
    print(f"  Created {gpkg_path} with table '{table_name}' ({geom_type}, {len(fields)} fields)")

def add_spatial_index(gpkg_path):
    """Add RTree spatial index to GeoPackage"""
    conn = sqlite3.connect(gpkg_path)
    cur = conn.cursor()
    
    # Get table name
    cur.execute("SELECT table_name FROM gpkg_contents WHERE data_type='features'")
    row = cur.fetchone()
    if not row:
        conn.close()
        return
    table_name = row[0]
    
    # Check if rtree already exists
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'rtree_%'")
    existing = cur.fetchall()
    if existing:
        print(f"  Spatial index already exists for {table_name}")
        conn.close()
        return
    
    # Create rtree trigger
    rtree_name = f'rtree_{table_name}_geom'
    
    # Enable extension
    try:
        cur.execute("SELECT load_extension('mod_spatialite')")
    except:
        pass
    
    cur.execute(f'''CREATE VIRTUAL TABLE "{rtree_name}" USING rtree(id, minx, maxx, miny, maxy)''')
    
    # Create insert trigger
    cur.execute(f'''CREATE TRIGGER "rtree_{table_name}_geom_insert" AFTER INSERT ON "{table_name}"
    BEGIN
        INSERT OR REPLACE INTO "{rtree_name}" VALUES (
            NEW.fid,
            ST_MinX(NEW.geom), ST_MaxX(NEW.geom),
            ST_MinY(NEW.geom), ST_MaxY(NEW.geom)
        );
    END''')
    
    # Create update trigger
    cur.execute(f'''CREATE TRIGGER "rtree_{table_name}_geom_update1" AFTER UPDATE OF geom ON "{table_name}"
    WHEN OLD.fid = NEW.fid
    BEGIN
        INSERT OR REPLACE INTO "{rtree_name}" VALUES (
            NEW.fid,
            ST_MinX(NEW.geom), ST_MaxX(NEW.geom),
            ST_MinY(NEW.geom), ST_MaxY(NEW.geom)
        );
    END''')
    
    cur.execute(f'''CREATE TRIGGER "rtree_{table_name}_geom_update2" AFTER UPDATE OF geom ON "{table_name}"
    WHEN OLD.fid <> NEW.fid
    BEGIN
        DELETE FROM "{rtree_name}" WHERE id = OLD.fid;
        INSERT OR REPLACE INTO "{rtree_name}" VALUES (
            NEW.fid,
            ST_MinX(NEW.geom), ST_MaxX(NEW.geom),
            ST_MinY(NEW.geom), ST_MaxY(NEW.geom)
        );
    END''')
    
    # Create delete trigger
    cur.execute(f'''CREATE TRIGGER "rtree_{table_name}_geom_delete" AFTER DELETE ON "{table_name}"
    WHEN old.fid NOT IN (SELECT fid FROM "{table_name}")
    BEGIN
        DELETE FROM "{rtree_name}" WHERE id = OLD.fid;
    END''')
    
    conn.commit()
    conn.close()
    print(f"  Added spatial index to {table_name}")

def update_qgs_datasource(qgs_path, layers_info):
    """Update QGIS.qgs to use proper GeoPackage paths and fix geometry types"""
    tree = ET.parse(qgs_path)
    root = tree.getroot()
    
    # Fix project CRS
    # IMPORTANT: Do not change this to EPSG:3857! QField on mobile requires EPSG:4326 for accurate GPS 
    # positioning and scale calculation in Sri Lanka. If this is changed to 3857, the map extent and scale 
    # calculations on mobile will break, resulting in black screens when zooming in on XYZ tile layers 
    # or sending the user to "Null Island".
    proj_crs = root.find('projectCrs')
    if proj_crs is None:
        proj_crs = ET.SubElement(root, 'projectCrs')
    
    # clear existing children
    for child in list(proj_crs):
        proj_crs.remove(child)
        
    def build_srs_4326(parent):
        srs = ET.SubElement(parent, 'spatialrefsys', {'nativeFormat': 'Wkt'})
        ET.SubElement(srs, 'wkt').text = 'GEOGCRS["WGS 84",ENSEMBLE["World Geodetic System 1984 ensemble",MEMBER["World Geodetic System 1984 (Transit)"],MEMBER["World Geodetic System 1984 (G730)"],MEMBER["World Geodetic System 1984 (G873)"],MEMBER["World Geodetic System 1984 (G1150)"],MEMBER["World Geodetic System 1984 (G1674)"],MEMBER["World Geodetic System 1984 (G1762)"],MEMBER["World Geodetic System 1984 (G2139)"],MEMBER["World Geodetic System 1984 (G2296)"],ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]],ENSEMBLEACCURACY[2.0]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["geodetic latitude (Lat)",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["geodetic longitude (Lon)",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],USAGE[SCOPE["Horizontal component of 3D system."],AREA["World."],BBOX[-90,-180,90,180]],ID["EPSG",4326]]'
        ET.SubElement(srs, 'proj4').text = '+proj=longlat +datum=WGS84 +no_defs'
        ET.SubElement(srs, 'srsid').text = '3452'
        ET.SubElement(srs, 'srid').text = '4326'
        ET.SubElement(srs, 'authid').text = 'EPSG:4326'
        ET.SubElement(srs, 'description').text = 'WGS 84'
        ET.SubElement(srs, 'projectionacronym').text = 'longlat'
        ET.SubElement(srs, 'ellipsoidacronym').text = 'EPSG:7030'
        ET.SubElement(srs, 'geographicflag').text = 'true'

    build_srs_4326(proj_crs)
    
    # Map Canvas
    mc = root.find('.//mapcanvas')
    if mc is not None:
        extent = mc.find('extent')
        if extent is not None:
            xmin = extent.find('xmin')
            if xmin is not None: xmin.text = '79.5'
            ymin = extent.find('ymin')
            if ymin is not None: ymin.text = '5.9'
            xmax = extent.find('xmax')
            if xmax is not None: xmax.text = '82.5'
            ymax = extent.find('ymax')
            if ymax is not None: ymax.text = '9.9'
            
        # CRITICAL: If units is not 'degrees', the scale bar will read "1e+07 km" when zoomed into Sri Lanka
        units = mc.find('units')
        if units is None:
            units = ET.SubElement(mc, 'units')
        units.text = 'degrees'
        
        # CRITICAL: destinationsrs MUST be explicitly set inside mapcanvas, otherwise QField will 
        # crash/black-screen when trying to render EPSG:3857 basemaps on top of an EPSG:4326 project.
        dsrs = mc.find('destinationsrs')
        if dsrs is None:
            dsrs = ET.SubElement(mc, 'destinationsrs')
        for child in list(dsrs):
            dsrs.remove(child)
            
        build_srs_4326(dsrs)
        
    # Fix transaction mode
    trans = root.find('transaction')
    if trans is not None:
        trans.set('mode', 'AutomaticBuffered')
    
    modified = False
    for layer in root.findall('.//maplayer'):
        if layer.get('type') != 'vector':
            continue
        
        layername = layer.find('layername').text
        datasource = layer.find('datasource')
        
        if datasource is not None and 'GeoJSON' in (datasource.text or ''):
            # Fix datasource from GeoJSON to GeoPackage
            datasource.text = f'./{layername}.gpkg|layername={layername}'
            modified = True
            print(f"  Fixed datasource for {layername}")
        
        # Fix geometry type if needed
        info = layers_info.get(layername, {})
        if info.get('geometry') == 'No geometry' or layer.get('geometry') == 'No geometry':
            geom = info.get('wkbType', 'Point')
            layer.set('geometry', geom)
            layer.set('wkbType', geom)
            print(f"  Fixed geometry type for {layername}: {geom}")
    
    if modified:
        tree.write(qgs_path, encoding='utf-8', xml_declaration=True)
        print("Updated QGIS.qgs with GeoPackage datasources")
    
    return modified

def repack_qgz(qgs_path, qgz_path):
    """Repack the QGZ archive"""
    style_files = []
    for f in os.listdir(TEMP_DIR):
        if f.endswith('_styles.db'):
            style_files.append(f)
    
    with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(qgs_path, 'QGIS.qgs')
        for sf in style_files:
            z.write(os.path.join(TEMP_DIR, sf), sf)
    print(f"Repacked {qgz_path}")

def fix_layer_tree_source(root, layers_info):
    """Fix layer-tree-layer source attributes"""
    for lt in root.findall('.//layer-tree-layer'):
        provider = lt.get('providerKey', '')
        if provider == 'ogr':
            name = lt.get('name', '')
            lt.set('source', f'./{name}.gpkg')
    return root

# Maps layer name to geometry type
LAYER_GEOMETRY_MAP = {
    'SLT_Poles': 'Point',
    'SLT_TP': 'Point',
    'SLT_FDP': 'Point',
    'SLT_MH': 'Point',
    'SLT_HH': 'Point',
    'SLT_FTC': 'Point',
    'SLT_FJ': 'Point',
    'SLT_ODF': 'Point',
    'SLT_Road_EOPs': 'Point',
    'SLT_Risers': 'Point',
    'SLT_Ducts': 'LineString',
    'SLT_Cables': 'LineString',
}

def main():
    print("=" * 60)
    print("Fixing GeoPackage files and QGIS project for QField mobile")
    print("=" * 60)
    
    # 1. Clean and extract
    print("\n1. Extracting QGIS.qgz...")
    clean_temp()
    qgs_path = extract_qgz()
    
    # 2. Parse layers
    print("\n2. Parsing layer definitions from QGIS.qgs...")
    layers_info = parse_layer_fields(qgs_path)
    for name, info in layers_info.items():
        print(f"  {name}: geometry={info['geometry']}, fields={len(info['fields'])}")
    
    if not layers_info:
        print("ERROR: No vector layers found in QGIS.qgs")
        return
    
    # 3. Build field lists from QGIS.qgs
    print("\n3. Building field schemas from QGIS.qgs...")
    for name, info in layers_info.items():
        geom_type = LAYER_GEOMETRY_MAP.get(name, 'Point')
        info['wkbType'] = geom_type
        if info['geometry'] in ('No geometry', None):
            info['geometry'] = geom_type
    
    # 4. Create/update GeoPackage files
    print("\n4. Creating GeoPackage files with proper schema...")
    gpkg_dir = "QGIS Project Template"
    for name, info in layers_info.items():
        if name.startswith('google') or name.startswith('Bing') or name.startswith('OpenStreet'):
            continue
        gpkg_path = os.path.join(gpkg_dir, f"{name}.gpkg")
        create_gpkg_with_schema(gpkg_path, name, info['wkbType'], info['fields'])
    
    # 5. Add spatial indexes
    print("\n5. Adding spatial indexes...")
    for name, info in layers_info.items():
        if name.startswith('google') or name.startswith('Bing') or name.startswith('OpenStreet'):
            continue
        gpkg_path = os.path.join(gpkg_dir, f"{name}.gpkg")
        try:
            add_spatial_index(gpkg_path)
        except Exception as e:
            print(f"  Warning: Could not add spatial index for {name}: {e}")
    
    # 6. Update QGIS.qgs datasources
    print("\n6. Updating QGIS.qgs datasource paths...")
    update_qgs_datasource(qgs_path, layers_info)
    
    # Also update the uncompressed .qgs
    if os.path.exists(QGIS_QGS):
        print("  Also updating uncompressed QGIS.qgs...")
        update_qgs_datasource(QGIS_QGS, layers_info)
    
    # 7. Repack QGZ
    print("\n7. Repacking QGIS.qgz...")
    repack_qgz(qgs_path, QGIS_QGZ)
    
    # 8. Verify
    print("\n8. Verification...")
    with zipfile.ZipFile(QGIS_QGZ, 'r') as z:
        namelist = z.namelist()
        print(f"  QGZ contains: {namelist}")
    
    # Verify datasources in repacked QGZ
    qgs_in_qgz = extract_qgz()
    layers_final = parse_layer_fields(qgs_in_qgz)
    
    tree = ET.parse(qgs_in_qgz)
    root = tree.getroot()
    print("\n  Final datasources:")
    for layer in root.findall('.//maplayer'):
        if layer.get('type') != 'vector':
            continue
        ds = layer.find('datasource')
        nm = layer.find('layername')
        if ds is not None and nm is not None:
            has_geojson = 'GeoJSON' in (ds.text or '')
            status = '❌ STILL GeoJSON!' if has_geojson else '✅ GeoPackage'
            print(f"    {nm.text}: {ds.text[:60]}... {status}")
    
    # Clean up
    clean_temp()
    
    print("\n" + "=" * 60)
    print("DONE! GeoPackage files created with schema, QGIS.qgz repacked.")
    print("=" * 60)

if __name__ == '__main__':
    main()