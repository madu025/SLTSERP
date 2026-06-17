FROM tomcat:9-jdk17-temurin

# GeoServer version
ENV GEOSERVER_VERSION=2.25.2
ENV GEOSERVER_DATA_DIR=/opt/geoserver_data

# Download and install GeoServer WAR
RUN apt-get update && apt-get install -y unzip curl && \
    mkdir -p /opt/geoserver && \
    curl -L https://sourceforge.net/projects/geoserver/files/GeoServer/${GEOSERVER_VERSION}/geoserver-${GEOSERVER_VERSION}-war.zip/download -o /tmp/geoserver.zip && \
    unzip /tmp/geoserver.zip -d /tmp/geoserver-extracted && \
    cp /tmp/geoserver-extracted/geoserver.war /usr/local/tomcat/webapps/geoserver.war && \
    mkdir -p ${GEOSERVER_DATA_DIR} && \
    rm -rf /tmp/geoserver* && \
    apt-get clean

# CORS filter for Tomcat
COPY web.xml /usr/local/tomcat/conf/web.xml

# Set environment for GeoServer
ENV GEOSERVER_HOME=/opt/geoserver
ENV GEOSERVER_LOG_LOCATION=/opt/geoserver/logs

# Create GeoServer directories
RUN mkdir -p ${GEOSERVER_DATA_DIR} ${GEOSERVER_LOG_LOCATION}

EXPOSE 8080

CMD ["catalina.sh", "run"]