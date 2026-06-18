#!/bin/bash
# QFieldCloud PostgreSQL initialization
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Enable PostGIS extension
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_topology;
    
    -- Create schema for QFieldCloud
    CREATE SCHEMA IF NOT EXISTS qfieldcloud;
    GRANT ALL ON SCHEMA qfieldcloud TO qfield;
    
    -- Set default privileges
    ALTER DEFAULT PRIVILEGES IN SCHEMA qfieldcloud GRANT ALL ON TABLES TO qfield;
    ALTER DEFAULT PRIVILEGES IN SCHEMA qfieldcloud GRANT ALL ON SEQUENCES TO qfield;
    
    -- Create SLTSERP sync schema (for delta API integration)
    CREATE SCHEMA IF NOT EXISTS slt_sync;
    GRANT ALL ON SCHEMA slt_sync TO qfield;
EOSQL

echo "QFieldCloud PostgreSQL initialized successfully"