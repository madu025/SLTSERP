import zipfile
import xml.etree.ElementTree as ET

qgz_path = 'QGIS Project Template/QGIS.qgz'
with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
    qgs_file = [f for f in zip_ref.namelist() if f.endswith('.qgs')][0]
    with zip_ref.open(qgs_file) as xml_file:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        for name in ['SLT_FJ', 'SLT_Poles', 'SLT_MH', 'SLT_HH', 'SLT_Cables']:
            layer = root.find(f".//maplayer[layername='{name}']")
            if layer is not None:
                print(f"Layer: {name}")
                print(f"  - ID: {layer.find('id').text if layer.find('id') is not None else 'None'}")
                
                # Check for readOnly tags
                ro = layer.find('readOnly')
                if ro is not None:
                    print(f"  - readOnly: {ro.text}")
                else:
                    print("  - readOnly: (Not Found)")
                
                # Check flags
                flags = layer.find('flags')
                if flags is not None:
                    print(f"  - flags: {ET.tostring(flags, encoding='utf-8').decode('utf-8').strip()}")
                
                # Check for any other attributes or tags containing read-only or lock
                for child in layer:
                    if 'readonly' in child.tag.lower() or (child.text and 'readonly' in child.text.lower()):
                        print(f"  - found potential read-only subtag: {child.tag} = {child.text}")
                print("-" * 80)
