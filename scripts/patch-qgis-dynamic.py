import sys
import os
import json
import xml.etree.ElementTree as ET

EPSG4326_WKT = 'GEOGCRS["WGS 84",ENSEMBLE["World Geodetic System 1984 ensemble",MEMBER["World Geodetic System 1984 (Transit)"],MEMBER["World Geodetic System 1984 (G730)"],MEMBER["World Geodetic System 1984 (G873)"],MEMBER["World Geodetic System 1984 (G1150)"],MEMBER["World Geodetic System 1984 (G1674)"],MEMBER["World Geodetic System 1984 (G1762)"],MEMBER["World Geodetic System 1984 (G2139)"],MEMBER["World Geodetic System 1984 (G2296)"],ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]],ENSEMBLEACCURACY[2.0]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["geodetic latitude (Lat)",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["geodetic longitude (Lon)",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],USAGE[SCOPE["Horizontal component of 3D system."],AREA["World."],BBOX[-90,-180,90,180]],ID["EPSG",4326]]'

def build_srs_4326(parent):
    srs = ET.SubElement(parent, 'spatialrefsys', {'nativeFormat': 'Wkt'})
    ET.SubElement(srs, 'wkt').text = EPSG4326_WKT
    ET.SubElement(srs, 'proj4').text = '+proj=longlat +datum=WGS84 +no_defs'
    ET.SubElement(srs, 'srsid').text = '3452'
    ET.SubElement(srs, 'srid').text = '4326'
    ET.SubElement(srs, 'authid').text = 'EPSG:4326'
    ET.SubElement(srs, 'description').text = 'WGS 84'
    ET.SubElement(srs, 'projectionacronym').text = 'longlat'
    ET.SubElement(srs, 'ellipsoidacronym').text = 'EPSG:7030'
    ET.SubElement(srs, 'geographicflag').text = 'true'

