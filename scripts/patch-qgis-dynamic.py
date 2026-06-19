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

        modified = False
        
        # Loop through layers in configuration
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
                            print(f"Patched field '{layer_name}.{field_name}' with options: {options}")
                            modified = True

        if modified:
            # Write modified XML back
            tree.write(qgs_path, encoding='utf-8', xml_declaration=True)
            
            # Repack the zip file
            with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
                for file in file_list:
                    file_path = os.path.join(temp_dir, file)
                    zip_ref.write(file_path, file)
            print("Successfully patched and repacked QGIS project.")
        else:
            print("No fields were modified.")

    except Exception as e:
        print(f"Failed to patch project: {e}")
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
