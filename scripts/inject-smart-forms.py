import xml.etree.ElementTree as ET
import zipfile
import os
import shutil

QGZ_PATH = 'QGIS Project Template/QGIS.qgz'
QGS_EXTRACT = 'tmp_smart_forms'

def inject_smart_forms():
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
        if layername != 'SLT_Poles':
            continue

        # 1. ADD NEW FIELDS
        fc = layer.find('fieldConfiguration')
        if fc is not None:
            # Check CONDITION
            if fc.find("field[@name='CONDITION']") is None:
                field = ET.SubElement(fc, 'field', {'name': 'CONDITION', 'configurationFlags': 'None'})
                ew = ET.SubElement(field, 'editWidget', {'type': 'TextEdit'})
                print(f"Added CONDITION field to {layername}")
                
            # Check DAMAGE_DESC
            if fc.find("field[@name='DAMAGE_DESC']") is None:
                field = ET.SubElement(fc, 'field', {'name': 'DAMAGE_DESC', 'configurationFlags': 'None'})
                ew = ET.SubElement(field, 'editWidget', {'type': 'TextEdit'})
                print(f"Added DAMAGE_DESC field to {layername}")

        aliases = layer.find('aliases')
        if aliases is not None:
            idx = len(aliases.findall('alias'))
            if aliases.find("alias[@field='CONDITION']") is None:
                ET.SubElement(aliases, 'alias', {'field': 'CONDITION', 'index': str(idx), 'name': ''})
                idx += 1
            if aliases.find("alias[@field='DAMAGE_DESC']") is None:
                ET.SubElement(aliases, 'alias', {'field': 'DAMAGE_DESC', 'index': str(idx), 'name': ''})

        defaults = layer.find('defaults')
        if defaults is not None:
            if defaults.find("default[@field='CONDITION']") is None:
                ET.SubElement(defaults, 'default', {'field': 'CONDITION', 'expression': "'Good'", 'applyOnUpdate': '0'})
            if defaults.find("default[@field='DAMAGE_DESC']") is None:
                ET.SubElement(defaults, 'default', {'field': 'DAMAGE_DESC', 'expression': "''", 'applyOnUpdate': '0'})

        # Update constraints
        constraints = layer.find('constraints')
        if constraints is not None:
            if constraints.find("constraint[@field='CONDITION']") is None:
                ET.SubElement(constraints, 'constraint', {'field': 'CONDITION', 'constraints': '0', 'unique_strength': '0', 'notnull_strength': '0', 'exp_strength': '0'})
            if constraints.find("constraint[@field='DAMAGE_DESC']") is None:
                ET.SubElement(constraints, 'constraint', {'field': 'DAMAGE_DESC', 'constraints': '0', 'unique_strength': '0', 'notnull_strength': '0', 'exp_strength': '0'})

        cexp = layer.find('constraintExpressions')
        if cexp is not None:
            if cexp.find("constraint[@field='CONDITION']") is None:
                ET.SubElement(cexp, 'constraint', {'field': 'CONDITION', 'desc': '', 'exp': ''})
            if cexp.find("constraint[@field='DAMAGE_DESC']") is None:
                ET.SubElement(cexp, 'constraint', {'field': 'DAMAGE_DESC', 'desc': '', 'exp': ''})

        # 2. BUILD TABBED LAYOUT
        editorlayout = layer.find('editorlayout')
        if editorlayout is None:
            editorlayout = ET.SubElement(layer, 'editorlayout')
        editorlayout.text = 'tablayout'

        form = layer.find('attributeEditorForm')
        if form is not None:
            layer.remove(form)
            
        form = ET.SubElement(layer, 'attributeEditorForm')

        # Collect all fields and their indexes from aliases
        field_indexes = {}
        for alias in aliases.findall('alias'):
            field_indexes[alias.get('field')] = alias.get('index')

        # Define Tab structure
        tabs = {
            "Basic Info": ['PL_Number', 'Exist_New', 'ROAD NAME', 'SIDE', 'LAC', 'LEA'],
            "Technical": ['POLE TYPE', 'POLE MAKE', 'POLE HEIGHT', 'NUMBER OF RISERS', 'RISER PIPE', 'STAYS', 'STRUT', 'OVERHEAD GUY', 'BARBED', 'POWER ENCLOSURE', 'MOUNTED MSAN', 'DP COUNT', 'FDP COUNT', 'NO OF DROP WIRES(COPPER)', 'NO OF DROP WIRES(FIBER)', 'ADJACENT PREVIOUS', 'JOINT', 'REMARK'],
            "Location & System": ['Latitude', 'Longitute', 'fid'],
            "Condition & Damage": ['CONDITION', 'DAMAGE_DESC'],
            "Photos": ['Photo']
        }

        for tab_name, fields in tabs.items():
            tab = ET.SubElement(form, 'attributeEditorContainer', {
                'name': tab_name,
                'columnCount': '1',
                'showLabel': '1',
                'groupBox': '0',
                'visibilityExpressionEnabled': '0',
                'visibilityExpression': ''
            })
            for fname in fields:
                if fname in field_indexes:
                    field_elem = ET.SubElement(tab, 'attributeEditorField', {
                        'name': fname,
                        'index': field_indexes[fname],
                        'showLabel': '1'
                    })
                    # Conditionally show DAMAGE_DESC
                    if fname == 'DAMAGE_DESC':
                        ET.SubElement(field_elem, 'visibilityExpression', {'enabled': '1'}).text = "\"CONDITION\" = 'Damaged'"

        print(f"Created Smart Tabbed Form for {layername}")

    tree.write(qgs_path, encoding='utf-8', xml_declaration=True)

    with zipfile.ZipFile(QGZ_PATH, 'w', zipfile.ZIP_DEFLATED) as z:
        for root_dir, _, files in os.walk(QGS_EXTRACT):
            for file in files:
                file_path = os.path.join(root_dir, file)
                arcname = os.path.relpath(file_path, QGS_EXTRACT)
                z.write(file_path, arcname)

    shutil.rmtree(QGS_EXTRACT)
    print("Smart Forms injected into template!")

if __name__ == '__main__':
    inject_smart_forms()