def patch_qgs(qgs_path, config_data):
    tree = ET.parse(qgs_path)
    root = tree.getroot()
    changes = 0

    # IMPORTANT: Do not change this to EPSG:3857! QField on mobile requires EPSG:4326 for accurate GPS 
    # positioning and scale calculation in Sri Lanka. If this is changed to 3857, the map extent and scale 
    # calculations on mobile will break, resulting in black screens when zooming in on XYZ tile layers 
    # or sending the user to "Null Island".
    # Project CRS -> EPSG:4326
    proj_crs = root.find('projectCrs')
    if proj_crs is None:
        proj_crs = ET.SubElement(root, 'projectCrs')
    for child in list(proj_crs):
        proj_crs.remove(child)
    build_srs_4326(proj_crs)
    changes += 1

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
        changes += 1

    # Fix transaction mode (must be AutomaticBuffered for QField editing)
    trans = root.find('transaction')
    if trans is not None and trans.get('mode') != 'AutomaticBuffered':
        trans.set('mode', 'AutomaticBuffered')
        changes += 1

    # Enable Global Snapping (Tolerance: 15 pixels, Mode: 2 = All Layers, Type: 1 = Vertex)
    snapping = root.find('snapping-settings')
    if snapping is None:
        snapping = ET.SubElement(root, 'snapping-settings', {
            'enabled': '1', 'mode': '2', 'type': '1', 'tolerance': '15', 'unit': '1'
        })
        changes += 1

    # Map of layers to their primary label field
    label_fields = {
        'SLT_Poles': 'pl_number',
        'SLT_FDP': 'fdp_name',
        'SLT_MH': 'mh_name',
        'SLT_HH': 'hh_name',
        'SLT_ODF': 'odf_name',
        'SLT_Cables': 'cable_type',
        'SLT_Ducts': 'duct_no',
        'SLT_FTC': 'ftc_name',
        'SLT_FJ': 'fj_name'
    }

    # Inject ValueMap Widgets and Labels
    for layer in root.findall('.//maplayer'):
        layername_elem = layer.find('layername')
        if layername_elem is None: continue
        layername = layername_elem.text

        # 1. Inject Labels, Defaults, and Colors for Vector Layers
        if layer.get('type') == 'vector':
            # Auto-fill Latitude/Longitute via Defaults
            defaults_elem = layer.find('defaults')
            if defaults_elem is None:
                defaults_elem = ET.SubElement(layer, 'defaults')
                
            # Add or update default expressions for Lat/Lon
            lat_default = defaults_elem.find("default[@field='latitude']")
            if lat_default is None: ET.SubElement(defaults_elem, 'default', {'field': 'latitude', 'expression': '$y', 'applyOnUpdate': '1'})
            else: lat_default.set('expression', '$y'); lat_default.set('applyOnUpdate', '1')

            lon_default = defaults_elem.find("default[@field='longitude']")
            if lon_default is None: ET.SubElement(defaults_elem, 'default', {'field': 'longitude', 'expression': '$x', 'applyOnUpdate': '1'})
            else: lon_default.set('expression', '$x'); lon_default.set('applyOnUpdate', '1')
            changes += 1

            # Make Lat/Lon read-only
            editable_elem = layer.find('editable')
            if editable_elem is None:
                editable_elem = ET.SubElement(layer, 'editable')
            for f_name in ['latitude', 'longitude']:
                f_edit = editable_elem.find(f"field[@name='{f_name}']")
                if f_edit is None: ET.SubElement(editable_elem, 'field', {'name': f_name, 'editable': '0'})
                else: f_edit.set('editable', '0')
            changes += 1

            # Dynamic Symbology (Coloring based on Existing vs New)
            # Find the SimpleMarker or SimpleLine layer inside symbols
            for sym_layer in layer.findall('.//layer'):
                if sym_layer.get('class') in ['SimpleMarker', 'SimpleLine']:
                    ddp = sym_layer.find('data_defined_properties')
                    if ddp is not None:
                        sym_layer.remove(ddp)
                    
                    ddp = ET.SubElement(sym_layer, 'data_defined_properties')
                    opt_map1 = ET.SubElement(ddp, 'Option', {'type': 'Map'})
                    ET.SubElement(opt_map1, 'Option', {'name': 'name', 'type': 'QString', 'value': ''})
                    ET.SubElement(opt_map1, 'Option', {'name': 'type', 'type': 'QString', 'value': 'collection'})
                    
                    props = ET.SubElement(opt_map1, 'Option', {'name': 'properties', 'type': 'Map'})
                    
                    # Fill color for markers, line color for lines
                    color_prop_name = 'lineColor' if sym_layer.get('class') == 'SimpleLine' else 'fillColor'
                    color_opt = ET.SubElement(props, 'Option', {'name': color_prop_name, 'type': 'Map'})
                    ET.SubElement(color_opt, 'Option', {'name': 'active', 'type': 'bool', 'value': 'true'})
                    ET.SubElement(color_opt, 'Option', {'name': 'type', 'type': 'int', 'value': '3'})
                    
                    # Red for New, Green for Existing
                    expr = "if( coalesce(\"exist_new\", coalesce(\"Exist_New\", coalesce(\"Exst_New\", \"Existing_New\")))='New', '255,0,0', '0,255,0' )"
                    ET.SubElement(color_opt, 'Option', {'name': 'expression', 'type': 'QString', 'value': expr})
                    changes += 1

        # 2. Inject Labels
        if layername in label_fields:
            field_to_label = label_fields[layername]
            # Ensure we don't duplicate labeling
            if layer.find('labeling') is None:
                # Basic QGIS 3 labeling XML structure
                labeling = ET.SubElement(layer, 'labeling', {'type': 'simple'})
                settings = ET.SubElement(labeling, 'settings', {'calloutType': 'simple'})
                
                # Text Style (Black text, white buffer/halo for visibility)
                ET.SubElement(settings, 'text-style', {
                    'fieldName': f'"{field_to_label}"', # Quotes to handle spaces in field name
                    'textColor': '0,0,0,255',
                    'fontSize': '10',
                    'isExpression': '1'
                })
                # Text Buffer (Halo)
                ET.SubElement(settings, 'text-buffer', {
                    'bufferSize': '1',
                    'bufferColor': '255,255,255,255',
                    'bufferDraw': '1'
                })
                ET.SubElement(settings, 'text-format')
                
                # Placement (Placement 0 = Point/Around point, 2 = Line)
                placement_type = '2' if layername in ['SLT_Cables', 'SLT_Ducts'] else '0'
                ET.SubElement(settings, 'placement', {'placement': placement_type, 'dist': '2'})
                
                print(f"  Injected auto-labels for {layername} using field {field_to_label}")
                changes += 1

        # 3. Inject UX Widgets (Checkboxes, Spinners, TextEdit)
        field_config_elem = layer.find('.//fieldConfiguration')
        if field_config_elem is not None:
            # Checkbox fields
            checkbox_fields = ['barbed', 'strut', 'overhead_guy', 'riser_pipe', 'power_enclosure', 'mounted_msan',
                               'BARBED', 'STRUT', 'OVERHEAD GUY', 'RISER PIPE', 'POWER ENCLOSURE', 'MOUNTED MSAN']
            for f_name in checkbox_fields:
                f_elem = field_config_elem.find(f"./field[@name='{f_name}']")
                if f_elem is not None:
                    ew = f_elem.find('editWidget')
                    if ew is not None: f_elem.remove(ew)
                    ew = ET.SubElement(f_elem, 'editWidget', {'type': 'CheckBox'})
                    config = ET.SubElement(ew, 'config')
                    opt_map = ET.SubElement(config, 'Option', {'type': 'Map'})
                    ET.SubElement(opt_map, 'Option', {'type': 'QString', 'name': 'CheckedState', 'value': 'Yes'})
                    ET.SubElement(opt_map, 'Option', {'type': 'QString', 'name': 'UncheckedState', 'value': 'No'})
                    changes += 1

            # Spinner fields
            spinner_fields = ['stays', 'number_of_risers', 'drop_wires_copper', 'drop_wires_fiber',
                              'STAYS', 'NUMBER OF RISERS', 'NO OF DROP WIRES(COPPER)', 'NO OF DROP WIRES(FIBER)']
            for f_name in spinner_fields:
                f_elem = field_config_elem.find(f"./field[@name='{f_name}']")
                if f_elem is not None:
                    ew = f_elem.find('editWidget')
                    if ew is not None: f_elem.remove(ew)
                    ew = ET.SubElement(f_elem, 'editWidget', {'type': 'Range'})
                    config = ET.SubElement(ew, 'config')
                    opt_map = ET.SubElement(config, 'Option', {'type': 'Map'})
                    ET.SubElement(opt_map, 'Option', {'type': 'double', 'name': 'Min', 'value': '0'})
                    ET.SubElement(opt_map, 'Option', {'type': 'double', 'name': 'Max', 'value': '100'})
                    ET.SubElement(opt_map, 'Option', {'type': 'double', 'name': 'Step', 'value': '1'})
                    changes += 1

            # Multi-line text fields for DP COUNT / FDP COUNT
            multiline_fields = ['dp_count', 'fdp_count', 'DP COUNT', 'FDP COUNT']
            for f_name in multiline_fields:
                f_elem = field_config_elem.find(f"./field[@name='{f_name}']")
                if f_elem is not None:
                    ew = f_elem.find('editWidget')
                    if ew is not None: f_elem.remove(ew)
                    ew = ET.SubElement(f_elem, 'editWidget', {'type': 'TextEdit'})
                    config = ET.SubElement(ew, 'config')
                    opt_map = ET.SubElement(config, 'Option', {'type': 'Map'})
                    ET.SubElement(opt_map, 'Option', {'type': 'bool', 'name': 'IsMultiline', 'value': 'true'})
                    changes += 1

        # 4. Inject Aliases for DP COUNT / FDP COUNT
        aliases_elem = layer.find('aliases')
        if aliases_elem is not None:
            for dp_field in ['dp_count', 'DP COUNT']:
                dp_alias = aliases_elem.find(f"alias[@field='{dp_field}']")
                if dp_alias is not None:
                    dp_alias.set('name', 'DP Numbers (e.g. DP1, DP2)')
                    changes += 1
            for fdp_field in ['fdp_count', 'FDP COUNT']:
                fdp_alias = aliases_elem.find(f"alias[@field='{fdp_field}']")
                if fdp_alias is not None:
                    fdp_alias.set('name', 'FDP Numbers/Names')
                    changes += 1

        # 5. Inject ValueMap Widgets
        if config_data and layername in config_data:
            field_configs = config_data[layername]
            field_config_elem = layer.find('.//fieldConfiguration')
            if field_config_elem is not None:
                for field_name, options in field_configs.items():
                    field_elem = field_config_elem.find(f"./field[@name='{field_name}']")
                    if field_elem is not None:
                        # Remove existing editWidget
                        existing_widget = field_elem.find('editWidget')
                        if existing_widget is not None:
                            field_elem.remove(existing_widget)

                        # Build ValueMap XML
                        edit_widget = ET.SubElement(field_elem, 'editWidget', {'type': 'ValueMap'})
                        config = ET.SubElement(edit_widget, 'config')
                        option_map1 = ET.SubElement(config, 'Option', {'type': 'Map'})
                        option_list = ET.SubElement(option_map1, 'Option', {'type': 'List', 'name': 'map'})
                        
                        for opt in options:
                            option_map2 = ET.SubElement(option_list, 'Option', {'type': 'Map'})
                            ET.SubElement(option_map2, 'Option', {'type': 'QString', 'name': str(opt), 'value': str(opt)})
                        
                        changes += 1
                        print(f"  Injected ValueMap for {layername}.{field_name} with {len(options)} options.")

    # 6. Auto-fix existing broken ValueMaps in the template project
    print("Running global scan to auto-repair existing broken ValueMaps...")
    for layer in root.findall('.//maplayer'):
        layername_elem = layer.find('layername')
        layername = layername_elem.text if layername_elem is not None else ""
        for field in layer.findall('.//fieldConfiguration/field'):
            field_name = field.get('name')
            edit_widget = field.find('editWidget')
            if edit_widget is not None and edit_widget.get('type') == 'ValueMap':
                opt_list = edit_widget.find(".//Option[@type='List'][@name='map']")
                if opt_list is not None:
                    repaired_options = []
                    has_broken = False
                    for opt_map in opt_list.findall("Option[@type='Map']"):
                        # Check if it has a child option named 'label'
                        label_opt = opt_map.find("Option[@name='label']")
                        if label_opt is not None:
                            has_broken = True
                            val = label_opt.get('value')
                            repaired_options.append(val)
                    
                    if has_broken:
                        # Clear old list and rebuild it correctly
                        for opt_map in list(opt_list):
                            opt_list.remove(opt_map)
                        
                        for val in repaired_options:
                            option_map2 = ET.SubElement(opt_list, 'Option', {'type': 'Map'})
                            ET.SubElement(option_map2, 'Option', {'type': 'QString', 'name': str(val), 'value': str(val)})
                        
                        changes += 1
                        print(f"  🔧 Auto-repaired broken ValueMap on layer '{layername}' field '{field_name}' (options: {repaired_options})")

    if changes > 0:
        tree.write(qgs_path, encoding='utf-8', xml_declaration=True)
        print(f"Patched {changes} configuration settings in the QGIS project.")

    return changes

