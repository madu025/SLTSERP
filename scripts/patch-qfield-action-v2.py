import zipfile
import xml.etree.ElementTree as ET
import os
import tempfile
import shutil

def patch_qgis_project_v2():
    qgz_path = 'QGIS Project Template/QGIS.qgz'
    if not os.path.exists(qgz_path):
        print(f"Error: {qgz_path} not found.")
        return

    print(f"Patching QGIS Project file (V2): {qgz_path}")
    
    # Extract to a temp directory
    temp_dir = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
            
        qgs_file = [f for f in os.listdir(temp_dir) if f.endswith('.qgs')][0]
        qgs_path = os.path.join(temp_dir, qgs_file)
        
        # Parse XML
        tree = ET.parse(qgs_path)
        root = tree.getroot()
        
        patched_count = 0
        for layer in root.findall('.//maplayer'):
            layer_type = layer.get('type')
            name_elem = layer.find('layername')
            name = name_elem.text if name_elem is not None else "Unnamed"
            
            # We only want to patch our vector layers (geojson layers)
            if layer_type == 'vector' and name.startswith('SLT_'):
                custom_props = layer.find('customproperties')
                if custom_props is None:
                    custom_props = ET.SubElement(layer, 'customproperties')
                
                # 1. Flat property tag
                has_property = False
                for prop in custom_props.findall('property'):
                    if prop.get('key') == 'QFieldSync/action':
                        prop.set('value', 'offline')
                        has_property = True
                        break
                if not has_property:
                    ET.SubElement(custom_props, 'property', {
                        'key': 'QFieldSync/action',
                        'value': 'offline'
                    })
                    
                # 2. QGIS 3 Option Map tag
                option_map = custom_props.find(".//Option[@type='Map']")
                if option_map is not None:
                    has_option = False
                    for opt in option_map.findall('Option'):
                        if opt.get('name') == 'QFieldSync/action':
                            opt.set('value', 'offline')
                            opt.set('type', 'QString')
                            has_option = True
                            break
                    if not has_option:
                        ET.SubElement(option_map, 'Option', {
                            'type': 'QString',
                            'name': 'QFieldSync/action',
                            'value': 'offline'
                        })
                        print(f"  Added QFieldSync/action = offline to Option Map in layer: {name}")
                else:
                    print(f"  Added QFieldSync/action = offline as flat property in layer: {name}")
                
                patched_count += 1
                    
        if patched_count > 0:
            # Save back
            tree.write(qgs_path, encoding='utf-8', xml_declaration=True)
            
            # Re-zip
            backup_path = qgz_path + '.bak3'
            if os.path.exists(backup_path):
                os.remove(backup_path)
            shutil.copy2(qgz_path, backup_path)
            
            with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as zip_write:
                for root_dir, _, files in os.walk(temp_dir):
                    for file in files:
                        file_path = os.path.join(root_dir, file)
                        arcname = os.path.relpath(file_path, temp_dir)
                        zip_write.write(file_path, arcname)
                        
            print(f"Successfully patched {patched_count} layers and updated {qgz_path}")
        else:
            print("No layers needed patching.")
            
    finally:
        shutil.rmtree(temp_dir)

if __name__ == '__main__':
    patch_qgis_project_v2()
