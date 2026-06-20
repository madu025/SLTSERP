import zipfile
import xml.etree.ElementTree as ET

qgz_path = 'QGIS Project Template/QGIS.qgz'
with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
    qgs_file = [f for f in zip_ref.namelist() if f.endswith('.qgs')][0]
    with zip_ref.open(qgs_file) as xml_file:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        layer = root.find(".//maplayer[layername='SLT_Poles']")
        if layer is not None:
            print("Layer: SLT_Poles")
            custom_props = layer.find('customproperties')
            if custom_props is not None:
                for child in custom_props:
                    print(f"  Tag: {child.tag}, Attribs: {child.attrib}")
                    # If it's a property, print key and value
                    if child.tag == 'property':
                        print(f"    Key: {child.get('key')} = {child.get('value')}")
                    # If it's QGIS 3 Option
                    elif child.tag == 'Option':
                        print(f"    Option Name: {child.get('name')} = {child.get('value')}")
                        for sub in child:
                            print(f"      Sub: {sub.tag}, Attribs: {sub.attrib}")
            else:
                print("No customproperties found.")
        else:
            print("SLT_Poles layer not found.")