import zipfile
import shutil

def patch_dynamic(qgz_path, config_data):
    if not os.path.exists(qgz_path):
        print(f"Error: {qgz_path} not found.")
        sys.exit(1)

    temp_dir = qgz_path + '_temp_extract'
    os.makedirs(temp_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(qgz_path, 'r') as z:
            z.extractall(temp_dir)

        qgs_files = [f for f in os.listdir(temp_dir) if f.endswith('.qgs')]
        if not qgs_files:
            print("No .qgs file found inside the .qgz archive.")
            sys.exit(1)
            
        qgs_path = os.path.join(temp_dir, qgs_files[0])
        
        # Call patch_qgs on the extracted file
        patch_qgs(qgs_path, config_data)
        
        # Repackage
        with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as z:
            for root_dir, _, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root_dir, file)
                    arcname = os.path.relpath(file_path, temp_dir)
                    z.write(file_path, arcname)
                    
        print(f"Successfully patched and repackaged {qgz_path}")

    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python patch-qgis-dynamic.py <path_to_qgz> <path_to_config_json>")
        sys.exit(1)
    
    qgz_file = sys.argv[1]
    config_json_file = sys.argv[2]
    
    config_data = {}
    if os.path.exists(config_json_file):
        with open(config_json_file, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
            
    patch_dynamic(qgz_file, config_data)
