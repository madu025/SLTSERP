import zipfile
import xml.etree.ElementTree as ET

qgz_path = 'QGIS Project Template/QGIS.qgz'
with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
    qgs_file = [f for f in zip_ref.namelist() if f.endswith('.qgs')][0]
    with zip_ref.open(qgs_file) as xml_file:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        for name in ['SLT_FJ', 'SLT_Poles', 'SLT_MH', 'SLT_HH']:
            layer = root.find(f".//maplayer[layername='{name}']")
            if layer is not None:
                print(f"Layer: {name}")
                custom_props = layer.find('customproperties')
                if custom_props is not None:
                    print(ET.tostring(custom_props, encoding='utf-8').decode('utf-8'))
                else:
                    print("  No customproperties element!")
                print("-" * 80)
