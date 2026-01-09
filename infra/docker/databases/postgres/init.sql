-- Create logical databases for services
CREATE DATABASE users;
--CREATE DATABASE auth_db;
--CREATE DATABASE payment_db;
--CREATE DATABASE gateway_db;
-- Grant privileges (adjust as needed for your security requirements)
GRANT ALL PRIVILEGES ON DATABASE users TO admin;
--GRANT ALL PRIVILEGES ON DATABASE auth_db TO admin;
--GRANT ALL PRIVILEGES ON DATABASE payment_db TO admin;
--GRANT ALL PRIVILEGES ON DATABASE gateway_db TO admin;