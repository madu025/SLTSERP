import zipfile
import xml.etree.ElementTree as ET
import os
import shutil
import sys
import json

def create_value_map_option(options_list):
    opt_map = ET.Element('Option', {'type': 'Map'})
    opt_list = ET.SubElement(opt_map, 'Option', {'type': 'List', 'name': 'map'})
    for val in options_list:
        choice_map = ET.SubElement(opt_list, 'Option', {'type': 'Map'})
        ET.SubElement(choice_map, 'Option', {'type': 'QString', 'name': 'label', 'value': val})
        ET.SubElement(choice_map, 'Option', {'type': 'QString', 'name': 'value', 'value': val})
    return opt_map

def fix_datasource_paths(root, target_dir=None):
    """
    Fix all vector layer datasource paths:
    - Convert GeoJSON paths to GeoPackage
    - Fix SLT_TP case sensitivity (slt_tp -> SLT_TP)
    - Ensure absolute/relative paths are correct
    Returns count of changes made.
    """
    changes = 0
    for layer in root.findall('.//maplayer'):
        if layer.get('type') != 'vector':
            continue
        
        layername = layer.find('layername')
        datasource = layer.find('datasource')
        if layername is None or datasource is None:
            continue
        
        name = layername.text
        old_src = datasource.text or ''
        
        # Fix GeoJSON -> GeoPackage paths
        if 'GeoJSON' in old_src:
            datasource.text = f'./{name}.gpkg|layername={name}'
            print(f"  Fixed datasource: {name} (GeoJSON -> GeoPackage)")
            changes += 1
        
        # Fix SLT_TP case: QFieldCloud/QGIS creates lowercase 'slt_tp'
        if 'slt_tp' in (datasource.text or ''):
            datasource.text = datasource.text.replace('slt_tp', 'SLT_TP')
            print(f"  Fixed datasource case: {name} (slt_tp -> SLT_TP)")
            changes += 1
        
        # Fix layer-tree source too
        for lt in root.findall('.//layer-tree-layer'):
            if lt.get('name') == name:
                lt_src = lt.get('source', '')
                if 'GeoJSON' in lt_src:
                    lt.set('source', f'./{name}.gpkg')
                    print(f"  Fixed layer-tree source: {name}")
                    changes += 1
                if 'slt_tp' in lt_src:
                    lt.set('source', lt_src.replace('slt_tp', 'SLT_TP'))
    
    return changes

def fix_project_settings(root):
    """Fix critical QField project settings"""
    changes = 0
    
    # Fix project CRS (empty CRS causes QField to fail)
    proj_crs = root.find('projectCrs')
    if proj_crs is not None:
        srs = proj_crs.find('spatialrefsys')
        if srs is not None:
            authid = srs.find('authid')
            if authid is None or not authid.text:
                # Set WGS 84 / EPSG:4326
                srs.find('wkt').text = 'GEOGCRS["WGS 84",ENSEMBLE["World Geodetic System 1984 ensemble",MEMBER["World Geodetic System 1984 (Transit)"],MEMBER["World Geodetic System 1984 (G730)"],MEMBER["World Geodetic System 1984 (G873)"],MEMBER["World Geodetic System 1984 (G1150)"],MEMBER["World Geodetic System 1984 (G1674)"],MEMBER["World Geodetic System 1984 (G1762)"],MEMBER["World Geodetic System 1984 (G2139)"],ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]],ENSEMBLEACCURACY[2.0]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["geodetic latitude (Lat)",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["geodetic longitude (Lon)",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],USAGE[SCOPE["Horizontal component of 3D system."],AREA["World."],BBOX[-90,-180,90,180]],ID["EPSG",4326]]'
                srs.find('proj4').text = '+proj=longlat +datum=WGS84 +no_defs'
                srs.find('srsid').text = '3452'
                srs.find('srid').text = '4326'
                srs.find('authid').text = 'EPSG:4326'
                srs.find('description').text = 'WGS 84'
                srs.find('projectionacronym').text = 'longlat'
                srs.find('ellipsoidacronym').text = 'EPSG:7030'
                srs.find('geographicflag').text = 'true'
                print("  Fixed project CRS: set to EPSG:4326")
                changes += 1
    
    # Fix transaction mode (must be AutomaticBuffered for QField editing)
    trans = root.find('transaction')
    if trans is not None and trans.get('mode') != 'AutomaticBuffered':
        trans.set('mode', 'AutomaticBuffered')
        print("  Fixed transaction mode: AutomaticBuffered")
        changes += 1
    
    return changes

