import zipfile
import xml.etree.ElementTree as ET
import os

def check_crs():
    qgz_path = 'QGIS Project Template/QGIS.qgz'
    if not os.path.exists(qgz_path):
        return

    with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
        qgs_file = [f for f in zip_ref.namelist() if f.endswith('.qgs')][0]
        with zip_ref.open(qgs_file) as xml_file:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            
            # Find CRS
            projection = root.find('.//projectionparameters')
            if projection is not None:
                print("Projection Parameters:")
                for child in projection:
                    print(f"  {child.tag}: {child.text or ''}")
            
            # Find spatialrefsys
            srs = root.find('.//spatialrefsys')
            if srs is not None:
                print("\nSpatial Reference System:")
                authid = srs.find('authid')
                description = srs.find('description')
                print(f"  AuthID: {authid.text if authid is not None else 'None'}")
                print(f"  Description: {description.text if description is not None else 'None'}")

check_crs()
