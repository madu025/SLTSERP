import zipfile
import xml.etree.ElementTree as ET
import os

qgz_path = 'QGIS Project Template/QGIS.qgz'
with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
    qgs_file = [f for f in zip_ref.namelist() if f.endswith('.qgs')][0]
    with zip_ref.open(qgs_file) as xml_file:
        tree = ET.parse(xml_file)
        root = tree.getroot()
        
        for layer in root.findall('.//maplayer'):
            name_elem = layer.find('layername')
            if name_elem is not None and name_elem.text.startswith('SLT_'):
                name = name_elem.text
                datasource = layer.find('datasource')
                provider = layer.find('provider')
                print(f"Layer: {name}")
                print(f"  - Provider: {provider.text if provider is not None else 'None'}")
                print(f"  - Datasource: {datasource.text if datasource is not None else 'None'}")
