import zipfile
import xml.etree.ElementTree as ET
import os

def find_spatialrefsys():
    qgz_path = 'QGIS Project Template/QGIS.qgz'
    if not os.path.exists(qgz_path):
        return

    with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
        qgs_file = [f for f in zip_ref.namelist() if f.endswith('.qgs')][0]
        with zip_ref.open(qgs_file) as xml_file:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            
            srs_elems = root.findall('.//spatialrefsys')
            print(f"Found {len(srs_elems)} spatialrefsys elements.")
            for i, srs in enumerate(srs_elems[:5]):
                print(f"\nElement {i}:")
                for child in srs:
                    print(f"  {child.tag}: {child.text or ''}")
                    # Print subchildren
                    for sub in child:
                        print(f"    {sub.tag}: {sub.text or ''}")

find_spatialrefsys()
