import sys
import os
import zipfile
import shutil

# Files and paths
qgz_path = 'QGIS Project Template/QGIS.qgz'
qgs_path = 'QGIS Project Template/QGIS.qgs'
geopackage_dir = 'QGIS Project Template/GeoPackage'

if not os.path.exists(qgz_path):
    print(f"Error: {qgz_path} not found.")
    sys.exit(1)

# Create GeoPackage folder
os.makedirs(geopackage_dir, exist_ok=True)

try:
    # 1. Extract QGIS.qgs to QGIS Project Template/QGIS.qgs
    print("Extracting QGIS.qgs to template folder...")
    with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
        # Extract QGIS.qgs and other files to QGIS Project Template
        for name in zip_ref.namelist():
            if not name.endswith('/'): # Skip directories
                zip_ref.extract(name, 'QGIS Project Template')
                
    if not os.path.exists(qgs_path):
        print(f"Error: QGIS.qgs was not extracted to {qgs_path}")
        sys.exit(1)
        
    print(f"Extracted QGS file successfully to {qgs_path}")
    
    # 2. Initialize QGIS Application
    from qgis.core import QgsApplication, QgsProject, QgsVectorFileWriter
    
    QgsApplication.setPrefixPath("/usr", True)
    qgs = QgsApplication([], False)
    qgs.initQgis()
    
    project = QgsProject.instance()
    if not project.read(qgs_path):
        print("Failed to read project XML")
        sys.exit(1)
        
    print("QGIS project loaded successfully.")
    
    # 3. Process each vector layer
    for layer_id, layer in list(project.mapLayers().items()):
        # Check if it's a vector layer and matches our SLT prefix
        if layer.type() == 0 and layer.name().startswith('SLT_'):
            layer_name = layer.name()
            print(f"\nProcessing layer: {layer_name}")
            print(f"  - Valid: {layer.isValid()}")
            print(f"  - Provider: {layer.providerType()}")
            print(f"  - Source: {layer.source()}")
            
            gpkg_filename = f"{layer_name}.gpkg"
            gpkg_file_path = os.path.join(geopackage_dir, gpkg_filename)
            
            # Clean old GPKG if exists
            if os.path.exists(gpkg_file_path):
                os.remove(gpkg_file_path)
                
            # Set up save options for GeoPackage
            options = QgsVectorFileWriter.SaveVectorOptions()
            options.driverName = "GPKG"
            options.layerName = layer_name
            options.actionOnExistingFile = QgsVectorFileWriter.CreateOrOverwriteFile
            
            # Write to GeoPackage
            print(f"  - Writing GeoPackage to {gpkg_file_path}")
            err, err_msg, new_path, new_layer_name = QgsVectorFileWriter.writeAsVectorFormatV3(
                layer,
                gpkg_file_path,
                project.transformContext(),
                options
            )
            
            if err != QgsVectorFileWriter.NoError:
                print(f"  - Error writing GeoPackage for {layer_name}: {err_msg}")
                continue
                
            # Change the data source of the layer in the QGIS project to the GPKG file
            # Note the relative path inside the zip file will be ./GeoPackage/SLT_Name.gpkg
            relative_gpkg_path = f"./GeoPackage/{gpkg_filename}"
            print(f"  - Setting data source to {relative_gpkg_path}")
            
            # Use layer.setDataSource
            layer.setDataSource(relative_gpkg_path, layer_name, "ogr")
            
            # Ensure QFieldSync properties are set to offline
            layer.setCustomProperty("QFieldSync/action", "offline")
            print(f"  - Verified Custom Properties: QFieldSync/action = {layer.customProperty('QFieldSync/action')}")
            
    # 4. Save the project XML back
    print("\nSaving updated project XML...")
    project.write()
    
    # 5. Pack everything back into QGIS.qgz
    print("Repackaging QGIS.qgz...")
    
    # Backup original QGZ
    backup_path = qgz_path + '.bak4'
    if os.path.exists(backup_path):
        os.remove(backup_path)
    shutil.copy2(qgz_path, backup_path)
    print(f"Backup created at {backup_path}")
    
    # We want to zip QGIS.qgs and any other styles databases extracted
    with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as zip_write:
        # List of files we extracted (excluding directories, .bak files, etc)
        # Usually QGIS.qgs and style databases (like *styles.db)
        for f in os.listdir('QGIS Project Template'):
            if f.endswith('.qgs') or f.endswith('_styles.db'):
                file_path = os.path.join('QGIS Project Template', f)
                zip_write.write(file_path, f)
                print(f"  - Zipped file: {f}")
                
    print(f"Successfully converted layers and repacked {qgz_path}")
    
    qgs.exitQgis()
finally:
    # Clean up the extracted files
    print("Cleaning up extracted project files...")
    for f in os.listdir('QGIS Project Template'):
        if f.endswith('.qgs') or f.endswith('_styles.db'):
            file_path = os.path.join('QGIS Project Template', f)
            if os.path.exists(file_path):
                os.remove(file_path)
