import zipfile
import xml.etree.ElementTree as ET
import os

qgz_path = 'QGIS Project Template/QGIS.qgz'
qgs_path = 'QGIS Project Template/QGIS.qgs'

EPSG4326_WKT = 'GEOGCRS["WGS 84",ENSEMBLE["World Geodetic System 1984 ensemble",MEMBER["World Geodetic System 1984 (Transit)"],MEMBER["World Geodetic System 1984 (G730)"],MEMBER["World Geodetic System 1984 (G873)"],MEMBER["World Geodetic System 1984 (G1150)"],MEMBER["World Geodetic System 1984 (G1674)"],MEMBER["World Geodetic System 1984 (G1762)"],MEMBER["World Geodetic System 1984 (G2139)"],MEMBER["World Geodetic System 1984 (G2296)"],ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]],ENSEMBLEACCURACY[2.0]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["geodetic latitude (Lat)",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["geodetic longitude (Lon)",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],USAGE[SCOPE["Horizontal component of 3D system."],AREA["World."],BBOX[-90,-180,90,180]],ID["EPSG",4326]]'

def force_crs_epsg4326(file_path):
    tree = ET.parse(file_path)
    root = tree.getroot()
    proj_crs = root.find('projectCrs')
    if proj_crs is None:
        proj_crs = ET.SubElement(root, 'projectCrs')
    
    # clear existing children
    for child in list(proj_crs):
        proj_crs.remove(child)
        
    srs = ET.SubElement(proj_crs, 'spatialrefsys', {'nativeFormat': 'Wkt'})
    ET.SubElement(srs, 'wkt').text = EPSG4326_WKT
    ET.SubElement(srs, 'proj4').text = '+proj=longlat +datum=WGS84 +no_defs'
    ET.SubElement(srs, 'srsid').text = '3452'
    ET.SubElement(srs, 'srid').text = '4326'
    ET.SubElement(srs, 'authid').text = 'EPSG:4326'
    ET.SubElement(srs, 'description').text = 'WGS 84'
    ET.SubElement(srs, 'projectionacronym').text = 'longlat'
    ET.SubElement(srs, 'ellipsoidacronym').text = 'EPSG:7030'
    ET.SubElement(srs, 'geographicflag').text = 'true'
    
    tree.write(file_path, encoding='utf-8', xml_declaration=True)

# 1. Extract QGZ
with zipfile.ZipFile(qgz_path, 'r') as z:
    z.extractall('tmp_crs_fix')

qgs_in_zip = [f for f in os.listdir('tmp_crs_fix') if f.endswith('.qgs')][0]
qgs_extracted_path = os.path.join('tmp_crs_fix', qgs_in_zip)

# 2. Fix QGS
force_crs_epsg4326(qgs_extracted_path)
if os.path.exists(qgs_path):
    force_crs_epsg4326(qgs_path)

# 3. Repack
with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in os.listdir('tmp_crs_fix'):
        z.write(os.path.join('tmp_crs_fix', f), f)

print("Project CRS forced to EPSG:4326")
