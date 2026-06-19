import zipfile
import xml.etree.ElementTree as ET
import os

def search_qfield():
    qgz_path = 'QGIS Project Template/QGIS.qgz'
    if not os.path.exists(qgz_path):
        return

    with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
        qgs_file = [f for f in zip_ref.namelist() if f.endswith('.qgs')][0]
        with zip_ref.open(qgs_file) as xml_file:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            
            print("Searching XML elements for 'qfield':")
            count = 0
            for elem in root.iter():
                # Check tag, attrib keys/values, text
                elem_str = elem.tag + " " + str(elem.attrib) + " " + (elem.text or "")
                if 'qfield' in elem_str.lower():
                    print(f"Match in Tag: {elem.tag}")
                    print(f"  Attribs: {elem.attrib}")
                    if elem.text and len(elem.text.strip()) > 0:
                        print(f"  Text: {elem.text.strip()[:100]}")
                    
                    # Also print parent tag if possible
                    # we can find parent by storing parent mapping, but let's just show top match
                    count += 1
                    if count >= 30:
                        print("Too many matches, truncating...")
                        break
            if count == 0:
                print("No matches found for 'qfield'.")

search_qfield()
