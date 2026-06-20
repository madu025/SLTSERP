import zipfile
import xml.etree.ElementTree as ET
import os

qgz_path = 'QGIS Project Template/QGIS.qgz'
qgs_path = 'QGIS Project Template/QGIS.qgs'

EPSG3857_WKT = 'PROJCRS["WGS 84 / Pseudo-Mercator",BASEGEOGCRS["WGS 84",ENSEMBLE["World Geodetic System 1984 ensemble",MEMBER["World Geodetic System 1984 (Transit)"],MEMBER["World Geodetic System 1984 (G730)"],MEMBER["World Geodetic System 1984 (G873)"],MEMBER["World Geodetic System 1984 (G1150)"],MEMBER["World Geodetic System 1984 (G1674)"],MEMBER["World Geodetic System 1984 (G1762)"],MEMBER["World Geodetic System 1984 (G2139)"],MEMBER["World Geodetic System 1984 (G2296)"],ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]],ENSEMBLEACCURACY[2.0]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["geodetic latitude (Lat)",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["geodetic longitude (Lon)",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],ID["EPSG",4326]],CONVERSION["Popular Visualisation Pseudo Mercator",METHOD["Popular Visualisation Pseudo Mercator",ID["EPSG",1024]],PARAMETER["Latitude of natural origin",0,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8801]],PARAMETER["Longitude of natural origin",0,ANGLEUNIT["degree",0.0174532925199433],ID["EPSG",8802]],PARAMETER["False easting",0,LENGTHUNIT["metre",1],ID["EPSG",8806]],PARAMETER["False northing",0,LENGTHUNIT["metre",1],ID["EPSG",8807]]],CS[Cartesian,2],AXIS["easting (X)",east,ORDER[1],LENGTHUNIT["metre",1]],AXIS["northing (Y)",north,ORDER[2],LENGTHUNIT["metre",1]],USAGE[SCOPE["Web mapping and visualisation."],AREA["World between 85.06 degrees S and 85.06 degrees N."],BBOX[-85.06,-180,85.06,180]],ID["EPSG",3857]]'

def force_crs_epsg3857(file_path):
    tree = ET.parse(file_path)
    root = tree.getroot()
    proj_crs = root.find('projectCrs')
    if proj_crs is None:
        proj_crs = ET.SubElement(root, 'projectCrs')
    
    # clear existing children
    for child in list(proj_crs):
        proj_crs.remove(child)
        
    srs = ET.SubElement(proj_crs, 'spatialrefsys', {'nativeFormat': 'Wkt'})
    ET.SubElement(srs, 'wkt').text = EPSG3857_WKT
    ET.SubElement(srs, 'proj4').text = '+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs'
    ET.SubElement(srs, 'srsid').text = '3857'
    ET.SubElement(srs, 'srid').text = '3857'
    ET.SubElement(srs, 'authid').text = 'EPSG:3857'
    ET.SubElement(srs, 'description').text = 'WGS 84 / Pseudo-Mercator'
    ET.SubElement(srs, 'projectionacronym').text = 'merc'
    ET.SubElement(srs, 'ellipsoidacronym').text = 'EPSG:7030'
    ET.SubElement(srs, 'geographicflag').text = 'false'
    
    # Extent
    mc = root.find('.//mapcanvas')
    if mc is not None:
        extent = mc.find('extent')
        if extent is not None:
            xmin = extent.find('xmin')
            if xmin is not None: xmin.text = '8849899'
            ymin = extent.find('ymin')
            if ymin is not None: ymin.text = '657948'
            xmax = extent.find('xmax')
            if xmax is not None: xmax.text = '9183857'
            ymax = extent.find('ymax')
            if ymax is not None: ymax.text = '1107588'
            
    tree.write(file_path, encoding='utf-8', xml_declaration=True)

# 1. Extract QGZ
with zipfile.ZipFile(qgz_path, 'r') as z:
    z.extractall('tmp_crs_fix')

qgs_in_zip = [f for f in os.listdir('tmp_crs_fix') if f.endswith('.qgs')][0]
qgs_extracted_path = os.path.join('tmp_crs_fix', qgs_in_zip)

# 2. Fix QGS
force_crs_epsg3857(qgs_extracted_path)
if os.path.exists(qgs_path):
    force_crs_epsg3857(qgs_path)

# 3. Repack
with zipfile.ZipFile(qgz_path, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in os.listdir('tmp_crs_fix'):
        z.write(os.path.join('tmp_crs_fix', f), f)

print("Project CRS forced to EPSG:3857 and Extent updated")
