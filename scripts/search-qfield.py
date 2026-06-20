import zipfile
import re

qgz_path = 'QGIS Project Template/QGIS.qgz'
with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
    qgs_file = [f for f in zip_ref.namelist() if f.endswith('.qgs')][0]
    with zip_ref.open(qgs_file) as xml_file:
        content = xml_file.read().decode('utf-8')
        
        matches = re.findall(r'<[^>]*read[^>]*>', content, re.IGNORECASE)
        print(f"Found {len(matches)} tags containing 'read':")
        for idx, match in enumerate(matches[:30]):
            print(f"{idx+1}: {match.strip()}")
            
        # Let's search for "readOnly" as attribute or tag value
        matches2 = re.findall(r'readOnly="[^"]*"', content, re.IGNORECASE)
        print(f"\nFound {len(matches2)} readOnly attributes:")
        for idx, match in enumerate(matches2[:30]):
            print(f"{idx+1}: {match.strip()}")
