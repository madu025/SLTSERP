import zipfile
import xml.etree.ElementTree as ET
import os

def audit_qgis_project():
    qgz_path = 'QGIS Project Template/QGIS.qgz'
    if not os.path.exists(qgz_path):
        print(f"Error: {qgz_path} not found.")
        return

    print(f"Auditing QGIS Project file: {qgz_path}")
    
    # QGZ is a zip file containing the QGS XML file
    with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
        file_list = zip_ref.namelist()
        print("Files inside QGZ archive:", file_list)
        
        qgs_file = [f for f in file_list if f.endswith('.qgs')][0]
        with zip_ref.open(qgs_file) as xml_file:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            
            # Find map layers
            print("\n--- Map Layers Found in Project ---")
            layers = root.findall('.//maplayer')
            if not layers:
                print("No layers found.")
            
            for layer in layers:
                name_elem = layer.find('layername')
                provider_elem = layer.find('provider')
                source_elem = layer.find('datasource')
                
                name = name_elem.text if name_elem is not None else "Unnamed"
                provider = provider_elem.text if provider_elem is not None else "None"
                source = source_elem.text if source_elem is not None else "None"
                
                print(f"Layer: {name}")
                print(f"  - Provider: {provider}")
                print(f"  - Datasource: {source}")
                print("-" * 30)

audit_qgis_project()
