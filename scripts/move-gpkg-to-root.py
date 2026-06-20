import zipfile
import xml.etree.ElementTree as ET
import os
import shutil

qgz_path = 'QGIS Project Template/QGIS.qgz'
geopackage_dir = 'QGIS Project Template/GeoPackage'
template_dir = 'QGIS Project Template'

if not os.path.exists(qgz_path):
    print("Error: QGIS.qgz not found.")
    exit(1)

# Extract
temp_dir = 'QGIS Project Template/temp_extract'
os.makedirs(temp_dir, exist_ok=True)
with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
    zip_ref.extractall(temp_dir)
    file_list = zip_ref.namelist()

qgs_file = [f for f in file_list if f.endswith('.qgs')][0]
qgs_path = os.path.join(temp_dir, qgs_file)

# Parse XML
tree = ET.parse(qgs_path)
root = tree.getroot()

modified = False
for layer in root.findall('.//maplayer'):
    name_elem = layer.find('layername')
    if name_elem is not None and name_elem.text.startswith('SLT_'):
        name = name_elem.text
        datasource_elem = layer.find('datasource')
        if datasource_elem is not None:
            old_ds = datasource_elem.text
            # Replace ./GeoPackage/SLT_Name.gpkg with ./SLT_Name.gpkg
            new_ds = old_ds.replace('./GeoPackage/', './')
            if old_ds != new_ds:
                datasource_elem.text = new_ds
                print(f"Updated datasource for {name}: {old_ds} -> {new_ds}")
                modified = True

if modified:
    # Save back XML
    tree.write(qgs_path, encoding='utf-8', xml_declaration=True)
    
    # Backup original
    shutil.copy2(qgz_path, qgz_path + '.bak_root')
    
    # Re-zip
    with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as zip_write:
        for f in file_list:
            zip_write.write(os.path.join(temp_dir, f), f)
    print("Successfully updated QGIS.qgz with flat root paths.")

# Clean temp extract
shutil.rmtree(temp_dir)

# Copy GPKG files from GeoPackage/ to root
if os.path.exists(geopackage_dir):
    for f in os.listdir(geopackage_dir):
        if f.endswith('.gpkg'):
            src = os.path.join(geopackage_dir, f)
            dst = os.path.join(template_dir, f)
            shutil.copy2(src, dst)
            print(f"Copied {f} to template root.")
