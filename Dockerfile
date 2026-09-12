# Build stage
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for mediasoup (no prebuilt binary for arm64)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip make g++ cmake && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:22-slim

WORKDIR /app

# Copy package files and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy built assets from builder
COPY --from=builder /app/dist ./dist

# Create recordings directory
RUN mkdir -p /app/recordings && chown node:node /app/recordings

EXPOSE 3000

USER node

CMD ["node", "dist/server/index.js"]