def patch_dynamic(qgz_path, config_data):
    if not os.path.exists(qgz_path):
        print(f"Error: {qgz_path} not found.")
        sys.exit(1)

    temp_dir = qgz_path + '_temp_extract'
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # Extract files
        with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
            file_list = zip_ref.namelist()

        qgs_file_name = [f for f in file_list if f.endswith('.qgs')][0]
        qgs_path = os.path.join(temp_dir, qgs_file_name)

        # Parse XML
        tree = ET.parse(qgs_path)
        root = tree.getroot()

        total_modified = 0
        
        # STEP 1: Fix project-level settings (CRS, transaction mode)
        print("Applying project-level fixes...")
        total_modified += fix_project_settings(root)
        
        # STEP 2: Fix datasource paths (GeoJSON->GPKG, case sensitivity)
        print("Fixing datasource paths...")
        total_modified += fix_datasource_paths(root)
        
        # STEP 3: Apply ValueMap widget configurations
        print("Applying ValueMap configurations...")
        widget_modified = False
        for layer_name, field_configs in config_data.items():
            # Find the layer element
            layer_elem = None
            for layer in root.findall('.//maplayer'):
                name_elem = layer.find('layername')
                if name_elem is not None and name_elem.text == layer_name:
                    layer_elem = layer
                    break

            if layer_elem is None:
                print(f"Warning: Layer '{layer_name}' not found in project.")
                continue

            fields_config = layer_elem.find('fieldConfiguration')
            if fields_config is None:
                print(f"Warning: fieldConfiguration not found for layer '{layer_name}'.")
                continue

            for field_name, options in field_configs.items():
                field = fields_config.find(f".//field[@name='{field_name}']")
                if field is not None:
                    edit_widget = field.find('editWidget')
                    if edit_widget is not None:
                        edit_widget.set('type', 'ValueMap')
                        config = edit_widget.find('config')
                        if config is not None:
                            # Clear old children
                            for child in list(config):
                                config.remove(child)
                            # Add new ValueMap Option structure
                            opt_map = create_value_map_option(options)
                            config.append(opt_map)
                            print(f"  Patched field '{layer_name}.{field_name}' with options: {options}")
                            widget_modified = True
                            total_modified += 1

        if total_modified > 0:
            # Write modified XML back
            tree.write(qgs_path, encoding='utf-8', xml_declaration=True)
            
            # Repack the zip file
            with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
                for file in file_list:
                    file_path = os.path.join(temp_dir, file)
                    zip_ref.write(file_path, file)
            print(f"Successfully patched and repacked QGIS project ({total_modified} total changes).")
        else:
            print("No changes were needed.")

    except Exception as e:
        print(f"Failed to patch project: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python patch_qgis_dynamic.py <qgz_path> <config_json>")
        sys.exit(1)
    
    qgz_path = sys.argv[1]
    try:
        if os.path.exists(sys.argv[2]):
            with open(sys.argv[2], 'r', encoding='utf-8') as f:
                config_data = json.load(f)
        else:
            config_data = json.loads(sys.argv[2])
    except Exception as e:
        print(f"Invalid JSON configuration or file path: {e}")
        sys.exit(1)

    patch_dynamic(qgz_path, config_data)
