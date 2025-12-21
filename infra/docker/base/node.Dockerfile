# Base Node.js image for NestJS services
FROM node:24-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Copy turbo.json (optional - will fail silently if not present)
COPY turbo.json* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Development stage
FROM base AS development
CMD ["pnpm", "dev"]

# Production stage
FROM base AS production
COPY . .
RUN pnpm build

CMD ["node", "dist/main.js"]

