FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production ---
FROM node:20-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Create recordings directory with proper permissions for node user
RUN mkdir -p /app/recordings && chown -R node:node /app/recordings

EXPOSE 3000

USER node

CMD ["node", "dist/server/index.js"]
