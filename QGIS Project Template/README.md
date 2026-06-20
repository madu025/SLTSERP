# QField Mobile App Configuration for Sri Lanka

**IMPORTANT READ BEFORE MODIFYING QGIS TEMPLATES**

The QGIS Project Templates in this directory are meticulously configured to avoid major rendering and positioning bugs in the QField Android/iOS mobile application. If you modify the `QGIS.qgz` or `QGIS.qgs` files manually, you MUST strictly adhere to the following rules.

## The "Black Screen" and "Null Island" Bug
If these settings are incorrect, the QField app will exhibit two common bugs:
1. **Black Screen on Zoom**: When a user presses the GPS location button, the screen goes completely black. This happens when QField fails to accurately reproject XYZ tile rasters (Google Maps, OpenStreetMap) at high zoom levels due to a missing or broken `destinationsrs` or `units` setup.
2. **Null Island (Gulf of Guinea)**: The GPS dot shows up at coordinates 0,0 instead of Sri Lanka. This happens when the mobile GPS (EPSG:4326 WGS84 coordinates) is plotted onto an unprojected EPSG:3857 map canvas, or when the scale units are mismatched.

## Mandatory Settings for QField in Sri Lanka

To ensure accurate GPS positioning and map rendering, the following must be set strictly to **EPSG:4326**:

### 1. Project CRS
The main `projectCrs` tag in the `.qgs` XML must be `EPSG:4326`.

### 2. Map Canvas Units
Inside the `<mapcanvas>` tag, `<units>` MUST be explicitly set to `degrees`.
*If left as `unknown`, QField will fail to calculate the scale correctly, leading to the scale bar reading "1e+07 km" when zoomed into Sri Lanka.*

### 3. Map Canvas Destination SRS
Inside the `<mapcanvas>` tag, a `<destinationsrs>` tag MUST exist, and it MUST be set to `EPSG:4326`.
*If missing, QField relies on implicit projection, which fails spectacularly when rendering EPSG:3857 basemaps over the EPSG:4326 canvas.*

### 4. Vector Layers CRS
The companion vector layers (survey geometries) in the GeoPackages must also be strictly `EPSG:4326`. The python scripts (`fix-geopackages-and-qgis.py`) automatically ensure that the schema and layer configurations match this.

---
**DO NOT switch the project back to EPSG:3857 (Web Mercator) to "fix" Google Maps.** 
While XYZ basemaps are naturally EPSG:3857, QField will successfully on-the-fly reproject them to EPSG:4326 *only if* the canvas units (`degrees`) and `destinationsrs` are correctly configured. Changing the project back to EPSG:3857 will break the GPS coordinate tracking in Sri Lanka.
