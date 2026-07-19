---
kind: external_dependency
name: GeoServer WMS/WFS Services
slug: geoserver
category: external_dependency
category_hints:
    - vendor_identity
    - framework_behavior
scope:
    - '**'
---

### GeoServer GIS Services
- **Role:** Serves PostGIS spatial data via WMS (Web Map Service) and WFS (Web Feature Service) protocols for web mapping clients.
- **Integration:** Dockerized Java application with configurable memory settings (JAVA_OPTS=-Xms256m -Xmx1024m), data directory persistence, and PostGIS dependency.
- **Framework Behavior:** WAR deployment pattern with custom web.xml configuration for security and performance tuning.
- **Port Exposure:** Default port 8080 for WMS/WFS endpoints, separate from main application port.