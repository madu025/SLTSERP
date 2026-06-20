import xml.etree.ElementTree as ET
import zipfile
import os
import shutil

QGZ_PATH = 'QGIS Project Template/QGIS.qgz'
QGS_EXTRACT = 'tmp_adv_features'

def inject_features():
    if os.path.exists(QGS_EXTRACT):
        shutil.rmtree(QGS_EXTRACT)
    os.makedirs(QGS_EXTRACT)

    with zipfile.ZipFile(QGZ_PATH, 'r') as z:
        z.extractall(QGS_EXTRACT)

    qgs_files = [f for f in os.listdir(QGS_EXTRACT) if f.endswith('.qgs')]
    qgs_path = os.path.join(QGS_EXTRACT, qgs_files[0])

    tree = ET.parse(qgs_path)
    root = tree.getroot()

    for layer in root.findall('.//maplayer'):
        if layer.get('type') != 'vector':
            continue
            
        layername = layer.find('layername').text
        if not layername: continue

        # 1. ADD PHOTO FIELD
        fc = layer.find('fieldConfiguration')
        if fc is not None:
            # Check if Photo already exists
            if fc.find("field[@name='Photo']") is None:
                field = ET.SubElement(fc, 'field', {'name': 'Photo', 'configurationFlags': 'None'})
                ew = ET.SubElement(field, 'editWidget', {'type': 'ExternalResource'})
                config = ET.SubElement(ew, 'config')
                opt_map = ET.SubElement(config, 'Option', {'type': 'Map'})
                ET.SubElement(opt_map, 'Option', {'name': 'DocumentViewer', 'type': 'int', 'value': '1'})
                ET.SubElement(opt_map, 'Option', {'name': 'DocumentViewerHeight', 'type': 'int', 'value': '0'})
                ET.SubElement(opt_map, 'Option', {'name': 'DocumentViewerWidth', 'type': 'int', 'value': '0'})
                ET.SubElement(opt_map, 'Option', {'name': 'FileWidget', 'type': 'bool', 'value': 'true'})
                ET.SubElement(opt_map, 'Option', {'name': 'FileWidgetButton', 'type': 'bool', 'value': 'true'})
                ET.SubElement(opt_map, 'Option', {'name': 'FileWidgetFilter', 'type': 'QString', 'value': ''})
                ET.SubElement(opt_map, 'Option', {'name': 'RelativeStorage', 'type': 'int', 'value': '1'})
                ET.SubElement(opt_map, 'Option', {'name': 'StorageMode', 'type': 'int', 'value': '0'})
                print(f"Added Photo field widget to {layername}")

        # Also add to aliases
        aliases = layer.find('aliases')
        if aliases is not None and aliases.find("alias[@field='Photo']") is None:
            # count existing aliases to find index
            idx = len(aliases.findall('alias'))
            ET.SubElement(aliases, 'alias', {'field': 'Photo', 'index': str(idx), 'name': ''})

        # Also add to defaults
        defaults = layer.find('defaults')
        if defaults is not None and defaults.find("default[@field='Photo']") is None:
            ET.SubElement(defaults, 'default', {'field': 'Photo', 'expression': '', 'applyOnUpdate': '0'})

        # Also add to constraints
        constraints = layer.find('constraints')
        if constraints is not None and constraints.find("constraint[@field='Photo']") is None:
            ET.SubElement(constraints, 'constraint', {'field': 'Photo', 'constraints': '0', 'unique_strength': '0', 'notnull_strength': '0', 'exp_strength': '0'})

        # Also add to constraintExpressions
        cexp = layer.find('constraintExpressions')
        if cexp is not None and cexp.find("constraint[@field='Photo']") is None:
            ET.SubElement(cexp, 'constraint', {'field': 'Photo', 'desc': '', 'exp': ''})

        # Also add to expressionfields
        ef = layer.find('expressionfields')
        if ef is None:
            ef = ET.SubElement(layer, 'expressionfields')

        # 2. AUTO LENGTH FOR CABLES/DUCTS
        if layername in ['SLT_Cables', 'SLT_Ducts']:
            defs = layer.find('defaults')
            if defs is not None:
                length_field = 'Length' if layername == 'SLT_Cables' else 'LENGTH'
                length_def = defs.find(f"default[@field='{length_field}']")
                if length_def is not None:
                    length_def.set('expression', '$length')
                    length_def.set('applyOnUpdate', '1')
                else:
                    ET.SubElement(defs, 'default', {'field': length_field, 'expression': '$length', 'applyOnUpdate': '1'})
                print(f"Added Auto-Length to {layername}")

        # 3. SMART LOCATION (AUTO-FILL ROAD NAME)
        if layername in ['SLT_Poles', 'SLT_FDP', 'SLT_MH', 'SLT_HH', 'SLT_FTC']:
            defs = layer.find('defaults')
            if defs is not None:
                road_def = defs.find("default[@field='ROAD NAME']")
                # overlay_nearest returns an array of the nearest features. [0] gets the closest one.
                # max_distance is in degrees (EPSG:4326). 0.002 degrees is approx 200 meters.
                expr = "overlay_nearest('SLT_Road_EOPs', \"Road_Name\", limit:=1, max_distance:=0.002)[0]"
                if road_def is not None:
                    road_def.set('expression', expr)
                    road_def.set('applyOnUpdate', '0')
                else:
                    ET.SubElement(defs, 'default', {'field': 'ROAD NAME', 'expression': expr, 'applyOnUpdate': '0'})
                print(f"Added Smart Location (Road Name) to {layername}")

    tree.write(qgs_path, encoding='utf-8', xml_declaration=True)

    with zipfile.ZipFile(QGZ_PATH, 'w', zipfile.ZIP_DEFLATED) as z:
        for root_dir, _, files in os.walk(QGS_EXTRACT):
            for file in files:
                file_path = os.path.join(root_dir, file)
                arcname = os.path.relpath(file_path, QGS_EXTRACT)
                z.write(file_path, arcname)

    shutil.rmtree(QGS_EXTRACT)
    print("Advanced features injected into template!")

if __name__ == '__main__':
    inject_features()
