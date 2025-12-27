-- Initialize databases for microservices
-- This script runs automatically when PostgreSQL container starts for the first time
-- Create database for users service
CREATE DATABASE users_service;
-- Grant privileges (adjust as needed for your security requirements)
GRANT ALL PRIVILEGES ON DATABASE users_service TO admin;
-- Add more databases as you add services
-- Example:
-- CREATE DATABASE your_service_db;
-- GRANT ALL PRIVILEGES ON DATABASE your_service_db TO admin;