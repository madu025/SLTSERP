import sys
import os
import zipfile
import tempfile
import shutil

# We need to extract QGIS.qgs from QGIS.qgz first to a temp dir
qgz_path = 'QGIS Project Template/QGIS.qgz'
if not os.path.exists(qgz_path):
    print(f"Error: {qgz_path} not found.")
    sys.exit(1)

temp_dir = tempfile.mkdtemp()
try:
    with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
    qgs_file = [f for f in os.listdir(temp_dir) if f.endswith('.qgs')][0]
    extracted_qgs = os.path.join(temp_dir, qgs_file)
    print(f"Extracted QGS to {extracted_qgs}")
    
    # Initialize QGIS Application
    from qgis.core import QgsApplication, QgsProject
    
    QgsApplication.setPrefixPath("/usr", True)
    qgs = QgsApplication([], False)
    qgs.initQgis()
    
    project = QgsProject.instance()
    if not project.read(extracted_qgs):
        print("Failed to read project XML")
        sys.exit(1)
        
    print("Success: Loaded QGIS Project!")
    print("Layers in project:")
    for layer_id, layer in project.mapLayers().items():
        print(f" - {layer.name()} (Type: {layer.type()})")
        
    qgs.exitQgis()
finally:
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
