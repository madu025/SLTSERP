import zipfile
import xml.etree.ElementTree as ET

z = zipfile.ZipFile('QGIS Project Template/QGIS.qgz')
qgs = [f for f in z.namelist() if f.endswith('.qgs')][0]
r = ET.parse(z.open(qgs)).getroot()

print("--- CRS and SRS elements in QGIS.qgs ---")
for elem in r.iter():
    if elem.tag in ['projectCrs', 'destinationsrs', 'crs', 'spatialrefsys']:
        authid = elem.find('authid')
        srid = elem.find('srid')
        description = elem.find('description')
        print(f"Tag: {elem.tag}")
        if authid is not None:
            print(f"  authid: {authid.text}")
        if srid is not None:
            print(f"  srid: {srid.text}")
        if description is not None:
            print(f"  description: {description.text}")
        # Print parent info if possible
