# Service Ports Allocation

This document tracks port assignments for all services in the local development infrastructure.

## Port Allocation Strategy

- **3000-3099**: Reserved for application services (NestJS microservices)
- **4000+**: Reserved for infrastructure/observability services
- **Standard ports**: Databases and infrastructure use their standard ports

## Port Assignments

| Service                  | Port  | Description            | External URL           | Internal URL (backend-net)  |
| ------------------------ | ----- | ---------------------- | ---------------------- | --------------------------- |
| **Application Services** |       |                        |                        |                             |
| users-service            | 3000  | Users microservice     | http://localhost:3000  | http://users-service:3000   |
| auth-service             | 3001  | Auth microservice      | http://localhost:3001  | http://auth-service:3001    |
| payment-service          | 3002  | Payment microservice   | http://localhost:3002  | http://payment-service:3002 |
| gateway-service          | 3003  | API Gateway            | http://localhost:3003  | http://gateway-service:3003 |
| **Observability Stack**  |       |                        |                        |                             |
| Grafana                  | 4000  | Observability UI       | http://localhost:4000  | http://grafana:3000         |
| Loki                     | 3100  | Log aggregation        | http://localhost:3100  | http://loki:3100            |
| Prometheus               | 9090  | Metrics storage        | http://localhost:9090  | http://prometheus:9090      |
| Tempo                    | 3200  | Trace storage          | http://localhost:3200  | http://tempo:3200           |
| Tempo OTLP gRPC          | 4317  | OTLP gRPC endpoint     | localhost:4317         | tempo:4317                  |
| Tempo OTLP HTTP          | 4318  | OTLP HTTP endpoint     | http://localhost:4318  | http://tempo:4318           |
| Grafana Agent            | 12345 | Agent metrics endpoint | http://localhost:12345 | http://grafana-agent:12345  |
| **Databases**            |       |                        |                        |                             |
| PostgreSQL               | 5432  | Relational database    | localhost:5432         | postgres:5432               |
| MongoDB                  | 27017 | Document database      | localhost:27017        | mongodb:27017               |
| Redis                    | 6379  | Cache/Queue            | localhost:6379         | redis:6379                  |

## Notes

- Application services start from port 3000 and increment sequentially
- Grafana moved to port 4000 to avoid conflicts with service ports
- **Internal URLs**: Services communicate internally using container names on the `backend-net` network
- **External URLs**: Ports exposed to host (localhost) are for debugging/access only
- When configuring service-to-service communication, always use internal URLs (container names)
- Database connection strings should use internal URLs: `postgresql://admin:password@postgres:5432/users`

## Credentials

All services use:

- **Username**: `admin`
- **Password**: `password`

**⚠️ Security Note**: These credentials are for local development only. Never use in production!
