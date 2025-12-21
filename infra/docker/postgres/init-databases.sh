#!/bin/bash
set -e

# Create databases for each service
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE "users-service";
    # CREATE DATABASE "auth-service";
    # CREATE DATABASE "payment-service";
    
    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE "users-service" TO "$POSTGRES_USER";
    # GRANT ALL PRIVILEGES ON DATABASE "auth-service" TO "$POSTGRES_USER";
    # GRANT ALL PRIVILEGES ON DATABASE "payment-service" TO "$POSTGRES_USER";
EOSQL

echo "Databases created successfully!"

