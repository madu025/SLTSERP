import zipfile
import xml.etree.ElementTree as ET
import os
import shutil

def patch_crs_and_extent():
    qgz_path = 'QGIS Project Template/QGIS.qgz'
    if not os.path.exists(qgz_path):
        print(f"Error: {qgz_path} not found.")
        return

    print(f"Patching Project CRS and Extent in {qgz_path}...")
    temp_dir = 'tmp_patch_crs_extent'
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # Extract files
        with zipfile.ZipFile(qgz_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
            file_list = zip_ref.namelist()

        qgs_file_name = [f for f in file_list if f.endswith('.qgs')][0]
        qgs_path = os.path.join(temp_dir, qgs_file_name)

        # Parse XML
        tree = ET.parse(qgs_path)
        root = tree.getroot()

        # 1. Update Project CRS to EPSG:4326 (WGS 84)
        proj_crs = root.find('projectCrs')
        if proj_crs is not None:
            srs = proj_crs.find('spatialrefsys')
            if srs is not None:
                srs.find('wkt').text = 'GEOGCRS["WGS 84",ENSEMBLE["World Geodetic System 1984 ensemble",MEMBER["World Geodetic System 1984 (Transit)"],MEMBER["World Geodetic System 1984 (G730)"],MEMBER["World Geodetic System 1984 (G873)"],MEMBER["World Geodetic System 1984 (G1150)"],MEMBER["World Geodetic System 1984 (G1674)"],MEMBER["World Geodetic System 1984 (G1762)"],MEMBER["World Geodetic System 1984 (G2139)"],MEMBER["World Geodetic System 1984 (G2296)"],ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]],ENSEMBLEACCURACY[2.0]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["geodetic latitude (Lat)",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["geodetic longitude (Lon)",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],USAGE[SCOPE["Horizontal component of 3D system."],AREA["World."],BBOX[-90,-180,90,180]],ID["EPSG",4326]]'
                srs.find('proj4').text = '+proj=longlat +datum=WGS84 +no_defs'
                srs.find('srsid').text = '3452'
                srs.find('srid').text = '4326'
                srs.find('authid').text = 'EPSG:4326'
                srs.find('description').text = 'WGS 84'
                srs.find('projectionacronym').text = 'longlat'
                srs.find('ellipsoidacronym').text = 'EPSG:7030'
                srs.find('geographicflag').text = 'true'
                print("  Set Project CRS to EPSG:4326")

        # 2. Update Map Canvas Extent to Sri Lanka bounds in degrees (EPSG:4326)
        mc = root.find('.//mapcanvas')
        if mc is not None:
            extent = mc.find('extent')
            if extent is not None:
                extent.find('xmin').text = '79.5'
                extent.find('ymin').text = '5.9'
                extent.find('xmax').text = '82.5'
                extent.find('ymax').text = '9.9'
                print("  Set Map Canvas Extent to Sri Lanka (degrees: 79.5, 5.9, 82.5, 9.9)")

        # 3. Update raster base layers (Google Maps, Google Hybrid, OpenStreetMap) datasource URLs to use zmax=22
        for layer in root.findall('.//maplayer'):
            if layer.get('type') == 'raster':
                datasource = layer.find('datasource')
                layername_elem = layer.find('layername')
                layername = layername_elem.text if layername_elem is not None else ''
                if datasource is not None and datasource.text:
                    old_text = datasource.text
                    # Replace zmax=18 or zmax=19 with zmax=22
                    new_text = old_text.replace('zmax=18', 'zmax=22').replace('zmax=19', 'zmax=22')
                    # Also replace in unescaped forms if any
                    new_text = new_text.replace('zmax%3D18', 'zmax%3D22').replace('zmax%3D19', 'zmax%3D22')
                    if new_text != old_text:
                        datasource.text = new_text
                        print(f"  Updated datasource zmax for raster layer '{layername}': {new_text}")

        # 4. Set transaction mode to AutomaticBuffered
        trans = root.find('transaction')
        if trans is not None:
            trans.set('mode', 'AutomaticBuffered')
            print("  Set transaction mode to AutomaticBuffered")

        # Write modified XML back
        tree.write(qgs_path, encoding='utf-8', xml_declaration=True)

        # Repack the zip file
        with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
            for file in file_list:
                file_path = os.path.join(temp_dir, file)
                zip_ref.write(file_path, file)
        print("Successfully patched and repacked QGIS project with EPSG:4326 CRS & degrees extent.")

    finally:
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

if __name__ == '__main__':
    patch_crs_and_extent()
