import zipfile
import xml.etree.ElementTree as ET

z = zipfile.ZipFile('QGIS Project Template/QGIS.qgz')
qgs = [f for f in z.namelist() if f.endswith('.qgs')][0]
r = ET.parse(z.open(qgs)).getroot()

for layer in r.findall('.//maplayer'):
    name = layer.find('layername')
    if name is not None and name.text == 'SLT_Cables':
        print("Found SLT_Cables layer!")
        srs = layer.find('srs')
        if srs is not None:
            for child in srs:
                print(f"  srs/{child.tag}: {child.text or ''}")
                if child.tag == 'spatialrefsys':
                    for sub in child:
                        print(f"    srs/spatialrefsys/{sub.tag}: {sub.text or ''}")
        break
