import zipfile
import xml.etree.ElementTree as ET

z = zipfile.ZipFile('QGIS Project Template/QGIS.qgz')
qgs = [f for f in z.namelist() if f.endswith('.qgs')][0]
r = ET.parse(z.open(qgs)).getroot()

# Search for any variables or custom properties containing "QField" or "positioning" or "crs"
print("--- Searching for QField or Positioning in properties ---")
properties = r.find('.//properties')
if properties is not None:
    for prop in properties.iter():
        name = prop.get('name') or ''
        key = prop.get('key') or ''
        val = prop.text or ''
        if 'qfield' in name.lower() or 'qfield' in key.lower() or 'position' in name.lower() or 'position' in key.lower():
            print(f"Prop: name={name}, key={key}, text={val}")

print("\n--- Searching for customproperties elements in root ---")
for cp in r.findall('.//customproperties'):
    for prop in cp.iter():
        key = prop.get('key') or ''
        name = prop.get('name') or ''
        val = prop.get('value') or prop.text or ''
        if 'qfield' in key.lower() or 'qfield' in name.lower() or 'position' in key.lower() or 'position' in name.lower():
            print(f"CustomProp: key={key}, name={name}, val={val}")
