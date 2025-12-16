# Docker Base Images

This directory contains base Docker images for consistent builds across services.

## Base Images

- **node.Dockerfile**: Base image for NestJS/Node.js services
  - Uses Node.js 24 (Alpine)
  - Includes pnpm
  - Multi-stage build (development & production)

- **python.Dockerfile**: Base image for Python services
  - Uses Python 3.12 (slim)
  - Includes Poetry
  - Multi-stage build (development & production)

## Usage

In your service Dockerfile, you can extend these base images:

```dockerfile
FROM code-hive-node-base:latest AS base
# Your service-specific setup
```
