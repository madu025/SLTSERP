import sys
import xml.etree.ElementTree as ET

EPSG4326_WKT = 'GEOGCRS["WGS 84",ENSEMBLE["World Geodetic System 1984 ensemble",MEMBER["World Geodetic System 1984 (Transit)"],MEMBER["World Geodetic System 1984 (G730)"],MEMBER["World Geodetic System 1984 (G873)"],MEMBER["World Geodetic System 1984 (G1150)"],MEMBER["World Geodetic System 1984 (G1674)"],MEMBER["World Geodetic System 1984 (G1762)"],MEMBER["World Geodetic System 1984 (G2139)"],MEMBER["World Geodetic System 1984 (G2296)"],ELLIPSOID["WGS 84",6378137,298.257223563,LENGTHUNIT["metre",1]],ENSEMBLEACCURACY[2.0]],PRIMEM["Greenwich",0,ANGLEUNIT["degree",0.0174532925199433]],CS[ellipsoidal,2],AXIS["geodetic latitude (Lat)",north,ORDER[1],ANGLEUNIT["degree",0.0174532925199433]],AXIS["geodetic longitude (Lon)",east,ORDER[2],ANGLEUNIT["degree",0.0174532925199433]],USAGE[SCOPE["Horizontal component of 3D system."],AREA["World."],BBOX[-90,-180,90,180]],ID["EPSG",4326]]'

def build_srs_4326(parent):
    srs = ET.SubElement(parent, 'spatialrefsys', {'nativeFormat': 'Wkt'})
    ET.SubElement(srs, 'wkt').text = EPSG4326_WKT
    ET.SubElement(srs, 'proj4').text = '+proj=longlat +datum=WGS84 +no_defs'
    ET.SubElement(srs, 'srsid').text = '3452'
    ET.SubElement(srs, 'srid').text = '4326'
    ET.SubElement(srs, 'authid').text = 'EPSG:4326'
    ET.SubElement(srs, 'description').text = 'WGS 84'
    ET.SubElement(srs, 'projectionacronym').text = 'longlat'
    ET.SubElement(srs, 'ellipsoidacronym').text = 'EPSG:7030'
    ET.SubElement(srs, 'geographicflag').text = 'true'

def patch_qgs(qgs_path, config_data):
    tree = ET.parse(qgs_path)
    root = tree.getroot()
    changes = 0

    # Project CRS -> EPSG:4326
    proj_crs = root.find('projectCrs')
    if proj_crs is None:
        proj_crs = ET.SubElement(root, 'projectCrs')
    for child in list(proj_crs):
        proj_crs.remove(child)
    build_srs_4326(proj_crs)
    changes += 1

    # Map Canvas
    mc = root.find('.//mapcanvas')
    if mc is not None:
        extent = mc.find('extent')
        if extent is not None:
            xmin = extent.find('xmin')
            if xmin is not None: xmin.text = '79.5'
            ymin = extent.find('ymin')
            if ymin is not None: ymin.text = '5.9'
            xmax = extent.find('xmax')
            if xmax is not None: xmax.text = '82.5'
            ymax = extent.find('ymax')
            if ymax is not None: ymax.text = '9.9'

        units = mc.find('units')
        if units is None:
            units = ET.SubElement(mc, 'units')
        units.text = 'degrees'

        dsrs = mc.find('destinationsrs')
        if dsrs is None:
            dsrs = ET.SubElement(mc, 'destinationsrs')
        for child in list(dsrs):
            dsrs.remove(child)
        build_srs_4326(dsrs)
        changes += 1

    # Fix transaction mode (must be AutomaticBuffered for QField editing)
    trans = root.find('transaction')
    if trans is not None and trans.get('mode') != 'AutomaticBuffered':
        trans.set('mode', 'AutomaticBuffered')
        changes += 1

    if changes > 0:
        tree.write(qgs_path, encoding='utf-8', xml_declaration=True)
        print(f"Patched {changes} configuration settings in the QGIS project.")

    return changes

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python patch-qgis-dynamic.py <path_to_qgs>")
        sys.exit(1)
    
    qgs_file = sys.argv[1]
    patch_qgs(qgs_file, {})
