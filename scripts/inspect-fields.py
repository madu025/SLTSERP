import zipfile
import xml.etree.ElementTree as ET
import os

def inspect_fields():
    qgz_path = 'QGIS Project Template/QGIS.qgz'
    if not os.path.exists(qgz_path):
        print(f"Error: {qgz_path} not found.")
        return

    with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
        qgs_file = [f for f in zip_ref.namelist() if f.endswith('.qgs')][0]
        with zip_ref.open(qgs_file) as xml_file:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            
            for layer in root.findall('.//maplayer'):
                name_elem = layer.find('layername')
                layer_name = name_elem.text if name_elem is not None else "Unnamed"
                
                fields_config = layer.find('fieldConfiguration')
                if fields_config is not None:
                    fields = [field.get('name') for field in fields_config.findall('.//field')]
                    print(f"Layer: {layer_name}")
                    print(f"  Fields: {fields}")
                    print("-" * 30)

if __name__ == '__main__':
    inspect_fields()
