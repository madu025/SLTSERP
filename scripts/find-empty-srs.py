import zipfile
import xml.etree.ElementTree as ET

z = zipfile.ZipFile('QGIS Project Template/QGIS.qgz')
qgs = [f for f in z.namelist() if f.endswith('.qgs')][0]
doc = ET.parse(z.open(qgs))
root = doc.getroot()

def get_xpath(node, parent_map):
    path = []
    curr = node
    while curr is not None:
        path.append(curr.tag)
        curr = parent_map.get(curr)
    return '/'.join(reversed(path))

# Build parent map
parent_map = {c: p for p in root.iter() for c in p}

for srs in root.findall('.//spatialrefsys'):
    authid = srs.find('authid')
    authid_text = authid.text if authid is not None else ''
    if not authid_text:
        print(f"Empty spatialrefsys found at: {get_xpath(srs, parent_map)}")
        # Print parent elements or details
        parent = parent_map.get(srs)
        if parent is not None:
            print(f"  Parent tag: {parent.tag}, attrib: {parent.attrib}")
            # print parent's parent
            gp = parent_map.get(parent)
            if gp is not None:
                print(f"    Grandparent tag: {gp.tag}, attrib: {gp.attrib}")
